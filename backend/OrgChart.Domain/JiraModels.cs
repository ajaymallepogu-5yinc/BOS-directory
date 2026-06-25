using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace OrgChart.Domain;

public class JiraProject
{
    public int Id { get; set; }
    
    [Required, MaxLength(50)]
    public string Key { get; set; } = string.Empty;

    [Required, MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    public ICollection<JiraIssue> Issues { get; set; } = new List<JiraIssue>();
}

public class JiraSprint
{
    public int Id { get; set; }

    [Required, MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    [Required, MaxLength(50)]
    public string State { get; set; } = "future"; // active, future, closed

    public int BoardId { get; set; }

    public ICollection<JiraIssue> Issues { get; set; } = new List<JiraIssue>();
}

public class JiraIssue
{
    public int Id { get; set; }

    [Required, MaxLength(50)]
    public string Key { get; set; } = string.Empty; // e.g. ORG-1

    [Required, MaxLength(250)]
    public string Summary { get; set; } = string.Empty;

    [Required, MaxLength(50)]
    public string Status { get; set; } = "To Do"; // To Do, In Progress, Done

    [Required, MaxLength(100)]
    public string Assignee { get; set; } = string.Empty;

    [Required, MaxLength(50)]
    public string Priority { get; set; } = "Medium"; // Highest, High, Medium, Low, Lowest

    public string Description { get; set; } = string.Empty;

    public int? SprintId { get; set; }
    public JiraSprint? Sprint { get; set; }

    [Required]
    public int ProjectId { get; set; }
    public JiraProject? Project { get; set; }

    [Required, MaxLength(100)]
    public string ExpectedTime { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string ActualTime { get; set; } = string.Empty;
}
