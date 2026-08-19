using System.Security.Claims;
using AnkiX.Api.Contracts.Content;
using AnkiX.Api.Data;
using AnkiX.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AnkiX.Api.Controllers;

[ApiController]
[Route("api/study-groups")]
[Route("api/communities")]
public sealed class StudyGroupsController : ControllerBase
{
    private readonly ApplicationDbContext dbContext;

    public StudyGroupsController(ApplicationDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<StudyGroupResponse>>> GetStudyGroups()
    {
        int? currentUserId = GetCurrentUserId();

        var studyGroups = await dbContext.StudyGroups.AsNoTracking().ToListAsync();
        var memberCounts = await dbContext.StudyGroupMembers.AsNoTracking()
            .GroupBy(m => m.StudyGroupId)
            .Select(g => new { StudyGroupId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StudyGroupId, x => x.Count);

        int sampleGroupId = await dbContext.StudyGroups.Where(c => c.Slug == "sample").Select(c => c.Id).FirstOrDefaultAsync();

        var deckCounts = await dbContext.Decks.AsNoTracking()
            .GroupBy(d => d.StudyGroupId.HasValue && d.StudyGroupId.Value > 0 ? d.StudyGroupId.Value : sampleGroupId)
            .Select(g => new { StudyGroupId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StudyGroupId, x => x.Count);

        var exerciseCounts = await dbContext.Exercises.AsNoTracking()
            .GroupBy(e => e.StudyGroupId.HasValue && e.StudyGroupId.Value > 0 ? e.StudyGroupId.Value : sampleGroupId)
            .Select(g => new { StudyGroupId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StudyGroupId, x => x.Count);

        var userMemberships = currentUserId.HasValue
            ? await dbContext.StudyGroupMembers.AsNoTracking()
                .Where(m => m.UserId == currentUserId.Value)
                .ToDictionaryAsync(m => m.StudyGroupId, m => m.Role)
            : new Dictionary<int, string>();

        var filtered = studyGroups.Where(c => c.IsPublic || userMemberships.ContainsKey(c.Id)).ToList();

        var response = filtered.Select(c => new StudyGroupResponse
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

    [HttpGet("public")]
    public async Task<ActionResult<IEnumerable<StudyGroupResponse>>> GetPublicStudyGroups()
    {
        var studyGroups = await dbContext.StudyGroups.AsNoTracking().Where(c => c.IsPublic).ToListAsync();
        var memberCounts = await dbContext.StudyGroupMembers.AsNoTracking()
            .GroupBy(m => m.StudyGroupId)
            .Select(g => new { StudyGroupId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StudyGroupId, x => x.Count);

        int sampleGroupId = await dbContext.StudyGroups.Where(c => c.Slug == "sample").Select(c => c.Id).FirstOrDefaultAsync();

        var deckCounts = await dbContext.Decks.AsNoTracking()
            .GroupBy(d => d.StudyGroupId.HasValue && d.StudyGroupId.Value > 0 ? d.StudyGroupId.Value : sampleGroupId)
            .Select(g => new { StudyGroupId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StudyGroupId, x => x.Count);

        var exerciseCounts = await dbContext.Exercises.AsNoTracking()
            .GroupBy(e => e.StudyGroupId.HasValue && e.StudyGroupId.Value > 0 ? e.StudyGroupId.Value : sampleGroupId)
            .Select(g => new { StudyGroupId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StudyGroupId, x => x.Count);

        int? currentUserId = GetCurrentUserId();
        var userMemberships = currentUserId.HasValue
            ? await dbContext.StudyGroupMembers.AsNoTracking()
                .Where(m => m.UserId == currentUserId.Value)
                .ToDictionaryAsync(m => m.StudyGroupId, m => m.Role)
            : new Dictionary<int, string>();

        var response = studyGroups.Select(c => new StudyGroupResponse
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
    public async Task<ActionResult<StudyGroupResponse>> GetStudyGroupBySlug(string slug)
    {
        var studyGroup = await dbContext.StudyGroups.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Slug.ToLower() == slug.ToLower());

        if (studyGroup == null) return NotFound("Study group not found.");

        int? currentUserId = GetCurrentUserId();
        bool isSystemAdmin = User.IsInRole(Roles.Admin) || User.IsInRole(Roles.SuperAdmin);

        if (!studyGroup.IsPublic && !isSystemAdmin)
        {
            if (!currentUserId.HasValue)
            {
                return NotFound("Study group not found.");
            }
            bool isMember = await dbContext.StudyGroupMembers.AnyAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == currentUserId.Value);
            if (!isMember)
            {
                return NotFound("Study group not found.");
            }
        }

        int sampleGroupId = await dbContext.StudyGroups.Where(c => c.Slug == "sample").Select(c => c.Id).FirstOrDefaultAsync();
        bool isSample = studyGroup.Id == sampleGroupId;

        int memberCount = await dbContext.StudyGroupMembers.CountAsync(m => m.StudyGroupId == studyGroup.Id);
        int deckCount = await dbContext.Decks.CountAsync(d => d.StudyGroupId == studyGroup.Id || (isSample && (d.StudyGroupId == null || d.StudyGroupId == 0)));
        int exerciseCount = await dbContext.Exercises.CountAsync(e => e.StudyGroupId == studyGroup.Id || (isSample && (e.StudyGroupId == null || e.StudyGroupId == 0)));

        string? userRole = null;
        if (currentUserId.HasValue)
        {
            var membership = await dbContext.StudyGroupMembers.AsNoTracking()
                .FirstOrDefaultAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == currentUserId.Value);
            userRole = membership?.Role;
        }

        return Ok(new StudyGroupResponse
        {
            Id = studyGroup.Id,
            Name = studyGroup.Name,
            Slug = studyGroup.Slug,
            Description = studyGroup.Description,
            AvatarUrl = studyGroup.AvatarUrl,
            IsPublic = studyGroup.IsPublic,
            MemberCount = memberCount,
            DeckCount = deckCount,
            ExerciseCount = exerciseCount,
            UserRole = userRole,
            CreatedByUserId = studyGroup.CreatedByUserId,
            CreatedAt = studyGroup.CreatedAt
        });
    }

    [Authorize]
    [HttpPost]
    public async Task<ActionResult<StudyGroupResponse>> CreateStudyGroup([FromBody] CreateStudyGroupRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Slug))
        {
            return BadRequest("Study Group Name and Slug are required.");
        }

        string cleanSlug = request.Slug.Trim().ToLowerInvariant().Replace(" ", "-");
        bool slugExists = await dbContext.StudyGroups.AnyAsync(c => c.Slug == cleanSlug);
        if (slugExists)
        {
            return BadRequest($"A study group with slug '{cleanSlug}' already exists.");
        }

        int userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var studyGroup = new StudyGroup
        {
            Name = request.Name.Trim(),
            Slug = cleanSlug,
            Description = request.Description?.Trim(),
            AvatarUrl = request.AvatarUrl?.Trim(),
            IsPublic = request.IsPublic,
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.StudyGroups.Add(studyGroup);
        await dbContext.SaveChangesAsync();

        // Creator automatically becomes Study Group Owner
        var ownerMembership = new StudyGroupMember
        {
            StudyGroupId = studyGroup.Id,
            UserId = userId,
            Role = StudyGroupRoles.Owner,
            JoinedAt = DateTime.UtcNow
        };

        dbContext.StudyGroupMembers.Add(ownerMembership);
        await dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetStudyGroupBySlug), new { slug = studyGroup.Slug }, new StudyGroupResponse
        {
            Id = studyGroup.Id,
            Name = studyGroup.Name,
            Slug = studyGroup.Slug,
            Description = studyGroup.Description,
            AvatarUrl = studyGroup.AvatarUrl,
            IsPublic = studyGroup.IsPublic,
            MemberCount = 1,
            DeckCount = 0,
            ExerciseCount = 0,
            UserRole = StudyGroupRoles.Owner,
            CreatedByUserId = userId,
            CreatedAt = studyGroup.CreatedAt
        });
    }

    [Authorize]
    [HttpPost("{slug}/join")]
    public async Task<IActionResult> JoinStudyGroup(string slug)
    {
        var studyGroup = await dbContext.StudyGroups.FirstOrDefaultAsync(c => c.Slug.ToLower() == slug.ToLower());
        if (studyGroup == null) return NotFound("Study group not found.");

        int userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var existing = await dbContext.StudyGroupMembers
            .FirstOrDefaultAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == userId);

        if (existing != null)
        {
            return BadRequest("You are already a member of this study group.");
        }

        var member = new StudyGroupMember
        {
            StudyGroupId = studyGroup.Id,
            UserId = userId,
            Role = StudyGroupRoles.Member,
            JoinedAt = DateTime.UtcNow
        };

        dbContext.StudyGroupMembers.Add(member);
        await dbContext.SaveChangesAsync();

        return Ok(new { message = $"Successfully joined '{studyGroup.Name}'." });
    }

    [Authorize]
    [HttpDelete("{slug}/leave")]
    public async Task<IActionResult> LeaveStudyGroup(string slug)
    {
        var studyGroup = await dbContext.StudyGroups.FirstOrDefaultAsync(c => c.Slug.ToLower() == slug.ToLower());
        if (studyGroup == null) return NotFound("Study group not found.");

        int userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var membership = await dbContext.StudyGroupMembers
            .FirstOrDefaultAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == userId);

        if (membership == null)
        {
            return BadRequest("You are not a member of this study group.");
        }

        if (membership.Role == StudyGroupRoles.Owner)
        {
            int ownerCount = await dbContext.StudyGroupMembers.CountAsync(m => m.StudyGroupId == studyGroup.Id && m.Role == StudyGroupRoles.Owner);
            if (ownerCount <= 1)
            {
                return BadRequest("Study group owners cannot leave without transferring ownership first.");
            }
        }

        dbContext.StudyGroupMembers.Remove(membership);
        await dbContext.SaveChangesAsync();

        return Ok(new { message = $"Successfully left '{studyGroup.Name}'." });
    }

    [HttpGet("{slug}/members")]
    public async Task<ActionResult<IEnumerable<StudyGroupMemberResponse>>> GetStudyGroupMembers(string slug)
    {
        var studyGroup = await dbContext.StudyGroups.AsNoTracking().FirstOrDefaultAsync(c => c.Slug.ToLower() == slug.ToLower());
        if (studyGroup == null) return NotFound("Study group not found.");

        int? currentUserId = GetCurrentUserId();
        bool isSystemAdmin = User.IsInRole(Roles.Admin) || User.IsInRole(Roles.SuperAdmin);

        if (!studyGroup.IsPublic && !isSystemAdmin)
        {
            if (!currentUserId.HasValue)
            {
                return NotFound("Study group not found.");
            }
            bool isMember = await dbContext.StudyGroupMembers.AnyAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == currentUserId.Value);
            if (!isMember)
            {
                return NotFound("Study group not found.");
            }
        }

        bool canViewPii = isSystemAdmin || (currentUserId.HasValue && await dbContext.StudyGroupMembers.AnyAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == currentUserId.Value));

        var members = await (from cm in dbContext.StudyGroupMembers.AsNoTracking()
                             join u in dbContext.Users.AsNoTracking() on cm.UserId equals u.Id
                             where cm.StudyGroupId == studyGroup.Id
                             select new StudyGroupMemberResponse
                             {
                                 UserId = u.Id,
                                 DisplayName = u.DisplayName,
                                 Email = canViewPii ? u.Email : string.Empty,
                                 Role = cm.Role,
                                 JoinedAt = cm.JoinedAt
                             }).ToListAsync();

        return Ok(members);
    }

    [Authorize]
    [HttpPost("{slug}/members")]
    public async Task<ActionResult<StudyGroupMemberResponse>> AddMember(string slug, [FromBody] AddStudyGroupMemberRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest("Email is required.");
        }

        var studyGroup = await dbContext.StudyGroups.FirstOrDefaultAsync(c => c.Slug.ToLower() == slug.ToLower());
        if (studyGroup == null) return NotFound("Study group not found.");

        int currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var callerMembership = await dbContext.StudyGroupMembers
            .FirstOrDefaultAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == currentUserId);

