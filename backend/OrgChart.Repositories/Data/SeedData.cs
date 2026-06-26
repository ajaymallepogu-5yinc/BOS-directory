using Microsoft.EntityFrameworkCore;
using OrgChart.Domain;

namespace OrgChart.Repositories.Data;

public static class SeedData
{
    public static void EnsureSeeded(AppDbContext db)
    {
        if (db.Departments.Any()) return; // already seeded

        // Seed App Roles
        var adminRole = new AppRole { Name = "Admin" };
        var employeeRole = new AppRole { Name = "Employee" };
        db.AppRoles.AddRange(adminRole, employeeRole);
        db.SaveChanges();

        var leadership = new Department { Name = "LEADERSHIP", ColorHex = "#4338CA" };
        var project = new Department { Name = "PROJECT", ColorHex = "#B45309" };
        var it = new Department { Name = "IT", ColorHex = "#0F766E" };
        var hrOps = new Department { Name = "HR & OPS", ColorHex = "#BE123C" };

        db.Departments.AddRange(leadership, project, it, hrOps);
        db.SaveChanges();

        // Helper function to initialize user fields for Employee inheriting from IdentityUser<int>
        Employee CreateEmployee(string fullName, string title, string company, string email, string? avatarUrl, int roleId)
        {
            return new Employee
            {
                FullName = fullName,
                Title = title,
                Company = company,
                APPEmail = email,
                Email = email,
                NormalizedEmail = email.ToUpperInvariant(),
                UserName = email,
                NormalizedUserName = email.ToUpperInvariant(),
                SecurityStamp = Guid.NewGuid().ToString(),
                EmailConfirmed = true,
                AvatarUrl = avatarUrl,
                APPRoleId = roleId
            };
        }

        var ceo = CreateEmployee("Aravind Krishnan", "Chief Executive Officer", "5Y Business Solutions", "aravind@5yinc.com", null, adminRole.Id);
        db.Employees.Add(ceo);
        db.SaveChanges();

        var vikhyath = CreateEmployee("Vikhyath Rai", "Manager - Operations", "5Y Business Solutions", "vikhyath@5yinc.com", null, employeeRole.Id);
        db.Employees.Add(vikhyath);
        db.SaveChanges();

        var sudhakar = CreateEmployee("Sudhakar Somyajula", "Technical Director", "5Y Business Solutions", "sudhakar@5yinc.com", null, employeeRole.Id);
        var hemanth = CreateEmployee("Hemanth Varma G", "Support Engineer - IT", "5Y Business Solutions", "hemanth@5yinc.com", null, employeeRole.Id);
        var annapurna = CreateEmployee("Annapurna Y V L", "HR Manager", "5Y Business Solutions", "annapurna@5yinc.com", null, employeeRole.Id);
        var suhani = CreateEmployee("Suhani Drolia", "Product Designer", "5Y Business Solutions", "suhani@5yinc.com", null, employeeRole.Id);
        var subhash = CreateEmployee("Subhash Suman Depally", "Head - Delivery", "5Y Business Solutions", "subhash@5yinc.com", null, employeeRole.Id);
        var ajay = CreateEmployee("Ajay Mallepogu", "Trainee", "5Y Business Solutions", "ajay@5yinc.com", null, employeeRole.Id);

        db.Employees.AddRange(sudhakar, hemanth, annapurna, suhani, subhash, ajay);
        db.SaveChanges();

        var leadOne = CreateEmployee("Priya Nair", "Project Lead", "5Y Business Solutions", "priya@5yinc.com", null, employeeRole.Id);
        var leadTwo = CreateEmployee("Rohit Bhatia", "Project Lead", "5Y Business Solutions", "rohit@5yinc.com", null, employeeRole.Id);
        db.Employees.AddRange(leadOne, leadTwo);
        db.SaveChanges();

        var dev1 = CreateEmployee("Meera Kulkarni", "Software Engineer", "5Y Business Solutions", "meera@5yinc.com", null, employeeRole.Id);
        var dev2 = CreateEmployee("Arjun Reddy", "Software Engineer", "5Y Business Solutions", "arjun@5yinc.com", null, employeeRole.Id);
        var dev3 = CreateEmployee("Kavya Iyer", "QA Engineer", "5Y Business Solutions", "kavya@5yinc.com", null, employeeRole.Id);
        db.Employees.AddRange(dev1, dev2, dev3);
        db.SaveChanges();

        // Seed many-to-many department relations (EmpDepartments)
        db.EmpDepartments.AddRange(
            new EmpDepartment { EmployeeId = ceo.Id, DepartmentId = leadership.Id },
            new EmpDepartment { EmployeeId = vikhyath.Id, DepartmentId = leadership.Id },
            new EmpDepartment { EmployeeId = sudhakar.Id, DepartmentId = project.Id },
            new EmpDepartment { EmployeeId = hemanth.Id, DepartmentId = it.Id },
            new EmpDepartment { EmployeeId = annapurna.Id, DepartmentId = hrOps.Id },
            new EmpDepartment { EmployeeId = suhani.Id, DepartmentId = project.Id },
            new EmpDepartment { EmployeeId = subhash.Id, DepartmentId = leadership.Id },
            new EmpDepartment { EmployeeId = ajay.Id, DepartmentId = project.Id },
            new EmpDepartment { EmployeeId = leadOne.Id, DepartmentId = project.Id },
            new EmpDepartment { EmployeeId = leadTwo.Id, DepartmentId = project.Id },
            new EmpDepartment { EmployeeId = dev1.Id, DepartmentId = project.Id },
            new EmpDepartment { EmployeeId = dev2.Id, DepartmentId = project.Id },
            new EmpDepartment { EmployeeId = dev3.Id, DepartmentId = project.Id }
        );
        db.SaveChanges();

        // Seed OrgReporting mapping (Direct vs Functional Managers)
        db.OrgReportings.AddRange(
            new OrgReporting { EmployeeId = vikhyath.Id, ManagerId = ceo.Id, ReportingType = "Direct" },
            new OrgReporting { EmployeeId = sudhakar.Id, ManagerId = vikhyath.Id, ReportingType = "Direct" },
            new OrgReporting { EmployeeId = hemanth.Id, ManagerId = vikhyath.Id, ReportingType = "Direct" },
            new OrgReporting { EmployeeId = annapurna.Id, ManagerId = vikhyath.Id, ReportingType = "Direct" },
            new OrgReporting { EmployeeId = suhani.Id, ManagerId = vikhyath.Id, ReportingType = "Direct" },
            new OrgReporting { EmployeeId = suhani.Id, ManagerId = sudhakar.Id, ReportingType = "Functional" },
            new OrgReporting { EmployeeId = subhash.Id, ManagerId = vikhyath.Id, ReportingType = "Direct" },
            new OrgReporting { EmployeeId = ajay.Id, ManagerId = vikhyath.Id, ReportingType = "Direct" },
            new OrgReporting { EmployeeId = ajay.Id, ManagerId = sudhakar.Id, ReportingType = "Functional" },
            new OrgReporting { EmployeeId = leadOne.Id, ManagerId = subhash.Id, ReportingType = "Direct" },
            new OrgReporting { EmployeeId = leadTwo.Id, ManagerId = subhash.Id, ReportingType = "Direct" },
            new OrgReporting { EmployeeId = dev1.Id, ManagerId = leadOne.Id, ReportingType = "Direct" },
            new OrgReporting { EmployeeId = dev2.Id, ManagerId = leadOne.Id, ReportingType = "Direct" },
            new OrgReporting { EmployeeId = dev3.Id, ManagerId = leadTwo.Id, ReportingType = "Direct" }
        );
        db.SaveChanges();
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
                    ""JiraApiUrl"" TEXT NULL,
                    ""JiraUserEmail"" TEXT NULL,
                    ""JiraApiToken"" TEXT NULL,
                    ""IdField"" VARCHAR(100) NOT NULL,
                    ""FullNameField"" VARCHAR(100) NOT NULL,
                    ""TitleField"" VARCHAR(100) NOT NULL,
                    ""CompanyField"" VARCHAR(100) NOT NULL,
                    ""AvatarUrlField"" VARCHAR(100) NOT NULL,
                    ""ManagerIdField"" VARCHAR(100) NOT NULL,
                    ""DepartmentIdField"" VARCHAR(100) NOT NULL,
                    ""DepartmentNameField"" VARCHAR(100) NOT NULL,
                    ""DepartmentColorField"" VARCHAR(100) NOT NULL
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
                        [JiraApiUrl] nvarchar(max) NULL,
                        [JiraUserEmail] nvarchar(max) NULL,
                        [JiraApiToken] nvarchar(max) NULL,
                        [IdField] nvarchar(100) NOT NULL,
                        [FullNameField] nvarchar(100) NOT NULL,
                        [TitleField] nvarchar(100) NOT NULL,
                        [CompanyField] nvarchar(100) NOT NULL,
                        [AvatarUrlField] nvarchar(100) NOT NULL,
                        [ManagerIdField] nvarchar(100) NOT NULL,
                        [DepartmentIdField] nvarchar(100) NOT NULL,
                        [DepartmentNameField] nvarchar(100) NOT NULL,
                        [DepartmentColorField] nvarchar(100) NOT NULL,
                        CONSTRAINT [PK_DataSourceConfigs] PRIMARY KEY CLUSTERED ([Id] ASC)
                    );
                END
                ELSE
                BEGIN
                    -- Add Jira columns if they do not exist
                    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[DataSourceConfigs]') AND name = 'JiraApiUrl')
                    BEGIN
                        ALTER TABLE [DataSourceConfigs] ADD [JiraApiUrl] nvarchar(max) NULL;
                        ALTER TABLE [DataSourceConfigs] ADD [JiraUserEmail] nvarchar(max) NULL;
                        ALTER TABLE [DataSourceConfigs] ADD [JiraApiToken] nvarchar(max) NULL;
                    END
                END";
            db.Database.ExecuteSqlRaw(sql);
        }
    }

    public static void EnsureJiraTablesExist(AppDbContext db)
    {
        if (db.Database.ProviderName == "Npgsql.EntityFrameworkCore.PostgreSQL")
        {
            var sql = @"
                CREATE TABLE IF NOT EXISTS ""JiraProjects"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""Key"" VARCHAR(50) NOT NULL,
                    ""Name"" VARCHAR(150) NOT NULL
                );

                CREATE TABLE IF NOT EXISTS ""JiraSprints"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""Name"" VARCHAR(150) NOT NULL,
                    ""State"" VARCHAR(50) NOT NULL,
                    ""BoardId"" INT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS ""JiraIssues"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""Key"" VARCHAR(50) NOT NULL,
                    ""Summary"" VARCHAR(250) NOT NULL,
                    ""Status"" VARCHAR(50) NOT NULL,
                    ""Assignee"" VARCHAR(100) NOT NULL,
                    ""Priority"" VARCHAR(50) NOT NULL,
                    ""Description"" TEXT NOT NULL,
                    ""ExpectedTime"" VARCHAR(100) NOT NULL DEFAULT '',
                    ""ActualTime"" VARCHAR(100) NOT NULL DEFAULT '',
                    ""SprintId"" INT NULL,
                    ""ProjectId"" INT NOT NULL,
                    CONSTRAINT ""FK_JiraIssues_JiraProjects_ProjectId"" FOREIGN KEY (""ProjectId"") REFERENCES ""JiraProjects"" (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_JiraIssues_JiraSprints_SprintId"" FOREIGN KEY (""SprintId"") REFERENCES ""JiraSprints"" (""Id"") ON DELETE SET NULL
                );";
            db.Database.ExecuteSqlRaw(sql);
        }
        else
        {
            var sql = @"
                IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[JiraProjects]') AND type in (N'U'))
                BEGIN
                    CREATE TABLE [JiraProjects] (
                        [Id] int IDENTITY(1,1) NOT NULL,
                        [Key] nvarchar(50) NOT NULL,
                        [Name] nvarchar(150) NOT NULL,
                        CONSTRAINT [PK_JiraProjects] PRIMARY KEY CLUSTERED ([Id] ASC)
                    );
                END

                IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[JiraSprints]') AND type in (N'U'))
                BEGIN
                    CREATE TABLE [JiraSprints] (
                        [Id] int IDENTITY(1,1) NOT NULL,
                        [Name] nvarchar(150) NOT NULL,
                        [State] nvarchar(50) NOT NULL,
                        [BoardId] int NOT NULL,
                        CONSTRAINT [PK_JiraSprints] PRIMARY KEY CLUSTERED ([Id] ASC)
                    );
                END

                IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[JiraIssues]') AND type in (N'U'))
                BEGIN
                    CREATE TABLE [JiraIssues] (
                        [Id] int IDENTITY(1,1) NOT NULL,
                        [Key] nvarchar(50) NOT NULL,
                        [Summary] nvarchar(250) NOT NULL,
                        [Status] nvarchar(50) NOT NULL,
                        [Assignee] nvarchar(100) NOT NULL,
                        [Priority] nvarchar(50) NOT NULL,
                        [Description] nvarchar(max) NOT NULL,
                        [ExpectedTime] nvarchar(100) NOT NULL DEFAULT '',
                        [ActualTime] nvarchar(100) NOT NULL DEFAULT '',
                        [SprintId] int NULL,
                        [ProjectId] int NOT NULL,
                        CONSTRAINT [PK_JiraIssues] PRIMARY KEY CLUSTERED ([Id] ASC),
                        CONSTRAINT [FK_JiraIssues_JiraProjects_ProjectId] FOREIGN KEY ([ProjectId]) REFERENCES [JiraProjects] ([Id]) ON DELETE CASCADE,
                        CONSTRAINT [FK_JiraIssues_JiraSprints_SprintId] FOREIGN KEY ([SprintId]) REFERENCES [JiraSprints] ([Id]) ON DELETE SET NULL
                    );
                END
                ELSE
                BEGIN
                    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[JiraIssues]') AND name = 'ExpectedTime')
                    BEGIN
                        ALTER TABLE [JiraIssues] ADD [ExpectedTime] nvarchar(100) NOT NULL DEFAULT '';
                        ALTER TABLE [JiraIssues] ADD [ActualTime] nvarchar(100) NOT NULL DEFAULT '';
                    END
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
                HrPortalApiUrl = "http://localhost:5226/api/mock-hr-portal/employees?type=keka",
                HrPortalApiAuthHeaderName = "Authorization",
                HrPortalApiAuthHeaderValue = "Bearer mock-keka-token-12345",
                IdField = "id",
                FullNameField = "displayName",
                TitleField = "jobTitle",
                CompanyField = "company",
                AvatarUrlField = "avatarUrl",
                ManagerIdField = "reportsTo.id",
                DepartmentIdField = "department",
                DepartmentNameField = "department",
                DepartmentColorField = "departmentColor",
                JiraApiUrl = "http://localhost:5226/api/mock-jira/data",
                JiraUserEmail = "admin@company.com",
                JiraApiToken = "mock-jira-token-abcde"
            });
            db.SaveChanges();
        }
    }

    public static void SeedHrDummyTable(AppDbContext db)
    {
        if (db.Database.ProviderName == "Npgsql.EntityFrameworkCore.PostgreSQL")
        {
            var sqlCreate = @"
                CREATE SCHEMA IF NOT EXISTS ""HR"";

                CREATE TABLE IF NOT EXISTS ""HR"".""Employees"" (
                    ""EmployeeId"" SERIAL PRIMARY KEY,
                    ""FullName"" VARCHAR(100) NOT NULL,
                    ""JobTitle"" VARCHAR(100) NULL,
                    ""CompanyName"" VARCHAR(100) NULL,
                    ""PhotoUrl"" VARCHAR(500) NULL,
                    ""ReportsToId"" INT NULL,
                    ""DepartmentId"" INT NOT NULL,
                    ""DepartmentName"" VARCHAR(100) NOT NULL,
                    ""DepartmentColor"" VARCHAR(10) NULL
                );";
            db.Database.ExecuteSqlRaw(sqlCreate);

            var sqlInsert = @"
                INSERT INTO ""HR"".""Employees"" (""FullName"", ""JobTitle"", ""CompanyName"", ""PhotoUrl"", ""ReportsToId"", ""DepartmentId"", ""DepartmentName"", ""DepartmentColor"")
                SELECT 'Aravind HR Portal', 'Chief Executive Officer', '5Y HR Portal Solutions', NULL, NULL, 1, 'LEADERSHIP', '#4338CA'
                WHERE NOT EXISTS (SELECT 1 FROM ""HR"".""Employees"" WHERE ""FullName"" = 'Aravind HR Portal');

                INSERT INTO ""HR"".""Employees"" (""FullName"", ""JobTitle"", ""CompanyName"", ""PhotoUrl"", ""ReportsToId"", ""DepartmentId"", ""DepartmentName"", ""DepartmentColor"")
                SELECT 'Vikhyath HR Portal', 'VP Operations', '5Y HR Portal Solutions', NULL, 1, 2, 'OPERATIONS', '#B45309'
                WHERE NOT EXISTS (SELECT 1 FROM ""HR"".""Employees"" WHERE ""FullName"" = 'Vikhyath HR Portal');

                INSERT INTO ""HR"".""Employees"" (""FullName"", ""JobTitle"", ""CompanyName"", ""PhotoUrl"", ""ReportsToId"", ""DepartmentId"", ""DepartmentName"", ""DepartmentColor"")
                SELECT 'Sudhakar HR Portal', 'Technical Director', '5Y HR Portal Solutions', NULL, 2, 3, 'ENGINEERING', '#0F766E'
                WHERE NOT EXISTS (SELECT 1 FROM ""HR"".""Employees"" WHERE ""FullName"" = 'Sudhakar HR Portal');

                INSERT INTO ""HR"".""Employees"" (""FullName"", ""JobTitle"", ""CompanyName"", ""PhotoUrl"", ""ReportsToId"", ""DepartmentId"", ""DepartmentName"", ""DepartmentColor"")
                SELECT 'Ajay HR Portal', 'Trainee Developer', '5Y HR Portal Solutions', NULL, 3, 3, 'ENGINEERING', '#0F766E'
                WHERE NOT EXISTS (SELECT 1 FROM ""HR"".""Employees"" WHERE ""FullName"" = 'Ajay HR Portal');";
            
            db.Database.ExecuteSqlRaw(sqlInsert);
        }
        else
        {
            var sqlCreate = @"
                IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'HR')
                BEGIN
                    EXEC('CREATE SCHEMA HR')
                END

                IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[HR].[Employees]') AND type in (N'U'))
                BEGIN
                    CREATE TABLE [HR].[Employees](
                        [EmployeeId] [int] IDENTITY(1,1) NOT NULL,
                        [FullName] [nvarchar](100) NOT NULL,
                        [JobTitle] [nvarchar](100) NULL,
                        [CompanyName] [nvarchar](100) NULL,
                        [PhotoUrl] [nvarchar](500) NULL,
                        [ReportsToId] [int] NULL,
                        [DepartmentId] [int] NOT NULL,
                        [DepartmentName] [nvarchar](100) NOT NULL,
                        [DepartmentColor] [nvarchar](10) NULL,
                        CONSTRAINT [PK_Employees_HR] PRIMARY KEY CLUSTERED ([EmployeeId] ASC)
                    )
                END";
            db.Database.ExecuteSqlRaw(sqlCreate);

            var sqlInsert = @"
                IF NOT EXISTS (SELECT 1 FROM HR.Employees)
                BEGIN
                    INSERT INTO HR.Employees (FullName, JobTitle, CompanyName, PhotoUrl, ReportsToId, DepartmentId, DepartmentName, DepartmentColor)
                    VALUES 
                    ('Aravind HR Portal', 'Chief Executive Officer', '5Y HR Portal Solutions', NULL, NULL, 1, 'LEADERSHIP', '#4338CA'),
                    ('Vikhyath HR Portal', 'VP Operations', '5Y HR Portal Solutions', NULL, 1, 2, 'OPERATIONS', '#B45309'),
                    ('Sudhakar HR Portal', 'Technical Director', '5Y HR Portal Solutions', NULL, 2, 3, 'ENGINEERING', '#0F766E'),
                    ('Ajay HR Portal', 'Trainee Developer', '5Y HR Portal Solutions', NULL, 3, 3, 'ENGINEERING', '#0F766E')
                END";
            db.Database.ExecuteSqlRaw(sqlInsert);
        }
    }

    public static void SeedDefaultJiraData(AppDbContext db)
    {
        if (db.JiraProjects.Any()) return; // Already seeded

        var orgProject = new JiraProject { Key = "ORG", Name = "OrgChart Web App" };
        var kekProject = new JiraProject { Key = "KEK", Name = "Keka Pipeline" };
        db.JiraProjects.AddRange(orgProject, kekProject);
        db.SaveChanges();

        var activeSprint = new JiraSprint { Name = "Sprint 2 - Core Integrations", State = "active", BoardId = 1 };
        db.JiraSprints.Add(activeSprint);
        db.SaveChanges();

        var issue1 = new JiraIssue
        {
            Key = "ORG-1",
            Summary = "Implement database schema for Jira boards",
            Status = "Done",
            Assignee = "Sudhakar Somyajula",
            Priority = "High",
            Description = "Create tables for JiraProjects, JiraSprints, and JiraIssues with appropriate foreign keys and indices.",
            ExpectedTime = "8h",
            ActualTime = "8h",
            SprintId = activeSprint.Id,
            ProjectId = orgProject.Id
        };

        var issue2 = new JiraIssue
        {
            Key = "ORG-2",
            Summary = "Develop import controller for Jira sync",
            Status = "In Progress",
            Assignee = "Ajay Mallepogu",
            Priority = "Highest",
            Description = "Fetch data from Jira mock/live API and write it to local SQL Server instance.",
            ExpectedTime = "16h",
            ActualTime = "10h",
            SprintId = activeSprint.Id,
            ProjectId = orgProject.Id
        };

        var issue3 = new JiraIssue
        {
            Key = "ORG-3",
            Summary = "Design premium Kanban board UI",
            Status = "To Do",
            Assignee = "Suhani Drolia",
            Priority = "High",
            Description = "Create the front-end layout with glassmorphic cards, sprint filter, and detail view/edit modal.",
            ExpectedTime = "24h",
            ActualTime = "0h",
            SprintId = activeSprint.Id,
            ProjectId = orgProject.Id
        };

        var issue4 = new JiraIssue
        {
            Key = "KEK-1",
            Summary = "Test connection with Keka Sandbox",
            Status = "Done",
            Assignee = "Hemanth Varma G",
            Priority = "Medium",
            Description = "Verify Keka sandbox API endpoints and ensure connection handles rate limits.",
            ExpectedTime = "4h",
            ActualTime = "4h",
            SprintId = null,
            ProjectId = kekProject.Id
        };

        var issue5 = new JiraIssue
        {
            Key = "KEK-2",
            Summary = "Handle duplicate departments on Keka import",
            Status = "To Do",
            Assignee = "Vikhyath Rai",
            Priority = "Low",
            Description = "Resolve duplicate department names or hierarchy issues dynamically during imports.",
            ExpectedTime = "12h",
            ActualTime = "0h",
            SprintId = null,
            ProjectId = kekProject.Id
        };

        db.JiraIssues.AddRange(issue1, issue2, issue3, issue4, issue5);
        db.SaveChanges();
    }
}
