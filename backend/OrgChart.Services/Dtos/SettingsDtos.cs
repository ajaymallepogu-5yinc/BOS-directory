using System.Collections.Generic;

namespace OrgChart.Services.Dtos;

public class SettingsDto
{
    public string Mode { get; set; } = "Local";
    public string? HrPortalApiUrl { get; set; }
    public string? HrPortalApiAuthHeaderName { get; set; }
    public string? HrPortalApiAuthHeaderValue { get; set; }

    public string IdField { get; set; } = "id";
    public string FullNameField { get; set; } = "fullName";
    public string TitleField { get; set; } = "title";
    public string AvatarUrlField { get; set; } = "avatarUrl";
    public string ManagerIdField { get; set; } = "managerId";
    public string DepartmentIdField { get; set; } = "departmentId";
    public string DepartmentNameField { get; set; } = "departmentName";
    public string DepartmentColorField { get; set; } = "departmentColor";
    public string APPEmailField { get; set; } = "appEmail";
    public string HRMSEmailField { get; set; } = "hrmsEmail";
    public bool SupportsWrites { get; set; }
}

public class UpdateSettingsDto
{
    public string Mode { get; set; } = "Local";
    public string? HrPortalApiUrl { get; set; }
    public string? HrPortalApiAuthHeaderName { get; set; }
    public string? HrPortalApiAuthHeaderValue { get; set; }

    public string IdField { get; set; } = "id";
    public string FullNameField { get; set; } = "fullName";
    public string TitleField { get; set; } = "title";
    public string AvatarUrlField { get; set; } = "avatarUrl";
    public string ManagerIdField { get; set; } = "managerId";
    public string DepartmentIdField { get; set; } = "departmentId";
    public string DepartmentNameField { get; set; } = "departmentName";
    public string DepartmentColorField { get; set; } = "departmentColor";
    public string APPEmailField { get; set; } = "appEmail";
    public string HRMSEmailField { get; set; } = "hrmsEmail";
}

public class TestConnectionDto
{
    public string ApiUrl { get; set; } = string.Empty;
    public string? AuthHeaderName { get; set; }
    public string? AuthHeaderValue { get; set; }
    public string IdField { get; set; } = "id";
    public string FullNameField { get; set; } = "fullName";
    public string TitleField { get; set; } = "title";
    public string AvatarUrlField { get; set; } = "avatarUrl";
    public string ManagerIdField { get; set; } = "managerId";
    public string DepartmentIdField { get; set; } = "departmentId";
    public string DepartmentNameField { get; set; } = "departmentName";
    public string DepartmentColorField { get; set; } = "departmentColor";
    public string APPEmailField { get; set; } = "appEmail";
    public string HRMSEmailField { get; set; } = "hrmsEmail";
}

public class EmployeePreviewDto
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public int? ManagerId { get; set; }
    public int DepartmentId { get; set; }
    public string DepartmentName { get; set; } = string.Empty;
}

public class TestConnectionResultDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public int EmployeeCount { get; set; }
    public List<EmployeePreviewDto> SampleEmployees { get; set; } = new();
    public List<string> ValidationErrors { get; set; } = new();
}

public class ImportResultDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public int ImportedCount { get; set; }
}
