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
        List<DeckResponse> decks = await dbContext.Decks
            .OrderBy(deck => deck.Title)
            .Select(deck => new DeckResponse
            {
                Id = deck.Id,
                Title = deck.Title,
                Description = deck.Description
            })
            .ToListAsync();

        return Ok(decks);
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
}
