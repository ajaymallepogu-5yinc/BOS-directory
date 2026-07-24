using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrgChart.Repositories.Data;
using OrgChart.Services.Dtos;
using OrgChart.Domain;
using OrgChart.Repositories;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace OrgChart.Api.Controllers;

[ApiController]
[Route("api/employees")]
[Authorize]
public class EmployeesController : ControllerBase
{
    private readonly IEmployeeRepository _employees;
    private readonly AppDbContext _db;
    private readonly UserManager<Employee> _userManager;

    public EmployeesController(IEmployeeRepository employees, AppDbContext db, UserManager<Employee> userManager)
    {
        _employees = employees;
        _db = db;
        _userManager = userManager;
    }

    /// <summary>GET /api/employees - flat list for the admin table.</summary>
    [HttpGet]
    public async Task<ActionResult<List<EmployeeDto>>> GetAll()
    {
        var all = await _employees.GetAllAsync();
        var functionalReportings = await _employees.GetAllAsync("Functional");
        var functionalLookup = functionalReportings.ToDictionary(e => e.Id, e => e.ManagerId);
        var lookup = all.ToDictionary(e => e.Id, e => e.FullName);
        var adminIds = (await _userManager.GetUsersInRoleAsync("Admin")).Select(u => u.Id).ToHashSet();

        var result = all.Select(e =>
        {
            var functionalManagerId = functionalLookup.TryGetValue(e.Id, out var fmId) ? fmId : null;
            return new EmployeeDto
            {
            Id = e.Id,
            FullName = e.FullName,
            Title = e.Title,
            Company = e.Company,
            AvatarUrl = e.AvatarUrl,
            ManagerId = e.ManagerId,
            ManagerName = e.ManagerId.HasValue && lookup.TryGetValue(e.ManagerId.Value, out var name) ? name : null,
            FunctionalManagerId = functionalManagerId,
            FunctionalManagerName = functionalManagerId.HasValue && lookup.TryGetValue(functionalManagerId.Value, out var fmName) ? fmName : null,
            DepartmentId = e.DepartmentId ?? 0,
            Department = e.Department?.Name ?? "",
            AppEmail = e.APPEmail,
            HrmsEmail = e.HRMSEmail,
            CardColor = e.CardColor,
            IsAdmin = adminIds.Contains(e.Id)
            };
        }).ToList();

        return Ok(result);
    }

