using System.Security.Claims;
using AnkiX.Api.Contracts.Study;
using AnkiX.Api.Data;
using AnkiX.Api.Models;
using AnkiX.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace AnkiX.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/cards/{cardId:int}/run")]
public sealed class CardRunsController : ControllerBase
{
    private readonly ApplicationDbContext dbContext;
    private readonly ICodeExecutionService codeExecutionService;

    public CardRunsController(ApplicationDbContext dbContext, ICodeExecutionService codeExecutionService)
    {
        this.dbContext = dbContext;
        this.codeExecutionService = codeExecutionService;
    }

    [HttpPost]
    public async Task<ActionResult<CodeRunResponse>> RunCardCode(
        [FromRoute] int cardId,
        [FromBody] CodeRunRequest request,
        CancellationToken cancellationToken)
    {
        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized(new { message = "Invalid user identity in token." });
        }

        Card? card = await dbContext.Cards
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == cardId, cancellationToken);

        if (card is null)
        {
            return NotFound(new { message = "Card not found." });
        }

        CodeExecutionResult execResult = await codeExecutionService.ExecuteAsync(
            request.SubmittedCode,
            request.Language,
            card.ValidationSpec,
            cancellationToken);

        CardRun run = new CardRun
        {
            CardId = cardId,
            UserId = userId,
            SubmittedCode = request.SubmittedCode,
            Result = execResult.Passed,
            ResultDetails = execResult.Details,
            DurationMs = execResult.DurationMs,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.CardRuns.Add(run);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new CodeRunResponse
        {
            RunId = run.Id,
            Result = execResult.Passed ? "PASS" : "FAIL",
            Passed = execResult.Passed,
            DurationMs = execResult.DurationMs,
            Details = execResult.Details
        });
    }

    [HttpPost("/api/cards/{cardId:int}/run-ephemeral")]
    [AllowAnonymous]
    [EnableRateLimiting("GuestExecutionPolicy")]
    public async Task<ActionResult<CodeRunResponse>> RunCardCodeEphemeral(
        [FromRoute] int cardId,
        [FromBody] CodeRunRequest request,
        CancellationToken cancellationToken)
    {
        Card? card = await dbContext.Cards
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == cardId, cancellationToken);

        if (card is null)
        {
            return NotFound(new { message = "Card not found." });
        }

        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int.TryParse(userIdClaim, out int userId);
        bool isSystemAdmin = User.IsInRole(Roles.Admin) || User.IsInRole(Roles.SuperAdmin);

        var deck = await dbContext.Decks.AsNoTracking().FirstOrDefaultAsync(d => d.Id == card.DeckId, cancellationToken);
        if (deck != null && deck.StudyGroupId.HasValue && deck.StudyGroupId.Value > 0 && !isSystemAdmin)
        {
            var studyGroup = await dbContext.StudyGroups.AsNoTracking().FirstOrDefaultAsync(g => g.Id == deck.StudyGroupId.Value, cancellationToken);
            if (studyGroup != null && !studyGroup.IsPublic)
            {
                if (userId == 0)
                {
                    return NotFound(new { message = "Card not found." });
                }
                bool isMember = await dbContext.StudyGroupMembers.AnyAsync(m => m.StudyGroupId == deck.StudyGroupId.Value && m.UserId == userId, cancellationToken);
                if (!isMember)
                {
                    return NotFound(new { message = "Card not found." });
                }
            }
        }

        CodeExecutionResult execResult = await codeExecutionService.ExecuteAsync(
            request.SubmittedCode,
            request.Language,
            card.ValidationSpec,
            cancellationToken);

        return Ok(new CodeRunResponse
        {
            RunId = 0,
            Result = execResult.Passed ? "PASS" : "FAIL",
            Passed = execResult.Passed,
            DurationMs = execResult.DurationMs,
            Details = execResult.Details
        });
    }

    [HttpGet("/api/cards/{cardId:int}/runs")]
    public async Task<ActionResult<IEnumerable<CardRun>>> GetCardRuns(
        [FromRoute] int cardId,
        CancellationToken cancellationToken)
    {
        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized(new { message = "Invalid user identity in token." });
        }

        List<CardRun> runs = await dbContext.CardRuns
            .AsNoTracking()
            .Where(r => r.CardId == cardId && r.UserId == userId)
            .OrderByDescending(r => r.CreatedAt)
            .Take(20)
            .ToListAsync(cancellationToken);

        return Ok(runs);
    }
}
