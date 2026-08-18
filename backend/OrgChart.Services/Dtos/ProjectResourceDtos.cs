using System;
using System.ComponentModel.DataAnnotations;

namespace OrgChart.Services.Dtos;

public class ProjectResourceDto
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public int EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public bool IsBillable { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateProjectResourceDto
{
    [Required]
    public int EmployeeId { get; set; }

    public bool IsBillable { get; set; } = true;
}

public class UpdateProjectResourceDto
{
    public bool IsBillable { get; set; }
}
