using System;

namespace OrgChart.Services.Dtos;

public class JiraTicketDto
{
    public string Key { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
}

public class TimesheetEntryDto
{
    public int Id { get; set; }
    public int EmployeeId { get; set; }
    public string? EmployeeName { get; set; }
    public int? ProjectId { get; set; }
    public string? ProjectName { get; set; }
    public string? JiraIssueKey { get; set; }
    public string? JiraIssueSummary { get; set; }
    public string? TaskDescription { get; set; }
    public DateTime WorkDate { get; set; }
    public decimal HoursSpent { get; set; }
    public string? Comment { get; set; }
    public string Status { get; set; } = "Pending";
    public string? ReviewerComment { get; set; }
    public int? ReviewedByUserId { get; set; }
    public string? ReviewedByName { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateTimesheetEntryDto
{
    public int? ProjectId { get; set; }
    public string? JiraIssueKey { get; set; }
    public string? JiraIssueSummary { get; set; }
    public string? TaskDescription { get; set; }
    public DateTime WorkDate { get; set; }
    public decimal HoursSpent { get; set; }
    public string? Comment { get; set; }
}

public class UpdateTimesheetEntryDto : CreateTimesheetEntryDto
{
}

public class ReviewTimesheetEntryDto
{
    /// <summary>"Approved" or "Rejected".</summary>
    public string Status { get; set; } = string.Empty;
    public string? ReviewerComment { get; set; }
}

public class SubmitWeekDto
{
    /// <summary>Monday of the week being submitted.</summary>
    public DateTime WeekStart { get; set; }
}
