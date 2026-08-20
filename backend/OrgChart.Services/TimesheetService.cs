using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using OrgChart.Domain;
using OrgChart.Repositories;
using OrgChart.Services.Dtos;

namespace OrgChart.Services;

public enum EntryMutationOutcome
{
    NotFound,
    Forbidden,
    Success
}

public enum ReviewOutcome
{
    NotFound,
    AlreadyReviewed,
    Forbidden,
    Success
}

public enum JiraTicketsOutcome
{
    ProjectNotFound,
    EmployeeNotFound,
    ConfigMissing,
    JiraError,
    Success
}

public class JiraTicketsResult
{
    public JiraTicketsOutcome Outcome { get; set; }
    public List<JiraTicketDto> Tickets { get; set; } = new();
    public string? ErrorMessage { get; set; }
    public int ErrorStatusCode { get; set; }
}

public class TimesheetService
{
    private const int MaxDailyMinutes = 8 * 60;

    // Serializes "find or create this week's Timesheet row" per employee+week - without this,
    // saving several new entries at once (first save of a week) fires concurrent creates that
    // can each see no existing row and insert their own, splitting entries across duplicate
    // Timesheet rows for the same week. Kept here (not in the repository) because it needs to
    // span several repository calls (find-or-create, then possibly a status flip) as one
    // atomic unit - a lock buried inside a single repository method wouldn't protect that.
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> _timesheetCreationLocks = new();

    // Serializes "check today's total, then save" per employee+day - same reasoning as above but
    // for the daily-hour cap: several entries saved at once for the same day each independently
    // sum up the day's existing minutes before any of them commit, so each can individually pass
    // the 8-hour check even though their combined total blows past it.
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> _dailyCapLocks = new();

    private static async Task<IDisposable> AcquireDailyCapLockAsync(int employeeId, DateTime workDate)
    {
        var key = $"{employeeId}:{workDate:yyyyMMdd}";
        var gate = _dailyCapLocks.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync();
        return new Releaser(gate);
    }

    private sealed class Releaser : IDisposable
    {
        private readonly SemaphoreSlim _gate;
        public Releaser(SemaphoreSlim gate) => _gate = gate;
        public void Dispose() => _gate.Release();
    }

    private readonly EfTimesheetRepository _timesheets;
    private readonly EfProjectRepository _projects;
    private readonly IConfiguration _config;
    private readonly HttpClient _httpClient;

    public TimesheetService(EfTimesheetRepository timesheets, EfProjectRepository projects, IConfiguration config, HttpClient httpClient)
    {
        _timesheets = timesheets;
        _projects = projects;
        _config = config;
        _httpClient = httpClient;
    }

