import { useState, useEffect } from "react";
import ConfirmModal from "../components/Layout/ConfirmModal";
import { fetchClients, findOrCreateClient, updateClient, deleteClient } from "../api/clientApi";
import type { Client } from "../api/clientApi";

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formName, setFormName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      setClients(await fetchClients());
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Failed to load clients.");
    } finally {
      setLoading(false);
    }
  };

  const refreshClients = async () => {
    try {
      setClients(await fetchClients());
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Failed to refresh clients.");
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
    setEditingClient(null);
    setFormName("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (client: Client) => {
    setEditingClient(client);
    setFormName(client.name);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showNotification("error", "Client name is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingClient) {
        await updateClient(editingClient.id, formName.trim());
        showNotification("success", "Client updated successfully.");
      } else {
        await findOrCreateClient(formName.trim());
        showNotification("success", "Client created successfully.");
      }
      setIsModalOpen(false);
      await refreshClients();
    } catch (err: any) {
      showNotification("error", err.response?.data?.message || "Failed to save client.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (client: Client) => {
    setClientToDelete(client);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!clientToDelete) return;
    setDeleteConfirmOpen(false);
    try {
      await deleteClient(clientToDelete.id);
      showNotification("success", "Client deleted successfully.");
      await refreshClients();
    } catch (err: any) {
      showNotification("error", err.response?.data?.message || "Failed to delete client.");
    } finally {
      setClientToDelete(null);
    }
  };

  const filteredClients = clients.filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="h-full flex flex-col bg-ink-50/20 p-8 overflow-hidden">
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
          <svg className="h-4 w-4 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {errorMsg}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-ink-150 pb-6 mb-6">
        <div>
          <h1 className="font-display text-2xl font-black text-ink-900 leading-tight">Clients</h1>
          <p className="text-xs text-ink-500 mt-1">Manage the clients projects can be grouped under.</p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 py-2 px-4 rounded-xl bg-brand text-xs font-semibold text-white hover:bg-brand/90 transition-all shadow-md shadow-brand/10"
        >
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Client
        </button>
      </div>

      <div className="mb-6 flex max-w-md items-center gap-2 bg-white rounded-xl border border-ink-150 px-3.5 py-2.5 shadow-sm">
        <svg className="h-5 w-5 shrink-0 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search clients..."
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

      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-ink-200 border-t-brand" />
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-white p-12 text-center">
            <svg className="h-12 w-12 text-ink-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm font-semibold text-ink-800">No clients found</p>
            <p className="text-xs text-ink-500 mt-1 max-w-sm">
              {searchTerm ? "No results match your search term." : "Add a client here, or type a new client name directly from a project's edit form."}
            </p>
          </div>
        ) : (
          <div className="h-full overflow-auto scrollbar-none rounded-2xl border border-ink-150 bg-white shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-ink-150 bg-ink-50 text-[10px] font-bold uppercase tracking-wider text-ink-500">
                  <th className="py-3 px-6">Client Name</th>
                  <th className="py-3 px-6">Projects</th>
                  <th className="py-3 px-6">Created On</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 text-xs text-ink-700">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-ink-50/30 transition-all duration-150">
                    <td className="py-4.5 px-6 font-semibold text-ink-900">{client.name}</td>
                    <td className="py-4.5 px-6">
                      <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-1 text-[10px] font-bold text-ink-600">
                        {client.projectCount} {client.projectCount === 1 ? "project" : "projects"}
                      </span>
                    </td>
                    <td className="py-4.5 px-6 text-ink-500">
                      {new Date(client.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                      {client.createdBy && <p className="text-[9px] text-ink-400 mt-0.5">by {client.createdBy}</p>}
                    </td>
                    <td className="py-4.5 px-6 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEditModal(client)}
                          className="p-1.5 text-ink-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-all rounded-lg"
                          title="Edit Client"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(client)}
                          className="p-1.5 text-ink-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all rounded-lg"
                          title="Delete Client"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-ink-150 bg-white p-6 shadow-xl animate-slide-up">
            <div className="flex items-center justify-between border-b border-ink-150 pb-4 mb-4">
              <h2 className="text-sm font-black text-ink-900">{editingClient ? "Edit Client" : "Add Client"}</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-ink-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleFormSubmit} noValidate className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wide">Client Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Acme Corp"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="rounded-xl border border-ink-200 px-3.5 py-2 text-xs text-ink-800 placeholder-ink-400 focus:border-brand focus:outline-none"
                />
              </div>

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
                  {isSubmitting ? "Saving..." : "Save Client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title="Delete Client"
        message={
          clientToDelete && clientToDelete.projectCount > 0
            ? `Are you sure? ${clientToDelete.projectCount} ${clientToDelete.projectCount === 1 ? "project is" : "projects are"} currently grouped under this client - they'll just show "No client" afterward, nothing else changes for them.`
            : "Are you sure you want to delete this client? This action cannot be undone."
        }
        confirmLabel="Delete"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
}
