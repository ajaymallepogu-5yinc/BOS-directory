import { useEffect, useState } from "react";
import {
  createEmployee,
  deleteEmployee,
  fetchDepartments,
  fetchEmployees,
  fetchManagerOptions,
  updateEmployee,
} from "../api/employeeApi";
import { fetchSettings, saveSettings, testSettings, importSettings } from "../api/settingsApi";
import { testJiraConnection, importJiraData } from "../api/jiraApi";
import type { Department, Employee, EmployeeFormValues, ManagerOption, TestConnectionResult, TestJiraConnectionResult } from "../api/types";
import EmployeeFormDrawer from "../components/Admin/EmployeeFormDrawer";
import EmployeeTable from "../components/Admin/EmployeeTable";

export default function AdminPage() {
  // Navigation & General state
  const [activeTab, setActiveTab] = useState<"employees" | "datasource" | "jira">("employees");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Settings State
  const [apiUrl, setApiUrl] = useState<string>("");
  const [authHeaderName, setAuthHeaderName] = useState<string>("");
  const [authHeaderValue, setAuthHeaderValue] = useState<string>("");

  // Jira Settings State
  const [jiraApiUrl, setJiraApiUrl] = useState<string>("");
  const [jiraUserEmail, setJiraUserEmail] = useState<string>("");
  const [jiraApiToken, setJiraApiToken] = useState<string>("");
  const [jiraTesting, setJiraTesting] = useState(false);
  const [jiraTestResult, setJiraTestResult] = useState<TestJiraConnectionResult | null>(null);
  const [jiraSaving, setJiraSaving] = useState(false);

  // Mapping keys state
  const [idField, setIdField] = useState<string>("id");
  const [fullNameField, setFullNameField] = useState<string>("fullName");
  const [titleField, setTitleField] = useState<string>("title");
  const [companyField, setCompanyField] = useState<string>("company");
  const [avatarUrlField, setAvatarUrlField] = useState<string>("avatarUrl");
  const [managerIdField, setManagerIdField] = useState<string>("managerId");
  const [departmentIdField, setDepartmentIdField] = useState<string>("departmentId");
  const [departmentNameField, setDepartmentNameField] = useState<string>("departmentName");
  const [departmentColorField, setDepartmentColorField] = useState<string>("departmentColor");

  // Settings testing/saving/importing state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccessMessage, setSettingsSuccessMessage] = useState<string | null>(null);

  async function loadSettings() {
    try {
      const s = await fetchSettings();
      setApiUrl(s.hrPortalApiUrl ?? "");
      setAuthHeaderName(s.hrPortalApiAuthHeaderName ?? "");
      setAuthHeaderValue(s.hrPortalApiAuthHeaderValue ?? "");
      setJiraApiUrl(s.jiraApiUrl ?? "");
      setJiraUserEmail(s.jiraUserEmail ?? "");
      setJiraApiToken(s.jiraApiToken ?? "");
      setIdField(s.idField);
      setFullNameField(s.fullNameField);
      setTitleField(s.titleField);
      setCompanyField(s.companyField);
      setAvatarUrlField(s.avatarUrlField);
      setManagerIdField(s.managerIdField);
      setDepartmentIdField(s.departmentIdField);
      setDepartmentNameField(s.departmentNameField);
      setDepartmentColorField(s.departmentColorField);
    } catch (err) {
      console.error("Error fetching data source settings:", err);
    }
  }

  async function reload() {
    setErrorMessage(null);
    try {
      const [emps, depts, mgrs] = await Promise.all([
        fetchEmployees(),
        fetchDepartments(),
        fetchManagerOptions(),
      ]);
      setEmployees(emps);
      setDepartments(depts);
      setManagers(mgrs);
    } catch (err: any) {
      console.error("Error reloading employees list:", err);
      setEmployees([]);
      setErrorMessage("Could not load employee records. Please ensure your local database is online.");
    }
  }

  useEffect(() => {
    async function init() {
      await loadSettings();
      await reload();
    }
    init();
  }, []);

  async function handleSubmit(values: EmployeeFormValues) {
    setErrorMessage(null);
    try {
      if (editing) {
        await updateEmployee(editing.id, values);
      } else {
        await createEmployee(values);
      }
      await reload();
    } catch (err: any) {
      setErrorMessage("Something went wrong saving that employee.");
      throw err;
    }
  }

  async function handleDelete(employee: Employee) {
    if (!confirm(`Remove ${employee.fullName}? Their direct reports will be re-assigned to ${employee.managerName ?? "the top of the org"}.`)) {
      return;
    }
    try {
      await deleteEmployee(employee.id);
      await reload();
    } catch (err: any) {
      setErrorMessage("Could not delete employee record.");
    }
  }



  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testSettings({
        apiUrl,
        authHeaderName,
        authHeaderValue,
        idField,
        fullNameField,
        titleField,
        companyField,
        avatarUrlField,
        managerIdField,
        departmentIdField,
        departmentNameField,
        departmentColorField
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message ?? "Connection request failed.",
        employeeCount: 0,
        sampleEmployees: [],
        validationErrors: ["API Request could not be sent. Check network connection or CORS settings on the API server."]
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleImportData() {
    const confirmImport = confirm(
      "WARNING: Importing from the HR portal will clear ALL current employees and departments in this application and replace them with the imported records.\n\nThis action cannot be undone. Do you want to proceed?"
    );
    if (!confirmImport) return;

    setSavingSettings(true);
    setSettingsSuccessMessage(null);
    try {
      // First save settings so mapping preferences are preserved
      await saveSettings({
        mode: "Local",
        hrPortalApiUrl: apiUrl,
        hrPortalApiAuthHeaderName: authHeaderName,
        hrPortalApiAuthHeaderValue: authHeaderValue,
        jiraApiUrl,
        jiraUserEmail,
        jiraApiToken,
        idField,
        fullNameField,
        titleField,
        companyField,
        avatarUrlField,
        managerIdField,
        departmentIdField,
        departmentNameField,
        departmentColorField
      });

      // Then trigger backend import
      const res = await importSettings({
        apiUrl,
        authHeaderName,
        authHeaderValue,
        idField,
        fullNameField,
        titleField,
        companyField,
        avatarUrlField,
        managerIdField,
        departmentIdField,
        departmentNameField,
        departmentColorField
      });

      if (res.success) {
        alert(res.message);
        setActiveTab("employees");
        await reload();
      } else {
        alert("Import failed: " + res.message);
      }
    } catch (err: any) {
      alert("Import request failed: " + (err.message ?? "unknown error"));
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleSaveConfigOnly() {
    setSavingSettings(true);
    setSettingsSuccessMessage(null);
    try {
      await saveSettings({
        mode: "Local",
        hrPortalApiUrl: apiUrl,
        hrPortalApiAuthHeaderName: authHeaderName,
        hrPortalApiAuthHeaderValue: authHeaderValue,
        jiraApiUrl,
        jiraUserEmail,
        jiraApiToken,
        idField,
        fullNameField,
        titleField,
        companyField,
        avatarUrlField,
        managerIdField,
        departmentIdField,
        departmentNameField,
        departmentColorField
      });
      setSettingsSuccessMessage("API Configuration preferences saved!");
      setTimeout(() => setSettingsSuccessMessage(null), 3000);
    } catch (err: any) {
      alert("Failed to save configuration: " + (err.message ?? "unknown error"));
    } finally {
      setSavingSettings(false);
    }
  }

  // Jira Handler Methods
  const handleLoadJiraMockPreset = () => {
    setJiraApiUrl("http://localhost:5226/api/mock-jira/data");
    setJiraUserEmail("admin@company.com");
    setJiraApiToken("mock-jira-token-abcde");
  };

  const handleTestJiraConnection = async () => {
    setJiraTesting(true);
    setJiraTestResult(null);
    try {
      const res = await testJiraConnection({
        apiUrl: jiraApiUrl,
        userEmail: jiraUserEmail,
        apiToken: jiraApiToken
      });
      setJiraTestResult(res);
    } catch (err: any) {
      setJiraTestResult({
        success: false,
        message: err.message ?? "Jira connection request failed.",
        projectCount: 0,
        sprintCount: 0,
        issueCount: 0,
        sampleIssues: [],
        validationErrors: ["Could not send request to Jira API server. Verify network connection and configuration."]
      });
    } finally {
      setJiraTesting(false);
    }
  };

  const handleSaveJiraConfigOnly = async () => {
    setJiraSaving(true);
    setSettingsSuccessMessage(null);
    try {
      await saveSettings({
        mode: "Local",
        hrPortalApiUrl: apiUrl,
        hrPortalApiAuthHeaderName: authHeaderName,
        hrPortalApiAuthHeaderValue: authHeaderValue,
        jiraApiUrl,
        jiraUserEmail,
        jiraApiToken,
        idField,
        fullNameField,
        titleField,
        companyField,
        avatarUrlField,
        managerIdField,
        departmentIdField,
        departmentNameField,
        departmentColorField
      });
      setSettingsSuccessMessage("Jira configuration saved successfully!");
      setTimeout(() => setSettingsSuccessMessage(null), 3000);
    } catch (err: any) {
      alert("Failed to save Jira configuration: " + (err.message ?? "unknown error"));
    } finally {
      setJiraSaving(false);
    }
  };

  const handleImportJiraData = async () => {
    const confirmImport = confirm(
      "WARNING: Importing from Jira will clear ALL local Jira projects, sprints, and issues, and replace them with the imported records.\n\nThis action cannot be undone. Do you want to proceed?"
    );
    if (!confirmImport) return;

    setJiraSaving(true);
    try {
      const res = await importJiraData({
        apiUrl: jiraApiUrl,
        userEmail: jiraUserEmail,
        apiToken: jiraApiToken
      });

      if (res.success) {
        alert(res.message);
        setSettingsSuccessMessage("Jira data imported successfully!");
        setTimeout(() => setSettingsSuccessMessage(null), 3000);
      } else {
        alert("Import failed: " + res.message);
      }
    } catch (err: any) {
      alert("Import request failed: " + (err.message ?? "unknown error"));
    } finally {
      setJiraSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 py-6 bg-ink-50/30">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-lg font-bold text-ink-900">Admin Console</h1>
          <p className="text-xs text-ink-400">Manage employee directories manually or fetch and import records dynamically from Keka.</p>
        </div>
        {activeTab === "employees" && (
          <button
            onClick={() => {
              setEditing(null);
              setDrawerOpen(true);
            }}
            className="btn-primary"
          >
            + Add employee
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex border-b border-ink-200">
        <button
          onClick={() => setActiveTab("employees")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "employees"
              ? "border-brand text-brand"
              : "border-transparent text-ink-500 hover:text-ink-700"
          }`}
        >
          Manage Employees
        </button>
        <button
          onClick={() => setActiveTab("datasource")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "datasource"
              ? "border-brand text-brand"
              : "border-transparent text-ink-500 hover:text-ink-700"
          }`}
        >
          Fetch from Keka
        </button>
        <button
          onClick={() => setActiveTab("jira")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "jira"
              ? "border-brand text-brand"
              : "border-transparent text-ink-500 hover:text-ink-700"
          }`}
        >
          Fetch from Jira
        </button>
      </div>

      {/* Tab 1: Employees List (Always fully editable) */}
      {activeTab === "employees" && (
        <div className="flex-1 flex flex-col min-h-0">
          {errorMessage && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
              {errorMessage}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-auto">
            <EmployeeTable
              employees={employees}
              readOnly={false}
              onEdit={(emp) => {
                setEditing(emp);
                setDrawerOpen(true);
              }}
              onDelete={handleDelete}
            />
          </div>

          <EmployeeFormDrawer
            open={drawerOpen}
            initial={editing}
            departments={departments}
            managerOptions={managers}
            onClose={() => setDrawerOpen(false)}
            onSubmit={handleSubmit}
          />
        </div>
      )}

      {/* Tab 2: Keka Data Import settings */}
      {activeTab === "datasource" && (
        <div className="max-w-4xl flex flex-col gap-6">
          {settingsSuccessMessage && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-xs font-semibold text-green-800">
              ✓ {settingsSuccessMessage}
            </div>
          )}

          {/* API Credentials Card */}
          <div className="bg-white border border-ink-200 rounded-xl p-6 shadow-sm flex flex-col gap-5">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-display font-bold text-sm text-ink-900">Configure Keka Portal Sync</h3>
                <p className="text-[11px] text-ink-400 mt-0.5">Configure your Keka API endpoint URL and credentials to fetch and import directories.</p>
              </div>
            </div>

            {/* Endpoint configuration */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-ink-500">API Endpoint URL</label>
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://api.keka.com/api/v1/hris/employees"
                  className="mt-1 block w-full rounded-lg border border-ink-300 px-3 py-2 text-xs text-ink-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand font-mono"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-ink-500">Authorization Header Name (Optional)</label>
                  <input
                    type="text"
                    value={authHeaderName}
                    onChange={(e) => setAuthHeaderName(e.target.value)}
                    placeholder="Authorization"
                    className="mt-1 block w-full rounded-lg border border-ink-300 px-3 py-2 text-xs text-ink-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-ink-500">Header Value / Token (Optional)</label>
                  <input
                    type="text"
                    value={authHeaderValue}
                    onChange={(e) => setAuthHeaderValue(e.target.value)}
                    placeholder="Bearer keka-token-value"
                    className="mt-1 block w-full rounded-lg border border-ink-300 px-3 py-2 text-xs text-ink-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Mappings Configuration */}
            <div className="border-t border-ink-100 pt-4 mt-2">
              <h4 className="font-semibold text-xs text-ink-800 mb-3">JSON Field Key Mappings</h4>
              <p className="text-[10px] text-ink-400 mb-4">
                Define the JSON properties mapping to create the tree. Dot notation is supported for nested properties (e.g. <code className="font-mono bg-ink-100 px-1 py-0.5 rounded text-[10px]">reportsTo.id</code>).
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-semibold text-ink-500">Employee ID Key (Required)</label>
                  <input
                    type="text"
                    value={idField}
                    onChange={(e) => setIdField(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-ink-300 px-3 py-1.5 text-xs text-ink-900 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-ink-500">Full Name Key (Required)</label>
                  <input
                    type="text"
                    value={fullNameField}
                    onChange={(e) => setFullNameField(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-ink-300 px-3 py-1.5 text-xs text-ink-900 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-ink-500">Job Title Key</label>
                  <input
                    type="text"
                    value={titleField}
                    onChange={(e) => setTitleField(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-ink-300 px-3 py-1.5 text-xs text-ink-900 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-ink-500">Company Name Key</label>
                  <input
                    type="text"
                    value={companyField}
                    onChange={(e) => setCompanyField(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-ink-300 px-3 py-1.5 text-xs text-ink-900 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-ink-500">Avatar URL Key</label>
                  <input
                    type="text"
                    value={avatarUrlField}
                    onChange={(e) => setAvatarUrlField(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-ink-300 px-3 py-1.5 text-xs text-ink-900 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-ink-500">Manager ID Key (Nested supported)</label>
                  <input
                    type="text"
                    value={managerIdField}
                    onChange={(e) => setManagerIdField(e.target.value)}
                    placeholder="reportsTo.id"
                    className="mt-1 block w-full rounded-lg border border-ink-300 px-3 py-1.5 text-xs text-ink-900 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-ink-500">Department ID Key (Optional)</label>
                  <input
                    type="text"
                    value={departmentIdField}
                    onChange={(e) => setDepartmentIdField(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-ink-300 px-3 py-1.5 text-xs text-ink-900 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-ink-500">Department Name Key (Required)</label>
                  <input
                    type="text"
                    value={departmentNameField}
                    onChange={(e) => setDepartmentNameField(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-ink-300 px-3 py-1.5 text-xs text-ink-900 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-ink-500">Department Color Key</label>
                  <input
                    type="text"
                    value={departmentColorField}
                    onChange={(e) => setDepartmentColorField(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-ink-300 px-3 py-1.5 text-xs text-ink-900 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="border-t border-ink-100 pt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleSaveConfigOnly}
                disabled={savingSettings || testing}
                className="px-4 py-2 border border-ink-300 rounded-lg text-xs font-semibold text-ink-700 hover:bg-ink-50 transition-colors disabled:opacity-50"
              >
                Save Configuration Only
              </button>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="px-4 py-2 border border-ink-300 rounded-lg text-xs font-semibold text-ink-700 hover:bg-ink-50 transition-colors disabled:opacity-50 bg-ink-50"
              >
                {testing ? "Testing..." : "Test Connection & Query"}
              </button>
            </div>
          </div>

          {/* Test connection results output */}
          {testResult && (
            <div className={`border rounded-xl p-6 shadow-sm ${
              testResult.success ? "bg-green-50/20 border-green-200" : "bg-red-50/20 border-red-200"
            }`}>
              <h4 className={`font-display font-bold text-xs mb-3 ${
                testResult.success ? "text-green-800" : "text-red-800"
              }`}>
                {testResult.success ? "✓ Test Connection Succeeded" : "✗ Test Connection Failed"}
              </h4>
              <p className="text-[11px] text-ink-700 mb-4">{testResult.message}</p>

              {/* Validation warnings list */}
              {testResult.validationErrors.length > 0 && (
                <div className="mb-4 bg-white border border-amber-200 p-3 rounded-lg flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-amber-800">Hierarchy & Mapping Warnings:</span>
                  {testResult.validationErrors.map((err, i) => (
                    <p key={i} className="text-[10px] text-amber-700 font-medium">⚠️ {err}</p>
                  ))}
                </div>
              )}

              {/* Preview data table */}
              {testResult.sampleEmployees.length > 0 && (
                <div className="bg-white border border-ink-200 rounded-lg overflow-hidden">
                  <div className="bg-ink-50/50 px-3 py-2 border-b border-ink-200">
                    <span className="text-[10px] font-semibold text-ink-600">Sample Employee Records Found ({testResult.employeeCount} total)</span>
                  </div>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-ink-50/30 text-[10px] text-ink-400 border-b border-ink-200 font-semibold">
                        <th className="px-3 py-1.5">ID (Parsed)</th>
                        <th className="px-3 py-1.5">Full Name</th>
                        <th className="px-3 py-1.5">Job Title</th>
                        <th className="px-3 py-1.5">Reports To ID</th>
                        <th className="px-3 py-1.5">Department Name</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100 text-[10px] text-ink-700">
                      {testResult.sampleEmployees.map((emp) => (
                        <tr key={emp.id}>
                          <td className="px-3 py-1.5 font-mono">{emp.id}</td>
                          <td className="px-3 py-1.5 font-semibold">{emp.fullName}</td>
                          <td className="px-3 py-1.5">{emp.title}</td>
                          <td className="px-3 py-1.5 font-mono">{emp.managerId ?? "CEO (NULL)"}</td>
                          <td className="px-3 py-1.5">{emp.departmentName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Form Actions (Save settings & Import data) */}
          <div className="flex justify-end pt-2 border-t border-ink-200">
            <button
              onClick={handleImportData}
              disabled={savingSettings || !apiUrl}
              className="btn-primary flex items-center gap-2"
            >
              {savingSettings ? "Importing Data..." : "Import into Local Database"}
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Jira Data Import settings */}
      {activeTab === "jira" && (
        <div className="max-w-4xl flex flex-col gap-6">
          {settingsSuccessMessage && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-xs font-semibold text-green-800">
              ✓ {settingsSuccessMessage}
            </div>
          )}

          {/* API Credentials Card */}
          <div className="bg-white border border-ink-200 rounded-xl p-6 shadow-sm flex flex-col gap-5">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-display font-bold text-sm text-ink-900">Configure Jira Integration</h3>
                <p className="text-[11px] text-ink-400 mt-0.5">Configure your Jira Agile endpoint URL and Atlassian credentials to fetch projects and issues.</p>
              </div>
              <button
                type="button"
                onClick={handleLoadJiraMockPreset}
                className="rounded-lg border border-brand/20 bg-brand/5 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/10 transition-colors"
              >
                Load Mock Preset
              </button>
            </div>

            {/* Endpoint configuration */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-ink-500">Jira API Endpoint URL</label>
                <input
                  type="text"
                  value={jiraApiUrl}
                  onChange={(e) => setJiraApiUrl(e.target.value)}
                  placeholder="https://your-domain.atlassian.net/rest/agile/1.0/board"
                  className="mt-1 block w-full rounded-lg border border-ink-300 px-3 py-2 text-xs text-ink-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand font-mono"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-ink-500">Atlassian User Email</label>
                  <input
                    type="email"
                    value={jiraUserEmail}
                    onChange={(e) => setJiraUserEmail(e.target.value)}
                    placeholder="user@company.com"
                    className="mt-1 block w-full rounded-lg border border-ink-300 px-3 py-2 text-xs text-ink-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-ink-500">Atlassian API Token (Not password)</label>
                  <input
                    type="password"
                    value={jiraApiToken}
                    onChange={(e) => setJiraApiToken(e.target.value)}
                    placeholder="••••••••••••••••••••"
                    className="mt-1 block w-full rounded-lg border border-ink-300 px-3 py-2 text-xs text-ink-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="border-t border-ink-100 pt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleSaveJiraConfigOnly}
                disabled={jiraSaving || jiraTesting}
                className="px-4 py-2 border border-ink-300 rounded-lg text-xs font-semibold text-ink-700 hover:bg-ink-50 transition-colors disabled:opacity-50"
              >
                Save Configuration Only
              </button>
              <button
                type="button"
                onClick={handleTestJiraConnection}
                disabled={jiraTesting}
                className="px-4 py-2 border border-ink-300 rounded-lg text-xs font-semibold text-ink-700 hover:bg-ink-50 transition-colors disabled:opacity-50 bg-ink-50"
              >
                {jiraTesting ? "Testing..." : "Test Connection & Query"}
              </button>
            </div>
          </div>

          {/* Test connection results output */}
          {jiraTestResult && (
            <div className={`border rounded-xl p-6 shadow-sm ${
              jiraTestResult.success ? "bg-green-50/20 border-green-200" : "bg-red-50/20 border-red-200"
            }`}>
              <h4 className={`font-display font-bold text-xs mb-3 ${
                jiraTestResult.success ? "text-green-800" : "text-red-800"
              }`}>
                {jiraTestResult.success ? "✓ Test Connection Succeeded" : "✗ Test Connection Failed"}
              </h4>
              <p className="text-[11px] text-ink-700 mb-4">{jiraTestResult.message}</p>

              {/* Validation warnings list */}
              {jiraTestResult.validationErrors.length > 0 && (
                <div className="mb-4 bg-white border border-amber-200 p-3 rounded-lg flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-amber-800">Errors & Warnings:</span>
                  {jiraTestResult.validationErrors.map((err, i) => (
                    <p key={i} className="text-[10px] text-amber-700 font-medium">⚠️ {err}</p>
                  ))}
                </div>
              )}

              {/* Summary of parsed objects */}
              {jiraTestResult.success && (
                <div className="mb-4 text-xs text-ink-600 flex flex-col gap-1">
                  <p>Projects Parsed: <span className="font-bold text-ink-800">{jiraTestResult.projectCount}</span></p>
                  <p>Active Sprints Parsed: <span className="font-bold text-ink-800">{jiraTestResult.sprintCount}</span></p>
                  <p>Total Issues Parsed: <span className="font-bold text-ink-800">{jiraTestResult.issueCount}</span></p>
                </div>
              )}

              {/* Preview data table */}
              {jiraTestResult.sampleIssues.length > 0 && (
                <div className="bg-white border border-ink-200 rounded-lg overflow-hidden">
                  <div className="bg-ink-50/50 px-3 py-2 border-b border-ink-200">
                    <span className="text-[10px] font-semibold text-ink-600">Sample Issues Found</span>
                  </div>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-ink-50/30 text-[10px] text-ink-400 border-b border-ink-200 font-semibold">
                        <th className="px-3 py-1.5">Key</th>
                        <th className="px-3 py-1.5">Summary</th>
                        <th className="px-3 py-1.5">Assignee</th>
                        <th className="px-3 py-1.5">Priority</th>
                        <th className="px-3 py-1.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100 text-[10px] text-ink-700">
                      {jiraTestResult.sampleIssues.map((issue) => (
                        <tr key={issue.key}>
                          <td className="px-3 py-1.5 font-mono font-semibold text-brand">{issue.key}</td>
                          <td className="px-3 py-1.5 font-medium">{issue.summary}</td>
                          <td className="px-3 py-1.5">{issue.assignee || "Unassigned"}</td>
                          <td className="px-3 py-1.5 font-medium">{issue.priority}</td>
                          <td className="px-3 py-1.5">{issue.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Form Actions (Save settings & Import data) */}
          <div className="flex justify-end pt-2 border-t border-ink-200">
            <button
              onClick={handleImportJiraData}
              disabled={jiraSaving || !jiraApiUrl}
              className="btn-primary flex items-center gap-2"
            >
              {jiraSaving ? "Importing Jira Data..." : "Import into Local Database"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
