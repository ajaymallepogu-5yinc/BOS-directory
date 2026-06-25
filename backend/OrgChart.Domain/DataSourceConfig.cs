using System.ComponentModel.DataAnnotations;

namespace OrgChart.Domain;

public class DataSourceConfig
{
    public int Id { get; set; }

    [Required, MaxLength(50)]
    public string Mode { get; set; } = "Local"; // "Local" or "HrPortalApi"

    public string? HrPortalApiUrl { get; set; }

    public string? HrPortalApiAuthHeaderName { get; set; }

    public string? HrPortalApiAuthHeaderValue { get; set; }

    // Jira Configurations
    public string? JiraApiUrl { get; set; }
    public string? JiraUserEmail { get; set; }
    public string? JiraApiToken { get; set; }

    // Mappings
    [Required, MaxLength(100)]
    public string IdField { get; set; } = "id";

    [Required, MaxLength(100)]
    public string FullNameField { get; set; } = "fullName";

    [Required, MaxLength(100)]
    public string TitleField { get; set; } = "title";

    [Required, MaxLength(100)]
    public string CompanyField { get; set; } = "company";

    [Required, MaxLength(100)]
    public string AvatarUrlField { get; set; } = "avatarUrl";

    [Required, MaxLength(100)]
    public string ManagerIdField { get; set; } = "managerId";

    [Required, MaxLength(100)]
    public string DepartmentIdField { get; set; } = "departmentId";

    [Required, MaxLength(100)]
    public string DepartmentNameField { get; set; } = "departmentName";

    [Required, MaxLength(100)]
    public string DepartmentColorField { get; set; } = "departmentColor";
}
