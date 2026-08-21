using System.Security.Claims;
using AnkiX.Api.Contracts.Admin;
using AnkiX.Api.Controllers;
using AnkiX.Api.Data;
using AnkiX.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AnkiX.Api.Tests;

public class AdminDashboardControllerTests
{
    private static ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    private static AdminDashboardController CreateDashboardController(ApplicationDbContext db, int userId = 1, string role = Roles.SuperAdmin)
    {
        var controller = new AdminDashboardController(db);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Role, role)
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        var claimsPrincipal = new ClaimsPrincipal(identity);

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = claimsPrincipal }
        };

        return controller;
    }

    private static PresenceController CreatePresenceController(ApplicationDbContext db, int? userId = 1)
    {
        var controller = new PresenceController(db);
        var claims = new List<Claim>();
        if (userId.HasValue)
        {
            claims.Add(new(ClaimTypes.NameIdentifier, userId.Value.ToString()));
            claims.Add(new(ClaimTypes.Role, Roles.User));
        }

        var identity = new ClaimsIdentity(claims, userId.HasValue ? "TestAuth" : null);
        var claimsPrincipal = new ClaimsPrincipal(identity);

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = claimsPrincipal }
        };

        return controller;
    }

    [Fact]
    public async Task GetMetrics_ReturnsAggregatedSummaryCountsAndPresence()
    {
        using var db = CreateInMemoryDbContext();

        // Seed users (1 online, 2 offline)
        db.Users.AddRange(
            new User { Id = 1, Email = "super@test.com", Role = Roles.SuperAdmin, LastActiveAt = DateTime.UtcNow }, // Online
            new User { Id = 2, Email = "admin@test.com", Role = Roles.Admin, LastActiveAt = DateTime.UtcNow.AddMinutes(-10) }, // Offline
            new User { Id = 3, Email = "user@test.com", Role = Roles.User, LastActiveAt = null } // Offline
        );

        // Seed study groups
        db.StudyGroups.AddRange(
            new StudyGroup { Id = 1, Name = "C# Algorithms", Slug = "csharp-algo", CreatedAt = DateTime.UtcNow },
            new StudyGroup { Id = 2, Name = "React Mastery", Slug = "react-mastery", CreatedAt = DateTime.UtcNow.AddMonths(-1) }
        );

        // Seed decks & cards
        db.Decks.Add(new Deck { Id = 1, Title = "Algorithms 101", CreatedAt = DateTime.UtcNow });
        db.Cards.AddRange(
            new Card { Id = 1, DeckId = 1, Prompt = "Card 1", Answer = "Ans 1", Type = "basic" },
            new Card { Id = 2, DeckId = 1, Prompt = "Card 2", Answer = "Ans 2", Type = "basic" }
        );

        // Seed exercises
        db.Exercises.Add(new Exercise { Id = 1, Title = "Two Sum", Language = "csharp", Description = "Easy problem", CreatedAt = DateTime.UtcNow });

        // Seed card reviews & exercise reviews
        db.ReviewRecords.AddRange(
            new ReviewRecord { Id = 1, CardId = 1, UserId = 3, Outcome = "good", EaseFactor = 2.5m, IntervalDays = 1, CreatedAt = DateTime.UtcNow },
            new ReviewRecord { Id = 2, CardId = 2, UserId = 3, Outcome = "easy", EaseFactor = 2.6m, IntervalDays = 3, CreatedAt = DateTime.UtcNow }
        );

        db.ExerciseReviewRecords.Add(
            new ExerciseReviewRecord { Id = 1, ExerciseId = 1, UserId = 3, Outcome = "pass", EaseFactor = 2.5m, IntervalDays = 1, CreatedAt = DateTime.UtcNow }
        );

        await db.SaveChangesAsync();

        var controller = CreateDashboardController(db);
        var result = await controller.GetMetrics();

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<AdminDashboardMetricsResponse>(okResult.Value);

        Assert.Equal(2, response.Summary.TotalStudyGroups);
        Assert.Equal(1, response.Summary.TotalDecks);
        Assert.Equal(2, response.Summary.TotalCards);
        Assert.Equal(1, response.Summary.TotalExercises);
        Assert.Equal(2, response.Summary.TotalCardRuns);
        Assert.Equal(1, response.Summary.TotalExerciseRuns);
        Assert.Equal(3, response.Summary.TotalUsers);
        Assert.Equal(1, response.Summary.OnlineUsers);
        Assert.Equal(2, response.Summary.OfflineUsers);
    }

    [Fact]
    public async Task GetMetrics_ReturnsRoleBreakdown()
    {
        using var db = CreateInMemoryDbContext();

        db.Users.AddRange(
            new User { Id = 1, Email = "super@test.com", Role = Roles.SuperAdmin },
            new User { Id = 2, Email = "admin@test.com", Role = Roles.Admin },
            new User { Id = 3, Email = "contrib@test.com", Role = Roles.Contributor },
            new User { Id = 4, Email = "user1@test.com", Role = Roles.User },
            new User { Id = 5, Email = "user2@test.com", Role = Roles.User }
        );
        await db.SaveChangesAsync();

        var controller = CreateDashboardController(db);
        var result = await controller.GetMetrics();

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<AdminDashboardMetricsResponse>(okResult.Value);

        Assert.Equal(1, response.RolesBreakdown.SuperAdmin);
        Assert.Equal(1, response.RolesBreakdown.Admin);
        Assert.Equal(1, response.RolesBreakdown.Contributor);
        Assert.Equal(2, response.RolesBreakdown.User);
    }

    [Fact]
    public async Task GetMetrics_ReturnsTrendsData()
    {
        using var db = CreateInMemoryDbContext();

        DateTime now = DateTime.UtcNow;
        DateTime lastMonth = now.AddMonths(-1);

        db.Users.Add(new User { Id = 1, Email = "user@test.com", CreatedAt = now });

        db.StudyGroups.AddRange(
            new StudyGroup { Id = 1, Name = "Past Group", Slug = "past-group", CreatedAt = lastMonth },
            new StudyGroup { Id = 2, Name = "Current Group", Slug = "current-group", CreatedAt = now }
        );

        db.ReviewRecords.AddRange(
            new ReviewRecord { Id = 1, CardId = 1, UserId = 1, Outcome = "good", CreatedAt = lastMonth },
            new ReviewRecord { Id = 2, CardId = 1, UserId = 1, Outcome = "good", CreatedAt = now }
        );

        db.ExerciseReviewRecords.Add(
            new ExerciseReviewRecord { Id = 1, ExerciseId = 1, UserId = 1, Outcome = "pass", CreatedAt = now }
        );

        await db.SaveChangesAsync();

        var controller = CreateDashboardController(db);
        var result = await controller.GetMetrics();

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<AdminDashboardMetricsResponse>(okResult.Value);

        Assert.NotEmpty(response.Trends.StudyGroups);
        Assert.NotEmpty(response.Trends.ActivityRuns);
        Assert.NotEmpty(response.Trends.UserRegistrations);
    }

    [Fact]
    public async Task PresenceController_RecordHeartbeat_UpdatesLastActiveAt()
    {
        using var db = CreateInMemoryDbContext();

        var user = new User { Id = 10, Email = "active@test.com", Role = Roles.User, LastActiveAt = null };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var presenceController = CreatePresenceController(db, userId: 10);
        var result = await presenceController.RecordHeartbeat();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var updatedUser = await db.Users.FindAsync(10);

        Assert.NotNull(updatedUser);
        Assert.NotNull(updatedUser.LastActiveAt);
        Assert.True(updatedUser.LastActiveAt >= DateTime.UtcNow.AddMinutes(-1));
    }

    [Fact]
    public async Task PresenceController_RecordHeartbeat_Unauthenticated_ReturnsUnauthorized()
    {
        using var db = CreateInMemoryDbContext();

        var presenceController = CreatePresenceController(db, userId: null);
        var result = await presenceController.RecordHeartbeat();

        Assert.IsType<UnauthorizedObjectResult>(result);
    }
}
