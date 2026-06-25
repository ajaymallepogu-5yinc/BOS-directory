using System.ComponentModel.DataAnnotations;

namespace OrgChart.Services.Dtos;

public class CreateEmployeeDto
{
    [Required, MaxLength(150)]
    public string FullName { get; set; } = string.Empty;

    [Required, MaxLength(150)]
    public string Title { get; set; } = string.Empty;

    [Required, MaxLength(150)]
    public string Company { get; set; } = string.Empty;

    public string? AvatarUrl { get; set; }

    /// <summary>Null means "this person is the top of the org" (the CEO).</summary>
    public int? ManagerId { get; set; }

    [Required]
    public int DepartmentId { get; set; }
}

public class UpdateEmployeeDto : CreateEmployeeDto
{
}
