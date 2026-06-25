using Microsoft.EntityFrameworkCore;
using OrgChart.Repositories.Data;
using OrgChart.Domain;

namespace OrgChart.Repositories;

public class DynamicEmployeeRepository : IEmployeeRepository
{
    private readonly AppDbContext _db;
    private readonly EfEmployeeRepository _efRepo;
    private readonly HrPortalEmployeeRepository _hrRepo;

    public DynamicEmployeeRepository(
        AppDbContext db,
        EfEmployeeRepository efRepo,
        HrPortalEmployeeRepository hrRepo)
    {
        _db = db;
        _efRepo = efRepo;
        _hrRepo = hrRepo;
    }

    private async Task<IEmployeeRepository> GetActiveRepoAsync()
    {
        var config = await _db.DataSourceConfigs.FirstOrDefaultAsync();
        if (config != null && config.Mode == "HrPortalApi")
        {
            return _hrRepo;
        }
        return _efRepo;
    }

    public bool SupportsWrites
    {
        get
        {
            var config = _db.DataSourceConfigs.FirstOrDefault();
            if (config != null && config.Mode == "HrPortalApi")
            {
                return false;
            }
            return true;
        }
    }

    public async Task<List<Employee>> GetAllAsync()
    {
        var repo = await GetActiveRepoAsync();
        return await repo.GetAllAsync();
    }

    public async Task<Employee?> GetByIdAsync(int id)
    {
        var repo = await GetActiveRepoAsync();
        return await repo.GetByIdAsync(id);
    }

    public async Task<Employee> AddAsync(Employee employee)
    {
        var repo = await GetActiveRepoAsync();
        return await repo.AddAsync(employee);
    }

    public async Task<Employee?> UpdateAsync(int id, Employee updated)
    {
        var repo = await GetActiveRepoAsync();
        return await repo.UpdateAsync(id, updated);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var repo = await GetActiveRepoAsync();
        return await repo.DeleteAsync(id);
    }
}
