# Jira API Reference — OrgChart Integration

Everything the app calls in Jira Cloud, where it's implemented, and how official each endpoint is. Covers `ProjectsController.cs` (project/space sync) and `TimesheetController.cs` (ticket search) — the only two places in the codebase that talk to Jira.

## The mental model

**Every Jira call is "badge, then errand."** Before doing anything real, the app first asks Atlassian's front desk "what's my Cloud ID?" — because the scoped API token this app uses is only recognized at Atlassian's shared gateway (`api.atlassian.com`), never at the site's own domain (`yoursite.atlassian.net`). That badge-check happens before every errand, every time.

- **Badge (Cloud ID)** — never cached, re-fetched on every single call, even though the answer never changes. The one clear inefficiency in this integration.
- **"Who am I" (accountId)** — asked once per employee, ever, then saved to `Employee.JiraAccountId` in the DB. Correctly cached.

Both entry points are 100% human-triggered (button click / page load) — nothing here is scheduled or cron'd.

## The 2 entry points → 5 Jira calls

| Entry point | Triggered by | Jira calls it makes |
|---|---|---|
| `ProjectsController.SyncJira()` — `POST /api/projects/sync-jira` | Admin clicks **"Sync Jira Boards"** on the Projects page | Cloud ID lookup → List projects (spaces) → List boards, once per space → (resolve project lead, new spaces only) |
| `TimesheetController.GetTickets()` — `GET /api/timesheet/tickets?projectId={id}` | Fires automatically, once per Jira-linked project, as soon as the Timesheet page mounts (warms the ticket-search dropdown) | Cloud ID lookup → (resolve accountId — once ever, cached) → Search board issues, once per board on that project's space |

**Scale to remember:** opening the Timesheet page with N Jira-linked projects fires up to **2N live Jira HTTP calls** at minimum (N badge-checks + N ticket searches), more if any space has multiple boards — every single page load, because the badge isn't cached.

---

## Call 1 — Resolve the Jira Cloud ID

```
GET {jiraBaseUrl}/_edge/tenant_info
```

**Where:** `JiraCloudResolver.ResolveCloudIdAsync()` — shared by both entry points, called on every one of their invocations (not cached).

**No auth header required.**

**Response:** `{"cloudId": "xxxxxxxx-xxxx-..."}`

**Why it exists:** scoped API tokens (the kind this app uses) aren't recognized by a site's own domain — only through Atlassian's shared gateway `api.atlassian.com`, which needs the site's Cloud ID in the URL path. This endpoint looks that ID up dynamically instead of hardcoding it.

