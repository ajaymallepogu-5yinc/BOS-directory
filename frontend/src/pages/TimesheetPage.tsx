import { useEffect, useMemo, useRef, useState } from "react";
import { fetchProjects } from "../api/projectApi";
import type { Project } from "../api/projectApi";
import {
  fetchJiraTickets,
  fetchTimesheetEntries,
  createTimesheetEntry,
  updateTimesheetEntry,
  deleteTimesheetEntry,
  submitTimesheetWeek
} from "../api/timesheetApi";
import type { JiraTicket, TimesheetEntry, TimesheetEntryFormValues } from "../api/timesheetApi";
import ConfirmModal from "../components/Layout/ConfirmModal";
import { formatHoursLabel } from "../utils/time";
import { useTimesheetNotifications } from "../context/TimesheetNotificationsContext";

const MAX_DAILY_HOURS = 8;

type EntryMode = "ticket" | "task";

interface GridRow {
  id: number;
  mode: EntryMode;
  ticketValue: string; // composite "projectId:ticketKey" when mode === "ticket"
  taskDescription: string;
  taskProjectId: number | null;
  hours: Record<string, string>;
  comments: Record<string, string>; // per-day comment, since each day saves as its own entry
  entryIds: Record<string, number>; // day -> saved entry id, so Save updates/deletes instead of duplicating
}

function makeEmptyGridRow(id: number, weekDates: string[]): GridRow {
  return {
    id,
    mode: "ticket",
    ticketValue: "",
    taskDescription: "",
    taskProjectId: null,
    hours: Object.fromEntries(weekDates.map((d) => [d, ""])),
    comments: {},
    entryIds: {}
  };
}

// Approval is a whole-week decision now (Timesheet.Status), not per-entry - once submitted
// (Pending), the whole grid is out of the employee's hands until the manager decides. Only
// Draft (not yet submitted) and Rejected (kicked back for a fix) weeks stay editable.
function isWeekLocked(status: TimesheetEntry["timesheetStatus"] | undefined): boolean {
  return status === "Pending" || status === "Approved";
}

// Rebuilds the grid from every entry for the given week (any status), grouping same ticket/task
// back into one row across days - this is what makes previously-entered hours show up again
// instead of the grid always looking blank, and keeps submitted/approved/rejected rows visible
// instead of them disappearing once no longer Draft.
function buildGridRows(entries: TimesheetEntry[], weekIsos: string[], nextId: () => number): GridRow[] {
  const relevant = entries.filter((e) => weekIsos.includes(e.workDate.slice(0, 10)));
  const groups = new Map<string, GridRow>();
  for (const e of relevant) {
    const isTicket = !!e.jiraIssueKey;
    const key = isTicket ? `t:${e.projectId}:${e.jiraIssueKey}` : `k:${e.projectId ?? ""}:${e.taskDescription ?? ""}`;
    let row = groups.get(key);
    if (!row) {
      row = {
        id: nextId(),
        mode: isTicket ? "ticket" : "task",
        ticketValue: isTicket ? `${e.projectId}:${e.jiraIssueKey}` : "",
        taskDescription: isTicket ? "" : e.taskDescription || "",
        taskProjectId: isTicket ? null : e.projectId ?? null,
        hours: Object.fromEntries(weekIsos.map((d) => [d, ""])),
        comments: {},
        entryIds: {}
      };
      groups.set(key, row);
    }
    const dayIso = e.workDate.slice(0, 10);
    row.hours[dayIso] = String(e.hoursSpent);
    if (e.comment) row.comments[dayIso] = e.comment;
    row.entryIds[dayIso] = e.id;
  }
  // Rows come out of the Map in whatever order their ticket/task was first encountered while
  // walking `entries` - and entries arrive sorted by work date descending, so a row whose only
  // hours land on a later day (e.g. Friday) gets grouped before one that started on Monday. Sort
  // by each row's oldest entry id instead - a stable "whichever ticket was actually added first"
  // order that doesn't shuffle depending on which day happens to have hours.
  const rows = [...groups.values()].sort(
    (a, b) => Math.min(...Object.values(a.entryIds)) - Math.min(...Object.values(b.entryIds))
  );
  // Only when the week is otherwise completely empty - a fresh/all-cleared week starts with one
  // ready-to-type row instead of looking blank, but saving/reloading never re-adds one on top of
  // real rows (that's what "+ Add Ticket" is for).
  return rows.length > 0 ? rows : [makeEmptyGridRow(nextId(), weekIsos)];
}

function weekIsosFor(start: Date): string[] {
  return Array.from({ length: 5 }, (_, i) => toIsoDate(addDays(start, i)));
}

