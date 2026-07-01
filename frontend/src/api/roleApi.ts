import { apiClient } from "./client";
import type { CareerTrack, EmployeeCareerMapping } from "./types";

export async function fetchRoleTracks(): Promise<CareerTrack[]> {
  const { data } = await apiClient.get<CareerTrack[]>("/roles/tracks");
  return data;
}

export async function fetchEmployeeCareer(employeeId: number): Promise<EmployeeCareerMapping> {
  const { data } = await apiClient.get<EmployeeCareerMapping>(`/roles/employee/${employeeId}`);
  return data;
}
