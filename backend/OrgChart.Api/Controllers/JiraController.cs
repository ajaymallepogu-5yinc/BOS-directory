using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrgChart.Api.Data;
using OrgChart.Api.Models;

namespace OrgChart.Api.Controllers;

[ApiController]
[Route("api/jira")]
public class JiraController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly HttpClient _httpClient;

    public JiraController(AppDbContext db, HttpClient httpClient)
    {
        _db = db;
        _httpClient = httpClient;
    }

    [HttpGet("dashboard")]
    public async Task<ActionResult<JiraDashboardDto>> GetDashboard()
    {
        var projects = await _db.JiraProjects
            .Select(p => new JiraProjectDto
            {
                Id = p.Id,
                Key = p.Key,
                Name = p.Name
            })
            .ToListAsync();

        var sprints = await _db.JiraSprints
            .Select(s => new JiraSprintDto
            {
                Id = s.Id,
                Name = s.Name,
                State = s.State,
                BoardId = s.BoardId
            })
            .ToListAsync();

        var issues = await _db.JiraIssues
            .Include(i => i.Project)
            .Include(i => i.Sprint)
            .Select(i => new JiraIssueDto
            {
                Id = i.Id,
                Key = i.Key,
                Summary = i.Summary,
                Status = i.Status,
                Assignee = i.Assignee,
                Priority = i.Priority,
                Description = i.Description,
                ExpectedTime = i.ExpectedTime,
                ActualTime = i.ActualTime,
                SprintId = i.SprintId,
                ProjectId = i.ProjectId,
                ProjectName = i.Project != null ? i.Project.Name : string.Empty,
                ProjectKey = i.Project != null ? i.Project.Key : string.Empty,
                SprintName = i.Sprint != null ? i.Sprint.Name : string.Empty
            })
            .ToListAsync();

        return Ok(new JiraDashboardDto
        {
            Projects = projects,
            Sprints = sprints,
            Issues = issues
        });
    }

    [HttpPost("settings/test")]
    public async Task<ActionResult<TestJiraConnectionResultDto>> TestConnection([FromBody] TestJiraConnectionDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.ApiUrl))
        {
            return Ok(new TestJiraConnectionResultDto
            {
                Success = false,
                Message = "Jira API URL is required."
            });
        }

        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get, dto.ApiUrl);
            if (!string.IsNullOrWhiteSpace(dto.UserEmail) && !string.IsNullOrWhiteSpace(dto.ApiToken))
            {
                var credentials = Convert.ToBase64String(System.Text.Encoding.ASCII.GetBytes($"{dto.UserEmail}:{dto.ApiToken}"));
                request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", credentials);
            }

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                return Ok(new TestJiraConnectionResultDto
                {
                    Success = false,
                    Message = $"HTTP error: {(int)response.StatusCode} ({response.ReasonPhrase})"
                });
            }

            var jsonString = await response.Content.ReadAsStringAsync();
            var payload = ParseJiraPayload(jsonString);

            var validationErrors = new List<string>();
            if (payload.Projects == null || !payload.Projects.Any())
            {
                validationErrors.Add("No projects found in the payload.");
            }
            if (payload.Issues == null || !payload.Issues.Any())
            {
                validationErrors.Add("No issues/tickets found in the payload.");
            }

            return Ok(new TestJiraConnectionResultDto
            {
                Success = validationErrors.Count == 0,
                Message = validationErrors.Count == 0 
                    ? "Connection verified and Jira payload parsed successfully!" 
                    : "Connection succeeded, but validation failed.",
                ProjectCount = payload.Projects?.Count ?? 0,
                SprintCount = payload.Sprints?.Count ?? 0,
                IssueCount = payload.Issues?.Count ?? 0,
                SampleIssues = payload.Issues?.Take(5).Select(i => new JiraIssueDto
                {
                    Key = i.Key,
                    Summary = i.Summary,
                    Status = i.Status,
                    Assignee = i.Assignee,
                    Priority = i.Priority,
                    ProjectKey = i.ProjectKey,
                    ExpectedTime = i.ExpectedTime ?? string.Empty,
                    ActualTime = i.ActualTime ?? string.Empty
                }).ToList() ?? new List<JiraIssueDto>(),
                ValidationErrors = validationErrors
            });
        }
        catch (Exception ex)
        {
            return Ok(new TestJiraConnectionResultDto
            {
                Success = false,
                Message = $"Failed to connect to Jira API URL: {ex.Message}"
            });
        }
    }

    [HttpPost("settings/import")]
    public async Task<ActionResult<JiraImportResultDto>> ImportData([FromBody] TestJiraConnectionDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.ApiUrl))
        {
            return BadRequest("Jira API URL is required.");
        }

        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get, dto.ApiUrl);
            if (!string.IsNullOrWhiteSpace(dto.UserEmail) && !string.IsNullOrWhiteSpace(dto.ApiToken))
            {
                var credentials = Convert.ToBase64String(System.Text.Encoding.ASCII.GetBytes($"{dto.UserEmail}:{dto.ApiToken}"));
                request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", credentials);
            }

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                return Ok(new JiraImportResultDto
                {
                    Success = false,
                    Message = $"HTTP error: {(int)response.StatusCode} ({response.ReasonPhrase})"
                });
            }

            var jsonString = await response.Content.ReadAsStringAsync();
            var payload = ParseJiraPayload(jsonString);

            if (payload.Projects == null || !payload.Projects.Any())
            {
                return Ok(new JiraImportResultDto
                {
                    Success = false,
                    Message = "No projects found in the payload to import."
                });
            }

            // Save settings to DataSourceConfig
            var config = await _db.DataSourceConfigs.FirstOrDefaultAsync();
            if (config == null)
            {
                config = new DataSourceConfig();
                _db.DataSourceConfigs.Add(config);
            }
            config.JiraApiUrl = dto.ApiUrl;
            config.JiraUserEmail = dto.UserEmail;
            config.JiraApiToken = dto.ApiToken;
            await _db.SaveChangesAsync();

            // Clear existing Jira data
            var existingIssues = await _db.JiraIssues.ToListAsync();
            _db.JiraIssues.RemoveRange(existingIssues);
            await _db.SaveChangesAsync();

            var existingSprints = await _db.JiraSprints.ToListAsync();
            _db.JiraSprints.RemoveRange(existingSprints);
            await _db.SaveChangesAsync();

            var existingProjects = await _db.JiraProjects.ToListAsync();
            _db.JiraProjects.RemoveRange(existingProjects);
            await _db.SaveChangesAsync();

            // Map & Import Sprints
            var sprintMap = new Dictionary<int, int>(); // External ID -> Local DB ID
            if (payload.Sprints != null)
            {
                foreach (var s in payload.Sprints)
                {
                    var sprintEntity = new JiraSprint
                    {
                        Name = s.Name,
                        State = s.State,
                        BoardId = s.BoardId
                    };
                    _db.JiraSprints.Add(sprintEntity);
                    await _db.SaveChangesAsync(); // populated local ID
                    sprintMap[s.Id] = sprintEntity.Id;
                }
            }

            // Map & Import Projects
            var projectMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase); // Project Key -> Local DB ID
            if (payload.Projects != null)
            {
                foreach (var p in payload.Projects)
                {
                    var projectEntity = new JiraProject
                    {
                        Key = p.Key,
                        Name = p.Name
                    };
                    _db.JiraProjects.Add(projectEntity);
                    await _db.SaveChangesAsync(); // populated local ID
                    projectMap[p.Key] = projectEntity.Id;
                }
            }

            // Import Issues
            int importedCount = 0;
            if (payload.Issues != null)
            {
                foreach (var issue in payload.Issues)
                {
                    if (!projectMap.TryGetValue(issue.ProjectKey, out var localProjectId))
                    {
                        continue; // skip if project mapping fails
                    }

                    int? localSprintId = null;
                    if (issue.SprintId.HasValue && sprintMap.TryGetValue(issue.SprintId.Value, out var sprintId))
                    {
                        localSprintId = sprintId;
                    }

                    var issueEntity = new JiraIssue
                    {
                        Key = issue.Key,
                        Summary = issue.Summary,
                        Status = issue.Status,
                        Assignee = issue.Assignee,
                        Priority = issue.Priority,
                        Description = issue.Description ?? string.Empty,
                        ExpectedTime = issue.ExpectedTime ?? string.Empty,
                        ActualTime = issue.ActualTime ?? string.Empty,
                        ProjectId = localProjectId,
                        SprintId = localSprintId
                    };
                    _db.JiraIssues.Add(issueEntity);
                    importedCount++;
                }
                await _db.SaveChangesAsync();
            }

            return Ok(new JiraImportResultDto
            {
                Success = true,
                Message = $"Successfully imported {projectMap.Count} projects, {sprintMap.Count} sprints, and {importedCount} issues into the local database!",
                ImportedCount = importedCount
            });
        }
        catch (Exception ex)
        {
            return Ok(new JiraImportResultDto
            {
                Success = false,
                Message = $"Import failed: {ex.Message}"
            });
        }
    }

    [HttpPut("issues/{id}")]
    public async Task<IActionResult> UpdateIssue(int id, [FromBody] UpdateJiraIssueDto dto)
    {
        var issue = await _db.JiraIssues.FindAsync(id);
        if (issue == null)
        {
            return NotFound($"Jira ticket with ID {id} not found.");
        }

        if (dto.ProjectId != 0 && !await _db.JiraProjects.AnyAsync(p => p.Id == dto.ProjectId))
        {
            return BadRequest("Invalid ProjectId.");
        }

        if (dto.SprintId.HasValue && !await _db.JiraSprints.AnyAsync(s => s.Id == dto.SprintId.Value))
        {
            return BadRequest("Invalid SprintId.");
        }

        issue.Summary = dto.Summary;
        issue.Status = dto.Status;
        issue.Assignee = dto.Assignee;
        issue.Priority = dto.Priority;
        issue.Description = dto.Description ?? string.Empty;
        issue.ExpectedTime = dto.ExpectedTime ?? string.Empty;
        issue.ActualTime = dto.ActualTime ?? string.Empty;
        issue.ProjectId = dto.ProjectId;
        issue.SprintId = dto.SprintId;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static JiraPayload ParseJiraPayload(string jsonString)
    {
        var options = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };
        return JsonSerializer.Deserialize<JiraPayload>(jsonString, options) ?? new JiraPayload();
    }
}