**Official status:** not part of Atlassian's formally versioned REST API reference, but explicitly endorsed in [Atlassian's own support KB](https://support.atlassian.com/jira/kb/retrieve-my-atlassian-sites-cloud-id/):

> "You can use the endpoint `https://<my-site-name>.atlassian.net/_edge/tenant_info` to retrieve tenant information... This will return... your Cloud ID."

**The fully-official alternative (not used here):** `GET https://api.atlassian.com/oauth/token/accessible-resources` — requires OAuth 2.0 Bearer tokens instead of the simple Basic Auth (`email:token`) this app is built around, so it's deliberately skipped.

---

## Call 2 — List Jira projects (spaces) *(project sync only)*

```
GET https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/project/search?maxResults=100
Authorization: Basic base64(email:apiToken)
Accept: application/json
```

**Where:** `ProjectsController.cs:165-170`

**What happens with the response:** loops every Jira project (a "space"), and for each one not already in the `Projects` table (matched by `JiraProjectKey`, not board id), inserts a new `Project` row with `Name` = the space's own name and `JiraProjectKey` = its key. This replaced enumerating boards directly — a space can have zero, one, or many boards, so listing boards either missed boardless spaces or created one duplicate `Project` row per extra board on the same space.

**Official doc:** fully official, versioned, first-party — Jira Cloud platform REST API v3, ["Get all projects paginated"](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-projects/#api-rest-api-3-project-search-get).

---

## Call 3 — List board id(s) for a space *(project sync only, every sync)*

```
GET https://api.atlassian.com/ex/jira/{cloudId}/rest/agile/1.0/board?projectKeyOrId={projectKey}&maxResults=50
Authorization: Basic base64(email:apiToken)
Accept: application/json
```

**Where:** `ProjectsController.ResolveBoardIdsAsync()`, called once per space on every sync (unlike name/manager, which are only set on first insert).

**What happens with the response:** collects every board id scoped to that project and joins them into a single comma-separated string, stored in `Project.JiraBoardIds`. A space can have more than one board (e.g. separate Scrum + Kanban boards) — all of them are kept, not just the first. `null` if the space has no board yet.

**Official doc:** fully official, versioned, first-party — Jira Software Cloud REST API (Agile API), ["Get all boards"](https://developer.atlassian.com/cloud/jira/software/rest/api-group-board/#api-rest-agile-1-0-board-get) (filtered with the `projectKeyOrId` query param).

---

## Call 4 — Resolve the caller's Jira accountId *(timesheet only, cached forever)*

```
GET https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/user/search?query={employeeEmail}
Authorization: Basic base64(email:apiToken)
```

**Where:** `TimesheetController.ResolveJiraAccountIdAsync()` — only called if `Employee.JiraAccountId` is `null`.

**Important:** the result is written straight back to the DB (`employee.JiraAccountId = accountId; await _db.SaveChangesAsync();`), so this fires once per employee, ever, not on every page load.

**Official doc:** Jira Cloud platform REST API v3, ["Find users"](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-user-search/#api-rest-api-3-user-search-get).

---

## Call 5 — Search board issues assigned to that user *(timesheet only, every call, once per board)*

```
GET https://api.atlassian.com/ex/jira/{cloudId}/rest/agile/1.0/board/{boardId}/issue
    ?jql=assignee = "{accountId}" ORDER BY updated DESC
    &fields=summary
    &maxResults=100
Authorization: Basic base64(email:apiToken)
```

**Where:** `TimesheetController.cs` — looped once per id in `Project.JiraBoardIds`.

**Deliberate design choice:** does **not** use the more obvious `GET /rest/api/3/search/jql` endpoint. A code comment cites a confirmed Atlassian platform bug (**JRACLOUD-96181**) where that endpoint rejects scoped API tokens regardless of granted scopes. The board-scoped issue endpoint below works fine with scoped tokens (needs `read:board-scope:jira-software`), so that's what's used instead.

**Response parsing:** for each board id, walks `issues[]`, pulls `key` + `fields.summary`, and unions the results across all of a space's boards (deduped by ticket key) into `[{key, summary}, ...]` to populate the ticket-search dropdown in the timesheet grid.

**Official doc:** Jira Software Cloud REST API (Agile API), ["Get issues for board"](https://developer.atlassian.com/cloud/jira/software/rest/api-group-board/#api-rest-agile-1-0-board-boardid-issue-get).

---

## Auth, config, and where credentials come from

All 4 authenticated calls (2, 3, 4, 5) use the exact same header, built once as a shared helper pattern (`TimesheetController.BuildAuthHeader()` / inlined in `ProjectsController`):

```
Authorization: Basic base64("{Jira:Email}:{Jira:ApiToken}")
```

This is a **service-account scoped API token** — not a personal token, not OAuth.

**Config resolution order** (identical in both controllers):

1. `Jira:BaseUrl` / `Jira:Email` / `Jira:ApiToken` from `appsettings.json` (or **user-secrets** locally — see below)
2. Falls back to flat environment variables `JIRA_BASE_URL` / `JIRA_EMAIL` / `JIRA_API_TOKEN` (how it's set in production on Railway)
3. If any of the three are missing → immediate `500` with `"Jira integration is not configured on the server."`, no network call attempted.

**Local dev values** live in .NET user-secrets, not the database or any repo file:
`%APPDATA%\Microsoft\UserSecrets\6fc19a35-89cb-4e0f-a12f-5951c51eca81\secrets.json`, keyed as `Jira:BaseUrl` / `Jira:Email` / `Jira:ApiToken`.

**Required scopes:** `read:board-scope:jira-software`, `read:project:jira` (covers projects, boards, and board-issue search). The `/user/search` call needs its own scope too, implied by it working in practice.

---

## Where to browse the official docs yourself

Atlassian splits Jira Cloud's REST API into two reference sites — everything this app calls lives in one of these two:

- [Jira Software Cloud REST API](https://developer.atlassian.com/cloud/jira/software/rest/) (the "Agile API" — boards, sprints, board-scoped issues) — Calls 3 and 5
- [Jira Cloud platform REST API v3](https://developer.atlassian.com/cloud/jira/platform/rest/v3/) (core resources — issues, users, projects, search) — Calls 2 and 4

Both sites are organized by `api-group-*` (e.g. `api-group-board`, `api-group-projects`, `api-group-user-search`) — the fastest way to jump straight to the endpoint a piece of code is calling.

## Sources

- [Jira Cloud platform REST API v3 — Get all projects paginated](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-projects/#api-rest-api-3-project-search-get)
- [Jira Software Cloud REST API — Get all boards](https://developer.atlassian.com/cloud/jira/software/rest/api-group-board/#api-rest-agile-1-0-board-get)
- [Jira Software Cloud REST API — Get issues for board](https://developer.atlassian.com/cloud/jira/software/rest/api-group-board/#api-rest-agile-1-0-board-boardid-issue-get)
- [Jira Cloud platform REST API v3 — Find users](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-user-search/#api-rest-api-3-user-search-get)
- [How to Find Your Atlassian Cloud Site's Cloud ID | Atlassian Support](https://support.atlassian.com/jira/kb/retrieve-my-atlassian-sites-cloud-id/)
- [Public API to get cloud/site ID — Atlassian Community](https://community.atlassian.com/forums/Jira-questions/Public-API-to-get-cloud-site-ID/qaq-p/2575181)
- Atlassian bug tracker: **JRACLOUD-96181** (reason Call 5 avoids `/rest/api/3/search/jql`)
