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

    /// <summary>Comma-separated IDs of all cards linked to answer this follow-up.</summary>
    [MaxLength(500)]
    public string? LinkedCardIds { get; set; }

    [Column(TypeName = "datetime2")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<int> GetLinkedCardIdList()
    {
        HashSet<int> ids = new HashSet<int>();
        if (LinkedCardId.HasValue)
        {
            ids.Add(LinkedCardId.Value);
        }

        if (!string.IsNullOrWhiteSpace(LinkedCardIds))
        {
            string[] raw = LinkedCardIds.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            foreach (string item in raw)
            {
                if (int.TryParse(item, out int parsed))
                {
                    ids.Add(parsed);
                }
            }
        }

        return ids.ToList();
    }

    public void AddLinkedCardId(int cardId)
    {
        List<int> current = GetLinkedCardIdList();
        if (!current.Contains(cardId))
        {
            current.Add(cardId);
        }

        if (!LinkedCardId.HasValue)
        {
            LinkedCardId = cardId;
        }

        LinkedCardIds = string.Join(",", current);
    }

    public void RemoveLinkedCardId(int cardId)
    {
        List<int> current = GetLinkedCardIdList();
        current.Remove(cardId);
        LinkedCardIds = current.Count > 0 ? string.Join(",", current) : null;
        LinkedCardId = current.Count > 0 ? current[0] : null;
    }
}
