using System.Security.Claims;
using AnkiX.Api.Contracts.Content;
using AnkiX.Api.Contracts.Study;
using AnkiX.Api.Controllers;
using AnkiX.Api.Data;
using AnkiX.Api.Models;
using AnkiX.Api.Options;
using AnkiX.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AnkiX.Api.Tests;

public class GuestAccessTests
{
    private static ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    private static ControllerContext CreateAnonymousContext()
    {
        var httpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity()) // Unauthenticated
        };
        return new ControllerContext { HttpContext = httpContext };
    }

    [Fact]
    public async Task StudyGroups_GetStudyGroups_AnonymousUserSeesPublicAndPrivate_HidesLocked()
    {
        using var db = CreateInMemoryDbContext();
        db.StudyGroups.AddRange(
            new StudyGroup { Id = 1, Name = "Public Algorithm Group", Slug = "public-algo", Privacy = StudyGroupPrivacy.Public, CreatedByUserId = 1, CreatedAt = DateTime.UtcNow },
            new StudyGroup { Id = 2, Name = "Moderated Private Team", Slug = "private-team", Privacy = StudyGroupPrivacy.Private, CreatedByUserId = 2, CreatedAt = DateTime.UtcNow },
            new StudyGroup { Id = 3, Name = "Secret Locked Team", Slug = "locked-team", Privacy = StudyGroupPrivacy.Locked, CreatedByUserId = 3, CreatedAt = DateTime.UtcNow }
        );
        await db.SaveChangesAsync();

        var controller = new StudyGroupsController(db)
        {
            ControllerContext = CreateAnonymousContext()
        };

        var result = await controller.GetStudyGroups();
        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var groups = Assert.IsAssignableFrom<IEnumerable<StudyGroupResponse>>(okResult.Value).ToList();

        Assert.Equal(2, groups.Count);
        Assert.Contains(groups, g => g.Slug == "public-algo");
        Assert.Contains(groups, g => g.Slug == "private-team");
        Assert.DoesNotContain(groups, g => g.Slug == "locked-team");
    }

    [Fact]
    public async Task StudyGroups_GetStudyGroupBySlug_AnonymousUserCannotAccessLockedGroup()
    {
        using var db = CreateInMemoryDbContext();
        db.StudyGroups.AddRange(
            new StudyGroup { Id = 1, Name = "Public Group", Slug = "public-group", Privacy = StudyGroupPrivacy.Public, CreatedByUserId = 1, CreatedAt = DateTime.UtcNow },
            new StudyGroup { Id = 2, Name = "Private Group", Slug = "private-group", Privacy = StudyGroupPrivacy.Private, CreatedByUserId = 2, CreatedAt = DateTime.UtcNow },
            new StudyGroup { Id = 3, Name = "Locked Group", Slug = "locked-group", Privacy = StudyGroupPrivacy.Locked, CreatedByUserId = 3, CreatedAt = DateTime.UtcNow }
        );
        await db.SaveChangesAsync();

        var controller = new StudyGroupsController(db)
        {
            ControllerContext = CreateAnonymousContext()
        };

        var publicResult = await controller.GetStudyGroupBySlug("public-group");
        Assert.IsType<OkObjectResult>(publicResult.Result);

        var privateResult = await controller.GetStudyGroupBySlug("private-group");
        Assert.IsType<OkObjectResult>(privateResult.Result);

        var lockedResult = await controller.GetStudyGroupBySlug("locked-group");
        Assert.IsType<NotFoundObjectResult>(lockedResult.Result);
    }

    [Fact]
    public async Task Decks_GetDecks_AnonymousUserSeesOnlyPublicGroupDecks()
    {
        using var db = CreateInMemoryDbContext();
        db.StudyGroups.AddRange(
            new StudyGroup { Id = 1, Name = "Public Group", Slug = "public-grp", IsPublic = true, CreatedByUserId = 1, CreatedAt = DateTime.UtcNow },
            new StudyGroup { Id = 2, Name = "Private Group", Slug = "private-grp", IsPublic = false, CreatedByUserId = 2, CreatedAt = DateTime.UtcNow }
        );
        db.Decks.AddRange(
            new Deck { Id = 10, Title = "Public Deck", StudyGroupId = 1, CreatedByUserId = 1, CreatedAt = DateTime.UtcNow },
            new Deck { Id = 20, Title = "Private Deck", StudyGroupId = 2, CreatedByUserId = 2, CreatedAt = DateTime.UtcNow }
        );
        await db.SaveChangesAsync();

        var controller = new DecksController(db)
        {
            ControllerContext = CreateAnonymousContext()
        };

        var result = await controller.GetDecks();
        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var decks = Assert.IsAssignableFrom<IEnumerable<DeckResponse>>(okResult.Value).ToList();

        Assert.Single(decks);
        Assert.Equal(10, decks[0].Id);
        Assert.Equal("Public Deck", decks[0].Title);
    }

    [Fact]
    public async Task Decks_GetCardsByDeck_AnonymousUserCannotAccessPrivateDeckCards()
    {
        using var db = CreateInMemoryDbContext();
        db.StudyGroups.AddRange(
            new StudyGroup { Id = 1, Name = "Public Group", Slug = "public-grp", IsPublic = true, CreatedByUserId = 1, CreatedAt = DateTime.UtcNow },
            new StudyGroup { Id = 2, Name = "Private Group", Slug = "private-grp", IsPublic = false, CreatedByUserId = 2, CreatedAt = DateTime.UtcNow }
        );
        db.Decks.AddRange(
            new Deck { Id = 10, Title = "Public Deck", StudyGroupId = 1, CreatedByUserId = 1, CreatedAt = DateTime.UtcNow },
            new Deck { Id = 20, Title = "Private Deck", StudyGroupId = 2, CreatedByUserId = 2, CreatedAt = DateTime.UtcNow }
        );
        db.Cards.AddRange(
            new Card { Id = 101, DeckId = 10, Prompt = "Public Q", Answer = "A", CreatedAt = DateTime.UtcNow },
            new Card { Id = 201, DeckId = 20, Prompt = "Private Q", Answer = "B", CreatedAt = DateTime.UtcNow }
        );
        await db.SaveChangesAsync();

        var controller = new DecksController(db)
        {
            ControllerContext = CreateAnonymousContext()
        };

        var publicCards = await controller.GetCardsByDeck(10);
        var okResult = Assert.IsType<OkObjectResult>(publicCards.Result);
        var cards = Assert.IsAssignableFrom<IEnumerable<CardResponse>>(okResult.Value).ToList();
        Assert.Single(cards);

        var privateCards = await controller.GetCardsByDeck(20);
        Assert.IsType<NotFoundObjectResult>(privateCards.Result);
    }

    [Fact]
    public async Task Exercises_RunExercise_MultipleChoiceEvaluatesEphemerallyWithoutDbPersistence()
    {
        using var db = CreateInMemoryDbContext();
        db.StudyGroups.Add(new StudyGroup { Id = 1, Name = "Public", Slug = "pub", IsPublic = true, CreatedByUserId = 1, CreatedAt = DateTime.UtcNow });
        db.Exercises.Add(new Exercise
        {
            Id = 50,
            Title = "What is Big-O of binary search?",
            Language = "csharp",
            ExerciseType = "MultipleChoice",
            ExerciseSpec = "{\"options\":[\"O(n)\",\"O(log n)\",\"O(1)\"],\"correctIndex\":1}",
            StudyGroupId = 1,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var options = Microsoft.Extensions.Options.Options.Create(new ExecutionApiOptions());
        var execService = new CodeExecutionService(new HttpClient(), options);
        var schedulerService = new ReviewSchedulerService();
        var controller = new ExercisesController(db, execService, schedulerService)
        {
            ControllerContext = CreateAnonymousContext()
        };

        var runRequest = new CodeRunRequest { SubmittedCode = "1", Language = "csharp" };
        var result = await controller.RunExercise(50, runRequest, CancellationToken.None);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var runResponse = Assert.IsType<CodeRunResponse>(okResult.Value);

        Assert.True(runResponse.Passed);
        Assert.Equal("PASS", runResponse.Result);
        Assert.Equal(0, runResponse.RunId);

        // Verify zero review records were written
        Assert.Equal(0, await db.ExerciseReviewRecords.CountAsync());
    }

    [Fact]
    public async Task Search_AnonymousUser_ExcludesPrivateGroupContent()
    {
        using var db = CreateInMemoryDbContext();
        db.StudyGroups.AddRange(
            new StudyGroup { Id = 1, Name = "Algorithms Public", Slug = "algo-pub", IsPublic = true, CreatedByUserId = 1, CreatedAt = DateTime.UtcNow },
            new StudyGroup { Id = 2, Name = "Classified Private", Slug = "secret", IsPublic = false, CreatedByUserId = 2, CreatedAt = DateTime.UtcNow }
        );
        db.Decks.AddRange(
            new Deck { Id = 10, Title = "Sorting Algorithms", StudyGroupId = 1, CreatedByUserId = 1, CreatedAt = DateTime.UtcNow },
            new Deck { Id = 20, Title = "Sorting Proprietary", StudyGroupId = 2, CreatedByUserId = 2, CreatedAt = DateTime.UtcNow }
        );
        await db.SaveChangesAsync();

        var controller = new SearchController(db)
        {
            ControllerContext = CreateAnonymousContext()
        };

        var result = await controller.Search("Sorting");
        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var searchResponse = Assert.IsType<GlobalSearchResponse>(okResult.Value);

        Assert.Single(searchResponse.Decks);
        Assert.Equal(10, searchResponse.Decks[0].Id);
        Assert.Equal("Sorting Algorithms", searchResponse.Decks[0].Title);
    }
}
