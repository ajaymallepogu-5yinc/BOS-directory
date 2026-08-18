using Microsoft.EntityFrameworkCore;
using OrgChart.Domain;
using OrgChart.Repositories.Data;
using OrgChart.Services.Dtos;

namespace OrgChart.Services;

public class ClientService
{
    private readonly AppDbContext _db;

    public ClientService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<ClientDto>> GetAllAsync()
    {
        return await _db.Clients
            .OrderBy(c => c.Name)
            .Select(c => new ClientDto
            {
                Id = c.Id,
                Name = c.Name,
                ProjectCount = c.Projects.Count(),
                CreatedAt = c.DateCreated,
                CreatedBy = c.CreatedBy
            })
            .ToListAsync();
    }

    /// <summary>Backs the project form's "pick an existing client or type a new one" field -
    /// matches case/whitespace-insensitively against existing clients first, so "Acme Corp" and
    /// "acme corp " resolve to the same client instead of silently splitting a group in two.</summary>
    public async Task<ClientDto> FindOrCreateByNameAsync(string name, string username)
    {
        var trimmed = name.Trim();

        var existing = await _db.Clients
            .FirstOrDefaultAsync(c => c.Name.ToLower() == trimmed.ToLower());
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
        _db.Clients.Add(client);
        await _db.SaveChangesAsync();

        return new ClientDto { Id = client.Id, Name = client.Name };
    }

    /// <summary>Returns null if no client with that id exists. Throws InvalidOperationException
    /// if the new name collides with a different, already-existing client.</summary>
    public async Task<ClientDto?> UpdateAsync(int id, string name, string username)
    {
        var client = await _db.Clients.FirstOrDefaultAsync(c => c.Id == id);
        if (client == null) return null;

        var trimmed = name.Trim();
        var collision = await _db.Clients.AnyAsync(c => c.Id != id && c.Name.ToLower() == trimmed.ToLower());
        if (collision)
        {
            throw new InvalidOperationException($"A client named \"{trimmed}\" already exists.");
        }

        client.Name = trimmed;
        client.ModifiedBy = username;
        client.DateModified = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return new ClientDto { Id = client.Id, Name = client.Name };
    }

    /// <summary>Soft-deletes the client. Projects still pointing at this ClientId aren't touched -
    /// Client's own soft-delete query filter (see AppDbContext) already makes p.Client come back
    /// null for a deleted client, the same way it already does for Department, so those projects
    /// just read as "no client" without needing their ClientId cleared.</summary>
    public async Task<bool> DeleteAsync(int id, string username)
    {
        var client = await _db.Clients.FirstOrDefaultAsync(c => c.Id == id);
        if (client == null) return false;

        client.IsDeleted = true;
        client.ModifiedBy = username;
        client.DateDeleted = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return true;
    }
}
