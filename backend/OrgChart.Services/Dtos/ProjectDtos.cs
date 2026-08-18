using System;
using System.ComponentModel.DataAnnotations;

namespace OrgChart.Services.Dtos;

public class ProjectDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int? ProjectManagerId { get; set; }
    public string? ProjectManagerName { get; set; }
    public int? ClientId { get; set; }
    public string? ClientName { get; set; }
    public bool IsBillable { get; set; }
    public bool IsActive { get; set; }
    public int ResourceCount { get; set; }
    public string? JiraBoardIds { get; set; }
    public string? JiraProjectKey { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
}

public class CreateProjectDto
{
    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    public int? ProjectManagerId { get; set; }
    public int? ClientId { get; set; }

    public bool IsBillable { get; set; }
    public bool IsActive { get; set; } = true;

    [MaxLength(500)]
    public string? JiraBoardIds { get; set; }
}

public class UpdateProjectDto : CreateProjectDto
{
}
