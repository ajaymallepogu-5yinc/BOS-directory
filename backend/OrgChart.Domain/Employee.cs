namespace OrgChart.Domain;

/// <summary>
/// A single person in the org chart. ManagerId is the self-reference that
/// makes the whole tree possible: null = top of the org (CEO), otherwise
/// points at the Id of the person they report to.
/// </summary>
public class Employee
{
    public int Id { get; set; }

    public string FullName { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Company { get; set; } = string.Empty;

    /// <summary>Optional photo URL. When empty, the UI renders initials instead.</summary>
    public string? AvatarUrl { get; set; }

    public int? ManagerId { get; set; }
    public Employee? Manager { get; set; }
    public ICollection<Employee> DirectReports { get; set; } = new List<Employee>();

    public int DepartmentId { get; set; }
    public Department Department { get; set; } = null!;

    // Authentication and Role fields
    public string? AspNetUserId { get; set; }
    public string APPEmail { get; set; } = string.Empty;
    public string? HRMSEmail { get; set; }
    
    public int? APPRoleId { get; set; }
    public AppRole? APPRole { get; set; }
}
