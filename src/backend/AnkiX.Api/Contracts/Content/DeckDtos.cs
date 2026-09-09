using System.ComponentModel.DataAnnotations;

namespace AnkiX.Api.Contracts.Content;

public sealed class DeckResponse
{
    public int Id { get; set; }

    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    public int? CreatedByUserId { get; set; }

    public int DueCount { get; set; }

    public int LearnCount { get; set; }

    public int? StudyGroupId { get; set; }

    public string? StudyGroupSlug { get; set; }

    public string? StudyGroupName { get; set; }

    public string? StudyGroupPrivacy { get; set; }

    public string? StudyGroupAvatarUrl { get; set; }

    public string? StudyGroupDescription { get; set; }

    public bool IsMember { get; set; } = true;

    public bool IsPrivateDeck { get; set; } = false;

    public bool CanAccess { get; set; } = true;
}

public sealed class CreateDeckRequest
{
    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? Description { get; set; }

    public int? StudyGroupId { get; set; }
}

public sealed class UpdateDeckRequest
{
    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? Description { get; set; }
}
