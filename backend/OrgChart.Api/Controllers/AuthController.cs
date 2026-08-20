using Google.Apis.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using OrgChart.Domain;
using OrgChart.Services;
using OrgChart.Services.Dtos;

namespace OrgChart.Api.Controllers;

[ApiController]
[Route("api/auth")]
[AllowAnonymous]
public class AuthController : ControllerBase
{
    private readonly AuthService _authService;
    private readonly UserManager<Employee> _userManager;
    private readonly SignInManager<Employee> _signInManager;
    private readonly IConfiguration _config;

    public AuthController(
        AuthService authService,
        UserManager<Employee> userManager,
        SignInManager<Employee> signInManager,
        IConfiguration config)
    {
        _authService = authService;
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
            var result = await _authService.ValidateGoogleLoginAsync(dto.IdToken);

            switch (result.Outcome)
            {
                case GoogleLoginOutcome.MissingClientId:
                    return StatusCode(500, new { Message = "Google Client ID is not configured on the server." });
                case GoogleLoginOutcome.InvalidClaims:
                    return BadRequest(new { Message = "Invalid Google ID Token claims." });
                case GoogleLoginOutcome.EmployeeNotFound:
                    return StatusCode(403, new {
                        Message = $"Access Denied. The email '{result.GoogleEmail}' is not pre-registered in the Company Directory. Please contact your administrator."
                    });
            }

            // Establish standard ASP.NET Identity session cookie
            await _signInManager.SignInAsync(result.Employee!, isPersistent: true);

            return Ok(await _authService.BuildSessionAsync(result.Employee!, result.GooglePictureUrl));
        }
        catch (InvalidJwtException ex)
        {
            // TEMPORARY: surfaces the real validation failure (audience/issuer/expiry mismatch,
            // etc.) and which Client ID the server actually validated against, instead of the
            // generic message - revert once the production Client ID mismatch is diagnosed.
            var validatedAgainst = _config["Authentication:Google:ClientId"] ?? Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID");
            return BadRequest(new { Message = $"Invalid Google ID Token: {ex.Message} (server validated against Client ID: {validatedAgainst})" });
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

        var employee = await _authService.GetEmployeeWithDepartmentAsync(id);
        if (employee == null)
        {
            return Unauthorized();
        }

        return Ok(await _authService.BuildSessionAsync(employee));
    }
}
