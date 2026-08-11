using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AnkiX.Api.Models;

public sealed class User
{
    public int Id { get; set; }

    [MaxLength(254)]
    public string Email { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string PasswordHash { get; set; } = string.Empty;

    [MaxLength(128)]
    public string? DisplayName { get; set; }

    [MaxLength(20)]
    public string Role { get; set; } = Roles.User;

    [MaxLength(30)]
    public string AuthProvider { get; set; } = "local";

    [MaxLength(128)]
    public string? GoogleId { get; set; }

    [MaxLength(128)]
    public string? GitHubId { get; set; }

    [Column(TypeName = "datetime2")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
