using Microsoft.EntityFrameworkCore;
using OrgChart.Domain;
using OrgChart.Repositories.Data;
using OrgChart.Services.Dtos;

namespace OrgChart.Services;

public class ProjectResourceService
{
    private readonly AppDbContext _db;

    public ProjectResourceService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<ProjectResourceDto>> GetForProjectAsync(int projectId)
    {
        return await _db.ProjectResources
            .Include(r => r.Employee)
            .Where(r => r.ProjectId == projectId)
            .OrderBy(r => r.Employee!.FullName)
            .Select(r => new ProjectResourceDto
            {
                Id = r.Id,
                ProjectId = r.ProjectId,
                EmployeeId = r.EmployeeId,
                EmployeeName = r.Employee!.FullName,
                IsBillable = r.IsBillable,
                CreatedAt = r.DateCreated
            })
            .ToListAsync();
    }

    /// <summary>Returns null if the project doesn't exist, or if this employee is already a
    /// resource on it (the query filter already excludes any earlier removed/soft-deleted
    /// assignment, so re-adding someone after removal is just a fresh row, not a conflict).</summary>
    public async Task<ProjectResourceDto?> AddAsync(int projectId, int employeeId, bool isBillable, string username)
    {
        var projectExists = await _db.Projects.AnyAsync(p => p.Id == projectId);
        if (!projectExists) return null;

        var alreadyResourced = await _db.ProjectResources.AnyAsync(r => r.ProjectId == projectId && r.EmployeeId == employeeId);
        if (alreadyResourced)
        {
            throw new InvalidOperationException("This employee is already a resource on this project.");
        }

        var resource = new ProjectResource
        {
            ProjectId = projectId,
            EmployeeId = employeeId,
            IsBillable = isBillable,
            CreatedBy = username,
            DateCreated = DateTime.UtcNow
        };
        _db.ProjectResources.Add(resource);
        await _db.SaveChangesAsync();

        var employee = await _db.Users.FirstOrDefaultAsync(u => u.Id == employeeId);
        return new ProjectResourceDto
        {
            Id = resource.Id,
            ProjectId = resource.ProjectId,
            EmployeeId = resource.EmployeeId,
            EmployeeName = employee?.FullName ?? "",
            IsBillable = resource.IsBillable,
            CreatedAt = resource.DateCreated
        };
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

    public async Task<bool> RemoveAsync(int id, string username)
    {
        var resource = await _db.ProjectResources.FirstOrDefaultAsync(r => r.Id == id);
        if (resource == null) return false;

        resource.IsDeleted = true;
        resource.ModifiedBy = username;
        resource.DateDeleted = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return true;
    }
}
