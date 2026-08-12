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
const SAVE_CONCURRENCY_LIMIT = 4; // keeps peak concurrent save requests well under the database's connection limit

async function runInBatches<T>(items: T[], batchSize: number, run: (item: T) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    await Promise.all(items.slice(i, i + batchSize).map(run));
  }
}

/** One "what" line under a project: either a ticket (pickerValue = "ticket:KEY") or an
 * activity type (pickerValue = "type:CODE"). OTH additionally carries a free-text description. */
interface GridRow {
  id: number;
  pickerValue: string;
  description: string;
  hours: Record<string, string>;
  comments: Record<string, string>; // per-day comment, since each day saves as its own entry
  entryIds: Record<string, number>; // day -> saved entry id, so Save updates/deletes instead of duplicating
}

/** A project picked once, with every "what" item logged against it living underneath. */
interface ProjectGroup {
  id: number;
  projectId: number | null;
  rows: GridRow[];
}

const TICKET_PREFIX = "ticket:";
const TYPE_PREFIX = "type:";
const isTicketValue = (v: string) => v.startsWith(TICKET_PREFIX);
const ticketKeyOf = (v: string) => v.slice(TICKET_PREFIX.length);
const typeCodeOf = (v: string) => (v.startsWith(TYPE_PREFIX) ? v.slice(TYPE_PREFIX.length) : "");

function makeEmptyRow(id: number, weekDates: string[]): GridRow {
  return {
    id,
    pickerValue: "",
    description: "",
    hours: Object.fromEntries(weekDates.map((d) => [d, ""])),
    comments: {},
    entryIds: {}
  };
}

function makeEmptyGroup(id: number, weekDates: string[], nextId: () => number): ProjectGroup {
  return { id, projectId: null, rows: [makeEmptyRow(nextId(), weekDates)] };
}

/** Never leaves the grid with zero groups - a fresh/all-cleared week keeps one empty group to type into. */
function pruneEmptyGroups(groups: ProjectGroup[], weekIsos: string[], nextId: () => number): ProjectGroup[] {
  const kept = groups.filter((g) => g.rows.length > 0);
  return kept.length > 0 ? kept : [makeEmptyGroup(nextId(), weekIsos, nextId)];
}

// Approval is a whole-week decision now (Timesheet.Status), not per-entry - once submitted
// (Pending), the whole grid is out of the employee's hands until the manager decides. Only
// Draft (not yet submitted) and Rejected (kicked back for a fix) weeks stay editable.
function isWeekLocked(status: TimesheetEntry["timesheetStatus"] | undefined): boolean {
  return status === "Pending" || status === "Approved";
}

/** Rebuilds project groups from every entry for the given week (any status), grouping same
 * ticket/type back into one row within its project's group - this is what makes previously-entered
 * hours show up again instead of the grid always looking blank, and keeps submitted/approved/rejected
 * rows visible instead of them disappearing once no longer Draft. Entries from before activity types
 * existed (no ActivityCode, just a TaskDescription) fall back to OTH so they still render sensibly. */
function buildProjectGroups(entries: TimesheetEntry[], weekIsos: string[], nextId: () => number): ProjectGroup[] {
  const relevant = entries.filter((e) => weekIsos.includes(e.workDate.slice(0, 10)));
  const groupRows = new Map<number, Map<string, GridRow>>(); // projectKey -> (itemKey -> row)
  const projectOrder: number[] = [];

  for (const e of relevant) {
    const projectKey = e.projectId ?? -1;
    if (!groupRows.has(projectKey)) {
      groupRows.set(projectKey, new Map());
      projectOrder.push(projectKey);
    }
    const rows = groupRows.get(projectKey)!;

    const isTicket = !!e.jiraIssueKey;
    const effectiveCode = e.activityCode || (!isTicket && e.taskDescription ? "OTH" : "");
    const itemKey = isTicket ? `${TICKET_PREFIX}${e.jiraIssueKey}` : `${TYPE_PREFIX}${effectiveCode}`;

    let row = rows.get(itemKey);
    if (!row) {
      row = {
        id: nextId(),
        pickerValue: itemKey,
        description: !isTicket && effectiveCode === "OTH" ? e.taskDescription || "" : "",
        hours: Object.fromEntries(weekIsos.map((d) => [d, ""])),
        comments: {},
        entryIds: {}
      };
      rows.set(itemKey, row);
    }
    const dayIso = e.workDate.slice(0, 10);
    row.hours[dayIso] = String(e.hoursSpent);
    if (e.comment) row.comments[dayIso] = e.comment;
    row.entryIds[dayIso] = e.id;
  }

  const groups: ProjectGroup[] = projectOrder.map((projectKey) => {
    const rowsMap = groupRows.get(projectKey)!;
    // Same ordering rationale as the old flat grid: sort by each row's earliest entry id, not by
    // whichever day happens to carry hours, so re-saving/reloading doesn't shuffle row order.
    const rows = [...rowsMap.values()].sort(
      (a, b) => Math.min(...Object.values(a.entryIds)) - Math.min(...Object.values(b.entryIds))
    );
    return { id: nextId(), projectId: projectKey === -1 ? null : projectKey, rows };
  });

  return groups.length > 0 ? groups : [makeEmptyGroup(nextId(), weekIsos, nextId)];
}

