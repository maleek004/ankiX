namespace AnkiX.Api.Contracts.Auth;

public sealed class AuthResponse
{
    public string AccessToken { get; set; } = string.Empty;

    public int ExpiresInSeconds { get; set; }

    public AuthUserResponse User { get; set; } = new AuthUserResponse();
}

public sealed class AuthUserResponse
{
    public int Id { get; set; }

    public string Email { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public string Role { get; set; } = string.Empty;
}
