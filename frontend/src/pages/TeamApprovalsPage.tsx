import { useEffect, useMemo, useState } from "react";
import { fetchTimesheetEntries, reviewTimesheetEntry } from "../api/timesheetApi";
import type { TimesheetEntry } from "../api/timesheetApi";
import { formatHoursLabel } from "../utils/time";

interface TeamWeekGroup {
  key: string;
  employeeId: number;
  employeeName: string;
  weekStartIso: string;
  weekEndIso: string;
  entries: TimesheetEntry[];
  totalHours: number;
  pendingCount: number;
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

function getInitials(name: string): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const statusBadge = (status: TimesheetEntry["status"]) => {
  const styles: Record<string, string> = {
    Draft: "bg-ink-100 text-ink-600 border-ink-200",
    Pending: "bg-amber-50 text-amber-700 border-amber-150",
    Approved: "bg-emerald-50 text-emerald-700 border-emerald-150",
    Rejected: "bg-rose-50 text-rose-700 border-rose-150"
  };
  const dots: Record<string, string> = {
    Draft: "bg-ink-400",
    Pending: "bg-amber-500",
    Approved: "bg-emerald-500",
    Rejected: "bg-rose-500"
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold border ${styles[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dots[status]}`} />
      {status}
    </span>
  );
};

export default function TeamApprovalsPage() {
  const [teamEntries, setTeamEntries] = useState<TimesheetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [reviewingEntry, setReviewingEntry] = useState<TimesheetEntry | null>(null);
  const [reviewAction, setReviewAction] = useState<"Approved" | "Rejected">("Approved");
  const [reviewComment, setReviewComment] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);

  const [bulkReviewGroup, setBulkReviewGroup] = useState<TeamWeekGroup | null>(null);
  const [bulkReviewAction, setBulkReviewAction] = useState<"Approved" | "Rejected">("Approved");
  const [bulkReviewComment, setBulkReviewComment] = useState("");
  const [isBulkReviewing, setIsBulkReviewing] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const team = await fetchTimesheetEntries("team");
      setTeamEntries(team);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Failed to load team timesheet data.");
    } finally {
      setLoading(false);
    }
  };

  const refreshEntries = async () => {
    try {
      const team = await fetchTimesheetEntries("team");
      setTeamEntries(team);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Failed to refresh team timesheet data.");
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

  const teamGroups = useMemo<TeamWeekGroup[]>(() => {
    const map = new Map<string, TeamWeekGroup>();
    for (const e of teamEntries) {
      const workDate = new Date(e.workDate.slice(0, 10) + "T00:00:00");
      const groupWeekStart = getMonday(workDate);
      const groupWeekStartIso = toIsoDate(groupWeekStart);
      const key = `${e.employeeId}_${groupWeekStartIso}`;
      let group = map.get(key);
      if (!group) {
        group = {
          key,
          employeeId: e.employeeId,
          employeeName: e.employeeName || "Unknown",
          weekStartIso: groupWeekStartIso,
          weekEndIso: toIsoDate(addDays(groupWeekStart, 4)),
          entries: [],
          totalHours: 0,
          pendingCount: 0
        };
        map.set(key, group);
      }
      group.entries.push(e);
      group.totalHours += e.hoursSpent;
      if (e.status === "Pending") group.pendingCount++;
    }
    return Array.from(map.values()).sort(
      (a, b) => b.weekStartIso.localeCompare(a.weekStartIso) || a.employeeName.localeCompare(b.employeeName)
    );
  }, [teamEntries]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openReview = (entry: TimesheetEntry, action: "Approved" | "Rejected") => {
    setReviewingEntry(entry);
    setReviewAction(action);
    setReviewComment("");
  };

  const submitReview = async () => {
    if (!reviewingEntry) return;
    setIsReviewing(true);
    try {
      await reviewTimesheetEntry(reviewingEntry.id, { status: reviewAction, reviewerComment: reviewComment.trim() || undefined });
      showNotification("success", `Entry ${reviewAction.toLowerCase()}.`);
      setReviewingEntry(null);
      await refreshEntries();
    } catch (err: any) {
      showNotification("error", err.response?.data?.message || "Failed to submit review.");
    } finally {
      setIsReviewing(false);
    }
  };

  const openBulkReview = (group: TeamWeekGroup, action: "Approved" | "Rejected") => {
    setBulkReviewGroup(group);
    setBulkReviewAction(action);
    setBulkReviewComment("");
  };

  const submitBulkReview = async () => {
    if (!bulkReviewGroup) return;
    const pending = bulkReviewGroup.entries.filter((e) => e.status === "Pending");
    setIsBulkReviewing(true);
    try {
      await Promise.all(
        pending.map((e) => reviewTimesheetEntry(e.id, { status: bulkReviewAction, reviewerComment: bulkReviewComment.trim() || undefined }))
      );
      showNotification("success", `${pending.length} ${pending.length === 1 ? "entry" : "entries"} ${bulkReviewAction.toLowerCase()}.`);
      setBulkReviewGroup(null);
      await refreshEntries();
    } catch (err: any) {
      showNotification("error", err.response?.data?.message || "Failed to submit bulk review.");
    } finally {
      setIsBulkReviewing(false);
    }
  };

  const formatShortDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

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
          <h1 className="font-display text-2xl font-black text-ink-900 leading-tight">Team Approvals</h1>
          <p className="text-xs text-ink-500 mt-1">Review and approve or reject your direct reports' submitted timesheets.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-ink-200 border-t-brand" />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto scrollbar-none flex flex-col gap-3">
          {teamGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-white p-12 text-center h-full">
              <svg className="h-12 w-12 text-ink-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-semibold text-ink-800">Nothing here yet</p>
              <p className="text-xs text-ink-500 mt-1 max-w-sm">No timesheet entries from your direct reports yet.</p>
            </div>
          ) : (
            teamGroups.map((group) => {
              const isExpanded = expandedGroups.has(group.key);
              return (
                <div key={group.key} className="shrink-0 rounded-2xl border border-ink-150 bg-white shadow-sm overflow-hidden">
                  <button
                    onClick={() => toggleGroup(group.key)}
                    className="w-full flex items-center justify-between p-4 hover:bg-ink-50/50 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white bg-indigo-500 shrink-0">
                        {getInitials(group.employeeName)}
                      </div>
                      <div>
                        <p className="text-xs font-black text-ink-900">{group.employeeName}</p>
                        <p className="text-[10px] text-ink-500">
                          {formatShortDate(group.weekStartIso)} – {formatShortDate(group.weekEndIso)} · {group.entries.length}{" "}
                          {group.entries.length === 1 ? "entry" : "entries"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-ink-800">{formatHoursLabel(group.totalHours)}</span>
                      {group.pendingCount > 0 ? (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-150 rounded-full px-2 py-1">
                          {group.pendingCount} pending
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-150 rounded-full px-2 py-1">
                          Reviewed
                        </span>
                      )}
                      <svg
                        className={`h-4 w-4 text-ink-400 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-ink-150">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-ink-150 bg-ink-50 text-[10px] font-bold uppercase tracking-wider text-ink-500">
                            <th className="py-2 px-4">Project</th>
                            <th className="py-2 px-4">Work</th>
                            <th className="py-2 px-4">Date</th>
                            <th className="py-2 px-4">Hours</th>
                            <th className="py-2 px-4">Status</th>
                            <th className="py-2 px-4 text-right">Review</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-ink-100 text-xs text-ink-700">
                          {group.entries.map((entry) => (
                            <tr key={entry.id} className="hover:bg-ink-50/30 transition-all duration-150">
                              <td className="py-2 px-4">{entry.projectName || <span className="text-ink-400 italic">—</span>}</td>
                              <td className="py-2 px-4">
                                {entry.jiraIssueKey ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50/50 border border-sky-100/70 text-sky-800 font-mono text-[10px] px-2 py-1">
                                    {entry.jiraIssueKey}
                                  </span>
                                ) : (
                                  <span className="text-ink-700">{entry.taskDescription}</span>
                                )}
                                {entry.comment && <span className="text-[10px] text-ink-400 italic ml-2">"{entry.comment}"</span>}
                              </td>
                              <td className="py-2 px-4 text-ink-500">{formatShortDate(entry.workDate)}</td>
                              <td className="py-2 px-4 font-semibold text-ink-800">{formatHoursLabel(entry.hoursSpent)}</td>
                              <td className="py-2 px-4">{statusBadge(entry.status)}</td>
                              <td className="py-2 px-4 text-right">
                                {entry.status === "Pending" ? (
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      onClick={() => openReview(entry, "Approved")}
                                      className="py-1 px-2.5 rounded-lg bg-emerald-50 border border-emerald-150 text-emerald-700 text-[10px] font-bold hover:bg-emerald-100 transition-all"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => openReview(entry, "Rejected")}
                                      className="py-1 px-2.5 rounded-lg bg-rose-50 border border-rose-150 text-rose-700 text-[10px] font-bold hover:bg-rose-100 transition-all"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-ink-300 text-[10px] italic">
                                    {entry.reviewerComment ? `"${entry.reviewerComment}"` : "—"}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {group.pendingCount > 0 && (
                        <div className="flex justify-end gap-2 p-3 border-t border-ink-100 bg-ink-50/30">
                          <button
                            onClick={() => openBulkReview(group, "Approved")}
                            className="py-1.5 px-3 rounded-lg bg-emerald-50 border border-emerald-150 text-emerald-700 text-[10px] font-bold hover:bg-emerald-100 transition-all"
                          >
                            Approve All ({group.pendingCount})
                          </button>
                          <button
                            onClick={() => openBulkReview(group, "Rejected")}
                            className="py-1.5 px-3 rounded-lg bg-rose-50 border border-rose-150 text-rose-700 text-[10px] font-bold hover:bg-rose-100 transition-all"
                          >
                            Reject All ({group.pendingCount})
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Approve/Reject review modal */}
      {reviewingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-ink-150 bg-white p-6 shadow-xl animate-slide-up">
            <h2 className="text-sm font-black text-ink-900 mb-1">
              {reviewAction === "Approved" ? "Approve" : "Reject"} Entry
            </h2>
            <p className="text-xs text-ink-500 mb-4">
              {reviewingEntry.employeeName} — {formatHoursLabel(reviewingEntry.hoursSpent)} on{" "}
              {reviewingEntry.jiraIssueKey || reviewingEntry.taskDescription}
            </p>
            <textarea
              rows={2}
              placeholder="Optional comment for the employee..."
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              className="w-full rounded-xl border border-ink-200 px-3.5 py-2 text-xs text-ink-800 placeholder-ink-400 focus:border-brand focus:outline-none resize-none mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setReviewingEntry(null)}
                className="py-2 px-4 rounded-xl border border-ink-200 bg-white text-xs font-semibold text-ink-700 hover:bg-ink-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={submitReview}
                disabled={isReviewing}
                className={`py-2 px-4 rounded-xl text-xs font-semibold text-white transition-all shadow-md disabled:opacity-50 ${
                  reviewAction === "Approved" ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/10" : "bg-rose-600 hover:bg-rose-700 shadow-rose-600/10"
                }`}
              >
                {isReviewing ? "Submitting..." : reviewAction === "Approved" ? "Approve" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Approve/Reject review modal (whole employee+week group) */}
      {bulkReviewGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-ink-150 bg-white p-6 shadow-xl animate-slide-up">
            <h2 className="text-sm font-black text-ink-900 mb-1">
              {bulkReviewAction === "Approved" ? "Approve" : "Reject"} All Entries
            </h2>
            <p className="text-xs text-ink-500 mb-4">
              {bulkReviewGroup.employeeName} — {bulkReviewGroup.pendingCount} pending{" "}
              {bulkReviewGroup.pendingCount === 1 ? "entry" : "entries"} for {formatShortDate(bulkReviewGroup.weekStartIso)} –{" "}
              {formatShortDate(bulkReviewGroup.weekEndIso)}
            </p>
            <textarea
              rows={2}
              placeholder="Optional comment for the employee..."
              value={bulkReviewComment}
              onChange={(e) => setBulkReviewComment(e.target.value)}
              className="w-full rounded-xl border border-ink-200 px-3.5 py-2 text-xs text-ink-800 placeholder-ink-400 focus:border-brand focus:outline-none resize-none mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setBulkReviewGroup(null)}
                className="py-2 px-4 rounded-xl border border-ink-200 bg-white text-xs font-semibold text-ink-700 hover:bg-ink-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={submitBulkReview}
                disabled={isBulkReviewing}
                className={`py-2 px-4 rounded-xl text-xs font-semibold text-white transition-all shadow-md disabled:opacity-50 ${
                  bulkReviewAction === "Approved" ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/10" : "bg-rose-600 hover:bg-rose-700 shadow-rose-600/10"
                }`}
              >
                {isBulkReviewing
                  ? "Submitting..."
                  : `${bulkReviewAction === "Approved" ? "Approve" : "Reject"} ${bulkReviewGroup.pendingCount}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
