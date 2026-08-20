using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using OrgChart.Domain;
using OrgChart.Services;
using OrgChart.Services.Dtos;

namespace OrgChart.Api.Controllers;

[ApiController]
[Route("api/timesheet")]
[Authorize]
public class TimesheetController : ControllerBase
{
    private readonly TimesheetService _timesheetService;
    private readonly UserManager<Employee> _userManager;

    public TimesheetController(TimesheetService timesheetService, UserManager<Employee> userManager)
    {
        _timesheetService = timesheetService;
        _userManager = userManager;
    }

    [HttpGet("tickets")]
    public async Task<ActionResult<List<JiraTicketDto>>> GetTickets([FromQuery] int projectId)
    {
        var currentId = GetCurrentEmployeeId();
        if (currentId == null) return Unauthorized();

        var result = await _timesheetService.GetTicketsAsync(projectId, currentId.Value);
        return result.Outcome switch
        {
            JiraTicketsOutcome.ProjectNotFound => NotFound(),
            JiraTicketsOutcome.EmployeeNotFound => Unauthorized(),
            JiraTicketsOutcome.ConfigMissing or JiraTicketsOutcome.JiraError =>
                StatusCode(result.ErrorStatusCode, new { success = false, message = result.ErrorMessage }),
            _ => Ok(result.Tickets)
        };
    }

    [HttpGet("entries")]
    public async Task<ActionResult<List<TimesheetEntryDto>>> GetEntries([FromQuery] string scope = "mine")
    {
        var currentId = GetCurrentEmployeeId();
        if (currentId == null) return Unauthorized();

        return Ok(await _timesheetService.GetEntriesAsync(currentId.Value, scope));
    }

    [HttpPost("entries")]
    public async Task<ActionResult<TimesheetEntryDto>> Create(CreateTimesheetEntryDto dto)
    {
        var currentId = GetCurrentEmployeeId();
        if (currentId == null) return Unauthorized();

        try
        {
            return Ok(await _timesheetService.CreateEntryAsync(currentId.Value, dto));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("entries/{id:int}")]
    public async Task<IActionResult> Update(int id, UpdateTimesheetEntryDto dto)
    {
        var currentId = GetCurrentEmployeeId();
        if (currentId == null) return Unauthorized();

        try
        {
            var outcome = await _timesheetService.UpdateEntryAsync(currentId.Value, id, dto);
            return outcome switch
            {
                EntryMutationOutcome.NotFound => NotFound(),
                EntryMutationOutcome.Forbidden => Forbid(),
                _ => NoContent()
            };
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("entries/{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var currentId = GetCurrentEmployeeId();
        if (currentId == null) return Unauthorized();

        try
        {
            var outcome = await _timesheetService.DeleteEntryAsync(currentId.Value, id);
            return outcome switch
            {
                EntryMutationOutcome.NotFound => NotFound(),
                EntryMutationOutcome.Forbidden => Forbid(),
                _ => NoContent()
            };
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("entries/submit-week")]
    public async Task<IActionResult> SubmitWeek(SubmitWeekDto dto)
    {
        var currentId = GetCurrentEmployeeId();
        if (currentId == null) return Unauthorized();

        var submittedCount = await _timesheetService.SubmitWeekAsync(currentId.Value, dto.WeekStart.Date);
        if (submittedCount == null)
        {
            return BadRequest(new { message = "No draft entries to submit for this week." });
        }

        return Ok(new { submittedCount = submittedCount.Value });
    }

    [HttpPut("{timesheetId:int}/review")]
    public async Task<IActionResult> Review(int timesheetId, ReviewTimesheetDto dto)
    {
        var currentId = GetCurrentEmployeeId();
        if (currentId == null) return Unauthorized();

        if (dto.Status != "Approved" && dto.Status != "Rejected")
        {
            return BadRequest(new { message = "Status must be 'Approved' or 'Rejected'." });
        }

        var callerEmployee = await _userManager.FindByIdAsync(currentId.Value.ToString());
        if (callerEmployee == null) return Unauthorized();

        var isAdmin = await _userManager.IsInRoleAsync(callerEmployee, "Admin");

        var outcome = await _timesheetService.ReviewAsync(timesheetId, dto.Status, dto.Comment, currentId.Value, callerEmployee.FullName, isAdmin);
        return outcome switch
        {
            ReviewOutcome.NotFound => NotFound(),
            ReviewOutcome.AlreadyReviewed => BadRequest(new { message = "This week has already been reviewed." }),
            ReviewOutcome.Forbidden => Forbid(),
            _ => NoContent()
        };
    }

    private int? GetCurrentEmployeeId()
    {
        var userId = _userManager.GetUserId(User);
        if (string.IsNullOrEmpty(userId) || !int.TryParse(userId, out var id)) return null;
        return id;
    }
}