// Inner DTO structures for Clean Responses / Requests
public class JiraDashboardDto
{
    public List<JiraProjectDto> Projects { get; set; } = new();
    public List<JiraSprintDto> Sprints { get; set; } = new();
    public List<JiraIssueDto> Issues { get; set; } = new();
}

public class JiraProjectDto
{
    public int Id { get; set; }
    public string Key { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

public class JiraSprintDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public int BoardId { get; set; }
}

public class JiraIssueDto
{
    public int Id { get; set; }
    public string Key { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Assignee { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ExpectedTime { get; set; } = string.Empty;
    public string ActualTime { get; set; } = string.Empty;
    public int? SprintId { get; set; }
    public int ProjectId { get; set; }
    public string ProjectName { get; set; } = string.Empty;
    public string ProjectKey { get; set; } = string.Empty;
    public string SprintName { get; set; } = string.Empty;
}

public class TestJiraConnectionDto
{
    public string ApiUrl { get; set; } = string.Empty;
    public string? UserEmail { get; set; }
    public string? ApiToken { get; set; }
}

public class TestJiraConnectionResultDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public int ProjectCount { get; set; }
    public int SprintCount { get; set; }
    public int IssueCount { get; set; }
    public List<JiraIssueDto> SampleIssues { get; set; } = new();
    public List<string> ValidationErrors { get; set; } = new();
}

public class JiraImportResultDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public int ImportedCount { get; set; }
}

public class UpdateJiraIssueDto
{
    public string Summary { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Assignee { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ExpectedTime { get; set; } = string.Empty;
    public string ActualTime { get; set; } = string.Empty;
    public int ProjectId { get; set; }
    public int? SprintId { get; set; }
}

// Parsing structures
public class JiraPayload
{
    public List<JiraPayloadProject>? Projects { get; set; }
    public List<JiraPayloadSprint>? Sprints { get; set; }
    public List<JiraPayloadIssue>? Issues { get; set; }
}

public class JiraPayloadProject
{
    public string Key { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

public class JiraPayloadSprint
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public int BoardId { get; set; }
}

public class JiraPayloadIssue
{
    public string Key { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Assignee { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ExpectedTime { get; set; } = string.Empty;
    public string ActualTime { get; set; } = string.Empty;
    public int? SprintId { get; set; }
    public string ProjectKey { get; set; } = string.Empty;
}
