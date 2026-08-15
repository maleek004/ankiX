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

namespace AnkiX.Api.Tests;

public sealed class TestEmailService : IEmailService
{
    public List<(string Email, string Token, string Url)> SentResetEmails { get; } = new();
    public List<(string Email, string Token, string Url)> SentVerificationEmails { get; } = new();

    public Task SendPasswordResetEmailAsync(string recipientEmail, string resetToken, string resetUrl)
    {
        SentResetEmails.Add((recipientEmail, resetToken, resetUrl));
        return Task.CompletedTask;
    }

    public Task SendEmailVerificationAsync(string recipientEmail, string verificationToken, string verificationUrl)
    {
        SentVerificationEmails.Add((recipientEmail, verificationToken, verificationUrl));
        return Task.CompletedTask;
    }
}

public sealed class TestOAuthService : IOAuthService
{
    public Task<OAuthUserPayload?> VerifyAndExtractPayloadAsync(
        string provider,
        string? idToken,
        string? code,
        string? redirectUri,
        CancellationToken cancellationToken = default)
    {
        return Task.FromResult<OAuthUserPayload?>(null);
    }
}

public class PasswordResetTests
{
    private static ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    private static AuthController CreateController(
        ApplicationDbContext db,
        IPasswordService? passwordService = null,
        ITokenService? tokenService = null,
        IOAuthService? oauthService = null,
        IEmailService? emailService = null)
    {
        passwordService ??= new PasswordService();
        
        var jwtOptions = Microsoft.Extensions.Options.Options.Create(new JwtOptions
        {
            SigningKey = "A_Test_Signing_Key_With_At_Least_32_Characters_Length!",
            Issuer = "AnkiX.Api.Test",
            Audience = "AnkiX.Web.Test",
            ExpiresInMinutes = 60
        });
        tokenService ??= new TokenService(jwtOptions);

        oauthService ??= new TestOAuthService();
        emailService ??= new EmailService(NullLogger<EmailService>.Instance);

        var controller = new AuthController(db, passwordService, tokenService, oauthService, emailService)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };

        controller.ControllerContext.HttpContext.Request.Scheme = "http";
        controller.ControllerContext.HttpContext.Request.Host = new HostString("localhost:5000");

