using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using OrgChart.Domain;

namespace OrgChart.Repositories.Data;

public class AppDbContext : IdentityDbContext<Employee, IdentityRole<int>, int>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

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
            entity.Property(t => t.HoursSpent).HasColumnType("decimal(5,2)");

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
