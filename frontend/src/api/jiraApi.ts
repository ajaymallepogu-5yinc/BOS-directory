import { apiClient } from "./client";
import type {
  JiraDashboardData,
  TestJiraConnectionRequest,
  TestJiraConnectionResult,
  JiraImportResult,
  UpdateJiraIssueRequest,
} from "./types";

export async function fetchJiraDashboard(): Promise<JiraDashboardData> {
  const { data } = await apiClient.get<JiraDashboardData>("/jira/dashboard");
  return data;
}

export async function testJiraConnection(req: TestJiraConnectionRequest): Promise<TestJiraConnectionResult> {
  const { data } = await apiClient.post<TestJiraConnectionResult>("/jira/settings/test", req);
  return data;
}

export async function importJiraData(req: TestJiraConnectionRequest): Promise<JiraImportResult> {
  const { data } = await apiClient.post<JiraImportResult>("/jira/settings/import", req);
  return data;
}

export async function updateJiraIssue(id: number, req: UpdateJiraIssueRequest): Promise<void> {
  await apiClient.put(`/jira/issues/${id}`, req);
}
