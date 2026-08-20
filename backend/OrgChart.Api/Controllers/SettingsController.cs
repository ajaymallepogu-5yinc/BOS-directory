using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OrgChart.Services;
using OrgChart.Services.Dtos;

namespace OrgChart.Api.Controllers;

[ApiController]
[Route("api/settings")]
[Authorize(Roles = "Admin")]
public class SettingsController : ControllerBase
{
    private readonly SettingsService _settingsService;

    public SettingsController(SettingsService settingsService)
    {
        _settingsService = settingsService;
    }

    [HttpGet]
    public async Task<ActionResult<SettingsDto>> GetSettings()
    {
        return Ok(await _settingsService.GetSettingsAsync());
    }

    [HttpPost]
    public async Task<IActionResult> UpdateSettings(UpdateSettingsDto dto)
    {
        await _settingsService.UpdateSettingsAsync(dto);
        return NoContent();
    }

    [HttpPost("test")]
    public async Task<ActionResult<TestConnectionResultDto>> TestConnection(TestConnectionDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.ApiUrl))
        {
            return Ok(new TestConnectionResultDto
            {
                Success = false,
                Message = "API URL is required."
            });
        }

        return Ok(await _settingsService.TestConnectionAsync(dto));
    }

    [HttpPost("import")]
    public async Task<ActionResult<ImportResultDto>> ImportEmployees(TestConnectionDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.ApiUrl))
        {
            return BadRequest("API URL is required.");
        }

        return Ok(await _settingsService.ImportEmployeesAsync(dto));
    }
}
