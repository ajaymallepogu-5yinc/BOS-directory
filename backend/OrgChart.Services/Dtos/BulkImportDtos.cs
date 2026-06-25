using System.Collections.Generic;

namespace OrgChart.Services.Dtos;

public class BulkImportDto
{
    public List<BulkImportEmployeeDto> Employees { get; set; } = new();
}

public class BulkImportEmployeeDto
{
    public string Id { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Company { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string? ManagerId { get; set; }
    public string DepartmentName { get; set; } = string.Empty;
    public string? DepartmentColor { get; set; }
}

public class BulkImportResultDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public int ImportedCount { get; set; }
}
