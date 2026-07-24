using Microsoft.EntityFrameworkCore;
using OrgChart.Repositories.Data;
using OrgChart.Domain;

namespace OrgChart.Repositories;

/// <summary>Data source used when employees are entered manually through the admin screen.</summary>
public class EfEmployeeRepository : IEmployeeRepository
{
    private readonly AppDbContext _db;

    public EfEmployeeRepository(AppDbContext db)
    {
        _db = db;
    }

    public bool SupportsWrites => true;

    public async Task<List<Employee>> GetAllAsync(string reportingType = "Direct")
    {
        var list = await _db.Employees
            .Include(e => e.EmpDepartments)
            .ThenInclude(ed => ed.Department)
            .ToListAsync();

        var reportings = await _db.OrgReportings.ToListAsync();

        foreach (var emp in list)
        {
            var report = reportings.FirstOrDefault(o => o.EmployeeId == emp.Id && o.ReportingType == reportingType);
            emp.ManagerId = report?.ManagerId;

            var primaryDept = emp.EmpDepartments.FirstOrDefault();
            if (primaryDept != null)
            {
                emp.DepartmentId = primaryDept.DepartmentId;
                emp.Department = primaryDept.Department;
            }
        }

        return list;
    }

    public async Task<Employee?> GetByIdAsync(int id)
    {
        var emp = await _db.Employees
            .Include(e => e.EmpDepartments)
            .ThenInclude(ed => ed.Department)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (emp != null)
        {
            var directReport = await _db.OrgReportings.FirstOrDefaultAsync(o => o.EmployeeId == id && o.ReportingType == "Direct");
            emp.ManagerId = directReport?.ManagerId;

            var functionalReport = await _db.OrgReportings.FirstOrDefaultAsync(o => o.EmployeeId == id && o.ReportingType == "Functional");
            emp.FunctionalManagerId = functionalReport?.ManagerId;

            var primaryDept = emp.EmpDepartments.FirstOrDefault();
            if (primaryDept != null)
            {
                emp.DepartmentId = primaryDept.DepartmentId;
                emp.Department = primaryDept.Department;
            }
        }

        return emp;
    }

    public async Task<Employee> AddAsync(Employee employee)
    {
        // Generate security stamp and credentials
        if (string.IsNullOrWhiteSpace(employee.UserName))
        {
            var emailName = employee.FullName.Replace(" ", "").Replace("'", "").ToLowerInvariant();
            var email = $"{emailName}@5yinc.com";
            employee.APPEmail = email;
            employee.Email = email;
            employee.NormalizedEmail = email.ToUpperInvariant();
            employee.UserName = email;
            employee.NormalizedUserName = email.ToUpperInvariant();
        }
        employee.SecurityStamp = Guid.NewGuid().ToString();
        employee.EmailConfirmed = true;

        _db.Employees.Add(employee);
        await _db.SaveChangesAsync(); // Generates employee.Id

        // Save standard Identity role link
        var employeeRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "Employee");
        if (employeeRole != null)
        {
            _db.UserRoles.Add(new Microsoft.AspNetCore.Identity.IdentityUserRole<int>
            {
                UserId = employee.Id,
                RoleId = employeeRole.Id
            });
        }

        // Save department link
        if (employee.DepartmentId.HasValue)
        {
            _db.EmpDepartments.Add(new EmpDepartment
            {
                EmployeeId = employee.Id,
                DepartmentId = employee.DepartmentId.Value
            });
        }

        // Save direct manager link
        if (employee.ManagerId.HasValue)
        {
            _db.OrgReportings.Add(new OrgReporting
            {
                EmployeeId = employee.Id,
                ManagerId = employee.ManagerId.Value,
                ReportingType = "Direct"
            });
        }

        // Save functional manager link (dotted-line, independent of the direct manager above)
        if (employee.FunctionalManagerId.HasValue)
        {
            _db.OrgReportings.Add(new OrgReporting
            {
                EmployeeId = employee.Id,
                ManagerId = employee.FunctionalManagerId.Value,
                ReportingType = "Functional"
            });
        }

