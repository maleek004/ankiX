using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AnkiX.Api.Models;

public sealed class Card
{
    public int Id { get; set; }

    public int DeckId { get; set; }

    [MaxLength(50)]
    public string Type { get; set; } = "basic";

    [Required(AllowEmptyStrings = false)]
    [MaxLength(50000)]
    public string Prompt { get; set; } = string.Empty;

    [Required(AllowEmptyStrings = false)]
    [MaxLength(50000)]
    public string Answer { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
