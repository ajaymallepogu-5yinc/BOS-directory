using System;

namespace OrgChart.Domain;

public class Project
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int? ProjectManagerId { get; set; }
    public Employee? ProjectManager { get; set; }

    public int? ClientId { get; set; }
    public Client? Client { get; set; }

    public bool IsBillable { get; set; }
    public bool IsActive { get; set; } = true;

    /// <summary>Comma-separated Jira board ids for this project's space - a space can have more
    /// than one board (e.g. separate Scrum + Kanban boards), so ticket search unions issues across
    /// all of them instead of picking just one.</summary>
    public string? JiraBoardIds { get; set; }
    public string? JiraProjectKey { get; set; }

    // Audit fields
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DateDeleted { get; set; }
}
