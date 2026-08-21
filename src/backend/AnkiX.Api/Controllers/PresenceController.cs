using System.Security.Claims;
using AnkiX.Api.Data;
using AnkiX.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AnkiX.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/presence")]
public sealed class PresenceController : ControllerBase
{
    private readonly ApplicationDbContext dbContext;

    public PresenceController(ApplicationDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    /// <summary>
    /// Records a heartbeat from the active user, updating their LastActiveAt timestamp.
    /// </summary>
    [HttpPost("heartbeat")]
    public async Task<IActionResult> RecordHeartbeat()
    {
        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized(new { message = "Invalid user identification." });
        }

        User? user = await dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user is null)
        {
            return NotFound(new { message = "User not found." });
        }

        user.LastActiveAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync();

        return Ok(new
        {
            status = "online",
            userId = user.Id,
            lastActiveAt = user.LastActiveAt
        });
    }
}
