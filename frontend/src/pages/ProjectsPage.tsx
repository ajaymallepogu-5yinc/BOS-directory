import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchEmployees } from "../api/employeeApi";
import ConfirmModal from "../components/Layout/ConfirmModal";
import { CustomSelect } from "../components/Admin/EmployeeFormDrawer";
import {
  fetchProjects,
  createProject,
  updateProject,
  deleteProject,
  syncJiraProjects
} from "../api/projectApi";
import type { Project, ProjectFormValues } from "../api/projectApi";
import { fetchClients, findOrCreateClient } from "../api/clientApi";
import type { Client } from "../api/clientApi";
import { fetchProjectResources, addProjectResource, updateProjectResourceBillable, removeProjectResource } from "../api/projectResourceApi";
import type { ProjectResource } from "../api/projectResourceApi";
import type { Employee } from "../api/types";

export default function ProjectsPage() {
  const { user } = useAuth();
  const isAdmin = !user || user.isAdmin; // Fallback to true if auth is disabled/mocked

  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filters: status (null = All) and client (null = All)
  const [filterStatus, setFilterStatus] = useState<"active" | "inactive" | null>(null);
  const [filterClientId, setFilterClientId] = useState<number | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Form states
  const [formName, setFormName] = useState("");
  const [formManagerId, setFormManagerId] = useState<number | null>(null);
  const [formClientId, setFormClientId] = useState<number | null>(null);
  const [formIsBillable, setFormIsBillable] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formJiraId, setFormJiraId] = useState("");

  // Inline "type a new client name to create it" affordance in the modal
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [isCreatingClient, setIsCreatingClient] = useState(false);

  // Confirm delete states
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<number | null>(null);

  // Manage Resources panel
  const [resourcesProject, setResourcesProject] = useState<Project | null>(null);
  const [resources, setResources] = useState<ProjectResource[]>([]);
  const [isLoadingResources, setIsLoadingResources] = useState(false);
  const [addResourceEmployeeId, setAddResourceEmployeeId] = useState<number | null>(null);
  const [addResourceIsBillable, setAddResourceIsBillable] = useState(true);
  // Every change in this panel (add, billable toggle, remove) is staged locally and only actually
  // sent to the server when "Done" is pressed - closing via the X discards all of it instead.
  const [pendingResources, setPendingResources] = useState<{ employeeId: number; employeeName: string; isBillable: boolean }[]>([]);
  const [pendingBillableOverrides, setPendingBillableOverrides] = useState<Record<number, boolean>>({});
  const [pendingRemovals, setPendingRemovals] = useState<Set<number>>(new Set());
  const [isSavingResources, setIsSavingResources] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const [projList, empList, clientList] = await Promise.all([
        fetchProjects(),
        fetchEmployees(),
        fetchClients()
      ]);
      setProjects(projList);
      setEmployees(empList);
      setClients(clientList);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Failed to load projects data.");
    } finally {
      setLoading(false);
    }
  };

  // Re-fetches the list without toggling the full-page loading spinner, so actions
  // like delete/create/sync update the table smoothly instead of flashing it away.
  const refreshProjects = async () => {
    try {
      const projList = await fetchProjects();
      setProjects(projList);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Failed to refresh projects data.");
    }
  };

  const showNotification = (type: "success" | "error", message: string) => {
    if (type === "success") {
      setSuccessMsg(message);
      setTimeout(() => setSuccessMsg(""), 4000);
    } else {
      setErrorMsg(message);
      setTimeout(() => setErrorMsg(""), 4000);
    }
  };

  const handleOpenAddModal = () => {
    setEditingProject(null);
    setFormName("");
    setFormManagerId(null);
    setFormClientId(null);
    setFormIsBillable(false);
    setFormIsActive(true);
    setFormJiraId("");
    setIsAddingClient(false);
    setNewClientName("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (project: Project) => {
    setEditingProject(project);
    setFormName(project.name);
    setFormManagerId(project.projectManagerId || null);
    setFormClientId(project.clientId || null);
    setFormIsBillable(project.isBillable);
    setFormIsActive(project.isActive);
    setFormJiraId(project.jiraBoardIds || "");
    setIsAddingClient(false);
    setNewClientName("");
    setIsModalOpen(true);
  };

  const handleCreateClient = async () => {
    const name = newClientName.trim();
    if (!name) return;
    setIsCreatingClient(true);
    try {
      const client = await findOrCreateClient(name);
      setClients((prev) => (prev.some((c) => c.id === client.id) ? prev : [...prev, client].sort((a, b) => a.name.localeCompare(b.name))));
      setFormClientId(client.id);
      setIsAddingClient(false);
      setNewClientName("");
    } catch (err: any) {
      showNotification("error", err.response?.data?.message || "Failed to add client.");
    } finally {
      setIsCreatingClient(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showNotification("error", "Project name is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const values: ProjectFormValues = {
        name: formName.trim(),
        projectManagerId: formManagerId,
        clientId: formClientId,
        isBillable: formIsBillable,
        isActive: formIsActive,
        jiraBoardIds: formJiraId.trim() || undefined
      };

      if (editingProject) {
        await updateProject(editingProject.id, values);
        showNotification("success", "Project updated successfully.");
      } else {
        await createProject(values);
        showNotification("success", "Project created successfully.");
      }

      setIsModalOpen(false);
      await refreshProjects();
    } catch (err: any) {
      showNotification("error", err.response?.data?.message || "Failed to save project.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: number) => {
    setProjectToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (projectToDelete === null) return;
    setDeleteConfirmOpen(false);
    try {
      await deleteProject(projectToDelete);
      showNotification("success", "Project deleted successfully.");
      await refreshProjects();
    } catch (err: any) {
      showNotification("error", err.response?.data?.message || "Failed to delete project.");
    } finally {
      setProjectToDelete(null);
    }
  };

  const handleJiraSync = async () => {
    setIsSyncing(true);
    setErrorMsg("");
    try {
      const result = await syncJiraProjects();
      if (result.success) {
        showNotification("success", result.message);
        await refreshProjects();
      } else {
        showNotification("error", result.message);
      }
    } catch (err: any) {
      showNotification("error", err.response?.data?.message || "Failed to sync Jira.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenResources = async (project: Project) => {
    setResourcesProject(project);
    setAddResourceEmployeeId(null);
    setAddResourceIsBillable(project.isBillable);
    setPendingResources([]);
    setPendingBillableOverrides({});
    setPendingRemovals(new Set());
    setIsLoadingResources(true);
    try {
      setResources(await fetchProjectResources(project.id));
    } catch (err: any) {
      showNotification("error", err.response?.data?.message || "Failed to load resources.");
    } finally {
      setIsLoadingResources(false);
    }
  };

  // The table's "N resources" badge reads project.resourceCount from the `projects` list, which
  // is a separate copy from `resources` (the modal's own list) - without this, adding/removing a
  // resource updates the modal correctly but leaves the table showing a stale count until the
  // next full reload.
  const bumpResourceCount = (projectId: number, delta: number) => {
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, resourceCount: p.resourceCount + delta } : p)));
  };

  const closeResourcesDiscardingChanges = () => {
    setPendingResources([]);
    setPendingBillableOverrides({});
    setPendingRemovals(new Set());
    setResourcesProject(null);
  };

  // Every action below only updates local state - nothing reaches the server until Done commits
  // it all at once. Closing via the X instead discards everything staged here.
  const handleAddResource = () => {
    if (addResourceEmployeeId === null) return;
    const employee = employees.find((e) => e.id === addResourceEmployeeId);
    if (!employee) return;
    setPendingResources((prev) => [...prev, { employeeId: employee.id, employeeName: employee.fullName, isBillable: addResourceIsBillable }]);
    setAddResourceEmployeeId(null);
    setAddResourceIsBillable(resourcesProject?.isBillable ?? true);
  };

  const handleRemovePendingResource = (employeeId: number) => {
    setPendingResources((prev) => prev.filter((p) => p.employeeId !== employeeId));
  };

  const handleTogglePendingBillable = (employeeId: number) => {
    setPendingResources((prev) => prev.map((p) => (p.employeeId === employeeId ? { ...p, isBillable: !p.isBillable } : p)));
  };

  const handleToggleResourceBillable = (resource: ProjectResource) => {
    const current = pendingBillableOverrides[resource.id] ?? resource.isBillable;
    setPendingBillableOverrides((prev) => ({ ...prev, [resource.id]: !current }));
  };

  const handleRemoveResource = (resource: ProjectResource) => {
    setPendingRemovals((prev) => new Set(prev).add(resource.id));
  };

  // Commits every staged change (adds, billable overrides, removals) to the server in one go,
  // then closes - this is the only path that actually persists anything from this panel.
  const handleDoneResources = async () => {
    if (!resourcesProject) return;
    const billableChanges = Object.entries(pendingBillableOverrides).filter(([id]) => !pendingRemovals.has(Number(id)));
    const hasChanges = pendingResources.length > 0 || pendingRemovals.size > 0 || billableChanges.length > 0;
    if (!hasChanges) {
      setResourcesProject(null);
      return;
    }

    setIsSavingResources(true);
    try {
      for (const [idStr, isBillable] of billableChanges) {
        await updateProjectResourceBillable(Number(idStr), isBillable);
      }
      for (const id of pendingRemovals) {
        await removeProjectResource(id);
      }
      for (const pending of pendingResources) {
        await addProjectResource(resourcesProject.id, pending.employeeId, pending.isBillable);
      }
      bumpResourceCount(resourcesProject.id, pendingResources.length - pendingRemovals.size);
      setPendingResources([]);
      setPendingBillableOverrides({});
      setPendingRemovals(new Set());
      setResourcesProject(null);
    } catch (err: any) {
      showNotification("error", err.response?.data?.message || "Failed to save some resource changes. Please try again.");
    } finally {
      setIsSavingResources(false);
    }
  };

  const filteredProjects = projects.filter((p) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(term) ||
      (p.projectManagerName && p.projectManagerName.toLowerCase().includes(term)) ||
      (p.jiraBoardIds && p.jiraBoardIds.toLowerCase().includes(term));
    const matchesStatus = filterStatus === null || (filterStatus === "active" ? p.isActive : !p.isActive);
    const matchesClient = filterClientId === null || p.clientId === filterClientId;
    return matchesSearch && matchesStatus && matchesClient;
  });

  return (
    <div className="h-full flex flex-col bg-ink-50/20 p-8 overflow-hidden">
      {/* Toast Notifications */}
      {successMsg && (
        <div className="fixed top-4 right-4 z-[60] flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 text-xs font-semibold shadow-lg animate-fade-in">
          <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="fixed top-4 right-4 z-[60] flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 text-xs font-semibold shadow-lg animate-fade-in">
          <svg className="h-4 w-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {errorMsg}
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-ink-150 pb-6 mb-6">
        <div>
          <h1 className="font-display text-2xl font-black text-ink-900 leading-tight">Projects</h1>
          <p className="text-xs text-ink-500 mt-1">Manage project details, billing statuses, and sync directly with Jira.</p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleJiraSync}
              disabled={isSyncing}
              className="flex items-center gap-2 py-2 px-4 rounded-xl border border-ink-200 bg-white text-xs font-semibold text-ink-700 hover:bg-ink-50 transition-all shadow-sm disabled:opacity-50"
            >
              <svg className={`h-4 w-4 shrink-0 text-sky-500 ${isSyncing ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V1.001A1.001 1.001 0 0 0 23.013 0z" />
              </svg>
              {isSyncing ? "Syncing Jira..." : "Jira Sync"}
            </button>

            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 py-2 px-4 rounded-xl bg-brand text-xs font-semibold text-white hover:bg-brand/90 transition-all shadow-md shadow-brand/10"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Project
            </button>
          </div>
        )}
      </div>

      {/* Search and filter controls */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex max-w-md flex-1 min-w-[240px] items-center gap-2 bg-white rounded-xl border border-ink-150 px-3.5 py-2.5 shadow-sm">
          <svg className="h-5 w-5 shrink-0 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by project name, manager or Jira ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 text-xs text-ink-800 placeholder-ink-400 focus:outline-none"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="text-ink-400 hover:text-ink-600">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-ink-400 uppercase tracking-wide shrink-0">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 8h12M9 12h6M11 16h2" />
            </svg>
            Filter
          </div>
          <div className="w-36">
            <CustomSelect
              value={filterStatus}
              onChange={(val) => setFilterStatus(val as "active" | "inactive" | null)}
              options={[
                { value: "active", label: "Status: Active" },
                { value: "inactive", label: "Status: Inactive" }
              ]}
              emptyLabel="Status: All"
            />
          </div>
          <div className="w-44">
            <CustomSelect
              value={filterClientId}
              onChange={(val) => setFilterClientId(val !== null ? Number(val) : null)}
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
              emptyLabel="Client: All"
            />
          </div>
          {(filterStatus !== null || filterClientId !== null) && (
            <button
              onClick={() => {
                setFilterStatus(null);
                setFilterClientId(null);
              }}
              className="flex items-center gap-1 text-[10px] font-bold text-ink-400 hover:text-rose-600 shrink-0"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table / List - the only part of the page that scrolls */}
      <div className="flex-1 min-h-0">
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-ink-200 border-t-brand" />
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-white p-12 text-center">
          <svg className="h-12 w-12 text-ink-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm font-semibold text-ink-800">No projects found</p>
          <p className="text-xs text-ink-500 mt-1 max-w-sm">
            {searchTerm 
              ? "No results match your search term. Try checking for typos or searching something else." 
              : "Start by manually creating a project or syncing your existing projects from Jira."}
          </p>
        </div>
      ) : (
        <div className="h-full overflow-auto scrollbar-none rounded-2xl border border-ink-150 bg-white shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-ink-150 bg-ink-50 text-[10px] font-bold uppercase tracking-wider text-ink-500 whitespace-nowrap">
                  <th className="py-3 px-6">Project Name</th>
                  <th className="py-3 px-6">Project Manager</th>
                  <th className="py-3 px-6">Client</th>
                  <th className="py-3 px-6">Billing Type</th>
                  <th className="py-3 px-6">Resources</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6">Jira Board(s)</th>
                  <th className="py-3 px-6">Created On</th>
                  {isAdmin && <th className="py-3 px-6 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 text-xs text-ink-700">
                {filteredProjects.map((project) => (
                  <tr key={project.id} className="hover:bg-ink-50/30 transition-all duration-150">
                    <td className="py-4.5 px-6 font-semibold text-ink-900">{project.name}</td>
                    <td className="py-4.5 px-6">
                      <div className="flex flex-col gap-1">
                        {project.projectManagerName ? (
                          <span className="font-medium text-ink-800">{project.projectManagerName}</span>
                        ) : (
                          <span className="text-ink-400 italic">Unassigned</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4.5 px-6">
                      {project.clientName ? (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-brand/10 px-2 py-1 text-[10px] font-bold text-brand border border-brand/20">
                          {project.clientName}
                        </span>
                      ) : (
                        <span className="text-ink-400 italic whitespace-nowrap">No client</span>
                      )}
                    </td>
                    <td className="py-4.5 px-6">
                      {project.isBillable ? (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-150">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                          Billable
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-600 border border-slate-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                          Internal (Non-billable)
                        </span>
                      )}
                    </td>
                    <td className="py-4.5 px-6">
                      <button
                        onClick={() => handleOpenResources(project)}
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-ink-100 px-2.5 py-1 text-[10px] font-bold text-ink-600 hover:bg-ink-200 transition-colors"
                      >
                        {project.resourceCount} {project.resourceCount === 1 ? "resource" : "resources"}
                        <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </td>
                    <td className="py-4.5 px-6">
                      {project.isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-150">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-600 border border-rose-150">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-4.5 px-6">
                      {project.jiraBoardIds ? (
                        <div className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50/50 border border-sky-100/70 text-sky-800 font-mono text-[10px] px-2 py-1.5 shrink-0">
                          <svg className="h-3.5 w-3.5 shrink-0 text-sky-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V1.001A1.001 1.001 0 0 0 23.013 0z" />
                          </svg>
                          {project.jiraBoardIds}
                        </div>
                      ) : (
                        <span className="text-ink-400 italic">None</span>
                      )}
                    </td>
                    <td className="py-4.5 px-6 text-ink-500">
                      {new Date(project.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric"
                      })}
                      {project.createdBy && (
                        <p className="text-[9px] text-ink-400 mt-0.5">by {project.createdBy}</p>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="py-4.5 px-6 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEditModal(project)}
                            className="p-1.5 text-ink-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-all rounded-lg"
                            title="Edit Project"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(project.id)}
                            className="p-1.5 text-ink-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all rounded-lg"
                            title="Delete Project"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
      )}
      </div>

      {/* Modal Overlay Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-ink-150 bg-white p-6 shadow-xl animate-slide-up">
            <div className="flex items-center justify-between border-b border-ink-150 pb-4 mb-4">
              <h2 className="text-sm font-black text-ink-900">
                {editingProject ? "Edit Project Details" : "Create New Project"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-ink-400 hover:text-ink-600 p-1 rounded-lg hover:bg-ink-100"
              >
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleFormSubmit} noValidate className="flex flex-col gap-4">
              {/* Project Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wide">Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. OrgChart Dashboard"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="rounded-xl border border-ink-200 px-3.5 py-2 text-xs text-ink-800 placeholder-ink-400 focus:border-brand focus:outline-none"
                />
              </div>

              {/* Project Manager */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wide">Project Manager</label>
                <CustomSelect
                  value={formManagerId}
                  onChange={(val) => setFormManagerId(val !== null ? Number(val) : null)}
                  options={employees.map((e) => ({ value: e.id, label: `${e.fullName} (${e.title})` }))}
                  emptyLabel="Unassigned"
                />
              </div>

              {/* Client */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wide">Client</label>
                  {!isAddingClient && (
                    <button
                      type="button"
                      onClick={() => setIsAddingClient(true)}
                      className="text-[10px] font-bold text-brand hover:underline"
                    >
                      + New client
                    </button>
                  )}
                </div>
                {isAddingClient ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Client name"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleCreateClient();
                        }
                      }}
                      className="flex-1 rounded-xl border border-ink-200 px-3.5 py-2 text-xs text-ink-800 placeholder-ink-400 focus:border-brand focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCreateClient}
                      disabled={isCreatingClient || !newClientName.trim()}
                      className="py-2 px-3 rounded-xl bg-brand text-xs font-semibold text-white hover:bg-brand/90 transition-all disabled:opacity-50"
                    >
                      {isCreatingClient ? "Adding..." : "Add"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingClient(false);
                        setNewClientName("");
                      }}
                      className="text-ink-400 hover:text-ink-600 p-1"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <CustomSelect
                    value={formClientId}
                    onChange={(val) => setFormClientId(val !== null ? Number(val) : null)}
                    options={clients.map((c) => ({ value: c.id, label: c.name }))}
                    emptyLabel="No client"
                  />
                )}
              </div>

              {/* Is Billable Toggle */}
              <div className="flex items-center justify-between py-2 border-t border-b border-ink-100 my-1">
                <div>
                  <p className="text-xs font-bold text-ink-800">Billable Project</p>
                  <p className="text-[10px] text-ink-400 mt-0.5">Is this client-facing or billable work?</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsBillable}
                    onChange={(e) => setFormIsBillable(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-ink-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-ink-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand"></div>
                </label>
              </div>

              {/* Is Active Toggle */}
              <div className="flex items-center justify-between py-2 border-t border-b border-ink-100 my-1">
                <div>
                  <p className="text-xs font-bold text-ink-800">Active Project</p>
                  <p className="text-[10px] text-ink-400 mt-0.5">Inactive projects won't show up in the timesheet's project picker.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-ink-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-ink-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand"></div>
                </label>
              </div>

              {/* Footer buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-ink-150">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-2 px-4 rounded-xl border border-ink-200 bg-white text-xs font-semibold text-ink-700 hover:bg-ink-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="py-2 px-4 rounded-xl bg-brand text-xs font-semibold text-white hover:bg-brand/90 transition-all shadow-md shadow-brand/10 disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title="Delete Project"
        message="Are you sure you want to delete this project? This action cannot be undone."
        confirmLabel="Delete"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />

      {/* Manage Resources panel - who's staffed on this project, and whether their hours bill */}
      {resourcesProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-ink-150 bg-white p-6 shadow-xl animate-slide-up max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-ink-150 pb-4 mb-4 shrink-0">
              <div>
                <h2 className="text-sm font-black text-ink-900">{resourcesProject.name} — Resources</h2>
                <p className="text-[10px] text-ink-500 mt-0.5">Who's staffed on this project, and whether their hours on it bill to the client.</p>
              </div>
              <button
                onClick={closeResourcesDiscardingChanges}
                title="Close without saving any changes"
                className="text-ink-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors shrink-0"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-ink-50 border border-ink-100 mb-4 shrink-0">
              <div>
                <p className="text-xs font-bold text-ink-800">
                  Project default: {resourcesProject.isBillable ? "Billable" : "Non-billable"}
                </p>
                <p className="text-[10px] text-ink-400 mt-0.5">New resources start from this; each person's toggle below can still differ.</p>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto scrollbar-none">
              {isLoadingResources ? (
                <div className="flex h-24 items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-ink-200 border-t-brand" />
                </div>
              ) : resources.filter((r) => !pendingRemovals.has(r.id)).length === 0 && pendingResources.length === 0 ? (
                <p className="text-xs text-ink-400 italic text-center py-6">No resources added yet.</p>
              ) : (
                <div className="rounded-xl border border-ink-150 divide-y divide-ink-100 mb-4">
                  {resources.filter((r) => !pendingRemovals.has(r.id)).map((resource) => {
                    const effectiveBillable = pendingBillableOverrides[resource.id] ?? resource.isBillable;
                    return (
                      <div key={resource.id} className="flex items-center justify-between px-3 py-2.5">
                        <span className="text-xs font-medium text-ink-800 truncate min-w-0">{resource.employeeName}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[10px] font-bold text-ink-500">{effectiveBillable ? "Billable" : "Non-billable"}</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={effectiveBillable}
                              onChange={() => handleToggleResourceBillable(resource)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-ink-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-ink-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand"></div>
                          </label>
                          <button
                            onClick={() => handleRemoveResource(resource)}
                            className="text-ink-400 hover:text-rose-600 transition-colors"
                            title="Remove resource"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {pendingResources.map((pending) => (
                    <div key={pending.employeeId} className="flex items-center justify-between px-3 py-2.5">
                      <span className="text-xs font-medium text-ink-800 truncate min-w-0">{pending.employeeName}</span>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[10px] font-bold text-ink-500">{pending.isBillable ? "Billable" : "Non-billable"}</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={pending.isBillable}
                            onChange={() => handleTogglePendingBillable(pending.employeeId)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-ink-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-ink-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand"></div>
                        </label>
                        <button
                          onClick={() => handleRemovePendingResource(pending.employeeId)}
                          className="text-ink-400 hover:text-rose-600 transition-colors"
                          title="Remove"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-ink-150 shrink-0">
              <div className="flex-1">
                <CustomSelect
                  value={addResourceEmployeeId}
                  onChange={(val) => setAddResourceEmployeeId(val !== null ? Number(val) : null)}
                  options={employees
                    .filter((e) => !resources.some((r) => r.employeeId === e.id) && !pendingResources.some((p) => p.employeeId === e.id))
                    .map((e) => ({ value: e.id, label: `${e.fullName} (${e.title})` }))}
                  emptyLabel="Search an employee to add..."
                />
              </div>
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-ink-500 shrink-0">
                <input
                  type="checkbox"
                  checked={addResourceIsBillable}
                  onChange={(e) => setAddResourceIsBillable(e.target.checked)}
                  className="rounded border-ink-300 text-brand focus:ring-brand"
                />
                Billable
              </label>
              <button
                onClick={handleAddResource}
                disabled={addResourceEmployeeId === null}
                className="py-2 px-3 rounded-xl bg-brand text-xs font-semibold text-white hover:bg-brand/90 transition-all disabled:opacity-50 shrink-0"
              >
                + Add
              </button>
            </div>

            <div className="flex items-center justify-between pt-4 mt-3 border-t border-ink-150 shrink-0">
              <p className="text-[10px] text-ink-400">
                {pendingResources.length + pendingRemovals.size + Object.keys(pendingBillableOverrides).length > 0
                  ? "You have unsaved changes — press Done to apply them."
                  : ""}
              </p>
              <button
                onClick={handleDoneResources}
                disabled={isSavingResources}
                className="py-2 px-4 rounded-xl bg-brand text-xs font-semibold text-white hover:bg-brand/90 transition-all shadow-md shadow-brand/10 disabled:opacity-50"
              >
                {isSavingResources ? "Saving..." : "Done"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
