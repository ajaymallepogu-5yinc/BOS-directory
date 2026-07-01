using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using OrgChart.Repositories.Data;
using OrgChart.Domain;

namespace OrgChart.Repositories;

/// <summary>
/// Data source that reads employees dynamically from your company's existing
/// HR portal REST API. This is intentionally read-only: employee records
/// should be edited in the real HR system, not duplicated here.
/// </summary>
public class HrPortalEmployeeRepository : IEmployeeRepository
{
    private readonly AppDbContext _db;
    private readonly HttpClient _httpClient;

    public HrPortalEmployeeRepository(AppDbContext db, HttpClient httpClient)
    {
        _db = db;
        _httpClient = httpClient;
    }

    public bool SupportsWrites => false;

    public async Task<List<Employee>> GetAllAsync(string reportingType = "Direct")
    {
        var config = await _db.DataSourceConfigs.FirstOrDefaultAsync()
            ?? throw new InvalidOperationException("HR Portal connection configuration not found.");

        if (string.IsNullOrWhiteSpace(config.HrPortalApiUrl))
        {
            throw new InvalidOperationException("HR Portal API URL is not configured.");
        }

        var request = new HttpRequestMessage(HttpMethod.Get, config.HrPortalApiUrl);
        if (!string.IsNullOrWhiteSpace(config.HrPortalApiAuthHeaderName) && 
            !string.IsNullOrWhiteSpace(config.HrPortalApiAuthHeaderValue))
        {
            request.Headers.TryAddWithoutValidation(config.HrPortalApiAuthHeaderName, config.HrPortalApiAuthHeaderValue);
        }

        var response = await _httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();

        var jsonString = await response.Content.ReadAsStringAsync();
        return ParseEmployeesFromJson(jsonString, config);
    }

