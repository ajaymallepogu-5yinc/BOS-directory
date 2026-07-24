namespace OrgChart.Domain;

public class Department
{
    public int Id { get; set; }

    /// <summary>Short label shown as the chip on each card, e.g. "LEADERSHIP", "PROJECT".</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Hex color used to render the department's chip/legend swatch.</summary>
    public string ColorHex { get; set; } = "#4338CA";

    public ICollection<EmpDepartment> EmpDepartments { get; set; } = new List<EmpDepartment>();

    public string? CreatedBy { get; set; }
    public DateTime DateCreated { get; set; } = DateTime.UtcNow;
    public string? ModifiedBy { get; set; }
    public DateTime? DateModified { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DateDeleted { get; set; }
}
