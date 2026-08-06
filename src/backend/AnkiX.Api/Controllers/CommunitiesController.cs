using System.Security.Claims;
using AnkiX.Api.Contracts.Content;
using AnkiX.Api.Data;
using AnkiX.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AnkiX.Api.Controllers;

[ApiController]
[Route("api/communities")]
public sealed class CommunitiesController : ControllerBase
{
    private readonly ApplicationDbContext dbContext;

    public CommunitiesController(ApplicationDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<CommunityResponse>>> GetCommunities()
    {
        int? currentUserId = GetCurrentUserId();

        var communities = await dbContext.Communities.AsNoTracking().ToListAsync();
        var memberCounts = await dbContext.CommunityMembers.AsNoTracking()
            .GroupBy(m => m.CommunityId)
            .Select(g => new { CommunityId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.CommunityId, x => x.Count);

        var deckCounts = await dbContext.Decks.AsNoTracking()
            .Where(d => d.CommunityId.HasValue)
            .GroupBy(d => d.CommunityId!.Value)
            .Select(g => new { CommunityId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.CommunityId, x => x.Count);

        var exerciseCounts = await dbContext.Exercises.AsNoTracking()
            .Where(e => e.CommunityId.HasValue)
            .GroupBy(e => e.CommunityId!.Value)
            .Select(g => new { CommunityId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.CommunityId, x => x.Count);

        var userMemberships = currentUserId.HasValue
            ? await dbContext.CommunityMembers.AsNoTracking()
                .Where(m => m.UserId == currentUserId.Value)
                .ToDictionaryAsync(m => m.CommunityId, m => m.Role)
            : new Dictionary<int, string>();

        var response = communities.Select(c => new CommunityResponse
        {
            Id = c.Id,
            Name = c.Name,
            Slug = c.Slug,
            Description = c.Description,
            AvatarUrl = c.AvatarUrl,
            IsPublic = c.IsPublic,
            MemberCount = memberCounts.TryGetValue(c.Id, out int mCount) ? mCount : 0,
            DeckCount = deckCounts.TryGetValue(c.Id, out int dCount) ? dCount : 0,
            ExerciseCount = exerciseCounts.TryGetValue(c.Id, out int eCount) ? eCount : 0,
            UserRole = userMemberships.TryGetValue(c.Id, out string? role) ? role : null,
            CreatedByUserId = c.CreatedByUserId,
            CreatedAt = c.CreatedAt
        });

        return Ok(response);
    }

    [HttpGet("{slug}")]
    public async Task<ActionResult<CommunityResponse>> GetCommunityBySlug(string slug)
    {
        var community = await dbContext.Communities.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Slug.ToLower() == slug.ToLower());

        if (community == null) return NotFound("Community not found.");

        int? currentUserId = GetCurrentUserId();
        int memberCount = await dbContext.CommunityMembers.CountAsync(m => m.CommunityId == community.Id);
        int deckCount = await dbContext.Decks.CountAsync(d => d.CommunityId == community.Id);
        int exerciseCount = await dbContext.Exercises.CountAsync(e => e.CommunityId == community.Id);

        string? userRole = null;
        if (currentUserId.HasValue)
        {
            var membership = await dbContext.CommunityMembers.AsNoTracking()
                .FirstOrDefaultAsync(m => m.CommunityId == community.Id && m.UserId == currentUserId.Value);
            userRole = membership?.Role;
        }

        return Ok(new CommunityResponse
        {
            Id = community.Id,
            Name = community.Name,
            Slug = community.Slug,
            Description = community.Description,
            AvatarUrl = community.AvatarUrl,
            IsPublic = community.IsPublic,
            MemberCount = memberCount,
            DeckCount = deckCount,
            ExerciseCount = exerciseCount,
            UserRole = userRole,
            CreatedByUserId = community.CreatedByUserId,
            CreatedAt = community.CreatedAt
        });
    }

    [Authorize(Roles = Roles.Admin)]
    [HttpPost]
    public async Task<ActionResult<CommunityResponse>> CreateCommunity([FromBody] CreateCommunityRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Slug))
        {
            return BadRequest("Community Name and Slug are required.");
        }

        string cleanSlug = request.Slug.Trim().ToLowerInvariant().Replace(" ", "-");
        bool slugExists = await dbContext.Communities.AnyAsync(c => c.Slug == cleanSlug);
        if (slugExists)
        {
            return BadRequest($"A community with slug '{cleanSlug}' already exists.");
        }

        int userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var community = new Community
        {
            Name = request.Name.Trim(),
            Slug = cleanSlug,
            Description = request.Description?.Trim(),
            AvatarUrl = request.AvatarUrl?.Trim(),
            IsPublic = request.IsPublic,
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.Communities.Add(community);
        await dbContext.SaveChangesAsync();

        // Creator automatically becomes Community Owner
        var ownerMembership = new CommunityMember
        {
            CommunityId = community.Id,
            UserId = userId,
            Role = CommunityRoles.Owner,
            JoinedAt = DateTime.UtcNow
        };

        dbContext.CommunityMembers.Add(ownerMembership);
        await dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetCommunityBySlug), new { slug = community.Slug }, new CommunityResponse
        {
            Id = community.Id,
            Name = community.Name,
            Slug = community.Slug,
            Description = community.Description,
            AvatarUrl = community.AvatarUrl,
            IsPublic = community.IsPublic,
            MemberCount = 1,
            DeckCount = 0,
            ExerciseCount = 0,
            UserRole = CommunityRoles.Owner,
            CreatedByUserId = userId,
            CreatedAt = community.CreatedAt
        });
    }

