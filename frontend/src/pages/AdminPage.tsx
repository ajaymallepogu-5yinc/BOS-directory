import { useEffect, useState, useRef } from "react";
import {
  createEmployee,
  deleteEmployee,
  fetchDepartments,
  fetchEmployees,
  fetchManagerOptions,
  updateEmployee,
  updateEmployeeAdminRole,
  importBulkEmployees,
} from "../api/employeeApi";
import { fetchSettings, saveSettings, testSettings, importSettings } from "../api/settingsApi";
import type { Department, Employee, EmployeeFormValues, ManagerOption, TestConnectionResult, BulkImportEmployee } from "../api/types";
import EmployeeFormDrawer, { CustomSelect } from "../components/Admin/EmployeeFormDrawer";
import EmployeeTable from "../components/Admin/EmployeeTable";
import { useAuth } from "../context/AuthContext";
import ConfirmModal from "../components/Layout/ConfirmModal";

// Backend error bodies aren't always a plain string or {message} - ASP.NET Core's [ApiController]
// auto-validation returns {errors: {Field: ["reason"]}} instead, with no top-level message. Always
// resolves to a string (or null) so it's never unsafe to pass straight into React as text.
function extractErrorMessage(err: any): string | null {
  const data = err?.response?.data;
  if (typeof data === "string") return data;
  if (typeof data?.message === "string") return data.message;
  if (data?.errors && typeof data.errors === "object") {
    return Object.values(data.errors).flat().join(" ");
  }
  return null;
}

