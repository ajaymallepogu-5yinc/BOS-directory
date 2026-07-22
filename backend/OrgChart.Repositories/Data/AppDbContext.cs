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
    public DbSet<TimesheetEntry> TimesheetEntries => Set<TimesheetEntry>();

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

            entity.HasOne(p => p.FunctionalManager)
                .WithMany()
                .HasForeignKey(p => p.FunctionalManagerId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<TimesheetEntry>(entity =>
        {
            entity.Property(t => t.HoursSpent).HasColumnType("decimal(5,2)");

            entity.HasOne(t => t.Employee)
                .WithMany()
                .HasForeignKey(t => t.EmployeeId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(t => t.Project)
                .WithMany()
                .HasForeignKey(t => t.ProjectId)
                .OnDelete(DeleteBehavior.SetNull);

            // Restrict (not SetNull/Cascade): TimesheetEntry already has a cascading path to
            // AspNetUsers via EmployeeId. A second cascading FK to the same table triggers
            // SQL Server's "multiple cascade paths" error - the same issue fixed on OrgReporting.
            entity.HasOne(t => t.ReviewedByUser)
                .WithMany()
                .HasForeignKey(t => t.ReviewedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
