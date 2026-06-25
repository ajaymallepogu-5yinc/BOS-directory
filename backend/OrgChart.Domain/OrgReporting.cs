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
}
