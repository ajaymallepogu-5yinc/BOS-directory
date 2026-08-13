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
[Route("api/projects")]
[Authorize]
public class ProjectsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<Employee> _userManager;
    private readonly IConfiguration _config;
    private readonly HttpClient _httpClient;

    public ProjectsController(AppDbContext db, UserManager<Employee> userManager, IConfiguration config, HttpClient httpClient)
    {
        _db = db;
        _userManager = userManager;
        _config = config;
        _httpClient = httpClient;
    }

    [HttpGet]
    public async Task<ActionResult<List<ProjectDto>>> GetAll()
    {
        var list = await _db.Projects
            .Include(p => p.ProjectManager)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

        var result = list.Select(p => new ProjectDto
        {
            Id = p.Id,
            Name = p.Name,
            ProjectManagerId = p.ProjectManagerId,
            ProjectManagerName = p.ProjectManager?.FullName,
            IsBillable = p.IsBillable,
            JiraBoardIds = p.JiraBoardIds,
            JiraProjectKey = p.JiraProjectKey,
            CreatedAt = p.CreatedAt,
            CreatedBy = p.CreatedBy
        }).ToList();

        return Ok(result);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ProjectDto>> Create(CreateProjectDto dto)
    {
        var username = User.Identity?.Name ?? "System";
        
        var project = new Project
        {
            Name = dto.Name,
            ProjectManagerId = dto.ProjectManagerId,
            IsBillable = dto.IsBillable,
            JiraBoardIds = dto.JiraBoardIds,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = username
        };

        _db.Projects.Add(project);
        await _db.SaveChangesAsync();

        // Load manager name for returning
        if (project.ProjectManagerId.HasValue)
        {
            project.ProjectManager = await _db.Users.FirstOrDefaultAsync(u => u.Id == project.ProjectManagerId.Value);
        }

        return CreatedAtAction(nameof(GetAll), new {}, new ProjectDto
        {
            Id = project.Id,
            Name = project.Name,
            ProjectManagerId = project.ProjectManagerId,
            ProjectManagerName = project.ProjectManager?.FullName,
            IsBillable = project.IsBillable,
            JiraBoardIds = project.JiraBoardIds,
            CreatedAt = project.CreatedAt,
            CreatedBy = project.CreatedBy
        });
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(int id, UpdateProjectDto dto)
    {
        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id);
        if (project == null) return NotFound();

        var username = User.Identity?.Name ?? "System";

        project.Name = dto.Name;
        project.ProjectManagerId = dto.ProjectManagerId;
        project.IsBillable = dto.IsBillable;
        project.JiraBoardIds = dto.JiraBoardIds;
        project.UpdatedAt = DateTime.UtcNow;
        project.UpdatedBy = username;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id);
        if (project == null) return NotFound();

        project.IsDeleted = true;
        project.DateDeleted = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("sync-jira")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SyncJira()
    {
        var username = User.Identity?.Name ?? "System";

        // Same fallback pattern as the Google Client ID: config (incl. user-secrets locally)
        // first, then a flat environment variable in production (Railway). Never hardcoded.
        var jiraBaseUrl = _config["Jira:BaseUrl"] ?? Environment.GetEnvironmentVariable("JIRA_BASE_URL");
        var jiraEmail = _config["Jira:Email"] ?? Environment.GetEnvironmentVariable("JIRA_EMAIL");
        var jiraApiToken = _config["Jira:ApiToken"] ?? Environment.GetEnvironmentVariable("JIRA_API_TOKEN");

        if (string.IsNullOrWhiteSpace(jiraBaseUrl) || string.IsNullOrWhiteSpace(jiraEmail) || string.IsNullOrWhiteSpace(jiraApiToken))
        {
            return StatusCode(500, new { success = false, message = "Jira integration is not configured on the server. Contact an administrator." });
        }

        List<JiraSpace> spaces;
        Dictionary<string, List<string>> boardIdsByProjectKey;
        string? cloudId;
        try
        {
            // Scoped service-account tokens are only recognized through Atlassian's shared
            // platform gateway (api.atlassian.com), not a site's own domain - so resolve the
            // site's Cloud ID first (a free, unauthenticated lookup) and route through that.
            cloudId = await JiraCloudResolver.ResolveCloudIdAsync(_httpClient, jiraBaseUrl);
            if (string.IsNullOrWhiteSpace(cloudId))
            {
                return StatusCode(502, new { success = false, message = "Could not resolve the Jira site's Cloud ID. Verify the configured Jira URL." });
            }

            // Deliberately NOT /rest/api/3/project/search - confirmed the same class of platform
            // bug as JRACLOUD-96181 (see TimesheetController): that platform REST v3 endpoint
            // rejects scoped API tokens outright regardless of granted scopes, while the Agile
            // API's board listing works fine with the exact same token. Every board's own
            // `location` carries its parent project's key/name, so one board listing call derives
            // the full distinct-projects list (and each project's board ids) without a second call.
            var spacesByKey = new Dictionary<string, JiraSpace>();
            boardIdsByProjectKey = new Dictionary<string, List<string>>();

            var startAt = 0;
            const int pageSize = 100;
            bool isLast;
            do
            {
                var request = new HttpRequestMessage(HttpMethod.Get, $"https://api.atlassian.com/ex/jira/{cloudId}/rest/agile/1.0/board?maxResults={pageSize}&startAt={startAt}");
                var authBytes = Encoding.UTF8.GetBytes($"{jiraEmail}:{jiraApiToken}");
                request.Headers.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(authBytes));
                request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

                var response = await _httpClient.SendAsync(request);
                if (!response.IsSuccessStatusCode)
                {
                    // Deliberately don't forward Jira's response body - it could echo back request
                    // details. Only the status code is safe to surface.
                    return StatusCode(502, new { success = false, message = $"Jira request failed (HTTP {(int)response.StatusCode}). Verify the configured Jira URL and credentials, and that the account has been granted access to a project." });
                }

                var json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("values", out var values))
                {
                    foreach (var board in values.EnumerateArray())
                    {
                        if (!board.TryGetProperty("location", out var location)) continue;

                        // A board with no project key (rare - e.g. a cross-project filter board) can't
                        // be attributed to a single space, so it's skipped rather than guessed at.
                        var projectKey = location.TryGetProperty("projectKey", out var pk) ? pk.GetString() : null;
                        if (string.IsNullOrWhiteSpace(projectKey)) continue;

                        if (!spacesByKey.ContainsKey(projectKey))
                        {
                            var projectName = location.TryGetProperty("projectName", out var pn) ? pn.GetString() : null;
                            spacesByKey[projectKey] = new JiraSpace(projectKey, string.IsNullOrWhiteSpace(projectName) ? projectKey : projectName!);
                        }

                        var boardId = board.TryGetProperty("id", out var idProp) ? idProp.GetRawText() : null;
                        if (string.IsNullOrWhiteSpace(boardId)) continue;

                        if (!boardIdsByProjectKey.TryGetValue(projectKey, out var ids))
                        {
                            ids = new List<string>();
                            boardIdsByProjectKey[projectKey] = ids;
                        }
                        ids.Add(boardId);
                    }
                }

                // Missing isLast is treated as "stop" rather than looping forever on an
                // unexpected response shape.
                isLast = !doc.RootElement.TryGetProperty("isLast", out var isLastProp) || isLastProp.GetBoolean();
                startAt += pageSize;
            } while (!isLast);

            spaces = spacesByKey.Values.ToList();
        }
        catch (Exception)
        {
            // Never bubble up the raw exception message - it can include connection/auth details.
            return StatusCode(502, new { success = false, message = "Could not reach Jira. Verify the configured Jira URL and network connectivity." });
        }

        var syncedCount = 0;
        foreach (var space in spaces)
        {
            var existing = await _db.Projects.FirstOrDefaultAsync(p => p.JiraProjectKey == space.Key);

            // A space's board lineup can change (board added/removed) - re-derive on every sync,
            // for both new and already-synced projects, unlike name/manager which are set once.
            var boardIds = boardIdsByProjectKey.TryGetValue(space.Key, out var boardIdList) ? string.Join(",", boardIdList) : null;

            if (existing == null)
            {
                // Ask Jira who actually leads this project, rather than defaulting every synced
                // project to one hardcoded person - only set on first insert, never overwritten
                // on later syncs, so it doesn't fight with a manual edit made afterward.
                var managerId = await ResolveProjectManagerIdAsync(cloudId, space.Key, jiraEmail, jiraApiToken);

                _db.Projects.Add(new Project
                {
                    Name = space.Name,
                    ProjectManagerId = managerId,
                    IsBillable = true,
                    JiraBoardIds = boardIds,
                    JiraProjectKey = space.Key,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = username
                });
                syncedCount++;
            }
            else if (existing.JiraBoardIds != boardIds)
            {
                existing.JiraBoardIds = boardIds;
            }
        }

        if (_db.ChangeTracker.HasChanges())
        {
            await _db.SaveChangesAsync();
        }

        return Ok(new
        {
            success = true,
            message = syncedCount > 0
                ? $"Successfully synced {syncedCount} new project(s) from Jira!"
                : "No new Jira projects found. Database is already up to date.",
            syncedCount
        });
    }

    /// <summary>Looks up the project's real Jira lead (GET /rest/api/3/project/{key}) and matches
    /// their email against this app's Employees table. Returns null - leaving the project
    /// "Unassigned" rather than guessing - if the board has no project key, the lookup fails, the
    /// lead has no email visible (their own Jira privacy setting can hide it even with the right
    /// scope), or nobody with that email exists here yet.</summary>
    private async Task<int?> ResolveProjectManagerIdAsync(string? cloudId, string? projectKey, string jiraEmail, string jiraApiToken)
    {
        if (string.IsNullOrWhiteSpace(cloudId) || string.IsNullOrWhiteSpace(projectKey))
        {
            return null;
        }

        try
        {
            var url = $"https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/project/{Uri.EscapeDataString(projectKey)}";
            var request = new HttpRequestMessage(HttpMethod.Get, url);
            var authBytes = Encoding.UTF8.GetBytes($"{jiraEmail}:{jiraApiToken}");
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(authBytes));
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                return null;
            }

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("lead", out var lead))
            {
                return null;
            }

            var leadEmail = lead.TryGetProperty("emailAddress", out var emailProp) ? emailProp.GetString() : null;
            if (string.IsNullOrWhiteSpace(leadEmail))
            {
                return null;
            }

            var employee = await _db.Users.FirstOrDefaultAsync(u => u.APPEmail.ToLower() == leadEmail.ToLower());
            return employee?.Id;
        }
        catch
        {
            // Same policy as the rest of this controller's Jira calls: a lookup failure here
            // shouldn't fail the whole sync, it just leaves this one project Unassigned.
            return null;
        }
    }


    private record JiraSpace(string Key, string Name);
}
