namespace AnkiX.Api.Options;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "ankiX.api";

    public string Audience { get; set; } = "ankiX.web";

    public string SigningKey { get; set; } = string.Empty;

    public int ExpiresInMinutes { get; set; } = 60;

    public int RefreshTokenExpiresInDays { get; set; } = 30;
}
