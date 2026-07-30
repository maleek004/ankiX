using AnkiX.Api.Data;
using AnkiX.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AnkiX.Api.Controllers;

public sealed class UserRoleResponse
{
    public int Id { get; set; }

    public string Email { get; set; } = string.Empty;

    public string? DisplayName { get; set; }

    public string Role { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
}

public sealed class UpdateRoleRequest
{
    public string Role { get; set; } = string.Empty;
}

[ApiController]
[Authorize(Roles = Roles.Admin)]
[Route("api/admin/users")]
public sealed class AdminUsersController : ControllerBase
{
    private readonly ApplicationDbContext dbContext;

    public AdminUsersController(ApplicationDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    /// <summary>
    /// Returns a list of all registered users in the system. Admin only.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<UserRoleResponse>>> GetUsers()
    {
        List<UserRoleResponse> users = await dbContext.Users
            .OrderByDescending(u => u.CreatedAt)
            .Select(u => new UserRoleResponse
            {
                Id = u.Id,
                Email = u.Email,
                DisplayName = u.DisplayName,
                Role = u.Role,
                CreatedAt = u.CreatedAt
            })
            .ToListAsync();

        return Ok(users);
    }

    /// <summary>
    /// Promotes or demotes a user's role (User, Contributor, Admin). Admin only.
    /// </summary>
    [HttpPut("{userId:int}/role")]
    public async Task<IActionResult> UpdateUserRole([FromRoute] int userId, [FromBody] UpdateRoleRequest request)
    {
        string requestedRole = request.Role?.Trim() ?? string.Empty;
        if (requestedRole is not Roles.User and not Roles.Contributor and not Roles.Admin)
        {
            return BadRequest(new { message = $"Role must be one of: {Roles.User}, {Roles.Contributor}, {Roles.Admin}." });
        }

        User? user = await dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user is null)
        {
            return NotFound(new { message = "User not found." });
        }

        user.Role = requestedRole;
        await dbContext.SaveChangesAsync();

        return Ok(new { message = $"User '{user.Email}' role updated to '{requestedRole}'.", userId = user.Id, role = user.Role });
    }
}
