import { apiClient } from "./client";

export interface JiraTicket {
  key: string;
  summary: string;
}

export interface TimesheetEntry {
  id: number;
  timesheetId: number;
  employeeId: number;
  employeeName?: string | null;
  projectId?: number | null;
  projectName?: string | null;
  jiraIssueKey?: string | null;
  jiraIssueSummary?: string | null;
  taskDescription?: string | null;
  workDate: string;
  hoursSpent: number;
  comment?: string | null;
  timesheetStatus: "Draft" | "Pending" | "Approved" | "Rejected";
  reviewerComment?: string | null;
  reviewedByUserId?: number | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export interface TimesheetEntryFormValues {
  projectId: number | null;
  jiraIssueKey?: string;
  jiraIssueSummary?: string;
  taskDescription?: string;
  workDate: string;
  hoursSpent: number;
  comment?: string;
}

export interface ReviewFormValues {
  status: "Approved" | "Rejected";
  comment?: string;
}

export async function fetchJiraTickets(projectId: number): Promise<JiraTicket[]> {
  const { data } = await apiClient.get<JiraTicket[]>("/timesheet/tickets", { params: { projectId } });
  return data;
}

export async function fetchTimesheetEntries(scope: "mine" | "team"): Promise<TimesheetEntry[]> {
  const { data } = await apiClient.get<TimesheetEntry[]>("/timesheet/entries", { params: { scope } });
  return data;
}

export async function createTimesheetEntry(values: TimesheetEntryFormValues): Promise<TimesheetEntry> {
  const { data } = await apiClient.post<TimesheetEntry>("/timesheet/entries", values);
  return data;
}

export async function updateTimesheetEntry(id: number, values: TimesheetEntryFormValues): Promise<void> {
  await apiClient.put(`/timesheet/entries/${id}`, values);
}

export async function deleteTimesheetEntry(id: number): Promise<void> {
  await apiClient.delete(`/timesheet/entries/${id}`);
}

export async function reviewTimesheet(timesheetId: number, values: ReviewFormValues): Promise<void> {
  await apiClient.put(`/timesheet/${timesheetId}/review`, values);
}

export async function submitTimesheetWeek(weekStart: string): Promise<{ submittedCount: number }> {
  const { data } = await apiClient.put<{ submittedCount: number }>("/timesheet/entries/submit-week", { weekStart });
  return data;
}
