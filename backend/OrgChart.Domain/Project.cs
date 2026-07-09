using System;

namespace OrgChart.Domain;

public class Project
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int? ProjectManagerId { get; set; }
    public Employee? ProjectManager { get; set; }
    public bool IsBillable { get; set; }
    public string? JiraBoardId { get; set; }

    // Audit fields
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
}
