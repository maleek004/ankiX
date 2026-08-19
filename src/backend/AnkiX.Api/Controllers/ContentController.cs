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
    [Authorize]
    public async Task<ActionResult<DeckResponse>> CreateDeck([FromBody] CreateDeckRequest request)
    {
        int? userId = null;
        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (int.TryParse(userIdClaim, out int parsedId))
        {
            userId = parsedId;
        }

        if (!await CanManageContentAsync(request.StudyGroupId)) return Forbid();

        Deck deck = new Deck
        {
            Title = request.Title.Trim(),
            Description = request.Description?.Trim(),
            CreatedByUserId = userId,
            StudyGroupId = request.StudyGroupId,
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
    [Authorize]
    public async Task<IActionResult> UpdateDeck([FromRoute] int deckId, [FromBody] UpdateDeckRequest request)
    {
        Deck? deck = await dbContext.Decks.FirstOrDefaultAsync(entity => entity.Id == deckId);
        if (deck is null)
        {
            return NotFound(new { message = "Deck not found." });
        }

        if (!await CanManageContentAsync(deck.StudyGroupId)) return Forbid();

        deck.Title = request.Title.Trim();
        deck.Description = request.Description?.Trim();
        await dbContext.SaveChangesAsync();
        return Ok();
    }

    [HttpDelete("decks/{deckId:int}")]
    [HttpDelete("/api/decks/{deckId:int}")]
    [Authorize]
    public async Task<IActionResult> DeleteDeck([FromRoute] int deckId)
    {
        Deck? deck = await dbContext.Decks.FirstOrDefaultAsync(entity => entity.Id == deckId);
        if (deck is null)
        {
            return NotFound(new { message = "Deck not found." });
        }

        if (!await CanManageContentAsync(deck.StudyGroupId)) return Forbid();

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
    [Authorize]
    public async Task<ActionResult<CardResponse>> CreateCard([FromBody] CreateCardRequest request, [FromRoute] int? deckId = null)
    {
        int targetDeckId = request.DeckId > 0 ? request.DeckId : (deckId ?? 0);
        Deck? targetDeck = await dbContext.Decks.FirstOrDefaultAsync(d => d.Id == targetDeckId);
        if (targetDeck is null) return NotFound(new { message = "Deck not found." });
        if (!await CanManageContentAsync(targetDeck.StudyGroupId)) return Forbid();

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

        Deck? deck = await dbContext.Decks.FirstOrDefaultAsync(d => d.Id == card.DeckId);
        if (!await CanManageContentAsync(deck?.StudyGroupId)) return Forbid();

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
    [AllowAnonymous]
    public async Task<ActionResult<CardResponse>> GetCard([FromRoute] int cardId)
    {
        Card? card = await dbContext.Cards.FirstOrDefaultAsync(entity => entity.Id == cardId);
        if (card is null)
        {
            return NotFound(new { message = "Card not found." });
        }

        Deck? deck = await dbContext.Decks.AsNoTracking().FirstOrDefaultAsync(d => d.Id == card.DeckId);
        if (deck is null)
        {
            return NotFound(new { message = "Card not found." });
        }

        int userId = 0;
        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (int.TryParse(userIdClaim, out int parsedId))
        {
            userId = parsedId;
        }

        bool isSuperAdmin = User.IsInRole(Roles.SuperAdmin) || User.IsInRole(Roles.Admin);
        if (deck.StudyGroupId.HasValue && deck.StudyGroupId.Value > 0)
        {
            var studyGroup = await dbContext.StudyGroups.AsNoTracking().FirstOrDefaultAsync(c => c.Id == deck.StudyGroupId.Value);
            if (studyGroup is not null && !studyGroup.IsPublic && !isSuperAdmin)
            {
                if (userId == 0)
                {
                    return NotFound(new { message = "Card not found." });
                }

                bool isMember = await dbContext.StudyGroupMembers.AnyAsync(cm => cm.StudyGroupId == studyGroup.Id && cm.UserId == userId);
                if (!isMember)
                {
                    return NotFound(new { message = "Card not found." });
                }
            }
        }
        else
        {
            var sampleGroupId = await dbContext.StudyGroups.AsNoTracking().Where(c => c.Slug == "sample").Select(c => c.Id).FirstOrDefaultAsync();
            if (userId == 0 && (sampleGroupId == 0 || deck.StudyGroupId != sampleGroupId))
            {
                return NotFound(new { message = "Card not found." });
            }
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
    [AllowAnonymous]
    public async Task<ActionResult<IEnumerable<CardResponse>>> GetAllCards([FromQuery] int? studyGroupId = null)
    {
        int userId = 0;
        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (int.TryParse(userIdClaim, out int parsedId))
        {
            userId = parsedId;
        }

        bool isSuperAdmin = User.IsInRole(Roles.SuperAdmin) || User.IsInRole(Roles.Admin);
        var sampleGroupId = await dbContext.StudyGroups.AsNoTracking().Where(c => c.Slug == "sample").Select(c => c.Id).FirstOrDefaultAsync();

        var decksQuery = dbContext.Decks.AsQueryable();
        if (studyGroupId.HasValue && studyGroupId.Value > 0)
        {
            var targetGroup = await dbContext.StudyGroups.AsNoTracking().FirstOrDefaultAsync(c => c.Id == studyGroupId.Value);
            if (targetGroup is not null && !targetGroup.IsPublic && !isSuperAdmin)
            {
                if (userId == 0) return Ok(Array.Empty<CardResponse>());
                bool isMember = await dbContext.StudyGroupMembers.AnyAsync(cm => cm.StudyGroupId == targetGroup.Id && cm.UserId == userId);
                if (!isMember) return Ok(Array.Empty<CardResponse>());
            }

            if (studyGroupId.Value == sampleGroupId || sampleGroupId == 0)
            {
                decksQuery = decksQuery.Where(deck => deck.StudyGroupId == studyGroupId.Value || deck.StudyGroupId == null || deck.StudyGroupId == 0);
            }
            else
            {
                decksQuery = decksQuery.Where(deck => deck.StudyGroupId == studyGroupId.Value);
            }
        }
        else if (userId == 0)
        {
            var publicGroupIds = await dbContext.StudyGroups.AsNoTracking().Where(c => c.IsPublic).Select(c => c.Id).ToListAsync();
            decksQuery = decksQuery.Where(deck => (deck.StudyGroupId.HasValue && publicGroupIds.Contains(deck.StudyGroupId.Value))
                                               || (sampleGroupId > 0 && deck.StudyGroupId == sampleGroupId));
        }

        List<int> deckIds = await decksQuery.Select(d => d.Id).ToListAsync();

        List<CardResponse> cards = await dbContext.Cards
            .Where(c => deckIds.Contains(c.DeckId))
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

        Deck? deck = await dbContext.Decks.FirstOrDefaultAsync(d => d.Id == card.DeckId);
        if (!await CanManageContentAsync(deck?.StudyGroupId)) return Forbid();

        dbContext.Cards.Remove(card);
        await dbContext.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("cards/copy")]
    [HttpPost("/api/cards/copy")]
    [Authorize]
    public async Task<ActionResult<CardResponse>> CopyCard([FromBody] CopyCardRequest request)
    {
        Card? sourceCard = await dbContext.Cards.FirstOrDefaultAsync(c => c.Id == request.SourceCardId);
        if (sourceCard is null)
        {
            return NotFound(new { message = "Source card not found." });
        }

        Deck? sourceDeck = await dbContext.Decks.FirstOrDefaultAsync(d => d.Id == sourceCard.DeckId);
        if (!await CanReadContentAsync(sourceDeck?.StudyGroupId))
        {
            return Forbid();
        }

        Deck? targetDeck = await dbContext.Decks.FirstOrDefaultAsync(d => d.Id == request.TargetDeckId);
        if (targetDeck is null)
        {
            return NotFound(new { message = "Target deck not found." });
        }

        if (!await CanManageContentAsync(targetDeck.StudyGroupId))
        {
            return Forbid();
        }

        Card newCard = new Card
        {
            DeckId = targetDeck.Id,
            Type = sourceCard.Type,
            Prompt = sourceCard.Prompt,
            ValidationSpec = sourceCard.ValidationSpec,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.Cards.Add(newCard);
        await dbContext.SaveChangesAsync();

        CardResponse response = new CardResponse
        {
            Id = newCard.Id,
            DeckId = newCard.DeckId,
            Type = newCard.Type,
            Prompt = newCard.Prompt,
            ValidationSpec = newCard.ValidationSpec
        };

        return CreatedAtAction(nameof(DecksController.GetCardsByDeck), "Decks", new { deckId = newCard.DeckId }, response);
    }

    private async Task<bool> CanReadContentAsync(int? studyGroupId)
    {
        if (!studyGroupId.HasValue || studyGroupId.Value <= 0)
        {
            return true;
        }

        if (User.IsInRole(Roles.Admin) || User.IsInRole(Roles.Contributor))
        {
            return true;
        }

        var group = await dbContext.StudyGroups.AsNoTracking().FirstOrDefaultAsync(g => g.Id == studyGroupId.Value);
        if (group == null)
        {
            return false;
        }

        if (group.IsPublic)
        {
            return true;
        }

        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out int userId))
        {
            return false;
        }

        return await dbContext.StudyGroupMembers.AsNoTracking()
            .AnyAsync(m => m.StudyGroupId == studyGroupId.Value && m.UserId == userId);
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

