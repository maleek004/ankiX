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

    public AuthController(
        ApplicationDbContext dbContext,
        IPasswordService passwordService,
        ITokenService tokenService,
        IOAuthService oauthService)
    {
        this.dbContext = dbContext;
        this.passwordService = passwordService;
        this.tokenService = tokenService;
        this.oauthService = oauthService;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        string normalizedEmail = request.Email.Trim().ToLowerInvariant();
        bool emailExists = await dbContext.Users.AnyAsync(user => user.Email == normalizedEmail);
        if (emailExists)
        {
            return Conflict(new { message = "Email already exists." });
        }

        string displayName = UserHelper.GetEffectiveDisplayName(request.DisplayName, normalizedEmail);

        User user = new User
        {
            Email = normalizedEmail,
            PasswordHash = passwordService.HashPassword(request.Password),
            DisplayName = displayName,
            Role = Roles.User,
            AuthProvider = "local",
            CreatedAt = DateTime.UtcNow
        };

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        return Created(string.Empty, new
        {
            userId = user.Id,
            email = user.Email,
            displayName = user.DisplayName,
            role = user.Role
        });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        try
        {
            string normalizedEmail = request.Email.Trim().ToLowerInvariant();
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
                    Role = user.Role
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
        OAuthUserPayload? payload = await oauthService.VerifyAndExtractPayloadAsync(
            request.Provider,
            request.IdToken,
            request.Code,
            request.RedirectUri);

        if (payload is null)
        {
            return BadRequest(new { message = $"OAuth verification failed for provider '{request.Provider}'." });
        }

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
                Role = user.Role
            }
        };

        return Ok(response);
    }
}

