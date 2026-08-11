using System.ComponentModel.DataAnnotations;

namespace AnkiX.Api.Contracts.Auth;

public sealed class OAuthLoginRequest
{
    [Required]
    public string Provider { get; set; } = string.Empty; // "google" or "github"

    public string? IdToken { get; set; } // Used for Google ID token verification

    public string? Code { get; set; } // Used for GitHub OAuth code exchange

    public string? RedirectUri { get; set; } // Optional redirect URI for GitHub OAuth code exchange
}
