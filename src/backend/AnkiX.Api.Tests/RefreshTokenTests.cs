using System.Security.Claims;
using AnkiX.Api.Contracts.Auth;
using AnkiX.Api.Controllers;
using AnkiX.Api.Data;
using AnkiX.Api.Models;
using AnkiX.Api.Options;
using AnkiX.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace AnkiX.Api.Tests;

public sealed class RefreshTokenTests
{
    private static ApplicationDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static AuthController CreateController(ApplicationDbContext dbContext, int? authenticatedUserId = null)
    {
        var passwordService = new PasswordService();
        var tokenService = new TokenService(new OptionsWrapper<JwtOptions>(new JwtOptions
        {
            SigningKey = "SuperSecretKeyForTestingJwtTokenGeneration123!",
            Issuer = "AnkiX",
            Audience = "AnkiX",
            ExpiresInMinutes = 60,
            RefreshTokenExpiresInDays = 30
        }));

        var oauthService = new OAuthService(new HttpClient(), new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build(), NullLogger<OAuthService>.Instance);
        var emailService = new EmailService(NullLogger<EmailService>.Instance);

        var controller = new AuthController(dbContext, passwordService, tokenService, oauthService, emailService);

        var httpContext = new DefaultHttpContext();
        if (authenticatedUserId.HasValue)
        {
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, authenticatedUserId.Value.ToString()),
                new Claim(ClaimTypes.Email, "test@example.com")
            };
            var identity = new ClaimsIdentity(claims, "TestAuth");
            httpContext.User = new ClaimsPrincipal(identity);
        }
        else
        {
            httpContext.User = new ClaimsPrincipal();
        }

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = httpContext
        };

        return controller;
    }

    [Fact]
    public async Task Login_WhenCredentialsValid_ReturnsAccessTokenAndRefreshToken()
    {
        using var dbContext = CreateDbContext();
        var passwordService = new PasswordService();
        var user = new User
        {
            Email = "student@example.com",
            PasswordHash = passwordService.HashPassword("SecurePass123!"),
            DisplayName = "Student One",
            Role = Roles.User,
            IsEmailVerified = true,
            CreatedAt = DateTime.UtcNow
        };
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext);

        var result = await controller.Login(new LoginRequest
        {
            Email = "student@example.com",
            Password = "SecurePass123!"
        });

        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<AuthResponse>(okResult.Value);

        Assert.False(string.IsNullOrWhiteSpace(response.AccessToken));
        Assert.False(string.IsNullOrWhiteSpace(response.RefreshToken));
        Assert.True(response.ExpiresInSeconds > 0);
        Assert.Equal(user.Id, response.User.Id);

        // Verify refresh token stored in database
        var tokenService = new TokenService(new OptionsWrapper<JwtOptions>(new JwtOptions()));
        string hash = tokenService.HashToken(response.RefreshToken);
        var storedToken = await dbContext.RefreshTokens.FirstOrDefaultAsync(rt => rt.TokenHash == hash);

        Assert.NotNull(storedToken);
        Assert.Equal(user.Id, storedToken.UserId);
        Assert.True(storedToken.IsActive);
    }

    [Fact]
    public async Task RefreshToken_WhenValid_RotatesTokenAndReturnsNewTokens()
    {
        using var dbContext = CreateDbContext();
        var passwordService = new PasswordService();
        var user = new User
        {
            Email = "learner@example.com",
            PasswordHash = passwordService.HashPassword("Pass123!"),
            DisplayName = "Learner",
            Role = Roles.User,
            IsEmailVerified = true,
            CreatedAt = DateTime.UtcNow
        };
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        var tokenService = new TokenService(new OptionsWrapper<JwtOptions>(new JwtOptions()));
        string initialRefreshToken = tokenService.GenerateRefreshToken();
        string initialHash = tokenService.HashToken(initialRefreshToken);

        var initialTokenRecord = new RefreshToken
        {
            UserId = user.Id,
            TokenHash = initialHash,
            ExpiresAt = DateTime.UtcNow.AddDays(30),
            CreatedAt = DateTime.UtcNow
        };
        dbContext.RefreshTokens.Add(initialTokenRecord);
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext);

        var result = await controller.RefreshToken(new RefreshTokenRequest
        {
            RefreshToken = initialRefreshToken
        });

        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<AuthResponse>(okResult.Value);

        Assert.False(string.IsNullOrWhiteSpace(response.AccessToken));
        Assert.False(string.IsNullOrWhiteSpace(response.RefreshToken));
        Assert.NotEqual(initialRefreshToken, response.RefreshToken);
        Assert.Equal(user.Id, response.User.Id);

        // Verify old token is revoked with lineage replaced pointer
        var oldTokenInDb = await dbContext.RefreshTokens.FindAsync(initialTokenRecord.Id);
        Assert.NotNull(oldTokenInDb);
        Assert.True(oldTokenInDb.IsRevoked);
        Assert.NotNull(oldTokenInDb.ReplacedByTokenHash);

        // Verify new token is active
        string newHash = tokenService.HashToken(response.RefreshToken);
        var newTokenInDb = await dbContext.RefreshTokens.FirstOrDefaultAsync(rt => rt.TokenHash == newHash);
        Assert.NotNull(newTokenInDb);
        Assert.True(newTokenInDb.IsActive);
        Assert.Equal(user.Id, newTokenInDb.UserId);
        Assert.Equal(oldTokenInDb.ReplacedByTokenHash, newHash);
    }

    [Fact]
    public async Task RefreshToken_WhenEmpty_ReturnsBadRequest()
    {
        using var dbContext = CreateDbContext();
        var controller = CreateController(dbContext);

        var resultEmpty = await controller.RefreshToken(new RefreshTokenRequest { RefreshToken = "" });
        Assert.IsType<BadRequestObjectResult>(resultEmpty);

        var resultWhitespace = await controller.RefreshToken(new RefreshTokenRequest { RefreshToken = "   " });
        Assert.IsType<BadRequestObjectResult>(resultWhitespace);
    }

    [Fact]
    public async Task RefreshToken_WhenNotFound_ReturnsUnauthorized()
    {
        using var dbContext = CreateDbContext();
        var controller = CreateController(dbContext);

        var result = await controller.RefreshToken(new RefreshTokenRequest
        {
            RefreshToken = "non-existent-token-xyz"
        });

        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task RefreshToken_WhenExpired_ReturnsUnauthorized()
    {
        using var dbContext = CreateDbContext();
        var user = new User
        {
            Email = "expired@example.com",
            DisplayName = "Expired User",
            Role = Roles.User,
            CreatedAt = DateTime.UtcNow
        };
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        var tokenService = new TokenService(new OptionsWrapper<JwtOptions>(new JwtOptions()));
        string expiredToken = tokenService.GenerateRefreshToken();
        string hash = tokenService.HashToken(expiredToken);

        dbContext.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = hash,
            ExpiresAt = DateTime.UtcNow.AddMinutes(-5), // Expired 5 mins ago
            CreatedAt = DateTime.UtcNow.AddDays(-30)
        });
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext);

        var result = await controller.RefreshToken(new RefreshTokenRequest
        {
            RefreshToken = expiredToken
        });

        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task RefreshToken_WhenRevokedTokenReused_RevokesAllActiveUserTokens()
    {
        using var dbContext = CreateDbContext();
        var user = new User
        {
            Email = "victim@example.com",
            DisplayName = "Victim",
            Role = Roles.User,
            CreatedAt = DateTime.UtcNow
        };
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        var tokenService = new TokenService(new OptionsWrapper<JwtOptions>(new JwtOptions()));
        
        // Already revoked token (e.g. stolen old token)
        string stolenToken = tokenService.GenerateRefreshToken();
        string stolenHash = tokenService.HashToken(stolenToken);

        dbContext.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = stolenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(30),
            CreatedAt = DateTime.UtcNow.AddDays(-1),
            RevokedAt = DateTime.UtcNow.AddHours(-2) // Already revoked
        });

        // Another legitimate active token belonging to this user
        string activeToken = tokenService.GenerateRefreshToken();
        string activeHash = tokenService.HashToken(activeToken);

        var activeRecord = new RefreshToken
        {
            UserId = user.Id,
            TokenHash = activeHash,
            ExpiresAt = DateTime.UtcNow.AddDays(30),
            CreatedAt = DateTime.UtcNow
        };
        dbContext.RefreshTokens.Add(activeRecord);
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext);

        // Attacker attempts to use revoked token
        var result = await controller.RefreshToken(new RefreshTokenRequest
        {
            RefreshToken = stolenToken
        });

        Assert.IsType<UnauthorizedObjectResult>(result);

        // Verify reuse detection revoked all active tokens for this user
        var reloadedActive = await dbContext.RefreshTokens.FindAsync(activeRecord.Id);
        Assert.NotNull(reloadedActive);
        Assert.True(reloadedActive.IsRevoked);
    }

    [Fact]
    public async Task RevokeToken_WhenValid_RevokesTokenSuccessfully()
    {
        using var dbContext = CreateDbContext();
        var user = new User
        {
            Email = "user@example.com",
            DisplayName = "User",
            Role = Roles.User,
            CreatedAt = DateTime.UtcNow
        };
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        var tokenService = new TokenService(new OptionsWrapper<JwtOptions>(new JwtOptions()));
        string token = tokenService.GenerateRefreshToken();
        string hash = tokenService.HashToken(token);

        var record = new RefreshToken
        {
            UserId = user.Id,
            TokenHash = hash,
            ExpiresAt = DateTime.UtcNow.AddDays(30),
            CreatedAt = DateTime.UtcNow
        };
        dbContext.RefreshTokens.Add(record);
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext);

        var result = await controller.RevokeToken(new RevokeTokenRequest
        {
            RefreshToken = token
        });

        var okResult = Assert.IsType<OkObjectResult>(result);
        var reloaded = await dbContext.RefreshTokens.FindAsync(record.Id);
        Assert.NotNull(reloaded);
        Assert.True(reloaded.IsRevoked);
    }

    [Fact]
    public async Task RefreshToken_WhenRecentlyRevokedWithinGracePeriod_ReturnsActiveSession()
    {
        using var dbContext = CreateDbContext();
        var user = new User
        {
            Email = "multitab@example.com",
            DisplayName = "Multi Tab User",
            Role = Roles.User,
            CreatedAt = DateTime.UtcNow
        };
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        var tokenService = new TokenService(new OptionsWrapper<JwtOptions>(new JwtOptions()));
        string originalToken = tokenService.GenerateRefreshToken();
        string originalHash = tokenService.HashToken(originalToken);

        string replacementToken = tokenService.GenerateRefreshToken();
        string replacementHash = tokenService.HashToken(replacementToken);

        // Replacement token active in DB
        dbContext.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = replacementHash,
            ExpiresAt = DateTime.UtcNow.AddDays(30),
            CreatedAt = DateTime.UtcNow
        });

        // Original token revoked 5 seconds ago (within 30s grace window) with replacement pointer
        dbContext.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = originalHash,
            ExpiresAt = DateTime.UtcNow.AddDays(30),
            CreatedAt = DateTime.UtcNow.AddMinutes(-1),
            RevokedAt = DateTime.UtcNow.AddSeconds(-5),
            ReplacedByTokenHash = replacementHash
        });

        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext);

        // Concurrent tab 2 requests with the original token
        var result = await controller.RefreshToken(new RefreshTokenRequest
        {
            RefreshToken = originalToken
        });

        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<AuthResponse>(okResult.Value);
        Assert.False(string.IsNullOrWhiteSpace(response.AccessToken));
        Assert.Equal(user.Id, response.User.Id);
    }

    [Fact]
    public async Task ResetPassword_WhenSuccessful_RevokesAllActiveRefreshTokens()
    {
        using var dbContext = CreateDbContext();
        var passwordService = new PasswordService();
        var user = new User
        {
            Email = "resetuser@example.com",
            PasswordHash = passwordService.HashPassword("OldPassword123!"),
            PasswordResetToken = "valid-reset-token-abc",
            PasswordResetExpiresAt = DateTime.UtcNow.AddHours(1),
            DisplayName = "Reset User",
            Role = Roles.User,
            CreatedAt = DateTime.UtcNow
        };
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        var tokenService = new TokenService(new OptionsWrapper<JwtOptions>(new JwtOptions()));
        string activeToken = tokenService.GenerateRefreshToken();
        string hash = tokenService.HashToken(activeToken);

        var tokenRecord = new RefreshToken
        {
            UserId = user.Id,
            TokenHash = hash,
            ExpiresAt = DateTime.UtcNow.AddDays(30),
            CreatedAt = DateTime.UtcNow
        };
        dbContext.RefreshTokens.Add(tokenRecord);
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext);

        var result = await controller.ResetPassword(new ResetPasswordRequest
        {
            Token = "valid-reset-token-abc",
            NewPassword = "BrandNewPassword123!"
        });

        Assert.IsType<OkObjectResult>(result);

        // Verify active token was revoked
        var reloaded = await dbContext.RefreshTokens.FindAsync(tokenRecord.Id);
        Assert.NotNull(reloaded);
        Assert.True(reloaded.IsRevoked);
    }
}
