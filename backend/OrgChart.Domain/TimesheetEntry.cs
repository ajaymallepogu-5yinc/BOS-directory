using System;

namespace OrgChart.Domain;

public class TimesheetEntry
{
    public int Id { get; set; }

    public int EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;

    public int? ProjectId { get; set; }
    public Project? Project { get; set; }

    /// <summary>Jira ticket key (e.g. "TB309-12"). Null for ad-hoc entries.</summary>
    public string? JiraIssueKey { get; set; }

    /// <summary>Denormalized snapshot of the ticket's heading at submission time.</summary>
    public string? JiraIssueSummary { get; set; }

    /// <summary>Free-text description of the work. Used when there's no Jira ticket.</summary>
    public string? TaskDescription { get; set; }

    public DateTime WorkDate { get; set; }
    public decimal HoursSpent { get; set; }
    public string? Comment { get; set; }

    /// <summary>"Pending", "Approved", or "Rejected".</summary>
    public string Status { get; set; } = "Pending";
    public string? ReviewerComment { get; set; }

    public int? ReviewedByUserId { get; set; }
    public Employee? ReviewedByUser { get; set; }
    public DateTime? ReviewedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
