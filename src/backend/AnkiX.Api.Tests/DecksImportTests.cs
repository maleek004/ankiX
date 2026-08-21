using System.Security.Claims;
using System.Text;
using AnkiX.Api.Contracts.Content;
using AnkiX.Api.Controllers;
using AnkiX.Api.Data;
using AnkiX.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AnkiX.Api.Tests;

public class DecksImportTests
{
    private static ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    private static DecksController CreateDecksController(ApplicationDbContext db, int userId = 1, string role = Roles.Admin)
    {
        var controller = new DecksController(db);
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

    private static IFormFile CreateFormFile(string content, string fileName)
    {
        var bytes = Encoding.UTF8.GetBytes(content);
        var stream = new MemoryStream(bytes);
        return new FormFile(stream, 0, bytes.Length, "file", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = "text/plain"
        };
    }

    [Fact]
    public async Task ImportCardsFromFile_TsvContentInTxtFileWithCommas_ParsesCorrectly()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var deck = new Deck { Title = "Linux & CLI", CreatedAt = DateTime.UtcNow };
        db.Decks.Add(deck);
        await db.SaveChangesAsync();

        var controller = CreateDecksController(db, userId: 1, role: Roles.Admin);

        string tsvContent =
            "What is the kernel in an operating system?\tThe core piece of software that acts as the manager of the whole system, controlling memory, hardware, files, processes, and security.\n" +
            "What is the shell in a computer system?\tA command interpreter program that accepts text commands from the user, translates them for the kernel, and displays the results.\n" +
            "\"In the command `echo \"\"Hello\"\"`, what does the text \"\"Hello\"\" represent?\"\tThe argument being passed to the `echo` command.\n" +
            "How can you create multiple directories (e.g., `data`, `scripts`, `notebooks`) in a single `mkdir` command?\t`mkdir data scripts notebooks`";

        var file = CreateFormFile(tsvContent, "TalentNation__Lesson3.txt");

        // Act
        var actionResult = await controller.ImportCardsFromFile(deck.Id, file);

        // Assert
        var okResult = actionResult.Value ?? (actionResult.Result as OkObjectResult)?.Value as ImportCardsResponse;
        Assert.NotNull(okResult);
        Assert.Equal(4, okResult.ImportedCount);
        Assert.Equal(0, okResult.SkippedCount);

        var cards = await db.Cards.Where(c => c.DeckId == deck.Id).OrderBy(c => c.Id).ToListAsync();
        Assert.Equal(4, cards.Count);
        Assert.Equal("What is the kernel in an operating system?", cards[0].Prompt);
        Assert.Contains("controlling memory, hardware, files, processes, and security.", cards[0].Answer);
        Assert.Equal("basic", cards[0].Type);

        Assert.Equal("In the command `echo \"Hello\"`, what does the text \"Hello\" represent?", cards[2].Prompt);
        Assert.Equal("The argument being passed to the `echo` command.", cards[2].Answer);
    }

    [Fact]
    public async Task ImportCardsFromText_TsvFormat_ParsesCardsSuccessfully()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var deck = new Deck { Title = "CS Fundamentals", CreatedAt = DateTime.UtcNow };
        db.Decks.Add(deck);
        await db.SaveChangesAsync();

        var controller = CreateDecksController(db, userId: 1, role: Roles.Admin);

        string tsvContent =
            "What is BFS?\tBreadth-First Search algorithm\n" +
            "What is DFS?\tDepth-First Search algorithm";

        var request = new ImportCardsTextRequest
        {
            Content = tsvContent,
            Format = "tsv"
        };

        // Act
        var actionResult = await controller.ImportCardsFromText(deck.Id, request);

        // Assert
        var okResult = actionResult.Value ?? (actionResult.Result as OkObjectResult)?.Value as ImportCardsResponse;
        Assert.NotNull(okResult);
        Assert.Equal(2, okResult.ImportedCount);

