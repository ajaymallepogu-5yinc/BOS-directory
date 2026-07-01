using System.Collections.Generic;

namespace OrgChart.Domain;

public class CareerLevel
{
    public int Level { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Requirements { get; set; } = string.Empty;
    public string? ParentTitle { get; set; }
}

public class CareerTrack
{
    public string TrackName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<CareerLevel> Levels { get; set; } = new();
}

public class EmployeeCareerMapping
{
    public int EmployeeId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string TrackName { get; set; } = string.Empty;
    public int CurrentLevel { get; set; }
    public List<CareerLevel> CareerPath { get; set; } = new();
}
