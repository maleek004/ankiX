using System.Security.Claims;
using AnkiX.Api.Contracts.Content;
using AnkiX.Api.Data;
using AnkiX.Api.Models;
using AnkiX.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AnkiX.Api.Controllers;

public sealed class UserMembershipInfo
{
    public string Role { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
}

[ApiController]
[Route("api/study-groups")]
[Route("api/communities")]
public sealed class StudyGroupsController : ControllerBase
{
    private readonly ApplicationDbContext dbContext;
    private readonly IEmailService emailService;

    public StudyGroupsController(ApplicationDbContext dbContext, IEmailService? emailService = null)
    {
        this.dbContext = dbContext;
        this.emailService = emailService ?? new EmailService(Microsoft.Extensions.Logging.Abstractions.NullLogger<EmailService>.Instance);
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<StudyGroupResponse>>> GetStudyGroups()
    {
        int? currentUserId = GetCurrentUserId();
        bool isSystemAdmin = User.IsInRole(Roles.Admin) || User.IsInRole(Roles.SuperAdmin);

        var studyGroups = await dbContext.StudyGroups.AsNoTracking().ToListAsync();

        var memberCounts = await dbContext.StudyGroupMembers.AsNoTracking()
            .Where(m => m.Status == StudyGroupMemberStatus.Active)
            .GroupBy(m => m.StudyGroupId)
            .Select(g => new { StudyGroupId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StudyGroupId, x => x.Count);

        var pendingCounts = await dbContext.StudyGroupMembers.AsNoTracking()
            .Where(m => m.Status == StudyGroupMemberStatus.PendingRequest)
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

        Dictionary<int, UserMembershipInfo> userMemberships;
        if (currentUserId.HasValue)
        {
            userMemberships = await dbContext.StudyGroupMembers.AsNoTracking()
                .Where(m => m.UserId == currentUserId.Value)
                .ToDictionaryAsync(
                    m => m.StudyGroupId,
                    m => new UserMembershipInfo { Role = m.Role, Status = m.Status }
                );
        }
        else
        {
            userMemberships = new Dictionary<int, UserMembershipInfo>();
        }

        var filtered = studyGroups.Where(c =>
        {
            if (c.Privacy == StudyGroupPrivacy.Public || c.Privacy == StudyGroupPrivacy.Private)
                return true;

            // Locked groups: visible only to active members, invitees, or system admins
            if (isSystemAdmin) return true;
            return userMemberships.ContainsKey(c.Id);
        }).ToList();

        var response = filtered.Select(c =>
        {
            userMemberships.TryGetValue(c.Id, out var membership);
            string? role = membership != null && membership.Status == StudyGroupMemberStatus.Active ? membership.Role : null;
            string? status = membership?.Status;
            bool isOwnerOrAdmin = isSystemAdmin || role == StudyGroupRoles.Owner || role == StudyGroupRoles.Admin;

            return new StudyGroupResponse
            {
                Id = c.Id,
                Name = c.Name,
                Slug = c.Slug,
                Description = c.Description,
                AvatarUrl = c.AvatarUrl,
                Privacy = c.Privacy,
                IsPublic = c.Privacy == StudyGroupPrivacy.Public,
                MemberCount = memberCounts.TryGetValue(c.Id, out int mCount) ? mCount : 0,
                DeckCount = deckCounts.TryGetValue(c.Id, out int dCount) ? dCount : 0,
                ExerciseCount = exerciseCounts.TryGetValue(c.Id, out int eCount) ? eCount : 0,
                UserRole = role,
                UserMembershipStatus = status,
                PendingRequestCount = isOwnerOrAdmin && pendingCounts.TryGetValue(c.Id, out int pCount) ? pCount : 0,
                CreatedByUserId = c.CreatedByUserId,
                IsFrozen = c.IsFrozen,
                FrozenAt = c.FrozenAt,
                CreatedAt = c.CreatedAt
            };
        });

        return Ok(response);
    }

    [HttpGet("public")]
    public async Task<ActionResult<IEnumerable<StudyGroupResponse>>> GetPublicStudyGroups()
    {
        var studyGroups = await dbContext.StudyGroups.AsNoTracking()
            .Where(c => c.Privacy == StudyGroupPrivacy.Public)
            .ToListAsync();

        var memberCounts = await dbContext.StudyGroupMembers.AsNoTracking()
            .Where(m => m.Status == StudyGroupMemberStatus.Active)
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
                .Where(m => m.UserId == currentUserId.Value && m.Status == StudyGroupMemberStatus.Active)
                .ToDictionaryAsync(m => m.StudyGroupId, m => m.Role)
            : new Dictionary<int, string>();

        var response = studyGroups.Select(c => new StudyGroupResponse
        {
            Id = c.Id,
            Name = c.Name,
            Slug = c.Slug,
            Description = c.Description,
            AvatarUrl = c.AvatarUrl,
            Privacy = c.Privacy,
            IsPublic = true,
            MemberCount = memberCounts.TryGetValue(c.Id, out int mCount) ? mCount : 0,
            DeckCount = deckCounts.TryGetValue(c.Id, out int dCount) ? dCount : 0,
            ExerciseCount = exerciseCounts.TryGetValue(c.Id, out int eCount) ? eCount : 0,
            UserRole = userMemberships.TryGetValue(c.Id, out string? role) ? role : null,
            UserMembershipStatus = userMemberships.ContainsKey(c.Id) ? StudyGroupMemberStatus.Active : null,
            PendingRequestCount = 0,
            CreatedByUserId = c.CreatedByUserId,
            IsFrozen = c.IsFrozen,
            FrozenAt = c.FrozenAt,
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

        StudyGroupMember? userMembership = null;
        if (currentUserId.HasValue)
        {
            userMembership = await dbContext.StudyGroupMembers.AsNoTracking()
                .FirstOrDefaultAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == currentUserId.Value);
        }

        // Locked group visibility check
        if (studyGroup.Privacy == StudyGroupPrivacy.Locked && !isSystemAdmin)
        {
            if (userMembership == null)
            {
                return NotFound("Study group not found.");
            }
        }

        int sampleGroupId = await dbContext.StudyGroups.Where(c => c.Slug == "sample").Select(c => c.Id).FirstOrDefaultAsync();
        bool isSample = studyGroup.Id == sampleGroupId;

        int memberCount = await dbContext.StudyGroupMembers.CountAsync(m => m.StudyGroupId == studyGroup.Id && m.Status == StudyGroupMemberStatus.Active);
        int deckCount = await dbContext.Decks.CountAsync(d => d.StudyGroupId == studyGroup.Id || (isSample && (d.StudyGroupId == null || d.StudyGroupId == 0)));
        int exerciseCount = await dbContext.Exercises.CountAsync(e => e.StudyGroupId == studyGroup.Id || (isSample && (e.StudyGroupId == null || e.StudyGroupId == 0)));

        bool isOwnerOrAdmin = isSystemAdmin || userMembership?.Role == StudyGroupRoles.Owner || userMembership?.Role == StudyGroupRoles.Admin;
        int pendingRequestCount = 0;
        if (isOwnerOrAdmin)
        {
            pendingRequestCount = await dbContext.StudyGroupMembers.CountAsync(m => m.StudyGroupId == studyGroup.Id && m.Status == StudyGroupMemberStatus.PendingRequest);
        }

        return Ok(new StudyGroupResponse
        {
            Id = studyGroup.Id,
            Name = studyGroup.Name,
            Slug = studyGroup.Slug,
            Description = studyGroup.Description,
            AvatarUrl = studyGroup.AvatarUrl,
            Privacy = studyGroup.Privacy,
            IsPublic = studyGroup.Privacy == StudyGroupPrivacy.Public,
            MemberCount = memberCount,
            DeckCount = deckCount,
            ExerciseCount = exerciseCount,
            UserRole = userMembership?.Status == StudyGroupMemberStatus.Active ? userMembership.Role : null,
            UserMembershipStatus = userMembership?.Status,
            PendingRequestCount = pendingRequestCount,
            CreatedByUserId = studyGroup.CreatedByUserId,
            IsFrozen = studyGroup.IsFrozen,
            FrozenAt = studyGroup.FrozenAt,
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

        string privacy = request.Privacy?.Trim() ?? StudyGroupPrivacy.Public;
        if (privacy is not StudyGroupPrivacy.Public and not StudyGroupPrivacy.Private and not StudyGroupPrivacy.Locked)
        {
            if (request.IsPublic.HasValue)
            {
                privacy = request.IsPublic.Value ? StudyGroupPrivacy.Public : StudyGroupPrivacy.Private;
            }
            else
            {
                privacy = StudyGroupPrivacy.Public;
            }
        }

        int userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var studyGroup = new StudyGroup
        {
            Name = request.Name.Trim(),
            Slug = cleanSlug,
            Description = request.Description?.Trim(),
            AvatarUrl = request.AvatarUrl?.Trim(),
            Privacy = privacy,
            CreatedByUserId = userId,
            IsFrozen = false,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.StudyGroups.Add(studyGroup);
        await dbContext.SaveChangesAsync();

        // Creator automatically becomes Active Study Group Owner
        var ownerMembership = new StudyGroupMember
        {
            StudyGroupId = studyGroup.Id,
            UserId = userId,
            Role = StudyGroupRoles.Owner,
            Status = StudyGroupMemberStatus.Active,
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
            Privacy = studyGroup.Privacy,
            IsPublic = studyGroup.Privacy == StudyGroupPrivacy.Public,
            MemberCount = 1,
            DeckCount = 0,
            ExerciseCount = 0,
            UserRole = StudyGroupRoles.Owner,
            UserMembershipStatus = StudyGroupMemberStatus.Active,
            PendingRequestCount = 0,
            CreatedByUserId = userId,
            IsFrozen = false,
            FrozenAt = null,
            CreatedAt = studyGroup.CreatedAt
        });
    }

    [Authorize]
    [HttpPost("{slug}/join")]
    public async Task<IActionResult> JoinStudyGroup(string slug)
    {
        var studyGroup = await dbContext.StudyGroups.FirstOrDefaultAsync(c => c.Slug.ToLower() == slug.ToLower());
        if (studyGroup == null) return NotFound("Study group not found.");

        if (studyGroup.IsFrozen)
        {
            return StatusCode(StatusCodes.Status403Forbidden, "This study group is frozen. New members cannot join.");
        }

        if (studyGroup.Privacy == StudyGroupPrivacy.Locked)
        {
            return NotFound("Study group not found.");
        }

        if (studyGroup.Privacy == StudyGroupPrivacy.Private)
        {
            return BadRequest("This study group is private. Please submit a join request instead.");
        }

        int userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var existing = await dbContext.StudyGroupMembers
            .FirstOrDefaultAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == userId);

        if (existing != null)
        {
            if (existing.Status == StudyGroupMemberStatus.Active)
            {
                return BadRequest("You are already a member of this study group.");
            }
            existing.Status = StudyGroupMemberStatus.Active;
            existing.JoinedAt = DateTime.UtcNow;
            await dbContext.SaveChangesAsync();
            return Ok(new { message = $"Successfully joined '{studyGroup.Name}'." });
        }

        var member = new StudyGroupMember
        {
            StudyGroupId = studyGroup.Id,
            UserId = userId,
            Role = StudyGroupRoles.Member,
            Status = StudyGroupMemberStatus.Active,
            JoinedAt = DateTime.UtcNow
        };

        dbContext.StudyGroupMembers.Add(member);
        await dbContext.SaveChangesAsync();

        return Ok(new { message = $"Successfully joined '{studyGroup.Name}'." });
    }

    [Authorize]
    [HttpPost("{slug}/request-access")]
    public async Task<IActionResult> RequestAccess(string slug)
    {
        var studyGroup = await dbContext.StudyGroups.FirstOrDefaultAsync(c => c.Slug.ToLower() == slug.ToLower());
        if (studyGroup == null) return NotFound("Study group not found.");

        if (studyGroup.IsFrozen)
        {
            return StatusCode(StatusCodes.Status403Forbidden, "This study group is frozen. Join requests are disabled.");
        }

        if (studyGroup.Privacy == StudyGroupPrivacy.Locked)
        {
            return NotFound("Study group not found.");
        }

        if (studyGroup.Privacy == StudyGroupPrivacy.Public)
        {
            return BadRequest("This study group is public. You can join directly without requesting access.");
        }

        int userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var existing = await dbContext.StudyGroupMembers
            .FirstOrDefaultAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == userId);

        if (existing != null)
        {
            if (existing.Status == StudyGroupMemberStatus.Active)
            {
                return BadRequest("You are already a member of this study group.");
            }
            if (existing.Status == StudyGroupMemberStatus.PendingRequest)
            {
                return BadRequest("You already have a pending join request for this study group.");
            }
            if (existing.Status == StudyGroupMemberStatus.PendingInvite)
            {
                existing.Status = StudyGroupMemberStatus.Active;
                existing.JoinedAt = DateTime.UtcNow;
                await dbContext.SaveChangesAsync();
                return Ok(new { message = $"You had an invitation to join '{studyGroup.Name}' and are now an active member." });
            }
        }

        var requestMember = new StudyGroupMember
        {
            StudyGroupId = studyGroup.Id,
            UserId = userId,
            Role = StudyGroupRoles.Member,
            Status = StudyGroupMemberStatus.PendingRequest,
            RequestedAt = DateTime.UtcNow,
            JoinedAt = DateTime.UtcNow
        };

        dbContext.StudyGroupMembers.Add(requestMember);
        await dbContext.SaveChangesAsync();

        return Ok(new { message = $"Join request for '{studyGroup.Name}' submitted successfully. An admin will review your request." });
    }

    [Authorize]
    [HttpGet("{slug}/requests")]
    public async Task<ActionResult<IEnumerable<StudyGroupJoinRequestResponse>>> GetJoinRequests(string slug)
    {
        var studyGroup = await dbContext.StudyGroups.AsNoTracking().FirstOrDefaultAsync(c => c.Slug.ToLower() == slug.ToLower());
        if (studyGroup == null) return NotFound("Study group not found.");

        int currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        bool isSystemAdmin = User.IsInRole(Roles.Admin) || User.IsInRole(Roles.SuperAdmin);

        var callerMembership = await dbContext.StudyGroupMembers.AsNoTracking()
            .FirstOrDefaultAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == currentUserId && m.Status == StudyGroupMemberStatus.Active);

        bool isStudyGroupOwnerOrAdmin = callerMembership?.Role == StudyGroupRoles.Owner || callerMembership?.Role == StudyGroupRoles.Admin;

        if (!isSystemAdmin && !isStudyGroupOwnerOrAdmin)
        {
            return Forbid();
        }

        var requests = await (from m in dbContext.StudyGroupMembers.AsNoTracking()
                              join u in dbContext.Users.AsNoTracking() on m.UserId equals u.Id
                              where m.StudyGroupId == studyGroup.Id && m.Status == StudyGroupMemberStatus.PendingRequest
                              orderby m.RequestedAt descending
                              select new StudyGroupJoinRequestResponse
                              {
                                  UserId = u.Id,
                                  DisplayName = u.DisplayName,
                                  Email = u.Email,
                                  RequestedAt = m.RequestedAt ?? m.JoinedAt
                              }).ToListAsync();

        return Ok(requests);
    }

    [Authorize]
    [HttpPost("{slug}/requests/{targetUserId:int}/approve")]
    public async Task<IActionResult> ApproveJoinRequest(string slug, int targetUserId)
    {
        var studyGroup = await dbContext.StudyGroups.FirstOrDefaultAsync(c => c.Slug.ToLower() == slug.ToLower());
        if (studyGroup == null) return NotFound("Study group not found.");

        if (studyGroup.IsFrozen)
        {
            return StatusCode(StatusCodes.Status403Forbidden, "This study group is frozen. Requests cannot be approved.");
        }

        int currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        bool isSystemAdmin = User.IsInRole(Roles.Admin) || User.IsInRole(Roles.SuperAdmin);

        var callerMembership = await dbContext.StudyGroupMembers.AsNoTracking()
            .FirstOrDefaultAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == currentUserId && m.Status == StudyGroupMemberStatus.Active);

        bool isStudyGroupOwnerOrAdmin = callerMembership?.Role == StudyGroupRoles.Owner || callerMembership?.Role == StudyGroupRoles.Admin;

        if (!isSystemAdmin && !isStudyGroupOwnerOrAdmin)
        {
            return Forbid();
        }

        var pendingMember = await dbContext.StudyGroupMembers
            .FirstOrDefaultAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == targetUserId && m.Status == StudyGroupMemberStatus.PendingRequest);

        if (pendingMember == null)
        {
            return NotFound("Pending join request not found.");
        }

        pendingMember.Status = StudyGroupMemberStatus.Active;
        pendingMember.JoinedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync();

        return Ok(new { message = "Join request approved successfully." });
    }

