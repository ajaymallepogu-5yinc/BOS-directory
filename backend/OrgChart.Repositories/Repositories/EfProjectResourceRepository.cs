using Microsoft.EntityFrameworkCore;
using OrgChart.Domain;
using OrgChart.Repositories.Data;

namespace OrgChart.Repositories;

public class EfProjectResourceRepository
{
    private readonly AppDbContext _db;

    public EfProjectResourceRepository(AppDbContext db)
    {
        _db = db;
    }

    public Task<List<ProjectResource>> GetForProjectAsync(int projectId) =>
        _db.ProjectResources
            .Include(r => r.Employee)
            .Where(r => r.ProjectId == projectId)
            .OrderBy(r => r.Employee!.FullName)
            .ToListAsync();

    public Task<bool> ExistsAsync(int projectId, int employeeId) =>
        _db.ProjectResources.AnyAsync(r => r.ProjectId == projectId && r.EmployeeId == employeeId);

    public async Task<ProjectResource> AddAsync(ProjectResource resource)
    {
        _db.ProjectResources.Add(resource);
        await _db.SaveChangesAsync();

        resource.Employee = await _db.Users.FirstOrDefaultAsync(u => u.Id == resource.EmployeeId);
        return resource;
    }

    public async Task<bool> UpdateBillableAsync(int id, bool isBillable, string username)
    {
        var resource = await _db.ProjectResources.FirstOrDefaultAsync(r => r.Id == id);
        if (resource == null) return false;

        resource.IsBillable = isBillable;
        resource.ModifiedBy = username;
        resource.DateModified = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> SoftDeleteAsync(int id, string username)
    {
        var resource = await _db.ProjectResources.FirstOrDefaultAsync(r => r.Id == id);
        if (resource == null) return false;

        resource.IsDeleted = true;
        resource.ModifiedBy = username;
        resource.DateDeleted = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<Dictionary<int, int>> GetCountsByProjectAsync() =>
        await _db.ProjectResources
            .GroupBy(r => r.ProjectId)
            .Select(g => new { ProjectId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.ProjectId, x => x.Count);
}
