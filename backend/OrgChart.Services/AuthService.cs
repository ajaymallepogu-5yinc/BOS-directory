using Google.Apis.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using OrgChart.Domain;
using OrgChart.Repositories.Data;
using OrgChart.Services.Dtos;

namespace OrgChart.Services;

public enum GoogleLoginOutcome
{
    MissingClientId,
    InvalidClaims,
    EmployeeNotFound,
    Success
}

public class GoogleLoginResult
{
    public GoogleLoginOutcome Outcome { get; set; }
    public Employee? Employee { get; set; }
    public string? GoogleEmail { get; set; }
    public string? GooglePictureUrl { get; set; }
}

public class AuthService
{
    private readonly UserManager<Employee> _userManager;
    private readonly IConfiguration _config;
    private readonly AppDbContext _db;

    public AuthService(UserManager<Employee> userManager, IConfiguration config, AppDbContext db)
    {
        _userManager = userManager;
        _config = config;
        _db = db;
    }

    /// <summary>Validates the Google ID token and resolves the matching pre-registered employee.
    /// Lets GoogleJsonWebSignature.ValidateAsync's own exceptions (InvalidJwtException, or any
    /// other failure) propagate straight up to the caller - the exact exception message (and,
    /// for InvalidJwtException, which Client ID the server validated against) is part of the
    /// existing error response and needs to stay intact.</summary>
    public async Task<GoogleLoginResult> ValidateGoogleLoginAsync(string idToken)
    {
        var clientId = _config["Authentication:Google:ClientId"]
                       ?? Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID");

        if (string.IsNullOrEmpty(clientId))
        {
            return new GoogleLoginResult { Outcome = GoogleLoginOutcome.MissingClientId };
        }

        var settings = new GoogleJsonWebSignature.ValidationSettings
        {
            Audience = new[] { clientId }
        };

        // Cryptographically validates the ID token from Google
        var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, settings);

        if (payload == null || string.IsNullOrWhiteSpace(payload.Email))
        {
            return new GoogleLoginResult { Outcome = GoogleLoginOutcome.InvalidClaims };
        }

        // Find pre-registered employee by APPEmail (Authentication Email)
        var employee = await _userManager.Users
            .Include(e => e.EmpDepartments)
            .ThenInclude(ed => ed.Department)
            .FirstOrDefaultAsync(e => e.APPEmail.ToLower() == payload.Email.ToLower());

        if (employee == null)
        {
            return new GoogleLoginResult { Outcome = GoogleLoginOutcome.EmployeeNotFound, GoogleEmail = payload.Email };
        }

        return new GoogleLoginResult
        {
            Outcome = GoogleLoginOutcome.Success,
            Employee = employee,
            GoogleEmail = payload.Email,
            GooglePictureUrl = payload.Picture
        };
    }

    public async Task<Employee?> GetEmployeeWithDepartmentAsync(int id)
    {
        return await _userManager.Users
            .Include(e => e.EmpDepartments)
            .ThenInclude(ed => ed.Department)
            .FirstOrDefaultAsync(e => e.Id == id);
    }

    /// <summary>Shared by GoogleLogin and GetCurrentUser - both need the exact same session
    /// shape. avatarFallback lets GoogleLogin fall back to the Google account's own picture when
    /// the employee has none on file; GetCurrentUser has no such fallback available and omits it.</summary>
    public async Task<UserSessionDto> BuildSessionAsync(Employee employee, string? avatarFallback = null)
    {
        var roles = await _userManager.GetRolesAsync(employee);
        var isAdmin = roles.Contains("Admin");
        var isManager = await _db.OrgReportings.AnyAsync(o => o.ManagerId == employee.Id && (o.ReportingType == "Direct" || o.ReportingType == "Functional"));

        return new UserSessionDto
        {
            Id = employee.Id,
            FullName = employee.FullName,
            Title = employee.Title,
            AvatarUrl = employee.AvatarUrl ?? avatarFallback,
            AppEmail = employee.APPEmail,
            Department = employee.EmpDepartments.FirstOrDefault()?.Department?.Name ?? "General",
            IsAdmin = isAdmin,
            IsManager = isManager
        };
    }
}
