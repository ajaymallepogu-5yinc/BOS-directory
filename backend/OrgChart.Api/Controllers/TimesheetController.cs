using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrgChart.Domain;
using OrgChart.Repositories.Data;
using OrgChart.Services;
using OrgChart.Services.Dtos;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace OrgChart.Api.Controllers;

[ApiController]
[Route("api/timesheet")]
[Authorize]
public class TimesheetController : ControllerBase
{
    private const decimal MaxDailyHours = 8m;

    private readonly AppDbContext _db;
    private readonly UserManager<Employee> _userManager;
    private readonly IConfiguration _config;
    private readonly HttpClient _httpClient;

    public TimesheetController(AppDbContext db, UserManager<Employee> userManager, IConfiguration config, HttpClient httpClient)
    {
        _db = db;
        _userManager = userManager;
        _config = config;
        _httpClient = httpClient;
    }

    [HttpGet("tickets")]
    public async Task<ActionResult<List<JiraTicketDto>>> GetTickets([FromQuery] int projectId)
    {
        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == projectId);
        if (project == null) return NotFound();

        // Nothing to search against if this project wasn't synced from Jira.
        if (string.IsNullOrWhiteSpace(project.JiraBoardId))
        {
            return Ok(new List<JiraTicketDto>());
        }

        var employee = await GetCurrentEmployeeAsync();
        if (employee == null) return Unauthorized();

        var jiraBaseUrl = _config["Jira:BaseUrl"] ?? Environment.GetEnvironmentVariable("JIRA_BASE_URL");
        var jiraEmail = _config["Jira:Email"] ?? Environment.GetEnvironmentVariable("JIRA_EMAIL");
        var jiraApiToken = _config["Jira:ApiToken"] ?? Environment.GetEnvironmentVariable("JIRA_API_TOKEN");

        if (string.IsNullOrWhiteSpace(jiraBaseUrl) || string.IsNullOrWhiteSpace(jiraEmail) || string.IsNullOrWhiteSpace(jiraApiToken))
        {
            return StatusCode(500, new { success = false, message = "Jira integration is not configured on the server. Contact an administrator." });
        }

        try
        {
            var cloudId = await JiraCloudResolver.ResolveCloudIdAsync(_httpClient, jiraBaseUrl);
            if (string.IsNullOrWhiteSpace(cloudId))
            {
                return StatusCode(502, new { success = false, message = "Could not resolve the Jira site's Cloud ID." });
            }

            var accountId = employee.JiraAccountId;
            if (string.IsNullOrWhiteSpace(accountId))
            {
                accountId = await ResolveJiraAccountIdAsync(cloudId, jiraEmail, jiraApiToken, employee.APPEmail);
                if (!string.IsNullOrWhiteSpace(accountId))
                {
                    employee.JiraAccountId = accountId;
                    await _db.SaveChangesAsync();
                }
            }

            // No matching Jira user for this email - nothing assigned to show.
            if (string.IsNullOrWhiteSpace(accountId))
            {
                return Ok(new List<JiraTicketDto>());
            }

            // Deliberately NOT /rest/api/3/search/jql: Atlassian has a confirmed platform bug
            // (JRACLOUD-96181) where that endpoint rejects every scoped API token with either
            // "scope does not match" or a silent empty result, regardless of which scopes are
            // granted - tested live against this token with both the classic and full granular
            // scope set, both failed. The Agile API's board-scoped issue endpoint is authorized
            // by read:board-scope:jira-software instead, which scoped tokens DO support correctly.
            var jql = $"assignee = \"{accountId}\" ORDER BY updated DESC";
            var url = $"https://api.atlassian.com/ex/jira/{cloudId}/rest/agile/1.0/board/{project.JiraBoardId}/issue?jql={Uri.EscapeDataString(jql)}&fields=summary&maxResults=100";

            var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Authorization = BuildAuthHeader(jiraEmail, jiraApiToken);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                return StatusCode(502, new { success = false, message = $"Jira ticket search failed (HTTP {(int)response.StatusCode}). The service account may need broader permissions to search issues." });
            }

