using System.ComponentModel.DataAnnotations;
using AnkiX.Api.Models;

namespace AnkiX.Api.Contracts.Content;

public sealed class CreateStudyGroupRequest
{
    public string Name { get; set; } = string.Empty;

    public string Slug { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string? AvatarUrl { get; set; }

    public bool IsPublic { get; set; } = true;
}

public sealed class StudyGroupResponse
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Slug { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string? AvatarUrl { get; set; }

    public bool IsPublic { get; set; }

    public int MemberCount { get; set; }

    public int DeckCount { get; set; }

    public int ExerciseCount { get; set; }

    public string? UserRole { get; set; }

    public int CreatedByUserId { get; set; }

    public DateTime CreatedAt { get; set; }
}

public sealed class StudyGroupMemberResponse
{
    public int UserId { get; set; }

    public string? DisplayName { get; set; }

    public string Email { get; set; } = string.Empty;

    public string Role { get; set; } = string.Empty;

    public DateTime JoinedAt { get; set; }
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
