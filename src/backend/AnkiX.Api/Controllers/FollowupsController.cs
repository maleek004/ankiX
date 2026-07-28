using AnkiX.Api.Contracts.Study;
using AnkiX.Api.Data;
using AnkiX.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace AnkiX.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/cards/{cardId:int}/followups")]
public sealed class FollowupsController : ControllerBase
{
    private readonly ApplicationDbContext dbContext;

    public FollowupsController(ApplicationDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    /// <summary>Returns all follow-up questions for a given card, newest first.</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<FollowupResponse>>> GetFollowups([FromRoute] int cardId)
    {
        bool cardExists = await dbContext.Cards.AnyAsync(c => c.Id == cardId);
        if (!cardExists)
        {
            return NotFound(new { message = "Card not found." });
        }

        List<CardFollowup> followups = await dbContext.CardFollowups
            .Where(f => f.CardId == cardId)
            .OrderByDescending(f => f.CreatedAt)
            .ToListAsync();

        if (followups.Count == 0)
        {
            return Ok(Array.Empty<FollowupResponse>());
        }

        // Resolve author display names in a single query
        List<int> authorIds = followups.Select(f => f.AuthorUserId).Distinct().ToList();
        Dictionary<int, string> authorNames = await dbContext.Users
            .Where(u => authorIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName ?? u.Email);

        List<FollowupResponse> responses = followups.Select(f => new FollowupResponse
        {
            Id = f.Id,
            CardId = f.CardId,
            AuthorUserId = f.AuthorUserId,
            AuthorDisplayName = authorNames.GetValueOrDefault(f.AuthorUserId, "Unknown"),
            QuestionText = f.QuestionText,
            LinkedCardId = f.LinkedCardId,
            CreatedAt = f.CreatedAt
        }).ToList();

        return Ok(responses);
    }

    /// <summary>Adds a follow-up question to a card. Any authenticated user may post.</summary>
    [HttpPost]
    public async Task<ActionResult<FollowupResponse>> CreateFollowup(
        [FromRoute] int cardId,
        [FromBody] CreateFollowupRequest request)
    {
        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized(new { message = "Invalid user identity in token." });
        }

        bool cardExists = await dbContext.Cards.AnyAsync(c => c.Id == cardId);
        if (!cardExists)
        {
            return NotFound(new { message = "Card not found." });
        }

        User? author = await dbContext.Users.FindAsync(userId);
        if (author is null)
        {
            return Unauthorized(new { message = "User not found." });
        }

        CardFollowup followup = new CardFollowup
        {
            CardId = cardId,
            AuthorUserId = userId,
            QuestionText = request.QuestionText.Trim(),
            LinkedCardId = null,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.CardFollowups.Add(followup);
        await dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetFollowups), new { cardId }, new FollowupResponse
        {
            Id = followup.Id,
            CardId = followup.CardId,
            AuthorUserId = followup.AuthorUserId,
            AuthorDisplayName = author.DisplayName ?? author.Email,
            QuestionText = followup.QuestionText,
            LinkedCardId = null,
            CreatedAt = followup.CreatedAt
        });
    }

    /// <summary>
    /// Links a follow-up to an answer card. Contributor/Admin only.
    /// Call PATCH /api/cards/{cardId}/followups/{followupId}/link with { linkedCardId }.
    /// </summary>
    [HttpPatch("{followupId:long}/link")]
    [Authorize(Roles = $"{Roles.Contributor},{Roles.Admin}")]
    public async Task<IActionResult> LinkAnswerCard(
        [FromRoute] int cardId,
        [FromRoute] long followupId,
        [FromBody] LinkFollowupRequest request)
    {
        CardFollowup? followup = await dbContext.CardFollowups
            .FirstOrDefaultAsync(f => f.Id == followupId && f.CardId == cardId);

        if (followup is null)
        {
            return NotFound(new { message = "Follow-up not found." });
        }

        bool answerCardExists = await dbContext.Cards.AnyAsync(c => c.Id == request.LinkedCardId);
        if (!answerCardExists)
        {
            return BadRequest(new { message = "Linked answer card not found." });
        }

        followup.LinkedCardId = request.LinkedCardId;
        await dbContext.SaveChangesAsync();

        return Ok(new { message = "Follow-up linked to answer card.", linkedCardId = request.LinkedCardId });
    }
}
