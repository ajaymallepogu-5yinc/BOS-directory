using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using OrgChart.Domain;
using OrgChart.Services;
using OrgChart.Services.Dtos;

namespace OrgChart.Api.Controllers;

[ApiController]
[Route("api/employees")]
[Authorize]
public class EmployeesController : ControllerBase
{
    private readonly EmployeeService _employeeService;
    private readonly UserManager<Employee> _userManager;

    public EmployeesController(EmployeeService employeeService, UserManager<Employee> userManager)
    {
        _employeeService = employeeService;
        _userManager = userManager;
    }

    /// <summary>GET /api/employees - flat list for the admin table.</summary>
    [HttpGet]
    public async Task<ActionResult<List<EmployeeDto>>> GetAll()
    {
        return Ok(await _employeeService.GetAllAsync());
    }

    /// <summary>GET /api/employees/managers - lightweight list for the "Reports to" dropdown.</summary>
    [HttpGet("managers")]
    public async Task<ActionResult<List<ManagerOptionDto>>> GetManagerOptions()
    {
        return Ok(await _employeeService.GetManagerOptionsAsync());
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<EmployeeDto>> GetById(int id)
    {
        var dto = await _employeeService.GetByIdAsync(id);
        if (dto is null) return NotFound();
        return Ok(dto);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<EmployeeDto>> Create(CreateEmployeeDto dto)
    {
        if (!_employeeService.SupportsWrites)
            return Conflict("Employees are sourced from the HR portal in this environment. Add the employee there instead.");

        var created = await _employeeService.CreateAsync(dto, User.Identity?.Name ?? "System");
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(int id, UpdateEmployeeDto dto)
    {
        if (!_employeeService.SupportsWrites)
            return Conflict("Employees are sourced from the HR portal in this environment. Edit the employee there instead.");

        try
        {
            var updated = await _employeeService.UpdateAsync(id, dto, User.Identity?.Name ?? "System");
            if (!updated) return NotFound();
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPut("{id:int}/manager")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateManager(int id, [FromBody] UpdateManagerDto dto)
    {
        if (!_employeeService.SupportsWrites)
            return Conflict("Employees are sourced from the HR portal in this environment. Edit the employee there instead.");

        try
        {
            var updated = await _employeeService.UpdateManagerAsync(id, dto.ManagerId);
            if (!updated) return NotFound();
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPut("{id:int}/admin-role")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateAdminRole(int id, [FromBody] UpdateAdminRoleDto dto)
    {
        var currentUserId = _userManager.GetUserId(User);
        int? callerId = currentUserId != null && int.TryParse(currentUserId, out var parsedId) ? parsedId : null;

        var (outcome, isAdmin) = await _employeeService.UpdateAdminRoleAsync(id, dto.IsAdmin, callerId);

        return outcome switch
        {
            UpdateAdminRoleOutcome.NotFound => NotFound(),
            UpdateAdminRoleOutcome.CannotRemoveSelf => BadRequest(new { message = "You cannot remove your own Admin role. Ask another admin to do this." }),
            UpdateAdminRoleOutcome.CannotRemoveLastAdmin => BadRequest(new { message = "Cannot remove the last remaining Admin." }),
            _ => Ok(new { isAdmin })
        };
    }

    /// <summary>DELETE /api/employees/5?reassignManagerId=3 - reassignManagerId re-parents this
    /// employee's direct/functional reports; omit it to leave them with no manager instead.</summary>
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id, [FromQuery] int? reassignManagerId)
    {
        if (!_employeeService.SupportsWrites)
            return Conflict("Employees are sourced from the HR portal in this environment. Remove the employee there instead.");

        if (reassignManagerId == id)
            return BadRequest(new { message = "An employee cannot be reassigned to report to themselves." });

        var ok = await _employeeService.DeleteAsync(id, reassignManagerId);
        if (!ok) return NotFound();
        return NoContent();
    }

    [HttpPost("import-bulk")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<BulkImportResultDto>> ImportBulk([FromBody] BulkImportDto dto)
    {
        if (dto == null || dto.Employees == null || dto.Employees.Count == 0)
        {
            return BadRequest(new BulkImportResultDto { Success = false, Message = "No employee records provided." });
        }

        return Ok(await _employeeService.ImportBulkAsync(dto.Employees));
    }
}
