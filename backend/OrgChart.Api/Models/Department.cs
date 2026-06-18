namespace OrgChart.Api.Models;

public class Department
{
    public int Id { get; set; }

    /// <summary>Short label shown as the chip on each card, e.g. "LEADERSHIP", "PROJECT".</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Hex color used to render the department's chip/legend swatch.</summary>
    public string ColorHex { get; set; } = "#4338CA";

    public ICollection<Employee> Employees { get; set; } = new List<Employee>();
}