    public async Task<JiraTicketsResult> GetTicketsAsync(int projectId, int employeeId)
    {
        var project = await _projects.GetByIdAsync(projectId);
        if (project == null)
        {
            return new JiraTicketsResult { Outcome = JiraTicketsOutcome.ProjectNotFound };
        }

        // Nothing to search against if this project's space has no board synced from Jira.
        var boardIds = (project.JiraBoardIds ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (boardIds.Length == 0)
        {
            return new JiraTicketsResult { Outcome = JiraTicketsOutcome.Success, Tickets = new List<JiraTicketDto>() };
        }

        var employee = await _timesheets.GetEmployeeAsync(employeeId);
        if (employee == null)
        {
            return new JiraTicketsResult { Outcome = JiraTicketsOutcome.EmployeeNotFound };
        }

        var jiraBaseUrl = _config["Jira:BaseUrl"] ?? Environment.GetEnvironmentVariable("JIRA_BASE_URL");
        var jiraEmail = _config["Jira:Email"] ?? Environment.GetEnvironmentVariable("JIRA_EMAIL");
        var jiraApiToken = _config["Jira:ApiToken"] ?? Environment.GetEnvironmentVariable("JIRA_API_TOKEN");

        if (string.IsNullOrWhiteSpace(jiraBaseUrl) || string.IsNullOrWhiteSpace(jiraEmail) || string.IsNullOrWhiteSpace(jiraApiToken))
        {
            return new JiraTicketsResult
            {
                Outcome = JiraTicketsOutcome.ConfigMissing,
                ErrorStatusCode = 500,
                ErrorMessage = "Jira integration is not configured on the server. Contact an administrator."
            };
        }

        try
        {
            var cloudId = await JiraCloudResolver.ResolveCloudIdAsync(_httpClient, jiraBaseUrl);
            if (string.IsNullOrWhiteSpace(cloudId))
            {
                return new JiraTicketsResult
                {
                    Outcome = JiraTicketsOutcome.JiraError,
                    ErrorStatusCode = 502,
                    ErrorMessage = "Could not resolve the Jira site's Cloud ID."
                };
            }

            var accountId = employee.JiraAccountId;
            if (string.IsNullOrWhiteSpace(accountId))
            {
                accountId = await ResolveJiraAccountIdAsync(cloudId, jiraEmail, jiraApiToken, employee.APPEmail);
                if (!string.IsNullOrWhiteSpace(accountId))
                {
                    employee.JiraAccountId = accountId;
                    await _timesheets.SaveChangesAsync();
                }
            }

            // No matching Jira user for this email - nothing assigned to show.
            if (string.IsNullOrWhiteSpace(accountId))
            {
                return new JiraTicketsResult { Outcome = JiraTicketsOutcome.Success, Tickets = new List<JiraTicketDto>() };
            }

            // Deliberately NOT /rest/api/3/search/jql: Atlassian has a confirmed platform bug
            // (JRACLOUD-96181) where that endpoint rejects every scoped API token with either
            // "scope does not match" or a silent empty result, regardless of which scopes are
            // granted - tested live against this token with both the classic and full granular
            // scope set, both failed. The Agile API's board-scoped issue endpoint is authorized
            // by read:board-scope:jira-software instead, which scoped tokens DO support correctly.
            var jql = $"assignee = \"{accountId}\" ORDER BY updated DESC";

            // A space can have more than one board (e.g. separate Scrum + Kanban boards) - query
            // each and union the results, deduping by ticket key in case the same issue surfaces
            // on more than one board.
            var tickets = new List<JiraTicketDto>();
            var seenKeys = new HashSet<string>();
            foreach (var boardId in boardIds)
            {
                var url = $"https://api.atlassian.com/ex/jira/{cloudId}/rest/agile/1.0/board/{boardId}/issue?jql={Uri.EscapeDataString(jql)}&fields=summary&maxResults=100";

                var request = new HttpRequestMessage(HttpMethod.Get, url);
                request.Headers.Authorization = BuildAuthHeader(jiraEmail, jiraApiToken);
                request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

                var response = await _httpClient.SendAsync(request);
                if (!response.IsSuccessStatusCode)
                {
                    return new JiraTicketsResult
                    {
                        Outcome = JiraTicketsOutcome.JiraError,
                        ErrorStatusCode = 502,
                        ErrorMessage = $"Jira ticket search failed (HTTP {(int)response.StatusCode}). The service account may need broader permissions to search issues."
                    };
                }

                var json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("issues", out var issues))
                {
                    foreach (var issue in issues.EnumerateArray())
                    {
                        var key = issue.TryGetProperty("key", out var k) ? k.GetString() : null;
                        if (string.IsNullOrWhiteSpace(key) || !seenKeys.Add(key!)) continue;

                        string? summary = null;
                        if (issue.TryGetProperty("fields", out var fields) && fields.TryGetProperty("summary", out var s))
                        {
                            summary = s.GetString();
                        }
                        tickets.Add(new JiraTicketDto { Key = key!, Summary = string.IsNullOrWhiteSpace(summary) ? key! : summary! });
                    }
                }
            }

            return new JiraTicketsResult { Outcome = JiraTicketsOutcome.Success, Tickets = tickets };
        }
        catch (Exception)
        {
            return new JiraTicketsResult
            {
                Outcome = JiraTicketsOutcome.JiraError,
                ErrorStatusCode = 502,
                ErrorMessage = "Could not reach Jira. Verify the configured Jira URL and network connectivity."
            };
        }
    }

