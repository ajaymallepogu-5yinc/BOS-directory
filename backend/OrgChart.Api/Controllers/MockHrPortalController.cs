using Microsoft.AspNetCore.Mvc;

namespace OrgChart.Api.Controllers;

[ApiController]
[Route("api/mock-hr-portal")]
public class MockHrPortalController : ControllerBase
{
    [HttpGet("employees")]
    public IActionResult GetMockEmployees([FromQuery] string type = "standard")
    {
        if (type.Equals("keka", StringComparison.OrdinalIgnoreCase))
        {
            object[] kekaEmployees = new object[]
            {
                new
                {
                    id = "kek-001",
                    employeeNumber = "KEK001",
                    displayName = "Aravind Keka CEO",
                    firstName = "Aravind",
                    lastName = "CEO",
                    email = "ceo@keka-mock.com",
                    jobTitle = "Chief Executive Officer",
                    company = "5Y Keka Solutions Ltd",
                    avatarUrl = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
                    department = "Executive Office",
                    departmentColor = "#4338CA",
                    reportsTo = (object?)null
                },
                new
                {
                    id = "kek-002",
                    employeeNumber = "KEK002",
                    displayName = "Vikhyath Keka VP",
                    firstName = "Vikhyath",
                    lastName = "VP",
                    email = "vp@keka-mock.com",
                    jobTitle = "Manager - Operations",
                    company = "5Y Keka Solutions Ltd",
                    avatarUrl = "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
                    department = "Operations & HR",
                    departmentColor = "#BE123C",
                    reportsTo = new { id = "kek-001", firstName = "Aravind", lastName = "CEO" }
                },
                new
                {
                    id = "kek-003",
                    employeeNumber = "KEK003",
                    displayName = "Sudhakar Keka Tech",
                    firstName = "Sudhakar",
                    lastName = "Tech",
                    email = "sudhakar@keka-mock.com",
                    jobTitle = "Technical Director",
                    company = "5Y Keka Solutions Ltd",
                    avatarUrl = (string?)null,
                    department = "Engineering",
                    departmentColor = "#0F766E",
                    reportsTo = new { id = "kek-002", firstName = "Vikhyath", lastName = "VP" }
                },
                new
                {
                    id = "kek-004",
                    employeeNumber = "KEK004",
                    displayName = "Annapurna Keka HR",
                    firstName = "Annapurna",
                    lastName = "HR",
                    email = "annapurna@keka-mock.com",
                    jobTitle = "HR Lead",
                    company = "5Y Keka Solutions Ltd",
                    avatarUrl = (string?)null,
                    department = "Operations & HR",
                    departmentColor = "#BE123C",
                    reportsTo = new { id = "kek-002", firstName = "Vikhyath", lastName = "VP" }
                },
                new
                {
                    id = "kek-005",
                    employeeNumber = "KEK005",
                    displayName = "Priya Keka Lead",
                    firstName = "Priya",
                    lastName = "Lead",
                    email = "priya@keka-mock.com",
                    jobTitle = "Project Lead",
                    company = "5Y Keka Solutions Ltd",
                    avatarUrl = (string?)null,
                    department = "Engineering",
                    departmentColor = "#0F766E",
                    reportsTo = new { id = "kek-003", firstName = "Sudhakar", lastName = "Tech" }
                },
                new
                {
                    id = "kek-006",
                    employeeNumber = "KEK006",
                    displayName = "Meera Keka Dev",
                    firstName = "Meera",
                    lastName = "Dev",
                    email = "meera@keka-mock.com",
                    jobTitle = "Software Engineer",
                    company = "5Y Keka Solutions Ltd",
                    avatarUrl = (string?)null,
                    department = "Engineering",
                    departmentColor = "#0F766E",
                    reportsTo = new { id = "kek-005", firstName = "Priya", lastName = "Lead" }
                },
                new
                {
                    id = "kek-007",
                    employeeNumber = "KEK007",
                    displayName = "Ajay Keka Trainee",
                    firstName = "Ajay",
                    lastName = "Trainee",
                    email = "ajay@keka-mock.com",
                    jobTitle = "Trainee Developer",
                    company = "5Y Keka Solutions Ltd",
                    avatarUrl = (string?)null,
                    department = "Engineering",
                    departmentColor = "#0F766E",
                    reportsTo = new { id = "kek-003", firstName = "Sudhakar", lastName = "Tech" }
                }
            };

            return Ok(new
            {
                succeeded = true,
                message = "Successfully loaded employees from Keka",
                errors = (string[]?)null,
                data = kekaEmployees,
                pageNumber = 1,
                pageSize = 100,
                totalRecords = kekaEmployees.Length
            });
        }
        else
        {
            var standardEmployees = new[]
            {
                new
                {
                    id = 101,
                    fullName = "Aravind API CEO",
                    title = "Chief Executive Officer",
                    company = "5Y API Solutions",
                    avatarUrl = "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150",
                    managerId = (int?)null,
                    departmentId = 1,
                    departmentName = "Leadership & Strategy",
                    departmentColor = "#4338CA"
                },
                new
                {
                    id = 102,
                    fullName = "Vikhyath API VP",
                    title = "VP Operations",
                    company = "5Y API Solutions",
                    avatarUrl = (string?)null,
                    managerId = (int?)101,
                    departmentId = 2,
                    departmentName = "Operations & HR",
                    departmentColor = "#BE123C"
                },
                new
                {
                    id = 103,
                    fullName = "Sudhakar API Tech",
                    title = "Technical Director",
                    company = "5Y API Solutions",
                    avatarUrl = (string?)null,
                    managerId = (int?)102,
                    departmentId = 3,
                    departmentName = "Engineering",
                    departmentColor = "#0F766E"
                },
                new
                {
                    id = 104,
                    fullName = "Ajay API Dev",
                    title = "Software Engineer",
                    company = "5Y API Solutions",
                    avatarUrl = (string?)null,
                    managerId = (int?)103,
                    departmentId = 3,
                    departmentName = "Engineering",
                    departmentColor = "#0F766E"
                }
            };

            return Ok(standardEmployees);
        }
    }
}
