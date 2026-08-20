using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OrgChart.Services;
using OrgChart.Services.Dtos;

namespace OrgChart.Api.Controllers;

[ApiController]
[Route("api/projects")]
[Authorize]
public class ProjectsController : ControllerBase
{
    private readonly ProjectService _projectService;

    public ProjectsController(ProjectService projectService)
    {
        _projectService = projectService;
    }

    [HttpGet]
    public async Task<ActionResult<List<ProjectDto>>> GetAll([FromQuery] bool? isActive = null, [FromQuery] int? clientId = null)
    {
        return Ok(await _projectService.GetAllAsync(isActive, clientId));
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ProjectDto>> Create(CreateProjectDto dto)
    {
        var username = User.Identity?.Name ?? "System";
        var created = await _projectService.CreateAsync(dto, username);
        return CreatedAtAction(nameof(GetAll), new { }, created);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(int id, UpdateProjectDto dto)
    {
        var username = User.Identity?.Name ?? "System";
        var updated = await _projectService.UpdateAsync(id, dto, username);
        if (!updated) return NotFound();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await _projectService.DeleteAsync(id);
        if (!deleted) return NotFound();
        return NoContent();
    }

    [HttpPost("sync-jira")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SyncJira()
    {
        var username = User.Identity?.Name ?? "System";
        var (statusCode, result) = await _projectService.SyncJiraAsync(username);
        return StatusCode(statusCode, result);
    }
}
