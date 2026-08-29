using System.Security.Claims;
using AnkiX.Api.Contracts.Content;
using AnkiX.Api.Contracts.Study;
using AnkiX.Api.Controllers;
using AnkiX.Api.Data;
using AnkiX.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

namespace AnkiX.Api.Tests;

public class CardGhostingTests
{
    private static ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new ApplicationDbContext(options);
    }

    private static ContentController CreateContentController(ApplicationDbContext db, int? userId = 1, string role = Roles.User)
    {
        var controller = new ContentController(db);
        if (userId.HasValue)
        {
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, userId.Value.ToString()),
                new(ClaimTypes.Role, role)
            };
            var identity = new ClaimsIdentity(claims, "TestAuth");
            var claimsPrincipal = new ClaimsPrincipal(identity);

            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = claimsPrincipal }
            };
        }
        else
        {
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity()) }
            };
        }

        return controller;
    }

    private static StudyQueueController CreateStudyQueueController(ApplicationDbContext db, int? userId = 1)
    {
        var controller = new StudyQueueController(db);
        if (userId.HasValue)
        {
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, userId.Value.ToString()),
                new(ClaimTypes.Role, Roles.User)
            };
            var identity = new ClaimsIdentity(claims, "TestAuth");
            var claimsPrincipal = new ClaimsPrincipal(identity);

            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = claimsPrincipal }
            };
        }
        else
        {
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity()) }
            };
        }

        return controller;
    }

    private static DecksController CreateDecksController(ApplicationDbContext db, int? userId = 1)
    {
        var controller = new DecksController(db);
        if (userId.HasValue)
        {
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, userId.Value.ToString()),
                new(ClaimTypes.Role, Roles.User)
            };
            var identity = new ClaimsIdentity(claims, "TestAuth");
            var claimsPrincipal = new ClaimsPrincipal(identity);

            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = claimsPrincipal }
            };
        }
        else
        {
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity()) }
            };
        }

        return controller;
    }

    [Fact]
    public async Task GhostCard_AuthenticatedUser_PersistsGhostRecord()
    {
        using var db = CreateInMemoryDbContext();
        var card = new Card { Id = 101, DeckId = 1, Prompt = "Q1", Answer = "A1" };
        db.Cards.Add(card);
        await db.SaveChangesAsync();

        var controller = CreateContentController(db, userId: 42);
        var actionResult = await controller.GhostCard(101);

        var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        var response = Assert.IsType<GhostCardStatusResponse>(okResult.Value);

        Assert.Equal(101, response.CardId);
        Assert.True(response.IsGhosted);

        bool existsInDb = await db.UserGhostedCards.AnyAsync(g => g.UserId == 42 && g.CardId == 101);
        Assert.True(existsInDb);
    }

    [Fact]
    public async Task GhostCard_Idempotent_Returns200()
    {
        using var db = CreateInMemoryDbContext();
        var card = new Card { Id = 101, DeckId = 1, Prompt = "Q1", Answer = "A1" };
        db.Cards.Add(card);
        db.UserGhostedCards.Add(new UserGhostedCard { UserId = 42, CardId = 101 });
        await db.SaveChangesAsync();

        var controller = CreateContentController(db, userId: 42);
        var actionResult = await controller.GhostCard(101);

        var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        var response = Assert.IsType<GhostCardStatusResponse>(okResult.Value);

        Assert.True(response.IsGhosted);
        Assert.Equal(1, await db.UserGhostedCards.CountAsync(g => g.UserId == 42 && g.CardId == 101));
    }

    [Fact]
    public async Task GhostCard_NonExistentCard_ReturnsNotFound()
    {
        using var db = CreateInMemoryDbContext();
        var controller = CreateContentController(db, userId: 42);
        var actionResult = await controller.GhostCard(999);

        Assert.IsType<NotFoundObjectResult>(actionResult.Result);
    }

    [Fact]
    public async Task GhostCard_Unauthenticated_ReturnsUnauthorized()
    {
        using var db = CreateInMemoryDbContext();
        var controller = CreateContentController(db, userId: null);
        var actionResult = await controller.GhostCard(101);

        Assert.IsType<UnauthorizedObjectResult>(actionResult.Result);
    }

    [Fact]
    public async Task UnghostCard_AuthenticatedUser_RemovesGhostRecord()
    {
        using var db = CreateInMemoryDbContext();
        var card = new Card { Id = 101, DeckId = 1, Prompt = "Q1", Answer = "A1" };
        db.Cards.Add(card);
        db.UserGhostedCards.Add(new UserGhostedCard { UserId = 42, CardId = 101 });
        await db.SaveChangesAsync();

        var controller = CreateContentController(db, userId: 42);
        var actionResult = await controller.UnghostCard(101);

        var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        var response = Assert.IsType<GhostCardStatusResponse>(okResult.Value);

        Assert.Equal(101, response.CardId);
        Assert.False(response.IsGhosted);

        bool existsInDb = await db.UserGhostedCards.AnyAsync(g => g.UserId == 42 && g.CardId == 101);
        Assert.False(existsInDb);
    }

    [Fact]
    public async Task UnghostCard_WhenNotGhosted_Returns200()
    {
        using var db = CreateInMemoryDbContext();
        var card = new Card { Id = 101, DeckId = 1, Prompt = "Q1", Answer = "A1" };
        db.Cards.Add(card);
        await db.SaveChangesAsync();

        var controller = CreateContentController(db, userId: 42);
        var actionResult = await controller.UnghostCard(101);

        var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        var response = Assert.IsType<GhostCardStatusResponse>(okResult.Value);

        Assert.False(response.IsGhosted);
    }

    [Fact]
    public async Task GetStudyQueue_ExcludesGhostedCards_ForGhostingUserOnly()
    {
        using var db = CreateInMemoryDbContext();
        var deck = new Deck { Id = 1, Title = "Algorithms Deck" };
        var card1 = new Card { Id = 101, DeckId = 1, Prompt = "Q1", Answer = "A1" };
        var card2 = new Card { Id = 102, DeckId = 1, Prompt = "Q2", Answer = "A2" };
        var card3 = new Card { Id = 103, DeckId = 1, Prompt = "Q3", Answer = "A3" };

        db.Decks.Add(deck);
        db.Cards.AddRange(card1, card2, card3);

        // User 1 ghosts Card 102
        db.UserGhostedCards.Add(new UserGhostedCard { UserId = 1, CardId = 102 });
        await db.SaveChangesAsync();

        // User 1 study queue (should exclude Card 102)
        var user1QueueController = CreateStudyQueueController(db, userId: 1);
        var user1Result = await user1QueueController.GetStudyQueue(1);
        var user1Ok = Assert.IsType<OkObjectResult>(user1Result.Result);
        var user1Queue = Assert.IsType<StudyQueueResponse>(user1Ok.Value);

        Assert.Equal(2, user1Queue.NewCount);
        Assert.Equal(2, user1Queue.DueCards.Count);
        Assert.DoesNotContain(user1Queue.DueCards, c => c.Id == 102);
        Assert.Contains(user1Queue.DueCards, c => c.Id == 101);
        Assert.Contains(user1Queue.DueCards, c => c.Id == 103);

        // User 2 study queue (should include all 3 cards)
        var user2QueueController = CreateStudyQueueController(db, userId: 2);
        var user2Result = await user2QueueController.GetStudyQueue(1);
        var user2Ok = Assert.IsType<OkObjectResult>(user2Result.Result);
        var user2Queue = Assert.IsType<StudyQueueResponse>(user2Ok.Value);

        Assert.Equal(3, user2Queue.NewCount);
        Assert.Equal(3, user2Queue.DueCards.Count);
        Assert.Contains(user2Queue.DueCards, c => c.Id == 102);
    }

    [Fact]
    public async Task GetGhostedCardsByDeck_ReturnsOnlyUserGhostedCardsForDeck()
    {
        using var db = CreateInMemoryDbContext();
        var deck1 = new Deck { Id = 1, Title = "Deck 1" };
        var deck2 = new Deck { Id = 2, Title = "Deck 2" };
        var card1 = new Card { Id = 101, DeckId = 1, Prompt = "Q1", Answer = "A1" };
        var card2 = new Card { Id = 102, DeckId = 1, Prompt = "Q2", Answer = "A2" };
        var card3 = new Card { Id = 103, DeckId = 2, Prompt = "Q3", Answer = "A3" };

        db.Decks.AddRange(deck1, deck2);
        db.Cards.AddRange(card1, card2, card3);

        // User 1 ghosts Card 101 (in Deck 1) and Card 103 (in Deck 2)
        db.UserGhostedCards.Add(new UserGhostedCard { UserId = 1, CardId = 101 });
        db.UserGhostedCards.Add(new UserGhostedCard { UserId = 1, CardId = 103 });

        // User 2 ghosts Card 102 (in Deck 1)
        db.UserGhostedCards.Add(new UserGhostedCard { UserId = 2, CardId = 102 });

        await db.SaveChangesAsync();

        var decksController = CreateDecksController(db, userId: 1);
        var result = await decksController.GetGhostedCardsByDeck(1);
        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var ghostedList = Assert.IsAssignableFrom<IEnumerable<CardResponse>>(okResult.Value).ToList();

        Assert.Single(ghostedList);
        Assert.Equal(101, ghostedList[0].Id);
        Assert.True(ghostedList[0].IsGhosted);
    }

    [Fact]
    public async Task GetCard_ReturnsIsGhostedTrue_WhenGhostedByCaller()
    {
        using var db = CreateInMemoryDbContext();
        var deck = new Deck { Id = 1, Title = "Deck" };
        var card = new Card { Id = 101, DeckId = 1, Prompt = "Q1", Answer = "A1" };
        db.Decks.Add(deck);
        db.Cards.Add(card);
        db.UserGhostedCards.Add(new UserGhostedCard { UserId = 1, CardId = 101 });
        await db.SaveChangesAsync();

        var user1Controller = CreateContentController(db, userId: 1);
        var user1Result = await user1Controller.GetCard(101);
        var user1Ok = Assert.IsType<OkObjectResult>(user1Result.Result);
        var user1Card = Assert.IsType<CardResponse>(user1Ok.Value);
        Assert.True(user1Card.IsGhosted);

        var user2Controller = CreateContentController(db, userId: 2);
        var user2Result = await user2Controller.GetCard(101);
        var user2Ok = Assert.IsType<OkObjectResult>(user2Result.Result);
        var user2Card = Assert.IsType<CardResponse>(user2Ok.Value);
        Assert.False(user2Card.IsGhosted);
    }

    [Fact]
    public async Task DeleteCard_CleansUpGhostRecords()
    {
        using var db = CreateInMemoryDbContext();
        var deck = new Deck { Id = 1, Title = "Deck" };
        var card = new Card { Id = 101, DeckId = 1, Prompt = "Q1", Answer = "A1" };
        db.Decks.Add(deck);
        db.Cards.Add(card);
        db.UserGhostedCards.Add(new UserGhostedCard { UserId = 1, CardId = 101 });
        db.UserGhostedCards.Add(new UserGhostedCard { UserId = 2, CardId = 101 });
        await db.SaveChangesAsync();

        var controller = CreateContentController(db, userId: 1, role: Roles.Admin);
        var deleteResult = await controller.DeleteCard(101);
        Assert.IsType<NoContentResult>(deleteResult);

        Assert.Empty(await db.UserGhostedCards.Where(g => g.CardId == 101).ToListAsync());
    }

    [Fact]
    public async Task GhostCard_PrivateStudyGroup_NonMember_ReturnsForbid()
    {
        using var db = CreateInMemoryDbContext();
        var group = new StudyGroup { Id = 10, Name = "Private Group", IsPublic = false, Privacy = StudyGroupPrivacy.Private };
        var deck = new Deck { Id = 1, Title = "Private Deck", StudyGroupId = 10 };
        var card = new Card { Id = 101, DeckId = 1, Prompt = "Q", Answer = "A" };
        db.StudyGroups.Add(group);
        db.Decks.Add(deck);
        db.Cards.Add(card);
        await db.SaveChangesAsync();

        // User 2 is not a member of StudyGroup 10
        var controller = CreateContentController(db, userId: 2);
        var result = await controller.GhostCard(101);

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task GetStudyQueue_PrivateStudyGroup_NonMember_ReturnsForbid()
    {
        using var db = CreateInMemoryDbContext();
        var group = new StudyGroup { Id = 10, Name = "Private Group", IsPublic = false, Privacy = StudyGroupPrivacy.Private };
        var deck = new Deck { Id = 1, Title = "Private Deck", StudyGroupId = 10 };
        var card = new Card { Id = 101, DeckId = 1, Prompt = "Q", Answer = "A" };
        db.StudyGroups.Add(group);
        db.Decks.Add(deck);
        db.Cards.Add(card);
        await db.SaveChangesAsync();

        // User 2 is not a member of StudyGroup 10
        var controller = CreateStudyQueueController(db, userId: 2);
        var result = await controller.GetStudyQueue(1);

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task GetGhostedCardsByDeck_PrivateStudyGroup_NonMember_ReturnsForbid()
    {
        using var db = CreateInMemoryDbContext();
        var group = new StudyGroup { Id = 10, Name = "Private Group", IsPublic = false, Privacy = StudyGroupPrivacy.Private };
        var deck = new Deck { Id = 1, Title = "Private Deck", StudyGroupId = 10 };
        var card = new Card { Id = 101, DeckId = 1, Prompt = "Q", Answer = "A" };
        db.StudyGroups.Add(group);
        db.Decks.Add(deck);
        db.Cards.Add(card);
        await db.SaveChangesAsync();

        // User 2 is not a member of StudyGroup 10
        var controller = CreateDecksController(db, userId: 2);
        var result = await controller.GetGhostedCardsByDeck(1);

        Assert.IsType<ForbidResult>(result.Result);
    }
}
