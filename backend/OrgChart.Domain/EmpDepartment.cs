namespace OrgChart.Domain;

/// <summary>
/// Junction entity representing many-to-many relationship between Employee (AspNetUsers) and Department.
/// </summary>
public class EmpDepartment
{
    public int EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;

    public int DepartmentId { get; set; }
    public Department Department { get; set; } = null!;
}
