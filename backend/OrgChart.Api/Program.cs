using Microsoft.EntityFrameworkCore;
using OrgChart.Api.Data;
using OrgChart.Api.Repositories;
using OrgChart.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddHttpClient();

var allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>() ?? new[] { "http://localhost:5173" };
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
        policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod());
});

var postgresConnection = builder.Configuration.GetConnectionString("PostgresConnection") 
                         ?? Environment.GetEnvironmentVariable("DATABASE_URL")
                         ?? builder.Configuration["DATABASE_URL"];

if (!string.IsNullOrEmpty(postgresConnection))
{
    var formattedConnectionString = ConvertPostgresUriToConnectionString(postgresConnection);
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseNpgsql(formattedConnectionString));
}
else
{
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseSqlServer(builder.Configuration.GetConnectionString("LocalDb")));
}

static string ConvertPostgresUriToConnectionString(string uriString)
{
    if (string.IsNullOrWhiteSpace(uriString)) return uriString;
    if (!uriString.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase) && 
        !uriString.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase))
    {
        return uriString;
    }

    try
    {
        var uri = new Uri(uriString);
        var userInfo = uri.UserInfo.Split(':');
        var username = userInfo[0];
        var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
        var host = uri.Host;
        var port = uri.Port > 0 ? uri.Port : 5432;
        var database = uri.AbsolutePath.TrimStart('/');

        return $"Host={host};Port={port};Database={database};Username={username};Password={password};Trust Server Certificate=true;SSL Mode=Require;";
    }
    catch
    {
        return uriString;
    }
}

// Repositories
builder.Services.AddScoped<IEmployeeRepository, EfEmployeeRepository>();
builder.Services.AddScoped<IDepartmentRepository, EfDepartmentRepository>();

builder.Services.AddScoped<IOrgTreeBuilder, OrgTreeBuilder>();

var app = builder.Build();

// Create the local DB and seed sample data on first run
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    
    if (db.Database.ProviderName == "Npgsql.EntityFrameworkCore.PostgreSQL")
    {
        // For PostgreSQL on Supabase, the database already exists, so EnsureCreated() skips table creation.
        // We check if the Employees table exists, and if not, we generate and execute the creation script.
        bool tableExists = false;
        try
        {
            var conn = db.Database.GetDbConnection();
            using (var cmd = conn.CreateCommand())
            {
                if (conn.State != System.Data.ConnectionState.Open) conn.Open();
                cmd.CommandText = "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Employees')";
                tableExists = Convert.ToBoolean(cmd.ExecuteScalar());
            }
        }
        catch
        {
            tableExists = false;
        }

        if (!tableExists)
        {
            var sql = db.Database.GenerateCreateScript();
            db.Database.ExecuteSqlRaw(sql);
        }
    }
    else
    {
        db.Database.EnsureCreated();
    }

    // Ensure system settings schema and defaults are configured
    SeedData.EnsureDataSourceConfigTableExists(db);
    SeedData.EnsureJiraTablesExist(db);
    SeedData.SeedDefaultSettings(db);
    SeedData.SeedHrDummyTable(db);
    SeedData.SeedDefaultJiraData(db);

    var config = db.DataSourceConfigs.FirstOrDefault();
    if (config == null || config.Mode == "Local")
    {
        SeedData.EnsureSeeded(db);
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("FrontendPolicy");
app.UseAuthorization();
app.MapControllers();

app.Run();