        await _db.SaveChangesAsync();
        return employee;
    }

    public async Task<Employee?> UpdateAsync(int id, Employee updated)
    {
        var existing = await _db.Employees.FirstOrDefaultAsync(e => e.Id == id);
        if (existing is null) return null;

        existing.FullName = updated.FullName;
        existing.Title = updated.Title;
        existing.Company = updated.Company;
        existing.AvatarUrl = updated.AvatarUrl;
        existing.HRMSEmail = updated.HRMSEmail;
        existing.CardColor = updated.CardColor;
        existing.ModifiedBy = updated.ModifiedBy;
        existing.DateModified = DateTime.UtcNow;

        if (!string.IsNullOrWhiteSpace(updated.APPEmail))
        {
            existing.APPEmail = updated.APPEmail;
            existing.Email = updated.APPEmail;
            existing.NormalizedEmail = updated.APPEmail.ToUpperInvariant();
            existing.UserName = updated.APPEmail;
            existing.NormalizedUserName = updated.APPEmail.ToUpperInvariant();
        }

        // Update departments junction using updated.DepartmentId helper
        var currentDepts = await _db.EmpDepartments.Where(ed => ed.EmployeeId == id).ToListAsync();
        _db.EmpDepartments.RemoveRange(currentDepts);
        
        if (updated.DepartmentId.HasValue)
        {
            _db.EmpDepartments.Add(new EmpDepartment
            {
                EmployeeId = id,
                DepartmentId = updated.DepartmentId.Value
            });
        }

        // Update direct manager link in OrgReporting
        var currentReporting = await _db.OrgReportings
            .FirstOrDefaultAsync(o => o.EmployeeId == id && o.ReportingType == "Direct");
        
        if (updated.ManagerId.HasValue)
        {
            if (currentReporting == null)
            {
                _db.OrgReportings.Add(new OrgReporting
                {
                    EmployeeId = id,
                    ManagerId = updated.ManagerId.Value,
                    ReportingType = "Direct"
                });
            }
            else
            {
                currentReporting.ManagerId = updated.ManagerId.Value;
            }
        }
        else
        {
            if (currentReporting != null)
            {
                currentReporting.IsDeleted = true;
                currentReporting.DateDeleted = DateTime.UtcNow;
            }
        }

        // Update functional manager link in OrgReporting (mirrors the Direct block above)
        var currentFunctionalReporting = await _db.OrgReportings
            .FirstOrDefaultAsync(o => o.EmployeeId == id && o.ReportingType == "Functional");

        if (updated.FunctionalManagerId.HasValue)
        {
            if (currentFunctionalReporting == null)
            {
                _db.OrgReportings.Add(new OrgReporting
                {
                    EmployeeId = id,
                    ManagerId = updated.FunctionalManagerId.Value,
                    ReportingType = "Functional"
                });
            }
            else
            {
                currentFunctionalReporting.ManagerId = updated.FunctionalManagerId.Value;
            }
        }
        else
        {
            if (currentFunctionalReporting != null)
            {
                currentFunctionalReporting.IsDeleted = true;
                currentFunctionalReporting.DateDeleted = DateTime.UtcNow;
            }
        }

        await _db.SaveChangesAsync();
        return existing;
    }

    public async Task<bool> DeleteAsync(int id, int? reassignManagerId)
    {
        var existing = await _db.Employees.FirstOrDefaultAsync(e => e.Id == id);
        if (existing is null) return false;

        // OrgReporting rows are hard-removed here (not soft-deleted like the rest of this method's
        // usual policy) because Employee itself stays hard-delete, and OrgReporting's FKs to
        // AspNetUsers are Restrict - a soft-deleted row would still physically reference this
        // employee and block the delete below with a FK violation.

        // Re-parent this employee's own direct/functional reports onto reassignManagerId (chosen by
        // the caller, e.g. an admin prompt) instead of orphaning them - must happen BEFORE the report
        // rows below are deleted, otherwise there's nothing left to re-parent.
        var myReports = await _db.OrgReportings
            .Where(o => o.ManagerId == id && (o.ReportingType == "Direct" || o.ReportingType == "Functional"))
            .ToListAsync();

        foreach (var report in myReports)
        {
            // reassignManagerId is allowed to be one of this employee's own direct reports
            // (promoting them to manage their former siblings) - but that promoted person's own
            // row can't be re-pointed at themselves, so it's dropped instead, making them a root.
            if (reassignManagerId.HasValue && report.EmployeeId != reassignManagerId.Value)
            {
                report.ManagerId = reassignManagerId.Value;
            }
            else
            {
                _db.OrgReportings.Remove(report);
            }
        }

        // Remove this employee's own reporting link(s) - the rows above (where they're the manager)
        // are handled separately so myReports isn't touched by this broader EmployeeId-side match.
        var ownReportingLinks = await _db.OrgReportings
            .Where(o => o.EmployeeId == id)
            .ToListAsync();
        _db.OrgReportings.RemoveRange(ownReportingLinks);

        // Remove EmpDepartment associations
        var depts = await _db.EmpDepartments.Where(ed => ed.EmployeeId == id).ToListAsync();
        _db.EmpDepartments.RemoveRange(depts);

        _db.Employees.Remove(existing);
        await _db.SaveChangesAsync();
        return true;
    }
}

public class EfDepartmentRepository : IDepartmentRepository
{
    private readonly AppDbContext _db;

    public EfDepartmentRepository(AppDbContext db)
    {
        _db = db;
    }

    public Task<List<Department>> GetAllAsync() =>
        _db.Departments
            .Include(d => d.EmpDepartments)
            .ThenInclude(ed => ed.Employee)
            .AsNoTracking()
            .ToListAsync();

    public Task<Department?> GetByIdAsync(int id) =>
        _db.Departments.FirstOrDefaultAsync(d => d.Id == id);
}
