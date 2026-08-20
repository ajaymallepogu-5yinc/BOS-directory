using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OrgChart.Domain;
using OrgChart.Repositories;
using OrgChart.Repositories.Data;
using OrgChart.Services.Dtos;

namespace OrgChart.Services;

public enum UpdateAdminRoleOutcome
{
    NotFound,
    CannotRemoveSelf,
    CannotRemoveLastAdmin,
    Applied
}

public class EmployeeService
{
    private readonly IEmployeeRepository _employees;
    private readonly AppDbContext _db;
    private readonly UserManager<Employee> _userManager;

    public EmployeeService(IEmployeeRepository employees, AppDbContext db, UserManager<Employee> userManager)
    {
        _employees = employees;
        _db = db;
        _userManager = userManager;
    }

    /// <summary>True for sources that support writes (Local). HR portal mode is read-only.</summary>
    public bool SupportsWrites => _employees.SupportsWrites;

    public async Task<List<EmployeeDto>> GetAllAsync()
    {
        var all = await _employees.GetAllAsync();
        var functionalReportings = await _employees.GetAllAsync("Functional");
        var functionalLookup = functionalReportings.ToDictionary(e => e.Id, e => e.ManagerId);
        var lookup = all.ToDictionary(e => e.Id, e => e.FullName);
        var adminIds = (await _userManager.GetUsersInRoleAsync("Admin")).Select(u => u.Id).ToHashSet();

        return all.Select(e =>
        {
            var functionalManagerId = functionalLookup.TryGetValue(e.Id, out var fmId) ? fmId : null;
            return new EmployeeDto
            {
                Id = e.Id,
                FullName = e.FullName,
                Title = e.Title,
                JobRole = e.JobRole,
                AvatarUrl = e.AvatarUrl,
                ManagerId = e.ManagerId,
                ManagerName = e.ManagerId.HasValue && lookup.TryGetValue(e.ManagerId.Value, out var name) ? name : null,
                FunctionalManagerId = functionalManagerId,
                FunctionalManagerName = functionalManagerId.HasValue && lookup.TryGetValue(functionalManagerId.Value, out var fmName) ? fmName : null,
                DepartmentId = e.DepartmentId ?? 0,
                Department = e.Department?.Name ?? "",
                AppEmail = e.APPEmail,
                HrmsEmail = e.HRMSEmail,
                IsAdmin = adminIds.Contains(e.Id)
            };
        }).ToList();
    }

    public async Task<List<ManagerOptionDto>> GetManagerOptionsAsync()
    {
        var all = await _employees.GetAllAsync();
        return all.Select(e => new ManagerOptionDto { Id = e.Id, FullName = e.FullName, Title = e.Title }).ToList();
    }

    public async Task<EmployeeDto?> GetByIdAsync(int id)
    {
        var e = await _employees.GetByIdAsync(id);
        if (e is null) return null;

        var isAdmin = await _userManager.IsInRoleAsync(e, "Admin");

        return new EmployeeDto
        {
            Id = e.Id,
            FullName = e.FullName,
            Title = e.Title,
            JobRole = e.JobRole,
            AvatarUrl = e.AvatarUrl,
            ManagerId = e.ManagerId,
            FunctionalManagerId = e.FunctionalManagerId,
            DepartmentId = e.DepartmentId ?? 0,
            Department = e.Department?.Name ?? "",
            AppEmail = e.APPEmail,
            HrmsEmail = e.HRMSEmail,
            IsAdmin = isAdmin
        };
    }

    public async Task<EmployeeDto> CreateAsync(CreateEmployeeDto dto, string username)
    {
        var entity = new Employee
        {
            FullName = dto.FullName,
            Title = dto.Title,
            JobRole = dto.JobRole,
            AvatarUrl = dto.AvatarUrl,
            ManagerId = dto.ManagerId,
            FunctionalManagerId = dto.FunctionalManagerId,
            DepartmentId = dto.DepartmentId,
            APPEmail = dto.APPEmail,
            HRMSEmail = dto.HRMSEmail,
            UserName = dto.APPEmail,
            Email = dto.APPEmail,
            NormalizedEmail = dto.APPEmail.ToUpperInvariant(),
            NormalizedUserName = dto.APPEmail.ToUpperInvariant(),
            CreatedBy = username
        };

        var created = await _employees.AddAsync(entity);
        return new EmployeeDto
        {
            Id = created.Id,
            FullName = created.FullName,
            Title = created.Title,
            JobRole = created.JobRole,
            AvatarUrl = created.AvatarUrl,
            ManagerId = created.ManagerId,
            FunctionalManagerId = created.FunctionalManagerId,
            DepartmentId = created.DepartmentId ?? 0,
            Department = created.Department?.Name ?? "",
            AppEmail = created.APPEmail,
            HrmsEmail = created.HRMSEmail
        };
    }

