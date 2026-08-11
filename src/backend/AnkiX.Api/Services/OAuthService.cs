using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AnkiX.Api.Services;

public sealed class OAuthService : IOAuthService
{
    private readonly HttpClient httpClient;
    private readonly IConfiguration configuration;
    private readonly ILogger<OAuthService> logger;

    public OAuthService(HttpClient httpClient, IConfiguration configuration, ILogger<OAuthService> logger)
    {
        this.httpClient = httpClient;
        this.configuration = configuration;
        this.logger = logger;
    }

    public async Task<OAuthUserPayload?> VerifyAndExtractPayloadAsync(
        string provider,
        string? idToken,
        string? code,
        string? redirectUri,
        CancellationToken cancellationToken = default)
    {
        string normalizedProvider = provider.Trim().ToLowerInvariant();
        return normalizedProvider switch
        {
            "google" => await VerifyGoogleTokenAsync(idToken, cancellationToken),
            "github" => await VerifyGitHubCodeAsync(code, redirectUri, cancellationToken),
            _ => null
        };
    }

    private async Task<OAuthUserPayload?> VerifyGoogleTokenAsync(string? idToken, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(idToken))
        {
            logger.LogWarning("Google OAuth verification failed: idToken is missing.");
            return null;
        }

        try
        {
            string url = $"https://oauth2.googleapis.com/tokeninfo?id_token={Uri.EscapeDataString(idToken)}";
            HttpResponseMessage response = await httpClient.GetAsync(url, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Google tokeninfo returned HTTP {StatusCode}", response.StatusCode);
                return null;
            }

            string json = await response.Content.ReadAsStringAsync(cancellationToken);
            using JsonDocument doc = JsonDocument.Parse(json);
            JsonElement root = doc.RootElement;

            string? sub = root.TryGetProperty("sub", out var subProp) ? subProp.GetString() : null;
            string? email = root.TryGetProperty("email", out var emailProp) ? emailProp.GetString() : null;
            string? name = root.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : null;

            bool isVerified = false;
            if (root.TryGetProperty("email_verified", out var verProp))
            {
                isVerified = verProp.ValueKind switch
                {
                    JsonValueKind.True => true,
                    JsonValueKind.String => string.Equals(verProp.GetString(), "true", StringComparison.OrdinalIgnoreCase),
                    _ => false
                };
            }

            if (string.IsNullOrEmpty(sub) || string.IsNullOrEmpty(email) || !isVerified)
            {
                logger.LogWarning("Google token payload invalid or unverified email.");
                return null;
            }

            // Optional client_id check if configured
            string? configuredClientId = configuration["Authentication:Google:ClientId"];
            if (!string.IsNullOrEmpty(configuredClientId) && root.TryGetProperty("aud", out var audProp))
            {
                string? aud = audProp.GetString();
                if (!string.Equals(aud, configuredClientId, StringComparison.Ordinal))
                {
                    logger.LogWarning("Google token audience '{Audience}' does not match configured ClientId '{ClientId}'", aud, configuredClientId);
                    return null;
                }
            }

            return new OAuthUserPayload("google", sub, email.Trim().ToLowerInvariant(), name);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Exception verifying Google OAuth token.");
            return null;
        }
    }

    private async Task<OAuthUserPayload?> VerifyGitHubCodeAsync(string? code, string? redirectUri, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            logger.LogWarning("GitHub OAuth verification failed: authorization code is missing.");
            return null;
        }

        string? clientId = configuration["Authentication:GitHub:ClientId"];
        string? clientSecret = configuration["Authentication:GitHub:ClientSecret"];

        if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(clientSecret))
        {
            logger.LogWarning("GitHub OAuth credentials (ClientId/ClientSecret) are not configured.");
            return null;
        }

        try
        {
            // 1. Exchange code for access_token
            var tokenRequestParams = new Dictionary<string, string>
            {
                { "client_id", clientId },
                { "client_secret", clientSecret },
                { "code", code }
            };

            if (!string.IsNullOrWhiteSpace(redirectUri))
            {
                tokenRequestParams["redirect_uri"] = redirectUri;
            }

            using var tokenRequest = new HttpRequestMessage(HttpMethod.Post, "https://github.com/login/oauth/access_token")
            {
                Content = new FormUrlEncodedContent(tokenRequestParams)
            };
            tokenRequest.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            HttpResponseMessage tokenResponse = await httpClient.SendAsync(tokenRequest, cancellationToken);
            if (!tokenResponse.IsSuccessStatusCode)
            {
                logger.LogWarning("GitHub token exchange returned HTTP {StatusCode}", tokenResponse.StatusCode);
                return null;
            }

            string tokenJson = await tokenResponse.Content.ReadAsStringAsync(cancellationToken);
            using JsonDocument tokenDoc = JsonDocument.Parse(tokenJson);
            if (!tokenDoc.RootElement.TryGetProperty("access_token", out var accessTokenProp))
            {
                logger.LogWarning("GitHub token response did not contain access_token.");
                return null;
            }

            string accessToken = accessTokenProp.GetString()!;

            // 2. Fetch User Profile
            using var userRequest = new HttpRequestMessage(HttpMethod.Get, "https://api.github.com/user");
            userRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            userRequest.Headers.UserAgent.ParseAdd("AnkiX-App");

            HttpResponseMessage userResponse = await httpClient.SendAsync(userRequest, cancellationToken);
            if (!userResponse.IsSuccessStatusCode)
            {
                logger.LogWarning("GitHub user API returned HTTP {StatusCode}", userResponse.StatusCode);
                return null;
            }

            string userJson = await userResponse.Content.ReadAsStringAsync(cancellationToken);
            using JsonDocument userDoc = JsonDocument.Parse(userJson);
            JsonElement userRoot = userDoc.RootElement;

            string subId = userRoot.GetProperty("id").GetRawText();
            string? name = userRoot.TryGetProperty("name", out var nProp) && nProp.ValueKind == JsonValueKind.String ? nProp.GetString() : null;
            if (string.IsNullOrWhiteSpace(name) && userRoot.TryGetProperty("login", out var loginProp))
            {
                name = loginProp.GetString();
            }

            string? email = userRoot.TryGetProperty("email", out var eProp) && eProp.ValueKind == JsonValueKind.String ? eProp.GetString() : null;

            // If primary email is null/private, fetch /user/emails
            if (string.IsNullOrWhiteSpace(email))
            {
                using var emailsRequest = new HttpRequestMessage(HttpMethod.Get, "https://api.github.com/user/emails");
                emailsRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                emailsRequest.Headers.UserAgent.ParseAdd("AnkiX-App");

                HttpResponseMessage emailsResponse = await httpClient.SendAsync(emailsRequest, cancellationToken);
                if (emailsResponse.IsSuccessStatusCode)
                {
                    string emailsJson = await emailsResponse.Content.ReadAsStringAsync(cancellationToken);
                    using JsonDocument emailsDoc = JsonDocument.Parse(emailsJson);
                    foreach (JsonElement item in emailsDoc.RootElement.EnumerateArray())
                    {
                        bool isPrimary = item.TryGetProperty("primary", out var p) && p.GetBoolean();
                        bool isVerified = item.TryGetProperty("verified", out var v) && v.GetBoolean();
                        if (isPrimary && isVerified && item.TryGetProperty("email", out var em))
                        {
                            email = em.GetString();
                            break;
                        }
                    }
                }
            }

            if (string.IsNullOrWhiteSpace(email))
            {
                logger.LogWarning("Could not retrieve a primary verified email for GitHub user {SubId}", subId);
                return null;
            }

            return new OAuthUserPayload("github", subId, email.Trim().ToLowerInvariant(), name);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Exception verifying GitHub OAuth code.");
            return null;
        }
    }
}
