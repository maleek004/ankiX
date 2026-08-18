using System.Security.Cryptography;
using AnkiX.Api.Contracts.Auth;
using AnkiX.Api.Data;
using AnkiX.Api.Helpers;
using AnkiX.Api.Models;
using AnkiX.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AnkiX.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly ApplicationDbContext dbContext;
    private readonly IPasswordService passwordService;
    private readonly ITokenService tokenService;
    private readonly IOAuthService oauthService;
    private readonly IEmailService emailService;

    public AuthController(
        ApplicationDbContext dbContext,
        IPasswordService passwordService,
        ITokenService tokenService,
        IOAuthService oauthService,
        IEmailService? emailService = null)
    {
        this.dbContext = dbContext;
        this.passwordService = passwordService;
        this.tokenService = tokenService;
        this.oauthService = oauthService;
        this.emailService = emailService ?? new EmailService(Microsoft.Extensions.Logging.Abstractions.NullLogger<EmailService>.Instance);
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        try
        {
            if (!EmailValidator.IsValid(request.Email))
            {
                return BadRequest(new { message = "Invalid email format. Please provide a valid email address (e.g. name@example.com)." });
            }

            string normalizedEmail = request.Email.Trim().ToLowerInvariant();
            await EnsureUserColumnsAsync();

            bool emailExists = await dbContext.Users.AnyAsync(user => user.Email == normalizedEmail);
            if (emailExists)
            {
                return Conflict(new { message = "Email already exists." });
            }

            string displayName = UserHelper.GetEffectiveDisplayName(request.DisplayName, normalizedEmail);
            string verificationToken = GenerateSecureToken();

            User user = new User
            {
                Email = normalizedEmail,
                PasswordHash = passwordService.HashPassword(request.Password),
                DisplayName = displayName,
                Role = Roles.User,
                AuthProvider = "local",
                IsEmailVerified = false,
                EmailVerificationToken = verificationToken,
                EmailVerificationExpiresAt = DateTime.UtcNow.AddHours(24),
                CreatedAt = DateTime.UtcNow
            };

            dbContext.Users.Add(user);
            await dbContext.SaveChangesAsync();

            try
            {
                string origin = Request.Headers["Origin"].FirstOrDefault()
                    ?? $"{Request.Scheme}://{Request.Host}";
                string verifyUrl = $"{origin.TrimEnd('/')}/verify-email?token={verificationToken}";
                await emailService.SendEmailVerificationAsync(user.Email, verificationToken, verifyUrl);
            }
            catch
            {
                // Non-blocking for registration completion
            }

            return Created(string.Empty, new
            {
                userId = user.Id,
                email = user.Email,
                displayName = user.DisplayName,
                role = user.Role,
                isEmailVerified = user.IsEmailVerified,
                message = "Registration successful. A verification email has been sent to your address."
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Registration failure: " + ex.Message });
        }
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        try
        {
            if (!EmailValidator.IsValid(request.Email))
            {
                return BadRequest(new { message = "Invalid email format. Please provide a valid email address (e.g. name@example.com)." });
            }

            string normalizedEmail = request.Email.Trim().ToLowerInvariant();
            await EnsureUserColumnsAsync();

            User? user = await dbContext.Users.FirstOrDefaultAsync(entity => entity.Email == normalizedEmail);
            if (user is null || !passwordService.VerifyPassword(request.Password, user.PasswordHash))
            {
                return Unauthorized(new { message = "Invalid credentials." });
            }

            string token = tokenService.CreateToken(user);
            AuthResponse response = new AuthResponse
            {
                AccessToken = token,
                ExpiresInSeconds = tokenService.GetExpiresInSeconds(),
                User = new AuthUserResponse
                {
                    Id = user.Id,
                    Email = user.Email,
                    DisplayName = UserHelper.GetEffectiveDisplayName(user.DisplayName, user.Email),
                    Role = user.Role,
                    IsEmailVerified = user.IsEmailVerified
                }
            };

            return Ok(response);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Login failure: " + ex.Message });
        }
    }

    [HttpPost("oauth")]
    public async Task<IActionResult> OAuth([FromBody] OAuthLoginRequest request)
    {
        try
        {
            OAuthUserPayload? payload = await oauthService.VerifyAndExtractPayloadAsync(
                request.Provider,
                request.IdToken,
                request.Code,
                request.RedirectUri);

            if (payload is null)
            {
                return BadRequest(new { message = $"OAuth verification failed for provider '{request.Provider}'." });
            }

            await EnsureUserColumnsAsync();

            string normalizedEmail = payload.Email.Trim().ToLowerInvariant();
            User? user = await dbContext.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail);

            if (user is null)
            {
                string displayName = UserHelper.GetEffectiveDisplayName(payload.DisplayName, normalizedEmail);
                user = new User
                {
                    Email = normalizedEmail,
                    PasswordHash = string.Empty,
                    DisplayName = displayName,
                    Role = Roles.User,
                    AuthProvider = payload.Provider,
                    GoogleId = payload.Provider == "google" ? payload.SubId : null,
                    GitHubId = payload.Provider == "github" ? payload.SubId : null,
                    IsEmailVerified = true,
                    CreatedAt = DateTime.UtcNow
                };

                dbContext.Users.Add(user);
                await dbContext.SaveChangesAsync();
            }
            else
            {
                bool modified = false;
                if (payload.Provider == "google" && string.IsNullOrEmpty(user.GoogleId))
                {
                    user.GoogleId = payload.SubId;
                    modified = true;
                }
                else if (payload.Provider == "github" && string.IsNullOrEmpty(user.GitHubId))
                {
                    user.GitHubId = payload.SubId;
                    modified = true;
                }

                if (!user.IsEmailVerified)
                {
                    user.IsEmailVerified = true;
                    modified = true;
                }

                if (user.AuthProvider == "local" || string.IsNullOrEmpty(user.AuthProvider))
                {
                    user.AuthProvider = payload.Provider;
                    modified = true;
                }

                if (modified)
                {
                    await dbContext.SaveChangesAsync();
                }
            }

            string token = tokenService.CreateToken(user);
            AuthResponse response = new AuthResponse
            {
                AccessToken = token,
                ExpiresInSeconds = tokenService.GetExpiresInSeconds(),
                User = new AuthUserResponse
                {
                    Id = user.Id,
                    Email = user.Email,
                    DisplayName = UserHelper.GetEffectiveDisplayName(user.DisplayName, user.Email),
                    Role = user.Role,
                    IsEmailVerified = user.IsEmailVerified
                }
            };

            return Ok(response);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "OAuth failure: " + ex.Message });
        }
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Email) || !EmailValidator.IsValid(request.Email))
            {
                return BadRequest(new { message = "Invalid email format. Please provide a valid email address (e.g. name@example.com)." });
            }

            string normalizedEmail = request.Email.Trim().ToLowerInvariant();
            await EnsureUserColumnsAsync();

            User? user = await dbContext.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail);
            if (user is not null)
            {
                string token = GenerateSecureToken();
                user.PasswordResetToken = token;
                user.PasswordResetExpiresAt = DateTime.UtcNow.AddMinutes(15);
                await dbContext.SaveChangesAsync();

                string origin = Request.Headers["Origin"].FirstOrDefault()
                    ?? $"{Request.Scheme}://{Request.Host}";
                string resetUrl = $"{origin.TrimEnd('/')}/reset-password?token={token}";

                await emailService.SendPasswordResetEmailAsync(user.Email, token, resetUrl);
            }

            return Ok(new
            {
                message = "If the email is registered, a password reset link has been sent."
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Forgot password failure: " + ex.Message });
        }
    }

    [HttpPost("verify-reset-token")]
    public async Task<IActionResult> VerifyResetToken([FromBody] VerifyResetTokenRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Token))
            {
                return BadRequest(new { message = "Token is required." });
            }

            await EnsureUserColumnsAsync();

            User? user = await dbContext.Users.FirstOrDefaultAsync(u => u.PasswordResetToken == request.Token);
            if (user is null || user.PasswordResetExpiresAt is null || user.PasswordResetExpiresAt < DateTime.UtcNow)
            {
                return BadRequest(new { message = "Reset token is invalid or has expired." });
            }

            return Ok(new
            {
                valid = true,
                email = user.Email
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Token verification failure: " + ex.Message });
        }
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Token))
            {
                return BadRequest(new { message = "Reset token is required." });
            }

            if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 8)
            {
                return BadRequest(new { message = "New password must be at least 8 characters long." });
            }

            await EnsureUserColumnsAsync();

            User? user = await dbContext.Users.FirstOrDefaultAsync(u => u.PasswordResetToken == request.Token);
            if (user is null || user.PasswordResetExpiresAt is null || user.PasswordResetExpiresAt < DateTime.UtcNow)
            {
                return BadRequest(new { message = "Reset token is invalid or has expired." });
            }

            user.PasswordHash = passwordService.HashPassword(request.NewPassword);
            user.PasswordResetToken = null;
            user.PasswordResetExpiresAt = null;

            await dbContext.SaveChangesAsync();

            return Ok(new
            {
                message = "Password has been successfully reset. You may now log in."
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Reset password failure: " + ex.Message });
        }
    }

    [HttpPost("send-verification")]
    public async Task<IActionResult> SendVerification([FromBody] SendVerificationRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Email) || !EmailValidator.IsValid(request.Email))
            {
                return BadRequest(new { message = "Invalid email format. Please provide a valid email address (e.g. name@example.com)." });
            }

            string normalizedEmail = request.Email.Trim().ToLowerInvariant();
            await EnsureUserColumnsAsync();

            User? user = await dbContext.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail);
            if (user is not null && !user.IsEmailVerified)
            {
                string token = GenerateSecureToken();
                user.EmailVerificationToken = token;
                user.EmailVerificationExpiresAt = DateTime.UtcNow.AddHours(24);
                await dbContext.SaveChangesAsync();

                string origin = Request.Headers["Origin"].FirstOrDefault()
                    ?? $"{Request.Scheme}://{Request.Host}";
                string verifyUrl = $"{origin.TrimEnd('/')}/verify-email?token={token}";

                await emailService.SendEmailVerificationAsync(user.Email, token, verifyUrl);
            }

            return Ok(new
            {
                message = "If the email is registered and unverified, a verification link has been sent."
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Send verification failure: " + ex.Message });
        }
    }

    [HttpPost("verify-email")]
    public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Token))
            {
                return BadRequest(new { message = "Verification token is required." });
            }

            await EnsureUserColumnsAsync();

            User? user = await dbContext.Users.FirstOrDefaultAsync(u => u.EmailVerificationToken == request.Token);
            if (user is null || user.EmailVerificationExpiresAt is null || user.EmailVerificationExpiresAt < DateTime.UtcNow)
            {
                return BadRequest(new { message = "Email verification token is invalid or has expired." });
            }

            user.IsEmailVerified = true;
            user.EmailVerificationToken = null;
            user.EmailVerificationExpiresAt = null;

            await dbContext.SaveChangesAsync();

            return Ok(new
            {
                message = "Email has been verified successfully.",
                isEmailVerified = true
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Email verification failure: " + ex.Message });
        }
    }

    private static string GenerateSecureToken()
    {
        byte[] bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private Task EnsureUserColumnsAsync()
    {
        return Task.CompletedTask;
    }
}

