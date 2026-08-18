import { apiClient } from "./client";

export interface Client {
  id: number;
  name: string;
  projectCount: number;
  createdAt: string;
  createdBy?: string | null;
}

export async function fetchClients(): Promise<Client[]> {
  const { data } = await apiClient.get<Client[]>("/clients");
  return data;
}

/** Finds an existing client by name (case/whitespace-insensitive) or creates one. */
export async function findOrCreateClient(name: string): Promise<Client> {
  const { data } = await apiClient.post<Client>("/clients", { name });
  return data;
}

export async function updateClient(id: number, name: string): Promise<Client> {
  const { data } = await apiClient.put<Client>(`/clients/${id}`, { name });
  return data;
}

export async function deleteClient(id: number): Promise<void> {
  await apiClient.delete(`/clients/${id}`);
}
