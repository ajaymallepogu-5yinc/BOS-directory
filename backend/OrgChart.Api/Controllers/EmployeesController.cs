using Microsoft.AspNetCore.Mvc;
using OrgChart.Api.Dtos;
using OrgChart.Api.Models;
using OrgChart.Api.Repositories;

namespace OrgChart.Api.Controllers;

[ApiController]
[Route("api/employees")]
public class EmployeesController : ControllerBase
{
    private readonly IEmployeeRepository _employees;

    public EmployeesController(IEmployeeRepository employees)
    {
        _employees = employees;
    }

    /// <summary>GET /api/employees - flat list for the admin table.</summary>
    [HttpGet]
    public async Task<ActionResult<List<EmployeeDto>>> GetAll()
    {
        var all = await _employees.GetAllAsync();
        var lookup = all.ToDictionary(e => e.Id, e => e.FullName);

        var result = all.Select(e => new EmployeeDto
        {
            Id = e.Id,
            FullName = e.FullName,
            Title = e.Title,
            Company = e.Company,
            AvatarUrl = e.AvatarUrl,
            ManagerId = e.ManagerId,
            ManagerName = e.ManagerId.HasValue && lookup.TryGetValue(e.ManagerId.Value, out var name) ? name : null,
            DepartmentId = e.DepartmentId,
            Department = e.Department?.Name ?? ""
        }).ToList();

        return Ok(result);
    }

    /// <summary>GET /api/employees/managers - lightweight list for the "Reports to" dropdown.</summary>
    [HttpGet("managers")]
    public async Task<ActionResult<List<ManagerOptionDto>>> GetManagerOptions()
    {
        var all = await _employees.GetAllAsync();
        return Ok(all.Select(e => new ManagerOptionDto { Id = e.Id, FullName = e.FullName, Title = e.Title }).ToList());
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<EmployeeDto>> GetById(int id)
    {
        var e = await _employees.GetByIdAsync(id);
        if (e is null) return NotFound();

        return Ok(new EmployeeDto
        {
            Id = e.Id,
            FullName = e.FullName,
            Title = e.Title,
            Company = e.Company,
            AvatarUrl = e.AvatarUrl,
            ManagerId = e.ManagerId,
            DepartmentId = e.DepartmentId,
            Department = e.Department?.Name ?? ""
        });
    }

    [HttpPost]
    public async Task<ActionResult<EmployeeDto>> Create(CreateEmployeeDto dto)
    {
        if (!_employees.SupportsWrites)
            return Conflict("Employees are sourced from the HR portal in this environment. Add the employee there instead.");

        var entity = new Employee
        {
            FullName = dto.FullName,
            Title = dto.Title,
            Company = dto.Company,
            AvatarUrl = dto.AvatarUrl,
            ManagerId = dto.ManagerId,
            DepartmentId = dto.DepartmentId
        };

        var created = await _employees.AddAsync(entity);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UpdateEmployeeDto dto)
    {
        if (!_employees.SupportsWrites)
            return Conflict("Employees are sourced from the HR portal in this environment. Edit the employee there instead.");

        if (dto.ManagerId == id)
            return BadRequest("An employee cannot report to themselves.");

        var entity = new Employee
        {
            FullName = dto.FullName,
            Title = dto.Title,
            Company = dto.Company,
            AvatarUrl = dto.AvatarUrl,
            ManagerId = dto.ManagerId,
            DepartmentId = dto.DepartmentId
        };

        var updated = await _employees.UpdateAsync(id, entity);
        if (updated is null) return NotFound();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (!_employees.SupportsWrites)
            return Conflict("Employees are sourced from the HR portal in this environment. Remove the employee there instead.");

        var ok = await _employees.DeleteAsync(id);
        if (!ok) return NotFound();
        return NoContent();
    }
}
