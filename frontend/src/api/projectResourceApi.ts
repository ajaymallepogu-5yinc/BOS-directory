import { apiClient } from "./client";

export interface ProjectResource {
  id: number;
  projectId: number;
  employeeId: number;
  employeeName: string;
  isBillable: boolean;
  createdAt: string;
}

export async function fetchProjectResources(projectId: number): Promise<ProjectResource[]> {
  const { data } = await apiClient.get<ProjectResource[]>(`/projects/${projectId}/resources`);
  return data;
}

export async function addProjectResource(projectId: number, employeeId: number, isBillable: boolean): Promise<ProjectResource> {
  const { data } = await apiClient.post<ProjectResource>(`/projects/${projectId}/resources`, { employeeId, isBillable });
  return data;
}

export async function updateProjectResourceBillable(id: number, isBillable: boolean): Promise<void> {
  await apiClient.put(`/project-resources/${id}`, { isBillable });
}

export async function removeProjectResource(id: number): Promise<void> {
  await apiClient.delete(`/project-resources/${id}`);
}
