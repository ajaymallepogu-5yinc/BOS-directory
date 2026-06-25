namespace OrgChart.Services.Dtos;

public class DepartmentDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ColorHex { get; set; } = string.Empty;
    public int EmployeeCount { get; set; }
}
