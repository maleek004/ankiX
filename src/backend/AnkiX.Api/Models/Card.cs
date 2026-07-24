using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AnkiX.Api.Models;

public sealed class Card
{
    public int Id { get; set; }

    public int DeckId { get; set; }

    [MaxLength(50)]
    public string Type { get; set; } = string.Empty;

    public string Prompt { get; set; } = string.Empty;

    public string? ValidationSpec { get; set; }

    [Column(TypeName = "datetime2")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
