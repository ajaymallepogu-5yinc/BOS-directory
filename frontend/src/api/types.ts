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
  appEmail: string;
  hrmsEmail?: string | null;
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
  appEmail: string;
  hrmsEmail?: string;
}

export interface Settings {
  mode: string;
  hrPortalApiUrl?: string;
  hrPortalApiAuthHeaderName?: string;
  hrPortalApiAuthHeaderValue?: string;

  idField: string;
  fullNameField: string;
  titleField: string;
  companyField: string;
  avatarUrlField: string;
  managerIdField: string;
  departmentIdField: string;
  departmentNameField: string;
  departmentColorField: string;
  appEmailField: string;
  hrmsEmailField: string;
  supportsWrites: boolean;
}

export interface UpdateSettingsRequest {
  mode: string;
  hrPortalApiUrl?: string;
  hrPortalApiAuthHeaderName?: string;
  hrPortalApiAuthHeaderValue?: string;

  idField: string;
  fullNameField: string;
  titleField: string;
  companyField: string;
  avatarUrlField: string;
  managerIdField: string;
  departmentIdField: string;
  departmentNameField: string;
  departmentColorField: string;
  appEmailField: string;
  hrmsEmailField: string;
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
  appEmailField: string;
  hrmsEmailField: string;
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



export interface BulkImportEmployee {
  id: string;
  fullName: string;
  title: string;
  company: string;
  avatarUrl?: string | null;
  managerId?: string | null;
  departmentName: string;
  departmentColor?: string | null;
  appEmail?: string | null;
  hrmsEmail?: string | null;
}

export interface BulkImportResult {
  success: boolean;
  message: string;
  importedCount: number;
}

export interface CareerLevel {
  level: number;
  title: string;
  description: string;
  requirements: string;
  parentTitle?: string | null;
}

export interface CareerTrack {
  trackName: string;
  description: string;
  levels: CareerLevel[];
}

export interface EmployeeCareerMapping {
  employeeId: number;
  fullName: string;
  title: string;
  avatarUrl?: string | null;
  trackName: string;
  currentLevel: number;
  careerPath: CareerLevel[];
}