    public static List<Employee> ParseEmployeesFromJson(string jsonString, DataSourceConfig config)
    {
        var employees = new List<Employee>();

        using var doc = JsonDocument.Parse(jsonString);
        var root = doc.RootElement;

        JsonElement arrayElement;

        // Check if root is an array or if it has a wrapper array (like Keka's "data" or "employees" key)
        if (root.ValueKind == JsonValueKind.Array)
        {
            arrayElement = root;
        }
        else if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("data", out var dataProp) && dataProp.ValueKind == JsonValueKind.Array)
        {
            arrayElement = dataProp;
        }
        else if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("employees", out var empProp) && empProp.ValueKind == JsonValueKind.Array)
        {
            arrayElement = empProp;
        }
        else
        {
            throw new InvalidOperationException("The API response did not contain a valid JSON array at the root or under a 'data' / 'employees' key.");
        }

        foreach (var item in arrayElement.EnumerateArray())
        {
            // 1. Parse Id (Required)
            var idEl = GetElementByPath(item, config.IdField);
            if (!idEl.HasValue || idEl.Value.ValueKind == JsonValueKind.Null)
            {
                continue; // Skip invalid records
            }
            int id = ParseOrHashId(idEl.Value);

            // 2. Parse Full Name (Required)
            var nameEl = GetElementByPath(item, config.FullNameField);
            string fullName = nameEl.HasValue ? nameEl.Value.GetString() ?? "" : "";
            if (string.IsNullOrWhiteSpace(fullName))
            {
                continue; // Skip unnamed records
            }

            // 3. Parse Title (Optional)
            var titleEl = GetElementByPath(item, config.TitleField);
            string title = titleEl.HasValue && titleEl.Value.ValueKind == JsonValueKind.String 
                ? titleEl.Value.GetString() ?? "" 
                : "";

            // 4. Parse Company (Optional)
            var companyEl = GetElementByPath(item, config.CompanyField);
            string company = companyEl.HasValue && companyEl.Value.ValueKind == JsonValueKind.String 
                ? companyEl.Value.GetString() ?? "" 
                : "";

            // 5. Parse Avatar Url (Optional)
            var avatarEl = GetElementByPath(item, config.AvatarUrlField);
            string? avatarUrl = avatarEl.HasValue && avatarEl.Value.ValueKind == JsonValueKind.String 
                ? avatarEl.Value.GetString() 
                : null;

            // 6. Parse Manager Id (Optional)
            var managerEl = GetElementByPath(item, config.ManagerIdField);
            int? managerId = null;
            if (managerEl.HasValue && managerEl.Value.ValueKind != JsonValueKind.Null)
            {
                managerId = ParseOrHashNullableId(managerEl.Value);
            }

            // 7. Parse Department Name (Required)
            var deptNameEl = GetElementByPath(item, config.DepartmentNameField);
            string departmentName = deptNameEl.HasValue && deptNameEl.Value.ValueKind == JsonValueKind.String 
                ? deptNameEl.Value.GetString() ?? "Default" 
                : "Default";

            // 8. Parse Department Id (Optional, fallback to hashing name)
            var deptIdEl = GetElementByPath(item, config.DepartmentIdField);
            int departmentId;
            if (deptIdEl.HasValue && deptIdEl.Value.ValueKind != JsonValueKind.Null && deptIdEl.Value.ValueKind != JsonValueKind.String)
            {
                departmentId = ParseOrHashId(deptIdEl.Value);
            }
            else if (deptIdEl.HasValue && deptIdEl.Value.ValueKind == JsonValueKind.String)
            {
                var strVal = deptIdEl.Value.GetString();
                if (int.TryParse(strVal, out var parsedInt))
                {
                    departmentId = parsedInt;
                }
                else
                {
                    departmentId = GetStableHash(strVal ?? departmentName);
                }
            }
            else
            {
                departmentId = GetStableHash(departmentName);
            }

            // 9. Parse Department Color (Optional)
            var deptColorEl = GetElementByPath(item, config.DepartmentColorField);
            string departmentColor = deptColorEl.HasValue && deptColorEl.Value.ValueKind == JsonValueKind.String 
                ? deptColorEl.Value.GetString() ?? "#64748B" 
                : "#64748B";

            // 10. Parse App Email (Required - skip if missing)
            var appEmailEl = GetElementByPath(item, config.APPEmailField);
            string appEmail = appEmailEl.HasValue && appEmailEl.Value.ValueKind == JsonValueKind.String
                ? appEmailEl.Value.GetString() ?? ""
                : "";

            if (string.IsNullOrWhiteSpace(appEmail))
            {
                continue; // Skip employee if they do not have a valid App Email
            }

            // 11. Parse HRMS Email (Optional)
            var hrmsEmailEl = GetElementByPath(item, config.HRMSEmailField);
            string? hrmsEmail = hrmsEmailEl.HasValue && hrmsEmailEl.Value.ValueKind == JsonValueKind.String
                ? hrmsEmailEl.Value.GetString()
                : null;

            employees.Add(new Employee
            {
                Id = id,
                FullName = fullName,
                Title = title,
                Company = company,
                AvatarUrl = avatarUrl,
                ManagerId = managerId,
                DepartmentId = departmentId,
                APPEmail = appEmail,
                HRMSEmail = hrmsEmail,
                Email = appEmail,
                UserName = appEmail,
                NormalizedEmail = appEmail.ToUpperInvariant(),
                NormalizedUserName = appEmail.ToUpperInvariant(),
                Department = new Department
                {
                    Id = departmentId,
                    Name = departmentName,
                    ColorHex = departmentColor
                }
            });
        }

        return employees;
    }

    public async Task<Employee?> GetByIdAsync(int id)
    {
        var all = await GetAllAsync();
        return all.FirstOrDefault(e => e.Id == id);
    }

    public Task<Employee> AddAsync(Employee employee) =>
        throw new NotSupportedException("HR portal mode is read-only. Add employees in the HR system instead.");

    public Task<Employee?> UpdateAsync(int id, Employee updated) =>
        throw new NotSupportedException("HR portal mode is read-only. Edit employees in the HR system instead.");

    public Task<bool> DeleteAsync(int id) =>
        throw new NotSupportedException("HR portal mode is read-only. Remove employees in the HR system instead.");

    // ---- Parsing Helpers ----

    public static JsonElement? GetElementByPath(JsonElement element, string path)
    {
        if (string.IsNullOrWhiteSpace(path)) return null;

        var parts = path.Split('.');
        var current = element;

        foreach (var part in parts)
        {
            if (current.ValueKind == JsonValueKind.Object && current.TryGetProperty(part, out var next))
            {
                current = next;
            }
            else
            {
                return null;
            }
        }

        return current;
    }

    private static int ParseOrHashId(JsonElement el)
    {
        if (el.ValueKind == JsonValueKind.Number)
        {
            return el.GetInt32();
        }
        if (el.ValueKind == JsonValueKind.String)
        {
            var str = el.GetString() ?? "";
            if (int.TryParse(str, out var val))
            {
                return val;
            }
            return GetStableHash(str);
        }
        return GetStableHash(el.ToString());
    }

    private static int? ParseOrHashNullableId(JsonElement el)
    {
        if (el.ValueKind == JsonValueKind.Null) return null;
        if (el.ValueKind == JsonValueKind.Number) return el.GetInt32();
        if (el.ValueKind == JsonValueKind.String)
        {
            var str = el.GetString() ?? "";
            if (string.IsNullOrWhiteSpace(str)) return null;
            if (int.TryParse(str, out var val)) return val;
            return GetStableHash(str);
        }
        return GetStableHash(el.ToString());
    }

    public static int GetStableHash(string value)
    {
        if (string.IsNullOrEmpty(value)) return 0;
        uint hash = 2166136261;
        foreach (char c in value)
        {
            hash = (hash ^ c) * 16777619;
        }
        return (int)(hash & 0x7FFFFFFF); // Force positive int
    }
}
