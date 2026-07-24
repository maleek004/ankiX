using System.ComponentModel.DataAnnotations;

namespace AnkiX.Api.Contracts.Auth;

public sealed class RegisterRequest
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MinLength(8)]
    public string Password { get; set; } = string.Empty;

    [MaxLength(128)]
    public string? DisplayName { get; set; }
}
