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
            LinkedCardIds = f.GetLinkedCardIdList(),
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

        CardFollowup followup = new CardFollowup
        {
            CardId = cardId,
            AuthorUserId = userId,
            QuestionText = request.QuestionText.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        dbContext.CardFollowups.Add(followup);
        await dbContext.SaveChangesAsync();

        string authorDisplayName = await dbContext.Users
            .Where(u => u.Id == userId)
            .Select(u => u.DisplayName ?? u.Email)
            .FirstOrDefaultAsync() ?? "Unknown";

        return CreatedAtAction(nameof(GetFollowups), new { cardId }, new FollowupResponse
        {
            Id = followup.Id,
            CardId = followup.CardId,
            AuthorUserId = followup.AuthorUserId,
            AuthorDisplayName = authorDisplayName,
            QuestionText = followup.QuestionText,
            LinkedCardId = followup.LinkedCardId,
            LinkedCardIds = followup.GetLinkedCardIdList(),
            CreatedAt = followup.CreatedAt
        });
    }

    /// <summary>
    /// Links a follow-up to an answer card. Study Group Owner/Admin/Contributor or global Admin/Contributor.
    /// Call PATCH /api/cards/{cardId}/followups/{followupId}/link with { linkedCardId }.
    /// </summary>
    [HttpPatch("{followupId:long}/link")]
    public async Task<IActionResult> LinkAnswerCard(
        [FromRoute] int cardId,
        [FromRoute] long followupId,
        [FromBody] LinkFollowupRequest request)
    {
        Card? card = await dbContext.Cards.FirstOrDefaultAsync(c => c.Id == cardId);
        Deck? deck = card != null ? await dbContext.Decks.FirstOrDefaultAsync(d => d.Id == card.DeckId) : null;
        if (!await CanManageContentAsync(deck?.StudyGroupId)) return Forbid();

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

        followup.AddLinkedCardId(request.LinkedCardId);
        await dbContext.SaveChangesAsync();

        return Ok(new { message = "Follow-up linked to answer card.", linkedCardId = request.LinkedCardId, linkedCardIds = followup.GetLinkedCardIdList() });
    }

    /// <summary>
    /// Unlinks an answer card from a follow-up. Study Group Owner/Admin/Contributor or global Admin/Contributor.
    /// Call DELETE /api/cards/{cardId}/followups/{followupId}/link/{linkedCardId}.
    /// </summary>
    [HttpDelete("{followupId:long}/link/{linkedCardId:int}")]
    public async Task<IActionResult> UnlinkAnswerCard(
        [FromRoute] int cardId,
        [FromRoute] long followupId,
        [FromRoute] int linkedCardId)
    {
        Card? card = await dbContext.Cards.FirstOrDefaultAsync(c => c.Id == cardId);
        Deck? deck = card != null ? await dbContext.Decks.FirstOrDefaultAsync(d => d.Id == card.DeckId) : null;
        if (!await CanManageContentAsync(deck?.StudyGroupId)) return Forbid();

        CardFollowup? followup = await dbContext.CardFollowups
            .FirstOrDefaultAsync(f => f.Id == followupId && f.CardId == cardId);

        if (followup is null)
        {
            return NotFound(new { message = "Follow-up not found." });
        }

        followup.RemoveLinkedCardId(linkedCardId);
        await dbContext.SaveChangesAsync();

        return Ok(new { message = "Follow-up unlinked from answer card.", linkedCardIds = followup.GetLinkedCardIdList() });
    }

    private async Task<bool> CanManageContentAsync(int? studyGroupId)
    {
        if (User.IsInRole(Roles.Admin) || User.IsInRole(Roles.Contributor))
        {
            return true;
        }

        if (!studyGroupId.HasValue || studyGroupId.Value <= 0)
        {
            return false;
        }

        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out int userId))
        {
            return false;
        }

        string? memberRole = await dbContext.StudyGroupMembers
            .Where(m => m.StudyGroupId == studyGroupId.Value && m.UserId == userId)
            .Select(m => m.Role)
            .FirstOrDefaultAsync();

        return memberRole == StudyGroupRoles.Owner
            || memberRole == StudyGroupRoles.Admin
            || memberRole == StudyGroupRoles.Contributor;
    }
}
