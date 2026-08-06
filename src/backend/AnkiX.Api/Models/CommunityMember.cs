using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AnkiX.Api.Models;

public sealed class CommunityMember
{
    public int CommunityId { get; set; }

    public int UserId { get; set; }

    [MaxLength(20)]
    public string Role { get; set; } = CommunityRoles.Member;

    [Column(TypeName = "datetime2")]
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}
