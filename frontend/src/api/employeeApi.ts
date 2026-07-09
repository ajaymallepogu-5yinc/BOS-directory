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

export async function createEmployee(values: EmployeeFormValues): Promise<Employee> {
  const { data } = await apiClient.post<Employee>("/employees", values);
  return data;
}

export async function updateEmployee(id: number, values: EmployeeFormValues): Promise<void> {
  await apiClient.put(`/employees/${id}`, values);
}

export async function updateEmployeeManager(id: number, managerId: number | null): Promise<void> {
  await apiClient.put(`/employees/${id}/manager`, { managerId });
}

export async function deleteEmployee(id: number): Promise<void> {
  await apiClient.delete(`/employees/${id}`);
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
