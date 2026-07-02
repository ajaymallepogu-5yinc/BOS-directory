using Google.Apis.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrgChart.Domain;
using OrgChart.Repositories.Data;
using OrgChart.Services.Dtos;
using System.ComponentModel.DataAnnotations;

namespace OrgChart.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly UserManager<Employee> _userManager;
    private readonly SignInManager<Employee> _signInManager;
    private readonly IConfiguration _config;

    public AuthController(
        UserManager<Employee> userManager,
        SignInManager<Employee> signInManager,
        IConfiguration config)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _config = config;
    }

    [HttpPost("google-login")]
    public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.IdToken))
        {
            return BadRequest(new { Message = "Google ID Token is required." });
        }

        try
        {
            var clientId = _config["Authentication:Google:ClientId"] 
                           ?? Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID");

            if (string.IsNullOrEmpty(clientId))
            {
                return StatusCode(500, new { Message = "Google Client ID is not configured on the server." });
            }

            var settings = new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = new[] { clientId }
            };

            // Crytographically validates the ID token from Google
            var payload = await GoogleJsonWebSignature.ValidateAsync(dto.IdToken, settings);
            
            if (payload == null || string.IsNullOrWhiteSpace(payload.Email))
            {
                return BadRequest(new { Message = "Invalid Google ID Token claims." });
            }

            // Find pre-registered employee by APPEmail (Authentication Email)
            var employee = await _userManager.Users
                .Include(e => e.EmpDepartments)
                .ThenInclude(ed => ed.Department)
                .FirstOrDefaultAsync(e => e.APPEmail.ToLower() == payload.Email.ToLower());

            if (employee == null)
            {
                return StatusCode(403, new { 
                    Message = $"Access Denied. The email '{payload.Email}' is not pre-registered in the Company Directory. Please contact your administrator." 
                });
            }

            // Establish standard ASP.NET Identity session cookie
            await _signInManager.SignInAsync(employee, isPersistent: true);

            // Determine if admin (only Sashank is Admin by default, or anyone with Admin role)
            var roles = await _userManager.GetRolesAsync(employee);
            var isAdmin = roles.Contains("Admin") || employee.APPEmail.ToLower() == "sashank@bosframework.com";

            return Ok(new UserSessionDto
            {
                Id = employee.Id,
                FullName = employee.FullName,
                Title = employee.Title,
                Company = employee.Company,
                AvatarUrl = employee.AvatarUrl ?? payload.Picture,
                AppEmail = employee.APPEmail,
                Department = employee.EmpDepartments.FirstOrDefault()?.Department?.Name ?? "General",
                IsAdmin = isAdmin
            });
        }
        catch (InvalidJwtException)
        {
            return BadRequest(new { Message = "Invalid Google ID Token." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Message = $"Internal authentication error: {ex.Message}" });
        }
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await _signInManager.SignOutAsync();
        return Ok(new { Message = "Logged out successfully." });
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentUser()
    {
        if (User.Identity?.IsAuthenticated != true)
        {
            return Unauthorized();
        }

        var userId = _userManager.GetUserId(User);
        if (string.IsNullOrEmpty(userId) || !int.TryParse(userId, out var id))
        {
            return Unauthorized();
        }

        var employee = await _userManager.Users
            .Include(e => e.EmpDepartments)
            .ThenInclude(ed => ed.Department)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (employee == null)
        {
            return Unauthorized();
        }

        var roles = await _userManager.GetRolesAsync(employee);
        var isAdmin = roles.Contains("Admin") || employee.APPEmail.ToLower() == "sashank@bosframework.com";

        return Ok(new UserSessionDto
        {
            Id = employee.Id,
            FullName = employee.FullName,
            Title = employee.Title,
            Company = employee.Company,
            AvatarUrl = employee.AvatarUrl,
            AppEmail = employee.APPEmail,
            Department = employee.EmpDepartments.FirstOrDefault()?.Department?.Name ?? "General",
            IsAdmin = isAdmin
        });
    }
}

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
    public string Company { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string AppEmail { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public bool IsAdmin { get; set; }
}
