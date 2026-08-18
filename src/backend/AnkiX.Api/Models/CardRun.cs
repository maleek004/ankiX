using System.ComponentModel.DataAnnotations.Schema;

namespace AnkiX.Api.Models;

public sealed class CardRun
{
    public long Id { get; set; }

    public int CardId { get; set; }

    public int UserId { get; set; }

    public string SubmittedCode { get; set; } = string.Empty;

    public bool? Result { get; set; }

    public string? ResultDetails { get; set; }

    public int? DurationMs { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
