using OrgChart.Api.Dtos;
using OrgChart.Api.Models;

namespace OrgChart.Api.Services;

public interface IOrgTreeBuilder
{
    /// <summary>Full company tree, rooted at whoever has no manager (the CEO).</summary>
    List<EmployeeTreeNodeDto> BuildCompanyTree(List<Employee> allEmployees);

    /// <summary>
    /// Forest scoped to one department: every employee tagged with that
    /// department, keeping the reporting relationships *between* them.
    /// Someone in the department whose manager is in a different
    /// department becomes a root of their own branch in this view.
    /// </summary>
    List<EmployeeTreeNodeDto> BuildDepartmentTree(List<Employee> allEmployees, int departmentId);
}

public class OrgTreeBuilder : IOrgTreeBuilder
{
    public List<EmployeeTreeNodeDto> BuildCompanyTree(List<Employee> allEmployees)
    {
        var roots = allEmployees.Where(e => e.ManagerId is null).ToList();
        return roots.Select(r => MapWithChildren(r, allEmployees)).ToList();
    }

    public List<EmployeeTreeNodeDto> BuildDepartmentTree(List<Employee> allEmployees, int departmentId)
    {
        var inDepartment = allEmployees.Where(e => e.DepartmentId == departmentId).ToList();
        var idsInDepartment = inDepartment.Select(e => e.Id).ToHashSet();

        // A node is a root of this forest if it has no manager at all, or its
        // manager falls outside the department (the chain to the CEO is cut here).
        var roots = inDepartment.Where(e => e.ManagerId is null || !idsInDepartment.Contains(e.ManagerId.Value)).ToList();

        return roots.Select(r => MapWithChildren(r, inDepartment)).ToList();
    }

    private static EmployeeTreeNodeDto MapWithChildren(Employee employee, List<Employee> pool)
    {
        var children = pool.Where(e => e.ManagerId == employee.Id)
            .Select(c => MapWithChildren(c, pool))
            .ToList();

        return new EmployeeTreeNodeDto
        {
            Id = employee.Id,
            FullName = employee.FullName,
            Title = employee.Title,
            Company = employee.Company,
            AvatarUrl = employee.AvatarUrl,
            Department = employee.Department?.Name ?? "",
            DepartmentColor = employee.Department?.ColorHex ?? "#64748B",
            Children = children,
            TotalReportCount = children.Sum(c => c.TotalReportCount + 1)
        };
    }
}
