using Microsoft.EntityFrameworkCore;
using OrgChart.Domain;

namespace OrgChart.Repositories.Data;

public static class SeedData
{
    /// <summary>
    /// No default seed data. Employees, departments, and reporting lines
    /// will be loaded via the Admin panel or CSV import in production.
    /// </summary>
    public static void EnsureSeeded(AppDbContext db)
    {
        // 1. Seed Roles if missing
        if (!db.Roles.Any())
        {
            var adminRole = new Microsoft.AspNetCore.Identity.IdentityRole<int> { Name = "Admin", NormalizedName = "ADMIN" };
            var employeeRole = new Microsoft.AspNetCore.Identity.IdentityRole<int> { Name = "Employee", NormalizedName = "EMPLOYEE" };
            db.Roles.AddRange(adminRole, employeeRole);
            db.SaveChanges();
        }

        // 2. Seed Departments if missing
        if (!db.Departments.Any())
        {
            var leadership = new Department { Name = "Leadership", ColorHex = "#1E293B" };
            var engineering = new Department { Name = "Engineering", ColorHex = "#3B82F6" };
            var hr = new Department { Name = "Human Resources", ColorHex = "#EC4899" };
            db.Departments.AddRange(leadership, engineering, hr);
            db.SaveChanges();
        }

        var adminRoleObj = db.Roles.FirstOrDefault(r => r.Name == "Admin");
        var employeeRoleObj = db.Roles.FirstOrDefault(r => r.Name == "Employee");
        var leadershipDept = db.Departments.FirstOrDefault(d => d.Name == "Leadership");
        var engineeringDept = db.Departments.FirstOrDefault(d => d.Name == "Engineering");
        var hrDept = db.Departments.FirstOrDefault(d => d.Name == "Human Resources");

        var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<Employee>();

        // 3. Seed/Update Sashank (Admin)
        var sashank = db.Users.FirstOrDefault(u => u.UserName == "sashank@5yinc.com");
        if (sashank == null)
        {
            sashank = new Employee
            {
                UserName = "sashank@5yinc.com",
                NormalizedUserName = "SASHANK@5YINC.COM",
                Email = "sashank@5yinc.com",
                NormalizedEmail = "SASHANK@5YINC.COM",
                APPEmail = "sashank@5yinc.com",
                HRMSEmail = "sashank.hrms@5yinc.com",
                FullName = "Sashank",
                Title = "Founder & CEO",
                Company = "5yinc",
                EmailConfirmed = true,
                SecurityStamp = System.Guid.NewGuid().ToString()
            };
            sashank.PasswordHash = hasher.HashPassword(sashank, "Password123!");
            db.Users.Add(sashank);
            db.SaveChanges();

            if (adminRoleObj != null)
                db.UserRoles.Add(new Microsoft.AspNetCore.Identity.IdentityUserRole<int> { UserId = sashank.Id, RoleId = adminRoleObj.Id });
            if (leadershipDept != null)
                db.EmpDepartments.Add(new EmpDepartment { EmployeeId = sashank.Id, DepartmentId = leadershipDept.Id });
            db.SaveChanges();
        }

        // 4. Seed/Update Ajay Mallepogu
        var ajay = db.Users.FirstOrDefault(u => u.FullName == "Ajay Mallepogu");
        if (ajay == null)
        {
            ajay = new Employee
            {
                UserName = "ajay.mallepogu@5yinc.com",
                NormalizedUserName = "AJAY.MALLEPOGU@5YINC.COM",
                Email = "ajay.mallepogu@5yinc.com",
                NormalizedEmail = "AJAY.MALLEPOGU@5YINC.COM",
                APPEmail = "ajay.mallepogu@5yinc.com",
                FullName = "Ajay Mallepogu",
                Title = "VP of Engineering",
                Company = "5yinc",
                EmailConfirmed = true,
                SecurityStamp = System.Guid.NewGuid().ToString()
            };
            ajay.PasswordHash = hasher.HashPassword(ajay, "Password123!");
            db.Users.Add(ajay);
            db.SaveChanges();

            if (adminRoleObj != null)
                db.UserRoles.Add(new Microsoft.AspNetCore.Identity.IdentityUserRole<int> { UserId = ajay.Id, RoleId = adminRoleObj.Id });
            if (engineeringDept != null)
                db.EmpDepartments.Add(new EmpDepartment { EmployeeId = ajay.Id, DepartmentId = engineeringDept.Id });
            if (sashank != null)
                db.OrgReportings.Add(new OrgReporting { EmployeeId = ajay.Id, ManagerId = sashank.Id, ReportingType = "Direct" });
            db.SaveChanges();
        }
        else
        {
            // Ensure local database email matches Google account for testing
            ajay.APPEmail = "ajay.mallepogu@5yinc.com";
            ajay.Email = "ajay.mallepogu@5yinc.com";
            ajay.NormalizedEmail = "AJAY.MALLEPOGU@5YINC.COM";
            db.SaveChanges();

            // Promote to Admin for local testing
            if (adminRoleObj != null)
            {
                var isAlreadyAdmin = db.UserRoles.Any(ur => ur.UserId == ajay.Id && ur.RoleId == adminRoleObj.Id);
                if (!isAlreadyAdmin)
                {
                    var currentRoles = db.UserRoles.Where(ur => ur.UserId == ajay.Id).ToList();
                    db.UserRoles.RemoveRange(currentRoles);
                    db.SaveChanges();

                    db.UserRoles.Add(new Microsoft.AspNetCore.Identity.IdentityUserRole<int> { UserId = ajay.Id, RoleId = adminRoleObj.Id });
                    db.SaveChanges();
                }
            }
        }

        // 5. Seed John Doe
        var john = db.Users.FirstOrDefault(u => u.FullName == "John Doe");
        if (john == null)
        {
            john = new Employee
            {
                UserName = "john@5yinc.com",
                NormalizedUserName = "JOHN@5YINC.COM",
                Email = "john@5yinc.com",
                NormalizedEmail = "JOHN@5YINC.COM",
                APPEmail = "john@5yinc.com",
                FullName = "John Doe",
                Title = "Senior Software Engineer",
                Company = "5yinc",
                EmailConfirmed = true,
                SecurityStamp = System.Guid.NewGuid().ToString()
            };
            john.PasswordHash = hasher.HashPassword(john, "Password123!");
            db.Users.Add(john);
            db.SaveChanges();

            if (employeeRoleObj != null)
                db.UserRoles.Add(new Microsoft.AspNetCore.Identity.IdentityUserRole<int> { UserId = john.Id, RoleId = employeeRoleObj.Id });
            if (engineeringDept != null)
                db.EmpDepartments.Add(new EmpDepartment { EmployeeId = john.Id, DepartmentId = engineeringDept.Id });
            if (ajay != null)
                db.OrgReportings.Add(new OrgReporting { EmployeeId = john.Id, ManagerId = ajay.Id, ReportingType = "Direct" });
            db.SaveChanges();
        }

        // 6. Seed Jane Smith
        var jane = db.Users.FirstOrDefault(u => u.FullName == "Jane Smith");
        if (jane == null)
        {
            jane = new Employee
            {
                UserName = "jane@5yinc.com",
                NormalizedUserName = "JANE@5YINC.COM",
                Email = "jane@5yinc.com",
                NormalizedEmail = "JANE@5YINC.COM",
                APPEmail = "jane@5yinc.com",
                FullName = "Jane Smith",
                Title = "HR Specialist",
                Company = "5yinc",
                EmailConfirmed = true,
                SecurityStamp = System.Guid.NewGuid().ToString()
            };
            jane.PasswordHash = hasher.HashPassword(jane, "Password123!");
            db.Users.Add(jane);
            db.SaveChanges();

            if (employeeRoleObj != null)
                db.UserRoles.Add(new Microsoft.AspNetCore.Identity.IdentityUserRole<int> { UserId = jane.Id, RoleId = employeeRoleObj.Id });
            if (hrDept != null)
                db.EmpDepartments.Add(new EmpDepartment { EmployeeId = jane.Id, DepartmentId = hrDept.Id });
            if (sashank != null)
                db.OrgReportings.Add(new OrgReporting { EmployeeId = jane.Id, ManagerId = sashank.Id, ReportingType = "Direct" });
            db.SaveChanges();
        }
    }

