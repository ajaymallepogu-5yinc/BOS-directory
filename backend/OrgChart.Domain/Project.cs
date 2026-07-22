using System;

namespace OrgChart.Domain;

public class Project
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int? ProjectManagerId { get; set; }
    public Employee? ProjectManager { get; set; }

    /// <summary>Separate from ProjectManager - authorizes timesheet approvals for entries logged
    /// against this project, in addition to the employee's own direct manager.</summary>
    public int? FunctionalManagerId { get; set; }
    public Employee? FunctionalManager { get; set; }

    public bool IsBillable { get; set; }
    public string? JiraBoardId { get; set; }
    public string? JiraProjectKey { get; set; }

    // Audit fields
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
}
