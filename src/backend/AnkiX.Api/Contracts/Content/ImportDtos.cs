using System.ComponentModel.DataAnnotations;

namespace AnkiX.Api.Contracts.Content;

public sealed class ImportCardsTextRequest
{
    [Required]
    public string Content { get; set; } = string.Empty;

    public string Format { get; set; } = "csv"; // "csv", "tsv", "json"
}

public sealed class ImportCardsResponse
{
    public int DeckId { get; set; }

    public int ImportedCount { get; set; }

    public int SkippedCount { get; set; }

    public int TotalParsed { get; set; }

    public List<CardResponse> Cards { get; set; } = new();
}
