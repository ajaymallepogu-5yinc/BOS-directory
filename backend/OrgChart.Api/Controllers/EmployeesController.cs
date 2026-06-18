using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrgChart.Api.Data;
using OrgChart.Api.Dtos;
using OrgChart.Api.Models;
using OrgChart.Api.Repositories;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace OrgChart.Api.Controllers;

[ApiController]
[Route("api/employees")]
public class EmployeesController : ControllerBase
{
    private readonly IEmployeeRepository _employees;
    private readonly AppDbContext _db;

    public EmployeesController(IEmployeeRepository employees, AppDbContext db)
    {
        _employees = employees;
        _db = db;
    }

    /// <summary>GET /api/employees - flat list for the admin table.</summary>
    [HttpGet]
    public async Task<ActionResult<List<EmployeeDto>>> GetAll()
    {
        var all = await _employees.GetAllAsync();
        var lookup = all.ToDictionary(e => e.Id, e => e.FullName);

        var result = all.Select(e => new EmployeeDto
        {
            Id = e.Id,
            FullName = e.FullName,
            Title = e.Title,
            Company = e.Company,
            AvatarUrl = e.AvatarUrl,
            ManagerId = e.ManagerId,
            ManagerName = e.ManagerId.HasValue && lookup.TryGetValue(e.ManagerId.Value, out var name) ? name : null,
            DepartmentId = e.DepartmentId,
            Department = e.Department?.Name ?? ""
        }).ToList();

        return Ok(result);
    }

    /// <summary>GET /api/employees/managers - lightweight list for the "Reports to" dropdown.</summary>
    [HttpGet("managers")]
    public async Task<ActionResult<List<ManagerOptionDto>>> GetManagerOptions()
    {
        var all = await _employees.GetAllAsync();
        return Ok(all.Select(e => new ManagerOptionDto { Id = e.Id, FullName = e.FullName, Title = e.Title }).ToList());
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<EmployeeDto>> GetById(int id)
    {
        var e = await _employees.GetByIdAsync(id);
        if (e is null) return NotFound();

        return Ok(new EmployeeDto
        {
            Id = e.Id,
            FullName = e.FullName,
            Title = e.Title,
            Company = e.Company,
            AvatarUrl = e.AvatarUrl,
            ManagerId = e.ManagerId,
            DepartmentId = e.DepartmentId,
            Department = e.Department?.Name ?? ""
        });
    }

    [HttpPost]
    public async Task<ActionResult<EmployeeDto>> Create(CreateEmployeeDto dto)
    {
        if (!_employees.SupportsWrites)
            return Conflict("Employees are sourced from the HR portal in this environment. Add the employee there instead.");

        var entity = new Employee
        {
            FullName = dto.FullName,
            Title = dto.Title,
            Company = dto.Company,
            AvatarUrl = dto.AvatarUrl,
            ManagerId = dto.ManagerId,
            DepartmentId = dto.DepartmentId
        };

        var created = await _employees.AddAsync(entity);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UpdateEmployeeDto dto)
    {
        if (!_employees.SupportsWrites)
            return Conflict("Employees are sourced from the HR portal in this environment. Edit the employee there instead.");

        if (dto.ManagerId == id)
            return BadRequest("An employee cannot report to themselves.");

        var entity = new Employee
        {
            FullName = dto.FullName,
            Title = dto.Title,
            Company = dto.Company,
            AvatarUrl = dto.AvatarUrl,
            ManagerId = dto.ManagerId,
            DepartmentId = dto.DepartmentId
        };

        var updated = await _employees.UpdateAsync(id, entity);
        if (updated is null) return NotFound();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (!_employees.SupportsWrites)
            return Conflict("Employees are sourced from the HR portal in this environment. Remove the employee there instead.");

        var ok = await _employees.DeleteAsync(id);
        if (!ok) return NotFound();
        return NoContent();
    }

    [HttpPost("import-bulk")]
    public async Task<ActionResult<BulkImportResultDto>> ImportBulk([FromBody] BulkImportDto dto)
    {
        if (dto == null || dto.Employees == null || dto.Employees.Count == 0)
        {
            return BadRequest(new BulkImportResultDto { Success = false, Message = "No employee records provided." });
        }

        try
        {
            // Clear existing employees and departments
            var existingEmployees = await _db.Employees.ToListAsync();
            _db.Employees.RemoveRange(existingEmployees);
            await _db.SaveChangesAsync();

            var existingDepartments = await _db.Departments.ToListAsync();
            _db.Departments.RemoveRange(existingDepartments);
            await _db.SaveChangesAsync();

            var departmentCache = new Dictionary<string, Department>(StringComparer.OrdinalIgnoreCase);
            
            // Loop 1: Add departments first
            foreach (var item in dto.Employees)
            {
                var deptName = string.IsNullOrWhiteSpace(item.DepartmentName) ? "Default" : item.DepartmentName;
                var deptColor = string.IsNullOrWhiteSpace(item.DepartmentColor) ? "#64748B" : item.DepartmentColor;

                if (!departmentCache.TryGetValue(deptName, out var deptEntity))
                {
                    deptEntity = new Department
                    {
                        Name = deptName,
                        ColorHex = deptColor
                    };
                    _db.Departments.Add(deptEntity);
                    departmentCache[deptName] = deptEntity;
                }
            }
            await _db.SaveChangesAsync();

            // Loop 2: Add employees (without setting ManagerId yet)
            var stringIdToEmployeeMap = new Dictionary<string, Employee>(StringComparer.OrdinalIgnoreCase);
            
            foreach (var item in dto.Employees)
            {
                var deptName = string.IsNullOrWhiteSpace(item.DepartmentName) ? "Default" : item.DepartmentName;
                var deptEntity = departmentCache[deptName];

                var empEntity = new Employee
                {
                    FullName = item.FullName,
                    Title = item.Title,
                    Company = item.Company,
                    AvatarUrl = item.AvatarUrl,
                    DepartmentId = deptEntity.Id
                };

                _db.Employees.Add(empEntity);
                stringIdToEmployeeMap[item.Id] = empEntity;
            }
            await _db.SaveChangesAsync();

            // Loop 3: Resolve Manager relationships using original string IDs or Full Names
            var fullNameToEmployeeMap = new Dictionary<string, Employee>(StringComparer.OrdinalIgnoreCase);
            foreach (var emp in stringIdToEmployeeMap.Values)
            {
                fullNameToEmployeeMap[emp.FullName] = emp;
            }

            foreach (var item in dto.Employees)
            {
                if (!string.IsNullOrWhiteSpace(item.ManagerId))
                {
                    if (stringIdToEmployeeMap.TryGetValue(item.Id, out var employeeEntity))
                    {
                        if (stringIdToEmployeeMap.TryGetValue(item.ManagerId, out var managerEntity))
                        {
                            employeeEntity.ManagerId = managerEntity.Id;
                        }
                        else if (fullNameToEmployeeMap.TryGetValue(item.ManagerId, out var managerByName))
                        {
                            employeeEntity.ManagerId = managerByName.Id;
                        }
                    }
                }
            }
            await _db.SaveChangesAsync();

            return Ok(new BulkImportResultDto
            {
                Success = true,
                Message = $"Successfully imported {dto.Employees.Count} employees and {departmentCache.Count} departments from your CSV directory!",
                ImportedCount = dto.Employees.Count
            });
        }
        catch (Exception ex)
        {
            return Ok(new BulkImportResultDto
            {
                Success = false,
                Message = $"Bulk import failed: {ex.Message}"
            });
        }
    }
}
