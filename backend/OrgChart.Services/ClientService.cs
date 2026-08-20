using OrgChart.Domain;
using OrgChart.Repositories;
using OrgChart.Services.Dtos;

namespace OrgChart.Services;

public class ClientService
{
    private readonly EfClientRepository _clients;

    public ClientService(EfClientRepository clients)
    {
        _clients = clients;
    }

    public async Task<List<ClientDto>> GetAllAsync()
    {
        var clients = await _clients.GetAllAsync();
        return clients.Select(c => new ClientDto
        {
            Id = c.Id,
            Name = c.Name,
            ProjectCount = c.Projects.Count,
            CreatedAt = c.DateCreated,
            CreatedBy = c.CreatedBy
        }).ToList();
    }

    /// <summary>Backs the project form's "pick an existing client or type a new one" field -
    /// matches case/whitespace-insensitively against existing clients first, so "Acme Corp" and
    /// "acme corp " resolve to the same client instead of silently splitting a group in two.</summary>
    public async Task<ClientDto> FindOrCreateByNameAsync(string name, string username)
    {
        var trimmed = name.Trim();

        var existing = await _clients.FindByNameAsync(trimmed);
        if (existing != null)
        {
            return new ClientDto { Id = existing.Id, Name = existing.Name };
        }

        var client = new Client
        {
            Name = trimmed,
            CreatedBy = username,
            DateCreated = DateTime.UtcNow
        };
        var created = await _clients.AddAsync(client);

        return new ClientDto { Id = created.Id, Name = created.Name };
    }

    /// <summary>Returns null if no client with that id exists. Throws InvalidOperationException
    /// if the new name collides with a different, already-existing client.</summary>
    public async Task<ClientDto?> UpdateAsync(int id, string name, string username)
    {
        var existing = await _clients.GetByIdAsync(id);
        if (existing == null) return null;

        var trimmed = name.Trim();
        var collision = await _clients.ExistsWithNameAsync(trimmed, id);
        if (collision)
        {
            throw new InvalidOperationException($"A client named \"{trimmed}\" already exists.");
        }

        var updated = await _clients.UpdateAsync(id, trimmed, username);
        return updated == null ? null : new ClientDto { Id = updated.Id, Name = updated.Name };
    }

    /// <summary>Soft-deletes the client. Projects still pointing at this ClientId aren't touched -
    /// Client's own soft-delete query filter (see AppDbContext) already makes p.Client come back
    /// null for a deleted client, the same way it already does for Department, so those projects
    /// just read as "no client" without needing their ClientId cleared.</summary>
    public async Task<bool> DeleteAsync(int id, string username) => await _clients.SoftDeleteAsync(id, username);
}
