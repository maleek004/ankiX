using System.Security.Claims;
using AnkiX.Api.Controllers;
using AnkiX.Api.Data;
using AnkiX.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AnkiX.Api.Tests;

public class SearchControllerTests
{
    private static ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    private static SearchController CreateController(ApplicationDbContext db, int userId = 1)
    {
        var controller = new SearchController(db);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Role, "Member")
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
    public async Task Search_GlobalSearch_ReturnsOnlyItemsFromJoinedStudyGroups()
    {
        using var db = CreateInMemoryDbContext();

        // Group 1 (User 10 is joined)
        db.StudyGroups.Add(new StudyGroup { Id = 1, Name = "Joined Group", Slug = "joined-group", IsPublic = true });
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 1, UserId = 10, Role = "Member" });
        db.Decks.Add(new Deck { Id = 101, Title = "Joined Group Data Structures", StudyGroupId = 1 });
        db.Cards.Add(new Card { Id = 1001, DeckId = 101, Prompt = "Data Structures Card Prompt", Answer = "Data Structures Answer", Type = "basic" });
        db.Exercises.Add(new Exercise { Id = 501, Title = "Data Structures Coding Exercise", StudyGroupId = 1 });

        // Group 2 (Public group, but User 10 has NOT joined)
        db.StudyGroups.Add(new StudyGroup { Id = 2, Name = "Unjoined Public Group", Slug = "unjoined-public", IsPublic = true });
        db.Decks.Add(new Deck { Id = 102, Title = "Unjoined Public Data Structures Deck", StudyGroupId = 2 });
        db.Cards.Add(new Card { Id = 1002, DeckId = 102, Prompt = "Unjoined Public Data Structures Card Prompt", Answer = "Unjoined Answer", Type = "basic" });
        db.Exercises.Add(new Exercise { Id = 502, Title = "Unjoined Public Data Structures Exercise", StudyGroupId = 2 });

        // Group 3 (Private group, User 10 has NOT joined)
        db.StudyGroups.Add(new StudyGroup { Id = 3, Name = "Unjoined Private Group", Slug = "unjoined-private", IsPublic = false });
        db.Decks.Add(new Deck { Id = 103, Title = "Unjoined Private Data Structures Deck", StudyGroupId = 3 });

        await db.SaveChangesAsync();

        var controller = CreateController(db, userId: 10);

        var actionResult = await controller.Search(q: "Data Structures");
        var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        var response = Assert.IsType<GlobalSearchResponse>(okResult.Value);

        // Decks check
        Assert.Single(response.Decks);
        Assert.Equal(101, response.Decks[0].Id);

        // Cards check
        Assert.Single(response.Cards);
        Assert.Equal(1001, response.Cards[0].Id);

        // Exercises check
        Assert.Single(response.Exercises);
        Assert.Equal(501, response.Exercises[0].Id);
    }

    [Fact]
    public async Task Search_GroupContext_UserIsMember_ReturnsOnlyThatGroupItems()
    {
        using var db = CreateInMemoryDbContext();

        db.StudyGroups.Add(new StudyGroup { Id = 1, Name = "Group 1", Slug = "g1", IsPublic = true });
        db.StudyGroups.Add(new StudyGroup { Id = 2, Name = "Group 2", Slug = "g2", IsPublic = true });

        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 1, UserId = 10, Role = "Member" });
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 2, UserId = 10, Role = "Member" });

        db.Decks.Add(new Deck { Id = 101, Title = "Algorithms Deck G1", StudyGroupId = 1 });
        db.Decks.Add(new Deck { Id = 102, Title = "Algorithms Deck G2", StudyGroupId = 2 });

        await db.SaveChangesAsync();

        var controller = CreateController(db, userId: 10);

        var actionResult = await controller.Search(q: "Algorithms", studyGroupId: 1);
        var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        var response = Assert.IsType<GlobalSearchResponse>(okResult.Value);

        Assert.Single(response.Decks);
        Assert.Equal(101, response.Decks[0].Id);
    }

    [Fact]
    public async Task Search_GroupContext_UserNotMember_ReturnsZeroResults()
    {
        using var db = CreateInMemoryDbContext();

        db.StudyGroups.Add(new StudyGroup { Id = 1, Name = "Group 1", Slug = "g1", IsPublic = true });
        db.StudyGroups.Add(new StudyGroup { Id = 2, Name = "Group 2", Slug = "g2", IsPublic = true });

        // User 10 is only member of Group 1
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 1, UserId = 10, Role = "Member" });

        db.Decks.Add(new Deck { Id = 102, Title = "Algorithms Deck G2", StudyGroupId = 2 });

        await db.SaveChangesAsync();

        var controller = CreateController(db, userId: 10);

        // Search for Group 2 context when user 10 is not a member
        var actionResult = await controller.Search(q: "Algorithms", studyGroupId: 2);
        var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        var response = Assert.IsType<GlobalSearchResponse>(okResult.Value);

        Assert.Empty(response.Decks);
        Assert.Empty(response.Cards);
        Assert.Empty(response.Exercises);
        Assert.Empty(response.Followups);
    }

    [Fact]
    public async Task Search_IsCaseInsensitive_ReturnsMatchesRegardlessOfCasing()
    {
        using var db = CreateInMemoryDbContext();

        db.StudyGroups.Add(new StudyGroup { Id = 1, Name = "Study Group", Slug = "study-group", IsPublic = true });
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 1, UserId = 10, Role = "Member" });

        db.Decks.Add(new Deck { Id = 201, Title = "C# Mastery Deck", Description = "Advanced CONCEPTS", StudyGroupId = 1 });
        db.Cards.Add(new Card { Id = 2001, DeckId = 201, Prompt = "What is Asynchronous Programming?", Answer = "It uses async/AWAIT keywords.", Type = "basic" });
        db.Exercises.Add(new Exercise { Id = 301, Title = "ASYNC Method Exercise", Description = "Write an async task", StudyGroupId = 1, Language = "csharp" });

        await db.SaveChangesAsync();

        var controller = CreateController(db, userId: 10);

        // Lowercase search for uppercase content
        var actionResult = await controller.Search(q: "async", studyGroupId: 1);
        var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        var response = Assert.IsType<GlobalSearchResponse>(okResult.Value);

        Assert.Single(response.Cards);
        Assert.Equal(2001, response.Cards[0].Id);
        Assert.Single(response.Exercises);
        Assert.Equal(301, response.Exercises[0].Id);

        // Uppercase search for mixed case content
        var actionResult2 = await controller.Search(q: "CONCEPTS", studyGroupId: 1);
        var okResult2 = Assert.IsType<OkObjectResult>(actionResult2.Result);
        var response2 = Assert.IsType<GlobalSearchResponse>(okResult2.Value);

        Assert.Single(response2.Decks);
        Assert.Equal(201, response2.Decks[0].Id);
    }
}