    [Authorize]
    [HttpPost("{slug}/requests/{targetUserId:int}/reject")]
    public async Task<IActionResult> RejectJoinRequest(string slug, int targetUserId)
    {
        var studyGroup = await dbContext.StudyGroups.FirstOrDefaultAsync(c => c.Slug.ToLower() == slug.ToLower());
        if (studyGroup == null) return NotFound("Study group not found.");

        if (studyGroup.IsFrozen)
        {
            return StatusCode(StatusCodes.Status403Forbidden, "This study group is frozen. Requests cannot be rejected.");
        }

        int currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        bool isSystemAdmin = User.IsInRole(Roles.Admin) || User.IsInRole(Roles.SuperAdmin);

        var callerMembership = await dbContext.StudyGroupMembers.AsNoTracking()
            .FirstOrDefaultAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == currentUserId && m.Status == StudyGroupMemberStatus.Active);

        bool isStudyGroupOwnerOrAdmin = callerMembership?.Role == StudyGroupRoles.Owner || callerMembership?.Role == StudyGroupRoles.Admin;

        if (!isSystemAdmin && !isStudyGroupOwnerOrAdmin)
        {
            return Forbid();
        }

        var pendingMember = await dbContext.StudyGroupMembers
            .FirstOrDefaultAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == targetUserId && m.Status == StudyGroupMemberStatus.PendingRequest);