    public async Task<List<TimesheetEntryDto>> GetEntriesAsync(int employeeId, string scope)
    {
        List<TimesheetEntry> entries;
        if (string.Equals(scope, "team", StringComparison.OrdinalIgnoreCase))
        {
            // Direct reports AND Functional (dotted-line) reports both surface here - the two
            // OrgReporting types are independent routes to the same "who can approve this" set.
            var reportIds = await _timesheets.GetReportIdsAsync(employeeId);
            entries = await _timesheets.GetTeamEntriesAsync(reportIds);
        }
        else
        {
            entries = await _timesheets.GetMyEntriesAsync(employeeId);
        }

        // One review lookup for every distinct week touched, instead of per-entry - each entry
        // just needs its parent week's most recent Approved/Rejected decision, if any.
        var timesheetIds = entries.Select(e => e.TimesheetId).Distinct().ToList();
        var latestReviewByTimesheet = await _timesheets.GetLatestReviewsByTimesheetAsync(timesheetIds);

        return entries.Select(e => ToDto(e, latestReviewByTimesheet.GetValueOrDefault(e.TimesheetId))).ToList();
    }

    /// <summary>Throws InvalidOperationException with a user-facing message for every
    /// validation/business-rule failure (bad shape, non-positive hours, over daily cap, week
    /// locked) - the controller maps that straight into a 400 with {message: ex.Message}.</summary>
    public async Task<TimesheetEntryDto> CreateEntryAsync(int employeeId, CreateTimesheetEntryDto dto)
    {
        var shapeError = ValidateEntryShape(dto);
        if (shapeError != null)
        {
            throw new InvalidOperationException(shapeError);
        }
        if (dto.HoursSpent <= 0)
        {
            throw new InvalidOperationException("Hours spent must be greater than zero.");
        }

        TimesheetEntry entry;
        using (await AcquireDailyCapLockAsync(employeeId, dto.WorkDate.Date))
        {
            var dailyCapError = await CheckDailyCapAsync(employeeId, dto.WorkDate.Date, dto.HoursSpent);
            if (dailyCapError != null)
            {
                throw new InvalidOperationException(dailyCapError);
            }

            var timesheet = await GetOrCreateEditableTimesheetAsync(employeeId, dto.WorkDate.Date);
            if (timesheet == null)
            {
                throw new InvalidOperationException("This week is pending your manager's review or already approved and can't be edited.");
            }

            entry = await _timesheets.AddEntryAsync(new TimesheetEntry
            {
                TimesheetId = timesheet.Id,
                ProjectId = dto.ProjectId,
                JiraIssueKey = dto.JiraIssueKey,
                JiraIssueSummary = dto.JiraIssueSummary,
                TaskDescription = dto.TaskDescription,
                ActivityCode = dto.ActivityCode,
                Date = dto.WorkDate.Date,
                Minutes = HoursToMinutes(dto.HoursSpent),
                Comment = dto.Comment,
                DateCreated = DateTime.UtcNow
            });
        }

        entry = await _timesheets.GetHydratedEntryAsync(entry.Id);
        return ToDto(entry, null);
    }

