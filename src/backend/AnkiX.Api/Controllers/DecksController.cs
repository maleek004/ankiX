using System.Security.Claims;
using AnkiX.Api.Contracts.Content;
using AnkiX.Api.Data;
using AnkiX.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AnkiX.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/decks")]
public sealed class DecksController : ControllerBase
{
    private readonly ApplicationDbContext dbContext;

    public DecksController(ApplicationDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<DeckResponse>>> GetDecks()
    {
        int userId = 0;
        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int.TryParse(userIdClaim, out userId);

        DateTime now = DateTime.UtcNow;

        var rawDecks = await dbContext.Decks
            .OrderBy(deck => deck.Title)
            .Select(deck => new
            {
                deck.Id,
                deck.Title,
                deck.Description,
                deck.CreatedByUserId,
                Cards = dbContext.Cards
                    .Where(c => c.DeckId == deck.Id)
                    .Select(c => new
                    {
                        c.Id,
                        LatestReview = dbContext.ReviewRecords
                            .Where(r => r.CardId == c.Id && r.UserId == userId)
                            .OrderByDescending(r => r.CreatedAt)
                            .Select(r => new { r.NextReviewAt })
                            .FirstOrDefault()
                    })
                    .ToList()
            })
            .ToListAsync();

        List<DeckResponse> response = new List<DeckResponse>();

        foreach (var deck in rawDecks)
        {
            int dueCount = 0;
            int learnCount = 0;

            foreach (var card in deck.Cards)
            {
                if (card.LatestReview == null)
                {
                    learnCount++;
                }
                else if (card.LatestReview.NextReviewAt <= now)
                {
                    dueCount++;
                }
                else
                {
                    learnCount++;
                }
            }

            response.Add(new DeckResponse
            {
                Id = deck.Id,
                Title = deck.Title,
                Description = deck.Description,
                CreatedByUserId = deck.CreatedByUserId,
                DueCount = dueCount,
                LearnCount = learnCount
            });
        }

        return Ok(response);
    }

    [HttpGet("{deckId:int}/cards")]
    public async Task<ActionResult<IEnumerable<CardResponse>>> GetCardsByDeck([FromRoute] int deckId)
    {
        bool deckExists = await dbContext.Decks.AnyAsync(deck => deck.Id == deckId);
        if (!deckExists)
        {
            return NotFound(new { message = "Deck not found." });
        }

        List<CardResponse> cards = await dbContext.Cards
            .Where(card => card.DeckId == deckId)
            .OrderBy(card => card.Id)
            .Select(card => new CardResponse
            {
                Id = card.Id,
                DeckId = card.DeckId,
                Type = card.Type,
                Prompt = card.Prompt,
                ValidationSpec = card.ValidationSpec
            })
            .ToListAsync();

        return Ok(cards);
    }

    [HttpPost("{deckId:int}/reset")]
    public async Task<IActionResult> ResetDeckProgress([FromRoute] int deckId)
    {
        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized(new { message = "Invalid user identity in token." });
        }

        bool deckExists = await dbContext.Decks.AnyAsync(deck => deck.Id == deckId);
        if (!deckExists)
        {
            return NotFound(new { message = "Deck not found." });
        }

        List<int> cardIds = await dbContext.Cards
            .Where(card => card.DeckId == deckId)
            .Select(card => card.Id)
            .ToListAsync();

        List<ReviewRecord> userReviews = await dbContext.ReviewRecords
            .Where(record => record.UserId == userId && cardIds.Contains(record.CardId))
            .ToListAsync();

        if (userReviews.Count > 0)
        {
            dbContext.ReviewRecords.RemoveRange(userReviews);
            await dbContext.SaveChangesAsync();
        }

        return Ok(new { message = "Deck progress reset successfully." });
    }
}
