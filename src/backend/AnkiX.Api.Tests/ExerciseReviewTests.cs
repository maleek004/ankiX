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
using Microsoft.Extensions.Options;

namespace AnkiX.Api.Tests;

public class ExerciseReviewTests
{
    private static ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    private static ExercisesController CreateController(ApplicationDbContext db, int userId = 200, string role = "User")
    {
        var options = Options.Create(new ExecutionApiOptions());
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
    public async Task SubmitExerciseReview_FirstTimeGood_GraduatesToLearningStep1()
    {
        using var db = CreateInMemoryDbContext();
        var controller = CreateController(db, userId: 200);

        db.Exercises.Add(new Exercise
        {
            Id = 50,
            Title = "Binary Search in Python",
            Language = "python"
        });
        await db.SaveChangesAsync();

        var request = new ReviewRequest { CardId = 50, Outcome = "Good" };
        var actionResult = await controller.SubmitExerciseReview(id: 50, request);

        var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        var response = Assert.IsType<ReviewResponse>(okResult.Value);

        Assert.Equal("learning", response.Phase);

        var persistedRecord = await db.ExerciseReviewRecords.FirstOrDefaultAsync(r => r.ExerciseId == 50 && r.UserId == 200);
        Assert.NotNull(persistedRecord);
        Assert.Equal("Good", persistedRecord.Outcome);
        Assert.Equal(1, persistedRecord.LearningStep);
        Assert.Equal(200, persistedRecord.UserId);
    }

    [Fact]
    public async Task GetDueExercises_UnreviewedExercise_IncludedInDueList()
    {
        using var db = CreateInMemoryDbContext();
        var controller = CreateController(db, userId: 200);

        db.Exercises.Add(new Exercise { Id = 1, Title = "Ex 1", Language = "csharp" });
        db.Exercises.Add(new Exercise { Id = 2, Title = "Ex 2", Language = "python" });
        await db.SaveChangesAsync();

        var actionResult = await controller.GetDueExercises();

        var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        var dueList = Assert.IsAssignableFrom<IEnumerable<ExerciseResponse>>(okResult.Value);

        Assert.Equal(2, dueList.Count());
    }
}
