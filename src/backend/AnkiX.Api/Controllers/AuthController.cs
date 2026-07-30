using AnkiX.Api.Contracts.Auth;
using AnkiX.Api.Data;
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

    public AuthController(ApplicationDbContext dbContext, IPasswordService passwordService, ITokenService tokenService)
    {
        this.dbContext = dbContext;
        this.passwordService = passwordService;
        this.tokenService = tokenService;
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

        string displayName = string.IsNullOrWhiteSpace(request.DisplayName)
            ? normalizedEmail.Split('@')[0]
            : request.DisplayName.Trim();

        User user = new User
        {
            Email = normalizedEmail,
            PasswordHash = passwordService.HashPassword(request.Password),
            DisplayName = displayName,
            Role = Roles.User,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        return Created(string.Empty, new
        {
            userId = user.Id,
            email = user.Email,
            role = user.Role
        });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
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
                Role = user.Role
            }
        };

        return Ok(response);
    }
}
