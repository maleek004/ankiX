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

public sealed class ProfileTests
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
            Audience = "AnkiX"
        }));

        var oauthService = new OAuthService(new HttpClient(), new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build(), NullLogger<OAuthService>.Instance);
        var emailService = new EmailService(NullLogger<EmailService>.Instance);

        var controller = new AuthController(dbContext, passwordService, tokenService, oauthService, emailService);

        if (authenticatedUserId.HasValue)
        {
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, authenticatedUserId.Value.ToString()),
                new Claim(ClaimTypes.Email, "test@example.com")
            };
            var identity = new ClaimsIdentity(claims, "TestAuth");
            var principal = new ClaimsPrincipal(identity);
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = principal }
            };
        }
        else
        {
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal() }
            };
        }

        return controller;
    }

    [Fact]
    public async Task GetProfile_WhenNotAuthenticated_ReturnsUnauthorized()
    {
        using var dbContext = CreateDbContext();
        var controller = CreateController(dbContext, authenticatedUserId: null);

        var result = await controller.GetProfile();
        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task GetProfile_WhenUserExists_ReturnsUserProfileWithStats()
    {
        using var dbContext = CreateDbContext();
        var user = new User
        {
            Email = "jane@example.com",
            DisplayName = "Jane Doe",
            Role = Roles.User,
            AuthProvider = "google",
            IsEmailVerified = true,
            CreatedAt = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc)
        };
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        dbContext.Decks.Add(new Deck
        {
            Title = "Jane's Deck",
            CreatedByUserId = user.Id,
            CreatedAt = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, authenticatedUserId: user.Id);
        var result = await controller.GetProfile();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var profile = Assert.IsType<UserProfileResponse>(okResult.Value);

        Assert.Equal(user.Id, profile.Id);
        Assert.Equal("jane@example.com", profile.Email);
        Assert.Equal("Jane Doe", profile.DisplayName);
        Assert.Equal("google", profile.AuthProvider);
        Assert.True(profile.IsEmailVerified);
        Assert.Equal(1, profile.Stats.DecksCreatedCount);
        Assert.Equal(0, profile.Stats.ReviewsCount);
    }

    [Fact]
    public async Task UpdateProfile_WhenNotAuthenticated_ReturnsUnauthorized()
    {
        using var dbContext = CreateDbContext();
        var controller = CreateController(dbContext, authenticatedUserId: null);

        var result = await controller.UpdateProfile(new UpdateProfileRequest { DisplayName = "New Name" });
        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task UpdateProfile_WhenDisplayNameEmptyOrWhitespace_ReturnsBadRequest()
    {
        using var dbContext = CreateDbContext();
        var user = new User { Email = "user@example.com", DisplayName = "Old Name" };
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, authenticatedUserId: user.Id);

        var resultEmpty = await controller.UpdateProfile(new UpdateProfileRequest { DisplayName = "" });
        Assert.IsType<BadRequestObjectResult>(resultEmpty);

        var resultWhitespace = await controller.UpdateProfile(new UpdateProfileRequest { DisplayName = "   " });
        Assert.IsType<BadRequestObjectResult>(resultWhitespace);
    }

    [Fact]
    public async Task UpdateProfile_WhenDisplayNameTooShortOrTooLong_ReturnsBadRequest()
    {
        using var dbContext = CreateDbContext();
        var user = new User { Email = "user@example.com", DisplayName = "Old Name" };
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, authenticatedUserId: user.Id);

        var resultShort = await controller.UpdateProfile(new UpdateProfileRequest { DisplayName = "A" });
        Assert.IsType<BadRequestObjectResult>(resultShort);

        var resultLong = await controller.UpdateProfile(new UpdateProfileRequest { DisplayName = new string('A', 51) });
        Assert.IsType<BadRequestObjectResult>(resultLong);
    }

    [Fact]
    public async Task UpdateProfile_WhenValid_UpdatesDisplayNameAndReturnsProfile()
    {
        using var dbContext = CreateDbContext();
        var user = new User
        {
            Email = "learner@example.com",
            DisplayName = "Old Name",
            Role = Roles.User,
            AuthProvider = "local",
            IsEmailVerified = true,
            CreatedAt = DateTime.UtcNow
        };
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, authenticatedUserId: user.Id);

        var result = await controller.UpdateProfile(new UpdateProfileRequest { DisplayName = "  Alex River  " });

        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<UserProfileResponse>(okResult.Value);

        Assert.Equal("Alex River", response.DisplayName);

        var updatedUserInDb = await dbContext.Users.FindAsync(user.Id);
        Assert.NotNull(updatedUserInDb);
        Assert.Equal("Alex River", updatedUserInDb.DisplayName);
    }

    [Fact]
    public async Task UpdateProfile_WhenContainsTagsAndControlChars_SanitizesProperly()
    {
        using var dbContext = CreateDbContext();
        var user = new User
        {
            Email = "learner@example.com",
            DisplayName = "Old Name",
            Role = Roles.User,
            AuthProvider = "local",
            IsEmailVerified = true,
            CreatedAt = DateTime.UtcNow
        };
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, authenticatedUserId: user.Id);

        var result = await controller.UpdateProfile(new UpdateProfileRequest { DisplayName = "  <Alex>\r\n\tRiver  " });

        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<UserProfileResponse>(okResult.Value);

        Assert.Equal("Alex River", response.DisplayName);
    }
}
