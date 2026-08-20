using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using OrgChart.Domain;
using OrgChart.Repositories;
using OrgChart.Services.Dtos;

namespace OrgChart.Services;

public class ProjectService
{
    private readonly EfProjectRepository _projects;
    private readonly EfProjectResourceRepository _projectResources;
    private readonly IConfiguration _config;
    private readonly HttpClient _httpClient;

    public ProjectService(EfProjectRepository projects, EfProjectResourceRepository projectResources, IConfiguration config, HttpClient httpClient)
    {
        _projects = projects;
        _projectResources = projectResources;
        _config = config;
        _httpClient = httpClient;
    }

    public async Task<List<ProjectDto>> GetAllAsync(bool? isActive, int? clientId)
    {
        var list = await _projects.GetAllAsync(isActive, clientId);
        var resourceCounts = await _projectResources.GetCountsByProjectAsync();

        return list.Select(p => new ProjectDto
        {
            Id = p.Id,
            Name = p.Name,
            ProjectManagerId = p.ProjectManagerId,
            ProjectManagerName = p.ProjectManager?.FullName,
            ClientId = p.ClientId,
            ClientName = p.Client?.Name,
            IsBillable = p.IsBillable,
            IsActive = p.IsActive,
            ResourceCount = resourceCounts.GetValueOrDefault(p.Id),
            JiraBoardIds = p.JiraBoardIds,
            JiraProjectKey = p.JiraProjectKey,
            CreatedAt = p.CreatedAt,
            CreatedBy = p.CreatedBy
        }).ToList();
    }

    public async Task<ProjectDto> CreateAsync(CreateProjectDto dto, string username)
    {
        var project = new Project
        {
            Name = dto.Name,
            ProjectManagerId = dto.ProjectManagerId,
            ClientId = dto.ClientId,
            IsBillable = dto.IsBillable,
            IsActive = dto.IsActive,
            JiraBoardIds = dto.JiraBoardIds,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = username
        };

        var created = await _projects.AddAsync(project);

        return new ProjectDto
        {
            Id = created.Id,
            Name = created.Name,
            ProjectManagerId = created.ProjectManagerId,
            ProjectManagerName = created.ProjectManager?.FullName,
            ClientId = created.ClientId,
            ClientName = created.Client?.Name,
            IsBillable = created.IsBillable,
            IsActive = created.IsActive,
            JiraBoardIds = created.JiraBoardIds,
            CreatedAt = created.CreatedAt,
            CreatedBy = created.CreatedBy
        };
    }

    /// <summary>Returns false if no project with this id exists.</summary>
    public async Task<bool> UpdateAsync(int id, UpdateProjectDto dto, string username)
    {
        var updated = await _projects.UpdateAsync(id, new Project
        {
            Name = dto.Name,
            ProjectManagerId = dto.ProjectManagerId,
            ClientId = dto.ClientId,
            IsBillable = dto.IsBillable,
            IsActive = dto.IsActive,
            JiraBoardIds = dto.JiraBoardIds,
            UpdatedBy = username
        });
        return updated != null;
    }

    /// <summary>Returns false if no project with this id exists.</summary>
    public async Task<bool> DeleteAsync(int id) => await _projects.SoftDeleteAsync(id);

    /// <summary>Never throws - every failure path is reported as a (statusCode, result) pair so
    /// the controller can preserve the exact status code (500 misconfigured, 502 Jira
    /// unreachable/rejected, 200 success) without needing its own Jira-specific knowledge.</summary>
    public async Task<(int statusCode, SyncJiraResultDto result)> SyncJiraAsync(string username)
    {
        // Same fallback pattern as the Google Client ID: config (incl. user-secrets locally)
        // first, then a flat environment variable in production (Railway). Never hardcoded.
        var jiraBaseUrl = _config["Jira:BaseUrl"] ?? Environment.GetEnvironmentVariable("JIRA_BASE_URL");
        var jiraEmail = _config["Jira:Email"] ?? Environment.GetEnvironmentVariable("JIRA_EMAIL");
        var jiraApiToken = _config["Jira:ApiToken"] ?? Environment.GetEnvironmentVariable("JIRA_API_TOKEN");

        if (string.IsNullOrWhiteSpace(jiraBaseUrl) || string.IsNullOrWhiteSpace(jiraEmail) || string.IsNullOrWhiteSpace(jiraApiToken))
        {
            return (500, new SyncJiraResultDto { Success = false, Message = "Jira integration is not configured on the server. Contact an administrator." });
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
                return (502, new SyncJiraResultDto { Success = false, Message = "Could not resolve the Jira site's Cloud ID. Verify the configured Jira URL." });
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
                    return (502, new SyncJiraResultDto { Success = false, Message = $"Jira request failed (HTTP {(int)response.StatusCode}). Verify the configured Jira URL and credentials, and that the account has been granted access to a project." });
                }

                var json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                // Jira caps the real page size (currently 50) regardless of what maxResults asks
                // for, so the next page must start after however many boards actually came back in
                // THIS page - advancing by the requested pageSize instead silently skips whichever
                // boards fell in the gap between what was asked for and what was actually returned.
                var receivedCount = 0;
                if (doc.RootElement.TryGetProperty("values", out var values))
                {
                    receivedCount = values.GetArrayLength();
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
                // unexpected response shape. An empty page also stops the loop outright - otherwise
                // a false/missing isLast on a page with nothing left would spin at the same startAt forever.
                isLast = !doc.RootElement.TryGetProperty("isLast", out var isLastProp) || isLastProp.GetBoolean() || receivedCount == 0;
                startAt += receivedCount;
            } while (!isLast);

            spaces = spacesByKey.Values.ToList();
        }
        catch (Exception)
        {
            // Never bubble up the raw exception message - it can include connection/auth details.
            return (502, new SyncJiraResultDto { Success = false, Message = "Could not reach Jira. Verify the configured Jira URL and network connectivity." });
        }

        var syncedCount = 0;
        foreach (var space in spaces)
        {
            var existing = await _projects.GetByJiraProjectKeyAsync(space.Key);

            // A space's board lineup can change (board added/removed) - re-derive on every sync,
            // for both new and already-synced projects, unlike name/manager which are set once.
            var boardIds = boardIdsByProjectKey.TryGetValue(space.Key, out var boardIdList) ? string.Join(",", boardIdList) : null;

            if (existing == null)
            {
                // Ask Jira who actually leads this project, rather than defaulting every synced
                // project to one hardcoded person - only set on first insert, never overwritten
                // on later syncs, so it doesn't fight with a manual edit made afterward.
                var managerId = await ResolveProjectManagerIdAsync(cloudId, space.Key, jiraEmail, jiraApiToken);

                _projects.TrackNew(new Project
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

        await _projects.SaveChangesAsync();

        return (200, new SyncJiraResultDto
        {
            Success = true,
            Message = syncedCount > 0
                ? $"Successfully synced {syncedCount} new project(s) from Jira!"
                : "No new Jira projects found. Database is already up to date.",
            SyncedCount = syncedCount
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

            return await _projects.FindEmployeeIdByEmailAsync(leadEmail);
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
