using System.ComponentModel.DataAnnotations;
using AnkiX.Api.Contracts.Study;

namespace AnkiX.Api.Contracts.Content;

public sealed class CardResponse
{
    public int Id { get; set; }

    public int DeckId { get; set; }

    public string Type { get; set; } = "basic";

    public string Prompt { get; set; } = string.Empty;

    public string Answer { get; set; } = string.Empty;

    public bool IsGhosted { get; set; }

    /// <summary>Precomputed next-interval previews for all four rating outcomes. Null for guest sessions.</summary>
    public NextIntervalsDto? NextIntervals { get; set; }
}

public sealed class GhostCardStatusResponse
{
    public int CardId { get; set; }

    public bool IsGhosted { get; set; }

    public string Message { get; set; } = string.Empty;
}

public sealed class CreateCardRequest
{
    [Required]
    public int DeckId { get; set; }

    [MaxLength(50)]
    public string Type { get; set; } = "basic";

    [Required]
    public string Prompt { get; set; } = string.Empty;

    [Required]
    public string Answer { get; set; } = string.Empty;
}

public sealed class UpdateCardRequest
{
    [MaxLength(50)]
    public string Type { get; set; } = "basic";

    [Required]
    public string Prompt { get; set; } = string.Empty;

    [Required]
    public string Answer { get; set; } = string.Empty;
}

public sealed class CopyCardRequest
{
    [Required]
    public int SourceCardId { get; set; }

    [Required]
    public int TargetDeckId { get; set; }
}

