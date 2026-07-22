# Jira API Reference — OrgChart Integration

What the app actually calls in Jira Cloud, where it's implemented, and how official each endpoint is. Covers everything in `backend/OrgChart.Api/Controllers/ProjectsController.cs`.

## Summary

| Call | Purpose | Official status |
|---|---|---|
| `GET /rest/agile/1.0/board` | List Jira boards | ✅ Fully official, versioned, documented API |
| `api.atlassian.com/ex/jira/{cloudId}/...` prefix | Route through the shared platform gateway | ✅ Official Atlassian mechanism for scoped-token access |
| `GET {site}/_edge/tenant_info` | Look up the site's Cloud ID | ⚠️ Real and support-doc-endorsed, but not part of the formal versioned API reference |

## 1. Board listing

```
GET https://api.atlassian.com/ex/jira/{cloudId}/rest/agile/1.0/board?maxResults=100
```

**Where:** `ProjectsController.SyncJira()`

This is Atlassian's official, publicly documented Jira Software Cloud REST API — specifically the Agile API's ["Get all boards"](https://developer.atlassian.com/cloud/jira/software/rest/api-group-board/#api-rest-agile-1-0-board-get) endpoint. Stable, versioned, first-party — nothing custom-built.

The `api.atlassian.com/ex/jira/{cloudId}/...` prefix in front of it is also an official Atlassian mechanism: their documented "platform gateway" pattern for accessing Jira Cloud REST APIs with **scoped tokens** (the kind service accounts and Connect/Forge apps use), as opposed to calling a site's own domain directly.

**Why the gateway matters:** a site's own domain (`yoursite.atlassian.net`) only recognizes classic personal API tokens. Scoped service-account tokens are only recognized through this shared gateway. See `docs` note in code and the published setup guide for the full "two doors" explanation.

**Auth:** HTTP Basic Auth — `Authorization: Basic base64(email:token)`, built in code from `Jira:Email` / `Jira:ApiToken`.

**Scopes required:** `read:board-scope:jira-software`, `read:project:jira` (already covers this call; see the full scope list used when the token was created).

## 2. Cloud ID lookup

```
GET https://{jiraBaseUrl}/_edge/tenant_info
```

**Where:** `ProjectsController.ResolveCloudIdAsync()` — called automatically on every sync, using whatever `Jira:BaseUrl` is currently configured. Nothing is hardcoded or manually looked up.

**Response:** `{"cloudId": "..."}`

**Status:** not part of Atlassian's formally versioned developer REST API reference — but explicitly described in [Atlassian's own support knowledge base](https://support.atlassian.com/jira/kb/retrieve-my-atlassian-sites-cloud-id/) as the correct way to retrieve a site's Cloud ID:

> "You can use the endpoint `https://<my-site-name>.atlassian.net/_edge/tenant_info` to retrieve tenant information... This will return... your Cloud ID."

It sits in a middle ground: not invented, not a hidden hack, but not a capital-O "Official" versioned API contract either.

**The fully-official alternative** (not used here): `GET https://api.atlassian.com/oauth/token/accessible-resources` — Atlassian's actually-supported way to get a Cloud ID. Not used in this app because it requires an OAuth 2.0 Bearer access token, not the simpler Basic Auth (`email:token`) this integration is built around. Switching to it would mean implementing a full OAuth token exchange — see the "OAuth vs Basic Auth" tradeoff section in the service account setup guide.

## Not yet implemented

Ticket/issue-level import (e.g. `GET /rest/agile/1.0/board/{boardId}/issue`) is deliberately **not** built yet — deferred until the timesheet feature needs it. The service account's token scopes already include what that would need (`read:issue:jira-software`, `read:sprint:jira-software`), so no token regeneration will be required when that work starts.

## Sources

- [Jira Software Cloud REST API — Get all boards](https://developer.atlassian.com/cloud/jira/software/rest/api-group-board/#api-rest-agile-1-0-board-get)
- [How to Find Your Atlassian Cloud Site's Cloud ID | Atlassian Support](https://support.atlassian.com/jira/kb/retrieve-my-atlassian-sites-cloud-id/)
- [Public API to get cloud/site ID — Atlassian Community](https://community.atlassian.com/forums/Jira-questions/Public-API-to-get-cloud-site-ID/qaq-p/2575181)
