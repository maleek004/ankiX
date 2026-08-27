using System.ComponentModel.DataAnnotations;
using AnkiX.Api.Models;

namespace AnkiX.Api.Contracts.Content;

public sealed class CreateStudyGroupRequest
{
    [Required]
    public string Name { get; set; } = string.Empty;

    [Required]
    public string Slug { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string? AvatarUrl { get; set; }

    public string Privacy { get; set; } = StudyGroupPrivacy.Public;

    public bool? IsPublic { get; set; }
}

public sealed class UpdateStudyGroupPrivacyRequest
{
    [Required]
    public string Privacy { get; set; } = string.Empty;
}

public sealed class UpdateStudyGroupRequest
{
    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? Description { get; set; }

    [MaxLength(2048)]
    public string? AvatarUrl { get; set; }
}

public sealed class StudyGroupResponse
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Slug { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string? AvatarUrl { get; set; }

    public string Privacy { get; set; } = StudyGroupPrivacy.Public;

    public bool IsPublic { get; set; }

    public int MemberCount { get; set; }

    public int DeckCount { get; set; }

    public int ExerciseCount { get; set; }

    public string? UserRole { get; set; }

    public string? UserMembershipStatus { get; set; }

    public int PendingRequestCount { get; set; }

    public int CreatedByUserId { get; set; }

    public bool IsFrozen { get; set; }

    public DateTime? FrozenAt { get; set; }

    public DateTime CreatedAt { get; set; }
}

public sealed class StudyGroupMemberResponse
{
    public int UserId { get; set; }

    public string? DisplayName { get; set; }

    public string Email { get; set; } = string.Empty;

    public string Role { get; set; } = string.Empty;

    public string Status { get; set; } = StudyGroupMemberStatus.Active;

    public DateTime JoinedAt { get; set; }

    public DateTime? RequestedAt { get; set; }
}

public sealed class StudyGroupJoinRequestResponse
{
    public int UserId { get; set; }

    public string? DisplayName { get; set; }

    public string Email { get; set; } = string.Empty;

    public DateTime RequestedAt { get; set; }
}

public sealed class StudyGroupInvitationResponse
{
    public int StudyGroupId { get; set; }

    public string StudyGroupName { get; set; } = string.Empty;

    public string StudyGroupSlug { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string Role { get; set; } = string.Empty;

    public string InviterDisplayName { get; set; } = string.Empty;

    public DateTime InvitedAt { get; set; }
}

public sealed class UpdateMemberRoleRequest
{
    [Required]
    public string Role { get; set; } = string.Empty;
}

public sealed class AddStudyGroupMemberRequest
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    public string Role { get; set; } = StudyGroupRoles.Member;
}

public sealed class InviteStudyGroupMemberRequest
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    public string Role { get; set; } = StudyGroupRoles.Member;
}

public sealed class TransferOwnershipRequest
{
    [Required]
    public int NewOwnerUserId { get; set; }
}

