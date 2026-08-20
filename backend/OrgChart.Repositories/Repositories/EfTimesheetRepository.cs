using Microsoft.EntityFrameworkCore;
using OrgChart.Domain;
using OrgChart.Repositories.Data;

namespace OrgChart.Repositories;

public class EfTimesheetRepository
{
    private readonly AppDbContext _db;

    public EfTimesheetRepository(AppDbContext db)
    {
        _db = db;
    }

    public async Task<int> GetLoggedMinutesForDayAsync(int employeeId, DateTime workDate, int? excludeEntryId) =>
        await _db.TimesheetEntries
            .Where(e => !e.IsDeleted && !e.Timesheet.IsDeleted && e.Timesheet.EmployeeId == employeeId && e.Date == workDate && e.Id != excludeEntryId)
            .SumAsync(e => (int?)e.Minutes) ?? 0;

    public Task<TimesheetEntry?> GetEntryWithTimesheetAsync(int entryId) =>
        _db.TimesheetEntries
            .Include(e => e.Timesheet)
            .FirstOrDefaultAsync(e => e.Id == entryId && !e.IsDeleted);

    public Task<TimesheetEntry> GetHydratedEntryAsync(int entryId) =>
        _db.TimesheetEntries
            .Include(e => e.Timesheet).ThenInclude(t => t.Employee)
            .Include(e => e.Project)
            .FirstAsync(e => e.Id == entryId);

    public async Task<TimesheetEntry> AddEntryAsync(TimesheetEntry entry)
    {
        _db.TimesheetEntries.Add(entry);
        await _db.SaveChangesAsync();
        return entry;
    }

    public Task<List<TimesheetEntry>> GetMyEntriesAsync(int employeeId) =>
        _db.TimesheetEntries
            .Where(e => !e.IsDeleted && !e.Timesheet.IsDeleted && e.Timesheet.EmployeeId == employeeId)
            .Include(e => e.Timesheet).ThenInclude(t => t.Employee)
            .Include(e => e.Project)
            .OrderByDescending(e => e.Date)
            .ThenByDescending(e => e.DateCreated)
            .ToListAsync();

    public Task<List<TimesheetEntry>> GetTeamEntriesAsync(List<int> reportIds) =>
        _db.TimesheetEntries
            .Where(e => !e.IsDeleted && !e.Timesheet.IsDeleted && reportIds.Contains(e.Timesheet.EmployeeId) && e.Timesheet.Status != "Draft")
            .Include(e => e.Timesheet).ThenInclude(t => t.Employee)
            .Include(e => e.Project)
            .OrderByDescending(e => e.Date)
            .ThenByDescending(e => e.DateCreated)
            .ToListAsync();

    public Task<Timesheet?> FindTimesheetAsync(int employeeId, DateTime weekStart) =>
        _db.Timesheets.FirstOrDefaultAsync(t => t.EmployeeId == employeeId && t.StartDate == weekStart && !t.IsDeleted);

    public async Task<Timesheet> CreateTimesheetAsync(Timesheet timesheet)
    {
        _db.Timesheets.Add(timesheet);
        await _db.SaveChangesAsync();
        return timesheet;
    }

    public Task<Timesheet?> GetTimesheetWithEntriesAsync(int employeeId, DateTime weekStart) =>
        _db.Timesheets
            .Include(t => t.Entries.Where(e => !e.IsDeleted))
            .FirstOrDefaultAsync(t => t.EmployeeId == employeeId && t.StartDate == weekStart && !t.IsDeleted);

    public Task<Timesheet?> GetTimesheetByIdAsync(int timesheetId) =>
        _db.Timesheets.FirstOrDefaultAsync(t => t.Id == timesheetId && !t.IsDeleted);

    public Task<List<int>> GetReportIdsAsync(int managerId) =>
        _db.OrgReportings
            .Where(o => o.ManagerId == managerId && (o.ReportingType == "Direct" || o.ReportingType == "Functional"))
            .Select(o => o.EmployeeId)
            .Distinct()
            .ToListAsync();

    public Task<bool> IsAuthorizedManagerAsync(int employeeId, int managerId) =>
        _db.OrgReportings.AnyAsync(o =>
            o.EmployeeId == employeeId && o.ManagerId == managerId
            && (o.ReportingType == "Direct" || o.ReportingType == "Functional"));

    public async Task<Dictionary<int, TimesheetReviewLog>> GetLatestReviewsByTimesheetAsync(List<int> timesheetIds)
    {
        var logs = await _db.TimesheetReviewLogs
            .Where(r => !r.IsDeleted && timesheetIds.Contains(r.TimesheetId))
            .Include(r => r.Reviewer)
            .ToListAsync();

        return logs
            .GroupBy(r => r.TimesheetId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(r => r.DateCreated).First());
    }

    public async Task AddReviewLogAsync(TimesheetReviewLog log)
    {
        _db.TimesheetReviewLogs.Add(log);
        await _db.SaveChangesAsync();
    }

    public Task<Employee?> GetEmployeeAsync(int employeeId) =>
        _db.Users.FirstOrDefaultAsync(u => u.Id == employeeId);

    public Task SaveChangesAsync() => _db.SaveChangesAsync();
}