        bool isSystemAdmin = User.IsInRole(Roles.Admin);
        bool isStudyGroupOwnerOrAdmin = callerMembership?.Role == StudyGroupRoles.Owner || callerMembership?.Role == StudyGroupRoles.Admin;

        if (!isSystemAdmin && !isStudyGroupOwnerOrAdmin)
        {
            return Forbid();
        }

        string reqEmail = request.Email.Trim().ToLower();
        var targetUser = await dbContext.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == reqEmail);
        if (targetUser == null)
        {
            return BadRequest($"No registered user found with email '{request.Email.Trim()}'.");
        }

        var existingMembership = await dbContext.StudyGroupMembers
            .FirstOrDefaultAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == targetUser.Id);

        if (existingMembership != null)
        {
            return BadRequest($"User '{targetUser.Email}' is already a member of this study group.");
        }

        string assignRole = string.IsNullOrWhiteSpace(request.Role) ? StudyGroupRoles.Member : request.Role.Trim();
        if (assignRole is not StudyGroupRoles.Owner and not StudyGroupRoles.Admin and not StudyGroupRoles.Contributor and not StudyGroupRoles.Member)
        {
            return BadRequest("Role must be 'Owner', 'Admin', 'Contributor', or 'Member'.");
        }

        if (assignRole == StudyGroupRoles.Owner && !isSystemAdmin && callerMembership?.Role != StudyGroupRoles.Owner)
        {
            return BadRequest("Only study group owners can assign Owner role.");
        }

        var newMember = new StudyGroupMember
        {
            StudyGroupId = studyGroup.Id,
            UserId = targetUser.Id,
            Role = assignRole,
            JoinedAt = DateTime.UtcNow
        };

        dbContext.StudyGroupMembers.Add(newMember);
        await dbContext.SaveChangesAsync();

        return Ok(new StudyGroupMemberResponse
        {
            UserId = targetUser.Id,
            DisplayName = targetUser.DisplayName,
            Email = targetUser.Email,
            Role = newMember.Role,
            JoinedAt = newMember.JoinedAt
        });
    }

    [Authorize]
    [HttpPut("{slug}/members/{targetUserId:int}/role")]
    public async Task<IActionResult> UpdateMemberRole(string slug, int targetUserId, [FromBody] UpdateMemberRoleRequest request)
    {
        var studyGroup = await dbContext.StudyGroups.FirstOrDefaultAsync(c => c.Slug.ToLower() == slug.ToLower());
        if (studyGroup == null) return NotFound("Study group not found.");

        int currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var callerMembership = await dbContext.StudyGroupMembers
            .FirstOrDefaultAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == currentUserId);

        bool isSystemAdmin = User.IsInRole(Roles.Admin);
        bool isStudyGroupOwnerOrAdmin = callerMembership?.Role == StudyGroupRoles.Owner || callerMembership?.Role == StudyGroupRoles.Admin;

        if (!isSystemAdmin && !isStudyGroupOwnerOrAdmin)
        {
            return Forbid();
        }

        string newRole = request.Role.Trim();
        if (newRole is not StudyGroupRoles.Owner and not StudyGroupRoles.Admin and not StudyGroupRoles.Contributor and not StudyGroupRoles.Member)
        {
            return BadRequest("Role must be 'Owner', 'Admin', 'Contributor', or 'Member'.");
        }

        var targetMembership = await dbContext.StudyGroupMembers
            .FirstOrDefaultAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == targetUserId);

        if (targetMembership == null)
        {
            return NotFound("Member not found in study group.");
        }

        if ((newRole == StudyGroupRoles.Owner || targetMembership.Role == StudyGroupRoles.Owner) && !isSystemAdmin && callerMembership?.Role != StudyGroupRoles.Owner)
        {
            return BadRequest("Only study group owners can manage Owner role.");
        }

        targetMembership.Role = newRole;
        await dbContext.SaveChangesAsync();

        return Ok(new { message = $"Role updated to '{newRole}' successfully." });
    }

    private int? GetCurrentUserId()
    {
        string? val = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(val, out int userId) ? userId : null;
    }
}
