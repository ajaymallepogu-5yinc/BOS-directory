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

        // 7. Seed Suman - reports to Ajay. Uses a real Gmail account (not a 5yinc address) so it can be
        // logged into locally with a second Google account, for testing the Timesheet submit/approve flow.
        var suman = db.Users.FirstOrDefault(u => u.FullName == "Suman");
        if (suman == null)
        {
            suman = new Employee
            {
                UserName = "ajaymallepogu871@gmail.com",
                NormalizedUserName = "AJAYMALLEPOGU871@GMAIL.COM",
                Email = "ajaymallepogu871@gmail.com",
                NormalizedEmail = "AJAYMALLEPOGU871@GMAIL.COM",
                APPEmail = "ajaymallepogu871@gmail.com",
                FullName = "Suman",
                Title = "Software Engineer",
                Company = "5yinc",
                EmailConfirmed = true,
                SecurityStamp = System.Guid.NewGuid().ToString()
            };
            suman.PasswordHash = hasher.HashPassword(suman, "Password123!");
            db.Users.Add(suman);
            db.SaveChanges();

            if (employeeRoleObj != null)
                db.UserRoles.Add(new Microsoft.AspNetCore.Identity.IdentityUserRole<int> { UserId = suman.Id, RoleId = employeeRoleObj.Id });
            if (engineeringDept != null)
                db.EmpDepartments.Add(new EmpDepartment { EmployeeId = suman.Id, DepartmentId = engineeringDept.Id });
            if (ajay != null)
                db.OrgReportings.Add(new OrgReporting { EmployeeId = suman.Id, ManagerId = ajay.Id, ReportingType = "Direct" });
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

    public static void EnsureJiraIdentityColumnsExist(AppDbContext db)
    {
        if (db.Database.ProviderName == "Npgsql.EntityFrameworkCore.PostgreSQL")
        {
            db.Database.ExecuteSqlRaw(@"ALTER TABLE ""AspNetUsers"" ADD COLUMN IF NOT EXISTS ""JiraAccountId"" VARCHAR(100) NULL;");
            db.Database.ExecuteSqlRaw(@"ALTER TABLE ""Projects"" ADD COLUMN IF NOT EXISTS ""JiraProjectKey"" VARCHAR(50) NULL;");
        }
        else
        {
            db.Database.ExecuteSqlRaw(@"
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[AspNetUsers]') AND name = 'JiraAccountId')
                BEGIN
                    ALTER TABLE [AspNetUsers] ADD [JiraAccountId] nvarchar(100) NULL;
                END");
            db.Database.ExecuteSqlRaw(@"
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Projects]') AND name = 'JiraProjectKey')
                BEGIN
                    ALTER TABLE [Projects] ADD [JiraProjectKey] nvarchar(50) NULL;
                END");
        }
    }

    /// <summary>Drops the now-removed Projects.FunctionalManagerId column - Functional Manager
    /// moved to the employee level (OrgReporting.ReportingType == "Functional") instead.</summary>
    public static void EnsureFunctionalManagerColumnDropped(AppDbContext db)
    {
        if (db.Database.ProviderName == "Npgsql.EntityFrameworkCore.PostgreSQL")
        {
            db.Database.ExecuteSqlRaw(@"ALTER TABLE ""Projects"" DROP COLUMN IF EXISTS ""FunctionalManagerId"";");
        }
        else
        {
            db.Database.ExecuteSqlRaw(@"
                IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Projects]') AND name = 'FunctionalManagerId')
                BEGIN
                    ALTER TABLE [Projects] DROP CONSTRAINT IF EXISTS [FK_Projects_AspNetUsers_FunctionalManagerId];
                    ALTER TABLE [Projects] DROP COLUMN [FunctionalManagerId];
                END");
        }
    }

    /// <summary>Adds CreatedBy/DateCreated/ModifiedBy/DateModified to AspNetUsers (Employee) -
    /// audit trail only, deliberately no IsDeleted/DateDeleted here. Employee stays hard-delete
    /// (its existing manager-reassignment flow already handles that); adding soft delete to an
    /// Identity table would permanently reserve a deleted employee's email/username, since
    /// ASP.NET Identity enforces those as unique.</summary>
    public static void EnsureEmployeeAuditColumnsExist(AppDbContext db)
    {
        if (db.Database.ProviderName == "Npgsql.EntityFrameworkCore.PostgreSQL")
        {
            db.Database.ExecuteSqlRaw(@"
                ALTER TABLE ""AspNetUsers"" ADD COLUMN IF NOT EXISTS ""CreatedBy"" TEXT NULL;
                ALTER TABLE ""AspNetUsers"" ADD COLUMN IF NOT EXISTS ""DateCreated"" TIMESTAMP NOT NULL DEFAULT NOW();
                ALTER TABLE ""AspNetUsers"" ADD COLUMN IF NOT EXISTS ""ModifiedBy"" TEXT NULL;
                ALTER TABLE ""AspNetUsers"" ADD COLUMN IF NOT EXISTS ""DateModified"" TIMESTAMP NULL;
            ");
        }
        else
        {
            db.Database.ExecuteSqlRaw(@"
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[AspNetUsers]') AND name = 'CreatedBy')
                BEGIN
                    ALTER TABLE [AspNetUsers] ADD [CreatedBy] nvarchar(max) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[AspNetUsers]') AND name = 'DateCreated')
                BEGIN
                    ALTER TABLE [AspNetUsers] ADD [DateCreated] datetime2 NOT NULL DEFAULT GETUTCDATE();
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[AspNetUsers]') AND name = 'ModifiedBy')
                BEGIN
                    ALTER TABLE [AspNetUsers] ADD [ModifiedBy] nvarchar(max) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[AspNetUsers]') AND name = 'DateModified')
                BEGIN
                    ALTER TABLE [AspNetUsers] ADD [DateModified] datetime2 NULL;
                END");
        }
    }

    /// <summary>Adds full audit fields (incl. IsDeleted/DateDeleted) to Departments.</summary>
    public static void EnsureDepartmentAuditColumnsExist(AppDbContext db)
    {
        if (db.Database.ProviderName == "Npgsql.EntityFrameworkCore.PostgreSQL")
        {
            db.Database.ExecuteSqlRaw(@"
                ALTER TABLE ""Departments"" ADD COLUMN IF NOT EXISTS ""CreatedBy"" TEXT NULL;
                ALTER TABLE ""Departments"" ADD COLUMN IF NOT EXISTS ""DateCreated"" TIMESTAMP NOT NULL DEFAULT NOW();
                ALTER TABLE ""Departments"" ADD COLUMN IF NOT EXISTS ""ModifiedBy"" TEXT NULL;
                ALTER TABLE ""Departments"" ADD COLUMN IF NOT EXISTS ""DateModified"" TIMESTAMP NULL;
                ALTER TABLE ""Departments"" ADD COLUMN IF NOT EXISTS ""IsDeleted"" BOOLEAN NOT NULL DEFAULT FALSE;
                ALTER TABLE ""Departments"" ADD COLUMN IF NOT EXISTS ""DateDeleted"" TIMESTAMP NULL;
            ");
        }
        else
        {
            db.Database.ExecuteSqlRaw(@"
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Departments]') AND name = 'CreatedBy')
                BEGIN
                    ALTER TABLE [Departments] ADD [CreatedBy] nvarchar(max) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Departments]') AND name = 'DateCreated')
                BEGIN
                    ALTER TABLE [Departments] ADD [DateCreated] datetime2 NOT NULL DEFAULT GETUTCDATE();
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Departments]') AND name = 'ModifiedBy')
                BEGIN
                    ALTER TABLE [Departments] ADD [ModifiedBy] nvarchar(max) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Departments]') AND name = 'DateModified')
                BEGIN
                    ALTER TABLE [Departments] ADD [DateModified] datetime2 NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Departments]') AND name = 'IsDeleted')
                BEGIN
                    ALTER TABLE [Departments] ADD [IsDeleted] bit NOT NULL DEFAULT 0;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Departments]') AND name = 'DateDeleted')
                BEGIN
                    ALTER TABLE [Departments] ADD [DateDeleted] datetime2 NULL;
                END");
        }
    }

    /// <summary>Adds full audit fields (incl. IsDeleted/DateDeleted) to OrgReportings.</summary>
    public static void EnsureOrgReportingAuditColumnsExist(AppDbContext db)
    {
        if (db.Database.ProviderName == "Npgsql.EntityFrameworkCore.PostgreSQL")
        {
            db.Database.ExecuteSqlRaw(@"
                ALTER TABLE ""OrgReportings"" ADD COLUMN IF NOT EXISTS ""CreatedBy"" TEXT NULL;
                ALTER TABLE ""OrgReportings"" ADD COLUMN IF NOT EXISTS ""DateCreated"" TIMESTAMP NOT NULL DEFAULT NOW();
                ALTER TABLE ""OrgReportings"" ADD COLUMN IF NOT EXISTS ""ModifiedBy"" TEXT NULL;
                ALTER TABLE ""OrgReportings"" ADD COLUMN IF NOT EXISTS ""DateModified"" TIMESTAMP NULL;
                ALTER TABLE ""OrgReportings"" ADD COLUMN IF NOT EXISTS ""IsDeleted"" BOOLEAN NOT NULL DEFAULT FALSE;
                ALTER TABLE ""OrgReportings"" ADD COLUMN IF NOT EXISTS ""DateDeleted"" TIMESTAMP NULL;
            ");
        }
        else
        {
            db.Database.ExecuteSqlRaw(@"
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[OrgReportings]') AND name = 'CreatedBy')
                BEGIN
                    ALTER TABLE [OrgReportings] ADD [CreatedBy] nvarchar(max) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[OrgReportings]') AND name = 'DateCreated')
                BEGIN
                    ALTER TABLE [OrgReportings] ADD [DateCreated] datetime2 NOT NULL DEFAULT GETUTCDATE();
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[OrgReportings]') AND name = 'ModifiedBy')
                BEGIN
                    ALTER TABLE [OrgReportings] ADD [ModifiedBy] nvarchar(max) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[OrgReportings]') AND name = 'DateModified')
                BEGIN
                    ALTER TABLE [OrgReportings] ADD [DateModified] datetime2 NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[OrgReportings]') AND name = 'IsDeleted')
                BEGIN
                    ALTER TABLE [OrgReportings] ADD [IsDeleted] bit NOT NULL DEFAULT 0;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[OrgReportings]') AND name = 'DateDeleted')
                BEGIN
                    ALTER TABLE [OrgReportings] ADD [DateDeleted] datetime2 NULL;
                END");
        }
    }

    /// <summary>Adds IsDeleted/DateDeleted to Projects - it already has CreatedAt/CreatedBy/
    /// UpdatedAt/UpdatedBy from the original migration, so only the soft-delete columns are new.</summary>
    public static void EnsureProjectSoftDeleteColumnsExist(AppDbContext db)
    {
        if (db.Database.ProviderName == "Npgsql.EntityFrameworkCore.PostgreSQL")
        {
            db.Database.ExecuteSqlRaw(@"
                ALTER TABLE ""Projects"" ADD COLUMN IF NOT EXISTS ""IsDeleted"" BOOLEAN NOT NULL DEFAULT FALSE;
                ALTER TABLE ""Projects"" ADD COLUMN IF NOT EXISTS ""DateDeleted"" TIMESTAMP NULL;
            ");
        }
        else
        {
            db.Database.ExecuteSqlRaw(@"
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Projects]') AND name = 'IsDeleted')
                BEGIN
                    ALTER TABLE [Projects] ADD [IsDeleted] bit NOT NULL DEFAULT 0;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Projects]') AND name = 'DateDeleted')
                BEGIN
                    ALTER TABLE [Projects] ADD [DateDeleted] datetime2 NULL;
                END");
        }
    }

    private static bool TableExists(AppDbContext db, string tableName)
    {
        var conn = db.Database.GetDbConnection();
        using var cmd = conn.CreateCommand();
        if (conn.State != System.Data.ConnectionState.Open) conn.Open();
        if (db.Database.ProviderName == "Npgsql.EntityFrameworkCore.PostgreSQL")
        {
            cmd.CommandText = "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = @name)";
            var p = cmd.CreateParameter();
            p.ParameterName = "@name";
            p.Value = tableName;
            cmd.Parameters.Add(p);
            return Convert.ToBoolean(cmd.ExecuteScalar());
        }
        else
        {
            cmd.CommandText = "SELECT OBJECT_ID(@name, N'U')";
            var p = cmd.CreateParameter();
            p.ParameterName = "@name";
            p.Value = $"[{tableName}]";
            cmd.Parameters.Add(p);
            var res = cmd.ExecuteScalar();
            return res != DBNull.Value && res != null;
        }
    }

    /// <summary>
    /// Splits the old flat TimesheetEntries table (EmployeeId + per-entry Status on each row)
    /// into Timesheets (weekly container + Status) / TimesheetEntries (line items) /
    /// TimesheetReviewLogs (approval audit trail), per the 3-table schema. Idempotent: a no-op
    /// once the "Timesheets" table exists. If a pre-migration TimesheetEntries table is found,
    /// it's renamed to TimesheetEntries_Legacy (kept, not dropped) and its rows are migrated
    /// into the new schema rather than lost.
    /// </summary>
    public static void EnsureTimesheetTablesExist(AppDbContext db)
    {
        if (TableExists(db, "Timesheets"))
        {
            return; // already migrated
        }

        var legacyTableExisted = TableExists(db, "TimesheetEntries");

        // Rename + create as one atomic unit - a raw multi-statement ExecuteSqlRaw batch is NOT
        // transactional on its own (a later statement failing does not roll back the earlier
        // ones in the same batch), so without an explicit transaction a failure here could leave
        // "Timesheets" created but "TimesheetEntries"/"TimesheetReviewLogs" missing, which
        // TableExists(db, "Timesheets") would then wrongly treat as "already migrated" on the
        // next startup.
        using (var transaction = db.Database.BeginTransaction())
        {
            if (legacyTableExisted)
            {
                // Renaming the table alone leaves its PK/FK/index names attached under their
                // ORIGINAL names (neither Postgres nor SQL Server renames constraints/indexes
                // when their owning table is renamed) - those names collide with the
                // identically-named constraints/indexes the new TimesheetEntries table is about
                // to create. Drop them from the legacy copy first; it's a read-only backup from
                // here on, it doesn't need its own PK/FK/index protection.
                if (db.Database.ProviderName == "Npgsql.EntityFrameworkCore.PostgreSQL")
                {
                    db.Database.ExecuteSqlRaw(@"
                        ALTER TABLE ""TimesheetEntries"" DROP CONSTRAINT IF EXISTS ""FK_TimesheetEntries_AspNetUsers_EmployeeId"";
                        ALTER TABLE ""TimesheetEntries"" DROP CONSTRAINT IF EXISTS ""FK_TimesheetEntries_Projects_ProjectId"";
                        ALTER TABLE ""TimesheetEntries"" DROP CONSTRAINT IF EXISTS ""FK_TimesheetEntries_AspNetUsers_ReviewedByUserId"";
                        ALTER TABLE ""TimesheetEntries"" DROP CONSTRAINT IF EXISTS ""TimesheetEntries_pkey"";
                        DROP INDEX IF EXISTS ""IX_TimesheetEntries_EmployeeId"";
                        DROP INDEX IF EXISTS ""IX_TimesheetEntries_ProjectId"";
                        DROP INDEX IF EXISTS ""IX_TimesheetEntries_ReviewedByUserId"";
                        ALTER TABLE ""TimesheetEntries"" RENAME TO ""TimesheetEntries_Legacy"";
                    ");
                }
                else
                {
                    db.Database.ExecuteSqlRaw(@"
                        ALTER TABLE [TimesheetEntries] DROP CONSTRAINT IF EXISTS [FK_TimesheetEntries_AspNetUsers_EmployeeId];
                        ALTER TABLE [TimesheetEntries] DROP CONSTRAINT IF EXISTS [FK_TimesheetEntries_Projects_ProjectId];
                        ALTER TABLE [TimesheetEntries] DROP CONSTRAINT IF EXISTS [FK_TimesheetEntries_AspNetUsers_ReviewedByUserId];
                        ALTER TABLE [TimesheetEntries] DROP CONSTRAINT IF EXISTS [PK_TimesheetEntries];
                        DROP INDEX IF EXISTS [IX_TimesheetEntries_EmployeeId] ON [TimesheetEntries];
                        DROP INDEX IF EXISTS [IX_TimesheetEntries_ProjectId] ON [TimesheetEntries];
                        DROP INDEX IF EXISTS [IX_TimesheetEntries_ReviewedByUserId] ON [TimesheetEntries];
                        EXEC sp_rename 'TimesheetEntries', 'TimesheetEntries_Legacy';
                    ");
                }
            }

            CreateNewTimesheetTables(db);
            transaction.Commit();
        }

        if (legacyTableExisted)
        {
            MigrateLegacyTimesheetEntries(db);
        }
    }

    private static void CreateNewTimesheetTables(AppDbContext db)
    {
        if (db.Database.ProviderName == "Npgsql.EntityFrameworkCore.PostgreSQL")
        {
            db.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS ""Timesheets"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""EmployeeId"" INT NOT NULL,
                    ""StartDate"" DATE NOT NULL,
                    ""EndDate"" DATE NOT NULL,
                    ""Status"" VARCHAR(20) NOT NULL DEFAULT 'Draft',
                    ""CreatedBy"" TEXT NULL,
                    ""DateCreated"" TIMESTAMP NOT NULL DEFAULT NOW(),
                    ""ModifiedBy"" TEXT NULL,
                    ""DateModified"" TIMESTAMP NULL,
                    ""IsDeleted"" BOOLEAN NOT NULL DEFAULT FALSE,
                    ""DateDeleted"" TIMESTAMP NULL,
                    CONSTRAINT ""FK_Timesheets_AspNetUsers_EmployeeId"" FOREIGN KEY (""EmployeeId"")
                        REFERENCES ""AspNetUsers"" (""Id"") ON DELETE RESTRICT
                );
                CREATE INDEX IF NOT EXISTS ""IX_Timesheets_EmployeeId"" ON ""Timesheets"" (""EmployeeId"");

                CREATE TABLE IF NOT EXISTS ""TimesheetEntries"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""TimesheetId"" INT NOT NULL,
                    ""ProjectId"" INT NULL,
                    ""JiraIssueKey"" VARCHAR(50) NULL,
                    ""JiraIssueSummary"" TEXT NULL,
                    ""TaskDescription"" TEXT NULL,
                    ""Date"" DATE NOT NULL,
                    ""HoursSpent"" DECIMAL(5,2) NOT NULL,
                    ""Comment"" TEXT NULL,
                    ""CreatedBy"" TEXT NULL,
                    ""DateCreated"" TIMESTAMP NOT NULL DEFAULT NOW(),
                    ""ModifiedBy"" TEXT NULL,
                    ""DateModified"" TIMESTAMP NULL,
                    ""IsDeleted"" BOOLEAN NOT NULL DEFAULT FALSE,
                    ""DateDeleted"" TIMESTAMP NULL,
                    CONSTRAINT ""FK_TimesheetEntries_Timesheets_TimesheetId"" FOREIGN KEY (""TimesheetId"")
                        REFERENCES ""Timesheets"" (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_TimesheetEntries_Projects_ProjectId"" FOREIGN KEY (""ProjectId"")
                        REFERENCES ""Projects"" (""Id"") ON DELETE SET NULL
                );
                CREATE INDEX IF NOT EXISTS ""IX_TimesheetEntries_TimesheetId"" ON ""TimesheetEntries"" (""TimesheetId"");
                CREATE INDEX IF NOT EXISTS ""IX_TimesheetEntries_ProjectId"" ON ""TimesheetEntries"" (""ProjectId"");

                CREATE TABLE IF NOT EXISTS ""TimesheetReviewLogs"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""TimesheetId"" INT NOT NULL,
                    ""Status"" VARCHAR(20) NOT NULL,
                    ""ReviewerId"" INT NOT NULL,
                    ""Comment"" TEXT NULL,
                    ""CreatedBy"" TEXT NULL,
                    ""DateCreated"" TIMESTAMP NOT NULL DEFAULT NOW(),
                    ""ModifiedBy"" TEXT NULL,
                    ""DateModified"" TIMESTAMP NULL,
                    ""IsDeleted"" BOOLEAN NOT NULL DEFAULT FALSE,
                    ""DateDeleted"" TIMESTAMP NULL,
                    CONSTRAINT ""FK_TimesheetReviewLogs_Timesheets_TimesheetId"" FOREIGN KEY (""TimesheetId"")
                        REFERENCES ""Timesheets"" (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_TimesheetReviewLogs_AspNetUsers_ReviewerId"" FOREIGN KEY (""ReviewerId"")
                        REFERENCES ""AspNetUsers"" (""Id"") ON DELETE RESTRICT
                );
                CREATE INDEX IF NOT EXISTS ""IX_TimesheetReviewLogs_TimesheetId"" ON ""TimesheetReviewLogs"" (""TimesheetId"");
            ");
        }
        else
        {
            db.Database.ExecuteSqlRaw(@"
                CREATE TABLE [Timesheets] (
                    [Id] int IDENTITY(1,1) NOT NULL,
                    [EmployeeId] int NOT NULL,
                    [StartDate] date NOT NULL,
                    [EndDate] date NOT NULL,
                    [Status] nvarchar(20) NOT NULL DEFAULT 'Draft',
                    [CreatedBy] nvarchar(max) NULL,
                    [DateCreated] datetime2 NOT NULL DEFAULT GETUTCDATE(),
                    [ModifiedBy] nvarchar(max) NULL,
                    [DateModified] datetime2 NULL,
                    [IsDeleted] bit NOT NULL DEFAULT 0,
                    [DateDeleted] datetime2 NULL,
                    CONSTRAINT [PK_Timesheets] PRIMARY KEY CLUSTERED ([Id] ASC),
                    CONSTRAINT [FK_Timesheets_AspNetUsers_EmployeeId] FOREIGN KEY ([EmployeeId])
                        REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION
                );
                CREATE INDEX [IX_Timesheets_EmployeeId] ON [Timesheets] ([EmployeeId]);

                CREATE TABLE [TimesheetEntries] (
                    [Id] int IDENTITY(1,1) NOT NULL,
                    [TimesheetId] int NOT NULL,
                    [ProjectId] int NULL,
                    [JiraIssueKey] nvarchar(50) NULL,
                    [JiraIssueSummary] nvarchar(max) NULL,
                    [TaskDescription] nvarchar(max) NULL,
                    [Date] date NOT NULL,
                    [HoursSpent] decimal(5,2) NOT NULL,
                    [Comment] nvarchar(max) NULL,
                    [CreatedBy] nvarchar(max) NULL,
                    [DateCreated] datetime2 NOT NULL DEFAULT GETUTCDATE(),
                    [ModifiedBy] nvarchar(max) NULL,
                    [DateModified] datetime2 NULL,
                    [IsDeleted] bit NOT NULL DEFAULT 0,
                    [DateDeleted] datetime2 NULL,
                    CONSTRAINT [PK_TimesheetEntries] PRIMARY KEY CLUSTERED ([Id] ASC),
                    CONSTRAINT [FK_TimesheetEntries_Timesheets_TimesheetId] FOREIGN KEY ([TimesheetId])
                        REFERENCES [Timesheets] ([Id]) ON DELETE CASCADE,
                    CONSTRAINT [FK_TimesheetEntries_Projects_ProjectId] FOREIGN KEY ([ProjectId])
                        REFERENCES [Projects] ([Id]) ON DELETE SET NULL
                );
                CREATE INDEX [IX_TimesheetEntries_TimesheetId] ON [TimesheetEntries] ([TimesheetId]);
                CREATE INDEX [IX_TimesheetEntries_ProjectId] ON [TimesheetEntries] ([ProjectId]);

                CREATE TABLE [TimesheetReviewLogs] (
                    [Id] int IDENTITY(1,1) NOT NULL,
                    [TimesheetId] int NOT NULL,
                    [Status] nvarchar(20) NOT NULL,
                    [ReviewerId] int NOT NULL,
                    [Comment] nvarchar(max) NULL,
                    [CreatedBy] nvarchar(max) NULL,
                    [DateCreated] datetime2 NOT NULL DEFAULT GETUTCDATE(),
                    [ModifiedBy] nvarchar(max) NULL,
                    [DateModified] datetime2 NULL,
                    [IsDeleted] bit NOT NULL DEFAULT 0,
                    [DateDeleted] datetime2 NULL,
                    CONSTRAINT [PK_TimesheetReviewLogs] PRIMARY KEY CLUSTERED ([Id] ASC),
                    CONSTRAINT [FK_TimesheetReviewLogs_Timesheets_TimesheetId] FOREIGN KEY ([TimesheetId])
                        REFERENCES [Timesheets] ([Id]) ON DELETE CASCADE,
                    CONSTRAINT [FK_TimesheetReviewLogs_AspNetUsers_ReviewerId] FOREIGN KEY ([ReviewerId])
                        REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION
                );
                CREATE INDEX [IX_TimesheetReviewLogs_TimesheetId] ON [TimesheetReviewLogs] ([TimesheetId]);
            ");
        }
    }

    private class LegacyTimesheetEntryRow
    {
        public int EmployeeId { get; set; }
        public int? ProjectId { get; set; }
        public string? JiraIssueKey { get; set; }
        public string? JiraIssueSummary { get; set; }
        public string? TaskDescription { get; set; }
        public DateTime WorkDate { get; set; }
        public decimal HoursSpent { get; set; }
        public string? Comment { get; set; }
        public string Status { get; set; } = "Draft";
        public string? ReviewerComment { get; set; }
        public int? ReviewedByUserId { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    /// <summary>One-time data migration: groups legacy per-entry rows into whole-week Timesheets.
    /// Since the old model allowed each entry within a week to carry its own status, the week's
    /// new single Status is inferred: Rejected wins if any entry was Rejected, else Pending if
    /// any is Pending, else Approved only if every entry was Approved, else Draft.</summary>
    private static void MigrateLegacyTimesheetEntries(AppDbContext db)
    {
        var legacyRows = new List<LegacyTimesheetEntryRow>();
        var conn = db.Database.GetDbConnection();
        using (var cmd = conn.CreateCommand())
        {
            if (conn.State != System.Data.ConnectionState.Open) conn.Open();
            cmd.CommandText = db.Database.ProviderName == "Npgsql.EntityFrameworkCore.PostgreSQL"
                ? @"SELECT ""EmployeeId"", ""ProjectId"", ""JiraIssueKey"", ""JiraIssueSummary"", ""TaskDescription"", ""WorkDate"", ""HoursSpent"", ""Comment"", ""Status"", ""ReviewerComment"", ""ReviewedByUserId"", ""ReviewedAt"", ""CreatedAt"", ""UpdatedAt"" FROM ""TimesheetEntries_Legacy"""
                : @"SELECT [EmployeeId], [ProjectId], [JiraIssueKey], [JiraIssueSummary], [TaskDescription], [WorkDate], [HoursSpent], [Comment], [Status], [ReviewerComment], [ReviewedByUserId], [ReviewedAt], [CreatedAt], [UpdatedAt] FROM [TimesheetEntries_Legacy]";
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                legacyRows.Add(new LegacyTimesheetEntryRow
                {
                    EmployeeId = reader.GetInt32(0),
                    ProjectId = reader.IsDBNull(1) ? null : reader.GetInt32(1),
                    JiraIssueKey = reader.IsDBNull(2) ? null : reader.GetString(2),
                    JiraIssueSummary = reader.IsDBNull(3) ? null : reader.GetString(3),
                    TaskDescription = reader.IsDBNull(4) ? null : reader.GetString(4),
                    WorkDate = reader.GetDateTime(5),
                    HoursSpent = reader.GetDecimal(6),
                    Comment = reader.IsDBNull(7) ? null : reader.GetString(7),
                    Status = reader.GetString(8),
                    ReviewerComment = reader.IsDBNull(9) ? null : reader.GetString(9),
                    ReviewedByUserId = reader.IsDBNull(10) ? null : reader.GetInt32(10),
                    ReviewedAt = reader.IsDBNull(11) ? null : reader.GetDateTime(11),
                    CreatedAt = reader.GetDateTime(12),
                    UpdatedAt = reader.IsDBNull(13) ? null : reader.GetDateTime(13)
                });
            }
        }

        if (legacyRows.Count == 0) return;

        DateTime GetMonday(DateTime d)
        {
            var day = (int)d.DayOfWeek; // Sunday = 0
            var diff = (day == 0 ? -6 : 1) - day;
            return d.Date.AddDays(diff);
        }

        var groups = legacyRows.GroupBy(r => (r.EmployeeId, WeekStart: GetMonday(r.WorkDate)));

        foreach (var group in groups)
        {
            var rows = group.ToList();
            string status =
                rows.Any(r => r.Status == "Rejected") ? "Rejected" :
                rows.Any(r => r.Status == "Pending") ? "Pending" :
                rows.All(r => r.Status == "Approved") ? "Approved" : "Draft";

            var timesheet = new Timesheet
            {
                EmployeeId = group.Key.EmployeeId,
                StartDate = group.Key.WeekStart,
                EndDate = group.Key.WeekStart.AddDays(4),
                Status = status,
                DateCreated = rows.Min(r => r.CreatedAt),
                CreatedBy = "migration:legacy-timesheet-entries"
            };
            db.Timesheets.Add(timesheet);
            db.SaveChanges();

            foreach (var r in rows)
            {
                db.TimesheetEntries.Add(new TimesheetEntry
                {
                    TimesheetId = timesheet.Id,
                    ProjectId = r.ProjectId,
                    JiraIssueKey = r.JiraIssueKey,
                    JiraIssueSummary = r.JiraIssueSummary,
                    TaskDescription = r.TaskDescription,
                    Date = r.WorkDate,
                    HoursSpent = r.HoursSpent,
                    Comment = r.Comment,
                    DateCreated = r.CreatedAt,
                    DateModified = r.UpdatedAt,
                    ModifiedBy = r.UpdatedAt.HasValue ? "migration:legacy-timesheet-entries" : null,
                    CreatedBy = "migration:legacy-timesheet-entries"
                });
            }

            var reviewed = rows.Where(r => r.ReviewedByUserId.HasValue).OrderByDescending(r => r.ReviewedAt).FirstOrDefault();
            if (reviewed != null)
            {
                db.TimesheetReviewLogs.Add(new TimesheetReviewLog
                {
                    TimesheetId = timesheet.Id,
                    Status = status == "Rejected" ? "Rejected" : "Approved",
                    ReviewerId = reviewed.ReviewedByUserId!.Value,
                    Comment = reviewed.ReviewerComment,
                    DateCreated = reviewed.ReviewedAt ?? reviewed.CreatedAt,
                    CreatedBy = "migration:legacy-timesheet-entries"
                });
            }

            db.SaveChanges();
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
