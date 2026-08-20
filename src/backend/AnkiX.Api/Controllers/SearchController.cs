using System.Security.Claims;
using AnkiX.Api.Data;
using AnkiX.Api.Helpers;
using AnkiX.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AnkiX.Api.Controllers;

public sealed class DeckSearchResult
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int CardCount { get; set; }
}

public sealed class CardSearchResult
{
    public int Id { get; set; }
    public int DeckId { get; set; }
    public string DeckTitle { get; set; } = string.Empty;
    public string Prompt { get; set; } = string.Empty;
    public string Answer { get; set; } = string.Empty;
    public string Type { get; set; } = "basic";
}

public sealed class ExerciseSearchResult
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Language { get; set; } = string.Empty;
    public string? StarterCode { get; set; }
}

public sealed class FollowupSearchResult
{
    public long Id { get; set; }
    public int CardId { get; set; }
    public int DeckId { get; set; }
    public string DeckTitle { get; set; } = string.Empty;
    public string QuestionText { get; set; } = string.Empty;
    public string AuthorDisplayName { get; set; } = string.Empty;
    public bool IsAnswered { get; set; }
}

public sealed class GlobalSearchResponse
{
    public string Query { get; set; } = string.Empty;
    public List<DeckSearchResult> Decks { get; set; } = new();
    public List<CardSearchResult> Cards { get; set; } = new();
    public List<ExerciseSearchResult> Exercises { get; set; } = new();
    public List<FollowupSearchResult> Followups { get; set; } = new();
}

[ApiController]
[Route("api/search")]
public sealed class SearchController : ControllerBase
{
    private readonly ApplicationDbContext dbContext;

