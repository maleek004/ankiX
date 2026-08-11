using AnkiX.Api.Contracts.Auth;
using AnkiX.Api.Controllers;
using AnkiX.Api.Data;
using AnkiX.Api.Models;
using AnkiX.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace AnkiX.Api.Tests;

public sealed class OAuthServiceTests
{
    private static ApplicationDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    [Fact]
    public async Task VerifyAndExtractPayloadAsync_WhenProviderUnknown_ReturnsNull()
    {
        var httpClient = new HttpClient();
        var config = new ConfigurationBuilder().Build();
        var service = new OAuthService(httpClient, config, NullLogger<OAuthService>.Instance);

        var result = await service.VerifyAndExtractPayloadAsync("unknown_provider", "token", "code", null);
        Assert.Null(result);
    }

    [Fact]
    public async Task VerifyAndExtractPayloadAsync_WhenGoogleIdTokenNull_ReturnsNull()
    {
        var httpClient = new HttpClient();
        var config = new ConfigurationBuilder().Build();
        var service = new OAuthService(httpClient, config, NullLogger<OAuthService>.Instance);

        var result = await service.VerifyAndExtractPayloadAsync("google", null, null, null);
        Assert.Null(result);
    }

    [Fact]
    public async Task VerifyAndExtractPayloadAsync_WhenGitHubCodeNull_ReturnsNull()
    {
        var httpClient = new HttpClient();
        var config = new ConfigurationBuilder().Build();
        var service = new OAuthService(httpClient, config, NullLogger<OAuthService>.Instance);

        var result = await service.VerifyAndExtractPayloadAsync("github", null, null, null);
        Assert.Null(result);
    }

    [Fact]
    public async Task OAuthEndpoint_WhenPayloadValidNewUser_CreatesUserAndReturnsToken()
    {
        using var dbContext = CreateDbContext();
        var pwdService = new PasswordService();
        var tokenService = new TokenService(new Microsoft.Extensions.Options.OptionsWrapper<Options.JwtOptions>(new Options.JwtOptions
        {
            SigningKey = "SuperSecretKeyForTestingJwtTokenGeneration123!",
            Issuer = "AnkiX",
            Audience = "AnkiX"
        }));

        var mockOAuthService = new MockOAuthService(new OAuthUserPayload("github", "12345", "oauth.user@example.com", "OAuth User"));
        var controller = new AuthController(dbContext, pwdService, tokenService, mockOAuthService);

        var request = new OAuthLoginRequest { Provider = "github", Code = "valid_code" };
        var result = await controller.OAuth(request);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<AuthResponse>(okResult.Value);

        Assert.NotEmpty(response.AccessToken);
        Assert.Equal("oauth.user@example.com", response.User.Email);
        Assert.Equal("OAuth User", response.User.DisplayName);

        var createdUser = await dbContext.Users.FirstOrDefaultAsync(u => u.Email == "oauth.user@example.com");
        Assert.NotNull(createdUser);
        Assert.Equal("github", createdUser.AuthProvider);
        Assert.Equal("12345", createdUser.GitHubId);
    }

    [Fact]
    public async Task OAuthEndpoint_WhenUserAlreadyExists_LinksProviderId()
    {
        using var dbContext = CreateDbContext();
        dbContext.Users.Add(new User
        {
            Email = "existing.user@example.com",
            DisplayName = "Existing User",
            PasswordHash = "hash",
            AuthProvider = "local",
            Role = Roles.User,
            CreatedAt = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var pwdService = new PasswordService();
        var tokenService = new TokenService(new Microsoft.Extensions.Options.OptionsWrapper<Options.JwtOptions>(new Options.JwtOptions
        {
            SigningKey = "SuperSecretKeyForTestingJwtTokenGeneration123!",
            Issuer = "AnkiX",
            Audience = "AnkiX"
        }));

        var mockOAuthService = new MockOAuthService(new OAuthUserPayload("google", "sub_google_999", "existing.user@example.com", "Google Name"));
        var controller = new AuthController(dbContext, pwdService, tokenService, mockOAuthService);

        var request = new OAuthLoginRequest { Provider = "google", IdToken = "valid_token" };
        var result = await controller.OAuth(request);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<AuthResponse>(okResult.Value);

        Assert.Equal("existing.user@example.com", response.User.Email);

        var updatedUser = await dbContext.Users.FirstOrDefaultAsync(u => u.Email == "existing.user@example.com");
        Assert.NotNull(updatedUser);
        Assert.Equal("google", updatedUser.AuthProvider);
        Assert.Equal("sub_google_999", updatedUser.GoogleId);
    }

    private sealed class MockOAuthService : IOAuthService
    {
        private readonly OAuthUserPayload? payload;

        public MockOAuthService(OAuthUserPayload? payload)
        {
            this.payload = payload;
        }

        public Task<OAuthUserPayload?> VerifyAndExtractPayloadAsync(string provider, string? idToken, string? code, string? redirectUri, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(payload);
        }
    }
}
