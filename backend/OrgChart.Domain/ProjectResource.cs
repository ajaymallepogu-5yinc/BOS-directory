namespace OrgChart.Domain;

/// <summary>One employee staffed on one project, and whether their hours on it are billable -
/// Project.IsBillable stays as the default a new resource starts from, but this is the actual
/// per-person source of truth once someone's been added here.</summary>
public class ProjectResource
{
    public int Id { get; set; }

    public int ProjectId { get; set; }
    public Project? Project { get; set; }

    public int EmployeeId { get; set; }
    public Employee? Employee { get; set; }

    public bool IsBillable { get; set; }

    public string? CreatedBy { get; set; }
    public DateTime DateCreated { get; set; } = DateTime.UtcNow;
    public string? ModifiedBy { get; set; }
    public DateTime? DateModified { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DateDeleted { get; set; }
}
