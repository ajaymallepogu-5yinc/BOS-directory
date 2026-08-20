using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OrgChart.Domain;
using OrgChart.Services;

namespace OrgChart.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RolesController : ControllerBase
{
    private readonly RoleService _roleService;

    public RolesController(RoleService roleService)
    {
        _roleService = roleService;
    }

    [HttpGet("tracks")]
    public ActionResult<List<CareerTrack>> GetTracks()
    {
        return Ok(_roleService.GetTracks());
    }

    [HttpGet("employee/{id}")]
    public async Task<ActionResult<EmployeeCareerMapping>> GetEmployeeCareer(int id)
    {
        var mapping = await _roleService.GetEmployeeCareerAsync(id);
        if (mapping == null)
        {
            return NotFound(new { message = "Employee not found." });
        }

        return Ok(mapping);
    }
}
