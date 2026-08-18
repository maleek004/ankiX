using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AnkiX.Api.Models;

public sealed class StudyGroupMember
{
    public int StudyGroupId { get; set; }

    public int UserId { get; set; }

    [MaxLength(20)]
    public string Role { get; set; } = StudyGroupRoles.Member;

    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}
