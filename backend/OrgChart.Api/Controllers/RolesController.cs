using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrgChart.Domain;
using OrgChart.Repositories.Data;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace OrgChart.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RolesController : ControllerBase
{
    private readonly AppDbContext _context;

    // Define Career Tracks in-memory with parent links to construct trees
    private static readonly List<CareerTrack> Tracks = new()
    {
        new CareerTrack
        {
            TrackName = "Technology",
            Description = "Engineering, QA, Product Design, and IT Administration roles.",
            Levels = new List<CareerLevel>
            {
                new CareerLevel
                {
                    Level = 1,
                    Title = "Associate Developer",
                    Description = "Entry-level developer focused on learning and building features under guidance.",
                    Requirements = "Understanding of coding basics, active participation in team sprint rituals, and eagerness to learn.",
                    ParentTitle = null
                },
                new CareerLevel
                {
                    Level = 2,
                    Title = "Developer",
                    Description = "Independent contributor handling standard backend/frontend features.",
                    Requirements = "1+ years of autonomous delivery, good code review participation, and solid unit test coverage.",
                    ParentTitle = "Associate Developer"
                },
                new CareerLevel
                {
                    Level = 3,
                    Title = "Senior Developer / Specialist",
                    Description = "Technical expert responsible for subsystem design, mentorship, and code quality.",
                    Requirements = "Proven record of subsystem design, mentorship of junior team members, and contribution to development standards.",
                    ParentTitle = "Developer"
                },
                // Technical Path (Branch A)
                new CareerLevel
                {
                    Level = 4,
                    Title = "Lead Engineer",
                    Description = "Technical leader guiding a team, defining architecture, and driving roadmap execution.",
                    Requirements = "Strong project coordination, architecture design, backlog management, and technical mentorship.",
                    ParentTitle = "Senior Developer / Specialist"
                },
                new CareerLevel
                {
                    Level = 5,
                    Title = "Solution Architect",
                    Description = "Strategic technical leader aligning technology choices with business goals.",
                    Requirements = "Company-wide tech impact, vendor selection, organization-wide architecture, and strategic foresight.",
                    ParentTitle = "Lead Engineer"
                },
                // Management Path (Branch B)
                new CareerLevel
                {
                    Level = 4,
                    Title = "Engineering Manager",
                    Description = "People leader focused on team health, delivery execution, and engineering practices.",
                    Requirements = "Experience guiding team sprint deliveries, managing stakeholder communication, and performance reviews.",
                    ParentTitle = "Senior Developer / Specialist"
                },
                new CareerLevel
                {
                    Level = 5,
                    Title = "Director of Engineering",
                    Description = "Organizational leader aligning engineering resources, tech roadmap, and hiring goals.",
                    Requirements = "Demonstrated management of multiple delivery teams, budget planning, and engineering org strategy.",
                    ParentTitle = "Engineering Manager"
                }
            }
        },
        new CareerTrack
        {
            TrackName = "Operations & HR",
            Description = "Human Resources, Cloud Operations, and Office Operations roles.",
            Levels = new List<CareerLevel>
            {
                new CareerLevel
                {
                    Level = 1,
                    Title = "Associate Coordinator",
                    Description = "Assisting with operational processes, support tickets, and scheduling.",
                    Requirements = "Strong communication, basic tool navigation, and responsiveness.",
                    ParentTitle = null
                },
                new CareerLevel
                {
                    Level = 2,
                    Title = "Coordinator",
                    Description = "Managing standard operational pipelines, client requests, or HR admin tasks.",
                    Requirements = "Proven organizational skills, self-directed daily execution, and domain expertise.",
                    ParentTitle = "Associate Coordinator"
                },
                new CareerLevel
                {
                    Level = 3,
                    Title = "Manager",
                    Description = "Overseeing team operations, employee relations, and policy execution.",
                    Requirements = "Leadership experience, process optimization, and conflict resolution skills.",
                    ParentTitle = "Coordinator"
                },
                new CareerLevel
                {
                    Level = 4,
                    Title = "Director of Operations",
                    Description = "Directing strategic resource allocation, cloud operations, and vendor management.",
                    Requirements = "Strategic operational planning, budget oversight, and leadership of multiple operational lines.",
                    ParentTitle = "Manager"
                }
            }
        },
        new CareerTrack
        {
            TrackName = "Product & Project Delivery",
            Description = "Project management, delivery management, and agile coaching.",
            Levels = new List<CareerLevel>
            {
                new CareerLevel
                {
                    Level = 1,
                    Title = "Associate Coordinator",
                    Description = "Supporting project scheduling, tracking task status, and note taking.",
                    Requirements = "Excellent organizational skills and basic project management tool knowledge.",
                    ParentTitle = null
                },
                new CareerLevel
                {
                    Level = 2,
                    Title = "Project Manager",
                    Description = "Managing project scopes, customer communications, and delivery timelines.",
                    Requirements = "1+ years of successful project management, client relationship management, and risk mitigation.",
                    ParentTitle = "Associate Coordinator"
                },
                new CareerLevel
                {
                    Level = 3,
                    Title = "Delivery Lead",
                    Description = "Overseeing overall program delivery, resource allocation, and program management.",
                    Requirements = "Experience managing complex cross-functional programs, agile delivery leadership, and client portfolio management.",
                    ParentTitle = "Project Manager"
                }
            }
        },
        new CareerTrack
        {
            TrackName = "Sales & Marketing",
            Description = "Business development, account management, and strategic marketing consultation.",
            Levels = new List<CareerLevel>
            {
                new CareerLevel
                {
                    Level = 1,
                    Title = "Associate Executive",
                    Description = "Handling initial customer outreach, marketing copy, and sales support.",
                    Requirements = "Active outreach, strong communication, and creative content creation.",
                    ParentTitle = null
                },
                new CareerLevel
                {
                    Level = 2,
                    Title = "Lead Executive",
                    Description = "Driving the sales pipeline, lead generation, and campaign execution.",
                    Requirements = "Proven sales track record, campaign strategy ownership, and deal closure.",
                    ParentTitle = "Associate Executive"
                },
                new CareerLevel
                {
                    Level = 3,
                    Title = "Senior Consultant",
                    Description = "Providing expert strategic consulting on sales, marketing, or financial campaigns.",
                    Requirements = "Extensive consulting background, high-value client advisory, and executive communication.",
                    ParentTitle = "Lead Executive"
                }
            }
        },
        new CareerTrack
        {
            TrackName = "Executive Leadership",
            Description = "Board members and C-Level strategic executives.",
            Levels = new List<CareerLevel>
            {
                new CareerLevel
                {
                    Level = 1,
                    Title = "Executive / CEO",
                    Description = "Setting corporate vision, investor relations, and driving corporate strategy.",
                    Requirements = "Corporate leadership, strategic vision, and executive decision-making.",
                    ParentTitle = null
                }
            }
        }
    };

    public RolesController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("tracks")]
    public ActionResult<List<CareerTrack>> GetTracks()
    {
        return Ok(Tracks);
    }

    [HttpGet("employee/{id}")]
    public async Task<ActionResult<EmployeeCareerMapping>> GetEmployeeCareer(int id)
    {
        var emp = await _context.Employees.FirstOrDefaultAsync(e => e.Id == id);
        if (emp == null)
        {
            return NotFound(new { message = "Employee not found." });
        }

        var trackName = ResolveTrack(emp.Title);
        var track = Tracks.First(t => t.TrackName == trackName);
        var currentLevel = ResolveLevel(emp.Title, track);

        var mapping = new EmployeeCareerMapping
        {
            EmployeeId = emp.Id,
            FullName = emp.FullName,
            Title = emp.Title,
            AvatarUrl = emp.AvatarUrl,
            TrackName = track.TrackName,
            CurrentLevel = currentLevel,
            CareerPath = track.Levels
        };

        return Ok(mapping);
    }

    private static string ResolveTrack(string title)
    {
        var t = title.ToLowerInvariant();

        if (t.Contains("ceo") || t.Contains("chief") || t.Contains("president"))
        {
            return "Executive Leadership";
        }
        if (t.Contains("sales") || t.Contains("marketing") || t.Contains("consultant"))
        {
            return "Sales & Marketing";
        }
        if (t.Contains("delivery") || t.Contains("project manager") || t.Contains("project lead") || t.Contains("pm"))
        {
            return "Product & Project Delivery";
        }
        if (t.Contains("operations") || t.Contains("hr") || t.Contains("human resources"))
        {
            return "Operations & HR";
        }
        
        return "Technology";
    }

    private static int ResolveLevel(string title, CareerTrack track)
    {
        var t = title.ToLowerInvariant();

        if (track.TrackName == "Executive Leadership")
        {
            return 1;
        }

        if (track.TrackName == "Technology")
        {
            if (t.Contains("architect") || t.Contains("head")) return 5; // Solution Architect
            if (t.Contains("director") && t.Contains("engineering")) return 5; // Director of Engineering
            if (t.Contains("lead") || t.Contains("director")) return 4; // Lead Engineer
            if (t.Contains("manager") && t.Contains("engineering")) return 4; // Engineering Manager
            if (t.Contains("qa") || t.Contains("admin") || t.Contains("designer") || t.Contains("console") || t.Contains("specialist")) return 3; // Senior / Specialist
            if (t.Contains("associate") || t.Contains("junior") || t.Contains("support")) return 1; // Associate
            return 2; // Developer
        }

        if (track.TrackName == "Operations & HR")
        {
            if (t.Contains("lead") || t.Contains("director")) return 4;
            if (t.Contains("manager")) return 3;
            if (t.Contains("associate") || t.Contains("assistant")) return 1;
            return 2;
        }

        if (track.TrackName == "Product & Project Delivery")
        {
            if (t.Contains("delivery") || t.Contains("program")) return 3;
            if (t.Contains("manager") || t.Contains("lead") || t.Contains("pm")) return 2;
            return 1;
        }

        if (track.TrackName == "Sales & Marketing")
        {
            if (t.Contains("consultant") || t.Contains("senior")) return 3;
            if (t.Contains("lead") || t.Contains("manager")) return 2;
            return 1;
        }

        return 1;
    }
}
