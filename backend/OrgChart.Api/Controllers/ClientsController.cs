using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OrgChart.Services;
using OrgChart.Services.Dtos;

namespace OrgChart.Api.Controllers;

[ApiController]
[Route("api/clients")]
[Authorize]
public class ClientsController : ControllerBase
{
    private readonly ClientService _clientService;

    public ClientsController(ClientService clientService)
    {
        _clientService = clientService;
    }

    [HttpGet]
    public async Task<ActionResult<List<ClientDto>>> GetAll()
    {
        return Ok(await _clientService.GetAllAsync());
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ClientDto>> Create(CreateClientDto dto)
    {
        var username = User.Identity?.Name ?? "System";
        var client = await _clientService.FindOrCreateByNameAsync(dto.Name, username);
        return Ok(client);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ClientDto>> Update(int id, UpdateClientDto dto)
    {
        var username = User.Identity?.Name ?? "System";
        try
        {
            var client = await _clientService.UpdateAsync(id, dto.Name, username);
            if (client == null) return NotFound();
            return Ok(client);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var username = User.Identity?.Name ?? "System";
        var deleted = await _clientService.DeleteAsync(id, username);
        if (!deleted) return NotFound();
        return NoContent();
    }
}
