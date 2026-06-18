using Microsoft.AspNetCore.Mvc;
using OrgChart.Api.Dtos;
using OrgChart.Api.Repositories;

namespace OrgChart.Api.Controllers;

[ApiController]
[Route("api/departments")]
public class DepartmentsController : ControllerBase
{
    private readonly IDepartmentRepository _departments;

    public DepartmentsController(IDepartmentRepository departments)
    {
        _departments = departments;
    }

    [HttpGet]
    public async Task<ActionResult<List<DepartmentDto>>> GetAll()
    {
        var all = await _departments.GetAllAsync();
        var result = all.Select(d => new DepartmentDto
        {
            Id = d.Id,
            Name = d.Name,
            ColorHex = d.ColorHex,
            EmployeeCount = d.Employees.Count
        }).ToList();

        return Ok(result);
    }
}
