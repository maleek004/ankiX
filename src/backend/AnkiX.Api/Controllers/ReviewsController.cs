using AnkiX.Api.Contracts.Study;
using AnkiX.Api.Data;
using AnkiX.Api.Models;
using AnkiX.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace AnkiX.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/reviews")]
public sealed class ReviewsController : ControllerBase
{
    private readonly ApplicationDbContext dbContext;
    private readonly IReviewSchedulerService reviewSchedulerService;

    public ReviewsController(ApplicationDbContext dbContext, IReviewSchedulerService reviewSchedulerService)
    {
        this.dbContext = dbContext;
        this.reviewSchedulerService = reviewSchedulerService;
    }

    [HttpPost]
    public async Task<ActionResult<ReviewResponse>> SubmitReview([FromBody] ReviewRequest request)
    {
        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized(new { message = "Invalid user identity in token." });
        }

        bool cardExists = await dbContext.Cards.AnyAsync(card => card.Id == request.CardId);
        if (!cardExists)
        {
            return NotFound(new { message = "Card not found." });
        }

        // Fetch the most recent review for this user + card (if any) to pass to the scheduler
        ReviewRecord? previousRecord = await dbContext.ReviewRecords
            .Where(record => record.UserId == userId && record.CardId == request.CardId)
            .OrderByDescending(record => record.CreatedAt)
            .FirstOrDefaultAsync();

        ReviewScheduleResult schedule = reviewSchedulerService.CalculateNextSchedule(previousRecord, request.Outcome);

        ReviewRecord newRecord = new ReviewRecord
        {
            CardId = request.CardId,
            UserId = userId,
            Outcome = request.Outcome,
            EaseFactor = schedule.EaseFactor,
            IntervalDays = schedule.IntervalDays,
            NextReviewAt = schedule.NextReviewAt,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.ReviewRecords.Add(newRecord);
        await dbContext.SaveChangesAsync();

        return Ok(new ReviewResponse
        {
            CardId = request.CardId,
            NextReviewAt = schedule.NextReviewAt,
            EaseFactor = schedule.EaseFactor,
            IntervalDays = schedule.IntervalDays
        });
    }
}
