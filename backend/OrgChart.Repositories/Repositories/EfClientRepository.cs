using Microsoft.EntityFrameworkCore;
using OrgChart.Domain;
using OrgChart.Repositories.Data;

namespace OrgChart.Repositories;

public class EfClientRepository
{
    private readonly AppDbContext _db;

    public EfClientRepository(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<Client>> GetAllAsync() =>
        await _db.Clients
            .Include(c => c.Projects)
            .AsNoTracking()
            .OrderBy(c => c.Name)
            .ToListAsync();

    public Task<Client?> GetByIdAsync(int id) =>
        _db.Clients.FirstOrDefaultAsync(c => c.Id == id);

    public Task<Client?> FindByNameAsync(string name) =>
        _db.Clients.FirstOrDefaultAsync(c => c.Name.ToLower() == name.ToLower());

    public Task<bool> ExistsWithNameAsync(string name, int excludeId) =>
        _db.Clients.AnyAsync(c => c.Id != excludeId && c.Name.ToLower() == name.ToLower());

    public async Task<Client> AddAsync(Client client)
    {
        _db.Clients.Add(client);
        await _db.SaveChangesAsync();
        return client;
    }

    public async Task<Client?> UpdateAsync(int id, string name, string username)
    {
        var client = await _db.Clients.FirstOrDefaultAsync(c => c.Id == id);
        if (client == null) return null;

        client.Name = name;
        client.ModifiedBy = username;
        client.DateModified = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return client;
    }

    public async Task<bool> SoftDeleteAsync(int id, string username)
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
