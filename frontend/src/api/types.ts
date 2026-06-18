export interface OrgTreeNode {
  id: number;
  fullName: string;
  title: string;
  company: string;
  avatarUrl?: string | null;
  department: string;
  departmentColor: string;
  totalReportCount: number;
  children: OrgTreeNode[];
}

export interface Department {
  id: number;
  name: string;
  colorHex: string;
  employeeCount: number;
}

export interface Employee {
  id: number;
  fullName: string;
  title: string;
  company: string;
  avatarUrl?: string | null;
  managerId?: number | null;
  managerName?: string | null;
  departmentId: number;
  department: string;
}

export interface ManagerOption {
  id: number;
  fullName: string;
  title: string;
}

export interface EmployeeFormValues {
  fullName: string;
  title: string;
  company: string;
  avatarUrl?: string;
  managerId: number | null;
  departmentId: number | null;
}

export interface Settings {
  mode: string;
  hrPortalApiUrl?: string;
  hrPortalApiAuthHeaderName?: string;
  hrPortalApiAuthHeaderValue?: string;
  jiraApiUrl?: string;
  jiraUserEmail?: string;
  jiraApiToken?: string;
  idField: string;
  fullNameField: string;
  titleField: string;
  companyField: string;
  avatarUrlField: string;
  managerIdField: string;
  departmentIdField: string;
  departmentNameField: string;
  departmentColorField: string;
  supportsWrites: boolean;
}

export interface UpdateSettingsRequest {
  mode: string;
  hrPortalApiUrl?: string;
  hrPortalApiAuthHeaderName?: string;
  hrPortalApiAuthHeaderValue?: string;
  jiraApiUrl?: string;
  jiraUserEmail?: string;
  jiraApiToken?: string;
  idField: string;
  fullNameField: string;
  titleField: string;
  companyField: string;
  avatarUrlField: string;
  managerIdField: string;
  departmentIdField: string;
  departmentNameField: string;
  departmentColorField: string;
}

export interface TestConnectionRequest {
  apiUrl: string;
  authHeaderName?: string;
  authHeaderValue?: string;
  idField: string;
  fullNameField: string;
  titleField: string;
  companyField: string;
  avatarUrlField: string;
  managerIdField: string;
  departmentIdField: string;
  departmentNameField: string;
  departmentColorField: string;
}

export interface EmployeePreview {
  id: number;
  fullName: string;
  title: string;
  company: string;
  managerId?: number | null;
  departmentId: number;
  departmentName: string;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  employeeCount: number;
  sampleEmployees: EmployeePreview[];
  validationErrors: string[];
}

export interface JiraProject {
  id: number;
  key: string;
  name: string;
}

export interface JiraSprint {
  id: number;
  name: string;
  state: string;
  boardId: number;
}

export interface JiraIssue {
  id: number;
  key: string;
  summary: string;
  status: string;
  assignee: string;
  priority: string;
  description: string;
  expectedTime: string;
  actualTime: string;
  sprintId?: number | null;
  projectId: number;
  projectName: string;
  projectKey: string;
  sprintName: string;
}

export interface JiraDashboardData {
  projects: JiraProject[];
  sprints: JiraSprint[];
  issues: JiraIssue[];
}

export interface TestJiraConnectionRequest {
  apiUrl: string;
  userEmail?: string;
  apiToken?: string;
}

export interface TestJiraConnectionResult {
  success: boolean;
  message: string;
  projectCount: number;
  sprintCount: number;
  issueCount: number;
  sampleIssues: Partial<JiraIssue>[];
  validationErrors: string[];
}

export interface JiraImportResult {
  success: boolean;
  message: string;
  importedCount: number;
}

export interface UpdateJiraIssueRequest {
  summary: string;
  status: string;
  assignee: string;
  priority: string;
  description: string;
  expectedTime: string;
  actualTime: string;
  projectId: number;
  sprintId?: number | null;
}

export interface BulkImportEmployee {
  id: string;
  fullName: string;
  title: string;
  company: string;
  avatarUrl?: string | null;
  managerId?: string | null;
  departmentName: string;
  departmentColor?: string | null;
}

export interface BulkImportResult {
  success: boolean;
  message: string;
  importedCount: number;
}

