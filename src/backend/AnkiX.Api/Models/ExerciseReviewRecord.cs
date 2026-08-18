using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AnkiX.Api.Models;

public sealed class ExerciseReviewRecord
{
    public long Id { get; set; }

    public int ExerciseId { get; set; }

    public int UserId { get; set; }

    [MaxLength(10)]
    public string Outcome { get; set; } = string.Empty;

    [Column(TypeName = "decimal(4,2)")]
    public decimal EaseFactor { get; set; }

    public int IntervalDays { get; set; }

    public DateTime NextReviewAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [MaxLength(10)]
    public string Phase { get; set; } = "learning";

    public int LearningStep { get; set; }
}