    /// <summary>Returns false if no employee with this id exists. Throws InvalidOperationException
    /// if the update would make the employee their own manager/functional manager.</summary>
    public async Task<bool> UpdateAsync(int id, UpdateEmployeeDto dto, string username)
    {
        if (dto.ManagerId == id)
        {
            throw new InvalidOperationException("An employee cannot report to themselves.");
        }
        if (dto.FunctionalManagerId == id)
        {
            throw new InvalidOperationException("An employee cannot be their own Functional Manager.");
        }

        var entity = new Employee
        {
            FullName = dto.FullName,
            Title = dto.Title,
            JobRole = dto.JobRole,
            AvatarUrl = dto.AvatarUrl,
            ManagerId = dto.ManagerId,
            FunctionalManagerId = dto.FunctionalManagerId,
            DepartmentId = dto.DepartmentId,
            APPEmail = dto.APPEmail,
            HRMSEmail = dto.HRMSEmail,
            ModifiedBy = username
        };

        var updated = await _employees.UpdateAsync(id, entity);
        return updated is not null;
    }

    /// <summary>Returns false if no employee with this id exists. Throws InvalidOperationException
    /// if the new manager would be the employee themselves.</summary>
    public async Task<bool> UpdateManagerAsync(int id, int? managerId)
    {
        if (managerId == id)
        {
            throw new InvalidOperationException("An employee cannot report to themselves.");
        }

        var existing = await _employees.GetByIdAsync(id);
        if (existing is null) return false;

        existing.ManagerId = managerId;

        var updated = await _employees.UpdateAsync(id, existing);
        return updated is not null;
    }

    public async Task<(UpdateAdminRoleOutcome outcome, bool isAdmin)> UpdateAdminRoleAsync(int id, bool makeAdmin, int? callerId)
    {
        var employee = await _userManager.FindByIdAsync(id.ToString());
        if (employee is null) return (UpdateAdminRoleOutcome.NotFound, false);

        var isCurrentlyAdmin = await _userManager.IsInRoleAsync(employee, "Admin");
        if (makeAdmin == isCurrentlyAdmin)
        {
            return (UpdateAdminRoleOutcome.Applied, isCurrentlyAdmin);
        }

        if (!makeAdmin)
        {
            if (callerId.HasValue && callerId.Value == id)
            {
                return (UpdateAdminRoleOutcome.CannotRemoveSelf, isCurrentlyAdmin);
            }

            var adminCount = (await _userManager.GetUsersInRoleAsync("Admin")).Count;
            if (adminCount <= 1)
            {
                return (UpdateAdminRoleOutcome.CannotRemoveLastAdmin, isCurrentlyAdmin);
            }

            await _userManager.RemoveFromRoleAsync(employee, "Admin");
        }
        else
        {
            await _userManager.AddToRoleAsync(employee, "Admin");
        }

        return (UpdateAdminRoleOutcome.Applied, makeAdmin);
    }

    /// <summary>Returns false if no employee with this id exists.</summary>
    public async Task<bool> DeleteAsync(int id, int? reassignManagerId)
    {
        return await _employees.DeleteAsync(id, reassignManagerId);
    }

