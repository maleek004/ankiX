using System.Security.Claims;
using AnkiX.Api.Contracts.Study;
using AnkiX.Api.Controllers;
using AnkiX.Api.Data;
using AnkiX.Api.Models;
using AnkiX.Api.Options;
using AnkiX.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AnkiX.Api.Tests;

public class CardRunsControllerTests
{
    private static ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    private static CardRunsController CreateController(ApplicationDbContext db, int userId = 101, string role = "User")
    {
        var options = Options.Create(new ExecutionApiOptions());
        var execService = new CodeExecutionService(new HttpClient(), options);
        var controller = new CardRunsController(db, execService);

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
    public async Task RunCardCode_ValidCard_PersistsCardRunAndReturnsResult()
    {
        using var db = CreateInMemoryDbContext();
        var controller = CreateController(db, userId: 101);

        db.Decks.Add(new Deck { Id = 1, Title = "C# Deck" });
        db.Cards.Add(new Card
        {
            Id = 5,
            DeckId = 1,
            Type = "micro-coding",
            Prompt = "Write Sum(a, b)",
            ValidationSpec = "{\"answer\":\"return a + b;\"}"
        });
        await db.SaveChangesAsync();

        var request = new CodeRunRequest
        {
            SubmittedCode = "public int Sum(int a, int b) { return a + b; }",
            Language = "csharp"
        };

        var actionResult = await controller.RunCardCode(cardId: 5, request, CancellationToken.None);

        var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        var response = Assert.IsType<CodeRunResponse>(okResult.Value);

        Assert.Equal("PASS", response.Result);
        Assert.True(response.Passed);
        Assert.True(response.RunId > 0);

        var persistedRun = await db.CardRuns.FirstOrDefaultAsync(r => r.Id == response.RunId);
        Assert.NotNull(persistedRun);
        Assert.Equal(101, persistedRun.UserId);
        Assert.Equal(5, persistedRun.CardId);
        Assert.True(persistedRun.Result);
    }
}
