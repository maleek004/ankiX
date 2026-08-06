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
    public async Task<ActionResult<IEnumerable<DeckResponse>>> GetDecks([FromQuery] int? communityId = null)
    {
        int userId = 0;
        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int.TryParse(userIdClaim, out userId);

        DateTime now = DateTime.UtcNow;

        var decksQuery = dbContext.Decks.AsQueryable();
        if (communityId.HasValue)
        {
            decksQuery = decksQuery.Where(deck => deck.CommunityId == communityId.Value);
        }

        var rawDecks = await decksQuery
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

    [HttpPost("{deckId:int}/import-cards")]
    [Authorize(Roles = $"{Roles.Contributor},{Roles.Admin}")]
    public async Task<ActionResult<ImportCardsResponse>> ImportCardsFromFile([FromRoute] int deckId, IFormFile? file)
    {
        Deck? deck = await dbContext.Decks.FirstOrDefaultAsync(d => d.Id == deckId);
        if (deck is null)
        {
            return NotFound(new { message = "Deck not found." });
        }

        if (file is null || file.Length == 0)
        {
            return BadRequest(new { message = "Please provide a valid file to import." });
        }

        string fileContent;
        using (var reader = new StreamReader(file.OpenReadStream()))
        {
            fileContent = await reader.ReadToEndAsync();
        }

        var parsed = ParseFlatFileContent(fileContent, file.FileName);
        return await ProcessImportedCards(deckId, parsed);
    }

    [HttpPost("{deckId:int}/import-cards-text")]
    [Authorize(Roles = $"{Roles.Contributor},{Roles.Admin}")]
    public async Task<ActionResult<ImportCardsResponse>> ImportCardsFromText([FromRoute] int deckId, [FromBody] ImportCardsTextRequest request)
    {
        Deck? deck = await dbContext.Decks.FirstOrDefaultAsync(d => d.Id == deckId);
        if (deck is null)
        {
            return NotFound(new { message = "Deck not found." });
        }

        if (string.IsNullOrWhiteSpace(request.Content))
        {
            return BadRequest(new { message = "Content to import cannot be empty." });
        }

        var parsed = ParseFlatFileContent(request.Content, request.Format ?? "csv");
        return await ProcessImportedCards(deckId, parsed);
    }

    private async Task<ImportCardsResponse> ProcessImportedCards(int deckId, List<(string prompt, string type, string validationSpec)> parsedCards)
    {
        int importedCount = 0;
        int skippedCount = 0;
        var createdCards = new List<Card>();

        foreach (var (prompt, type, validationSpec) in parsedCards)
        {
            if (string.IsNullOrWhiteSpace(prompt))
            {
                skippedCount++;
                continue;
            }

            var card = new Card
            {
                DeckId = deckId,
                Prompt = prompt,
                Type = !string.IsNullOrWhiteSpace(type) ? type : "basic",
                ValidationSpec = validationSpec,
                CreatedAt = DateTime.UtcNow
            };

            createdCards.Add(card);
            importedCount++;
        }

        if (createdCards.Count > 0)
        {
            dbContext.Cards.AddRange(createdCards);
            await dbContext.SaveChangesAsync();
        }

        var responses = createdCards.Select(c => new CardResponse
        {
            Id = c.Id,
            DeckId = c.DeckId,
            Type = c.Type,
            Prompt = c.Prompt,
            ValidationSpec = c.ValidationSpec
        }).ToList();

        return new ImportCardsResponse
        {
            DeckId = deckId,
            ImportedCount = importedCount,
            SkippedCount = skippedCount,
            TotalParsed = parsedCards.Count,
            Cards = responses
        };
    }

    private static List<(string prompt, string type, string validationSpec)> ParseFlatFileContent(string content, string fileNameOrFormat)
    {
        var list = new List<(string prompt, string type, string validationSpec)>();
        if (string.IsNullOrWhiteSpace(content)) return list;

        string trimmed = content.Trim();
        bool isJson = fileNameOrFormat.EndsWith(".json", StringComparison.OrdinalIgnoreCase) || trimmed.StartsWith("[") || trimmed.StartsWith("{");

        if (isJson)
        {
            try
            {
                using var doc = System.Text.Json.JsonDocument.Parse(trimmed);
                var root = doc.RootElement;
                if (root.ValueKind == System.Text.Json.JsonValueKind.Array)
                {
                    foreach (var item in root.EnumerateArray())
                    {
                        string p = item.TryGetProperty("prompt", out var pProp) ? pProp.GetString() ?? "" : "";
                        string t = item.TryGetProperty("type", out var tProp) ? tProp.GetString() ?? "basic" : "basic";
                        string v = "";
                        if (item.TryGetProperty("validationSpec", out var vProp))
                        {
                            v = vProp.ValueKind == System.Text.Json.JsonValueKind.String ? vProp.GetString() ?? "" : vProp.GetRawText();
                        }
                        else if (item.TryGetProperty("answer", out var aProp))
                        {
                            string ans = aProp.GetString() ?? "";
                            v = System.Text.Json.JsonSerializer.Serialize(new { answer = ans });
                        }

                        if (!string.IsNullOrWhiteSpace(p))
                        {
                            list.Add((p.Trim(), string.IsNullOrWhiteSpace(t) ? "basic" : t.Trim(), NormalizeValidationSpec(v)));
                        }
                    }
                }
            }
            catch { }
            return list;
        }

        char delimiter = fileNameOrFormat.EndsWith(".tsv", StringComparison.OrdinalIgnoreCase) ? '\t' : ',';
        if (content.Contains('\t') && !content.Contains(',')) delimiter = '\t';
        else if (content.Contains(';') && !content.Contains(',')) delimiter = ';';

        var lines = content.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.RemoveEmptyEntries);
        bool isFirstLineHeader = false;

        if (lines.Length > 0)
        {
            string headerLower = lines[0].ToLowerInvariant();
            if (headerLower.Contains("prompt") || headerLower.Contains("question") || headerLower.Contains("front"))
            {
                isFirstLineHeader = true;
            }
        }

        int startIndex = isFirstLineHeader ? 1 : 0;
        for (int i = startIndex; i < lines.Length; i++)
        {
            string line = lines[i].Trim();
            if (string.IsNullOrWhiteSpace(line) || line.StartsWith("#")) continue;

            var fields = ParseCsvLine(line, delimiter);
            if (fields.Count == 0) continue;

            string prompt = fields[0].Trim();
            if (string.IsNullOrWhiteSpace(prompt)) continue;

            string type = "basic";
            string valSpec = "";

            if (fields.Count == 2)
            {
                valSpec = NormalizeValidationSpec(fields[1].Trim());
            }
            else if (fields.Count >= 3)
            {
                type = string.IsNullOrWhiteSpace(fields[1]) ? "basic" : fields[1].Trim();
                valSpec = NormalizeValidationSpec(fields[2].Trim());
            }

            list.Add((prompt, type, valSpec));
        }

        return list;
    }

    private static string NormalizeValidationSpec(string spec)
    {
        if (string.IsNullOrWhiteSpace(spec)) return "{\"answer\":\"\"}";
        spec = spec.Trim();
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(spec);
            return spec;
        }
        catch
        {
            return System.Text.Json.JsonSerializer.Serialize(new { answer = spec });
        }
    }

    private static List<string> ParseCsvLine(string line, char delimiter)
    {
        var result = new List<string>();
        bool inQuotes = false;
        var currentField = new System.Text.StringBuilder();

        for (int i = 0; i < line.Length; i++)
        {
            char c = line[i];
            if (c == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                {
                    currentField.Append('"');
                    i++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }
            }
            else if (c == delimiter && !inQuotes)
            {
                result.Add(currentField.ToString());
                currentField.Clear();
            }
            else
            {
                currentField.Append(c);
            }
        }
        result.Add(currentField.ToString());
        return result;
    }
}
