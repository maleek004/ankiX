using AnkiX.Api.Contracts.Admin;
using AnkiX.Api.Data;
using AnkiX.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AnkiX.Api.Controllers;

[ApiController]
[Authorize(Roles = $"{Roles.SuperAdmin},{Roles.Admin}")]
[Route("api/admin/metrics")]
[Route("api/admin/dashboard")]
public sealed class AdminDashboardController : ControllerBase
{
    private readonly ApplicationDbContext dbContext;

    public AdminDashboardController(ApplicationDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    /// <summary>
    /// Returns aggregated operational metrics, trends, and real-time user presence for Super-Admins.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<AdminDashboardMetricsResponse>> GetMetrics()
    {
        DateTime onlineThreshold = DateTime.UtcNow.AddMinutes(-5);

        // Summary counts
        int totalStudyGroups = await dbContext.StudyGroups.CountAsync();
        int totalDecks = await dbContext.Decks.CountAsync();
        int totalCards = await dbContext.Cards.CountAsync();
        int totalExercises = await dbContext.Exercises.CountAsync();
        long totalCardRuns = await dbContext.ReviewRecords.LongCountAsync();
        long totalExerciseRuns = await dbContext.ExerciseReviewRecords.LongCountAsync();
        int totalUsers = await dbContext.Users.CountAsync();
        int onlineUsers = await dbContext.Users.CountAsync(u => u.LastActiveAt != null && u.LastActiveAt >= onlineThreshold);
        int offlineUsers = Math.Max(0, totalUsers - onlineUsers);

        // Role breakdown
        var roleCounts = await dbContext.Users
            .GroupBy(u => u.Role)
            .Select(g => new { Role = g.Key, Count = g.Count() })
            .ToListAsync();

        var rolesBreakdown = new AdminRolesBreakdownDto
        {
            SuperAdmin = roleCounts.FirstOrDefault(r => string.Equals(r.Role, Roles.SuperAdmin, StringComparison.OrdinalIgnoreCase))?.Count ?? 0,
            Admin = roleCounts.FirstOrDefault(r => string.Equals(r.Role, Roles.Admin, StringComparison.OrdinalIgnoreCase))?.Count ?? 0,
            Contributor = roleCounts.FirstOrDefault(r => string.Equals(r.Role, Roles.Contributor, StringComparison.OrdinalIgnoreCase))?.Count ?? 0,
            User = roleCounts.FirstOrDefault(r => string.Equals(r.Role, Roles.User, StringComparison.OrdinalIgnoreCase))?.Count ?? 0
        };

        // Monthly trends
        // 1. Study Groups
        var groupTrendRaw = await dbContext.StudyGroups
            .GroupBy(g => new { g.CreatedAt.Year, g.CreatedAt.Month })
            .Select(g => new { g.Key.Year, g.Key.Month, Count = g.Count() })
            .ToListAsync();

        var studyGroupTrends = groupTrendRaw
            .OrderBy(g => g.Year).ThenBy(g => g.Month)
            .Select(g => new MetricTrendPointDto
            {
                Period = $"{g.Year:D4}-{g.Month:D2}",
                Count = g.Count
            })
            .ToList();

        // 2. Card Runs by month
        var cardRunTrendRaw = await dbContext.ReviewRecords
            .GroupBy(r => new { r.CreatedAt.Year, r.CreatedAt.Month })
            .Select(g => new { g.Key.Year, g.Key.Month, Count = g.Count() })
            .ToListAsync();

        // 3. Exercise Runs by month
        var exerciseRunTrendRaw = await dbContext.ExerciseReviewRecords
            .GroupBy(r => new { r.CreatedAt.Year, r.CreatedAt.Month })
            .Select(g => new { g.Key.Year, g.Key.Month, Count = g.Count() })
            .ToListAsync();

        // Combine activity runs by period
        var allActivityPeriods = cardRunTrendRaw.Select(r => (r.Year, r.Month))
            .Union(exerciseRunTrendRaw.Select(r => (r.Year, r.Month)))
            .OrderBy(p => p.Year).ThenBy(p => p.Month)
            .ToList();

        var activityRunTrends = allActivityPeriods.Select(p =>
        {
            int cards = cardRunTrendRaw.FirstOrDefault(c => c.Year == p.Year && c.Month == p.Month)?.Count ?? 0;
            int exercises = exerciseRunTrendRaw.FirstOrDefault(e => e.Year == p.Year && e.Month == p.Month)?.Count ?? 0;
            return new ActivityRunTrendPointDto
            {
                Period = $"{p.Year:D4}-{p.Month:D2}",
                CardRuns = cards,
                ExerciseRuns = exercises
            };
        }).ToList();

        // 4. User Signups by month
        var userSignupTrendRaw = await dbContext.Users
            .GroupBy(u => new { u.CreatedAt.Year, u.CreatedAt.Month })
            .Select(g => new { g.Key.Year, g.Key.Month, Count = g.Count() })
            .ToListAsync();

        var userSignupTrends = userSignupTrendRaw
            .OrderBy(u => u.Year).ThenBy(u => u.Month)
            .Select(u => new MetricTrendPointDto
            {
                Period = $"{u.Year:D4}-{u.Month:D2}",
                Count = u.Count
            })
            .ToList();

        var response = new AdminDashboardMetricsResponse
        {
            Summary = new AdminDashboardSummaryDto
            {
                TotalStudyGroups = totalStudyGroups,
                TotalDecks = totalDecks,
                TotalCards = totalCards,
                TotalExercises = totalExercises,
                TotalCardRuns = totalCardRuns,
                TotalExerciseRuns = totalExerciseRuns,
                TotalUsers = totalUsers,
                OnlineUsers = onlineUsers,
                OfflineUsers = offlineUsers
            },
            RolesBreakdown = rolesBreakdown,
            Trends = new AdminDashboardTrendsDto
            {
                StudyGroups = studyGroupTrends,
                ActivityRuns = activityRunTrends,
                UserRegistrations = userSignupTrends
            },
            GeneratedAt = DateTime.UtcNow
        };

        return Ok(response);
    }
}
