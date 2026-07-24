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

    [Required, EmailAddress, MaxLength(256)]
    public string APPEmail { get; set; } = string.Empty;

    [EmailAddress, MaxLength(256)]
    public string? HRMSEmail { get; set; }

    /// <summary>Null means "this person is the top of the org" (the CEO).</summary>
    public int? ManagerId { get; set; }

    /// <summary>Optional dotted-line manager, independent of ManagerId - routes timesheet
    /// approvals to a second approver in addition to the direct manager.</summary>
    public int? FunctionalManagerId { get; set; }

    [Required]
    public int DepartmentId { get; set; }

    public string? CardColor { get; set; }
}

public class UpdateEmployeeDto : CreateEmployeeDto
{
}

public class UpdateManagerDto
{
    public int? ManagerId { get; set; }
}

public class UpdateAdminRoleDto
{
    public bool IsAdmin { get; set; }
}
