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
        // Intentionally empty — no hardcoded data.
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
        }
    }
}
