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
    [Authorize(Roles = $"{Roles.Contributor},{Roles.Admin}")]
    public async Task<ActionResult<DeckResponse>> CreateDeck([FromBody] CreateDeckRequest request)
    {
        Deck deck = new Deck
        {
            Title = request.Title.Trim(),
            Description = request.Description?.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        dbContext.Decks.Add(deck);
        await dbContext.SaveChangesAsync();

        DeckResponse response = new DeckResponse
        {
            Id = deck.Id,
            Title = deck.Title,
            Description = deck.Description
        };

        return CreatedAtAction(nameof(DecksController.GetDecks), "Decks", new { id = deck.Id }, response);
    }

    [HttpPut("decks/{deckId:int}")]
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
    [Authorize(Roles = $"{Roles.Contributor},{Roles.Admin}")]
    public async Task<ActionResult<CardResponse>> CreateCard([FromBody] CreateCardRequest request)
    {
        bool deckExists = await dbContext.Decks.AnyAsync(deck => deck.Id == request.DeckId);
        if (!deckExists)
        {
            return NotFound(new { message = "Deck not found." });
        }

        string cardType = request.Type.Trim().ToLowerInvariant();
        if (cardType is not "micro-coding" and not "concept")
        {
            return BadRequest(new { message = "Card type must be 'micro-coding' or 'concept'." });
        }

        Card card = new Card
        {
            DeckId = request.DeckId,
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
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> UpdateCard([FromRoute] int cardId, [FromBody] UpdateCardRequest request)
    {
        Card? card = await dbContext.Cards.FirstOrDefaultAsync(entity => entity.Id == cardId);
        if (card is null)
        {
            return NotFound(new { message = "Card not found." });
        }

        string cardType = request.Type.Trim().ToLowerInvariant();
        if (cardType is not "micro-coding" and not "concept")
        {
            return BadRequest(new { message = "Card type must be 'micro-coding' or 'concept'." });
        }

        card.Type = cardType;
        card.Prompt = request.Prompt.Trim();
        card.ValidationSpec = request.ValidationSpec;
        await dbContext.SaveChangesAsync();
        return Ok();
    }

    [HttpDelete("cards/{cardId:int}")]
    [Authorize(Roles = Roles.Admin)]
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
