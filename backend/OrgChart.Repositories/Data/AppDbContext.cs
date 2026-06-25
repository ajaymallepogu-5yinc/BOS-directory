using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using OrgChart.Domain;

namespace OrgChart.Repositories.Data;

/// <summary>
/// This context backs the "Local" data source - the one used when employees
/// are entered manually through the admin screen instead of pulled from an
/// existing HR portal database.
/// </summary>
public class AppDbContext : IdentityDbContext<IdentityUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<DataSourceConfig> DataSourceConfigs => Set<DataSourceConfig>();
    public DbSet<JiraProject> JiraProjects => Set<JiraProject>();
    public DbSet<JiraSprint> JiraSprints => Set<JiraSprint>();
    public DbSet<JiraIssue> JiraIssues => Set<JiraIssue>();
    public DbSet<AppRole> AppRoles => Set<AppRole>();
    public DbSet<OrgReporting> OrgReportings => Set<OrgReporting>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Employee>()
            .HasOne(e => e.Manager)
            .WithMany(e => e.DirectReports)
            .HasForeignKey(e => e.ManagerId)
            .OnDelete(DeleteBehavior.Restrict); // don't cascade-delete a whole team if a manager row is removed

        modelBuilder.Entity<Employee>()
            .HasOne(e => e.Department)
            .WithMany(d => d.Employees)
            .HasForeignKey(e => e.DepartmentId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Employee>()
            .HasOne(e => e.APPRole)
            .WithMany(r => r.Employees)
            .HasForeignKey(e => e.APPRoleId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Department>()
            .HasIndex(d => d.Name)
            .IsUnique();

        modelBuilder.Entity<JiraIssue>()
            .HasOne(i => i.Project)
            .WithMany(p => p.Issues)
            .HasForeignKey(i => i.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<JiraIssue>()
            .HasOne(i => i.Sprint)
            .WithMany(s => s.Issues)
            .HasForeignKey(i => i.SprintId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<OrgReporting>(entity =>
        {
            entity.HasOne(o => o.Employee)
                .WithMany()
                .HasForeignKey(o => o.EmployeeId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(o => o.Manager)
                .WithMany()
                .HasForeignKey(o => o.ManagerId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
