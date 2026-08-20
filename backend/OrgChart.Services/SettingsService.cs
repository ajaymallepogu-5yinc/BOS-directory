using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OrgChart.Domain;
using OrgChart.Repositories;
using OrgChart.Repositories.Data;
using OrgChart.Services.Dtos;

namespace OrgChart.Services;

public class SettingsService
{
    private readonly EfDataSourceConfigRepository _configRepository;

    // Still used directly for ImportEmployeesAsync's bulk Employee/Department/EmpDepartment/
    // OrgReporting wipe-and-rebuild - that flow spans five entities in one tightly-sequenced
    // pass (see method for why) and already duplicates EmployeeService.ImportBulkAsync almost
    // exactly. That duplication is a separate, already-flagged cleanup (dedupe the two import
    // flows), not something a new single-entity repository interface should paper over here.
    private readonly AppDbContext _db;
    private readonly HttpClient _httpClient;

    public SettingsService(EfDataSourceConfigRepository configRepository, AppDbContext db, HttpClient httpClient)
    {
        _configRepository = configRepository;
        _db = db;
        _httpClient = httpClient;
    }

    public async Task<SettingsDto> GetSettingsAsync()
    {
        var config = await _configRepository.GetAsync();
        if (config == null)
        {
            config = new DataSourceConfig
            {
                Mode = "Local"
            };
        }

        return new SettingsDto
        {
            Mode = config.Mode,
            HrPortalApiUrl = config.HrPortalApiUrl,
            HrPortalApiAuthHeaderName = config.HrPortalApiAuthHeaderName,
            HrPortalApiAuthHeaderValue = config.HrPortalApiAuthHeaderValue,

            IdField = config.IdField,
            FullNameField = config.FullNameField,
            TitleField = config.TitleField,
            AvatarUrlField = config.AvatarUrlField,
            ManagerIdField = config.ManagerIdField,
            DepartmentIdField = config.DepartmentIdField,
            DepartmentNameField = config.DepartmentNameField,
            DepartmentColorField = config.DepartmentColorField,
            APPEmailField = config.APPEmailField,
            HRMSEmailField = config.HRMSEmailField,
            SupportsWrites = config.Mode == "Local"
        };
    }

    public async Task UpdateSettingsAsync(UpdateSettingsDto dto)
    {
        await _configRepository.UpsertAsync(new DataSourceConfig
        {
            Mode = dto.Mode,
            HrPortalApiUrl = dto.HrPortalApiUrl,
            HrPortalApiAuthHeaderName = dto.HrPortalApiAuthHeaderName,
            HrPortalApiAuthHeaderValue = dto.HrPortalApiAuthHeaderValue,
            IdField = dto.IdField,
            FullNameField = dto.FullNameField,
            TitleField = dto.TitleField,
            AvatarUrlField = dto.AvatarUrlField,
            ManagerIdField = dto.ManagerIdField,
            DepartmentIdField = dto.DepartmentIdField,
            DepartmentNameField = dto.DepartmentNameField,
            DepartmentColorField = dto.DepartmentColorField,
            APPEmailField = dto.APPEmailField,
            HRMSEmailField = dto.HRMSEmailField
        });
    }

    /// <summary>Never throws - every failure path (bad HTTP status, parse failure, unreachable
    /// host) is reported inside the returned DTO's Success/Message fields instead.</summary>
    public async Task<TestConnectionResultDto> TestConnectionAsync(TestConnectionDto dto)
    {
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
                return new TestConnectionResultDto
                {
                    Success = false,
                    Message = $"HTTP error: {(int)response.StatusCode} ({response.ReasonPhrase})"
                };
            }

            var jsonString = await response.Content.ReadAsStringAsync();

            // Run parser on temporary config
            var tempConfig = new DataSourceConfig
            {
                IdField = dto.IdField,
                FullNameField = dto.FullNameField,
                TitleField = dto.TitleField,
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
                return new TestConnectionResultDto
                {
                    Success = false,
                    Message = $"JSON Parsing failure: {parseEx.Message}"
                };
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
                        ManagerId = emp.ManagerId,
                        DepartmentId = emp.DepartmentId ?? 0,
                        DepartmentName = emp.Department?.Name ?? ""
                    });
                }
            }

            return new TestConnectionResultDto
            {
                Success = validationErrors.Count == 0,
                Message = validationErrors.Count == 0
                    ? "Connection verified and schema mappings are correct!"
                    : "Connection succeeded, but validation failed.",
                EmployeeCount = parsedEmployees.Count,
                SampleEmployees = previewEmployees,
                ValidationErrors = validationErrors
            };
        }
        catch (Exception ex)
        {
            return new TestConnectionResultDto
            {
                Success = false,
                Message = $"Failed to connect to URL: {ex.Message}"
            };
        }
    }

    /// <summary>Never throws, same reasoning as TestConnectionAsync. On success, wipes and
    /// replaces every Employee/Department/OrgReporting/EmpDepartment row with the freshly
    /// imported set, then forces DataSourceConfig.Mode back to "Local".</summary>
    public async Task<ImportResultDto> ImportEmployeesAsync(TestConnectionDto dto)
    {
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
                return new ImportResultDto
                {
                    Success = false,
                    Message = $"HTTP error: {(int)response.StatusCode} ({response.ReasonPhrase})"
                };
            }

            var jsonString = await response.Content.ReadAsStringAsync();

            var tempConfig = new DataSourceConfig
            {
                IdField = dto.IdField,
                FullNameField = dto.FullNameField,
                TitleField = dto.TitleField,
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
                return new ImportResultDto
                {
                    Success = false,
                    Message = $"JSON Parsing failure: {parseEx.Message}"
                };
            }

            if (parsedEmployees.Count == 0)
            {
                return new ImportResultDto
                {
                    Success = false,
                    Message = "No employees were parsed from the JSON payload."
                };
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

            // Find the Employee role ID in standard Identity roles
            var employeeRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "Employee");

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
                    AvatarUrl = parsed.AvatarUrl,
                    APPEmail = email,
                    Email = email,
                    NormalizedEmail = email.ToUpperInvariant(),
                    UserName = email,
                    NormalizedUserName = email.ToUpperInvariant(),
                    SecurityStamp = Guid.NewGuid().ToString(),
                    EmailConfirmed = true
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

            // Link employees to standard Identity roles
            if (employeeRole != null)
            {
                foreach (var empEntity in kekaIdToEntityMap.Values)
                {
                    _db.UserRoles.Add(new IdentityUserRole<int>
                    {
                        UserId = empEntity.Id,
                        RoleId = employeeRole.Id
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
            await _configRepository.ForceLocalModeAsync();

            return new ImportResultDto
            {
                Success = true,
                Message = $"Successfully imported {parsedEmployees.Count} employees and {departmentCache.Count} departments from the HR Portal into the local database!",
                ImportedCount = parsedEmployees.Count
            };
        }
        catch (Exception ex)
        {
            return new ImportResultDto
            {
                Success = false,
                Message = $"Import failed: {ex.Message}"
            };
        }
    }
}