export default function AdminPage() {
  const { user } = useAuth();
  // Navigation & General state
  const [activeTab, setActiveTab] = useState<"employees" | "datasource">("employees");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function showSuccess(message: string) {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 4000);
  }

  // Reusable confirmation state
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  // Delete-with-direct-reports state - asks who should manage the orphaned reports instead of
  // silently re-assigning them (see AdminPage delete flow below).
  const [reassignModal, setReassignModal] = useState<{
    employee: Employee;
    directReports: Employee[];
    selectedManagerId: number | null;
  } | null>(null);

  // Settings State
  const [apiUrl, setApiUrl] = useState<string>("");
  const [authHeaderName, setAuthHeaderName] = useState<string>("");
  const [authHeaderValue, setAuthHeaderValue] = useState<string>("");



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
  const [appEmailField, setAppEmailField] = useState<string>("appEmail");
  const [hrmsEmailField, setHrmsEmailField] = useState<string>("hrmsEmail");

  // Settings testing/saving/importing state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccessMessage, setSettingsSuccessMessage] = useState<string | null>(null);
  const [csvParsedData, setCsvParsedData] = useState<BulkImportEmployee[]>([]);
  const [csvRawRows, setCsvRawRows] = useState<Record<string, string>[]>([]);
  const [csvValidationErrors, setCsvValidationErrors] = useState<string[]>([]);
  const [csvHeadersFound, setCsvHeadersFound] = useState<string[]>([]);
  const [importingCSV, setImportingCSV] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (csvRawRows.length === 0) {
      setCsvParsedData([]);
      setCsvValidationErrors([]);
      setCsvHeadersFound([]);
      return;
    }

    const headers = Object.keys(csvRawRows[0]);
    setCsvHeadersFound(headers);

    // Validate mappings
    const errors: string[] = [];
    if (idField && !headers.includes(idField)) {
      errors.push(`Employee ID Key: "${idField}"`);
    }
    if (fullNameField && !headers.includes(fullNameField)) {
      errors.push(`Full Name Key: "${fullNameField}"`);
    }
    if (titleField && !headers.includes(titleField)) {
      errors.push(`Job Title Key: "${titleField}"`);
    }
    if (appEmailField && !headers.includes(appEmailField)) {
      errors.push(`App Email Key: "${appEmailField}"`);
    }
    if (managerIdField) {
      const firstPart = managerIdField.split(".")[0];
      if (!headers.includes(managerIdField) && !headers.includes(firstPart)) {
        errors.push(`Manager ID Key: "${managerIdField}"`);
      }
    }
    if (departmentNameField && !headers.includes(departmentNameField)) {
      errors.push(`Department Name Key: "${departmentNameField}"`);
    }

    setCsvValidationErrors(errors);

    // Map the data
    const getNestedValue = (obj: any, path: string): string => {
      if (!obj || !path) return "";
      const keys = path.split(".");
      let val = obj;
      for (const key of keys) {
        val = val?.[key];
      }
      return val !== undefined && val !== null ? String(val) : "";
    };

    const mapped = csvRawRows.map((row) => ({
      id: getNestedValue(row, idField),
      fullName: getNestedValue(row, fullNameField),
      title: getNestedValue(row, titleField),
      company: getNestedValue(row, companyField),
      avatarUrl: getNestedValue(row, avatarUrlField),
      managerId: getNestedValue(row, managerIdField),
      departmentName: getNestedValue(row, departmentNameField),
      departmentColor: getNestedValue(row, departmentColorField),
      appEmail: getNestedValue(row, appEmailField),
      hrmsEmail: getNestedValue(row, hrmsEmailField)
    }));

    setCsvParsedData(mapped);
  }, [
    csvRawRows,
    idField,
    fullNameField,
    titleField,
    companyField,
    avatarUrlField,
    managerIdField,
    departmentNameField,
    departmentColorField,
    appEmailField,
    hrmsEmailField
  ]);

  async function loadSettings() {
    try {
      const s = await fetchSettings();
      setApiUrl(s.hrPortalApiUrl ?? "");
      setAuthHeaderName(s.hrPortalApiAuthHeaderName ?? "");
      setAuthHeaderValue(s.hrPortalApiAuthHeaderValue ?? "");

      setIdField(s.idField);
      setFullNameField(s.fullNameField);
      setTitleField(s.titleField);
      setCompanyField(s.companyField);
      setAvatarUrlField(s.avatarUrlField);
      setManagerIdField(s.managerIdField);
      setDepartmentIdField(s.departmentIdField);
      setDepartmentNameField(s.departmentNameField);
      setDepartmentColorField(s.departmentColorField);
      setAppEmailField(s.appEmailField ?? "appEmail");
      setHrmsEmailField(s.hrmsEmailField ?? "hrmsEmail");
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
      showSuccess(editing ? `Nice! ${values.fullName}'s details are all set.` : `Welcome aboard, ${values.fullName}!`);
    } catch (err: any) {
      setErrorMessage(extractErrorMessage(err) || "Something went wrong saving that employee.");
      throw err;
    }
  }

  async function handleToggleAdmin(employee: Employee) {
    const makingAdmin = !employee.isAdmin;
    setConfirmConfig({
      isOpen: true,
      title: makingAdmin ? "Grant Admin Access" : "Remove Admin Access",
      message: makingAdmin
        ? `Grant Admin access to ${employee.fullName}?`
        : `Remove Admin access from ${employee.fullName}?`,
      confirmLabel: makingAdmin ? "Grant" : "Remove",
      isDestructive: !makingAdmin,
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setErrorMessage(null);
        try {
          await updateEmployeeAdminRole(employee.id, makingAdmin);
          await reload();
          showSuccess(makingAdmin ? `${employee.fullName} just leveled up to Admin!` : `${employee.fullName}'s Admin access removed.`);
        } catch (err: any) {
          setErrorMessage(err.response?.data?.message || "Could not update that employee's Admin role.");
        }
      }
    });
  }

  async function handleDelete(employee: Employee) {
    const directReports = employees.filter((e) => e.managerId === employee.id);

    // Nothing to reassign - the plain confirm is enough.
    if (directReports.length === 0) {
      setConfirmConfig({
        isOpen: true,
        title: "Delete Employee",
        message: `Remove ${employee.fullName}? This action cannot be undone.`,
        confirmLabel: "Delete",
        isDestructive: true,
        onConfirm: async () => {
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          try {
            await deleteEmployee(employee.id);
            await reload();
            showSuccess(`Done! ${employee.fullName} has been removed.`);
          } catch (err: any) {
            setErrorMessage("Could not delete employee record.");
          }
        }
      });
      return;
    }

    // Has direct reports - ask who should manage them, defaulting to this employee's own manager.
    setReassignModal({
      employee,
      directReports,
      selectedManagerId: employee.managerId ?? null
    });
  }

  async function handleConfirmReassignAndDelete() {
    if (!reassignModal) return;
    const { employee, directReports, selectedManagerId } = reassignModal;
    setReassignModal(null);
    try {
      await deleteEmployee(employee.id, selectedManagerId);
      await reload();

      const promoted = directReports.find((r) => r.id === selectedManagerId);
      const remainingCount = directReports.length - (promoted ? 1 : 0);
      const remainingLabel = `${remainingCount} ${remainingCount === 1 ? "report" : "reports"}`;

      if (promoted) {
        showSuccess(`All set! ${promoted.fullName} just stepped up to manage ${remainingLabel}, and is now at the top of the org.`);
      } else {
        const newManagerName = managers.find((m) => m.id === selectedManagerId)?.fullName ?? "the top of the org";
        showSuccess(`All set! ${remainingLabel} reassigned to ${newManagerName}.`);
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || "Could not delete employee record.");
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
        departmentColorField,
        appEmailField,
        hrmsEmailField
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
    setConfirmConfig({
      isOpen: true,
      title: "Import from HR Portal",
      message: "WARNING: Importing from the HR portal will clear ALL current employees and departments in this application and replace them with the imported records. This action cannot be undone. Do you want to proceed?",
      confirmLabel: "Import",
      isDestructive: true,
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setSavingSettings(true);
        setSettingsSuccessMessage(null);
        try {
          // First save settings so mapping preferences are preserved
          await saveSettings({
            mode: "Local",
            hrPortalApiUrl: apiUrl,
            hrPortalApiAuthHeaderName: authHeaderName,
            hrPortalApiAuthHeaderValue: authHeaderValue,
            idField,
            fullNameField,
            titleField,
            companyField,
            avatarUrlField,
            managerIdField,
            departmentIdField,
            departmentNameField,
            departmentColorField,
            appEmailField,
            hrmsEmailField
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
            departmentColorField,
            appEmailField,
            hrmsEmailField
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
    });
  }

  const parseCSV = (text: string): Record<string, string>[] => {
    // Check if it's a binary Excel file or zip archive
    if (text.startsWith("PK\u0003\u0004") || text.includes("[Content_Types].xml") || text.includes("_rels/.rels")) {
      throw new Error("The selected file is an Excel spreadsheet (.xlsx) or zip archive, not a plain text CSV file.\n\nPlease open the file in Excel, select 'Save As', and export it as 'CSV (Comma delimited) (*.csv)' before uploading.");
    }

    // Strip UTF-8 BOM if present (common in Excel exports)
    if (text.startsWith("\ufeff")) {
      text = text.substring(1);
    }
    const lines = text.split(/\r?\n/);
    if (lines.length === 0 || !lines[0].trim()) return [];

    // Auto-detect delimiter
    const firstLine = lines[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;

    let delimiter = ",";
    if (tabCount > commaCount && tabCount > semicolonCount) {
      delimiter = "\t";
    } else if (semicolonCount > commaCount && semicolonCount > tabCount) {
      delimiter = ";";
    }

    const parseLine = (line: string) => {
      const result = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result.map(v => v.replace(/^"|"$/g, ""));
    };

    const headers = parseLine(lines[0]);
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = parseLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      data.push(row);
    }
    return data;
  };

  const handleCSVFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file extension
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (fileExt !== 'csv') {
      alert("Invalid file format. Please upload a plain text CSV (.csv) file.\n\nIf you are using Excel, click 'Save As' and select 'CSV (Comma delimited) (*.csv)'.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setCsvRawRows([]);
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      try {
        const parsedRows = parseCSV(text);
        setCsvRawRows(parsedRows);
      } catch (err: any) {
        alert(err.message);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        setCsvRawRows([]);
      }
    };
    reader.readAsText(file);
  };

  const handleClearCSV = () => {
    setCsvRawRows([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImportCSV = () => {
    setConfirmConfig({
      isOpen: true,
      title: "Import from CSV",
      message: "WARNING: Importing from CSV will clear ALL current employees and departments in this application and replace them with the CSV records. This action cannot be undone. Do you want to proceed?",
      confirmLabel: "Import",
      isDestructive: true,
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setImportingCSV(true);
        setSettingsSuccessMessage(null);
        try {
          const res = await importBulkEmployees(csvParsedData);
          if (res.success) {
            setSettingsSuccessMessage(res.message);
            setCsvRawRows([]);
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
            await reload();
          } else {
            alert("Import failed: " + res.message);
          }
        } catch (err: any) {
          alert("Bulk import failed: " + (err.message ?? "unknown error"));
        } finally {
          setImportingCSV(false);
        }
      }
    });
  };

  async function handleSaveConfigOnly() {
    setSavingSettings(true);
    setSettingsSuccessMessage(null);
    try {
      await saveSettings({
        mode: "Local",
        hrPortalApiUrl: apiUrl,
        hrPortalApiAuthHeaderName: authHeaderName,
        hrPortalApiAuthHeaderValue: authHeaderValue,

        idField,
        fullNameField,
        titleField,
        companyField,
        avatarUrlField,
        managerIdField,
        departmentIdField,
        departmentNameField,
        departmentColorField,
        appEmailField,
        hrmsEmailField
      });
      setSettingsSuccessMessage("API Configuration preferences saved!");
      setTimeout(() => setSettingsSuccessMessage(null), 3000);
    } catch (err: any) {
      alert("Failed to save configuration: " + (err.message ?? "unknown error"));
    } finally {
      setSavingSettings(false);
    }
  }



  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 py-6 bg-ink-50/30">
      {/* Floating above everything, including an open drawer's backdrop (z-50) - an inline banner
          here would render underneath that backdrop and be unreadable while the drawer is open. */}
      {errorMessage && (
        <div className="fixed top-4 right-4 z-[60] max-w-md rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 shadow-lg animate-fade-in">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="fixed top-4 right-4 z-[60] max-w-md rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 shadow-lg animate-fade-in">
          {successMessage}
        </div>
      )}

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

      </div>

      {/* Tab 1: Employees List (Always fully editable) */}
      {activeTab === "employees" && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-auto">
            <EmployeeTable
              employees={employees}
              currentUserId={user?.id}
              onEdit={(emp) => {
                setEditing(emp);
                setDrawerOpen(true);
              }}
              onDelete={handleDelete}
              onToggleAdmin={handleToggleAdmin}
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
                <div>
                  <label className="text-[10px] font-semibold text-ink-500">App Email Key (Authentication)</label>
                  <input
                    type="text"
                    value={appEmailField}
                    onChange={(e) => setAppEmailField(e.target.value)}
                    placeholder="e.g. appEmail"
                    className="mt-1 block w-full rounded-lg border border-ink-300 px-3 py-1.5 text-xs text-ink-900 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-ink-500">HRMS Email Key (Optional)</label>
                  <input
                    type="text"
                    value={hrmsEmailField}
                    onChange={(e) => setHrmsEmailField(e.target.value)}
                    placeholder="e.g. hrmsEmail"
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

          {/* CSV Directory Upload Card */}
          <div className="bg-white border border-ink-200 rounded-xl p-6 shadow-sm flex flex-col gap-5">
            <div>
              <h3 className="font-display font-bold text-sm text-ink-900">Import from CSV File</h3>
              <p className="text-[11px] text-ink-400 mt-0.5">Upload a CSV file containing your employee directory and import it directly. (Uses the JSON Field Key Mappings defined above).</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-ink-500">Select CSV File</label>
                <div className="mt-1 flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleCSVFileChange}
                    className="block w-full text-xs text-ink-905 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand/10 file:text-brand hover:file:bg-brand/20 transition-all cursor-pointer"
                  />
                  {csvRawRows.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearCSV}
                      className="px-2 py-1.5 rounded-lg border border-red-200 bg-red-50 text-[10px] font-semibold text-red-700 hover:bg-red-100 transition-all flex items-center gap-1 shrink-0"
                      title="Clear selected file"
                    >
                      <span>✕</span> Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            {csvRawRows.length > 0 && (
              <div className="border-t border-ink-100 pt-4 mt-2 flex flex-col gap-4">
                {csvValidationErrors.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 flex flex-col gap-1.5">
                    <span className="font-bold flex items-center gap-1.5 text-amber-900">
                      ⚠️ Column Mapping Warnings
                    </span>
                    <p>The following configured keys were not found in your CSV headers. Please verify your <strong>JSON Field Key Mappings</strong> form above matches your CSV column headers exactly:</p>
                    <ul className="list-disc pl-5 font-mono flex flex-col gap-0.5 mt-1 text-amber-900">
                      {csvValidationErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-ink-600 font-sans">
                      <strong>Found CSV Headers:</strong> <code className="bg-amber-100/50 px-1 py-0.5 rounded font-mono">{csvHeadersFound.join(", ")}</code>
                    </p>
                  </div>
                )}

                <div>
                  <h4 className="font-semibold text-xs text-ink-800 mb-1">CSV Mapping Preview</h4>
                  <p className="text-[10px] text-ink-400 mb-3">
                    Below is a preview of the first 5 records parsed from your CSV file using the JSON Field Key Mappings defined above.
                  </p>

                  <div className="bg-white border border-ink-200 rounded-lg overflow-hidden mt-2">
                    <div className="bg-ink-50/50 px-3 py-2 border-b border-ink-200">
                      <span className="text-[10px] font-semibold text-ink-600">Previewing Parsed CSV Records ({csvParsedData.length} total)</span>
                    </div>
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-ink-50/30 text-[10px] text-ink-400 border-b border-ink-200 font-semibold">
                          <th className="px-3 py-1.5">ID (Key: {idField})</th>
                          <th className="px-3 py-1.5">Full Name (Key: {fullNameField})</th>
                          <th className="px-3 py-1.5">Job Title (Key: {titleField})</th>
                          <th className="px-3 py-1.5">Reports To ID (Key: {managerIdField})</th>
                          <th className="px-3 py-1.5">Department Name (Key: {departmentNameField})</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100 text-[10px] text-ink-700 font-sans">
                        {csvParsedData.slice(0, 5).map((emp, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-1.5 font-mono">{emp.id || "(empty)"}</td>
                            <td className="px-3 py-1.5 font-semibold">{emp.fullName || "(empty)"}</td>
                            <td className="px-3 py-1.5">{emp.title || "(empty)"}</td>
                            <td className="px-3 py-1.5 font-mono">{emp.managerId || "(CEO/empty)"}</td>
                            <td className="px-3 py-1.5">{emp.departmentName || "Default"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={handleImportCSV}
                      disabled={importingCSV || csvValidationErrors.length > 0}
                      className="px-4 py-2 bg-brand text-white rounded-lg text-xs font-semibold hover:bg-brand-dark transition-colors disabled:opacity-50"
                    >
                      {importingCSV ? "Importing CSV..." : "Import CSV Directory"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

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


      {reassignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-ink-150 bg-white p-6 shadow-xl animate-slide-up">
            <div className="flex items-start gap-3.5 mb-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-rose-50 border-rose-100 text-rose-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-black text-ink-900 leading-tight">Delete Employee</h3>
                <p className="text-xs text-ink-500 mt-1.5 leading-relaxed">
                  {reassignModal.employee.fullName} has {reassignModal.directReports.length}{" "}
                  {reassignModal.directReports.length === 1 ? "direct report" : "direct reports"} (
                  {reassignModal.directReports.map((r) => r.fullName).join(", ")}). Choose who should manage them
                  after {reassignModal.employee.fullName} is removed.
                </p>
              </div>
            </div>

            <div className="mb-5">
              <label className="block mb-1.5">
                <span className="mb-1 block text-xs font-medium text-ink-600">New manager for their reports</span>
                <CustomSelect
                  value={reassignModal.selectedManagerId}
                  onChange={(val) =>
                    setReassignModal((prev) =>
                      prev ? { ...prev, selectedManagerId: val !== null ? Number(val) : null } : prev
                    )
                  }
                  options={managers
                    .filter((m) => m.id !== reassignModal.employee.id)
                    .map((m) => ({ value: m.id, label: `${m.fullName} — ${m.title}` }))}
                  emptyLabel="No manager (top of the org)"
                />
              </label>
              {(() => {
                const promoted = reassignModal.directReports.find((r) => r.id === reassignModal.selectedManagerId);
                return promoted ? (
                  <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-150 rounded-lg px-3 py-2">
                    {promoted.fullName} is one of the reports being reassigned - they'll manage the others, but will
                    themselves become a root (no manager) since they can't report to themselves.
                  </p>
                ) : null;
              })()}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-ink-150">
              <button
                type="button"
                onClick={() => setReassignModal(null)}
                className="py-2 px-4 rounded-xl border border-ink-200 bg-white text-xs font-semibold text-ink-700 hover:bg-ink-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReassignAndDelete}
                className="py-2 px-4 rounded-xl text-xs font-semibold text-white transition-all shadow-md cursor-pointer bg-rose-600 hover:bg-rose-500 shadow-rose-600/10"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmLabel={confirmConfig.confirmLabel}
        isDestructive={confirmConfig.isDestructive}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
