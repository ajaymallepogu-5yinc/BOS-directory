using Microsoft.EntityFrameworkCore;
using OrgChart.Api.Data;
using OrgChart.Api.Models;

namespace OrgChart.Api.Repositories;

public class DynamicDepartmentRepository : IDepartmentRepository
{
    private readonly AppDbContext _db;
    private readonly EfDepartmentRepository _efRepo;
    private readonly IEmployeeRepository _employeeRepository;

    public DynamicDepartmentRepository(
        AppDbContext db,
        EfDepartmentRepository efRepo,
        IEmployeeRepository employeeRepository)
    {
        _db = db;
        _efRepo = efRepo;
        _employeeRepository = employeeRepository;
    }

    public async Task<List<Department>> GetAllAsync()
    {
        var config = await _db.DataSourceConfigs.FirstOrDefaultAsync();
        if (config != null && config.Mode == "HrPortalApi")
        {
            var employees = await _employeeRepository.GetAllAsync();
            var departments = employees
                .Where(e => e.Department != null)
                .GroupBy(e => e.DepartmentId)
                .Select(g =>
                {
                    var dept = g.First().Department!;
                    dept.Employees = g.ToList();
                    return dept;
                })
                .ToList();
            return departments;
        }

        return await _efRepo.GetAllAsync();
    }

    public async Task<Department?> GetByIdAsync(int id)
    {
        var all = await GetAllAsync();
        return all.FirstOrDefault(d => d.Id == id);
    }
}
