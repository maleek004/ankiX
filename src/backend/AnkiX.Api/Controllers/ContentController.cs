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
[Route("api/content")]
public sealed class ContentController : ControllerBase
{
    private readonly ApplicationDbContext dbContext;

    public ContentController(ApplicationDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    [HttpPost("decks")]
    [HttpPost("/api/decks")]
    [Authorize(Roles = $"{Roles.Contributor},{Roles.Admin}")]
    public async Task<ActionResult<DeckResponse>> CreateDeck([FromBody] CreateDeckRequest request)
    {
        int? userId = null;
        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (int.TryParse(userIdClaim, out int parsedId))
        {
            userId = parsedId;
        }

        Deck deck = new Deck
        {
            Title = request.Title.Trim(),
            Description = request.Description?.Trim(),
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.Decks.Add(deck);
        await dbContext.SaveChangesAsync();

        DeckResponse response = new DeckResponse
        {
            Id = deck.Id,
            Title = deck.Title,
            Description = deck.Description,
            CreatedByUserId = deck.CreatedByUserId
        };

        return CreatedAtAction(nameof(DecksController.GetDecks), "Decks", new { id = deck.Id }, response);
    }

    [HttpPut("decks/{deckId:int}")]
    [HttpPut("/api/decks/{deckId:int}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> UpdateDeck([FromRoute] int deckId, [FromBody] UpdateDeckRequest request)
    {
        Deck? deck = await dbContext.Decks.FirstOrDefaultAsync(entity => entity.Id == deckId);
        if (deck is null)
        {
            return NotFound(new { message = "Deck not found." });
        }

        deck.Title = request.Title.Trim();
        deck.Description = request.Description?.Trim();
        await dbContext.SaveChangesAsync();
        return Ok();
    }

    [HttpDelete("decks/{deckId:int}")]
    [HttpDelete("/api/decks/{deckId:int}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> DeleteDeck([FromRoute] int deckId)
    {
        Deck? deck = await dbContext.Decks.FirstOrDefaultAsync(entity => entity.Id == deckId);
        if (deck is null)
        {
            return NotFound(new { message = "Deck not found." });
        }

        bool hasCards = await dbContext.Cards.AnyAsync(card => card.DeckId == deckId);
        if (hasCards)
        {
            return Conflict(new { message = "Deck cannot be deleted while cards exist." });
        }

        dbContext.Decks.Remove(deck);
        await dbContext.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("cards")]
    [HttpPost("/api/decks/{deckId:int}/cards")]
    [Authorize(Roles = $"{Roles.Contributor},{Roles.Admin}")]
    public async Task<ActionResult<CardResponse>> CreateCard([FromBody] CreateCardRequest request, [FromRoute] int? deckId = null)
    {
        int targetDeckId = request.DeckId > 0 ? request.DeckId : (deckId ?? 0);
        bool deckExists = await dbContext.Decks.AnyAsync(deck => deck.Id == targetDeckId);
        if (!deckExists)
        {
            return NotFound(new { message = "Deck not found." });
        }

        string cardType = request.Type.Trim().ToLowerInvariant();
        if (cardType is not "micro-coding" and not "concept" and not "basic")
        {
            return BadRequest(new { message = "Card type must be 'micro-coding', 'concept', or 'basic'." });
        }

        Card card = new Card
        {
            DeckId = targetDeckId,
            Type = cardType,
            Prompt = request.Prompt.Trim(),
            ValidationSpec = request.ValidationSpec,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.Cards.Add(card);
        await dbContext.SaveChangesAsync();

        CardResponse response = new CardResponse
        {
            Id = card.Id,
            DeckId = card.DeckId,
            Type = card.Type,
            Prompt = card.Prompt,
            ValidationSpec = card.ValidationSpec
        };

        return CreatedAtAction(nameof(DecksController.GetCardsByDeck), "Decks", new { deckId = card.DeckId }, response);
    }

    [HttpPut("cards/{cardId:int}")]
    [HttpPut("/api/decks/{deckId:int}/cards/{cardId:int}")]
    [Authorize]
    public async Task<IActionResult> UpdateCard([FromRoute] int cardId, [FromBody] UpdateCardRequest request)
    {
        Card? card = await dbContext.Cards.FirstOrDefaultAsync(entity => entity.Id == cardId);
        if (card is null)
        {
            return NotFound(new { message = "Card not found." });
        }

        string cardType = request.Type.Trim().ToLowerInvariant();
        if (cardType is not "micro-coding" and not "concept" and not "basic")
        {
            return BadRequest(new { message = "Card type must be 'micro-coding', 'concept', or 'basic'." });
        }

        card.Type = cardType;
        card.Prompt = request.Prompt.Trim();
        card.ValidationSpec = request.ValidationSpec;
        await dbContext.SaveChangesAsync();
        return Ok();
    }

    [HttpGet("cards/{cardId:int}")]
    [HttpGet("/api/cards/{cardId:int}")]
    public async Task<ActionResult<CardResponse>> GetCard([FromRoute] int cardId)
    {
        Card? card = await dbContext.Cards.FirstOrDefaultAsync(entity => entity.Id == cardId);
        if (card is null)
        {
            return NotFound(new { message = "Card not found." });
        }

        return Ok(new CardResponse
        {
            Id = card.Id,
            DeckId = card.DeckId,
            Type = card.Type,
            Prompt = card.Prompt,
            ValidationSpec = card.ValidationSpec
        });
    }

    [HttpGet("cards")]
    [HttpGet("/api/cards")]
    public async Task<ActionResult<IEnumerable<CardResponse>>> GetAllCards()
    {
        List<CardResponse> cards = await dbContext.Cards
            .OrderByDescending(c => c.Id)
            .Select(c => new CardResponse
            {
                Id = c.Id,
                DeckId = c.DeckId,
                Type = c.Type,
                Prompt = c.Prompt,
                ValidationSpec = c.ValidationSpec
            })
            .ToListAsync();

        return Ok(cards);
    }

    [HttpDelete("cards/{cardId:int}")]
    [HttpDelete("/api/decks/{deckId:int}/cards/{cardId:int}")]
    [Authorize]
    public async Task<IActionResult> DeleteCard([FromRoute] int cardId)
    {
        Card? card = await dbContext.Cards.FirstOrDefaultAsync(entity => entity.Id == cardId);
        if (card is null)
        {
            return NotFound(new { message = "Card not found." });
        }

        dbContext.Cards.Remove(card);
        await dbContext.SaveChangesAsync();
        return NoContent();
    }
}