function weekIsosFor(start: Date): string[] {
  return Array.from({ length: 5 }, (_, i) => toIsoDate(addDays(start, i)));
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

// Activity type short forms every "what" item can be tagged as - shown in full in the legend
// popover next to the column header. JT was removed: picking a real ticket already says "this is
// ticket work," so a separate tag saying the same thing was redundant.
const ACTIVITY_CODES: { code: string; type: string; explanation: string }[] = [
  { code: "DSM", type: "Daily Standup Meetings", explanation: "Daily Scrum/Standup/Syncup Meeting" },
  { code: "SRM", type: "Sprint Review Meetings", explanation: "Sprint Kick off Meeting, Mid Sprint Review, Sprint Product Review, Sprint Retrospection" },
  { code: "CSM", type: "Customer meetings", explanation: "Customer/Client meetings" },
  { code: "ISM", type: "Products + Services", explanation: "Internal Stakeholder Meeting" },
  { code: "LDM", type: "Leadership", explanation: "Leadership Meeting" },
  { code: "AHM", type: "All Hands Meeting", explanation: "All Hands Meeting with entire Organization" },
  { code: "INTM", type: "Internal Meetings", explanation: "Other internal Team Meetings, syncups, checkins, reviews, 1-1, etc." },
  { code: "EXTM", type: "External Meetings", explanation: "With external persons/vendors/third-party" },
  { code: "OTH", type: "Other", explanation: "Other - describe it in the field that appears once picked" },
  { code: "PRA", type: "", explanation: "Pull Request review and approval" },
  { code: "PRC", type: "", explanation: "Conflict resolution" },
  { code: "ARB", type: "Architectural Review", explanation: "Technical Architecture / Implementation approach Reviews" },
  { code: "RPT", type: "Reports", explanation: "WSR/MSR/QSR - Weekly/Monthly/Quarterly Status Review" },
  { code: "DOC", type: "Documentation", explanation: "Process documentation/ any other documentation other than project doc" },
  { code: "REV", type: "Review", explanation: "Work review/ Validation/ Follow ups/ Coordination" },
  { code: "DLV", type: "Delivery", explanation: "Delivery to the Customer (Updates to the Customer / Customer Support Items)" },
  { code: "SLK", type: "Slack", explanation: "Reverting to team on slack messages - only for PM and above" },
  { code: "DES", type: "Design", explanation: "Designing on various work items" },
  { code: "KTS", type: "Keka Timesheets", explanation: "Keka Timesheets, Attendance, Leaves, WFH - review/approval" },
  { code: "SAM", type: "Sales & Marketing", explanation: "Tasks related to Sales and Marketing" }
];

const ACTIVITY_TYPE_OPTIONS: DropdownOption[] = ACTIVITY_CODES.map((a) => ({ value: `${TYPE_PREFIX}${a.code}`, label: a.code }));

// row.hours[d] keeps storing decimal hours (e.g. "2.25") - only the on-screen
// representation is H:MM, so rowTotal/handleSaveGrid/buildProjectGroups stay untouched.
function hoursToTimeLabel(value: string): string {
  const v = parseFloat(value);
  const total = !value || isNaN(v) || v <= 0 ? 0 : v;
  const h = Math.floor(total);
  const m = Math.round((total - h) * 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

// While a cell is being typed into, editingCell.text holds exactly what the user typed
// (digits plus at most one "."). The part before the dot is hours, taken directly - "8" is
// 8 hours, not 8 minutes. No dot means the whole thing is hours.
// The part after the dot depends on how many digits it has:
//  - one digit is read as tenths of an hour, matching standard decimal-hours math ("2.5" -> 30min)
//  - two digits are read as literal minutes ("8.12" -> 12min, not 7.2min)
function parseHoursInput(text: string): { hours: number; minutes: number } {
  const [hourPart, minutePart = ""] = text.split(".");
  const hours = parseInt(hourPart, 10) || 0;
  if (hours > 23) return { hours: 0, minutes: 0 }; // not a real time of day - discard rather than show e.g. "91:00"
  if (!minutePart) return { hours, minutes: 0 };
  const minutes = minutePart.length === 1 ? (parseInt(minutePart, 10) || 0) * 6 : Math.min(59, parseInt(minutePart.slice(0, 2), 10) || 0);
  return { hours, minutes };
}

function hoursInputToDecimalHours(text: string): number {
  const { hours, minutes } = parseHoursInput(text);
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
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((o) => o.value === value);
  const filtered = searchable && query.trim() ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase())) : options;

  const toggleOpen = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // Always opening downward runs the list off the bottom of the screen when the field sits
      // near the viewport edge - flip upward once there's genuinely more room that way, and cap
      // the list to whichever space is actually available instead of a fixed height either way.
      const openUpward = spaceBelow < 260 && spaceAbove > spaceBelow;
      const available = (openUpward ? spaceAbove : spaceBelow) - 16;
      setPos({
        top: openUpward ? undefined : rect.bottom + 4,
        bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.max(120, available)
      });
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
            className="fixed z-50 rounded-xl border border-ink-150 bg-white shadow-lg animate-fade-in min-w-max flex flex-col"
            style={{ top: pos.top, bottom: pos.bottom, left: pos.left, minWidth: pos.width, maxHeight: pos.maxHeight }}
          >
            {searchable && (
              <div className="p-1.5 border-b border-ink-100 shrink-0">
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
            <div className="overflow-y-auto scrollbar-none py-1 divide-y divide-ink-50">
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
              <div className="p-1.5 border-t border-ink-100 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    onChange(stickyOption.value);
                    setIsOpen(false);
                    setQuery("");
                  }}
                  className="w-full rounded-xl px-3 py-1.5 text-xs font-bold text-center text-white bg-brand shadow-md shadow-brand/15 hover:bg-brand/90 transition-colors whitespace-nowrap"
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
  // Can't log time for a week that hasn't happened yet - the forward arrow stops here.
  const isCurrentOrFutureWeek = weekStart.getTime() >= getMonday(new Date()).getTime();

  const [ticketsByProject, setTicketsByProject] = useState<Record<number, JiraTicket[]>>({});
  const [ticketsLoading, setTicketsLoading] = useState<Record<number, boolean>>({});

  const nextLocalId = useRef(1);
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});
  const pendingScrollRowId = useRef<number | null>(null);
  const [isSavingGrid, setIsSavingGrid] = useState(false);
  const [openCommentCell, setOpenCommentCell] = useState<{ groupId: number; rowId: number; day: string; top: number; left: number } | null>(null);
  // Raw text buffer for whichever hours cell is actively being typed into (see parseHoursInput) -
  // only exists once the user presses a key; row.hours (decimal) is committed on blur/wheel.
  const [editingCell, setEditingCell] = useState<{ groupId: number; rowId: number; day: string; text: string } | null>(null);

  // Row-removal confirm state (only asked when the row has saved entries behind it)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<{ groupId: number; rowId: number } | null>(null);

  // Submit Week state
  const [submitWeekConfirmOpen, setSubmitWeekConfirmOpen] = useState(false);
  const [isSubmittingWeek, setIsSubmittingWeek] = useState(false);

  // Activity-code legend popover, toggled from the "?" icon next to the column header - fixed
  // position (anchored to the icon's actual screen rect) instead of absolute, same reason as the
  // per-cell comment popup below: absolute would get clipped by the grid's overflow-x wrapper.
  const [legendPos, setLegendPos] = useState<{ top: number; left: number } | null>(null);
  const legendButtonRef = useRef<HTMLButtonElement>(null);

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
      setGroups(buildProjectGroups(mine, weekDateIsos, () => nextLocalId.current++));
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

  // The fetch must be fired from inside the updater itself, not gated on a flag read right after
  // calling setTicketsLoading - React doesn't guarantee that updater runs synchronously, so
  // checking a "did it decide to fetch" flag immediately after can read it before it's set,
  // silently skipping the actual fetchJiraTickets call while still marking the project "loading."
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

  // Only warm the ticket cache for projects actually in use on this week's grid - not every
  // Jira-linked project up front. Firing one request per project someone picks (realistically a
  // handful) instead of one per project that exists (which grew past the database's own
  // connection limit in production) means there's nothing left to throttle: a person can't select
  // more projects at once than they can click.
  const activeProjectIds = useMemo(
    () => [...new Set(groups.map((g) => g.projectId).filter((id): id is number => id != null))],
    [groups]
  );

  useEffect(() => {
    activeProjectIds.forEach((id) => ensureTicketsLoaded(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectIds]);

  // Activity types + this group's project's tickets (already filtered to just this person's
  // assigned tickets server-side), merged into one search list.
  const combinedOptionsFor = (projectId: number | null): DropdownOption[] => {
    const ticketOptions: DropdownOption[] = projectId != null
      ? (ticketsByProject[projectId] || []).map((t) => ({ value: `${TICKET_PREFIX}${t.key}`, label: `${t.key} · ${t.summary}` }))
      : [];
    return [...ACTIVITY_TYPE_OPTIONS, ...ticketOptions];
  };

  const anyTicketsLoading = useMemo(() => Object.values(ticketsLoading).some(Boolean), [ticketsLoading]);

  // The whole week shares one status (Timesheet.Status) - every entry for this week carries the
  // same timesheetStatus by construction, so any one of them tells you the week's state.
  const weekEntries = useMemo(
    () => myEntries.filter((e) => weekDateIsos.includes(e.workDate.slice(0, 10))),
    [myEntries, weekDateIsos]
  );
  const weekStatus: TimesheetEntry["timesheetStatus"] = weekEntries[0]?.timesheetStatus ?? "Draft";
  const weekLocked = isWeekLocked(weekStatus);

  const addRow = (groupId: number) => {
    const id = nextLocalId.current++;
    pendingScrollRowId.current = id;
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, rows: [...g.rows, makeEmptyRow(id, weekDateIsos)] } : g)));
  };

  const addGroup = () => {
    const groupId = nextLocalId.current++;
    const rowId = nextLocalId.current++;
    pendingScrollRowId.current = rowId;
    setGroups((prev) => [...prev, { id: groupId, projectId: null, rows: [makeEmptyRow(rowId, weekDateIsos)] }]);
  };

  // Scrolls the newly-added row into view - otherwise it's added below the fold of the
  // grid's internal scroll area and looks like the click did nothing.
  useEffect(() => {
    if (pendingScrollRowId.current == null) return;
    rowRefs.current[pendingScrollRowId.current]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    pendingScrollRowId.current = null;
  }, [groups]);

  // Removing a row backed by already-saved entries needs confirmation (and a server-side delete),
  // otherwise it'd silently reappear next time the grid rehydrates (e.g. on Save or week nav).
  // A row with nothing saved yet is just removed locally, no confirmation needed. A group left
  // with zero rows is pruned automatically, same as the old flat grid never showing zero rows.
  const removeRow = (groupId: number, rowId: number) => {
    const group = groups.find((g) => g.id === groupId);
    const row = group?.rows.find((r) => r.id === rowId);
    const idsToDelete = row ? Object.values(row.entryIds) : [];
    if (idsToDelete.length === 0) {
      setGroups((prev) =>
        pruneEmptyGroups(
          prev.map((g) => (g.id === groupId ? { ...g, rows: g.rows.filter((r) => r.id !== rowId) } : g)),
          weekDateIsos,
          () => nextLocalId.current++
        )
      );
      return;
    }
    setRowToDelete({ groupId, rowId });
    setDeleteConfirmOpen(true);
  };

  // The whole week is either editable or not - Pending/Approved weeks leave every saved entry
  // untouched even if the row itself is being removed.
  const handleConfirmRemoveRow = async () => {
    if (!rowToDelete) return;
    setDeleteConfirmOpen(false);
    const { groupId, rowId } = rowToDelete;
    const group = groups.find((g) => g.id === groupId);
    const row = group?.rows.find((r) => r.id === rowId);
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
      setGroups(buildProjectGroups(fresh, weekDateIsos, () => nextLocalId.current++));
    } catch (err: any) {
      showNotification("error", err.response?.data?.message || "Failed to remove entries.");
    } finally {
      setRowToDelete(null);
    }
  };

  const goToWeek = (newStart: Date) => {
    setWeekStart(newStart);
    setGroups(buildProjectGroups(myEntries, weekIsosFor(newStart), () => nextLocalId.current++));
  };

  const updateRow = (groupId: number, rowId: number, patch: Partial<GridRow>) =>
    setGroups((prev) => prev.map((g) => (g.id !== groupId ? g : { ...g, rows: g.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)) })));

  const updateHour = (groupId: number, rowId: number, dateIso: string, value: string) =>
    setGroups((prev) =>
      prev.map((g) =>
        g.id !== groupId
          ? g
          : { ...g, rows: g.rows.map((r) => (r.id !== rowId ? r : { ...r, hours: { ...r.hours, [dateIso]: value } })) }
      )
    );

  // Changing a group's project invalidates any ticket already picked in it (a ticket belongs to
  // one specific project) - type-only rows (DSM, OTH, ...) aren't project-specific, so they stay.
  const updateGroupProject = (groupId: number, projectId: number | null) =>
    setGroups((prev) =>
      prev.map((g) =>
        g.id !== groupId
          ? g
          : { ...g, projectId, rows: g.rows.map((r) => (isTicketValue(r.pickerValue) ? { ...r, pickerValue: "" } : r)) }
      )
    );

  const rowTotal = (row: GridRow) => weekDateIsos.reduce((sum, d) => sum + (parseFloat(row.hours[d]) || 0), 0);
  const groupTotal = (group: ProjectGroup) => group.rows.reduce((sum, r) => sum + rowTotal(r), 0);
  const dayTotal = (dateIso: string) =>
    groups.reduce((sum, g) => sum + g.rows.reduce((s, r) => s + (parseFloat(r.hours[dateIso]) || 0), 0), 0);
  const weekGrandTotal = weekDateIsos.reduce((sum, d) => sum + dayTotal(d), 0);

  const handleSaveGrid = async () => {
    if (weekLocked) {
      showNotification("error", "This week is pending your manager's review or already approved and can't be edited.");
      return;
    }

    // Cells already backed by a saved entry (row.entryIds) must be updated/deleted in place, not
    // recreated - otherwise every re-save would duplicate the hours already on the server.
    const touchedIds = new Set<number>();
    for (const group of groups) {
      for (const row of group.rows) {
        for (const d of weekDateIsos) {
          const id = row.entryIds[d];
          if (id) touchedIds.add(id);
        }
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

    for (const group of groups) {
      for (const row of group.rows) {
        const filledDays = weekDateIsos.filter((d) => {
          const v = parseFloat(row.hours[d]);
          return !isNaN(v) && v > 0;
        });
        const clearedDays = weekDateIsos.filter((d) => {
          const v = parseFloat(row.hours[d]);
          return (isNaN(v) || v <= 0) && !!row.entryIds[d];
        });
        if (filledDays.length === 0 && clearedDays.length === 0) continue;

        if (filledDays.length > 0) {
          if (!row.pickerValue) {
            showNotification("error", "Pick a ticket or an activity type for every row with hours entered.");
            return;
          }
          if (group.projectId == null) {
            showNotification("error", "Pick a project for every group before saving.");
            return;
          }
        }

        const isTicket = isTicketValue(row.pickerValue);
        const ticketKey = isTicket ? ticketKeyOf(row.pickerValue) : undefined;
        const activityCode = !isTicket && row.pickerValue ? typeCodeOf(row.pickerValue) : undefined;
        const ticketSummary =
          isTicket && group.projectId != null ? ticketsByProject[group.projectId]?.find((t) => t.key === ticketKey)?.summary : undefined;

        if (filledDays.length > 0 && activityCode === "OTH" && !row.description.trim()) {
          showNotification("error", "Describe what \"Other\" means for that row.");
          return;
        }

        for (const d of filledDays) {
          const hrs = parseFloat(row.hours[d]);
          dayTotals[d] = (dayTotals[d] || 0) + hrs;
          const values: TimesheetEntryFormValues = {
            projectId: group.projectId,
            jiraIssueKey: ticketKey,
            jiraIssueSummary: ticketSummary,
            taskDescription: activityCode === "OTH" ? row.description.trim() : undefined,
            activityCode,
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
    }

    if (toCreate.length === 0 && toUpdate.length === 0 && toDelete.length === 0) {
      showNotification("error", "Enter hours for at least one item before saving.");
      return;
    }

    const overDay = weekDateIsos.find((d) => dayTotals[d] > MAX_DAILY_HOURS);
    if (overDay) {
      showNotification("error", `${formatDate(overDay)} would total ${formatHoursLabel(dayTotals[overDay])} — over the ${MAX_DAILY_HOURS}-hour daily limit.`);
      return;
    }

    setIsSavingGrid(true);
    try {
      // A full week across several groups can mean dozens of entries saving at once - firing
      // them all in one Promise.all can outrun the database's own connection limit (the same
      // "max clients reached" crash seen on the ticket-fetch path). Batching keeps peak
      // concurrent requests low regardless of how many entries are being saved.
      await runInBatches(toCreate, SAVE_CONCURRENCY_LIMIT, (v) => createTimesheetEntry(v));
      await runInBatches(toUpdate, SAVE_CONCURRENCY_LIMIT, (u) => updateTimesheetEntry(u.id, u.values));
      await runInBatches(toDelete, SAVE_CONCURRENCY_LIMIT, (id) => deleteTimesheetEntry(id));
      const changeCount = toCreate.length + toUpdate.length + toDelete.length;
      showNotification("success", `Saved ${changeCount} ${changeCount === 1 ? "change" : "changes"}.`);
      const fresh = await refreshEntries();
      setGroups(buildProjectGroups(fresh, weekDateIsos, () => nextLocalId.current++));
      refreshNotifications();
    } catch (err: any) {
      // Deliberately don't refresh-and-rebuild here like the success path does - a failed save
      // never reached the server, so rebuilding "from the server" would rebuild from data that
      // never includes what was just typed, wiping it out for no reason. Leave the grid exactly
      // as the user left it so they can fix whatever's wrong (or just retry) without re-typing.
      showNotification("error", err.response?.data?.message || "Failed to save some entries. Please check and try again.");
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
      setGroups(buildProjectGroups(fresh, weekDateIsos, () => nextLocalId.current++));
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

  const projectOptions: DropdownOption[] = projects.map((p) => ({ value: String(p.id), label: p.name }));
  const projectName = (id: number | null) => (id == null ? null : projects.find((p) => p.id === id)?.name);

  return (
    <div className="h-full flex flex-col bg-ink-50/20 p-8 overflow-y-auto scrollbar-none">
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
          <p className="text-xs text-ink-500 mt-1">Pick a project once, then log every ticket or activity type under it for the week.</p>
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
                disabled={isCurrentOrFutureWeek}
                title={isCurrentOrFutureWeek ? "Can't log time for a future week" : undefined}
                className="p-1.5 rounded-lg border border-ink-200 bg-white text-ink-500 hover:bg-ink-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
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

          {/* Weekly entry grid - grouped by project, one picker per group, "what" items underneath */}
          <div className="shrink-0">
            <div className="rounded-2xl border border-ink-150 bg-white shadow-sm overflow-x-auto scrollbar-none">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-ink-150 bg-ink-50 text-[10px] font-bold uppercase tracking-wider text-ink-500">
                    <th className="py-3 px-4 w-72">
                      <div className="flex items-center gap-1.5">
                        <span>What</span>
                        <button
                          ref={legendButtonRef}
                          type="button"
                          onClick={() => {
                            if (legendPos) {
                              setLegendPos(null);
                              return;
                            }
                            const rect = legendButtonRef.current!.getBoundingClientRect();
                            setLegendPos({ top: rect.bottom + 6, left: rect.left });
                          }}
                          title="What do the activity type codes mean?"
                          className="h-4 w-4 rounded-full border border-ink-300 text-ink-400 hover:text-brand hover:border-brand flex items-center justify-center text-[9px] font-black normal-case shrink-0"
                        >
                          ?
                        </button>
                      </div>
                    </th>
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

                {groups.map((group) => (
                  <tbody key={group.id} className="border-t-2 border-ink-100">
                    <tr className="bg-brand/5">
                      <td colSpan={displayDays.length + 3} className="py-2.5 px-4">
                        <div className="flex items-center gap-3">
                          <span className="text-[9px] font-bold uppercase tracking-wide text-ink-400 shrink-0">Project</span>
                          <div className="w-60">
                            <Dropdown
                              value={group.projectId ? String(group.projectId) : ""}
                              onChange={(v) => updateGroupProject(group.id, v ? Number(v) : null)}
                              options={projectOptions}
                              placeholder="Select a project…"
                              disabled={weekLocked}
                              searchable
                            />
                          </div>
                        </div>
                      </td>
                    </tr>

                    {group.rows.map((row) => (
                      <tr key={row.id} ref={(el) => { rowRefs.current[row.id] = el; }} className="scroll-mb-14">
                        <td className="py-3 pl-8 pr-4 align-top">
                          <div className="flex flex-col gap-1.5">
                            <Dropdown
                              value={row.pickerValue}
                              onChange={(v) => updateRow(group.id, row.id, { pickerValue: v })}
                              options={combinedOptionsFor(group.projectId)}
                              placeholder={anyTicketsLoading ? "Loading tickets..." : "Search a type or a ticket..."}
                              searchable
                              disabled={weekLocked}
                            />
                            {typeCodeOf(row.pickerValue) === "OTH" && (
                              <input
                                type="text"
                                placeholder="Describe what you worked on"
                                value={row.description}
                                disabled={weekLocked}
                                onChange={(e) => updateRow(group.id, row.id, { description: e.target.value })}
                                className="rounded-lg border border-ink-200 px-2 py-1.5 text-[11px] text-ink-800 placeholder-ink-400 focus:border-brand focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                              />
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
                          const isPopupOpen = openCommentCell?.groupId === group.id && openCommentCell?.rowId === row.id && openCommentCell?.day === d;
                          const isEditingCell = editingCell?.groupId === group.id && editingCell?.rowId === row.id && editingCell?.day === d;
                          // While editing, show exactly what was typed (e.g. "2.3") rather than
                          // live-converting it - the H:MM conversion only appears once committed on blur.
                          const cellDisplayValue = isEditingCell ? editingCell!.text : hoursToTimeLabel(row.hours[d]);
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
                                    const raw = e.target.value.replace(/[^0-9.]/g, "");
                                    const firstDot = raw.indexOf(".");
                                    const text = firstDot === -1 ? raw : raw.slice(0, firstDot + 1) + raw.slice(firstDot + 1).replace(/\./g, "");
                                    setEditingCell({ groupId: group.id, rowId: row.id, day: d, text: text.slice(0, 6) });
                                  }}
                                  onKeyDown={(e) => {
                                    const current = isEditingCell ? editingCell!.text : "";
                                    if (/^[0-9]$/.test(e.key)) {
                                      e.preventDefault();
                                      setEditingCell({ groupId: group.id, rowId: row.id, day: d, text: (current + e.key).slice(0, 6) });
                                    } else if (e.key === "." && !current.includes(".")) {
                                      e.preventDefault();
                                      setEditingCell({ groupId: group.id, rowId: row.id, day: d, text: current + "." });
                                    } else if (e.key === "Backspace") {
                                      e.preventDefault();
                                      // Not already editing (e.g. cell shows a committed "2:18") - seed the
                                      // buffer from the stored decimal so backspace deletes into a real value
                                      // instead of being a no-op until the user types a digit first.
                                      const base = isEditingCell ? editingCell!.text : (parseFloat(row.hours[d]) > 0 ? String(parseFloat(row.hours[d])) : "");
                                      setEditingCell({ groupId: group.id, rowId: row.id, day: d, text: base.slice(0, -1) });
                                    } else if (e.key === "Enter") {
                                      e.preventDefault();
                                      e.currentTarget.blur();
                                    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                                      e.preventDefault(); // digits and a single "." only
                                    }
                                  }}
                                  onFocus={(e) => {
                                    const rect = e.target.getBoundingClientRect();
                                    setOpenCommentCell({ groupId: group.id, rowId: row.id, day: d, top: rect.bottom + 4, left: rect.left });
                                  }}
                                  onBlur={() => {
                                    if (isEditingCell) {
                                      const decimal = hoursInputToDecimalHours(editingCell!.text);
                                      updateHour(group.id, row.id, d, decimal > 0 ? String(decimal) : "");
                                      setEditingCell(null);
                                    }
                                  }}
                                  onWheel={(e) => {
                                    if (document.activeElement !== e.currentTarget) return; // don't hijack page scroll when not focused
                                    e.preventDefault();
                                    const current = parseFloat(row.hours[d]) || 0;
                                    const delta = e.deltaY < 0 ? HOUR_STEP : -HOUR_STEP;
                                    const next = Math.max(0, Math.round((current + delta) * 4) / 4);
                                    updateHour(group.id, row.id, d, next > 0 ? String(next) : "");
                                    setEditingCell(null);
                                  }}
                                  className={`w-14 rounded-lg border px-1.5 py-1.5 text-[11px] text-center text-ink-800 focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed disabled:bg-ink-50 ${
                                    isPopupOpen ? "border-brand" : "border-ink-200 focus:border-brand"
                                  }`}
                                />
                                {hasComment && (
                                  <svg
                                    className="absolute -top-1.5 -right-1.5 h-4 w-4 text-ink-800 drop-shadow-sm"
                                    fill="white"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2.5}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                    />
                                  </svg>
                                )}
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
                            onClick={() => removeRow(group.id, row.id)}
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

                    <tr>
                      <td colSpan={displayDays.length + 3} className="py-2 pl-8 pr-4">
                        <button
                          type="button"
                          onClick={() => addRow(group.id)}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-brand hover:underline"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add another item
                        </button>
                      </td>
                    </tr>

                    <tr className="bg-ink-50/60 border-t border-ink-100">
                      <td className="py-2 pl-8 pr-4 text-[11px] font-semibold text-ink-500 italic">
                        Subtotal — {projectName(group.projectId) ?? "no project yet"}
                      </td>
                      <td colSpan={displayDays.length}></td>
                      <td className="py-2 px-3 text-center text-xs font-bold text-ink-800">{formatHoursLabel(groupTotal(group))}</td>
                      <td></td>
                    </tr>
                  </tbody>
                ))}

                <tfoot className="bg-white">
                  <tr className="border-t border-ink-150 bg-ink-50/50">
                    <td className="py-2.5 px-4">
                      <button
                        type="button"
                        onClick={addGroup}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-brand hover:underline"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add project
                      </button>
                    </td>
                    <td colSpan={displayDays.length}></td>
                    <td colSpan={2}></td>
                  </tr>
                  <tr className="border-t border-ink-150 bg-brand/5">
                    <td className="py-2.5 px-4 text-xs font-black text-ink-900">Day total</td>
                    {displayDays.map((dDate) => {
                      const iso = toIsoDate(dDate);
                      const isWeekday = weekDateIsos.includes(iso);
                      return (
                        <td key={iso} className="py-2.5 px-3 text-center text-xs font-black text-ink-900">
                          {isWeekday ? formatHoursLabel(dayTotal(iso)) : <span className="text-ink-300 font-normal">—</span>}
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-3 text-center text-xs font-black text-ink-900">{formatHoursLabel(weekGrandTotal)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex items-center justify-end gap-3 mt-3 mb-6">
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

      {/* Activity-code legend popup - fixed position anchored to the "?" icon's screen rect,
          rendered at the top level for the same reason as the comment popup below. */}
      {legendPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setLegendPos(null)} />
          <div
            className="fixed z-50 w-72 max-h-96 overflow-auto scrollbar-none rounded-xl border border-ink-150 bg-white shadow-lg p-3 animate-fade-in"
            style={{ top: legendPos.top, left: legendPos.left }}
          >
            <p className="text-[10px] font-bold text-ink-800 mb-2 uppercase tracking-wide">Activity type codes</p>
            <div className="divide-y divide-ink-100">
              {ACTIVITY_CODES.map((a) => (
                <div key={a.code} className="py-1.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono font-bold text-brand text-[10px]">{a.code}</span>
                    {a.type && <span className="text-[10px] font-bold text-ink-700">{a.type}</span>}
                  </div>
                  <p className="text-[10px] font-normal text-ink-500 mt-0.5">{a.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Per-cell comment popup - rendered at the top level (fixed position) so it's never
          clipped by the grid's scrollable overflow-x wrapper. */}
      {openCommentCell &&
        (() => {
          const activeGroup = groups.find((g) => g.id === openCommentCell.groupId);
          const activeRow = activeGroup?.rows.find((r) => r.id === openCommentCell.rowId);
          if (!activeGroup || !activeRow) return null;
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
                    updateRow(activeGroup.id, openCommentCell.rowId, {
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
                              <span className="text-ink-700 truncate">{entry.activityCode || entry.taskDescription}</span>
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
