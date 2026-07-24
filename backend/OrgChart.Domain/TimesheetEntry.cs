using System;

namespace OrgChart.Domain;

/// <summary>Weekly timesheet container - the whole week is approved/rejected as one unit
/// (see Status). Individual TimesheetEntry line items no longer carry their own status.</summary>
public class Timesheet
{
    public int Id { get; set; }

    public int EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;

    public DateTime StartDate { get; set; } // Monday
    public DateTime EndDate { get; set; }   // Friday

    /// <summary>"Draft", "Pending", "Approved", or "Rejected".</summary>
    public string Status { get; set; } = "Draft";

    public ICollection<TimesheetEntry> Entries { get; set; } = new List<TimesheetEntry>();
    public ICollection<TimesheetReviewLog> ReviewLogs { get; set; } = new List<TimesheetReviewLog>();

    public string? CreatedBy { get; set; }
    public DateTime DateCreated { get; set; } = DateTime.UtcNow;
    public string? ModifiedBy { get; set; }
    public DateTime? DateModified { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DateDeleted { get; set; }
}

/// <summary>A single logged line of work within a Timesheet week.</summary>
public class TimesheetEntry
{
    public int Id { get; set; }

    public int TimesheetId { get; set; }
    public Timesheet Timesheet { get; set; } = null!;

    public int? ProjectId { get; set; }
    public Project? Project { get; set; }

    /// <summary>Jira ticket key (e.g. "TB309-12"). Null for ad-hoc entries.</summary>
    public string? JiraIssueKey { get; set; }

    /// <summary>Denormalized snapshot of the ticket's heading at submission time.</summary>
    public string? JiraIssueSummary { get; set; }

    /// <summary>Free-text description of the work. Used when there's no Jira ticket.</summary>
    public string? TaskDescription { get; set; }

    public DateTime Date { get; set; }
    public decimal HoursSpent { get; set; }
    public string? Comment { get; set; }

    public string? CreatedBy { get; set; }
    public DateTime DateCreated { get; set; } = DateTime.UtcNow;
    public string? ModifiedBy { get; set; }
    public DateTime? DateModified { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DateDeleted { get; set; }
}

/// <summary>One row per approve/reject action taken against a Timesheet.</summary>
public class TimesheetReviewLog
{
    public int Id { get; set; }

    public int TimesheetId { get; set; }
    public Timesheet Timesheet { get; set; } = null!;

    /// <summary>"Approved" or "Rejected".</summary>
    public string Status { get; set; } = string.Empty;

    public int ReviewerId { get; set; }
    public Employee Reviewer { get; set; } = null!;

    public string? Comment { get; set; }

    public string? CreatedBy { get; set; }
    public DateTime DateCreated { get; set; } = DateTime.UtcNow;
    public string? ModifiedBy { get; set; }
    public DateTime? DateModified { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DateDeleted { get; set; }
}
