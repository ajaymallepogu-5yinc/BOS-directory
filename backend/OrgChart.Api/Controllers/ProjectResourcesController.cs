using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OrgChart.Services;
using OrgChart.Services.Dtos;

namespace OrgChart.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class ProjectResourcesController : ControllerBase
{
    private readonly ProjectResourceService _resourceService;

    public ProjectResourcesController(ProjectResourceService resourceService)
    {
        _resourceService = resourceService;
    }

    [HttpGet("projects/{projectId:int}/resources")]
    public async Task<ActionResult<List<ProjectResourceDto>>> GetForProject(int projectId)
    {
        return Ok(await _resourceService.GetForProjectAsync(projectId));
    }

    [HttpPost("projects/{projectId:int}/resources")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ProjectResourceDto>> Add(int projectId, CreateProjectResourceDto dto)
    {
        var username = User.Identity?.Name ?? "System";
        try
        {
            var resource = await _resourceService.AddAsync(projectId, dto.EmployeeId, dto.IsBillable, username);
            if (resource == null) return NotFound(new { message = "Project not found." });
            return Ok(resource);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("project-resources/{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateBillable(int id, UpdateProjectResourceDto dto)
    {
        var username = User.Identity?.Name ?? "System";
        var updated = await _resourceService.UpdateBillableAsync(id, dto.IsBillable, username);
        if (!updated) return NotFound();
        return NoContent();
    }

    [HttpDelete("project-resources/{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Remove(int id)
    {
        var username = User.Identity?.Name ?? "System";
        var removed = await _resourceService.RemoveAsync(id, username);
        if (!removed) return NotFound();
        return NoContent();
    }
}
