using System.ComponentModel.DataAnnotations;

namespace OrgChart.Services.Dtos;

public class GoogleLoginDto
{
    [Required]
    public string IdToken { get; set; } = string.Empty;
}

public class UserSessionDto
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string AppEmail { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public bool IsAdmin { get; set; }
    public bool IsManager { get; set; }
}
