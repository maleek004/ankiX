using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AnkiX.Api.Models;

public sealed class StudyGroup
{
    public int Id { get; set; }

    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(100)]
    public string Slug { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? Description { get; set; }

    [MaxLength(500)]
    public string? AvatarUrl { get; set; }

    [MaxLength(20)]
    public string Privacy { get; set; } = StudyGroupPrivacy.Public;

    [NotMapped]
    public bool IsPublic
    {
        get => Privacy == StudyGroupPrivacy.Public;
        set => Privacy = value ? StudyGroupPrivacy.Public : StudyGroupPrivacy.Private;
    }

    public int CreatedByUserId { get; set; }

    public bool IsFrozen { get; set; } = false;

    public DateTime? FrozenAt { get; set; }

    public int? FrozenByUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
