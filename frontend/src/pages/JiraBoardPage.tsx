import { useEffect, useState } from "react";
import { fetchJiraDashboard, updateJiraIssue } from "../api/jiraApi";
import { fetchEmployees } from "../api/employeeApi";
import type { JiraIssue, JiraProject, JiraSprint, Employee } from "../api/types";

export default function JiraBoardPage() {
  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [sprints, setSprints] = useState<JiraSprint[]>([]);
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Selection states (initially null for a dynamic cascade opening)
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedSprintId, setSelectedSprintId] = useState<number | "backlog" | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);

  // Search/Filter state
  const [searchTerm, setSearchTerm] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State for active ticket edit
  const [editSummary, setEditSummary] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editAssignee, setEditAssignee] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editExpectedTime, setEditExpectedTime] = useState("");
  const [editActualTime, setEditActualTime] = useState("");
  const [editProjectId, setEditProjectId] = useState<number>(0);
  const [editSprintId, setEditSprintId] = useState<number | null>(null);
  const [updating, setUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = async (keepSelection = false) => {
    try {
      if (!keepSelection) setLoading(true);
      setError(null);
      const dashboard = await fetchJiraDashboard();
      setProjects(dashboard.projects);
      setSprints(dashboard.sprints);
      setIssues(dashboard.issues);

      // Fetch employee directory for assignee dropdown
      const empList = await fetchEmployees();
      setEmployees(empList);

      // No auto-selection on first load to allow dynamic visual opening
      if (!keepSelection) {
        setSelectedProjectId(null);
        setSelectedSprintId(null);
        setSelectedIssueId(null);
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to load Jira data. Make sure you have imported tickets from the Admin settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Project Selection Handlers
  const handleSelectProject = (projId: number) => {
    setSelectedProjectId(projId);
    setSelectedSprintId(null);
    setSelectedIssueId(null);
    setSearchTerm("");
  };

  const handleDoubleClickProject = () => {
    setSelectedProjectId(null);
    setSelectedSprintId(null);
    setSelectedIssueId(null);
  };

  // Sprint Selection Handlers
  const handleSelectSprint = (sprintId: number | "backlog") => {
    setSelectedSprintId(sprintId);
    setSelectedIssueId(null);
  };

  const handleDoubleClickSprint = () => {
    setSelectedSprintId(null);
    setSelectedIssueId(null);
  };

  // Issue Double Click Handler
  const handleDoubleClickIssue = () => {
    setSelectedIssueId(null);
  };

  // Active Issue
  const activeIssue = issues.find(i => i.id === selectedIssueId) || null;

  // Sync edit form state with active issue
  useEffect(() => {
    if (activeIssue) {
      setEditSummary(activeIssue.summary);
      setEditStatus(activeIssue.status);
      setEditAssignee(activeIssue.assignee);
      setEditPriority(activeIssue.priority);
      setEditDescription(activeIssue.description || "");
      setEditExpectedTime(activeIssue.expectedTime || "");
      setEditActualTime(activeIssue.actualTime || "");
      setEditProjectId(activeIssue.projectId);
      setEditSprintId(activeIssue.sprintId ?? null);
      setSuccessMsg(null);
    } else {
      setEditSummary("");
      setEditStatus("");
      setEditAssignee("");
      setEditPriority("");
      setEditDescription("");
      setEditExpectedTime("");
      setEditActualTime("");
      setEditProjectId(0);
      setEditSprintId(null);
      setSuccessMsg(null);
    }
  }, [selectedIssueId, issues]);

  const handleUpdateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIssue) return;

    try {
      setUpdating(true);
      setSuccessMsg(null);
      await updateJiraIssue(activeIssue.id, {
        summary: editSummary,
        status: editStatus,
        assignee: editAssignee,
        priority: editPriority,
        description: editDescription,
        expectedTime: editExpectedTime,
        actualTime: editActualTime,
        projectId: editProjectId,
        sprintId: editSprintId,
      });
      setSuccessMsg("Changes saved successfully!");
      await loadData(true);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.response?.data || "Failed to update Jira ticket.");
    } finally {
      setUpdating(false);
    }
  };

  const handleResetForm = () => {
    if (activeIssue) {
      setEditSummary(activeIssue.summary);
      setEditStatus(activeIssue.status);
      setEditAssignee(activeIssue.assignee);
      setEditPriority(activeIssue.priority);
      setEditDescription(activeIssue.description || "");
      setEditExpectedTime(activeIssue.expectedTime || "");
      setEditActualTime(activeIssue.actualTime || "");
      setEditProjectId(activeIssue.projectId);
      setEditSprintId(activeIssue.sprintId ?? null);
      setSuccessMsg(null);
    }
  };

  // Helper count methods
  const getIssuesForProject = (projId: number) => {
    return issues.filter(i => i.projectId === projId).length;
  };

  const getIssuesForSprint = (projId: number, sprintId: number | "backlog") => {
    return issues.filter(issue => {
      const matchesProj = issue.projectId === projId;
      const matchesSprint = sprintId === "backlog" ? !issue.sprintId : issue.sprintId === sprintId;
      return matchesProj && matchesSprint;
    }).length;
  };

  // Sprints associated with selected project
  const projectSprints = sprints.filter(sprint => {
    if (selectedProjectId === null) return false;
    // Show sprint if it has issues in the current project
    return issues.some(i => i.projectId === selectedProjectId && i.sprintId === sprint.id);
  });

  // Tickets filtered by active selection & search term
  const filteredIssuesList = issues.filter(issue => {
    if (selectedProjectId === null || selectedSprintId === null) return false;
    const matchesProj = issue.projectId === selectedProjectId;
    const matchesSprint = selectedSprintId === "backlog" ? !issue.sprintId : issue.sprintId === selectedSprintId;
    
    const matchesSearch =
      issue.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (issue.description && issue.description.toLowerCase().includes(searchTerm.toLowerCase()));
      
    return matchesProj && matchesSprint && matchesSearch;
  });

  const getPriorityColor = (prio: string) => {
    switch (prio.toLowerCase()) {
      case "highest":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "high":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "medium":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "low":
        return "bg-blue-50 text-blue-700 border-blue-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "done":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "in progress":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-ink-100 text-ink-600 border-ink-200";
    }
  };

  return (
    <div className="flex h-full flex-col bg-ink-50">
      {/* Dynamic Slide Micro-animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {error && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="mx-auto max-w-md rounded-xl border border-rose-100 bg-rose-50/30 p-6 text-center shadow-sm">
            <p className="text-sm text-rose-600 font-medium">{error}</p>
            <p className="mt-2 text-xs text-ink-400">
              Please go to the Admin screen, configure settings under the "Fetch from Jira" tab, and perform an import.
            </p>
          </div>
        </div>
      )}

      {!error && (
        <div className="flex h-full min-h-0 overflow-x-auto divide-x divide-ink-200 bg-white">
          {/* COLUMN 1: Projects (Always visible) */}
          <div className="w-64 shrink-0 flex flex-col min-h-0 bg-ink-50/30">
            <div className="p-4 border-b border-ink-150 bg-white/50 backdrop-blur-sm flex items-center justify-between">
              <div>
                <h2 className="font-display font-extrabold text-xs text-ink-900 uppercase tracking-wider">Projects</h2>
                <p className="text-[10px] text-ink-400">Select project board</p>
              </div>
              <button
                onClick={() => loadData(false)}
                className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-600 transition-colors"
                title="Refresh board data"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3 3L22 4" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 chart-canvas">
              {loading && <div className="p-4 text-xs text-ink-400 text-center animate-pulse">Loading Projects...</div>}
              {!loading && projects.map((p) => {
                const isActive = selectedProjectId === p.id;
                const ticketCount = getIssuesForProject(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectProject(p.id)}
                    onDoubleClick={handleDoubleClickProject}
                    className={`w-full text-left rounded-xl p-3.5 transition-all flex items-center justify-between border ${
                      isActive
                        ? "bg-brand border-brand text-white shadow-md shadow-brand/15 font-bold animate-fade-in"
                        : "border-transparent text-ink-700 hover:bg-ink-100 hover:text-ink-900"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs truncate font-semibold leading-tight">{p.name}</p>
                      <p className={`text-[10px] font-mono mt-0.5 leading-none ${isActive ? "text-brand-light font-medium" : "text-ink-400"}`}>{p.key}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      isActive ? "bg-white/20 text-white" : "bg-ink-200/60 text-ink-600"
                    }`}>
                      {ticketCount}
                    </span>
                  </button>
                );
              })}
              {!loading && projects.length === 0 && (
                <div className="p-6 text-center text-xs text-ink-400 border border-dashed border-ink-200 rounded-xl m-2 bg-white">
                  No projects found.
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 2: Sprints (Slides open dynamically if project selected) */}
          <div
            className={`transition-all duration-300 ease-in-out flex flex-col min-h-0 bg-ink-50/10 ${
              selectedProjectId !== null
                ? "w-64 opacity-100 border-r border-ink-150"
                : "w-0 opacity-0 overflow-hidden pointer-events-none border-none"
            }`}
          >
            <div className="p-4 border-b border-ink-150 bg-white/50 backdrop-blur-sm">
              <h2 className="font-display font-extrabold text-xs text-ink-900 uppercase tracking-wider">Sprints</h2>
              <p className="text-[10px] text-ink-400">Select active sprint</p>
            </div>

            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 chart-canvas">
              {selectedProjectId !== null && (
                <>
                  {/* Sprints list */}
                  {projectSprints.map((s) => {
                    const isActive = selectedSprintId === s.id;
                    const ticketCount = getIssuesForSprint(selectedProjectId, s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => handleSelectSprint(s.id)}
                        onDoubleClick={handleDoubleClickSprint}
                        className={`w-full text-left rounded-xl p-3.5 transition-all flex items-center justify-between border ${
                          isActive
                            ? "bg-brand border-brand text-white shadow-md shadow-brand/15 font-bold animate-fade-in"
                            : "border-transparent text-ink-700 hover:bg-ink-100 hover:text-ink-900"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs truncate font-semibold leading-tight">{s.name}</p>
                          <p className={`text-[10px] uppercase font-bold tracking-wider mt-0.5 leading-none ${
                            isActive ? "text-brand-light font-medium" : s.state === "active" ? "text-emerald-600" : "text-ink-400"
                          }`}>
                            {s.state}
                          </p>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          isActive ? "bg-white/20 text-white" : "bg-ink-200/60 text-ink-600"
                        }`}>
                          {ticketCount}
                        </span>
                      </button>
                    );
                  })}

                  {/* Backlog Item */}
                  <button
                    onClick={() => handleSelectSprint("backlog")}
                    onDoubleClick={handleDoubleClickSprint}
                    className={`w-full text-left rounded-xl p-3.5 transition-all flex items-center justify-between border ${
                      selectedSprintId === "backlog"
                        ? "bg-brand border-brand text-white shadow-md shadow-brand/15 font-bold"
                        : "border-transparent text-ink-700 hover:bg-ink-100 hover:text-ink-900"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs truncate font-semibold leading-tight">Backlog</p>
                      <p className={`text-[10px] mt-0.5 leading-none ${selectedSprintId === "backlog" ? "text-brand-light" : "text-ink-400"}`}>Unassigned tickets</p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      selectedSprintId === "backlog" ? "bg-white/20 text-white" : "bg-ink-200/60 text-ink-600"
                    }`}>
                      {getIssuesForSprint(selectedProjectId, "backlog")}
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* COLUMN 3: Tickets List (Slides open dynamically if sprint selected) */}
          <div
            className={`transition-all duration-300 ease-in-out flex flex-col min-h-0 bg-white ${
              selectedSprintId !== null
                ? "w-96 opacity-100 border-r border-ink-150"
                : "w-0 opacity-0 overflow-hidden pointer-events-none border-none"
            }`}
          >
            <div className="p-4 border-b border-ink-150 flex flex-col gap-3">
              <div>
                <h2 className="font-display font-extrabold text-xs text-ink-900 uppercase tracking-wider">
                  Tickets ({filteredIssuesList.length})
                </h2>
                <p className="text-[10px] text-ink-400">Select ticket to review details</p>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter by summary or key..."
                  className="w-full rounded-lg border border-ink-250 bg-ink-50/40 px-3 py-1.5 pl-8 text-xs text-ink-800 outline-none focus:border-brand focus:ring-1 focus:ring-brand font-medium placeholder-ink-400"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <svg className="absolute left-2.5 top-2 h-3.5 w-3.5 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 bg-ink-50/5 chart-canvas">
              {selectedSprintId !== null && (
                <>
                  {filteredIssuesList.map((issue) => {
                    const isActive = selectedIssueId === issue.id;
                    return (
                      <div
                        key={issue.id}
                        onClick={() => setSelectedIssueId(issue.id)}
                        onDoubleClick={handleDoubleClickIssue}
                        className={`group flex flex-col gap-2 rounded-xl border p-3.5 transition-all cursor-pointer animate-fade-in ${
                          isActive
                            ? "bg-brand/5 border-brand shadow-sm"
                            : "bg-white border-ink-200/80 hover:border-ink-300 hover:shadow-sm"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="rounded bg-brand/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-brand uppercase tracking-wide">
                            {issue.key}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold ${getPriorityColor(issue.priority)}`}>
                              {issue.priority}
                            </span>
                            <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold ${getStatusColor(issue.status)}`}>
                              {issue.status}
                            </span>
                          </div>
                        </div>

                        <p className={`text-xs font-semibold text-ink-800 transition-colors group-hover:text-brand ${isActive ? "text-brand" : ""}`}>
                          {issue.summary}
                        </p>

                        <div className="pt-2 border-t border-ink-100 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/20 text-[9px] font-bold text-brand uppercase">
                              {issue.assignee ? issue.assignee.substring(0, 2) : "UN"}
                            </div>
                            <span className="text-[10px] font-medium text-ink-500">
                              {issue.assignee || "Unassigned"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {filteredIssuesList.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-ink-200 rounded-xl bg-white p-6">
                      <span className="text-xs text-ink-400 font-medium">No tickets match criteria.</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* COLUMN 4: Ticket Details & Edit Form (Slides open dynamically if ticket selected) */}
          <div
            className={`transition-all duration-300 ease-in-out flex flex-col min-h-0 bg-ink-50/20 ${
              selectedIssueId !== null
                ? "w-[450px] opacity-100 border-l border-ink-150"
                : "w-0 opacity-0 overflow-hidden pointer-events-none border-none"
            }`}
          >
            <div className="p-4 border-b border-ink-150 bg-white/50 backdrop-blur-sm">
              <h2 className="font-display font-extrabold text-xs text-ink-900 uppercase tracking-wider">Ticket Properties</h2>
              <p className="text-[10px] text-ink-400">View and update properties in real-time</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 chart-canvas">
              {activeIssue && (
                <form onSubmit={handleUpdateIssue} className="flex flex-col gap-4 animate-fade-in">
                  {/* Status Banner */}
                  {successMsg && (
                    <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-xs font-semibold text-green-800 flex items-center gap-2">
                      <svg className="h-4 w-4 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {successMsg}
                    </div>
                  )}

                  {/* Header metadata */}
                  <div className="bg-white border border-ink-200/80 rounded-xl p-4 flex flex-col gap-1.5 shadow-sm">
                    <span className="font-mono text-[10px] font-bold text-brand uppercase">{activeIssue.key}</span>
                    <h3 className="font-display font-bold text-sm text-ink-800 leading-snug">{activeIssue.summary}</h3>
                    <div className="mt-2 pt-2 border-t border-ink-100 flex flex-col gap-1 text-[10px] text-ink-400">
                      <div className="flex justify-between">
                        <span>Project: <span className="font-semibold text-ink-600">{activeIssue.projectName}</span></span>
                        {activeIssue.sprintName && (
                          <span>Sprint: <span className="font-semibold text-ink-600">{activeIssue.sprintName}</span></span>
                        )}
                      </div>
                      <div className="flex justify-between pt-1 border-t border-dashed border-ink-100">
                        <span>Expected: <span className="font-semibold text-ink-700">{activeIssue.expectedTime || "Not set"}</span></span>
                        <span>Actual Spent: <span className="font-semibold text-ink-700">{activeIssue.actualTime || "Not set"}</span></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-ink-600">Summary</label>
                    <input
                      type="text"
                      required
                      className="input text-xs"
                      value={editSummary}
                      onChange={(e) => setEditSummary(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-ink-600">Status</label>
                      <select
                        className="input text-xs bg-white"
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                      >
                        <option value="To Do">To Do</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Done">Done</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-ink-600">Priority</label>
                      <select
                        className="input text-xs bg-white"
                        value={editPriority}
                        onChange={(e) => setEditPriority(e.target.value)}
                      >
                        <option value="Highest">Highest</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                        <option value="Lowest">Lowest</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-ink-600">Expected Time</label>
                      <input
                        type="text"
                        className="input text-xs"
                        placeholder="e.g. 8h, 2d"
                        value={editExpectedTime}
                        onChange={(e) => setEditExpectedTime(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-ink-600">Actual Time</label>
                      <input
                        type="text"
                        className="input text-xs"
                        placeholder="e.g. 6h, 1d"
                        value={editActualTime}
                        onChange={(e) => setEditActualTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-ink-600">Project Board</label>
                      <select
                        className="input text-xs bg-white"
                        value={editProjectId}
                        onChange={(e) => setEditProjectId(Number(e.target.value))}
                      >
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-ink-600">Sprint Board</label>
                      <select
                        className="input text-xs bg-white"
                        value={editSprintId ?? ""}
                        onChange={(e) => setEditSprintId(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">No Sprint (Backlog)</option>
                        {sprints.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-ink-600">Assignee</label>
                    <select
                      className="input text-xs bg-white"
                      value={editAssignee}
                      onChange={(e) => setEditAssignee(e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {Array.from(new Set(employees.map((e) => e.fullName)))
                        .sort()
                        .map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      {editAssignee && !employees.some((e) => e.fullName === editAssignee) && (
                        <option value={editAssignee}>{editAssignee} (External)</option>
                      )}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-ink-600">Description</label>
                    <textarea
                      className="input text-xs min-h-[120px] resize-y leading-relaxed font-body"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="No description provided."
                    />
                  </div>

                  {/* Save/Reset Actions */}
                  <div className="mt-4 flex items-center justify-end gap-3 border-t border-ink-150 pt-4">
                    <button
                      type="button"
                      onClick={handleResetForm}
                      disabled={updating}
                      className="btn-secondary text-xs"
                    >
                      Reset
                    </button>
                    <button
                      type="submit"
                      disabled={updating}
                      className="btn-primary text-xs flex items-center gap-2"
                    >
                      {updating ? (
                        <>
                          <svg className="animate-spin h-3 w-3 text-white" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* DYNAMIC PLACEHOLDER (Shows in remaining space if ticket details not open) */}
          {selectedIssueId === null && (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-ink-50/5">
              {selectedProjectId === null && (
                <div className="max-w-sm flex flex-col items-center animate-fade-in">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand mb-4">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <h3 className="font-display font-extrabold text-sm text-ink-950">Select a Project</h3>
                  <p className="text-xs text-ink-400 mt-1.5 leading-relaxed">Choose a workspace from the leftmost column to view active board sprints and tickets.</p>
                </div>
              )}
              {selectedProjectId !== null && selectedSprintId === null && (
                <div className="max-w-sm flex flex-col items-center animate-fade-in">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand mb-4">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="font-display font-extrabold text-sm text-ink-950">Select a Sprint</h3>
                  <p className="text-xs text-ink-400 mt-1.5 leading-relaxed">Choose an active sprint backlog in the second column to display its issues.</p>
                </div>
              )}
              {selectedProjectId !== null && selectedSprintId !== null && selectedIssueId === null && (
                <div className="max-w-sm flex flex-col items-center animate-fade-in">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand mb-4">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="font-display font-extrabold text-sm text-ink-950">Select a Ticket</h3>
                  <p className="text-xs text-ink-400 mt-1.5 leading-relaxed">Choose any ticket from the list to preview details and make edits inline.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