    public static void EnsureDataSourceConfigTableExists(AppDbContext db)
    {
        if (db.Database.ProviderName == "Npgsql.EntityFrameworkCore.PostgreSQL")
        {
            var sql = @"
                CREATE TABLE IF NOT EXISTS ""DataSourceConfigs"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""Mode"" VARCHAR(50) NOT NULL,
                    ""HrPortalApiUrl"" TEXT NULL,
                    ""HrPortalApiAuthHeaderName"" TEXT NULL,
                    ""HrPortalApiAuthHeaderValue"" TEXT NULL,
                    ""IdField"" VARCHAR(100) NOT NULL,
                    ""FullNameField"" VARCHAR(100) NOT NULL,
                    ""TitleField"" VARCHAR(100) NOT NULL,
                    ""CompanyField"" VARCHAR(100) NOT NULL,
                    ""AvatarUrlField"" VARCHAR(100) NOT NULL,
                    ""ManagerIdField"" VARCHAR(100) NOT NULL,
                    ""DepartmentIdField"" VARCHAR(100) NOT NULL,
                    ""DepartmentNameField"" VARCHAR(100) NOT NULL,
                    ""DepartmentColorField"" VARCHAR(100) NOT NULL,
                    ""APPEmailField"" VARCHAR(100) NOT NULL DEFAULT 'appEmail',
                    ""HRMSEmailField"" VARCHAR(100) NOT NULL DEFAULT 'hrmsEmail'
                );";
            db.Database.ExecuteSqlRaw(sql);
        }
        else
        {
            var sql = @"
                IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[DataSourceConfigs]') AND type in (N'U'))
                BEGIN
                    CREATE TABLE [DataSourceConfigs] (
                        [Id] int IDENTITY(1,1) NOT NULL,
                        [Mode] nvarchar(50) NOT NULL,
                        [HrPortalApiUrl] nvarchar(max) NULL,
                        [HrPortalApiAuthHeaderName] nvarchar(max) NULL,
                        [HrPortalApiAuthHeaderValue] nvarchar(max) NULL,
                        [IdField] nvarchar(100) NOT NULL,
                        [FullNameField] nvarchar(100) NOT NULL,
                        [TitleField] nvarchar(100) NOT NULL,
                        [CompanyField] nvarchar(100) NOT NULL,
                        [AvatarUrlField] nvarchar(100) NOT NULL,
                        [ManagerIdField] nvarchar(100) NOT NULL,
                        [DepartmentIdField] nvarchar(100) NOT NULL,
                        [DepartmentNameField] nvarchar(100) NOT NULL,
                        [DepartmentColorField] nvarchar(100) NOT NULL,
                        [APPEmailField] nvarchar(100) NOT NULL DEFAULT 'appEmail',
                        [HRMSEmailField] nvarchar(100) NOT NULL DEFAULT 'hrmsEmail',
                        CONSTRAINT [PK_DataSourceConfigs] PRIMARY KEY CLUSTERED ([Id] ASC)
                    );
                END";
            db.Database.ExecuteSqlRaw(sql);
        }
    }

    public static void EnsureCardColorColumnExists(AppDbContext db)
    {
        if (db.Database.ProviderName == "Npgsql.EntityFrameworkCore.PostgreSQL")
        {
            var sql = @"ALTER TABLE ""AspNetUsers"" ADD COLUMN IF NOT EXISTS ""CardColor"" VARCHAR(50) NULL;";
            db.Database.ExecuteSqlRaw(sql);
        }
        else
        {
            var sql = @"
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[AspNetUsers]') AND name = 'CardColor')
                BEGIN
                    ALTER TABLE [AspNetUsers] ADD [CardColor] nvarchar(50) NULL;
                END";
            db.Database.ExecuteSqlRaw(sql);
        }
    }

    public static void SeedDefaultSettings(AppDbContext db)
    {
        if (!db.DataSourceConfigs.Any())
        {
            db.DataSourceConfigs.Add(new DataSourceConfig
            {
                Mode = "Local",
                HrPortalApiUrl = "",
                HrPortalApiAuthHeaderName = "Authorization",
                HrPortalApiAuthHeaderValue = "",
                IdField = "id",
                FullNameField = "fullName",
                TitleField = "title",
                CompanyField = "company",
                AvatarUrlField = "avatarUrl",
                ManagerIdField = "managerId",
                DepartmentIdField = "departmentId",
                DepartmentNameField = "departmentName",
                DepartmentColorField = "departmentColor",
                APPEmailField = "appEmail",
                HRMSEmailField = "hrmsEmail"
            });
            db.SaveChanges();
        }
    }

    public static void ApplySafeMigrations(AppDbContext db)
    {
        // 1. Check if AspNetUsers table exists
        bool aspNetUsersExists = false;
        try
        {
            var conn = db.Database.GetDbConnection();
            using (var cmd = conn.CreateCommand())
            {
                if (conn.State != System.Data.ConnectionState.Open) conn.Open();
                if (db.Database.ProviderName == "Npgsql.EntityFrameworkCore.PostgreSQL")
                {
                    cmd.CommandText = "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'AspNetUsers')";
                    aspNetUsersExists = Convert.ToBoolean(cmd.ExecuteScalar());
                }
                else
                {
                    cmd.CommandText = "SELECT OBJECT_ID(N'[AspNetUsers]', N'U')";
                    var res = cmd.ExecuteScalar();
                    aspNetUsersExists = res != DBNull.Value && res != null;
                }
            }
        }
        catch
        {
            aspNetUsersExists = false;
        }

        // 2. Check if __EFMigrationsHistory exists
        bool historyExists = false;
        try
        {
            var conn = db.Database.GetDbConnection();
            using (var cmd = conn.CreateCommand())
            {
                if (conn.State != System.Data.ConnectionState.Open) conn.Open();
                if (db.Database.ProviderName == "Npgsql.EntityFrameworkCore.PostgreSQL")
                {
                    cmd.CommandText = "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '__EFMigrationsHistory')";
                    historyExists = Convert.ToBoolean(cmd.ExecuteScalar());
                }
                else
                {
                    cmd.CommandText = "SELECT OBJECT_ID(N'[__EFMigrationsHistory]', N'U')";
                    var res = cmd.ExecuteScalar();
                    historyExists = res != DBNull.Value && res != null;
                }
            }
        }
        catch
        {
            historyExists = false;
        }

        // 3. If AspNetUsers exists but __EFMigrationsHistory does not:
        // We create __EFMigrationsHistory and insert the Initial migration to prevent EF from trying to re-create existing tables.
        if (aspNetUsersExists && !historyExists)
        {
            if (db.Database.ProviderName == "Npgsql.EntityFrameworkCore.PostgreSQL")
            {
                db.Database.ExecuteSqlRaw(@"
                    CREATE TABLE ""__EFMigrationsHistory"" (
                        ""MigrationId"" character varying(150) NOT NULL PRIMARY KEY,
                        ""ProductVersion"" character varying(32) NOT NULL
                    );
                    INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                    VALUES ('20260707093420_Initial', '8.0.8');
                ");
            }
            else
            {
                db.Database.ExecuteSqlRaw(@"
                    CREATE TABLE [__EFMigrationsHistory] (
                        [MigrationId] nvarchar(150) NOT NULL CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY,
                        [ProductVersion] nvarchar(32) NOT NULL
                    );
                    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
                    VALUES ('20260707093420_Initial', '8.0.8');
                ");
            }
        }

        // 4. The generated migrations (Initial, AddProjects) were authored against SQL Server and
        // use raw SQL Server types (nvarchar(max), bit, datetime2, etc.) that Postgres cannot parse.
        // Running them for real against Postgres would crash the app on startup. Since the Initial
        // migration is already bridged above, do the same for AddProjects: create the Projects table
        // ourselves with correct Postgres types, then mark that migration as already-applied so
        // Migrate() below never tries to execute the SQL-Server-flavored version against Postgres.
        if (db.Database.ProviderName == "Npgsql.EntityFrameworkCore.PostgreSQL")
        {
            EnsureProjectsTableExistsForPostgres(db);
        }

        // 5. Run standard EF migrations. On SQL Server this applies Initial/AddProjects for real.
        // On Postgres, both are already bridged above, so this is a no-op there.
        db.Database.Migrate();
    }

    private static void EnsureProjectsTableExistsForPostgres(AppDbContext db)
    {
        bool projectsTableExists;
        var conn = db.Database.GetDbConnection();
        using (var cmd = conn.CreateCommand())
        {
            if (conn.State != System.Data.ConnectionState.Open) conn.Open();
            cmd.CommandText = "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Projects')";
            projectsTableExists = Convert.ToBoolean(cmd.ExecuteScalar());
        }

        if (projectsTableExists)
        {
            return;
        }

        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE ""Projects"" (
                ""Id"" SERIAL PRIMARY KEY,
                ""Name"" TEXT NOT NULL,
                ""ProjectManagerId"" INT NULL,
                ""IsBillable"" BOOLEAN NOT NULL,
                ""JiraBoardId"" TEXT NULL,
                ""CreatedAt"" TIMESTAMP NOT NULL,
                ""CreatedBy"" TEXT NULL,
                ""UpdatedAt"" TIMESTAMP NULL,
                ""UpdatedBy"" TEXT NULL,
                CONSTRAINT ""FK_Projects_AspNetUsers_ProjectManagerId"" FOREIGN KEY (""ProjectManagerId"")
                    REFERENCES ""AspNetUsers"" (""Id"") ON DELETE SET NULL
            );
            CREATE INDEX ""IX_Projects_ProjectManagerId"" ON ""Projects"" (""ProjectManagerId"");
        ");

        // Mark the AddProjects migration as already-applied so EF's real Migrate() call
        // doesn't try to re-run its SQL-Server-flavored CreateTable against Postgres.
        db.Database.ExecuteSqlRaw(@"
            INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
            VALUES ('20260707093640_AddProjects', '8.0.8')
            ON CONFLICT (""MigrationId"") DO NOTHING;
        ");
    }
}