    public SearchController(ApplicationDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    /// <summary>
    /// Performs keyword search across Decks, Cards, Exercises, and Followups scoped strictly to study groups joined by the user (or public study groups for guests).
    /// Optionally filters to a specific studyGroupId if provided.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<GlobalSearchResponse>> Search([FromQuery] string? q, [FromQuery] int? studyGroupId = null, [FromQuery] int? communityId = null)
    {
        string query = q?.Trim() ?? string.Empty;
        GlobalSearchResponse response = new GlobalSearchResponse { Query = query };

        if (string.IsNullOrWhiteSpace(query) || query.Length < 2)
        {
            return Ok(response);
        }

        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int.TryParse(userIdClaim, out int userId);

        int? targetGroupId = studyGroupId ?? communityId;
        List<int> scopedGroupIds;

        if (userId == 0)
        {
            // Unauthenticated guest: search scoped only to public study groups
            var publicGroupIds = await dbContext.StudyGroups.AsNoTracking()
                .Where(g => g.IsPublic)
                .Select(g => g.Id)
                .ToListAsync();

            if (targetGroupId.HasValue && targetGroupId.Value > 0)
            {
                if (!publicGroupIds.Contains(targetGroupId.Value))
                {
                    return Ok(response);
                }
                scopedGroupIds = new List<int> { targetGroupId.Value };
            }
            else
            {
                scopedGroupIds = publicGroupIds;
            }
        }
        else
        {
            // Retrieve all study group IDs that the authenticated user has joined
            List<int> joinedGroupIds = await dbContext.StudyGroupMembers.AsNoTracking()
                .Where(m => m.UserId == userId)
                .Select(m => m.StudyGroupId)
                .ToListAsync();

            if (targetGroupId.HasValue && targetGroupId.Value > 0)
            {
                // If searching within a specific study group, user MUST be a member of that study group
                if (!joinedGroupIds.Contains(targetGroupId.Value))
                {
                    return Ok(response);
                }
                scopedGroupIds = new List<int> { targetGroupId.Value };
            }
            else
            {
                // Global search -> scope only to study groups joined by the user
                scopedGroupIds = joinedGroupIds;
            }
        }

        if (scopedGroupIds.Count == 0)
        {
            return Ok(response);
        }

        int sampleGroupId = await dbContext.StudyGroups.AsNoTracking()
            .Where(c => c.Slug == "sample")
            .Select(c => c.Id)
            .FirstOrDefaultAsync();

        bool sampleInScope = sampleGroupId > 0 && scopedGroupIds.Contains(sampleGroupId);

        string pattern = $"%{query}%";

        // 1. Search Decks in scoped study groups
        List<DeckSearchResult> decks = await dbContext.Decks.AsNoTracking()
            .Where(d => (d.StudyGroupId.HasValue && scopedGroupIds.Contains(d.StudyGroupId.Value)) || (sampleInScope && (d.StudyGroupId == null || d.StudyGroupId == 0)))
            .Where(d => EF.Functions.Like(d.Title, pattern) || (d.Description != null && EF.Functions.Like(d.Description, pattern)))
            .Select(d => new DeckSearchResult
            {
                Id = d.Id,
                Title = d.Title,
                Description = d.Description,
                CardCount = dbContext.Cards.Count(c => c.DeckId == d.Id)
            })
            .Take(15)
            .ToListAsync();

        List<int> scopedDeckIds = await dbContext.Decks.AsNoTracking()
            .Where(d => (d.StudyGroupId.HasValue && scopedGroupIds.Contains(d.StudyGroupId.Value)) || (sampleInScope && (d.StudyGroupId == null || d.StudyGroupId == 0)))
            .Select(d => d.Id)
            .ToListAsync();

        Dictionary<int, string> deckTitles = await dbContext.Decks.AsNoTracking()
            .Where(d => scopedDeckIds.Contains(d.Id))
            .ToDictionaryAsync(d => d.Id, d => d.Title);

        // 2. Search Cards in scoped decks
        List<CardSearchResult> cards = new List<CardSearchResult>();
        if (scopedDeckIds.Count > 0)
        {
            List<Card> matchingCards = await dbContext.Cards.AsNoTracking()
                .Where(c => scopedDeckIds.Contains(c.DeckId))
                .Where(c => EF.Functions.Like(c.Prompt, pattern) || EF.Functions.Like(c.Answer, pattern))
                .Take(25)
                .ToListAsync();

            cards = matchingCards.Select(c => new CardSearchResult
            {
                Id = c.Id,
                DeckId = c.DeckId,
                DeckTitle = deckTitles.GetValueOrDefault(c.DeckId, "Deck"),
                Prompt = c.Prompt,
                Answer = c.Answer,
                Type = c.Type
            }).ToList();
        }

        // 3. Search Coding Exercises in scoped study groups
        List<ExerciseSearchResult> exercises = await dbContext.Exercises.AsNoTracking()
            .Where(e => (e.StudyGroupId.HasValue && scopedGroupIds.Contains(e.StudyGroupId.Value)) || (sampleInScope && (e.StudyGroupId == null || e.StudyGroupId == 0)))
            .Where(e => EF.Functions.Like(e.Title, pattern) || (e.Description != null && EF.Functions.Like(e.Description, pattern)) || EF.Functions.Like(e.Language, pattern))
            .Take(15)
            .Select(e => new ExerciseSearchResult
            {
                Id = e.Id,
                Title = e.Title,
                Description = e.Description,
                Language = e.Language,
                StarterCode = e.StarterCode
            })
            .ToListAsync();

        // 4. Search Follow-ups in scoped cards
        if (scopedDeckIds.Count > 0)
        {
            List<CardFollowup> matchingFollowups = await dbContext.CardFollowups.AsNoTracking()
                .Where(f => dbContext.Cards.Any(c => c.Id == f.CardId && scopedDeckIds.Contains(c.DeckId)))
                .Where(f => EF.Functions.Like(f.QuestionText, pattern))
                .OrderByDescending(f => f.CreatedAt)
                .Take(15)
                .ToListAsync();

            if (matchingFollowups.Count > 0)
            {
                List<int> authorIds = matchingFollowups.Select(f => f.AuthorUserId).Distinct().ToList();
                var authors = await dbContext.Users.AsNoTracking()
                    .Where(u => authorIds.Contains(u.Id))
                    .Select(u => new { u.Id, u.DisplayName, u.Email })
                    .ToListAsync();

                Dictionary<int, string> userNames = authors.ToDictionary(
                    u => u.Id,
                    u => UserHelper.GetEffectiveDisplayName(u.DisplayName, u.Email)
                );

                List<int> cardIds = matchingFollowups.Select(f => f.CardId).Distinct().ToList();
                Dictionary<int, int> cardDeckIds = await dbContext.Cards.AsNoTracking()
                    .Where(c => cardIds.Contains(c.Id))
                    .ToDictionaryAsync(c => c.Id, c => c.DeckId);

                response.Followups = matchingFollowups.Select(f => new FollowupSearchResult
                {
                    Id = f.Id,
                    CardId = f.CardId,
                    DeckId = cardDeckIds.GetValueOrDefault(f.CardId, 0),
                    DeckTitle = deckTitles.GetValueOrDefault(cardDeckIds.GetValueOrDefault(f.CardId, 0), "Deck"),
                    QuestionText = f.QuestionText,
                    AuthorDisplayName = userNames.GetValueOrDefault(f.AuthorUserId, "User"),
                    IsAnswered = f.LinkedCardId.HasValue || !string.IsNullOrWhiteSpace(f.LinkedCardIds)
                }).ToList();
            }
        }

        response.Decks = decks;
        response.Cards = cards;
        response.Exercises = exercises;

        return Ok(response);
    }
}