        if (pendingMember == null)
        {
            return NotFound("Pending join request not found.");
        }

        dbContext.StudyGroupMembers.Remove(pendingMember);
        await dbContext.SaveChangesAsync();

        return Ok(new { message = "Join request rejected." });
    }

    [Authorize]
    [HttpPost("{slug}/invite")]
    public async Task<IActionResult> InviteMember(string slug, [FromBody] InviteStudyGroupMemberRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest("Email is required.");
        }

        var studyGroup = await dbContext.StudyGroups.FirstOrDefaultAsync(c => c.Slug.ToLower() == slug.ToLower());
        if (studyGroup == null) return NotFound("Study group not found.");

        if (studyGroup.IsFrozen)
        {
            return StatusCode(StatusCodes.Status403Forbidden, "This study group is frozen. Invitations cannot be sent.");
        }

        int currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        bool isSystemAdmin = User.IsInRole(Roles.Admin) || User.IsInRole(Roles.SuperAdmin);

        var callerMembership = await dbContext.StudyGroupMembers.AsNoTracking()
            .FirstOrDefaultAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == currentUserId && m.Status == StudyGroupMemberStatus.Active);

        bool isStudyGroupOwnerOrAdmin = callerMembership?.Role == StudyGroupRoles.Owner || callerMembership?.Role == StudyGroupRoles.Admin;

        if (!isSystemAdmin && !isStudyGroupOwnerOrAdmin)
        {
            return Forbid();
        }

        string assignRole = string.IsNullOrWhiteSpace(request.Role) ? StudyGroupRoles.Member : request.Role.Trim();
        if (assignRole is not StudyGroupRoles.Owner and not StudyGroupRoles.Admin and not StudyGroupRoles.Contributor and not StudyGroupRoles.Member)
        {
            return BadRequest("Role must be 'Admin', 'Contributor', or 'Member'.");
        }

        if (assignRole == StudyGroupRoles.Owner)
        {
            return BadRequest("Owner role cannot be assigned directly. Use Transfer Ownership to transfer ownership.");
        }

        string reqEmail = request.Email.Trim().ToLowerInvariant();
        var targetUser = await dbContext.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == reqEmail);
        if (targetUser == null)
        {
            return BadRequest($"No registered user found with email '{request.Email.Trim()}'. The user must register on AnkiX before receiving an invitation.");
        }

        var existing = await dbContext.StudyGroupMembers
            .FirstOrDefaultAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == targetUser.Id);

        if (existing != null)
        {
            if (existing.Status == StudyGroupMemberStatus.Active)
            {
                return BadRequest($"User '{targetUser.Email}' is already an active member of this study group.");
            }
            if (existing.Status == StudyGroupMemberStatus.PendingInvite)
            {
                return BadRequest($"An invitation has already been sent to '{targetUser.Email}'.");
            }
            if (existing.Status == StudyGroupMemberStatus.PendingRequest)
            {
                existing.Role = assignRole;
                existing.Status = StudyGroupMemberStatus.Active;
                existing.InvitedByUserId = currentUserId;
                existing.JoinedAt = DateTime.UtcNow;
                await dbContext.SaveChangesAsync();
                return Ok(new { message = $"User '{targetUser.Email}' had a pending request and has now been approved and added as {assignRole}." });
            }
        }

        var newInvite = new StudyGroupMember
        {
            StudyGroupId = studyGroup.Id,
            UserId = targetUser.Id,
            Role = assignRole,
            Status = StudyGroupMemberStatus.PendingInvite,
            InvitedByUserId = currentUserId,
            JoinedAt = DateTime.UtcNow
        };

        dbContext.StudyGroupMembers.Add(newInvite);
        await dbContext.SaveChangesAsync();

        // Dispatch Email Notification
        string callerName = User.FindFirstValue(ClaimTypes.Name) ?? "A group admin";
        string appBaseUrl = Environment.GetEnvironmentVariable("APP_BASE_URL") ?? "http://localhost:5173";
        string groupUrl = $"{appBaseUrl}/study-groups";

        try
        {
            await emailService.SendStudyGroupInvitationAsync(targetUser.Email, studyGroup.Name, callerName, groupUrl);
        }
        catch
        {
            // Email failure logged by EmailService; invite is still recorded in DB
        }

        return Ok(new { message = $"Invitation sent successfully to '{targetUser.Email}'." });
    }

    [Authorize]
    [HttpGet("my-invitations")]
    public async Task<ActionResult<IEnumerable<StudyGroupInvitationResponse>>> GetMyInvitations()
    {
        int currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var invitations = await (from m in dbContext.StudyGroupMembers.AsNoTracking()
                                 join g in dbContext.StudyGroups.AsNoTracking() on m.StudyGroupId equals g.Id
                                 join inviter in dbContext.Users.AsNoTracking() on m.InvitedByUserId equals inviter.Id into inviterJoin
                                 from inviter in inviterJoin.DefaultIfEmpty()
                                 where m.UserId == currentUserId && m.Status == StudyGroupMemberStatus.PendingInvite
                                 orderby m.JoinedAt descending
                                 select new StudyGroupInvitationResponse
                                 {
                                     StudyGroupId = g.Id,
                                     StudyGroupName = g.Name,
                                     StudyGroupSlug = g.Slug,
                                     Description = g.Description,
                                     Role = m.Role,
                                     InviterDisplayName = inviter != null ? (inviter.DisplayName ?? inviter.Email) : "Study Group Admin",
                                     InvitedAt = m.JoinedAt
                                 }).ToListAsync();

        return Ok(invitations);
    }

    [Authorize]
    [HttpPost("{slug}/invitations/accept")]
    public async Task<IActionResult> AcceptInvitation(string slug)
    {
        var studyGroup = await dbContext.StudyGroups.FirstOrDefaultAsync(c => c.Slug.ToLower() == slug.ToLower());
        if (studyGroup == null) return NotFound("Study group not found.");

        if (studyGroup.IsFrozen)
        {
            return StatusCode(StatusCodes.Status403Forbidden, "This study group is frozen. Invitations cannot be accepted at this time.");
        }

        int currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var invite = await dbContext.StudyGroupMembers
            .FirstOrDefaultAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == currentUserId && m.Status == StudyGroupMemberStatus.PendingInvite);

        if (invite == null)
        {
            return NotFound("No pending invitation found for this study group.");
        }

        invite.Status = StudyGroupMemberStatus.Active;
        invite.JoinedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync();

        return Ok(new { message = $"You have accepted the invitation and joined '{studyGroup.Name}'." });
    }

    [Authorize]
    [HttpPost("{slug}/invitations/decline")]
    public async Task<IActionResult> DeclineInvitation(string slug)
    {
        var studyGroup = await dbContext.StudyGroups.FirstOrDefaultAsync(c => c.Slug.ToLower() == slug.ToLower());
        if (studyGroup == null) return NotFound("Study group not found.");

        int currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var invite = await dbContext.StudyGroupMembers
            .FirstOrDefaultAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == currentUserId && m.Status == StudyGroupMemberStatus.PendingInvite);

        if (invite == null)
        {
            return NotFound("No pending invitation found for this study group.");
        }

        dbContext.StudyGroupMembers.Remove(invite);
        await dbContext.SaveChangesAsync();

        return Ok(new { message = $"Invitation to join '{studyGroup.Name}' declined." });
    }

    [Authorize]
    [HttpPut("{slug}/privacy")]
    public async Task<ActionResult<StudyGroupResponse>> UpdateStudyGroupPrivacy(string slug, [FromBody] UpdateStudyGroupPrivacyRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Privacy))
        {
            return BadRequest("Privacy tier is required.");
        }

        string targetPrivacy = request.Privacy.Trim();
        if (targetPrivacy is not StudyGroupPrivacy.Public and not StudyGroupPrivacy.Private and not StudyGroupPrivacy.Locked)
        {
            return BadRequest("Privacy must be 'Public', 'Private', or 'Locked'.");
        }

        var studyGroup = await dbContext.StudyGroups.FirstOrDefaultAsync(c => c.Slug.ToLower() == slug.ToLower());
        if (studyGroup == null) return NotFound("Study group not found.");

        if (studyGroup.IsFrozen)
        {
            return StatusCode(StatusCodes.Status403Forbidden, "This study group is frozen. Privacy settings cannot be changed.");
        }

        int currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        bool isSystemAdmin = User.IsInRole(Roles.Admin) || User.IsInRole(Roles.SuperAdmin);

        var callerMembership = await dbContext.StudyGroupMembers.AsNoTracking()
            .FirstOrDefaultAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == currentUserId && m.Status == StudyGroupMemberStatus.Active);

        if (!isSystemAdmin && callerMembership?.Role != StudyGroupRoles.Owner)
        {
            return Forbid();
        }

        studyGroup.Privacy = targetPrivacy;
        await dbContext.SaveChangesAsync();

        return await GetStudyGroupBySlug(studyGroup.Slug);
    }

    [Authorize]
    [HttpDelete("{slug}/leave")]
    public async Task<IActionResult> LeaveStudyGroup(string slug)
    {
        var studyGroup = await dbContext.StudyGroups.FirstOrDefaultAsync(c => c.Slug.ToLower() == slug.ToLower());
        if (studyGroup == null) return NotFound("Study group not found.");

        if (studyGroup.IsFrozen)
        {
            return StatusCode(StatusCodes.Status403Forbidden, "This study group is frozen.");
        }

        int userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var membership = await dbContext.StudyGroupMembers
            .FirstOrDefaultAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == userId);

        if (membership == null)
        {
            return BadRequest("You are not a member of this study group.");
        }

        if (membership.Role == StudyGroupRoles.Owner && membership.Status == StudyGroupMemberStatus.Active)
        {
            int ownerCount = await dbContext.StudyGroupMembers.CountAsync(m => m.StudyGroupId == studyGroup.Id && m.Role == StudyGroupRoles.Owner && m.Status == StudyGroupMemberStatus.Active);
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

        if (studyGroup.Privacy == StudyGroupPrivacy.Locked && !isSystemAdmin)
        {
            if (!currentUserId.HasValue)
            {
                return NotFound("Study group not found.");
            }
            bool isMember = await dbContext.StudyGroupMembers.AnyAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == currentUserId.Value && m.Status == StudyGroupMemberStatus.Active);
            if (!isMember)
            {
                return NotFound("Study group not found.");
            }
        }

        bool canViewPii = isSystemAdmin || (currentUserId.HasValue && await dbContext.StudyGroupMembers.AnyAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == currentUserId.Value && m.Status == StudyGroupMemberStatus.Active));

        var members = await (from cm in dbContext.StudyGroupMembers.AsNoTracking()
                             join u in dbContext.Users.AsNoTracking() on cm.UserId equals u.Id
                             where cm.StudyGroupId == studyGroup.Id && cm.Status == StudyGroupMemberStatus.Active
                             select new StudyGroupMemberResponse
                             {
                                 UserId = u.Id,
                                 DisplayName = u.DisplayName,
                                 Email = canViewPii ? u.Email : string.Empty,
                                 Role = cm.Role,
                                 Status = cm.Status,
                                 JoinedAt = cm.JoinedAt,
                                 RequestedAt = cm.RequestedAt
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

        if (studyGroup.IsFrozen)
        {
            return StatusCode(StatusCodes.Status403Forbidden, "This study group is frozen. Members cannot be added.");
        }

        int currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var callerMembership = await dbContext.StudyGroupMembers
            .FirstOrDefaultAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == currentUserId && m.Status == StudyGroupMemberStatus.Active);

        bool isSystemAdmin = User.IsInRole(Roles.Admin) || User.IsInRole(Roles.SuperAdmin);
        bool isStudyGroupOwnerOrAdmin = callerMembership?.Role == StudyGroupRoles.Owner || callerMembership?.Role == StudyGroupRoles.Admin;

        if (!isSystemAdmin && !isStudyGroupOwnerOrAdmin)
        {
            return Forbid();
        }

        string assignRole = string.IsNullOrWhiteSpace(request.Role) ? StudyGroupRoles.Member : request.Role.Trim();
        if (assignRole is not StudyGroupRoles.Owner and not StudyGroupRoles.Admin and not StudyGroupRoles.Contributor and not StudyGroupRoles.Member)
        {
            return BadRequest("Role must be 'Admin', 'Contributor', or 'Member'.");
        }

        if (assignRole == StudyGroupRoles.Owner)
        {
            return BadRequest("Owner role cannot be assigned directly. Use Transfer Ownership to transfer ownership.");
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
            if (existingMembership.Status == StudyGroupMemberStatus.Active)
            {
                return BadRequest($"User '{targetUser.Email}' is already a member of this study group.");
            }
            existingMembership.Role = assignRole;
            existingMembership.Status = StudyGroupMemberStatus.Active;
            existingMembership.JoinedAt = DateTime.UtcNow;
            await dbContext.SaveChangesAsync();
            return Ok(new StudyGroupMemberResponse
            {
                UserId = targetUser.Id,
                DisplayName = targetUser.DisplayName,
                Email = targetUser.Email,
                Role = existingMembership.Role,
                Status = existingMembership.Status,
                JoinedAt = existingMembership.JoinedAt
            });
        }

        var newMember = new StudyGroupMember
        {
            StudyGroupId = studyGroup.Id,
            UserId = targetUser.Id,
            Role = assignRole,
            Status = StudyGroupMemberStatus.Active,
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
            Status = newMember.Status,
            JoinedAt = newMember.JoinedAt
        });
    }

    [Authorize]
    [HttpPut("{slug}/members/{targetUserId:int}/role")]
    public async Task<IActionResult> UpdateMemberRole(string slug, int targetUserId, [FromBody] UpdateMemberRoleRequest request)
    {
        var studyGroup = await dbContext.StudyGroups.FirstOrDefaultAsync(c => c.Slug.ToLower() == slug.ToLower());
        if (studyGroup == null) return NotFound("Study group not found.");

        if (studyGroup.IsFrozen)
        {
            return StatusCode(StatusCodes.Status403Forbidden, "This study group is frozen. Member roles cannot be modified.");
        }

        int currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var callerMembership = await dbContext.StudyGroupMembers
            .FirstOrDefaultAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == currentUserId && m.Status == StudyGroupMemberStatus.Active);

        bool isSystemAdmin = User.IsInRole(Roles.Admin) || User.IsInRole(Roles.SuperAdmin);
        bool isStudyGroupOwnerOrAdmin = callerMembership?.Role == StudyGroupRoles.Owner || callerMembership?.Role == StudyGroupRoles.Admin;

        if (!isSystemAdmin && !isStudyGroupOwnerOrAdmin)
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(request?.Role))
        {
            return BadRequest("Role is required.");
        }

        string newRole = request.Role.Trim();
        if (newRole is not StudyGroupRoles.Owner and not StudyGroupRoles.Admin and not StudyGroupRoles.Contributor and not StudyGroupRoles.Member)
        {
            return BadRequest("Role must be 'Admin', 'Contributor', or 'Member'.");
        }

        var targetMembership = await dbContext.StudyGroupMembers
            .FirstOrDefaultAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == targetUserId && m.Status == StudyGroupMemberStatus.Active);

        if (targetMembership == null)
        {
            return NotFound("Active member not found in study group.");
        }

        // Owners cannot change their own role or be demoted via role dropdown (must use transfer-ownership)
        if (targetMembership.Role == StudyGroupRoles.Owner && newRole != StudyGroupRoles.Owner)
        {
            return BadRequest("Study group owners cannot change their own role or be demoted directly. Use Transfer Ownership to transfer ownership.");
        }

        // Owner role cannot be assigned directly via this endpoint
        if (newRole == StudyGroupRoles.Owner)
        {
            return BadRequest("Owner role cannot be assigned directly. Use Transfer Ownership to transfer ownership.");
        }

        // Group Admins cannot modify another Admin's or Owner's role
        if (!isSystemAdmin && callerMembership?.Role != StudyGroupRoles.Owner && (targetMembership.Role == StudyGroupRoles.Admin || targetMembership.Role == StudyGroupRoles.Owner))
        {
            return BadRequest("Admins cannot change roles of other Admins or Owners.");
        }

        targetMembership.Role = newRole;
        await dbContext.SaveChangesAsync();

        return Ok(new { message = $"Role updated to '{newRole}' successfully." });
    }

    [Authorize]
    [HttpPost("{slug}/transfer-ownership")]
    public async Task<IActionResult> TransferOwnership(string slug, [FromBody] TransferOwnershipRequest request)
    {
        var studyGroup = await dbContext.StudyGroups.FirstOrDefaultAsync(c => c.Slug.ToLower() == slug.ToLower());
        if (studyGroup == null) return NotFound("Study group not found.");

        if (studyGroup.Slug.ToLower() == "sample")
        {
            return BadRequest("The sample study group ownership cannot be transferred.");
        }

        if (studyGroup.IsFrozen)
        {
            return StatusCode(StatusCodes.Status403Forbidden, "This study group is frozen. Ownership cannot be transferred.");
        }

        int currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        bool isSystemAdmin = User.IsInRole(Roles.Admin) || User.IsInRole(Roles.SuperAdmin);

        var callerMembership = await dbContext.StudyGroupMembers
            .FirstOrDefaultAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == currentUserId && m.Status == StudyGroupMemberStatus.Active);

        if (!isSystemAdmin && callerMembership?.Role != StudyGroupRoles.Owner)
        {
            return Forbid();
        }

        var targetMembership = await dbContext.StudyGroupMembers
            .FirstOrDefaultAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == request.NewOwnerUserId && m.Status == StudyGroupMemberStatus.Active);

        if (targetMembership == null)
        {
            return BadRequest("Target user must be an active member of this study group.");
        }

        if (targetMembership.Role == StudyGroupRoles.Owner)
        {
            return BadRequest("Target user is already the owner of this study group.");
        }

        // Demote existing owner(s) to Admin
        var existingOwners = await dbContext.StudyGroupMembers
            .Where(m => m.StudyGroupId == studyGroup.Id && m.Role == StudyGroupRoles.Owner)
            .ToListAsync();

        foreach (var owner in existingOwners)
        {
            owner.Role = StudyGroupRoles.Admin;
        }

        // Promote target member to Owner
        targetMembership.Role = StudyGroupRoles.Owner;
        studyGroup.CreatedByUserId = targetMembership.UserId;

        await dbContext.SaveChangesAsync();

        return Ok(new { message = "Ownership transferred successfully." });
    }

    [Authorize]
    [HttpPost("{slug}/freeze")]
    public async Task<IActionResult> FreezeStudyGroup(string slug)
    {
        var studyGroup = await dbContext.StudyGroups.FirstOrDefaultAsync(c => c.Slug.ToLower() == slug.ToLower());
        if (studyGroup == null) return NotFound("Study group not found.");

        if (studyGroup.Slug.ToLower() == "sample")
        {
            return BadRequest("The sample study group cannot be frozen.");
        }

        int currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        bool isSystemAdmin = User.IsInRole(Roles.Admin) || User.IsInRole(Roles.SuperAdmin);

        var callerMembership = await dbContext.StudyGroupMembers.AsNoTracking()
            .FirstOrDefaultAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == currentUserId && m.Status == StudyGroupMemberStatus.Active);

        if (!isSystemAdmin && callerMembership?.Role != StudyGroupRoles.Owner)
        {
            return Forbid();
        }

        if (studyGroup.IsFrozen)
        {
            return BadRequest("Study group is already frozen.");
        }

        studyGroup.IsFrozen = true;
        studyGroup.FrozenAt = DateTime.UtcNow;
        studyGroup.FrozenByUserId = currentUserId;

        await dbContext.SaveChangesAsync();

        return Ok(new { message = $"Study group '{studyGroup.Name}' has been frozen." });
    }

    [Authorize]
    [HttpPost("{slug}/unfreeze")]
    public async Task<IActionResult> UnfreezeStudyGroup(string slug)
    {
        var studyGroup = await dbContext.StudyGroups.FirstOrDefaultAsync(c => c.Slug.ToLower() == slug.ToLower());
        if (studyGroup == null) return NotFound("Study group not found.");

        int currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        bool isSystemAdmin = User.IsInRole(Roles.Admin) || User.IsInRole(Roles.SuperAdmin);

        var callerMembership = await dbContext.StudyGroupMembers.AsNoTracking()
            .FirstOrDefaultAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == currentUserId && m.Status == StudyGroupMemberStatus.Active);

        if (!isSystemAdmin && callerMembership?.Role != StudyGroupRoles.Owner)
        {
            return Forbid();
        }

        if (!studyGroup.IsFrozen)
        {
            return BadRequest("Study group is not frozen.");
        }

        studyGroup.IsFrozen = false;
        studyGroup.FrozenAt = null;
        studyGroup.FrozenByUserId = null;

        await dbContext.SaveChangesAsync();

        return Ok(new { message = $"Study group '{studyGroup.Name}' has been unfreezed." });
    }

    [Authorize]
    [HttpDelete("{slug}")]
    public async Task<IActionResult> DeleteStudyGroup(string slug)
    {
        var studyGroup = await dbContext.StudyGroups.FirstOrDefaultAsync(c => c.Slug.ToLower() == slug.ToLower());
        if (studyGroup == null) return NotFound("Study group not found.");

        if (studyGroup.Slug.ToLower() == "sample")
        {
            return BadRequest("The sample study group cannot be deleted.");
        }

        int currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        bool isSystemAdmin = User.IsInRole(Roles.Admin) || User.IsInRole(Roles.SuperAdmin);

        var callerMembership = await dbContext.StudyGroupMembers.AsNoTracking()
            .FirstOrDefaultAsync(m => m.StudyGroupId == studyGroup.Id && m.UserId == currentUserId && m.Status == StudyGroupMemberStatus.Active);

        if (!isSystemAdmin && callerMembership?.Role != StudyGroupRoles.Owner)
        {
            return Forbid();
        }

        using var transaction = await dbContext.Database.BeginTransactionAsync();
        try
        {
            int groupId = studyGroup.Id;

            // Decks & Cards
            var deckIds = await dbContext.Decks.Where(d => d.StudyGroupId == groupId).Select(d => d.Id).ToListAsync();
            var cardIds = await dbContext.Cards.Where(c => deckIds.Contains(c.DeckId)).Select(c => c.Id).ToListAsync();

            // Exercises
            var exerciseIds = await dbContext.Exercises.Where(e => e.StudyGroupId == groupId).Select(e => e.Id).ToListAsync();

            // Cascade wipe review records, followups, junction records
            if (cardIds.Count > 0)
            {
                var reviewRecords = dbContext.ReviewRecords.Where(r => cardIds.Contains(r.CardId));
                dbContext.ReviewRecords.RemoveRange(reviewRecords);

                var cardFollowups = dbContext.CardFollowups.Where(f => cardIds.Contains(f.CardId));
                dbContext.CardFollowups.RemoveRange(cardFollowups);
            }

            if (cardIds.Count > 0 || exerciseIds.Count > 0)
            {
                var cardExercises = dbContext.CardExercises.Where(ce => cardIds.Contains(ce.CardId) || exerciseIds.Contains(ce.ExerciseId));
                dbContext.CardExercises.RemoveRange(cardExercises);
            }

            if (exerciseIds.Count > 0)
            {
                var userExercises = dbContext.UserExercises.Where(ue => exerciseIds.Contains(ue.ExerciseId));
                dbContext.UserExercises.RemoveRange(userExercises);

                var exerciseReviewRecords = dbContext.ExerciseReviewRecords.Where(er => exerciseIds.Contains(er.ExerciseId));
                dbContext.ExerciseReviewRecords.RemoveRange(exerciseReviewRecords);
            }

            if (cardIds.Count > 0)
            {
                var cards = dbContext.Cards.Where(c => deckIds.Contains(c.DeckId));
                dbContext.Cards.RemoveRange(cards);
            }

            if (deckIds.Count > 0)
            {
                var decks = dbContext.Decks.Where(d => d.StudyGroupId == groupId);
                dbContext.Decks.RemoveRange(decks);
            }

            if (exerciseIds.Count > 0)
            {
                var exercises = dbContext.Exercises.Where(e => e.StudyGroupId == groupId);
                dbContext.Exercises.RemoveRange(exercises);
            }

            var members = dbContext.StudyGroupMembers.Where(m => m.StudyGroupId == groupId);
            dbContext.StudyGroupMembers.RemoveRange(members);

            dbContext.StudyGroups.Remove(studyGroup);

            await dbContext.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new { message = $"Study group '{studyGroup.Name}' and all its content have been permanently erased." });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            return StatusCode(StatusCodes.Status500InternalServerError, $"Failed to delete study group: {ex.Message}");
        }
    }

    private int? GetCurrentUserId()
    {
        string? val = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(val, out int userId) ? userId : null;
    }
}