    /// <summary>GET /api/employees/managers - lightweight list for the "Reports to" dropdown.</summary>
    [HttpGet("managers")]
    public async Task<ActionResult<List<ManagerOptionDto>>> GetManagerOptions()
    {
        var all = await _employees.GetAllAsync();
        return Ok(all.Select(e => new ManagerOptionDto { Id = e.Id, FullName = e.FullName, Title = e.Title }).ToList());
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<EmployeeDto>> GetById(int id)
    {
        var e = await _employees.GetByIdAsync(id);
        if (e is null) return NotFound();

        var isAdmin = await _userManager.IsInRoleAsync(e, "Admin");

        return Ok(new EmployeeDto
        {
            Id = e.Id,
            FullName = e.FullName,
            Title = e.Title,
            Company = e.Company,
            AvatarUrl = e.AvatarUrl,
            ManagerId = e.ManagerId,
            FunctionalManagerId = e.FunctionalManagerId,
            DepartmentId = e.DepartmentId ?? 0,
            Department = e.Department?.Name ?? "",
            AppEmail = e.APPEmail,
            HrmsEmail = e.HRMSEmail,
            CardColor = e.CardColor,
            IsAdmin = isAdmin
        });
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<EmployeeDto>> Create(CreateEmployeeDto dto)
    {
        if (!_employees.SupportsWrites)
            return Conflict("Employees are sourced from the HR portal in this environment. Add the employee there instead.");

        var entity = new Employee
        {
            FullName = dto.FullName,
            Title = dto.Title,
            Company = dto.Company,
            AvatarUrl = dto.AvatarUrl,
            ManagerId = dto.ManagerId,
            FunctionalManagerId = dto.FunctionalManagerId,
            DepartmentId = dto.DepartmentId,
            APPEmail = dto.APPEmail,
            HRMSEmail = dto.HRMSEmail,
            CardColor = dto.CardColor,
            UserName = dto.APPEmail,
            Email = dto.APPEmail,
            NormalizedEmail = dto.APPEmail.ToUpperInvariant(),
            NormalizedUserName = dto.APPEmail.ToUpperInvariant()
        };

        var created = await _employees.AddAsync(entity);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, new EmployeeDto
        {
            Id = created.Id,
            FullName = created.FullName,
            Title = created.Title,
            Company = created.Company,
            AvatarUrl = created.AvatarUrl,
            ManagerId = created.ManagerId,
            FunctionalManagerId = created.FunctionalManagerId,
            DepartmentId = created.DepartmentId ?? 0,
            Department = created.Department?.Name ?? "",
            AppEmail = created.APPEmail,
            HrmsEmail = created.HRMSEmail,
            CardColor = created.CardColor
        });
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(int id, UpdateEmployeeDto dto)
    {
        if (!_employees.SupportsWrites)
            return Conflict("Employees are sourced from the HR portal in this environment. Edit the employee there instead.");

        if (dto.ManagerId == id)
            return BadRequest("An employee cannot report to themselves.");
        if (dto.FunctionalManagerId == id)
            return BadRequest("An employee cannot be their own Functional Manager.");

        var entity = new Employee
        {
            FullName = dto.FullName,
            Title = dto.Title,
            Company = dto.Company,
            AvatarUrl = dto.AvatarUrl,
            ManagerId = dto.ManagerId,
            FunctionalManagerId = dto.FunctionalManagerId,
            DepartmentId = dto.DepartmentId,
            APPEmail = dto.APPEmail,
            HRMSEmail = dto.HRMSEmail,
            CardColor = dto.CardColor
        };

        var updated = await _employees.UpdateAsync(id, entity);
        if (updated is null) return NotFound();
        return NoContent();
    }

    [HttpPut("{id:int}/manager")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateManager(int id, [FromBody] UpdateManagerDto dto)
    {
        if (!_employees.SupportsWrites)
            return Conflict("Employees are sourced from the HR portal in this environment. Edit the employee there instead.");

        if (dto.ManagerId == id)
            return BadRequest("An employee cannot report to themselves.");

        var existing = await _employees.GetByIdAsync(id);
        if (existing is null) return NotFound();

        existing.ManagerId = dto.ManagerId;

        var updated = await _employees.UpdateAsync(id, existing);
        if (updated is null) return NotFound();
        return NoContent();
    }

    [HttpPut("{id:int}/admin-role")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateAdminRole(int id, [FromBody] UpdateAdminRoleDto dto)
    {
        var employee = await _userManager.FindByIdAsync(id.ToString());
        if (employee is null) return NotFound();

        var isCurrentlyAdmin = await _userManager.IsInRoleAsync(employee, "Admin");
        if (dto.IsAdmin == isCurrentlyAdmin)
        {
            return Ok(new { isAdmin = isCurrentlyAdmin });
        }

        if (!dto.IsAdmin)
        {
            var currentUserId = _userManager.GetUserId(User);
            if (currentUserId != null && int.TryParse(currentUserId, out var callerId) && callerId == id)
            {
                return BadRequest(new { message = "You cannot remove your own Admin role. Ask another admin to do this." });
            }

            var adminCount = (await _userManager.GetUsersInRoleAsync("Admin")).Count;
            if (adminCount <= 1)
            {
                return BadRequest(new { message = "Cannot remove the last remaining Admin." });
            }

            await _userManager.RemoveFromRoleAsync(employee, "Admin");
        }
        else
        {
            await _userManager.AddToRoleAsync(employee, "Admin");
        }

        return Ok(new { isAdmin = dto.IsAdmin });
    }

    /// <summary>DELETE /api/employees/5?reassignManagerId=3 - reassignManagerId re-parents this
    /// employee's direct/functional reports; omit it to leave them with no manager instead.</summary>
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id, [FromQuery] int? reassignManagerId)
    {
        if (!_employees.SupportsWrites)
            return Conflict("Employees are sourced from the HR portal in this environment. Remove the employee there instead.");

        if (reassignManagerId == id)
            return BadRequest(new { message = "An employee cannot be reassigned to report to themselves." });

        var ok = await _employees.DeleteAsync(id, reassignManagerId);
        if (!ok) return NotFound();
        return NoContent();
    }

    [HttpPost("import-bulk")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<BulkImportResultDto>> ImportBulk([FromBody] BulkImportDto dto)
    {
        if (dto == null || dto.Employees == null || dto.Employees.Count == 0)
        {
            return BadRequest(new BulkImportResultDto { Success = false, Message = "No employee records provided." });
        }

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
            foreach (var item in dto.Employees)
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

            foreach (var item in dto.Employees)
            {
                var deptName = string.IsNullOrWhiteSpace(item.DepartmentName) ? "Default" : item.DepartmentName;
                var deptEntity = departmentCache[deptName];

                string email = item.APPEmail;
                if (string.IsNullOrWhiteSpace(email))
                {
                    skippedCount++;
                    continue; // Skip employee if they do not have a valid App Email
                }

                var empEntity = new Employee
                {
                    FullName = item.FullName,
                    Title = item.Title,
                    Company = item.Company,
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
            foreach (var item in dto.Employees)
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
                    _db.UserRoles.Add(new Microsoft.AspNetCore.Identity.IdentityUserRole<int>
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

            foreach (var item in dto.Employees)
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

            return Ok(new BulkImportResultDto
            {
                Success = true,
                Message = skippedCount > 0 
                    ? $"Successfully imported {importedCount} employees ({skippedCount} skipped due to missing App Email) and {departmentCache.Count} departments!"
                    : $"Successfully imported {importedCount} employees and {departmentCache.Count} departments!",
                ImportedCount = importedCount
            });
        }
        catch (Exception ex)
        {
            return Ok(new BulkImportResultDto
            {
                Success = false,
                Message = $"Bulk import failed: {ex.Message}"
            });
        }
    }
}
