using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrgChart.Repositories.Data;
using OrgChart.Domain;
using OrgChart.Repositories;

namespace OrgChart.Api.Controllers;

[ApiController]
[Route("api/settings")]
public class SettingsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly HttpClient _httpClient;

    public SettingsController(AppDbContext db, HttpClient httpClient)
    {
        _db = db;
        _httpClient = httpClient;
    }

    [HttpGet]
    public async Task<ActionResult<SettingsDto>> GetSettings()
    {
        var config = await _db.DataSourceConfigs.FirstOrDefaultAsync();
        if (config == null)
        {
            config = new DataSourceConfig
            {
                Mode = "Local"
            };
        }

        return Ok(new SettingsDto
        {
            Mode = config.Mode,
            HrPortalApiUrl = config.HrPortalApiUrl,
            HrPortalApiAuthHeaderName = config.HrPortalApiAuthHeaderName,
            HrPortalApiAuthHeaderValue = config.HrPortalApiAuthHeaderValue,
            JiraApiUrl = config.JiraApiUrl,
            JiraUserEmail = config.JiraUserEmail,
            JiraApiToken = config.JiraApiToken,
            IdField = config.IdField,
            FullNameField = config.FullNameField,
            TitleField = config.TitleField,
            CompanyField = config.CompanyField,
            AvatarUrlField = config.AvatarUrlField,
            ManagerIdField = config.ManagerIdField,
            DepartmentIdField = config.DepartmentIdField,
            DepartmentNameField = config.DepartmentNameField,
            DepartmentColorField = config.DepartmentColorField,
            SupportsWrites = config.Mode == "Local"
        });
    }

    [HttpPost]
    public async Task<IActionResult> UpdateSettings(UpdateSettingsDto dto)
    {
        var config = await _db.DataSourceConfigs.FirstOrDefaultAsync();
        if (config == null)
        {
            config = new DataSourceConfig();
            _db.DataSourceConfigs.Add(config);
        }

        config.Mode = dto.Mode;
        config.HrPortalApiUrl = dto.HrPortalApiUrl;
        config.HrPortalApiAuthHeaderName = dto.HrPortalApiAuthHeaderName;
        config.HrPortalApiAuthHeaderValue = dto.HrPortalApiAuthHeaderValue;
        config.JiraApiUrl = dto.JiraApiUrl;
        config.JiraUserEmail = dto.JiraUserEmail;
        config.JiraApiToken = dto.JiraApiToken;
        config.IdField = dto.IdField;
        config.FullNameField = dto.FullNameField;
        config.TitleField = dto.TitleField;
        config.CompanyField = dto.CompanyField;
        config.AvatarUrlField = dto.AvatarUrlField;
        config.ManagerIdField = dto.ManagerIdField;
        config.DepartmentIdField = dto.DepartmentIdField;
        config.DepartmentNameField = dto.DepartmentNameField;
        config.DepartmentColorField = dto.DepartmentColorField;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("test")]
    public async Task<ActionResult<TestConnectionResultDto>> TestConnection(TestConnectionDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.ApiUrl))
        {
            return Ok(new TestConnectionResultDto
            {
                Success = false,
                Message = "API URL is required."
            });
        }

        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get, dto.ApiUrl);
            if (!string.IsNullOrWhiteSpace(dto.AuthHeaderName) && !string.IsNullOrWhiteSpace(dto.AuthHeaderValue))
            {
                request.Headers.TryAddWithoutValidation(dto.AuthHeaderName, dto.AuthHeaderValue);
            }

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                return Ok(new TestConnectionResultDto
                {
                    Success = false,
                    Message = $"HTTP error: {(int)response.StatusCode} ({response.ReasonPhrase})"
                });
            }

            var jsonString = await response.Content.ReadAsStringAsync();

            // Run parser on temporary config
            var tempConfig = new DataSourceConfig
            {
                IdField = dto.IdField,
                FullNameField = dto.FullNameField,
                TitleField = dto.TitleField,
                CompanyField = dto.CompanyField,
                AvatarUrlField = dto.AvatarUrlField,
                ManagerIdField = dto.ManagerIdField,
                DepartmentIdField = dto.DepartmentIdField,
                DepartmentNameField = dto.DepartmentNameField,
                DepartmentColorField = dto.DepartmentColorField
            };

            List<Employee> parsedEmployees;
            try
            {
                parsedEmployees = HrPortalEmployeeRepository.ParseEmployeesFromJson(jsonString, tempConfig);
            }
            catch (Exception parseEx)
            {
                return Ok(new TestConnectionResultDto
                {
                    Success = false,
                    Message = $"JSON Parsing failure: {parseEx.Message}"
                });
            }

            var validationErrors = new List<string>();
            var previewEmployees = new List<EmployeePreviewDto>();

            if (parsedEmployees.Count == 0)
            {
                validationErrors.Add("API request completed successfully, but parsed 0 employees. Check if JSON field mappings match the API response.");
            }
            else
            {
                var employeeIds = parsedEmployees.Select(e => e.Id).ToHashSet();
                var managerIds = parsedEmployees.Where(e => e.ManagerId.HasValue).Select(e => e.ManagerId!.Value).ToHashSet();
                var roots = parsedEmployees.Where(e => !e.ManagerId.HasValue).ToList();

                if (roots.Count == 0)
                {
                    validationErrors.Add("No root employee found (employee with NULL or missing Manager ID). A root is required to build the tree.");
                }
                else if (roots.Count > 1)
                {
                    validationErrors.Add($"Found {roots.Count} root employees (missing Manager ID). Tree builders usually expect a single root. Roots: {string.Join(", ", roots.Select(r => r.FullName).Take(3))}");
                }

                // Check for duplicate IDs
                var duplicates = parsedEmployees.GroupBy(e => e.Id).Where(g => g.Count() > 1).Select(g => g.Key).ToList();
                if (duplicates.Any())
                {
                    validationErrors.Add($"Found duplicate Employee IDs in the API response. Duplicate IDs: {string.Join(", ", duplicates.Take(3))}");
                }

                // Check for orphaned reports
                var missingManagers = managerIds.Except(employeeIds).ToList();
                if (missingManagers.Any())
                {
                    validationErrors.Add($"Found employees reporting to Manager IDs that do not exist. Orphaned manager IDs: {string.Join(", ", missingManagers.Take(3))}");
                }

                // Prepare preview
                foreach (var emp in parsedEmployees.Take(5))
                {
                    previewEmployees.Add(new EmployeePreviewDto
                    {
                        Id = emp.Id,
                        FullName = emp.FullName,
                        Title = emp.Title,
                        Company = emp.Company,
                        ManagerId = emp.ManagerId,
                        DepartmentId = emp.DepartmentId ?? 0,
                        DepartmentName = emp.Department?.Name ?? ""
                    });
                }
            }

            return Ok(new TestConnectionResultDto
            {
                Success = validationErrors.Count == 0,
                Message = validationErrors.Count == 0 
                    ? "Connection verified and schema mappings are correct!" 
                    : "Connection succeeded, but validation failed.",
                EmployeeCount = parsedEmployees.Count,
                SampleEmployees = previewEmployees,
                ValidationErrors = validationErrors
            });
        }
        catch (Exception ex)
        {
            return Ok(new TestConnectionResultDto
            {
                Success = false,
                Message = $"Failed to connect to URL: {ex.Message}"
            });
        }
    }

    [HttpPost("import")]
    public async Task<ActionResult<ImportResultDto>> ImportEmployees(TestConnectionDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.ApiUrl))
        {
            return BadRequest("API URL is required.");
        }

        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get, dto.ApiUrl);
            if (!string.IsNullOrWhiteSpace(dto.AuthHeaderName) && !string.IsNullOrWhiteSpace(dto.AuthHeaderValue))
            {
                request.Headers.TryAddWithoutValidation(dto.AuthHeaderName, dto.AuthHeaderValue);
            }

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                return Ok(new ImportResultDto
                {
                    Success = false,
                    Message = $"HTTP error: {(int)response.StatusCode} ({response.ReasonPhrase})"
                });
            }

            var jsonString = await response.Content.ReadAsStringAsync();

            var tempConfig = new DataSourceConfig
            {
                IdField = dto.IdField,
                FullNameField = dto.FullNameField,
                TitleField = dto.TitleField,
                CompanyField = dto.CompanyField,
                AvatarUrlField = dto.AvatarUrlField,
                ManagerIdField = dto.ManagerIdField,
                DepartmentIdField = dto.DepartmentIdField,
                DepartmentNameField = dto.DepartmentNameField,
                DepartmentColorField = dto.DepartmentColorField
            };

            List<Employee> parsedEmployees;
            try
            {
                parsedEmployees = HrPortalEmployeeRepository.ParseEmployeesFromJson(jsonString, tempConfig);
            }
            catch (Exception parseEx)
            {
                return Ok(new ImportResultDto
                {
                    Success = false,
                    Message = $"JSON Parsing failure: {parseEx.Message}"
                });
            }

            if (parsedEmployees.Count == 0)
            {
                return Ok(new ImportResultDto
                {
                    Success = false,
                    Message = "No employees were parsed from the JSON payload."
                });
            }

            // Clear existing OrgReportings first
            var existingReportings = await _db.OrgReportings.ToListAsync();
            _db.OrgReportings.RemoveRange(existingReportings);
            await _db.SaveChangesAsync();

            // Clear existing EmpDepartments
            var existingEmpDepts = await _db.EmpDepartments.ToListAsync();
            _db.EmpDepartments.RemoveRange(existingEmpDepts);
            await _db.SaveChangesAsync();

            // Clear existing data in local database
            var existingEmployees = await _db.Employees.ToListAsync();
            _db.Employees.RemoveRange(existingEmployees);
            await _db.SaveChangesAsync();

            var existingDepartments = await _db.Departments.ToListAsync();
            _db.Departments.RemoveRange(existingDepartments);
            await _db.SaveChangesAsync();

            // Find the Employee role ID
            var employeeRole = await _db.AppRoles.FirstOrDefaultAsync(r => r.Name == "Employee");
            var roleId = employeeRole?.Id ?? 2;

            // Import data
            var departmentCache = new Dictionary<string, Department>(StringComparer.OrdinalIgnoreCase);
            var kekaIdToEntityMap = new Dictionary<int, Employee>();

            foreach (var parsed in parsedEmployees)
            {
                var deptName = parsed.Department?.Name ?? "Default";
                var deptColor = parsed.Department?.ColorHex ?? "#64748B";

                if (!departmentCache.TryGetValue(deptName, out var deptEntity))
                {
                    deptEntity = new Department
                    {
                        Name = deptName,
                        ColorHex = deptColor
                    };
                    _db.Departments.Add(deptEntity);
                    departmentCache[deptName] = deptEntity;
                }

                var emailName = parsed.FullName.Replace(" ", "").Replace("'", "").ToLowerInvariant();
                var email = $"{emailName}_{parsed.Id}@5yinc.com";

                var empEntity = new Employee
                {
                    FullName = parsed.FullName,
                    Title = parsed.Title,
                    Company = parsed.Company,
                    AvatarUrl = parsed.AvatarUrl,
                    APPEmail = email,
                    Email = email,
                    NormalizedEmail = email.ToUpperInvariant(),
                    UserName = email,
                    NormalizedUserName = email.ToUpperInvariant(),
                    SecurityStamp = Guid.NewGuid().ToString(),
                    EmailConfirmed = true,
                    APPRoleId = roleId
                };

                _db.Employees.Add(empEntity);
                kekaIdToEntityMap[parsed.Id] = empEntity;
            }

            // Save once so EF generates new database IDs for departments and employees
            await _db.SaveChangesAsync();

            // Link employees to their departments via EmpDepartments
            foreach (var parsed in parsedEmployees)
            {
                if (kekaIdToEntityMap.TryGetValue(parsed.Id, out var empEntity))
                {
                    var deptName = parsed.Department?.Name ?? "Default";
                    var deptEntity = departmentCache[deptName];

                    _db.EmpDepartments.Add(new EmpDepartment
                    {
                        EmployeeId = empEntity.Id,
                        DepartmentId = deptEntity.Id
                    });
                }
            }
            await _db.SaveChangesAsync();

            // Loop again to link managers via OrgReporting
            var updatedCount = 0;
            foreach (var parsed in parsedEmployees)
            {
                if (parsed.ManagerId.HasValue && kekaIdToEntityMap.TryGetValue(parsed.ManagerId.Value, out var managerEntity))
                {
                    var empEntity = kekaIdToEntityMap[parsed.Id];
                    _db.OrgReportings.Add(new OrgReporting
                    {
                        EmployeeId = empEntity.Id,
                        ManagerId = managerEntity.Id,
                        ReportingType = "Direct"
                    });
                    updatedCount++;
                }
            }

            if (updatedCount > 0)
            {
                await _db.SaveChangesAsync();
            }

            // Force config mode back to "Local"
            var config = await _db.DataSourceConfigs.FirstOrDefaultAsync();
            if (config == null)
            {
                config = new DataSourceConfig();
                _db.DataSourceConfigs.Add(config);
            }
            config.Mode = "Local";
            await _db.SaveChangesAsync();

            return Ok(new ImportResultDto
            {
                Success = true,
                Message = $"Successfully imported {parsedEmployees.Count} employees and {departmentCache.Count} departments from the HR Portal into the local database!",
                ImportedCount = parsedEmployees.Count
            });
        }
        catch (Exception ex)
        {
            return Ok(new ImportResultDto
            {
                Success = false,
                Message = $"Import failed: {ex.Message}"
            });
        }
    }
}

