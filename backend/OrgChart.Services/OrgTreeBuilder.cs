using OrgChart.Services.Dtos;
using OrgChart.Domain;

namespace OrgChart.Services;

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
        BreakCycles(allEmployees);
        var roots = allEmployees.Where(e => e.ManagerId is null).ToList();
        return roots.Select(r => MapWithChildren(r, allEmployees)).ToList();
    }

    public List<EmployeeTreeNodeDto> BuildDepartmentTree(List<Employee> allEmployees, int departmentId)
    {
        BreakCycles(allEmployees);
        var inDepartment = allEmployees.Where(e => e.DepartmentId == departmentId).ToList();
        var idsInDepartment = inDepartment.Select(e => e.Id).ToHashSet();

        // A node is a root of this forest if it has no manager at all, or its
        // manager falls outside the department (the chain to the CEO is cut here).
        var roots = inDepartment.Where(e => e.ManagerId is null || !idsInDepartment.Contains(e.ManagerId.Value)).ToList();

        return roots.Select(r => MapWithChildren(r, inDepartment)).ToList();
    }

    private static void BreakCycles(List<Employee> employees)
    {
        var visited = new HashSet<int>();
        var currentPath = new List<int>();

        foreach (var emp in employees)
        {
            if (visited.Contains(emp.Id))
                continue;

            var current = emp;
            currentPath.Clear();
            var pathSet = new HashSet<int>();

            while (current != null)
            {
                if (visited.Contains(current.Id))
                {
                    break;
                }

                if (pathSet.Contains(current.Id))
                {
                    // Found a reporting loop! Break it in memory by setting ManagerId to null.
                    current.ManagerId = null;
                    break;
                }

                pathSet.Add(current.Id);
                currentPath.Add(current.Id);

                current = current.ManagerId.HasValue
                    ? employees.FirstOrDefault(e => e.Id == current.ManagerId.Value)
                    : null;
            }

            foreach (var id in currentPath)
            {
                visited.Add(id);
            }
        }
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
            CardColor = employee.CardColor,
            Children = children,
            TotalReportCount = children.Sum(c => c.TotalReportCount + 1)
        };
    }

}
