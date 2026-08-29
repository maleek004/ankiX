using AnkiX.Api.Contracts.Content;
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
[Route("api/decks/{deckId:int}/study-queue")]
public sealed class StudyQueueController : ControllerBase
{
    private readonly ApplicationDbContext dbContext;

    public StudyQueueController(ApplicationDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    /// <summary>
    /// Returns the study queue for a deck:
    ///   - newCount      — cards never reviewed by this user (Blue)
    ///   - learningCount — cards in learning phase due now (Red)
    ///   - reviewCount   — graduated cards due today (Green)
    ///   - dueCards      — ordered queue: Learning → Review → New
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<StudyQueueResponse>> GetStudyQueue([FromRoute] int deckId)
    {
        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized(new { message = "Invalid user identity in token." });
        }

        Deck? deck = await dbContext.Decks.AsNoTracking().FirstOrDefaultAsync(d => d.Id == deckId);
        if (deck is null)
        {
            return NotFound(new { message = "Deck not found." });
        }

        bool isSystemAdmin = User.IsInRole(Roles.Admin) || User.IsInRole(Roles.SuperAdmin);
        if (deck.StudyGroupId.HasValue && deck.StudyGroupId.Value > 0 && !isSystemAdmin)
        {
            var studyGroup = await dbContext.StudyGroups.AsNoTracking().FirstOrDefaultAsync(g => g.Id == deck.StudyGroupId.Value);
            if (studyGroup != null && studyGroup.Privacy != StudyGroupPrivacy.Public)
            {
                bool isMember = await dbContext.StudyGroupMembers.AnyAsync(m => m.StudyGroupId == deck.StudyGroupId.Value && m.UserId == userId && m.Status == StudyGroupMemberStatus.Active);
                if (!isMember)
                {
                    return Forbid();
                }
            }
        }

        // All cards in the deck, excluding cards ghosted by this user (evaluated directly in SQL via index)
        List<Card> allCards = await dbContext.Cards
            .Where(c => c.DeckId == deckId && !dbContext.UserGhostedCards.Any(g => g.UserId == userId && g.CardId == c.Id))
            .ToListAsync();

        if (allCards.Count == 0)
        {
            return Ok(new StudyQueueResponse());
        }

        List<int> allCardIds = allCards.Select(c => c.Id).ToList();

        // Find the latest ReviewRecord.Id per card for this user (Max Id = most recent)
        List<long> latestRecordIds = await dbContext.ReviewRecords
            .Where(r => r.UserId == userId && allCardIds.Contains(r.CardId))
            .GroupBy(r => r.CardId)
            .Select(g => g.Max(r => r.Id))
            .ToListAsync();

        // Load the actual latest records (single round-trip)
        Dictionary<int, ReviewRecord> latestByCard = await dbContext.ReviewRecords
            .Where(r => latestRecordIds.Contains(r.Id))
            .ToDictionaryAsync(r => r.CardId);

        DateTime now = DateTime.UtcNow;

        // Classify each card
        List<Card> newCards      = allCards.Where(c => !latestByCard.ContainsKey(c.Id)).ToList();
        List<Card> learningDue   = allCards.Where(c => latestByCard.TryGetValue(c.Id, out var r) && r.Phase == "learning" && r.NextReviewAt <= now).ToList();
        List<Card> reviewDue     = allCards.Where(c => latestByCard.TryGetValue(c.Id, out var r) && r.Phase == "review"   && r.NextReviewAt <= now).ToList();

        // Priority order: Learning cards first (urgent short intervals), then Review, then New
        List<Card> dueCards = [.. learningDue, .. reviewDue, .. newCards];

        return Ok(new StudyQueueResponse
        {
            NewCount      = newCards.Count,
            LearningCount = learningDue.Count,
            ReviewCount   = reviewDue.Count,
            DueCards      = dueCards.Select(c => new CardResponse
            {
                Id             = c.Id,
                DeckId         = c.DeckId,
                Type           = c.Type,
                Prompt         = c.Prompt,
                Answer         = c.Answer
            }).ToList()
        });
    }
}
