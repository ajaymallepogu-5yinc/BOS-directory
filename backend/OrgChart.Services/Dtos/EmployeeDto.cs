namespace OrgChart.Services.Dtos;

/// <summary>Flat representation used by the admin table and single-record lookups.</summary>
public class EmployeeDto
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Company { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public int? ManagerId { get; set; }
    public string? ManagerName { get; set; }
    public int DepartmentId { get; set; }
    public string Department { get; set; } = string.Empty;
    public string AppEmail { get; set; } = string.Empty;
    public string? HrmsEmail { get; set; }
}

/// <summary>Lightweight record used to populate "reports to" dropdowns.</summary>
public class ManagerOptionDto
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
}