    [Authorize]
    [HttpPost("{slug}/join")]
    public async Task<IActionResult> JoinCommunity(string slug)
    {
        var community = await dbContext.Communities.FirstOrDefaultAsync(c => c.Slug.ToLower() == slug.ToLower());
        if (community == null) return NotFound("Community not found.");

        int userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var existing = await dbContext.CommunityMembers
            .FirstOrDefaultAsync(m => m.CommunityId == community.Id && m.UserId == userId);

        if (existing != null)
        {
            return BadRequest("You are already a member of this community.");
        }

        var member = new CommunityMember
        {
            CommunityId = community.Id,
            UserId = userId,
            Role = CommunityRoles.Member,
            JoinedAt = DateTime.UtcNow
        };

        dbContext.CommunityMembers.Add(member);
        await dbContext.SaveChangesAsync();

        return Ok(new { message = $"Successfully joined '{community.Name}'." });
    }

    [Authorize]
    [HttpDelete("{slug}/leave")]
    public async Task<IActionResult> LeaveCommunity(string slug)
    {
        var community = await dbContext.Communities.FirstOrDefaultAsync(c => c.Slug.ToLower() == slug.ToLower());
        if (community == null) return NotFound("Community not found.");

        int userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var membership = await dbContext.CommunityMembers
            .FirstOrDefaultAsync(m => m.CommunityId == community.Id && m.UserId == userId);

        if (membership == null)
        {
            return BadRequest("You are not a member of this community.");
        }

        if (membership.Role == CommunityRoles.Owner)
        {
            int ownerCount = await dbContext.CommunityMembers.CountAsync(m => m.CommunityId == community.Id && m.Role == CommunityRoles.Owner);
            if (ownerCount <= 1)
            {
                return BadRequest("Community owners cannot leave without transferring ownership first.");
            }
        }

        dbContext.CommunityMembers.Remove(membership);
        await dbContext.SaveChangesAsync();

        return Ok(new { message = $"Successfully left '{community.Name}'." });
    }

    [HttpGet("{slug}/members")]
    public async Task<ActionResult<IEnumerable<CommunityMemberResponse>>> GetCommunityMembers(string slug)
    {
        var community = await dbContext.Communities.AsNoTracking().FirstOrDefaultAsync(c => c.Slug.ToLower() == slug.ToLower());
        if (community == null) return NotFound("Community not found.");

        var members = await (from cm in dbContext.CommunityMembers.AsNoTracking()
                             join u in dbContext.Users.AsNoTracking() on cm.UserId equals u.Id
                             where cm.CommunityId == community.Id
                             select new CommunityMemberResponse
                             {
                                 UserId = u.Id,
                                 DisplayName = u.DisplayName,
                                 Email = u.Email,
                                 Role = cm.Role,
                                 JoinedAt = cm.JoinedAt
                             }).ToListAsync();

        return Ok(members);
    }

    [HttpGet("{slug}/decks")]
    public async Task<ActionResult<IEnumerable<DeckResponse>>> GetCommunityDecks(string slug)
    {
        var community = await dbContext.Communities.AsNoTracking().FirstOrDefaultAsync(c => c.Slug.ToLower() == slug.ToLower());
        if (community == null) return NotFound("Community not found.");

        var decks = await dbContext.Decks.AsNoTracking()
            .Where(d => d.CommunityId == community.Id)
            .ToListAsync();

        var response = decks.Select(d => new DeckResponse
        {
            Id = d.Id,
            Title = d.Title,
            Description = d.Description,
            CreatedByUserId = d.CreatedByUserId,
            DueCount = 0,
            LearnCount = 0
        });

        return Ok(response);
    }

    [HttpGet("{slug}/exercises")]
    public async Task<ActionResult<IEnumerable<ExerciseResponse>>> GetCommunityExercises(string slug)
    {
        var community = await dbContext.Communities.AsNoTracking().FirstOrDefaultAsync(c => c.Slug.ToLower() == slug.ToLower());
        if (community == null) return NotFound("Community not found.");

        var exercises = await dbContext.Exercises.AsNoTracking()
            .Where(e => e.CommunityId == community.Id)
            .ToListAsync();

        var response = exercises.Select(e => new ExerciseResponse
        {
            Id = e.Id,
            Title = e.Title,
            Description = e.Description,
            Language = e.Language,
            ExerciseType = e.ExerciseType,
            ExerciseSpec = e.ExerciseSpec,
            CreatedByUserId = e.CreatedByUserId,
            CreatedAt = e.CreatedAt,
            LinkedCardsCount = 0,
            AverageEaseFactor = 2.50,
            TotalReviewsCount = 0
        });

        return Ok(response);
    }

    private int? GetCurrentUserId()
    {
        string? val = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(val, out int userId) ? userId : null;
    }
}
