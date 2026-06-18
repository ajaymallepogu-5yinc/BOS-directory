using OrgChart.Api.Models;

namespace OrgChart.Api.Repositories;

/// <summary>
/// Anything that can supply employee data to the rest of the app, regardless
/// of where that data actually lives. There are two implementations:
/// EfEmployeeRepository (our own DB, used for manual entry) and
/// HrPortalEmployeeRepository (reads from your existing HR system).
/// Controllers and services only ever talk to this interface, so swapping
/// the data source is a one-line config change, not a code change.
/// </summary>
public interface IEmployeeRepository
{
    Task<List<Employee>> GetAllAsync();
    Task<Employee?> GetByIdAsync(int id);

    /// <summary>True for sources that support writes (Local). HR portal mode is read-only by design -
    /// edits to real employee records should happen in the HR system, not be shadowed here.</summary>
    bool SupportsWrites { get; }

    Task<Employee> AddAsync(Employee employee);
    Task<Employee?> UpdateAsync(int id, Employee updated);
    Task<bool> DeleteAsync(int id);
}

public interface IDepartmentRepository
{
    Task<List<Department>> GetAllAsync();
    Task<Department?> GetByIdAsync(int id);
}