public class SettingsDto
{
    public string Mode { get; set; } = "Local";
    public string? HrPortalApiUrl { get; set; }
    public string? HrPortalApiAuthHeaderName { get; set; }
    public string? HrPortalApiAuthHeaderValue { get; set; }
    public string? JiraApiUrl { get; set; }
    public string? JiraUserEmail { get; set; }
    public string? JiraApiToken { get; set; }
    public string IdField { get; set; } = "id";
    public string FullNameField { get; set; } = "fullName";
    public string TitleField { get; set; } = "title";
    public string CompanyField { get; set; } = "company";
    public string AvatarUrlField { get; set; } = "avatarUrl";
    public string ManagerIdField { get; set; } = "managerId";
    public string DepartmentIdField { get; set; } = "departmentId";
    public string DepartmentNameField { get; set; } = "departmentName";
    public string DepartmentColorField { get; set; } = "departmentColor";
    public bool SupportsWrites { get; set; }
}

public class UpdateSettingsDto
{
    public string Mode { get; set; } = "Local";
    public string? HrPortalApiUrl { get; set; }
    public string? HrPortalApiAuthHeaderName { get; set; }
    public string? HrPortalApiAuthHeaderValue { get; set; }
    public string? JiraApiUrl { get; set; }
    public string? JiraUserEmail { get; set; }
    public string? JiraApiToken { get; set; }
    public string IdField { get; set; } = "id";
    public string FullNameField { get; set; } = "fullName";
    public string TitleField { get; set; } = "title";
    public string CompanyField { get; set; } = "company";
    public string AvatarUrlField { get; set; } = "avatarUrl";
    public string ManagerIdField { get; set; } = "managerId";
    public string DepartmentIdField { get; set; } = "departmentId";
    public string DepartmentNameField { get; set; } = "departmentName";
    public string DepartmentColorField { get; set; } = "departmentColor";
}

public class TestConnectionDto
{
    public string ApiUrl { get; set; } = string.Empty;
    public string? AuthHeaderName { get; set; }
    public string? AuthHeaderValue { get; set; }
    public string IdField { get; set; } = "id";
    public string FullNameField { get; set; } = "fullName";
    public string TitleField { get; set; } = "title";
    public string CompanyField { get; set; } = "company";
    public string AvatarUrlField { get; set; } = "avatarUrl";
    public string ManagerIdField { get; set; } = "managerId";
    public string DepartmentIdField { get; set; } = "departmentId";
    public string DepartmentNameField { get; set; } = "departmentName";
    public string DepartmentColorField { get; set; } = "departmentColor";
}

public class EmployeePreviewDto
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Company { get; set; } = string.Empty;
    public int? ManagerId { get; set; }
    public int DepartmentId { get; set; }
    public string DepartmentName { get; set; } = string.Empty;
}

public class TestConnectionResultDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public int EmployeeCount { get; set; }
    public List<EmployeePreviewDto> SampleEmployees { get; set; } = new();
    public List<string> ValidationErrors { get; set; } = new();
}

public class ImportResultDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public int ImportedCount { get; set; }
}
