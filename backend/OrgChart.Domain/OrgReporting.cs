namespace OrgChart.Domain;

public class OrgReporting
{
    public int Id { get; set; }

    public int EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;

    public int ManagerId { get; set; }
    public Employee Manager { get; set; } = null!;

    /// <summary>Type of reporting: "Direct" or "Functional"</summary>
    public string ReportingType { get; set; } = "Direct";

    public string? CreatedBy { get; set; }
    public DateTime DateCreated { get; set; } = DateTime.UtcNow;
    public string? ModifiedBy { get; set; }
    public DateTime? DateModified { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DateDeleted { get; set; }
}