    /// <summary>Throws InvalidOperationException for the same validation/business-rule failures
    /// as CreateEntryAsync (shape, hours, daily cap, week locked). NotFound/Forbidden are
    /// returned as an outcome instead, since those map to bodyless 404/403 responses.</summary>
    public async Task<EntryMutationOutcome> UpdateEntryAsync(int employeeId, int entryId, UpdateTimesheetEntryDto dto)
    {
        var entry = await _timesheets.GetEntryWithTimesheetAsync(entryId);
        if (entry == null) return EntryMutationOutcome.NotFound;
        if (entry.Timesheet.EmployeeId != employeeId) return EntryMutationOutcome.Forbidden;
        if (entry.Timesheet.Status != "Draft" && entry.Timesheet.Status != "Rejected")
        {
            throw new InvalidOperationException("This week is pending your manager's review and can't be edited until they act on it.");
        }

        var shapeError = ValidateEntryShape(dto);
        if (shapeError != null)
        {
            throw new InvalidOperationException(shapeError);
        }
        if (dto.HoursSpent <= 0)
        {
            throw new InvalidOperationException("Hours spent must be greater than zero.");
        }

        using (await AcquireDailyCapLockAsync(employeeId, dto.WorkDate.Date))
        {
            var dailyCapError = await CheckDailyCapAsync(employeeId, dto.WorkDate.Date, dto.HoursSpent, excludeEntryId: entryId);
            if (dailyCapError != null)
            {
                throw new InvalidOperationException(dailyCapError);
            }

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
            entry.ActivityCode = dto.ActivityCode;
            entry.Date = dto.WorkDate.Date;
            entry.Minutes = HoursToMinutes(dto.HoursSpent);
            entry.Comment = dto.Comment;
            entry.DateModified = DateTime.UtcNow;

            await _timesheets.SaveChangesAsync();
        }

        return EntryMutationOutcome.Success;
    }

    /// <summary>Throws InvalidOperationException if the week is locked (Pending/Approved).</summary>
    public async Task<EntryMutationOutcome> DeleteEntryAsync(int employeeId, int entryId)
    {
        var entry = await _timesheets.GetEntryWithTimesheetAsync(entryId);
        if (entry == null) return EntryMutationOutcome.NotFound;
        if (entry.Timesheet.EmployeeId != employeeId) return EntryMutationOutcome.Forbidden;
        if (entry.Timesheet.Status != "Draft" && entry.Timesheet.Status != "Rejected")
        {
            throw new InvalidOperationException("This week is pending your manager's review and can't be deleted until they act on it.");
        }

        if (entry.Timesheet.Status == "Rejected")
        {
            entry.Timesheet.Status = "Draft";
            entry.Timesheet.DateModified = DateTime.UtcNow;
        }

        entry.IsDeleted = true;
        entry.DateDeleted = DateTime.UtcNow;
        await _timesheets.SaveChangesAsync();
        return EntryMutationOutcome.Success;
    }

    /// <summary>Returns null if there's nothing submittable for this week (no Timesheet row, not
    /// currently Draft, or no entries) - otherwise the number of entries just submitted.</summary>
    public async Task<int?> SubmitWeekAsync(int employeeId, DateTime weekStartRaw)
    {
        var weekStart = GetMonday(weekStartRaw);

        var timesheet = await _timesheets.GetTimesheetWithEntriesAsync(employeeId, weekStart);

        if (timesheet == null || timesheet.Status != "Draft" || timesheet.Entries.Count == 0)
        {
            return null;
        }

        timesheet.Status = "Pending";
        timesheet.DateModified = DateTime.UtcNow;
        await _timesheets.SaveChangesAsync();

        return timesheet.Entries.Count;
    }

    public async Task<ReviewOutcome> ReviewAsync(int timesheetId, string status, string? comment, int callerId, string callerFullName, bool isAdmin)
    {
        var timesheet = await _timesheets.GetTimesheetByIdAsync(timesheetId);
        if (timesheet == null) return ReviewOutcome.NotFound;
        if (timesheet.Status != "Pending") return ReviewOutcome.AlreadyReviewed;

        if (!isAdmin)
        {
            var isAuthorizedManager = await _timesheets.IsAuthorizedManagerAsync(timesheet.EmployeeId, callerId);
            if (!isAuthorizedManager) return ReviewOutcome.Forbidden;
        }

        timesheet.Status = status;
        timesheet.DateModified = DateTime.UtcNow;

        await _timesheets.AddReviewLogAsync(new TimesheetReviewLog
        {
            TimesheetId = timesheet.Id,
            Status = status,
            ReviewerId = callerId,
            Comment = comment,
            CreatedBy = callerFullName,
            DateCreated = DateTime.UtcNow
        });

        return ReviewOutcome.Success;
    }