function splitTicketValue(value: string): { projectId: number; ticketKey: string } {
  const idx = value.indexOf(":");
  return { projectId: Number(value.slice(0, idx)), ticketKey: value.slice(idx + 1) };
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const HOUR_STEP = 0.25; // 15 minutes, matches the old numeric input's step
const OTHER_TICKET_VALUE = "__other__"; // sentinel: last entry in the ticket dropdown, switches the row to task mode

// row.hours[d] keeps storing decimal hours (e.g. "2.25") - only the on-screen
// representation is H:MM, so rowTotal/handleSaveGrid/buildGridRows stay untouched.
function hoursToTimeLabel(value: string): string {
  const v = parseFloat(value);
  const total = !value || isNaN(v) || v <= 0 ? 0 : v;
  const h = Math.floor(total);
  const m = Math.round((total - h) * 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

// While a cell is being typed into, editingCell.text holds just the digits pressed so far
// (no colon) - the last two digits are always minutes and whatever's left shifts into hours,
// so typing "12" reads as 12 minutes (0:12) rather than being misread as 12 hours.
function parseDigits(digits: string): { hours: number; minutes: number } {
  const trimmed = digits.slice(-4);
  if (!trimmed) return { hours: 0, minutes: 0 };
  const minutePart = trimmed.length <= 2 ? trimmed : trimmed.slice(-2);
  const hourPart = trimmed.length <= 2 ? "0" : trimmed.slice(0, -2);
  return { hours: parseInt(hourPart, 10) || 0, minutes: Math.min(59, parseInt(minutePart, 10) || 0) };
}

function digitsToTimeLabel(digits: string): string {
  const { hours, minutes } = parseDigits(digits);
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

function digitsToDecimalHours(digits: string): number {
  const { hours, minutes } = parseDigits(digits);
  return hours + minutes / 60;
}

interface DropdownOption {
  value: string;
  label: string;
}

function Dropdown({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  clearable = true,
  searchable = false,
  stickyOption
}: {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder: string;
  disabled?: boolean;
  clearable?: boolean;
  searchable?: boolean;
  // Always shown below the scrollable list, unaffected by search/scroll - for an option that
  // should never be buried among the regular ones (e.g. "Other").
  stickyOption?: DropdownOption;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((o) => o.value === value);
  const filtered = searchable && query.trim() ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase())) : options;

  const toggleOpen = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setIsOpen((v) => !v);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        className="w-full flex items-center justify-between gap-1.5 rounded-lg border border-ink-200 px-2.5 py-2 text-xs bg-white hover:border-ink-300 focus:border-brand focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed text-left transition-colors"
      >
        <span className={`truncate ${selected ? "text-ink-800" : "text-ink-400"}`}>{selected ? selected.label : placeholder}</span>
        <svg
          className={`h-3.5 w-3.5 text-ink-400 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && pos && (
        <>
          {/* Fixed positioning (anchored to the button's actual screen rect) instead of absolute -
              absolute would get clipped by any scrollable ancestor, e.g. the grid's overflow-x wrapper. */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setIsOpen(false);
              setQuery("");
            }}
          />
          <div
            className="fixed z-50 rounded-xl border border-ink-150 bg-white shadow-lg animate-fade-in min-w-max"
            style={{ top: pos.top, left: pos.left, minWidth: pos.width }}
          >
            {searchable && (
              <div className="p-1.5 border-b border-ink-100">
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type to search..."
                  className="w-full rounded-lg border border-ink-200 px-2 py-1.5 text-xs focus:border-brand focus:outline-none"
                />
              </div>
            )}
            <div className="max-h-52 overflow-y-auto scrollbar-none py-1 divide-y divide-ink-50">
              {clearable && (
                <div
                  onClick={() => {
                    onChange("");
                    setIsOpen(false);
                    setQuery("");
                  }}
                  className={`px-3 py-2 text-xs cursor-pointer hover:bg-brand/10 transition-colors ${
                    !value ? "bg-brand/5 font-semibold text-brand" : "text-ink-400 italic"
                  }`}
                >
                  {placeholder}
                </div>
              )}
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-xs text-ink-400 italic">No matches</div>
              ) : (
                filtered.map((opt) => (
                  <div
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setQuery("");
                    }}
                    className={`px-3 py-2 text-xs cursor-pointer hover:bg-brand/10 transition-colors whitespace-nowrap ${
                      value === opt.value ? "bg-brand/5 font-semibold text-brand" : "text-ink-700"
                    }`}
                  >
                    {opt.label}
                  </div>
                ))
              )}
            </div>
            {stickyOption && (
              <div className="p-1.5 border-t border-ink-100">
                <button
                  type="button"
                  onClick={() => {
                    onChange(stickyOption.value);
                    setIsOpen(false);
                    setQuery("");
                  }}
                  className={`w-full rounded-lg px-3 py-1.5 text-xs font-semibold text-center transition-colors whitespace-nowrap ${
                    value === stickyOption.value
                      ? "bg-ink-700 text-white"
                      : "bg-ink-100 text-ink-700 border border-ink-200 hover:bg-ink-200 hover:border-ink-300"
                  }`}
                >
                  {stickyOption.label}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function TimesheetPage() {
  const { refresh: refreshNotifications } = useTimesheetNotifications();
  const [projects, setProjects] = useState<Project[]>([]);
  const [myEntries, setMyEntries] = useState<TimesheetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Week navigation + grid state
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const weekDays = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekDateIsos = useMemo(() => weekDays.map(toIsoDate), [weekDays]);
  // Sat/Sun are shown in the grid for a complete week view, but aren't fillable - kept
  // separate from weekDays/weekDateIsos so the save/submit/cap logic never has to filter them out.
  const displayDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const [ticketsByProject, setTicketsByProject] = useState<Record<number, JiraTicket[]>>({});
  const [ticketsLoading, setTicketsLoading] = useState<Record<number, boolean>>({});

  const nextRowId = useRef(1);
  const [rows, setRows] = useState<GridRow[]>([]);
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});
  const pendingScrollRowId = useRef<number | null>(null);
  const [isSavingGrid, setIsSavingGrid] = useState(false);
  const [openCommentCell, setOpenCommentCell] = useState<{ rowId: number; day: string; top: number; left: number } | null>(null);
  // Digit buffer for whichever hours cell is actively being typed into (see parseDigits) -
  // only exists once the user presses a digit; row.hours (decimal) is committed on blur/wheel.
  const [editingCell, setEditingCell] = useState<{ rowId: number; day: string; text: string } | null>(null);

  // Row-removal confirm state (only asked when the row has saved entries behind it)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<number | null>(null);

  // Submit Week state
  const [submitWeekConfirmOpen, setSubmitWeekConfirmOpen] = useState(false);
  const [isSubmittingWeek, setIsSubmittingWeek] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const [projList, mine] = await Promise.all([fetchProjects(), fetchTimesheetEntries("mine")]);
      setProjects(projList);
      setMyEntries(mine);
      setRows(buildGridRows(mine, weekDateIsos, () => nextRowId.current++));
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Failed to load timesheet data.");
    } finally {
      setLoading(false);
    }
  };

  const refreshEntries = async (): Promise<TimesheetEntry[]> => {
    try {
      const mine = await fetchTimesheetEntries("mine");
      setMyEntries(mine);
      return mine;
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Failed to refresh timesheet entries.");
      return myEntries;
    }
  };

  const showNotification = (type: "success" | "error", message: string) => {
    if (type === "success") {
      setSuccessMsg(message);
      setTimeout(() => setSuccessMsg(""), 4000);
    } else {
      setErrorMsg(message);
      setTimeout(() => setErrorMsg(""), 5000);
    }
  };

  const ensureTicketsLoaded = (projectId: number) => {
    setTicketsLoading((prev) => {
      if (prev[projectId] || ticketsByProject[projectId]) return prev;
      fetchJiraTickets(projectId)
        .then((list) => setTicketsByProject((p) => ({ ...p, [projectId]: list })))
        .catch(() => setTicketsByProject((p) => ({ ...p, [projectId]: [] })))
        .finally(() => setTicketsLoading((p) => ({ ...p, [projectId]: false })));
      return { ...prev, [projectId]: true };
    });
  };

  // Eagerly warm the ticket cache for every project so the unified search box has
  // something to search across as soon as the user starts typing.
  useEffect(() => {
    projects.forEach((p) => ensureTicketsLoaded(p.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  const allTicketOptions = useMemo<DropdownOption[]>(() => {
    return projects.flatMap((p) =>
      (ticketsByProject[p.id] || []).map((t) => ({
        value: `${p.id}:${t.key}`,
        label: `${t.key} — ${t.summary} · ${p.name}`
      }))
    );
  }, [projects, ticketsByProject]);

  const anyTicketsLoading = useMemo(() => Object.values(ticketsLoading).some(Boolean), [ticketsLoading]);

  // The whole week shares one status (Timesheet.Status) - every entry for this week carries the
  // same timesheetStatus by construction, so any one of them tells you the week's state.
  const weekEntries = useMemo(
    () => myEntries.filter((e) => weekDateIsos.includes(e.workDate.slice(0, 10))),
    [myEntries, weekDateIsos]
  );
  const weekStatus: TimesheetEntry["timesheetStatus"] = weekEntries[0]?.timesheetStatus ?? "Draft";
  const weekLocked = isWeekLocked(weekStatus);

  const addRow = () => {
    const id = nextRowId.current++;
    pendingScrollRowId.current = id;
    setRows((prev) => [...prev, makeEmptyGridRow(id, weekDateIsos)]);
  };

  // Scrolls the newly-added row into view - otherwise it's added below the fold of the
  // grid's internal scroll area and looks like the click did nothing.
  useEffect(() => {
    if (pendingScrollRowId.current == null) return;
    rowRefs.current[pendingScrollRowId.current]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    pendingScrollRowId.current = null;
  }, [rows]);

  // Removing a row backed by already-saved entries needs confirmation (and a server-side delete),
  // otherwise it'd silently reappear next time the grid rehydrates (e.g. on Save or week nav).
  // A row with nothing saved yet is just removed locally, no confirmation needed.
  const removeRow = (id: number) => {
    const row = rows.find((r) => r.id === id);
    const idsToDelete = row ? Object.values(row.entryIds) : [];
    if (idsToDelete.length === 0) {
      setRows((prev) => prev.filter((r) => r.id !== id));
      return;
    }
    setRowToDelete(id);
    setDeleteConfirmOpen(true);
  };

  // The whole week is either editable or not - Pending/Approved weeks leave every saved entry
  // untouched even if the row itself is being removed.
  const handleConfirmRemoveRow = async () => {
    if (rowToDelete === null) return;
    setDeleteConfirmOpen(false);
    const row = rows.find((r) => r.id === rowToDelete);
    const removableIds = row && !weekLocked ? weekDateIsos.filter((d) => row.entryIds[d]).map((d) => row.entryIds[d]) : [];
    const hadLockedDays = row && weekLocked ? weekDateIsos.some((d) => row.entryIds[d]) : false;

    if (removableIds.length === 0) {
      showNotification("error", "This week is submitted/approved, which can't be removed here.");
      setRowToDelete(null);
      return;
    }

    try {
      await Promise.all(removableIds.map((eid) => deleteTimesheetEntry(eid)));
      showNotification(
        "success",
        hadLockedDays ? "Removed the editable entries - submitted/approved days were left as-is." : "Row removed."
      );
      const fresh = await refreshEntries();
      setRows(buildGridRows(fresh, weekDateIsos, () => nextRowId.current++));
    } catch (err: any) {
      showNotification("error", err.response?.data?.message || "Failed to remove entries.");
    } finally {
      setRowToDelete(null);
    }
  };

  const goToWeek = (newStart: Date) => {
    setWeekStart(newStart);
    setRows(buildGridRows(myEntries, weekIsosFor(newStart), () => nextRowId.current++));
  };

  const updateRow = (id: number, patch: Partial<GridRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const updateHour = (id: number, dateIso: string, value: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, hours: { ...r.hours, [dateIso]: value } } : r)));

  const rowTotal = (row: GridRow) => weekDateIsos.reduce((sum, d) => sum + (parseFloat(row.hours[d]) || 0), 0);

  const handleSaveGrid = async () => {
    if (weekLocked) {
      showNotification("error", "This week is pending your manager's review or already approved and can't be edited.");
      return;
    }

    // Cells already backed by a saved entry (row.entryIds) must be updated/deleted in place, not
    // recreated - otherwise every re-save would duplicate the hours already on the server.
    const touchedIds = new Set<number>();
    for (const row of rows) {
      for (const d of weekDateIsos) {
        const id = row.entryIds[d];
        if (id) touchedIds.add(id);
      }
    }

    const dayTotals: Record<string, number> = {};
    for (const iso of weekDateIsos) {
      dayTotals[iso] = myEntries
        .filter((e) => e.workDate.slice(0, 10) === iso && !touchedIds.has(e.id))
        .reduce((sum, e) => sum + e.hoursSpent, 0);
    }

    const toCreate: TimesheetEntryFormValues[] = [];
    const toUpdate: { id: number; values: TimesheetEntryFormValues }[] = [];
    const toDelete: number[] = [];

    for (const row of rows) {
      const filledDays = weekDateIsos.filter((d) => {
        const v = parseFloat(row.hours[d]);
        return !isNaN(v) && v > 0;
      });
      const clearedDays = weekDateIsos.filter((d) => {
        const v = parseFloat(row.hours[d]);
        return (isNaN(v) || v <= 0) && !!row.entryIds[d];
      });
      if (filledDays.length === 0 && clearedDays.length === 0) continue;

      const hasTicket = row.mode === "ticket" && !!row.ticketValue;
      const hasTask = row.mode === "task" && !!row.taskDescription.trim();
      if (filledDays.length > 0 && !hasTicket && !hasTask) {
        showNotification("error", row.mode === "ticket" ? "Select a ticket for every row with hours entered." : "Describe the work for every row with hours entered.");
        return;
      }

      let projectId: number | null = null;
      let ticketKey: string | undefined;
      let ticketSummary: string | undefined;
      if (hasTicket) {
        const parsed = splitTicketValue(row.ticketValue);
        projectId = parsed.projectId;
        ticketKey = parsed.ticketKey;
        ticketSummary = ticketsByProject[projectId]?.find((t) => t.key === ticketKey)?.summary;
      } else {
        projectId = row.taskProjectId;
      }

      for (const d of filledDays) {
        const hrs = parseFloat(row.hours[d]);
        dayTotals[d] = (dayTotals[d] || 0) + hrs;
        const values: TimesheetEntryFormValues = {
          projectId,
          jiraIssueKey: hasTicket ? ticketKey : undefined,
          jiraIssueSummary: hasTicket ? ticketSummary : undefined,
          taskDescription: hasTask ? row.taskDescription.trim() : undefined,
          workDate: d,
          hoursSpent: hrs,
          comment: (row.comments[d] || "").trim() || undefined
        };
        const existingId = row.entryIds[d];
        if (existingId) toUpdate.push({ id: existingId, values });
        else toCreate.push(values);
      }

      for (const d of clearedDays) toDelete.push(row.entryIds[d]);
    }

    if (toCreate.length === 0 && toUpdate.length === 0 && toDelete.length === 0) {
      showNotification("error", "Enter hours for at least one ticket before saving.");
      return;
    }

    const overDay = weekDateIsos.find((d) => dayTotals[d] > MAX_DAILY_HOURS);
    if (overDay) {
      showNotification("error", `${formatDate(overDay)} would total ${formatHoursLabel(dayTotals[overDay])} — over the ${MAX_DAILY_HOURS}-hour daily limit.`);
      return;
    }

    setIsSavingGrid(true);
    try {
      await Promise.all([
        ...toCreate.map((v) => createTimesheetEntry(v)),
        ...toUpdate.map((u) => updateTimesheetEntry(u.id, u.values)),
        ...toDelete.map((id) => deleteTimesheetEntry(id))
      ]);
      const changeCount = toCreate.length + toUpdate.length + toDelete.length;
      showNotification("success", `Saved ${changeCount} ${changeCount === 1 ? "change" : "changes"}.`);
      const fresh = await refreshEntries();
      setRows(buildGridRows(fresh, weekDateIsos, () => nextRowId.current++));
      refreshNotifications();
    } catch (err: any) {
      showNotification("error", err.response?.data?.message || "Failed to save some entries. Please check and try again.");
      const fresh = await refreshEntries();
      setRows(buildGridRows(fresh, weekDateIsos, () => nextRowId.current++));
    } finally {
      setIsSavingGrid(false);
    }
  };

  const weekDrafts = useMemo(() => weekEntries.filter((e) => e.timesheetStatus === "Draft"), [weekEntries]);
  const weekDraftTotal = useMemo(() => weekDrafts.reduce((sum, e) => sum + e.hoursSpent, 0), [weekDrafts]);

  // Summarizes whatever's already been submitted this week - the whole point is to make
  // "yes, this went through" (or "this got rejected, go fix it") obvious without hunting for it.
  // Every entry in the week shares the same status, so this naturally collapses to one bucket.
  const weekStatusSummary = useMemo(() => {
    const summary: Record<string, { count: number; hours: number }> = {};
    for (const e of weekEntries) {
      if (e.timesheetStatus === "Draft") continue;
      const bucket = summary[e.timesheetStatus] ?? { count: 0, hours: 0 };
      bucket.count += 1;
      bucket.hours += e.hoursSpent;
      summary[e.timesheetStatus] = bucket;
    }
    return summary;
  }, [weekEntries]);

  const weekReviewerComment = useMemo(
    () => (weekStatus === "Rejected" ? weekEntries.find((e) => e.reviewerComment)?.reviewerComment : undefined),
    [weekStatus, weekEntries]
  );

  const handleConfirmSubmitWeek = async () => {
    setIsSubmittingWeek(true);
    try {
      const result = await submitTimesheetWeek(toIsoDate(weekStart));
      showNotification("success", `Submitted ${result.submittedCount} ${result.submittedCount === 1 ? "entry" : "entries"} to your manager.`);
      setSubmitWeekConfirmOpen(false);
      const fresh = await refreshEntries();
      setRows(buildGridRows(fresh, weekDateIsos, () => nextRowId.current++));
      refreshNotifications();
    } catch (err: any) {
      showNotification("error", err.response?.data?.message || "Failed to submit week.");
    } finally {
      setIsSubmittingWeek(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  const formatShortDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  const formatWeekRange = (start: Date, end: Date) => {
    const startStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endStr = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${startStr} – ${endStr}`;
  };

  return (
    <div className="h-full flex flex-col bg-ink-50/20 p-8 overflow-hidden">
      {successMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 text-xs font-semibold shadow-lg animate-fade-in">
          <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 text-xs font-semibold shadow-lg animate-fade-in max-w-md">
          <svg className="h-4 w-4 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {errorMsg}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-ink-150 pb-6 mb-6">
        <div>
          <h1 className="font-display text-2xl font-black text-ink-900 leading-tight">Timesheet</h1>
          <p className="text-xs text-ink-500 mt-1">Log time throughout the week as drafts, then submit the whole week to your manager for approval.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-ink-200 border-t-brand" />
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col gap-5">
          {/* Compact week navigation, with the submission-status badges sharing the same row */}
          <div className="shrink-0 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToWeek(addDays(weekStart, -7))}
                className="p-1.5 rounded-lg border border-ink-200 bg-white text-ink-500 hover:bg-ink-50 transition-all"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-xs font-black text-ink-800">{formatWeekRange(weekDays[0], weekDays[4])}</span>
              <button
                onClick={() => goToWeek(addDays(weekStart, 7))}
                className="p-1.5 rounded-lg border border-ink-200 bg-white text-ink-500 hover:bg-ink-50 transition-all"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                onClick={() => goToWeek(getMonday(new Date()))}
                className="text-[10px] font-bold text-brand hover:underline ml-1"
              >
                Today
              </button>
            </div>

            {/* Makes "yes, this was actually submitted" (or "this got rejected") obvious at a glance -
                otherwise the only sign is a locked-looking grid, easy to miss. */}
            {Object.keys(weekStatusSummary).length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {weekStatusSummary.Pending && (
                  <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-150">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    {formatHoursLabel(weekStatusSummary.Pending.hours)} submitted, awaiting your manager's approval ({weekStatusSummary.Pending.count})
                  </span>
                )}
                {weekStatusSummary.Approved && (
                  <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-150">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {formatHoursLabel(weekStatusSummary.Approved.hours)} approved ({weekStatusSummary.Approved.count})
                  </span>
                )}
                {weekStatusSummary.Rejected && (
                  <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-150">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                    {formatHoursLabel(weekStatusSummary.Rejected.hours)} rejected - edit to fix and resubmit ({weekStatusSummary.Rejected.count})
                    {weekReviewerComment ? ` · "${weekReviewerComment}"` : ""}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Weekly entry grid - search a ticket once, fill hours across whichever days apply */}
          <div className="shrink-0">
            <div className="rounded-2xl border border-ink-150 bg-white shadow-sm overflow-auto scrollbar-none max-h-64">
              <table className="w-full text-left border-collapse min-w-[920px]">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-ink-150 bg-ink-50 text-[10px] font-bold uppercase tracking-wider text-ink-500">
                    <th className="py-3 px-4 w-72">Ticket / Task</th>
                    {displayDays.map((d) => {
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      return (
                        <th key={toIsoDate(d)} className={`py-3 px-2 text-center w-20 ${isWeekend ? "text-ink-300" : ""}`}>
                          <div>{d.toLocaleDateString("en-US", { weekday: "short" })}</div>
                          <div className="text-[9px] font-normal normal-case tracking-normal text-ink-400 mt-0.5">
                            {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </div>
                        </th>
                      );
                    })}
                    <th className="py-3 px-3 text-center w-16">Total</th>
                    <th className="py-3 px-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      ref={(el) => { rowRefs.current[row.id] = el; }}
                      className="scroll-mb-14" // reserves room so scrollIntoView clears the sticky footer instead of landing underneath it
                    >
                      <td className="py-3 px-4 align-top">
                        <div className="flex flex-col gap-1.5">
                          {row.mode === "ticket" ? (
                            <Dropdown
                              value={row.ticketValue}
                              onChange={(v) =>
                                v === OTHER_TICKET_VALUE
                                  ? updateRow(row.id, { mode: "task", ticketValue: "" })
                                  : updateRow(row.id, { ticketValue: v })
                              }
                              options={allTicketOptions}
                              stickyOption={{ value: OTHER_TICKET_VALUE, label: "Other (no ticket)" }}
                              placeholder={anyTicketsLoading ? "Loading tickets..." : "Search any ticket..."}
                              clearable={false}
                              searchable
                              disabled={weekLocked}
                            />
                          ) : (
                            <>
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold text-ink-400 uppercase tracking-wide">Other work</span>
                                {!weekLocked && (
                                  <button
                                    type="button"
                                    onClick={() => updateRow(row.id, { mode: "ticket", taskDescription: "", taskProjectId: null })}
                                    className="text-[9px] font-bold text-brand hover:underline"
                                  >
                                    Search a ticket instead
                                  </button>
                                )}
                              </div>
                              <input
                                type="text"
                                placeholder="What did you work on?"
                                value={row.taskDescription}
                                disabled={weekLocked}
                                onChange={(e) => updateRow(row.id, { taskDescription: e.target.value })}
                                className="rounded-lg border border-ink-200 px-2 py-1.5 text-[11px] text-ink-800 placeholder-ink-400 focus:border-brand focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                              />
                              <Dropdown
                                value={row.taskProjectId ? String(row.taskProjectId) : ""}
                                onChange={(v) => updateRow(row.id, { taskProjectId: v ? Number(v) : null })}
                                options={projects.map((p) => ({ value: String(p.id), label: p.name }))}
                                placeholder="Project (optional)"
                                disabled={weekLocked}
                              />
                            </>
                          )}
                        </div>
                      </td>
                      {displayDays.map((dDate) => {
                        const d = toIsoDate(dDate);
                        if (!weekDateIsos.includes(d)) {
                          // Sat/Sun - shown for a complete week view but not fillable.
                          return (
                            <td key={d} className="py-3 px-2 align-top text-center">
                              <div className="w-14 mx-auto py-1.5 text-[11px] text-ink-300">—</div>
                            </td>
                          );
                        }
                        const hasComment = !!(row.comments[d] || "").trim();
                        const isPopupOpen = openCommentCell?.rowId === row.id && openCommentCell?.day === d;
                        const isEditingCell = editingCell?.rowId === row.id && editingCell?.day === d;
                        const cellDisplayValue = isEditingCell ? digitsToTimeLabel(editingCell!.text) : hoursToTimeLabel(row.hours[d]);
                        const cellTitle = row.comments[d] ? `Comment: ${row.comments[d]}` : undefined;
                        return (
                          <td key={d} className="py-3 px-2 align-top text-center relative">
                            <div className="relative inline-block">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={cellDisplayValue}
                                disabled={weekLocked}
                                title={cellTitle}
                                onChange={(e) => {
                                  // Only reached by paste/IME - typed digits are handled in onKeyDown instead.
                                  const digits = e.target.value.replace(/\D/g, "").slice(-4);
                                  setEditingCell({ rowId: row.id, day: d, text: digits });
                                }}
                                onKeyDown={(e) => {
                                  if (/^[0-9]$/.test(e.key)) {
                                    e.preventDefault();
                                    const current = isEditingCell ? editingCell!.text : "";
                                    setEditingCell({ rowId: row.id, day: d, text: (current + e.key).slice(-4) });
                                  } else if (e.key === "Backspace" && isEditingCell) {
                                    e.preventDefault();
                                    setEditingCell({ rowId: row.id, day: d, text: editingCell!.text.slice(0, -1) });
                                  } else if (e.key === "Enter") {
                                    e.preventDefault();
                                    e.currentTarget.blur();
                                  } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                                    e.preventDefault(); // digits only - mask handles the colon itself
                                  }
                                }}
                                onFocus={(e) => {
                                  const rect = e.target.getBoundingClientRect();
                                  setOpenCommentCell({ rowId: row.id, day: d, top: rect.bottom + 4, left: rect.left });
                                }}
                                onBlur={() => {
                                  if (isEditingCell) {
                                    const decimal = digitsToDecimalHours(editingCell!.text);
                                    updateHour(row.id, d, decimal > 0 ? String(decimal) : "");
                                    setEditingCell(null);
                                  }
                                }}
                                onWheel={(e) => {
                                  if (document.activeElement !== e.currentTarget) return; // don't hijack page scroll when not focused
                                  e.preventDefault();
                                  const current = parseFloat(row.hours[d]) || 0;
                                  const delta = e.deltaY < 0 ? HOUR_STEP : -HOUR_STEP;
                                  const next = Math.max(0, Math.round((current + delta) * 4) / 4);
                                  updateHour(row.id, d, next > 0 ? String(next) : "");
                                  setEditingCell(null);
                                }}
                                className={`w-14 rounded-lg border px-1.5 py-1.5 text-[11px] text-center text-ink-800 focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed disabled:bg-ink-50 ${
                                  isPopupOpen ? "border-brand" : "border-ink-200 focus:border-brand"
                                }`}
                              />
                              {hasComment && <span className="absolute -top-1 -right-1 h-1.5 w-1.5 rounded-full bg-brand" />}
                            </div>
                          </td>
                        );
                      })}
                      <td className="py-3 px-3 text-center align-top text-xs font-bold text-ink-800">
                        {rowTotal(row) > 0 ? formatHoursLabel(rowTotal(row)) : ""}
                      </td>
                      <td className="py-3 px-3 align-top text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="p-1 text-ink-300 hover:text-rose-600 rounded transition-all"
                          title="Remove row"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 z-10 bg-white">
                  <tr className="border-t border-ink-150 bg-ink-50/50">
                    <td className="py-2.5 px-4">
                      <button
                        type="button"
                        onClick={addRow}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-brand hover:underline"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Ticket
                      </button>
                    </td>
                    <td colSpan={7}></td>
                    <td className="py-2.5 px-3 text-center text-xs font-black text-ink-900">
                      {formatHoursLabel(rows.reduce((sum, r) => sum + rowTotal(r), 0))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex items-center justify-end gap-3 mt-3">
              {weekDrafts.length > 0 && (
                <span className="text-xs text-ink-500">
                  <span className="font-black text-ink-900">{formatHoursLabel(weekDraftTotal)}</span> drafted, not yet submitted
                </span>
              )}
              <button
                onClick={handleSaveGrid}
                disabled={isSavingGrid || weekLocked}
                className="py-2 px-5 rounded-xl border border-ink-200 bg-white text-xs font-semibold text-ink-700 hover:bg-ink-50 transition-all disabled:opacity-50"
              >
                {isSavingGrid ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setSubmitWeekConfirmOpen(true)}
                disabled={weekDrafts.length === 0}
                className="py-2 px-5 rounded-xl bg-brand text-xs font-semibold text-white hover:bg-brand/90 transition-all shadow-md shadow-brand/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Submit Weekly Timesheet
              </button>
            </div>
          </div>

        </div>
      )}

      {/* Per-cell comment popup - rendered at the top level (fixed position) so it's never
          clipped by the grid's scrollable overflow-x wrapper. */}
      {openCommentCell &&
        (() => {
          const activeRow = rows.find((r) => r.id === openCommentCell.rowId);
          if (!activeRow) return null;
          return (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpenCommentCell(null)} />
              <div
                className="fixed z-50 w-56 rounded-xl border border-ink-150 bg-white shadow-lg p-2 animate-fade-in"
                style={{ top: openCommentCell.top, left: openCommentCell.left }}
              >
                <textarea
                  rows={2}
                  placeholder="Add comment"
                  value={activeRow.comments[openCommentCell.day] || ""}
                  onChange={(e) =>
                    updateRow(openCommentCell.rowId, {
                      comments: { ...activeRow.comments, [openCommentCell.day]: e.target.value }
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      setOpenCommentCell(null);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full rounded-lg border border-ink-200 px-2 py-1.5 text-[11px] text-ink-800 placeholder-ink-400 focus:border-brand focus:outline-none resize-none"
                />
              </div>
            </>
          );
        })()}

      {/* Submit Weekly Timesheet confirmation modal */}
      {submitWeekConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-ink-150 bg-white p-6 shadow-xl animate-slide-up max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-ink-150 pb-4 mb-4 shrink-0">
              <h2 className="text-sm font-black text-ink-900">
                Submit Weekly Timesheet — {formatShortDate(toIsoDate(weekStart))} to {formatShortDate(toIsoDate(addDays(weekStart, 4)))}
              </h2>
              <button
                onClick={() => setSubmitWeekConfirmOpen(false)}
                className="text-ink-400 hover:text-ink-600 p-1 rounded-lg hover:bg-ink-100"
              >
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto scrollbar-none -mx-1 px-1">
              {weekDateIsos.map((iso) => {
                const dayDrafts = weekDrafts.filter((e) => e.workDate.slice(0, 10) === iso);
                if (dayDrafts.length === 0) return null;
                return (
                  <div key={iso} className="mb-3">
                    <p className="text-[10px] font-bold text-ink-500 uppercase tracking-wide mb-1.5">{formatDate(iso)}</p>
                    <div className="rounded-xl border border-ink-150 divide-y divide-ink-100">
                      {dayDrafts.map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between px-3 py-2 text-xs gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            {entry.jiraIssueKey ? (
                              <span className="shrink-0 rounded-lg bg-sky-50/50 border border-sky-100/70 text-sky-800 font-mono text-[10px] px-2 py-1">
                                {entry.jiraIssueKey}
                              </span>
                            ) : (
                              <span className="text-ink-700 truncate">{entry.taskDescription}</span>
                            )}
                            {entry.comment && <span className="text-ink-400 italic truncate">"{entry.comment}"</span>}
                          </div>
                          <span className="font-semibold text-ink-800 shrink-0">{formatHoursLabel(entry.hoursSpent)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-4 mt-2 border-t border-ink-150 shrink-0">
              <span className="text-xs font-black text-ink-900">
                Total: {formatHoursLabel(weekDraftTotal)} across {weekDrafts.length} {weekDrafts.length === 1 ? "entry" : "entries"}
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => setSubmitWeekConfirmOpen(false)}
                  className="py-2 px-4 rounded-xl border border-ink-200 bg-white text-xs font-semibold text-ink-700 hover:bg-ink-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSubmitWeek}
                  disabled={isSubmittingWeek}
                  className="py-2 px-4 rounded-xl bg-brand text-xs font-semibold text-white hover:bg-brand/90 transition-all shadow-md shadow-brand/10 disabled:opacity-50"
                >
                  {isSubmittingWeek ? "Submitting..." : "Confirm Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title="Remove Row"
        message="Remove this row? Any editable entries in it will be deleted - submitted/approved days are left untouched. This action cannot be undone."
        confirmLabel="Remove"
        isDestructive={true}
        onConfirm={handleConfirmRemoveRow}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
}