        return controller;
    }

    [Fact]
    public async Task ForgotPassword_RegisteredUser_GeneratesTokenAndSets15MinExpiryAndSendsEmail()
    {
        using var db = CreateInMemoryDbContext();
        var spyEmail = new TestEmailService();
        var controller = CreateController(db, emailService: spyEmail);

        var user = new User
        {
            Email = "learner@ankix.io",
            PasswordHash = new PasswordService().HashPassword("OldPassword123!"),
            DisplayName = "Learner One",
            Role = Roles.User
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var result = await controller.ForgotPassword(new ForgotPasswordRequest
        {
            Email = "learner@ankix.io"
        });

        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(okResult.Value);

        var updatedUser = await db.Users.FirstAsync(u => u.Email == "learner@ankix.io");
        Assert.NotNull(updatedUser.PasswordResetToken);
        Assert.NotEmpty(updatedUser.PasswordResetToken);
        Assert.NotNull(updatedUser.PasswordResetExpiresAt);
        Assert.True(updatedUser.PasswordResetExpiresAt > DateTime.UtcNow.AddMinutes(14));
        Assert.True(updatedUser.PasswordResetExpiresAt <= DateTime.UtcNow.AddMinutes(16));

        Assert.Single(spyEmail.SentResetEmails);
        var sent = spyEmail.SentResetEmails[0];
        Assert.Equal("learner@ankix.io", sent.Email);
        Assert.Equal(updatedUser.PasswordResetToken, sent.Token);
        Assert.Contains(updatedUser.PasswordResetToken, sent.Url);
    }

    [Fact]
    public async Task ForgotPassword_UnregisteredUser_ReturnsOkToPreventEnumeration()
    {
        using var db = CreateInMemoryDbContext();
        var spyEmail = new TestEmailService();
        var controller = CreateController(db, emailService: spyEmail);

        var result = await controller.ForgotPassword(new ForgotPasswordRequest
        {
            Email = "nonexistent@ankix.io"
        });

        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(okResult.Value);

        Assert.Empty(spyEmail.SentResetEmails);
    }

    [Fact]
    public async Task VerifyResetToken_ValidToken_ReturnsValidTrue()
    {
        using var db = CreateInMemoryDbContext();
        var controller = CreateController(db);

        var user = new User
        {
            Email = "learner@ankix.io",
            PasswordHash = "hash",
            PasswordResetToken = "valid-token-123",
            PasswordResetExpiresAt = DateTime.UtcNow.AddMinutes(10)
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var result = await controller.VerifyResetToken(new VerifyResetTokenRequest
        {
            Token = "valid-token-123"
        });

        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(okResult.Value);
    }

    [Fact]
    public async Task VerifyResetToken_ExpiredToken_ReturnsBadRequest()
    {
        using var db = CreateInMemoryDbContext();
        var controller = CreateController(db);

        var user = new User
        {
            Email = "learner@ankix.io",
            PasswordHash = "hash",
            PasswordResetToken = "expired-token-123",
            PasswordResetExpiresAt = DateTime.UtcNow.AddMinutes(-5)
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var result = await controller.VerifyResetToken(new VerifyResetTokenRequest
        {
            Token = "expired-token-123"
        });

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task ResetPassword_ValidToken_UpdatesPasswordHashAndClearsToken()
    {
        using var db = CreateInMemoryDbContext();
        var pwdService = new PasswordService();
        var controller = CreateController(db, passwordService: pwdService);

        string oldHash = pwdService.HashPassword("OldSecretPass123!");
        var user = new User
        {
            Email = "learner@ankix.io",
            PasswordHash = oldHash,
            PasswordResetToken = "active-reset-token",
            PasswordResetExpiresAt = DateTime.UtcNow.AddMinutes(12)
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var result = await controller.ResetPassword(new ResetPasswordRequest
        {
            Token = "active-reset-token",
            NewPassword = "BrandNewSecurePassword999!"
        });

        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(okResult.Value);

        var updatedUser = await db.Users.FirstAsync(u => u.Email == "learner@ankix.io");
        Assert.Null(updatedUser.PasswordResetToken);
        Assert.Null(updatedUser.PasswordResetExpiresAt);
        Assert.NotEqual(oldHash, updatedUser.PasswordHash);
        Assert.True(pwdService.VerifyPassword("BrandNewSecurePassword999!", updatedUser.PasswordHash));
    }

    [Fact]
    public async Task ResetPassword_ExpiredToken_ReturnsBadRequest()
    {
        using var db = CreateInMemoryDbContext();
        var controller = CreateController(db);

        var user = new User
        {
            Email = "learner@ankix.io",
            PasswordHash = "oldhash",
            PasswordResetToken = "expired-token",
            PasswordResetExpiresAt = DateTime.UtcNow.AddMinutes(-1)
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var result = await controller.ResetPassword(new ResetPasswordRequest
        {
            Token = "expired-token",
            NewPassword = "NewPassword123!"
        });

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.NotNull(badRequest.Value);
    }

    [Fact]
    public async Task ResetPassword_InvalidOrUsedToken_ReturnsBadRequest()
    {
        using var db = CreateInMemoryDbContext();
        var controller = CreateController(db);

        var result = await controller.ResetPassword(new ResetPasswordRequest
        {
            Token = "non-existent-token",
            NewPassword = "NewPassword123!"
        });

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.NotNull(badRequest.Value);
    }

    [Fact]
    public async Task ResetPassword_TooShortPassword_ReturnsBadRequest()
    {
        using var db = CreateInMemoryDbContext();
        var controller = CreateController(db);

        var user = new User
        {
            Email = "learner@ankix.io",
            PasswordHash = "oldhash",
            PasswordResetToken = "valid-token",
            PasswordResetExpiresAt = DateTime.UtcNow.AddMinutes(10)
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var result = await controller.ResetPassword(new ResetPasswordRequest
        {
            Token = "valid-token",
            NewPassword = "short"
        });

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.NotNull(badRequest.Value);
    }

    [Fact]
    public async Task ResetPassword_AllowsLoginWithNewPasswordAndRejectsOldPassword()
    {
        using var db = CreateInMemoryDbContext();
        var pwdService = new PasswordService();
        var controller = CreateController(db, passwordService: pwdService);

        var user = new User
        {
            Email = "learner@ankix.io",
            PasswordHash = pwdService.HashPassword("InitialPassword123!"),
            PasswordResetToken = "token-for-login-test",
            PasswordResetExpiresAt = DateTime.UtcNow.AddMinutes(15)
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        // 1. Reset password
        await controller.ResetPassword(new ResetPasswordRequest
        {
            Token = "token-for-login-test",
            NewPassword = "UpdatedPassword456!"
        });

        // 2. Old password login must fail
        var oldLoginResult = await controller.Login(new LoginRequest
        {
            Email = "learner@ankix.io",
            Password = "InitialPassword123!"
        });
        Assert.IsType<UnauthorizedObjectResult>(oldLoginResult);

        // 3. New password login must succeed
        var newLoginResult = await controller.Login(new LoginRequest
        {
            Email = "learner@ankix.io",
            Password = "UpdatedPassword456!"
        });
        var okLogin = Assert.IsType<OkObjectResult>(newLoginResult);
        var authResp = Assert.IsType<AuthResponse>(okLogin.Value);
        Assert.NotEmpty(authResp.AccessToken);
        Assert.Equal("learner@ankix.io", authResp.User.Email);
    }

    [Fact]
    public async Task EmailVerification_SendAndVerifyFlow_Succeeds()
    {
        using var db = CreateInMemoryDbContext();
        var spyEmail = new TestEmailService();
        var controller = CreateController(db, emailService: spyEmail);

        var user = new User
        {
            Email = "verify@ankix.io",
            PasswordHash = "hash",
            DisplayName = "Verify User",
            IsEmailVerified = false
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        // 1. Send verification
        var sendResult = await controller.SendVerification(new SendVerificationRequest
        {
            Email = "verify@ankix.io"
        });
        Assert.IsType<OkObjectResult>(sendResult);

        var userWithToken = await db.Users.FirstAsync(u => u.Email == "verify@ankix.io");
        Assert.NotNull(userWithToken.EmailVerificationToken);
        Assert.NotEmpty(userWithToken.EmailVerificationToken);
        Assert.NotNull(userWithToken.EmailVerificationExpiresAt);

        Assert.Single(spyEmail.SentVerificationEmails);
        var sent = spyEmail.SentVerificationEmails[0];
        Assert.Equal("verify@ankix.io", sent.Email);
        Assert.Equal(userWithToken.EmailVerificationToken, sent.Token);

        // 2. Verify with valid token
        var verifyResult = await controller.VerifyEmail(new VerifyEmailRequest
        {
            Token = userWithToken.EmailVerificationToken
        });
        Assert.IsType<OkObjectResult>(verifyResult);

        var verifiedUser = await db.Users.FirstAsync(u => u.Email == "verify@ankix.io");
        Assert.True(verifiedUser.IsEmailVerified);
        Assert.Null(verifiedUser.EmailVerificationToken);
        Assert.Null(verifiedUser.EmailVerificationExpiresAt);
    }

    [Fact]
    public async Task EmailVerification_ExpiredToken_ReturnsBadRequest()
    {
        using var db = CreateInMemoryDbContext();
        var controller = CreateController(db);

        var user = new User
        {
            Email = "expired-verify@ankix.io",
            PasswordHash = "hash",
            EmailVerificationToken = "expired-token",
            EmailVerificationExpiresAt = DateTime.UtcNow.AddHours(-1)
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var result = await controller.VerifyEmail(new VerifyEmailRequest
        {
            Token = "expired-token"
        });

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Register_AutomaticallyGeneratesTokenAndDispatchesEmailVerification()
    {
        using var db = CreateInMemoryDbContext();
        var spyEmail = new TestEmailService();
        var controller = CreateController(db, emailService: spyEmail);

        var result = await controller.Register(new RegisterRequest
        {
            Email = "newbie@ankix.io",
            Password = "Password123!",
            DisplayName = "Newbie User"
        });

        var createdResult = Assert.IsType<CreatedResult>(result);
        Assert.NotNull(createdResult.Value);

        var user = await db.Users.FirstAsync(u => u.Email == "newbie@ankix.io");
        Assert.False(user.IsEmailVerified);
        Assert.NotNull(user.EmailVerificationToken);
        Assert.NotEmpty(user.EmailVerificationToken);
        Assert.NotNull(user.EmailVerificationExpiresAt);

        Assert.Single(spyEmail.SentVerificationEmails);
        var sent = spyEmail.SentVerificationEmails[0];
        Assert.Equal("newbie@ankix.io", sent.Email);
        Assert.Equal(user.EmailVerificationToken, sent.Token);
    }
}