    /// <summary>Never throws - any failure partway through is reported inside the returned
    /// DTO's Success/Message fields instead. Wipes and replaces every Employee/Department/
    /// OrgReporting/EmpDepartment row with the imported set.</summary>
    public async Task<BulkImportResultDto> ImportBulkAsync(List<BulkImportEmployeeDto> employees)
    {
        try
        {
            // Clear existing OrgReportings first
            var existingReportings = await _db.OrgReportings.ToListAsync();
            _db.OrgReportings.RemoveRange(existingReportings);
            await _db.SaveChangesAsync();

            // Clear existing EmpDepartments
            var existingEmpDepts = await _db.EmpDepartments.ToListAsync();
            _db.EmpDepartments.RemoveRange(existingEmpDepts);
            await _db.SaveChangesAsync();

            // Clear existing employees and departments
            var existingEmployees = await _db.Employees.ToListAsync();
            _db.Employees.RemoveRange(existingEmployees);
            await _db.SaveChangesAsync();

            var existingDepartments = await _db.Departments.ToListAsync();
            _db.Departments.RemoveRange(existingDepartments);
            await _db.SaveChangesAsync();

            var departmentCache = new Dictionary<string, Department>(StringComparer.OrdinalIgnoreCase);

            // Loop 1: Add departments first
            foreach (var item in employees)
            {
                var deptName = string.IsNullOrWhiteSpace(item.DepartmentName) ? "Default" : item.DepartmentName;
                var deptColor = string.IsNullOrWhiteSpace(item.DepartmentColor) ? "#64748B" : item.DepartmentColor;

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
            }
            await _db.SaveChangesAsync();

            // Find the Employee role ID in standard Identity roles
            var employeeRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "Employee");

            var stringIdToEmployeeMap = new Dictionary<string, Employee>(StringComparer.OrdinalIgnoreCase);
            int importedCount = 0;
            int skippedCount = 0;

            foreach (var item in employees)
            {
                var deptName = string.IsNullOrWhiteSpace(item.DepartmentName) ? "Default" : item.DepartmentName;
                var deptEntity = departmentCache[deptName];

                string email = item.APPEmail ?? "";
                if (string.IsNullOrWhiteSpace(email))
                {
                    skippedCount++;
                    continue; // Skip employee if they do not have a valid App Email
                }

                var empEntity = new Employee
                {
                    FullName = item.FullName,
                    Title = item.Title,
                    AvatarUrl = item.AvatarUrl,
                    APPEmail = email,
                    HRMSEmail = item.HRMSEmail,
                    Email = email,
                    NormalizedEmail = email.ToUpperInvariant(),
                    UserName = email,
                    NormalizedUserName = email.ToUpperInvariant(),
                    SecurityStamp = Guid.NewGuid().ToString(),
                    EmailConfirmed = true
                };

                _db.Employees.Add(empEntity);
                stringIdToEmployeeMap[item.Id] = empEntity;
                importedCount++;
            }
            await _db.SaveChangesAsync();

            // Link employees to their departments via EmpDepartments
            foreach (var item in employees)
            {
                if (stringIdToEmployeeMap.TryGetValue(item.Id, out var empEntity))
                {
                    var deptName = string.IsNullOrWhiteSpace(item.DepartmentName) ? "Default" : item.DepartmentName;
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
                foreach (var empEntity in stringIdToEmployeeMap.Values)
                {
                    _db.UserRoles.Add(new IdentityUserRole<int>
                    {
                        UserId = empEntity.Id,
                        RoleId = employeeRole.Id
                    });
                }
            }
            await _db.SaveChangesAsync();

            // Loop 3: Resolve Manager relationships using OrgReporting
            var fullNameToEmployeeMap = new Dictionary<string, Employee>(StringComparer.OrdinalIgnoreCase);
            foreach (var emp in stringIdToEmployeeMap.Values)
            {
                fullNameToEmployeeMap[emp.FullName] = emp;
            }

            foreach (var item in employees)
            {
                if (!string.IsNullOrWhiteSpace(item.ManagerId))
                {
                    if (stringIdToEmployeeMap.TryGetValue(item.Id, out var employeeEntity))
                    {
                        Employee? managerEntity = null;
                        if (stringIdToEmployeeMap.TryGetValue(item.ManagerId, out var matchedManager))
                        {
                            managerEntity = matchedManager;
                        }
                        else if (fullNameToEmployeeMap.TryGetValue(item.ManagerId, out var managerByName))
                        {
                            managerEntity = managerByName;
                        }

                        if (managerEntity != null)
                        {
                            _db.OrgReportings.Add(new OrgReporting
                            {
                                EmployeeId = employeeEntity.Id,
                                ManagerId = managerEntity.Id,
                                ReportingType = "Direct"
                            });
                        }
                    }
                }
            }
            await _db.SaveChangesAsync();

            return new BulkImportResultDto
            {
                Success = true,
                Message = skippedCount > 0
                    ? $"Successfully imported {importedCount} employees ({skippedCount} skipped due to missing App Email) and {departmentCache.Count} departments!"
                    : $"Successfully imported {importedCount} employees and {departmentCache.Count} departments!",
                ImportedCount = importedCount
            };
        }
        catch (Exception ex)
        {
            return new BulkImportResultDto
            {
                Success = false,
                Message = $"Bulk import failed: {ex.Message}"
            };
        }
    }
}
