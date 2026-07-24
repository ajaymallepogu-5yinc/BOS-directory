using System;
using System.ComponentModel.DataAnnotations;

namespace OrgChart.Services.Dtos;

public class ProjectDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int? ProjectManagerId { get; set; }
    public string? ProjectManagerName { get; set; }
    public bool IsBillable { get; set; }
    public string? JiraBoardId { get; set; }
    public string? JiraProjectKey { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
}

public class CreateProjectDto
{
    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    public int? ProjectManagerId { get; set; }

    public bool IsBillable { get; set; }

    [MaxLength(100)]
    public string? JiraBoardId { get; set; }
}

public class UpdateProjectDto : CreateProjectDto
{
}
