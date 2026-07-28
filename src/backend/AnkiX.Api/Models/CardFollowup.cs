using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AnkiX.Api.Models;

/// <summary>
/// A follow-up question left by a user while studying a card.
/// Optionally links back to another card that answers the question.
/// </summary>
public sealed class CardFollowup
{
    public long Id { get; set; }

    /// <summary>The card that triggered this follow-up question.</summary>
    public int CardId { get; set; }

    /// <summary>The user who posted this follow-up.</summary>
    public int AuthorUserId { get; set; }

    [MaxLength(1000)]
    public string QuestionText { get; set; } = string.Empty;

    /// <summary>
    /// Optional: the card that was created to answer this follow-up.
    /// Null until a contributor/admin links an answer card.
    /// </summary>
    public int? LinkedCardId { get; set; }

    [Column(TypeName = "datetime2")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
