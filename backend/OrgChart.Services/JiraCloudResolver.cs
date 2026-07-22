using System.Text.Json;

namespace OrgChart.Services;

public static class JiraCloudResolver
{
    /// <summary>
    /// Looks up a Jira Cloud site's Cloud ID from its domain via Atlassian's free,
    /// unauthenticated tenant-info endpoint. Needed to call the api.atlassian.com gateway,
    /// which is the only URL scoped service-account tokens are recognized against.
    /// </summary>
    public static async Task<string?> ResolveCloudIdAsync(HttpClient httpClient, string jiraBaseUrl)
    {
        try
        {
            var response = await httpClient.GetAsync($"{jiraBaseUrl.TrimEnd('/')}/_edge/tenant_info");
            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.TryGetProperty("cloudId", out var cloudIdProp) ? cloudIdProp.GetString() : null;
        }
        catch
        {
            return null;
        }
    }
}
