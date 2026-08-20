using Microsoft.EntityFrameworkCore;
using OrgChart.Domain;
using OrgChart.Repositories.Data;

namespace OrgChart.Repositories;

public class EfProjectRepository
{
    private readonly AppDbContext _db;

    public EfProjectRepository(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<Project>> GetAllAsync(bool? isActive, int? clientId)
    {
        var query = _db.Projects
            .Include(p => p.ProjectManager)
            .Include(p => p.Client)
            .AsQueryable();

        if (isActive.HasValue) query = query.Where(p => p.IsActive == isActive.Value);
        if (clientId.HasValue) query = query.Where(p => p.ClientId == clientId.Value);

        return await query.OrderByDescending(p => p.CreatedAt).ToListAsync();
    }

    public Task<Project?> GetByIdAsync(int id) =>
        _db.Projects.FirstOrDefaultAsync(p => p.Id == id);

    public Task<bool> ExistsAsync(int id) =>
        _db.Projects.AnyAsync(p => p.Id == id);

    public Task<Project?> GetByJiraProjectKeyAsync(string jiraProjectKey) =>
        _db.Projects.FirstOrDefaultAsync(p => p.JiraProjectKey == jiraProjectKey);

    public async Task<Project> AddAsync(Project project)
    {
        _db.Projects.Add(project);
        await _db.SaveChangesAsync();

        if (project.ProjectManagerId.HasValue)
        {
            project.ProjectManager = await _db.Users.FirstOrDefaultAsync(u => u.Id == project.ProjectManagerId.Value);
        }
        if (project.ClientId.HasValue)
        {
            project.Client = await _db.Clients.FirstOrDefaultAsync(c => c.Id == project.ClientId.Value);
        }

        return project;
    }

    public void TrackNew(Project project) => _db.Projects.Add(project);

    public async Task<Project?> UpdateAsync(int id, Project updated)
    {
        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id);
        if (project == null) return null;

        project.Name = updated.Name;
        project.ProjectManagerId = updated.ProjectManagerId;
        project.ClientId = updated.ClientId;
        project.IsBillable = updated.IsBillable;
        project.IsActive = updated.IsActive;
        project.JiraBoardIds = updated.JiraBoardIds;
        project.UpdatedAt = DateTime.UtcNow;
        project.UpdatedBy = updated.UpdatedBy;

        await _db.SaveChangesAsync();
        return project;
    }

    public async Task<bool> SoftDeleteAsync(int id)
    {
        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id);
        if (project == null) return false;

        project.IsDeleted = true;
        project.DateDeleted = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<int?> FindEmployeeIdByEmailAsync(string email)
    {
        var employee = await _db.Users.FirstOrDefaultAsync(u => u.APPEmail.ToLower() == email.ToLower());
        return employee?.Id;
    }

    public Task SaveChangesAsync() => _db.SaveChangesAsync();
}
