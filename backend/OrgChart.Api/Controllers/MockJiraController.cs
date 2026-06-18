using System.Collections.Generic;
using Microsoft.AspNetCore.Mvc;

namespace OrgChart.Api.Controllers;

[ApiController]
[Route("api/mock-jira")]
public class MockJiraController : ControllerBase
{
    [HttpGet("data")]
    public IActionResult GetMockData()
    {
        var mockPayload = new
        {
            projects = new[]
            {
                new { key = "ORG", name = "OrgChart Web App" },
                new { key = "KEK", name = "Keka Pipeline" }
            },
            sprints = new[]
            {
                new { id = 101, name = "Sprint 2 - Core Integrations", state = "active", boardId = 1 }
            },
            issues = new[]
            {
                new
                {
                    key = "ORG-1",
                    summary = "Implement database schema for Jira boards",
                    status = "Done",
                    assignee = "Sudhakar Somyajula",
                    priority = "High",
                    description = "Create tables for JiraProjects, JiraSprints, and JiraIssues with appropriate foreign keys and indices.",
                    expectedTime = "8h",
                    actualTime = "8h",
                    sprintId = (int?)101,
                    projectKey = "ORG"
                },
                new
                {
                    key = "ORG-2",
                    summary = "Develop import controller for Jira sync",
                    status = "In Progress",
                    assignee = "Ajay Mallepogu",
                    priority = "Highest",
                    description = "Fetch data from Jira mock/live API and write it to local SQL Server instance.",
                    expectedTime = "16h",
                    actualTime = "10h",
                    sprintId = (int?)101,
                    projectKey = "ORG"
                },
                new
                {
                    key = "ORG-3",
                    summary = "Design premium Kanban board UI",
                    status = "To Do",
                    assignee = "Suhani Drolia",
                    priority = "High",
                    description = "Create the front-end layout with glassmorphic cards, sprint filter, and detail view/edit modal.",
                    expectedTime = "24h",
                    actualTime = "0h",
                    sprintId = (int?)101,
                    projectKey = "ORG"
                },
                new
                {
                    key = "KEK-1",
                    summary = "Test connection with Keka Sandbox",
                    status = "Done",
                    assignee = "Hemanth Varma G",
                    priority = "Medium",
                    description = "Verify Keka sandbox API endpoints and ensure connection handles rate limits.",
                    expectedTime = "4h",
                    actualTime = "4h",
                    sprintId = (int?)null,
                    projectKey = "KEK"
                },
                new
                {
                    key = "KEK-2",
                    summary = "Handle duplicate departments on Keka import",
                    status = "To Do",
                    assignee = "Vikhyath Rai",
                    priority = "Low",
                    description = "Resolve duplicate department names or hierarchy issues dynamically during imports.",
                    expectedTime = "12h",
                    actualTime = "0h",
                    sprintId = (int?)null,
                    projectKey = "KEK"
                }
            }
        };

        return Ok(mockPayload);
    }
}
