using System.ComponentModel.DataAnnotations;

namespace AnkiX.Api.Contracts.Study;

public sealed class CreateFollowupRequest
{
    [Required]
    [MaxLength(1000)]
    public string QuestionText { get; set; } = string.Empty;
}

public sealed class LinkFollowupRequest
{
    [Required]
    public int LinkedCardId { get; set; }
}

public sealed class FollowupResponse
{
    public long Id { get; set; }

    public int CardId { get; set; }

    public int AuthorUserId { get; set; }

    public string AuthorDisplayName { get; set; } = string.Empty;

    public string QuestionText { get; set; } = string.Empty;

    /// <summary>Id of the primary card that was created to answer this follow-up. Null until linked.</summary>
    public int? LinkedCardId { get; set; }

    /// <summary>List of all card IDs linked to answer this follow-up question.</summary>
    public List<int> LinkedCardIds { get; set; } = new();

    public DateTime CreatedAt { get; set; }
}
