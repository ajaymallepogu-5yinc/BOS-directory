using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using OrgChart.Repositories.Data;
using OrgChart.Repositories;
using OrgChart.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddHttpClient();

var allowedOriginsList = new List<string>();
var allowedOriginsSection = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>();
if (allowedOriginsSection != null)
{
    allowedOriginsList.AddRange(allowedOriginsSection);
}

var envOrigins = Environment.GetEnvironmentVariable("ALLOWED_ORIGINS");
if (!string.IsNullOrEmpty(envOrigins))
{
    allowedOriginsList.AddRange(envOrigins.Split(',', StringSplitOptions.RemoveEmptyEntries));
}

if (builder.Environment.IsDevelopment())
{
    allowedOriginsList.Add("http://localhost:5173");
    allowedOriginsList.Add("http://localhost:5174");
    allowedOriginsList.Add("http://localhost:5175");
}

if (allowedOriginsList.Count == 0)
{
    allowedOriginsList.Add("http://localhost:5173");
    allowedOriginsList.Add("http://localhost:5174");
    allowedOriginsList.Add("http://localhost:5175");
}

allowedOriginsList = allowedOriginsList.Distinct(StringComparer.OrdinalIgnoreCase).ToList();

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        if (allowedOriginsList.Contains("*"))
        {
            policy.SetIsOriginAllowed(origin => true)
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
        }
        else
        {
            policy.WithOrigins(allowedOriginsList.ToArray())
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
        }
    });
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

builder.Services.AddIdentity<OrgChart.Domain.Employee, IdentityRole<int>>()
    .AddEntityFrameworkStores<AppDbContext>();

builder.Services.AddAuthorization(options =>
{
    // Require an authenticated session on every endpoint unless it opts out with [AllowAnonymous].
    options.FallbackPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.HttpOnly = true;
    options.Cookie.Name = "OrgChart.Identity";
    options.Cookie.SameSite = builder.Environment.IsDevelopment()
        ? SameSiteMode.Lax
        : SameSiteMode.None;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment() 
        ? CookieSecurePolicy.SameAsRequest 
        : CookieSecurePolicy.Always;

    // Keep the session alive for 7 days (isPersistent:true in SignInAsync activates this)
    options.ExpireTimeSpan = TimeSpan.FromDays(7);
    options.SlidingExpiration = true;

    options.Events.OnRedirectToLogin = context =>
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    };
    options.Events.OnRedirectToAccessDenied = context =>
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return Task.CompletedTask;
    };
});

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
    
    SeedData.ApplySafeMigrations(db);
    SeedData.EnsureCardColorColumnExists(db);
    SeedData.SeedDefaultSettings(db);

    var config = db.DataSourceConfigs.FirstOrDefault();
    if (app.Environment.IsDevelopment() && (config == null || config.Mode == "Local"))
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
app.UseAuthentication();   // ← MUST come before UseAuthorization to read the session cookie
app.UseAuthorization();
app.MapControllers();

app.Run();
