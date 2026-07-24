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
    public int TimesheetId { get; set; }
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

    /// <summary>"Draft", "Pending", "Approved", or "Rejected" - lives on the parent Timesheet,
    /// the whole week shares one status.</summary>
    public string TimesheetStatus { get; set; } = "Draft";

    /// <summary>From the most recent TimesheetReviewLog row for this entry's Timesheet, if any.</summary>
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

public class ReviewTimesheetDto
{
    /// <summary>"Approved" or "Rejected".</summary>
    public string Status { get; set; } = string.Empty;
    public string? Comment { get; set; }
}

public class SubmitWeekDto
{
    /// <summary>Monday of the week being submitted.</summary>
    public DateTime WeekStart { get; set; }
}
