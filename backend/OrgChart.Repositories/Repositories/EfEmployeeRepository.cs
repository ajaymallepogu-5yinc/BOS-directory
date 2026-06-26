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

    public async Task<List<Employee>> GetAllAsync()
    {
        var list = await _db.Employees
            .Include(e => e.EmpDepartments)
            .ThenInclude(ed => ed.Department)
            .ToListAsync();

        var reportings = await _db.OrgReportings.ToListAsync();

        foreach (var emp in list)
        {
            var directReport = reportings.FirstOrDefault(o => o.EmployeeId == emp.Id && o.ReportingType == "Direct");
            emp.ManagerId = directReport?.ManagerId;

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

        // Default to Employee role if not set
        if (!employee.APPRoleId.HasValue)
        {
            var employeeRole = await _db.AppRoles.FirstOrDefaultAsync(r => r.Name == "Employee");
            employee.APPRoleId = employeeRole?.Id ?? 2;
        }

        _db.Employees.Add(employee);
        await _db.SaveChangesAsync(); // Generates employee.Id

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
        existing.APPRoleId = updated.APPRoleId;
        existing.HRMSEmail = updated.HRMSEmail;
        
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
                _db.OrgReportings.Remove(currentReporting);
            }
        }

        await _db.SaveChangesAsync();
        return existing;
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var existing = await _db.Employees.FirstOrDefaultAsync(e => e.Id == id);
        if (existing is null) return false;

        // Remove matrix reporting records referring to this employee
        var reportings = await _db.OrgReportings
            .Where(o => o.EmployeeId == id || o.ManagerId == id)
            .ToListAsync();
        _db.OrgReportings.RemoveRange(reportings);

        // Remove EmpDepartment associations
        var depts = await _db.EmpDepartments.Where(ed => ed.EmployeeId == id).ToListAsync();
        _db.EmpDepartments.RemoveRange(depts);

        await _db.SaveChangesAsync();

        // Re-parent direct reports in OrgReporting to the deleted person's own manager instead of orphaning them.
        var directReportOfThisEmployee = await _db.OrgReportings
            .FirstOrDefaultAsync(o => o.EmployeeId == id && o.ReportingType == "Direct");
        var myManagerId = directReportOfThisEmployee?.ManagerId;

        var myDirectReports = await _db.OrgReportings
            .Where(o => o.ManagerId == id && o.ReportingType == "Direct")
            .ToListAsync();

        foreach (var report in myDirectReports)
        {
            if (myManagerId.HasValue)
            {
                report.ManagerId = myManagerId.Value;
            }
            else
            {
                _db.OrgReportings.Remove(report);
            }
        }

        var myFunctionalReports = await _db.OrgReportings
            .Where(o => o.ManagerId == id && o.ReportingType == "Functional")
            .ToListAsync();
        _db.OrgReportings.RemoveRange(myFunctionalReports);

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
