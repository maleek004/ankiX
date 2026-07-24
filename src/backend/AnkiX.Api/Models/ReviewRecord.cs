using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AnkiX.Api.Models;

public sealed class ReviewRecord
{
    public long Id { get; set; }

    public int CardId { get; set; }

    public int UserId { get; set; }

    [MaxLength(10)]
    public string Outcome { get; set; } = string.Empty;

    [Column(TypeName = "decimal(4,2)")]
    public decimal EaseFactor { get; set; }

    public int IntervalDays { get; set; }

    [Column(TypeName = "datetime2")]
    public DateTime NextReviewAt { get; set; }

    [Column(TypeName = "datetime2")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
