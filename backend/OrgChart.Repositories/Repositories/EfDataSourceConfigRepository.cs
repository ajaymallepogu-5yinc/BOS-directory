using Microsoft.EntityFrameworkCore;
using OrgChart.Domain;
using OrgChart.Repositories.Data;

namespace OrgChart.Repositories;

public class EfDataSourceConfigRepository
{
    private readonly AppDbContext _db;

    public EfDataSourceConfigRepository(AppDbContext db)
    {
        _db = db;
    }

    public Task<DataSourceConfig?> GetAsync() => _db.DataSourceConfigs.FirstOrDefaultAsync();

    public async Task<DataSourceConfig> UpsertAsync(DataSourceConfig updated)
    {
        var config = await _db.DataSourceConfigs.FirstOrDefaultAsync();
        if (config == null)
        {
            config = new DataSourceConfig();
            _db.DataSourceConfigs.Add(config);
        }

        config.Mode = updated.Mode;
        config.HrPortalApiUrl = updated.HrPortalApiUrl;
        config.HrPortalApiAuthHeaderName = updated.HrPortalApiAuthHeaderName;
        config.HrPortalApiAuthHeaderValue = updated.HrPortalApiAuthHeaderValue;
        config.IdField = updated.IdField;
        config.FullNameField = updated.FullNameField;
        config.TitleField = updated.TitleField;
        config.AvatarUrlField = updated.AvatarUrlField;
        config.ManagerIdField = updated.ManagerIdField;
        config.DepartmentIdField = updated.DepartmentIdField;
        config.DepartmentNameField = updated.DepartmentNameField;
        config.DepartmentColorField = updated.DepartmentColorField;
        config.APPEmailField = updated.APPEmailField;
        config.HRMSEmailField = updated.HRMSEmailField;

        await _db.SaveChangesAsync();
        return config;
    }

    public async Task ForceLocalModeAsync()
    {
        var config = await _db.DataSourceConfigs.FirstOrDefaultAsync();
        if (config == null)
        {
            config = new DataSourceConfig();
            _db.DataSourceConfigs.Add(config);
        }

        config.Mode = "Local";
        await _db.SaveChangesAsync();
    }
}
