using System.Security.Claims;
using AnkiX.Api.Controllers;
using AnkiX.Api.Data;
using AnkiX.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

namespace AnkiX.Api.Tests;

public class DecksCascadeDeleteTests
{
    private static ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new ApplicationDbContext(options);
    }

    private static ContentController CreateContentController(ApplicationDbContext db, int userId = 1, string role = "Admin")
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

    [Fact]
    public async Task DeleteDeck_EmptyDeck_SucceedsWith204NoContent()
    {
        using var db = CreateInMemoryDbContext();
        var deck = new Deck { Id = 10, Title = "Empty Deck", CreatedByUserId = 1 };
        db.Decks.Add(deck);
        await db.SaveChangesAsync();

        var controller = CreateContentController(db, userId: 1, role: "Admin");
        var result = await controller.DeleteDeck(10, cascade: false);

        Assert.IsType<NoContentResult>(result);
        Assert.Null(await db.Decks.FirstOrDefaultAsync(d => d.Id == 10));
    }

    [Fact]
    public async Task DeleteDeck_WithCards_WithoutCascade_Returns409Conflict_WithConfirmationPayload()
    {
        using var db = CreateInMemoryDbContext();
        var deck = new Deck { Id = 20, Title = "Deck With Cards", CreatedByUserId = 1 };
        db.Decks.Add(deck);
        db.Cards.Add(new Card { Id = 101, DeckId = 20, Prompt = "Q1", Answer = "A1" });
        db.Cards.Add(new Card { Id = 102, DeckId = 20, Prompt = "Q2", Answer = "A2" });
        await db.SaveChangesAsync();

        var controller = CreateContentController(db, userId: 1, role: "Admin");
        var result = await controller.DeleteDeck(20, cascade: false);

        var conflictResult = Assert.IsType<ConflictObjectResult>(result);
        var valString = conflictResult.Value?.ToString() ?? "";
        Assert.Contains("requiresConfirmation", valString);
        Assert.Contains("cardCount", valString);

        // Verify deck and cards were NOT deleted
        Assert.NotNull(await db.Decks.FirstOrDefaultAsync(d => d.Id == 20));
        Assert.Equal(2, await db.Cards.CountAsync(c => c.DeckId == 20));
    }

    [Fact]
    public async Task DeleteDeck_WithCards_WithCascadeTrue_PurgesCardsAndLinks_PreservesReviewRecordsAndExercises()
    {
        using var db = CreateInMemoryDbContext();

        // 1. Create Deck & Cards
        var deck = new Deck { Id = 30, Title = "Algorithm Deck", CreatedByUserId = 1 };
        db.Decks.Add(deck);

        var card1 = new Card { Id = 201, DeckId = 30, Prompt = "What is BFS?", Answer = "Breadth First Search" };
        var card2 = new Card { Id = 202, DeckId = 30, Prompt = "What is DFS?", Answer = "Depth First Search" };
        db.Cards.AddRange(card1, card2);

        // 2. Create Exercise (Standalone) & CardExercise Link
        var exercise = new Exercise { Id = 501, Title = "Implement BFS", Language = "csharp", StarterCode = "// code" };
        db.Exercises.Add(exercise);

        var link = new CardExercise { CardId = 201, ExerciseId = 501 };
        db.CardExercises.Add(link);

        // 3. Create CardFollowup attached to card1, and an external surviving followup linking to card1
        var followup = new CardFollowup { Id = 901, CardId = 201, AuthorUserId = 1, QuestionText = "Can BFS use a stack?" };
        var externalFollowup = new CardFollowup { Id = 902, CardId = 9999, AuthorUserId = 1, QuestionText = "External question", LinkedCardId = 201 };
        db.CardFollowups.AddRange(followup, externalFollowup);

        // 4. Create ReviewRecords (Historical user study history)
        var review1 = new ReviewRecord { Id = 1001, CardId = 201, UserId = 1, Outcome = "Good", EaseFactor = 2.50m, NextReviewAt = DateTime.UtcNow.AddDays(1) };
        var review2 = new ReviewRecord { Id = 1002, CardId = 202, UserId = 1, Outcome = "Easy", EaseFactor = 2.60m, NextReviewAt = DateTime.UtcNow.AddDays(4) };
        db.ReviewRecords.AddRange(review1, review2);

        await db.SaveChangesAsync();

        // 5. Execute DeleteDeck with cascade: true
        var controller = CreateContentController(db, userId: 1, role: "Admin");
        var result = await controller.DeleteDeck(30, cascade: true);

        Assert.IsType<NoContentResult>(result);

        // Verify Deck and Cards are erased
        Assert.Null(await db.Decks.FirstOrDefaultAsync(d => d.Id == 30));
        Assert.Empty(await db.Cards.Where(c => c.DeckId == 30).ToListAsync());

        // Verify CardExercises junction link and CardFollowups attached to deleted cards are erased
        Assert.Empty(await db.CardExercises.Where(ce => ce.CardId == 201 || ce.CardId == 202).ToListAsync());
        Assert.Null(await db.CardFollowups.FirstOrDefaultAsync(f => f.Id == 901));

        // Verify surviving external followup had its LinkedCardId nullified
        var updatedExternalFollowup = await db.CardFollowups.FirstOrDefaultAsync(f => f.Id == 902);
        Assert.NotNull(updatedExternalFollowup);
        Assert.Null(updatedExternalFollowup.LinkedCardId);

        // CRITICAL: Verify Exercise and ReviewRecords are 100% PRESERVED
        var survivingExercise = await db.Exercises.FirstOrDefaultAsync(e => e.Id == 501);
        Assert.NotNull(survivingExercise);
        Assert.Equal("Implement BFS", survivingExercise.Title);

        var survivingReviews = await db.ReviewRecords.Where(r => r.UserId == 1).ToListAsync();
        Assert.Equal(2, survivingReviews.Count);
    }

    [Fact]
    public async Task DeleteDeck_UnauthorizedUser_ReturnsForbid()
    {
        using var db = CreateInMemoryDbContext();
        var deck = new Deck { Id = 40, Title = "Private Group Deck", StudyGroupId = 99 };
        db.Decks.Add(deck);
        await db.SaveChangesAsync();

        // Caller is regular user not in group 99
        var controller = CreateContentController(db, userId: 2, role: "User");
        var result = await controller.DeleteDeck(40, cascade: true);

        Assert.IsType<ForbidResult>(result);
        Assert.NotNull(await db.Decks.FirstOrDefaultAsync(d => d.Id == 40));
    }

    [Fact]
    public async Task DeleteDeck_NotFound_Returns404()
    {
        using var db = CreateInMemoryDbContext();
        var controller = CreateContentController(db, userId: 1, role: "Admin");
        var result = await controller.DeleteDeck(999, cascade: true);

        Assert.IsType<NotFoundObjectResult>(result);
    }
}