            var tickets = new List<JiraTicketDto>();
            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("issues", out var issues))
            {
                foreach (var issue in issues.EnumerateArray())
                {
                    var key = issue.TryGetProperty("key", out var k) ? k.GetString() : null;
                    string? summary = null;
                    if (issue.TryGetProperty("fields", out var fields) && fields.TryGetProperty("summary", out var s))
                    {
                        summary = s.GetString();
                    }
                    if (!string.IsNullOrWhiteSpace(key))
                    {
                        tickets.Add(new JiraTicketDto { Key = key!, Summary = string.IsNullOrWhiteSpace(summary) ? key! : summary! });
                    }
                }
            }

            return Ok(tickets);
        }
        catch (Exception)
        {
            return StatusCode(502, new { success = false, message = "Could not reach Jira. Verify the configured Jira URL and network connectivity." });
        }
    }

    [HttpGet("entries")]
    public async Task<ActionResult<List<TimesheetEntryDto>>> GetEntries([FromQuery] string scope = "mine")
    {
        var currentId = GetCurrentEmployeeId();
        if (currentId == null) return Unauthorized();

        IQueryable<TimesheetEntry> query;
        if (string.Equals(scope, "team", StringComparison.OrdinalIgnoreCase))
        {
            // Direct reports AND Functional (dotted-line) reports both surface here - the two
            // OrgReporting types are independent routes to the same "who can approve this" set.
            var reportIds = await _db.OrgReportings
                .Where(o => o.ManagerId == currentId.Value && (o.ReportingType == "Direct" || o.ReportingType == "Functional"))
                .Select(o => o.EmployeeId)
                .Distinct()
                .ToListAsync();

            // Drafts are private to the employee until they explicitly submit the week -
            // managers should never see them.
            query = _db.TimesheetEntries.Where(e =>
                !e.IsDeleted && !e.Timesheet.IsDeleted
                && reportIds.Contains(e.Timesheet.EmployeeId)
                && e.Timesheet.Status != "Draft");
        }
        else
        {
            query = _db.TimesheetEntries.Where(e => !e.IsDeleted && !e.Timesheet.IsDeleted && e.Timesheet.EmployeeId == currentId.Value);
        }

        var entries = await query
            .Include(e => e.Timesheet).ThenInclude(t => t.Employee)
            .Include(e => e.Project)
            .OrderByDescending(e => e.Date)
            .ThenByDescending(e => e.DateCreated)
            .ToListAsync();

        // One review lookup for every distinct week touched, instead of per-entry - each entry
        // just needs its parent week's most recent Approved/Rejected decision, if any.
        var timesheetIds = entries.Select(e => e.TimesheetId).Distinct().ToList();
        var latestReviewByTimesheet = (await _db.TimesheetReviewLogs
                .Where(r => !r.IsDeleted && timesheetIds.Contains(r.TimesheetId))
                .Include(r => r.Reviewer)
                .ToListAsync())
            .GroupBy(r => r.TimesheetId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(r => r.DateCreated).First());

        return Ok(entries.Select(e => ToDto(e, latestReviewByTimesheet.GetValueOrDefault(e.TimesheetId))).ToList());
    }

    [HttpPost("entries")]
    public async Task<ActionResult<TimesheetEntryDto>> Create(CreateTimesheetEntryDto dto)
    {
        var currentId = GetCurrentEmployeeId();
        if (currentId == null) return Unauthorized();

        var hasTicket = !string.IsNullOrWhiteSpace(dto.JiraIssueKey);
        var hasTask = !string.IsNullOrWhiteSpace(dto.TaskDescription);
        if (hasTicket == hasTask)
        {
            return BadRequest(new { message = "Provide either a Jira ticket or a task description, not both." });
        }
        if (dto.HoursSpent <= 0)
        {
            return BadRequest(new { message = "Hours spent must be greater than zero." });
        }

        var dailyCapError = await CheckDailyCapAsync(currentId.Value, dto.WorkDate.Date, dto.HoursSpent);
        if (dailyCapError != null) return BadRequest(new { message = dailyCapError });

        var timesheet = await GetOrCreateEditableTimesheetAsync(currentId.Value, dto.WorkDate.Date);
        if (timesheet == null)
        {
            return BadRequest(new { message = "This week is pending your manager's review or already approved and can't be edited." });
        }

        var entry = new TimesheetEntry
        {
            TimesheetId = timesheet.Id,
            ProjectId = dto.ProjectId,
            JiraIssueKey = dto.JiraIssueKey,
            JiraIssueSummary = dto.JiraIssueSummary,
            TaskDescription = dto.TaskDescription,
            Date = dto.WorkDate.Date,
            HoursSpent = dto.HoursSpent,
            Comment = dto.Comment,
            DateCreated = DateTime.UtcNow
        };

        _db.TimesheetEntries.Add(entry);
        await _db.SaveChangesAsync();

        entry = await _db.TimesheetEntries
            .Include(e => e.Timesheet).ThenInclude(t => t.Employee)
            .Include(e => e.Project)
            .FirstAsync(e => e.Id == entry.Id);

        return Ok(ToDto(entry, null));
    }

    [HttpPut("entries/{id:int}")]
    public async Task<IActionResult> Update(int id, UpdateTimesheetEntryDto dto)
    {
        var currentId = GetCurrentEmployeeId();
        if (currentId == null) return Unauthorized();

        var entry = await _db.TimesheetEntries
            .Include(e => e.Timesheet)
            .FirstOrDefaultAsync(e => e.Id == id && !e.IsDeleted);
        if (entry == null) return NotFound();
        if (entry.Timesheet.EmployeeId != currentId.Value) return Forbid();
        if (entry.Timesheet.Status != "Draft" && entry.Timesheet.Status != "Rejected")
            return BadRequest(new { message = "This week is pending your manager's review and can't be edited until they act on it." });

        var hasTicket = !string.IsNullOrWhiteSpace(dto.JiraIssueKey);
        var hasTask = !string.IsNullOrWhiteSpace(dto.TaskDescription);
        if (hasTicket == hasTask)
        {
            return BadRequest(new { message = "Provide either a Jira ticket or a task description, not both." });
        }
        if (dto.HoursSpent <= 0)
        {
            return BadRequest(new { message = "Hours spent must be greater than zero." });
        }

        var dailyCapError = await CheckDailyCapAsync(currentId.Value, dto.WorkDate.Date, dto.HoursSpent, excludeEntryId: id);
        if (dailyCapError != null) return BadRequest(new { message = dailyCapError });

        // Editing a Rejected week sends the whole week back through the Draft -> Submit Week
        // flow rather than leaving it Rejected - the old review no longer applies once corrected.
        if (entry.Timesheet.Status == "Rejected")
        {
            entry.Timesheet.Status = "Draft";
            entry.Timesheet.DateModified = DateTime.UtcNow;
        }

        entry.ProjectId = dto.ProjectId;
        entry.JiraIssueKey = dto.JiraIssueKey;
        entry.JiraIssueSummary = dto.JiraIssueSummary;
        entry.TaskDescription = dto.TaskDescription;
        entry.Date = dto.WorkDate.Date;
        entry.HoursSpent = dto.HoursSpent;
        entry.Comment = dto.Comment;
        entry.DateModified = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("entries/{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var currentId = GetCurrentEmployeeId();
        if (currentId == null) return Unauthorized();

        var entry = await _db.TimesheetEntries
            .Include(e => e.Timesheet)
            .FirstOrDefaultAsync(e => e.Id == id && !e.IsDeleted);
        if (entry == null) return NotFound();
        if (entry.Timesheet.EmployeeId != currentId.Value) return Forbid();
        if (entry.Timesheet.Status != "Draft" && entry.Timesheet.Status != "Rejected")
            return BadRequest(new { message = "This week is pending your manager's review and can't be deleted until they act on it." });

        if (entry.Timesheet.Status == "Rejected")
        {
            entry.Timesheet.Status = "Draft";
            entry.Timesheet.DateModified = DateTime.UtcNow;
        }

        entry.IsDeleted = true;
        entry.DateDeleted = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("entries/submit-week")]
    public async Task<IActionResult> SubmitWeek(SubmitWeekDto dto)
    {
        var currentId = GetCurrentEmployeeId();
        if (currentId == null) return Unauthorized();

        var weekStart = GetMonday(dto.WeekStart.Date);

        var timesheet = await _db.Timesheets
            .Include(t => t.Entries.Where(e => !e.IsDeleted))
            .FirstOrDefaultAsync(t => t.EmployeeId == currentId.Value && t.StartDate == weekStart && !t.IsDeleted);

        if (timesheet == null || timesheet.Status != "Draft" || timesheet.Entries.Count == 0)
        {
            return BadRequest(new { message = "No draft entries to submit for this week." });
        }

        timesheet.Status = "Pending";
        timesheet.DateModified = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { submittedCount = timesheet.Entries.Count });
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

        var timesheet = await _db.Timesheets.FirstOrDefaultAsync(t => t.Id == timesheetId && !t.IsDeleted);
        if (timesheet == null) return NotFound();
        if (timesheet.Status != "Pending") return BadRequest(new { message = "This week has already been reviewed." });

        var callerEmployee = await _db.Users.FirstOrDefaultAsync(u => u.Id == currentId.Value);
        if (callerEmployee == null) return Unauthorized();

        var isAdmin = await _userManager.IsInRoleAsync(callerEmployee, "Admin");
        if (!isAdmin)
        {
            var isAuthorizedManager = await _db.OrgReportings.AnyAsync(o =>
                o.EmployeeId == timesheet.EmployeeId && o.ManagerId == currentId.Value
                && (o.ReportingType == "Direct" || o.ReportingType == "Functional"));
            if (!isAuthorizedManager) return Forbid();
        }

        timesheet.Status = dto.Status;
        timesheet.DateModified = DateTime.UtcNow;

        _db.TimesheetReviewLogs.Add(new TimesheetReviewLog
        {
            TimesheetId = timesheet.Id,
            Status = dto.Status,
            ReviewerId = currentId.Value,
            Comment = dto.Comment,
            CreatedBy = callerEmployee.FullName,
            DateCreated = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Finds the Draft/Rejected Timesheet for this employee+week to attach a new entry
    /// to, creating one if this is the first entry logged for that week. Flips a Rejected week
    /// back to Draft (same as Update/Delete do) since adding a new entry is itself a correction.
    /// Returns null if the week is Pending/Approved and therefore not editable.</summary>
    private async Task<Timesheet?> GetOrCreateEditableTimesheetAsync(int employeeId, DateTime workDate)
    {
        var weekStart = GetMonday(workDate);

        var timesheet = await _db.Timesheets
            .FirstOrDefaultAsync(t => t.EmployeeId == employeeId && t.StartDate == weekStart && !t.IsDeleted);

        if (timesheet == null)
        {
            timesheet = new Timesheet
            {
                EmployeeId = employeeId,
                StartDate = weekStart,
                EndDate = weekStart.AddDays(4),
                Status = "Draft",
                DateCreated = DateTime.UtcNow
            };
            _db.Timesheets.Add(timesheet);
            await _db.SaveChangesAsync();
            return timesheet;
        }

        if (timesheet.Status == "Pending" || timesheet.Status == "Approved")
        {
            return null;
        }

        if (timesheet.Status == "Rejected")
        {
            timesheet.Status = "Draft";
            timesheet.DateModified = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        return timesheet;
    }

    private static DateTime GetMonday(DateTime date)
    {
        var day = (int)date.DayOfWeek; // Sunday = 0
        var diff = (day == 0 ? -6 : 1) - day;
        return date.Date.AddDays(diff);
    }

    /// <summary>
    /// Mirrors the frontend's MAX_DAILY_HOURS check (TimesheetPage.tsx) so the cap holds even
    /// for callers that bypass the UI. Sums every entry the employee has that day regardless of
    /// its week's status, same as the frontend does, excluding the entry being edited when updating.
    /// </summary>
    private async Task<string?> CheckDailyCapAsync(int employeeId, DateTime workDate, decimal hoursSpent, int? excludeEntryId = null)
    {
        var existingHours = await _db.TimesheetEntries
            .Where(e => !e.IsDeleted && !e.Timesheet.IsDeleted && e.Timesheet.EmployeeId == employeeId && e.Date == workDate && e.Id != excludeEntryId)
            .SumAsync(e => (decimal?)e.HoursSpent) ?? 0;

        var total = existingHours + hoursSpent;
        if (total > MaxDailyHours)
        {
            return $"{workDate:MMM d} would total {total}h — over the {MaxDailyHours}-hour daily limit.";
        }
        return null;
    }

    private static TimesheetEntryDto ToDto(TimesheetEntry e, TimesheetReviewLog? latestReview) => new()
    {
        Id = e.Id,
        TimesheetId = e.TimesheetId,
        EmployeeId = e.Timesheet.EmployeeId,
        EmployeeName = e.Timesheet.Employee?.FullName,
        ProjectId = e.ProjectId,
        ProjectName = e.Project?.Name,
        JiraIssueKey = e.JiraIssueKey,
        JiraIssueSummary = e.JiraIssueSummary,
        TaskDescription = e.TaskDescription,
        WorkDate = e.Date,
        HoursSpent = e.HoursSpent,
        Comment = e.Comment,
        TimesheetStatus = e.Timesheet.Status,
        ReviewerComment = latestReview?.Comment,
        ReviewedByUserId = latestReview?.ReviewerId,
        ReviewedByName = latestReview?.Reviewer?.FullName,
        ReviewedAt = latestReview?.DateCreated,
        CreatedAt = e.DateCreated
    };

    private int? GetCurrentEmployeeId()
    {
        var userId = _userManager.GetUserId(User);
        if (string.IsNullOrEmpty(userId) || !int.TryParse(userId, out var id)) return null;
        return id;
    }

    private async Task<Employee?> GetCurrentEmployeeAsync()
    {
        var id = GetCurrentEmployeeId();
        if (id == null) return null;
        return await _db.Users.FirstOrDefaultAsync(u => u.Id == id.Value);
    }

    private static AuthenticationHeaderValue BuildAuthHeader(string email, string apiToken)
    {
        var authBytes = Encoding.UTF8.GetBytes($"{email}:{apiToken}");
        return new AuthenticationHeaderValue("Basic", Convert.ToBase64String(authBytes));
    }

    private async Task<string?> ResolveJiraAccountIdAsync(string cloudId, string jiraEmail, string jiraApiToken, string employeeEmail)
    {
        if (string.IsNullOrWhiteSpace(employeeEmail)) return null;

        try
        {
            var url = $"https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/user/search?query={Uri.EscapeDataString(employeeEmail)}";
            var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Authorization = BuildAuthHeader(jiraEmail, jiraApiToken);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind == JsonValueKind.Array && doc.RootElement.GetArrayLength() > 0)
            {
                var first = doc.RootElement[0];
                return first.TryGetProperty("accountId", out var accountIdProp) ? accountIdProp.GetString() : null;
            }
            return null;
        }
        catch
        {
            return null;
        }
    }
}
