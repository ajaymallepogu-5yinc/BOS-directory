using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using OrgChart.Domain;

namespace OrgChart.Repositories.Data;

public class AppDbContext : IdentityDbContext<Employee, IdentityRole<int>, int>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    /// <summary>Postgres 'timestamp with time zone' columns reject DateTime.Kind=Unspecified.
    /// Some existing rows predate that being enforced consistently (e.g. Identity records written
    /// before this app went all-in on DateTime.UtcNow), and ASP.NET Identity's UserManager
    /// re-writes every column on save (not just the ones that changed) - so a single stale
    /// Unspecified-kind DateTime anywhere on Employee can 500 an otherwise-unrelated update, like
    /// toggling the Admin role. Forcing Utc on every DateTime this app reads or writes, in the one
    /// place all EF access funnels through, closes this off everywhere instead of one column at a time.</summary>
    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
        configurationBuilder.Properties<DateTime?>().HaveConversion<UtcNullableDateTimeConverter>();
    }

    private class UtcDateTimeConverter : ValueConverter<DateTime, DateTime>
    {
        public UtcDateTimeConverter() : base(
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc),
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc))
        { }
    }

    private class UtcNullableDateTimeConverter : ValueConverter<DateTime?, DateTime?>
    {
        public UtcNullableDateTimeConverter() : base(
            v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v,
            v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v)
        { }
    }

    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<DataSourceConfig> DataSourceConfigs => Set<DataSourceConfig>();
    public DbSet<OrgReporting> OrgReportings => Set<OrgReporting>();
    public DbSet<EmpDepartment> EmpDepartments => Set<EmpDepartment>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<Timesheet> Timesheets => Set<Timesheet>();
    public DbSet<TimesheetEntry> TimesheetEntries => Set<TimesheetEntry>();
    public DbSet<TimesheetReviewLog> TimesheetReviewLogs => Set<TimesheetReviewLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // EmpDepartment Composite Key and Relations
        modelBuilder.Entity<EmpDepartment>()
            .HasKey(ed => new { ed.EmployeeId, ed.DepartmentId });

        modelBuilder.Entity<EmpDepartment>()
            .HasOne(ed => ed.Employee)
            .WithMany(e => e.EmpDepartments)
            .HasForeignKey(ed => ed.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<EmpDepartment>()
            .HasOne(ed => ed.Department)
            .WithMany(d => d.EmpDepartments)
            .HasForeignKey(ed => ed.DepartmentId)
            .OnDelete(DeleteBehavior.Cascade);



        modelBuilder.Entity<Department>()
            .HasIndex(d => d.Name)
            .IsUnique();

        // Soft-delete query filters: applied automatically to every LINQ query against these
        // DbSets (including through .Include() navigations), so callers never need to remember
        // a manual "!IsDeleted" filter - the one exception is EfEmployeeRepository.DeleteAsync's
        // OrgReporting cleanup, which still hard-removes rows tied to a being-deleted employee
        // (Employee itself stays hard-delete, and OrgReporting's Restrict FK to AspNetUsers would
        // otherwise block that delete).
        modelBuilder.Entity<Department>().HasQueryFilter(d => !d.IsDeleted);
        modelBuilder.Entity<OrgReporting>().HasQueryFilter(o => !o.IsDeleted);
        modelBuilder.Entity<Project>().HasQueryFilter(p => !p.IsDeleted);

        modelBuilder.Entity<OrgReporting>(entity =>
        {
            entity.HasOne(o => o.Employee)
                .WithMany()
                .HasForeignKey(o => o.EmployeeId)
                .OnDelete(DeleteBehavior.Restrict); // Keep Restrict to avoid multiple cascade paths error in SQL Server

            entity.HasOne(o => o.Manager)
                .WithMany()
                .HasForeignKey(o => o.ManagerId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Project>(entity =>
        {
            entity.HasOne(p => p.ProjectManager)
                .WithMany()
                .HasForeignKey(p => p.ProjectManagerId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Timesheet>(entity =>
        {
            // These columns are physically DATE (see SeedData.cs's raw CREATE TABLE), but EF's
            // default DateTime->column mapping assumes timestamptz - which Npgsql refuses to
            // write/compare against Kind=Unspecified values (always what JSON date strings
            // deserialize to). Pin the actual column type so Kind stops mattering.
            entity.Property(t => t.StartDate).HasColumnType("date");
            entity.Property(t => t.EndDate).HasColumnType("date");

            // Restrict (not Cascade): Employee already has other cascading paths (e.g.
            // OrgReporting), so a second cascading FK to AspNetUsers triggers SQL Server's
            // "multiple cascade paths" error - same fix already applied to OrgReporting/
            // TimesheetEntry.ReviewedByUser.
            entity.HasOne(t => t.Employee)
                .WithMany()
                .HasForeignKey(t => t.EmployeeId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<TimesheetEntry>(entity =>
        {
            entity.Property(t => t.Date).HasColumnType("date");

            entity.HasOne(t => t.Timesheet)
                .WithMany(t => t.Entries)
                .HasForeignKey(t => t.TimesheetId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(t => t.Project)
                .WithMany()
                .HasForeignKey(t => t.ProjectId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<TimesheetReviewLog>(entity =>
        {
            entity.HasOne(r => r.Timesheet)
                .WithMany(t => t.ReviewLogs)
                .HasForeignKey(r => r.TimesheetId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(r => r.Reviewer)
                .WithMany()
                .HasForeignKey(r => r.ReviewerId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
