using System.Security.Claims;
using AnkiX.Api.Contracts.Content;
using AnkiX.Api.Controllers;
using AnkiX.Api.Data;
using AnkiX.Api.Models;
using AnkiX.Api.Options;
using AnkiX.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AnkiX.Api.Tests;

public class CopyContentTests
{
    private static ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    private static ContentController CreateContentController(ApplicationDbContext db, int userId = 1, string role = "User")
    {
        var controller = new ContentController(db);
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

    private static ExercisesController CreateExercisesController(ApplicationDbContext db, int userId = 1, string role = "User")
    {
        var options = Microsoft.Extensions.Options.Options.Create(new ExecutionApiOptions());
        var execService = new CodeExecutionService(new HttpClient(), options);
        var schedulerService = new ReviewSchedulerService();
        var controller = new ExercisesController(db, execService, schedulerService);
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

    [Fact]
    public async Task CopyCard_MemberSource_ContributorTarget_Success()
    {
        using var db = CreateInMemoryDbContext();
        int userId = 10;

        // Setup Source Group (Private) & Deck & Card
        var sourceGroup = new StudyGroup { Id = 1, Name = "Source Group", Slug = "source", IsPublic = false };
        var sourceDeck = new Deck { Id = 100, Title = "Source Deck", StudyGroupId = 1 };
        var sourceCard = new Card { Id = 1000, DeckId = 100, Type = "basic", Prompt = "Source Question", Answer = "Answer" };

        // Setup Target Group (Private) & Target Deck
        var targetGroup = new StudyGroup { Id = 2, Name = "Target Group", Slug = "target", IsPublic = false };
        var targetDeck = new Deck { Id = 200, Title = "Target Deck", StudyGroupId = 2 };

        db.StudyGroups.AddRange(sourceGroup, targetGroup);
        db.Decks.AddRange(sourceDeck, targetDeck);
        db.Cards.Add(sourceCard);

        // User is Member in source, Contributor in target
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 1, UserId = userId, Role = StudyGroupRoles.Member });
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 2, UserId = userId, Role = StudyGroupRoles.Contributor });
        await db.SaveChangesAsync();

        var controller = CreateContentController(db, userId: userId, role: "User");

        var result = await controller.CopyCard(new CopyCardRequest
        {
            SourceCardId = 1000,
            TargetDeckId = 200
        });

        var createdResult = Assert.IsType<CreatedAtActionResult>(result.Result);
        var response = Assert.IsType<CardResponse>(createdResult.Value);
        Assert.Equal(200, response.DeckId);
        Assert.Equal("basic", response.Type);
        Assert.Equal("Source Question", response.Prompt);

        // Assert DB state
        var cardInDb = await db.Cards.FirstOrDefaultAsync(c => c.Id == response.Id);
        Assert.NotNull(cardInDb);
        Assert.Equal(200, cardInDb.DeckId);
    }

    [Fact]
    public async Task CopyCard_NonMemberSource_ReturnsForbid()
    {
        using var db = CreateInMemoryDbContext();
        int userId = 10;

        var sourceGroup = new StudyGroup { Id = 1, Name = "Private Source", Slug = "source", IsPublic = false };
        var sourceDeck = new Deck { Id = 100, Title = "Source Deck", StudyGroupId = 1 };
        var sourceCard = new Card { Id = 1000, DeckId = 100, Type = "basic", Prompt = "Secret Question" };

        var targetGroup = new StudyGroup { Id = 2, Name = "Target Group", Slug = "target", IsPublic = false };
        var targetDeck = new Deck { Id = 200, Title = "Target Deck", StudyGroupId = 2 };

        db.StudyGroups.AddRange(sourceGroup, targetGroup);
        db.Decks.AddRange(sourceDeck, targetDeck);
        db.Cards.Add(sourceCard);

        // User is ONLY in target group as Contributor, NOT in source group
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 2, UserId = userId, Role = StudyGroupRoles.Contributor });
        await db.SaveChangesAsync();

        var controller = CreateContentController(db, userId: userId, role: "User");

        var result = await controller.CopyCard(new CopyCardRequest
        {
            SourceCardId = 1000,
            TargetDeckId = 200
        });

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task CopyCard_NonContributorTarget_ReturnsForbid()
    {
        using var db = CreateInMemoryDbContext();
        int userId = 10;

        var sourceGroup = new StudyGroup { Id = 1, Name = "Public Source", Slug = "source", IsPublic = true };
        var sourceDeck = new Deck { Id = 100, Title = "Source Deck", StudyGroupId = 1 };
        var sourceCard = new Card { Id = 1000, DeckId = 100, Type = "basic", Prompt = "Public Question" };

        var targetGroup = new StudyGroup { Id = 2, Name = "Target Group", Slug = "target", IsPublic = true };
        var targetDeck = new Deck { Id = 200, Title = "Target Deck", StudyGroupId = 2 };

        db.StudyGroups.AddRange(sourceGroup, targetGroup);
        db.Decks.AddRange(sourceDeck, targetDeck);
        db.Cards.Add(sourceCard);

        // User is only a Member in target group
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 2, UserId = userId, Role = StudyGroupRoles.Member });
        await db.SaveChangesAsync();

        var controller = CreateContentController(db, userId: userId, role: "User");

        var result = await controller.CopyCard(new CopyCardRequest
        {
            SourceCardId = 1000,
            TargetDeckId = 200
        });

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task CopyExercise_MemberSource_ContributorTarget_Success()
    {
        using var db = CreateInMemoryDbContext();
        int userId = 15;

        var sourceGroup = new StudyGroup { Id = 10, Name = "Source Group", Slug = "source10", IsPublic = false };
        var targetGroup = new StudyGroup { Id = 20, Name = "Target Group", Slug = "target20", IsPublic = false };

        var exercise = new Exercise
        {
            Id = 500,
            Title = "Algorithm Exercise",
            Language = "python",
            StudyGroupId = 10
        };

        db.StudyGroups.AddRange(sourceGroup, targetGroup);
        db.Exercises.Add(exercise);

        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 10, UserId = userId, Role = StudyGroupRoles.Member });
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 20, UserId = userId, Role = StudyGroupRoles.Contributor });
        await db.SaveChangesAsync();

        var controller = CreateExercisesController(db, userId: userId, role: "User");

        var result = await controller.CopyExercise(new CopyExerciseRequest
        {
            SourceExerciseId = 500,
            TargetStudyGroupId = 20
        });

        var createdResult = Assert.IsType<CreatedAtActionResult>(result.Result);
        var response = Assert.IsType<ExerciseDetailResponse>(createdResult.Value);
        Assert.Equal("Algorithm Exercise", response.Title);
        Assert.Equal("python", response.Language);

        var copyInDb = await db.Exercises.FirstOrDefaultAsync(e => e.Id == response.Id);
        Assert.NotNull(copyInDb);
        Assert.Equal(20, copyInDb.StudyGroupId);
        Assert.Equal(userId, copyInDb.CreatedByUserId);
    }
}
