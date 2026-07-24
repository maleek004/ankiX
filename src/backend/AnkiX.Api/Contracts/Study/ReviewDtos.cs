using System.ComponentModel.DataAnnotations;

namespace AnkiX.Api.Contracts.Study;

public sealed class ReviewRequest
{
    [Required]
    public int CardId { get; set; }

    [Required]
    [RegularExpression("Hard|Good|Easy")]
    public string Outcome { get; set; } = string.Empty;
}

public sealed class ReviewResponse
{
    public int CardId { get; set; }

    public DateTime NextReviewAt { get; set; }

    public decimal EaseFactor { get; set; }

    public int IntervalDays { get; set; }
}