        var cards = await db.Cards.Where(c => c.DeckId == deck.Id).ToListAsync();
        Assert.Equal(2, cards.Count);
        Assert.Contains(cards, c => c.Prompt == "What is BFS?" && c.Answer == "Breadth-First Search algorithm");
    }

    [Fact]
    public async Task ImportCardsFromText_JsonFormat_ParsesCardsSuccessfully()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var deck = new Deck { Title = "JSON Deck", CreatedAt = DateTime.UtcNow };
        db.Decks.Add(deck);
        await db.SaveChangesAsync();

        var controller = CreateDecksController(db, userId: 1, role: Roles.Admin);

        string jsonContent = @"[
            { ""prompt"": ""What is OOP?"", ""type"": ""concept"", ""answer"": ""Object-Oriented Programming"" },
            { ""prompt"": ""What is DRY?"", ""answer"": ""Don't Repeat Yourself"" }
        ]";

        var request = new ImportCardsTextRequest
        {
            Content = jsonContent,
            Format = "json"
        };

        // Act
        var actionResult = await controller.ImportCardsFromText(deck.Id, request);

        // Assert
        var okResult = actionResult.Value ?? (actionResult.Result as OkObjectResult)?.Value as ImportCardsResponse;
        Assert.NotNull(okResult);
        Assert.Equal(2, okResult.ImportedCount);

        var cards = await db.Cards.Where(c => c.DeckId == deck.Id).OrderBy(c => c.Id).ToListAsync();
        Assert.Equal(2, cards.Count);
        Assert.Equal("concept", cards[0].Type);
        Assert.Equal("basic", cards[1].Type);
    }

    [Fact]
    public async Task ImportCardsFromFile_FrozenStudyGroup_ReturnsForbid()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var group = new StudyGroup { Name = "Frozen Group", Slug = "frozen", IsFrozen = true, CreatedAt = DateTime.UtcNow };
        db.StudyGroups.Add(group);
        await db.SaveChangesAsync();

        var deck = new Deck { Title = "Locked Deck", StudyGroupId = group.Id, CreatedAt = DateTime.UtcNow };
        db.Decks.Add(deck);
        await db.SaveChangesAsync();

        var controller = CreateDecksController(db, userId: 1, role: Roles.Admin);
        var file = CreateFormFile("Prompt\tAnswer", "deck.tsv");

        // Act
        var actionResult = await controller.ImportCardsFromFile(deck.Id, file);

        // Assert
        Assert.IsType<ForbidResult>(actionResult.Result);
    }

    [Fact]
    public async Task ImportCardsFromFile_StudyGroupOwner_AllowsImport()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var group = new StudyGroup { Name = "Community Group", Slug = "community", Privacy = StudyGroupPrivacy.Private, CreatedAt = DateTime.UtcNow };
        db.StudyGroups.Add(group);
        await db.SaveChangesAsync();

        db.StudyGroupMembers.Add(new StudyGroupMember
        {
            StudyGroupId = group.Id,
            UserId = 42,
            Role = StudyGroupRoles.Owner,
            Status = StudyGroupMemberStatus.Active
        });

        var deck = new Deck { Title = "Group Deck", StudyGroupId = group.Id, CreatedAt = DateTime.UtcNow };
        db.Decks.Add(deck);
        await db.SaveChangesAsync();

        // User 42 has global Role 'User' but is 'Owner' of the study group
        var controller = CreateDecksController(db, userId: 42, role: Roles.User);
        var file = CreateFormFile("Card 1\tAnswer 1", "test.tsv");

        // Act
        var actionResult = await controller.ImportCardsFromFile(deck.Id, file);

        // Assert
        var okResult = actionResult.Value ?? (actionResult.Result as OkObjectResult)?.Value as ImportCardsResponse;
        Assert.NotNull(okResult);
        Assert.Equal(1, okResult.ImportedCount);
    }
}
