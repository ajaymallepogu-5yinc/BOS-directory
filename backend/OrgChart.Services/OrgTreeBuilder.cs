using OrgChart.Services.Dtos;
using OrgChart.Domain;

namespace OrgChart.Services;

public interface IOrgTreeBuilder
{
    /// <summary>Full company tree, rooted at whoever has no manager (the CEO).</summary>
    List<EmployeeTreeNodeDto> BuildCompanyTree(List<Employee> allEmployees);

    /// <summary>Functional category tree (Technology -> Platform -> Forge, Cloud, GPT, etc.).</summary>
    List<EmployeeTreeNodeDto> BuildFunctionalCategoryTree(List<Employee> allEmployees);

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
            Children = children,
            TotalReportCount = children.Sum(c => c.TotalReportCount + 1)
        };
    }

    public List<EmployeeTreeNodeDto> BuildFunctionalCategoryTree(List<Employee> all)
    {
        // 1. Group employees by their roles/assignments to map them to functional categories
        var forgeEmployees = all.Where(e => e.Title.Contains("Forge") || e.FullName == "Dave" && e.Title.Contains("Forge Lead")).ToList();
        var cloudEmployees = all.Where(e => e.Title.Contains("Cloud") || e.FullName == "Shree" && e.Title.Contains("Cloud Lead")).ToList();
        var gptEmployees = all.Where(e => e.Title.Contains("GPT")).ToList();
        
        var techEmployees = all.Where(e => e.FullName == "Dave" && e.Title.Contains("Technology Head")).ToList();
        
        // Project Delivery: Baiju, Suman, Priya, Rohit, Meera, Arjun, Kavya
        var projDeliveryEmployees = all.Where(e => 
            e.Department?.Name == "PROJECT DELIVERY" || 
            e.Title.Contains("Project") || 
            e.Title.Contains("Delivery") || 
            e.FullName == "Baiju" || 
            e.FullName == "Suman" || 
            e.FullName == "Priya Nair" || 
            e.FullName == "Rohit Bhatia" || 
            e.FullName == "Meera Kulkarni" || 
            e.FullName == "Arjun Reddy" || 
            e.FullName == "Kavya Iyer"
        ).ToList();

        // Customer Development: Randy, Kalpana, Praveena
        var custDevEmployees = all.Where(e => e.Department?.Name == "CUSTOMER DEVELOPMENT" || e.Title.Contains("Customer") || e.FullName == "Randy" || e.FullName == "Kalpana" || e.FullName == "Praveena").ToList();

        // Operations: Shree, Vikhyath, Gautham, Venkat, plus IT Admin, UI/UX, HR
        var opsEmployees = all.Where(e => 
            e.Department?.Name == "OPERATIONS" || 
            e.Department?.Name == "GENERAL ADMIN" ||
            e.FullName == "Shree" || 
            e.FullName == "Vikhyath Rai" || 
            e.FullName == "Gautham" || 
            e.FullName == "Venkat" ||
            e.FullName == "Hemanth Varma G" ||
            e.FullName == "Suhani Drolia" ||
            e.FullName == "Annapurna Y V L"
        ).ToList();

        // 2. Build the category nodes:
        
        // Platform sub-categories
        var forgeNode = CreateCategoryNode(-105, "Forge", "Platform Sub-division", "#10B981", MapEmployeesHierarchical(forgeEmployees));
        var cloudNode = CreateCategoryNode(-106, "Cloud", "Platform Sub-division", "#10B981", MapEmployeesHierarchical(cloudEmployees));
        var gptNode = CreateCategoryNode(-107, "GPT", "Platform Sub-division", "#10B981", MapEmployeesHierarchical(gptEmployees));
        
        var platformNode = CreateCategoryNode(-102, "Platform", "Technology Division", "#10B981", new List<EmployeeTreeNodeDto> { forgeNode, cloudNode, gptNode });
        var projDeliveryNode = CreateCategoryNode(-103, "Project Delivery", "Technology Division", "#8B5CF6", MapEmployeesHierarchical(projDeliveryEmployees));

        // Root Categories
        var techNode = CreateCategoryNode(-101, "Technology", "Functional Department", "#10B981", new List<EmployeeTreeNodeDto> { platformNode, projDeliveryNode });
        techNode.Children.AddRange(MapEmployeesHierarchical(techEmployees));

        var custDevNode = CreateCategoryNode(-108, "Customer Development", "Functional Department", "#EC4899", MapEmployeesHierarchical(custDevEmployees));
        var opsNode = CreateCategoryNode(-109, "Operations", "Functional Department", "#6366F1", MapEmployeesHierarchical(opsEmployees));

        // Return the root functional divisions
        return new List<EmployeeTreeNodeDto> { techNode, custDevNode, opsNode };
    }

    private static EmployeeTreeNodeDto CreateCategoryNode(int id, string name, string title, string colorHex, List<EmployeeTreeNodeDto> children)
    {
        return new EmployeeTreeNodeDto
        {
            Id = id,
            FullName = name,
            Title = title,
            Company = "BOS Framework",
            AvatarUrl = null,
            Department = name,
            DepartmentColor = colorHex,
            Children = children,
            TotalReportCount = children.Sum(c => c.TotalReportCount + 1)
        };
    }

    private static List<EmployeeTreeNodeDto> MapEmployeesHierarchical(List<Employee> pool)
    {
        var ids = pool.Select(e => e.Id).ToHashSet();
        // A node is a root within this pool if its manager is not in this specific pool
        var roots = pool.Where(e => e.ManagerId == null || !ids.Contains(e.ManagerId.Value)).ToList();
        return roots.Select(r => MapWithChildrenInPool(r, pool)).ToList();
    }

    private static EmployeeTreeNodeDto MapWithChildrenInPool(Employee employee, List<Employee> pool)
    {
        var children = pool.Where(e => e.ManagerId == employee.Id)
            .Select(c => MapWithChildrenInPool(c, pool))
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
