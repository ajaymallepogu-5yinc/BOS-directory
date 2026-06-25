namespace OrgChart.Services.Dtos;

/// <summary>
/// Shape of one box in the org chart, with its children nested inline so the
/// frontend can render the whole subtree recursively without extra requests.
/// </summary>
public class EmployeeTreeNodeDto
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Company { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string Department { get; set; } = string.Empty;
    public string DepartmentColor { get; set; } = string.Empty;

    /// <summary>Total reports under this person (direct + indirect), shown as the count bubble.</summary>
    public int TotalReportCount { get; set; }

    public List<EmployeeTreeNodeDto> Children { get; set; } = new();
}
