using AnkiX.Api.Data;
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
    public string? ValidationSpec { get; set; }
    public string Type { get; set; } = string.Empty;
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
[Authorize]
[Route("api/search")]
public sealed class SearchController : ControllerBase
{
    private readonly ApplicationDbContext dbContext;

    public SearchController(ApplicationDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    /// <summary>
    /// Performs platform-wide keyword search across Decks, Cards, Exercises, and Followups.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<GlobalSearchResponse>> Search([FromQuery] string? q)
    {
        string query = q?.Trim() ?? string.Empty;
        GlobalSearchResponse response = new GlobalSearchResponse { Query = query };

        if (string.IsNullOrWhiteSpace(query) || query.Length < 2)
        {
            return Ok(response);
        }

        string pattern = $"%{query}%";

        // 1. Search Decks
        List<DeckSearchResult> decks = await dbContext.Decks
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

        // Load deck titles dictionary for quick lookup
        Dictionary<int, string> deckTitles = await dbContext.Decks
            .ToDictionaryAsync(d => d.Id, d => d.Title);

        // 2. Search Cards
        List<Card> matchingCards = await dbContext.Cards
            .Where(c => EF.Functions.Like(c.Prompt, pattern) || (c.ValidationSpec != null && EF.Functions.Like(c.ValidationSpec, pattern)))
            .Take(25)
            .ToListAsync();

        List<CardSearchResult> cards = matchingCards.Select(c => new CardSearchResult
        {
            Id = c.Id,
            DeckId = c.DeckId,
            DeckTitle = deckTitles.GetValueOrDefault(c.DeckId, "Deck"),
            Prompt = c.Prompt,
            ValidationSpec = c.ValidationSpec,
            Type = c.Type
        }).ToList();

        // 3. Search Coding Exercises
        List<ExerciseSearchResult> exercises = await dbContext.Exercises
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

        // 4. Search Follow-ups
        List<CardFollowup> matchingFollowups = await dbContext.CardFollowups
            .Where(f => EF.Functions.Like(f.QuestionText, pattern))
            .OrderByDescending(f => f.CreatedAt)
            .Take(15)
            .ToListAsync();

        if (matchingFollowups.Count > 0)
        {
            List<int> authorIds = matchingFollowups.Select(f => f.AuthorUserId).Distinct().ToList();
            Dictionary<int, string> userNames = await dbContext.Users
                .Where(u => authorIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u.DisplayName ?? u.Email);

            List<int> cardIds = matchingFollowups.Select(f => f.CardId).Distinct().ToList();
            Dictionary<int, int> cardDeckIds = await dbContext.Cards
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

        response.Decks = decks;
        response.Cards = cards;
        response.Exercises = exercises;

        return Ok(response);
    }
}
