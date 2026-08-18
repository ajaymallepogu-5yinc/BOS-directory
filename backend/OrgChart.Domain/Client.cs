namespace OrgChart.Domain;

/// <summary>The company/customer a project is done for - lets projects group by who they're
/// actually for, distinct from Project.IsBillable (which only says whether the work is billed
/// at all, not to whom).</summary>
public class Client
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;

    public ICollection<Project> Projects { get; set; } = new List<Project>();

    public string? CreatedBy { get; set; }
    public DateTime DateCreated { get; set; } = DateTime.UtcNow;
    public string? ModifiedBy { get; set; }
    public DateTime? DateModified { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DateDeleted { get; set; }
}