    /// <summary>Finds the Draft/Rejected Timesheet for this employee+week to attach a new entry
    /// to, creating one if this is the first entry logged for that week. Flips a Rejected week
    /// back to Draft (same as Update/Delete do) since adding a new entry is itself a correction.
    /// Returns null if the week is Pending/Approved and therefore not editable.</summary>
    private async Task<Timesheet?> GetOrCreateEditableTimesheetAsync(int employeeId, DateTime workDate)
    {
        var weekStart = GetMonday(workDate);
        var lockKey = $"{employeeId}:{weekStart:yyyyMMdd}";
        var gate = _timesheetCreationLocks.GetOrAdd(lockKey, _ => new SemaphoreSlim(1, 1));

        await gate.WaitAsync();
        try
        {
            var timesheet = await _timesheets.FindTimesheetAsync(employeeId, weekStart);

            if (timesheet == null)
            {
                return await _timesheets.CreateTimesheetAsync(new Timesheet
                {
                    EmployeeId = employeeId,
                    StartDate = weekStart,
                    EndDate = weekStart.AddDays(4),
                    Status = "Draft",
                    DateCreated = DateTime.UtcNow
                });
            }

            if (timesheet.Status == "Pending" || timesheet.Status == "Approved")
            {
                return null;
            }

            if (timesheet.Status == "Rejected")
            {
                timesheet.Status = "Draft";
                timesheet.DateModified = DateTime.UtcNow;
                await _timesheets.SaveChangesAsync();
            }

            return timesheet;
        }
        finally
        {
            gate.Release();
        }
    }

    /// <summary>Every entry is either a Jira ticket or an activity type, never both - and OTH
    /// additionally needs a free-text description since it has no fixed meaning on its own.
    /// Project is required on every entry: the same activity type (e.g. DSM) can apply to more
    /// than one project a person is on, and Project is what tells those apart.</summary>
    private static string? ValidateEntryShape(CreateTimesheetEntryDto dto)
    {
        if (dto.ProjectId == null)
        {
            return "Project is required.";
        }

        var hasTicket = !string.IsNullOrWhiteSpace(dto.JiraIssueKey);
        var hasType = !string.IsNullOrWhiteSpace(dto.ActivityCode);
        if (hasTicket == hasType)
        {
            return "Pick either a ticket or an activity type, not both.";
        }

        if (hasType && dto.ActivityCode == "OTH" && string.IsNullOrWhiteSpace(dto.TaskDescription))
        {
            return "Describe what \"Other\" means for this entry.";
        }

        return null;
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
        var existingMinutes = await _timesheets.GetLoggedMinutesForDayAsync(employeeId, workDate, excludeEntryId);

        var totalMinutes = existingMinutes + HoursToMinutes(hoursSpent);
        if (totalMinutes > MaxDailyMinutes)
        {
            var total = totalMinutes / 60m;
            return $"{workDate:MMM d} would total {total}h — over the {MaxDailyMinutes / 60}-hour daily limit.";
        }
        return null;
    }

    /// <summary>The API/UI speak in decimal hours (e.g. 2.25) - only storage is in whole minutes.</summary>
    private static int HoursToMinutes(decimal hours) => (int)Math.Round(hours * 60);

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
        ActivityCode = e.ActivityCode,
        WorkDate = e.Date,
        HoursSpent = e.Minutes / 60m,
        Comment = e.Comment,
        TimesheetStatus = e.Timesheet.Status,
        ReviewerComment = latestReview?.Comment,
        ReviewedByUserId = latestReview?.ReviewerId,
        ReviewedByName = latestReview?.Reviewer?.FullName,
        ReviewedAt = latestReview?.DateCreated,
        CreatedAt = e.DateCreated
    };

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
