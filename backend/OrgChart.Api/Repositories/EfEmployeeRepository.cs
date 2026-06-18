using Microsoft.EntityFrameworkCore;
using OrgChart.Api.Data;
using OrgChart.Api.Models;

namespace OrgChart.Api.Repositories;

/// <summary>Data source used when employees are entered manually through the admin screen.</summary>
public class EfEmployeeRepository : IEmployeeRepository
{
    private readonly AppDbContext _db;

    public EfEmployeeRepository(AppDbContext db)
    {
        _db = db;
    }

    public bool SupportsWrites => true;

    public Task<List<Employee>> GetAllAsync() =>
        _db.Employees.Include(e => e.Department).AsNoTracking().ToListAsync();

    public Task<Employee?> GetByIdAsync(int id) =>
        _db.Employees.Include(e => e.Department).FirstOrDefaultAsync(e => e.Id == id);

    public async Task<Employee> AddAsync(Employee employee)
    {
        _db.Employees.Add(employee);
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
        existing.ManagerId = updated.ManagerId;
        existing.DepartmentId = updated.DepartmentId;

        await _db.SaveChangesAsync();
        return existing;
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var existing = await _db.Employees.FirstOrDefaultAsync(e => e.Id == id);
        if (existing is null) return false;

        // Re-parent direct reports to the deleted person's own manager instead of orphaning them.
        var reports = await _db.Employees.Where(e => e.ManagerId == id).ToListAsync();
        foreach (var report in reports)
        {
            report.ManagerId = existing.ManagerId;
        }

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
        _db.Departments.Include(d => d.Employees).AsNoTracking().ToListAsync();

    public Task<Department?> GetByIdAsync(int id) =>
        _db.Departments.FirstOrDefaultAsync(d => d.Id == id);
}
