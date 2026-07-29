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
using Microsoft.Extensions.Options;

namespace AnkiX.Api.Tests;

public class ExercisesControllerTests
{
    private static ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    private static ExercisesController CreateController(ApplicationDbContext db, int userId = 1, string role = "Admin")
    {
        var options = Options.Create(new ExecutionApiOptions());
        var execService = new CodeExecutionService(new HttpClient(), options);
        var controller = new ExercisesController(db, execService);
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
    public async Task CreateExercise_ValidPayload_ReturnsCreatedExercise()
    {
        using var db = CreateInMemoryDbContext();
        var controller = CreateController(db, userId: 42, role: "Contributor");

        var request = new CreateExerciseRequest
        {
            Title = "Reverse a String",
            Description = "Write a function that reverses a string in-place.",
            Language = "csharp",
            StarterCode = "public string Reverse(string s) { }",
            SolutionCode = "public string Reverse(string s) => new string(s.Reverse().ToArray());"
        };

        var result = await controller.CreateExercise(request);

        var createdAtActionResult = Assert.IsType<CreatedAtActionResult>(result.Result);
        var exercise = Assert.IsType<ExerciseDetailResponse>(createdAtActionResult.Value);

        Assert.Equal("Reverse a String", exercise.Title);
        Assert.Equal("csharp", exercise.Language);
        Assert.Equal(42, exercise.CreatedByUserId);
        Assert.Equal(1, db.Exercises.Count());
    }

    [Fact]
    public async Task CreateExercise_InvalidLanguage_ReturnsBadRequest()
    {
        using var db = CreateInMemoryDbContext();
        var controller = CreateController(db);

        var request = new CreateExerciseRequest
        {
            Title = "Unsupported Lang Test",
            Language = "ruby"
        };

        var result = await controller.CreateExercise(request);

        var badRequestResult = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal(0, db.Exercises.Count());
    }

    [Fact]
    public async Task LinkExerciseToCard_ValidCardAndExercise_CreatesJoinRecord()
    {
        using var db = CreateInMemoryDbContext();
        var controller = CreateController(db);

        db.Decks.Add(new Deck { Id = 1, Title = "Algorithms" });
        db.Cards.Add(new Card { Id = 10, DeckId = 1, Type = "micro-coding", Prompt = "Reverse String Prompt" });
        db.Exercises.Add(new Exercise { Id = 100, Title = "Reverse String Ex", Language = "csharp" });
        await db.SaveChangesAsync();

        var result = await controller.LinkExerciseToCard(cardId: 10, exerciseId: 100);

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal(1, db.CardExercises.Count(ce => ce.CardId == 10 && ce.ExerciseId == 100));

        var getCardExResult = await controller.GetExercisesForCard(cardId: 10);
        var okResult = Assert.IsType<OkObjectResult>(getCardExResult.Result);
        var list = Assert.IsAssignableFrom<IEnumerable<ExerciseResponse>>(okResult.Value);
        Assert.Single(list);
    }
}
