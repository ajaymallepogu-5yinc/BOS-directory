import { apiClient } from "./client";

export interface Project {
  id: number;
  name: string;
  projectManagerId?: number | null;
  projectManagerName?: string | null;
  isBillable: boolean;
  jiraBoardId?: string | null;
  jiraProjectKey?: string | null;
  createdAt: string;
  createdBy?: string | null;
}

export interface ProjectFormValues {
  name: string;
  projectManagerId: number | null;
  isBillable: boolean;
  jiraBoardId?: string;
}

export interface SyncJiraResult {
  success: boolean;
  message: string;
  syncedCount: number;
}

export async function fetchProjects(): Promise<Project[]> {
  const { data } = await apiClient.get<Project[]>("/projects");
  return data;
}

export async function createProject(values: ProjectFormValues): Promise<Project> {
  const { data } = await apiClient.post<Project>("/projects", values);
  return data;
}

export async function updateProject(id: number, values: ProjectFormValues): Promise<void> {
  await apiClient.put(`/projects/${id}`, values);
}

export async function deleteProject(id: number): Promise<void> {
  await apiClient.delete(`/projects/${id}`);
}

export async function syncJiraProjects(): Promise<SyncJiraResult> {
  const { data } = await apiClient.post<SyncJiraResult>("/projects/sync-jira");
  return data;
}
