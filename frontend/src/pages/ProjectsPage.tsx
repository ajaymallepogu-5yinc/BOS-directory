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
import type { Employee } from "../api/types";

export default function ProjectsPage() {
  const { user } = useAuth();
  const isAdmin = !user || user.isAdmin; // Fallback to true if auth is disabled/mocked

  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Form states
  const [formName, setFormName] = useState("");
  const [formManagerId, setFormManagerId] = useState<number | null>(null);
  const [formFunctionalManagerId, setFormFunctionalManagerId] = useState<number | null>(null);
  const [formIsBillable, setFormIsBillable] = useState(false);
  const [formJiraId, setFormJiraId] = useState("");

  // Confirm delete states
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const [projList, empList] = await Promise.all([
        fetchProjects(),
        fetchEmployees()
      ]);
      setProjects(projList);
      setEmployees(empList);
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
    setFormFunctionalManagerId(null);
    setFormIsBillable(false);
    setFormJiraId("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (project: Project) => {
    setEditingProject(project);
    setFormName(project.name);
    setFormManagerId(project.projectManagerId || null);
    setFormFunctionalManagerId(project.functionalManagerId || null);
    setFormIsBillable(project.isBillable);
    setFormJiraId(project.jiraBoardId || "");
    setIsModalOpen(true);
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
        functionalManagerId: formFunctionalManagerId,
        isBillable: formIsBillable,
        jiraBoardId: formJiraId.trim() || undefined
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
      showNotification("error", err.response?.data?.message || "Failed to sync Jira boards.");
    } finally {
      setIsSyncing(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    return name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const filteredProjects = projects.filter((p) => {
    const term = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      (p.projectManagerName && p.projectManagerName.toLowerCase().includes(term)) ||
      (p.functionalManagerName && p.functionalManagerName.toLowerCase().includes(term)) ||
      (p.jiraBoardId && p.jiraBoardId.toLowerCase().includes(term))
    );
  });

  return (
    <div className="h-full flex flex-col bg-ink-50/20 p-8 overflow-hidden">
      {/* Toast Notifications */}
      {successMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 text-xs font-semibold shadow-lg animate-fade-in">
          <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 text-xs font-semibold shadow-lg animate-fade-in">
          <svg className="h-4 w-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {errorMsg}
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-ink-150 pb-6 mb-6">
        <div>
          <h1 className="font-display text-2xl font-black text-ink-900 leading-tight">Project Boards</h1>
          <p className="text-xs text-ink-500 mt-1">Manage project details, billing statuses, and link boards directly to Jira.</p>
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
              {isSyncing ? "Syncing Jira..." : "Sync Jira Boards"}
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
      <div className="mb-6 flex max-w-md items-center gap-2 bg-white rounded-xl border border-ink-150 px-3.5 py-2.5 shadow-sm">
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
              : "Start by manually creating a project or syncing your existing board configs from Jira."}
          </p>
        </div>
      ) : (
        <div className="h-full overflow-auto scrollbar-none rounded-2xl border border-ink-150 bg-white shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-ink-150 bg-ink-50 text-[10px] font-bold uppercase tracking-wider text-ink-500">
                  <th className="py-3 px-6">Project Name</th>
                  <th className="py-3 px-6">Project Manager</th>
                  <th className="py-3 px-6">Billing Type</th>
                  <th className="py-3 px-6">Jira Connection</th>
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
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white bg-indigo-500 shrink-0">
                              {getInitials(project.projectManagerName)}
                            </div>
                            <span className="font-medium text-ink-800">{project.projectManagerName}</span>
                          </div>
                        ) : (
                          <span className="text-ink-400 italic">Unassigned</span>
                        )}
                        {project.functionalManagerName && (
                          <span className="text-[10px] text-ink-400 pl-9">Functional: {project.functionalManagerName}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4.5 px-6">
                      {project.isBillable ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-150">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Billable
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-600 border border-slate-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          Internal (Non-billable)
                        </span>
                      )}
                    </td>
                    <td className="py-4.5 px-6">
                      {project.jiraBoardId ? (
                        <div className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50/50 border border-sky-100/70 text-sky-800 font-mono text-[10px] px-2 py-1.5 shrink-0">
                          <svg className="h-3.5 w-3.5 shrink-0 text-sky-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V1.001A1.001 1.001 0 0 0 23.013 0z" />
                          </svg>
                          {project.jiraBoardId}
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

            <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
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

              {/* Functional Manager - separate from Project Manager; authorizes timesheet
                  approvals for entries logged against this project */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wide">Functional Manager (optional)</label>
                <CustomSelect
                  value={formFunctionalManagerId}
                  onChange={(val) => setFormFunctionalManagerId(val !== null ? Number(val) : null)}
                  options={employees.map((e) => ({ value: e.id, label: `${e.fullName} (${e.title})` }))}
                  emptyLabel="Unassigned"
                />
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
    </div>
  );
}
