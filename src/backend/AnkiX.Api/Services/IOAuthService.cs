namespace AnkiX.Api.Services;

public record OAuthUserPayload(
    string Provider,
    string SubId,
    string Email,
    string? DisplayName
);

public interface IOAuthService
{
    Task<OAuthUserPayload?> VerifyAndExtractPayloadAsync(
        string provider,
        string? idToken,
        string? code,
        string? redirectUri,
        CancellationToken cancellationToken = default);
}
