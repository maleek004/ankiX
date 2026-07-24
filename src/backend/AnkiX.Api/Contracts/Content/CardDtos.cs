using System.ComponentModel.DataAnnotations;

namespace AnkiX.Api.Contracts.Content;

public sealed class CardResponse
{
    public int Id { get; set; }

    public int DeckId { get; set; }

    public string Type { get; set; } = string.Empty;

    public string Prompt { get; set; } = string.Empty;

    public string? ValidationSpec { get; set; }
}

public sealed class CreateCardRequest
{
    [Required]
    public int DeckId { get; set; }

    [Required]
    [MaxLength(50)]
    public string Type { get; set; } = string.Empty;

    [Required]
    public string Prompt { get; set; } = string.Empty;

    public string? ValidationSpec { get; set; }
}

public sealed class UpdateCardRequest
{
    [Required]
    [MaxLength(50)]
    public string Type { get; set; } = string.Empty;

    [Required]
    public string Prompt { get; set; } = string.Empty;

    public string? ValidationSpec { get; set; }
}
