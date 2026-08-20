using OrgChart.Domain;
using OrgChart.Repositories;
using OrgChart.Services.Dtos;

namespace OrgChart.Services;

public class ProjectResourceService
{
    private readonly EfProjectResourceRepository _resources;
    private readonly EfProjectRepository _projects;

    public ProjectResourceService(EfProjectResourceRepository resources, EfProjectRepository projects)
    {
        _resources = resources;
        _projects = projects;
    }

    public async Task<List<ProjectResourceDto>> GetForProjectAsync(int projectId)
    {
        var resources = await _resources.GetForProjectAsync(projectId);
        return resources.Select(ToDto).ToList();
    }

    /// <summary>Returns null if the project doesn't exist, or if this employee is already a
    /// resource on it (the query filter already excludes any earlier removed/soft-deleted
    /// assignment, so re-adding someone after removal is just a fresh row, not a conflict).</summary>
    public async Task<ProjectResourceDto?> AddAsync(int projectId, int employeeId, bool isBillable, string username)
    {
        var projectExists = await _projects.ExistsAsync(projectId);
        if (!projectExists) return null;

        var alreadyResourced = await _resources.ExistsAsync(projectId, employeeId);
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
        var created = await _resources.AddAsync(resource);
        return ToDto(created);
    }

    public async Task<bool> UpdateBillableAsync(int id, bool isBillable, string username) =>
        await _resources.UpdateBillableAsync(id, isBillable, username);

    public async Task<bool> RemoveAsync(int id, string username) =>
        await _resources.SoftDeleteAsync(id, username);

    private static ProjectResourceDto ToDto(ProjectResource r) => new()
    {
        Id = r.Id,
        ProjectId = r.ProjectId,
        EmployeeId = r.EmployeeId,
        EmployeeName = r.Employee?.FullName ?? "",
        IsBillable = r.IsBillable,
        CreatedAt = r.DateCreated
    };
}
