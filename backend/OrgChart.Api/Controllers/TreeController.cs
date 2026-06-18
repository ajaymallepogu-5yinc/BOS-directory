using Microsoft.AspNetCore.Mvc;
using OrgChart.Api.Repositories;
using OrgChart.Api.Services;

namespace OrgChart.Api.Controllers;

[ApiController]
[Route("api/tree")]
public class TreeController : ControllerBase
{
    private readonly IEmployeeRepository _employees;
    private readonly IOrgTreeBuilder _treeBuilder;

    public TreeController(IEmployeeRepository employees, IOrgTreeBuilder treeBuilder)
    {
        _employees = employees;
        _treeBuilder = treeBuilder;
    }

    /// <summary>GET /api/tree/company - the whole company, CEO down to individual contributors.</summary>
    [HttpGet("company")]
    public async Task<IActionResult> GetCompanyTree()
    {
        var all = await _employees.GetAllAsync();
        return Ok(_treeBuilder.BuildCompanyTree(all));
    }

    /// <summary>GET /api/tree/department/3 - just one department's slice of the org.</summary>
    [HttpGet("department/{departmentId:int}")]
    public async Task<IActionResult> GetDepartmentTree(int departmentId)
    {
        var all = await _employees.GetAllAsync();
        return Ok(_treeBuilder.BuildDepartmentTree(all, departmentId));
    }
}
