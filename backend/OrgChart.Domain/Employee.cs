using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations.Schema;

namespace OrgChart.Domain;

/// <summary>
/// A single employee user in the system. Inherits from IdentityUser<int>
/// so all security/auth details reside in AspNetUsers alongside domain info.
/// </summary>
public class Employee : IdentityUser<int>
{
    public string FullName { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Company { get; set; } = string.Empty;

    /// <summary>Optional photo URL. When empty, the UI renders initials instead.</summary>
    public string? AvatarUrl { get; set; }

    // Authentication and Role fields
    public string APPEmail { get; set; } = string.Empty;
    public string? HRMSEmail { get; set; }
    
    public int? APPRoleId { get; set; }
    public AppRole? APPRole { get; set; }

    public ICollection<EmpDepartment> EmpDepartments { get; set; } = new List<EmpDepartment>();

    // [NotMapped] Helpers: In-memory properties for mapping, parsing, and backwards compatibility.
    // These are ignored by Entity Framework Core (no database columns created).
    [NotMapped]
    public int? ManagerId { get; set; }

    [NotMapped]
    public int? DepartmentId { get; set; }

    [NotMapped]
    public Department? Department { get; set; }
}
