import { apiClient } from "./client";
import type {
  Department,
  Employee,
  EmployeeFormValues,
  ManagerOption,
  OrgTreeNode,
  BulkImportEmployee,
  BulkImportResult,
} from "./types";

export async function fetchCompanyTree(): Promise<OrgTreeNode[]> {
  const { data } = await apiClient.get<OrgTreeNode[]>("/tree/company");
  return data;
}

export async function fetchDepartmentTree(departmentId: number): Promise<OrgTreeNode[]> {
  const { data } = await apiClient.get<OrgTreeNode[]>(`/tree/department/${departmentId}`);
  return data;
}

export async function fetchDepartments(): Promise<Department[]> {
  const { data } = await apiClient.get<Department[]>("/departments");
  return data;
}

export async function fetchEmployees(): Promise<Employee[]> {
  const { data } = await apiClient.get<Employee[]>("/employees");
  return data;
}

export async function fetchManagerOptions(): Promise<ManagerOption[]> {
  const { data } = await apiClient.get<ManagerOption[]>("/employees/managers");
  return data;
}

// Blank optional fields must go as undefined, not "" - .NET's [EmailAddress] validator (on
// HRMSEmail) treats null as "not provided" but rejects an empty string as an invalid address.
function normalizeEmployeeValues(values: EmployeeFormValues): EmployeeFormValues {
  return {
    ...values,
    avatarUrl: values.avatarUrl?.trim() || undefined,
    hrmsEmail: values.hrmsEmail?.trim() || undefined,
    cardColor: values.cardColor?.trim() || undefined
  };
}

export async function createEmployee(values: EmployeeFormValues): Promise<Employee> {
  const { data } = await apiClient.post<Employee>("/employees", normalizeEmployeeValues(values));
  return data;
}

export async function updateEmployee(id: number, values: EmployeeFormValues): Promise<void> {
  await apiClient.put(`/employees/${id}`, normalizeEmployeeValues(values));
}

export async function updateEmployeeManager(id: number, managerId: number | null): Promise<void> {
  await apiClient.put(`/employees/${id}/manager`, { managerId });
}

export async function deleteEmployee(id: number, reassignManagerId?: number | null): Promise<void> {
  await apiClient.delete(`/employees/${id}`, { params: { reassignManagerId: reassignManagerId ?? undefined } });
}

export async function updateEmployeeAdminRole(id: number, isAdmin: boolean): Promise<{ isAdmin: boolean }> {
  const { data } = await apiClient.put<{ isAdmin: boolean }>(`/employees/${id}/admin-role`, { isAdmin });
  return data;
}

export async function importBulkEmployees(employees: BulkImportEmployee[]): Promise<BulkImportResult> {
  const { data } = await apiClient.post<BulkImportResult>("/employees/import-bulk", { employees });
  return data;
}

export async function fetchFunctionalTree(): Promise<OrgTreeNode[]> {
  const { data } = await apiClient.get<OrgTreeNode[]>("/tree/company?type=Functional");
  return data;
}
