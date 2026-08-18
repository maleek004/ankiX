using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AnkiX.Api.Models;

public sealed class Deck
{
    public int Id { get; set; }

    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? Description { get; set; }

    public int? CreatedByUserId { get; set; }

    public int? StudyGroupId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
