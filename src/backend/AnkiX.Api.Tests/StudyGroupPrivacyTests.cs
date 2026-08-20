using System.Security.Claims;
using AnkiX.Api.Contracts.Content;
using AnkiX.Api.Controllers;
using AnkiX.Api.Data;
using AnkiX.Api.Models;
using AnkiX.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AnkiX.Api.Tests;

public class StudyGroupPrivacyTests
{
    private static ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    private static StudyGroupsController CreateStudyGroupsController(ApplicationDbContext db, int? userId = 1, string role = "User", string email = "user@ankix.local")
    {
        var controller = new StudyGroupsController(db);
        var httpContext = new DefaultHttpContext();

        if (userId.HasValue)
        {
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, userId.Value.ToString()),
                new(ClaimTypes.Role, role),
                new(ClaimTypes.Name, email)
            };
            var identity = new ClaimsIdentity(claims, "TestAuth");
            httpContext.User = new ClaimsPrincipal(identity);
        }

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = httpContext
        };

        return controller;
    }

    private static DecksController CreateDecksController(ApplicationDbContext db, int? userId = 1, string role = "User")
    {
        var controller = new DecksController(db);
        var httpContext = new DefaultHttpContext();

        if (userId.HasValue)
        {
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, userId.Value.ToString()),
                new(ClaimTypes.Role, role)
            };
            var identity = new ClaimsIdentity(claims, "TestAuth");
            httpContext.User = new ClaimsPrincipal(identity);
        }

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = httpContext
        };

        return controller;
    }

    [Fact]
    public async Task GetStudyGroups_ReturnsPublicAndPrivateToAll_HidesLockedFromNonMembers()
    {
        using var db = CreateInMemoryDbContext();

        db.Users.Add(new User { Id = 1, Email = "owner@ankix.local", DisplayName = "Owner" });
        db.Users.Add(new User { Id = 2, Email = "member@ankix.local", DisplayName = "Member" });
        db.Users.Add(new User { Id = 3, Email = "stranger@ankix.local", DisplayName = "Stranger" });

        var publicGroup = new StudyGroup { Id = 10, Name = "Public Group", Slug = "public-group", Privacy = StudyGroupPrivacy.Public, CreatedByUserId = 1 };
        var privateGroup = new StudyGroup { Id = 20, Name = "Private Group", Slug = "private-group", Privacy = StudyGroupPrivacy.Private, CreatedByUserId = 1 };
        var lockedGroup = new StudyGroup { Id = 30, Name = "Locked Group", Slug = "locked-group", Privacy = StudyGroupPrivacy.Locked, CreatedByUserId = 1 };

        db.StudyGroups.AddRange(publicGroup, privateGroup, lockedGroup);

        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 30, UserId = 2, Role = StudyGroupRoles.Member, Status = StudyGroupMemberStatus.Active });

        await db.SaveChangesAsync();

        // Caller 3 (Stranger) - not member of locked group
        var strangerController = CreateStudyGroupsController(db, userId: 3);
        var strangerResult = await strangerController.GetStudyGroups();
        var strangerOk = Assert.IsType<OkObjectResult>(strangerResult.Result);
        var strangerGroups = Assert.IsAssignableFrom<IEnumerable<StudyGroupResponse>>(strangerOk.Value).ToList();

        Assert.Contains(strangerGroups, g => g.Slug == "public-group");
        Assert.Contains(strangerGroups, g => g.Slug == "private-group");
        Assert.DoesNotContain(strangerGroups, g => g.Slug == "locked-group");

        // Caller 2 (Member of locked group)
        var memberController = CreateStudyGroupsController(db, userId: 2);
        var memberResult = await memberController.GetStudyGroups();
        var memberOk = Assert.IsType<OkObjectResult>(memberResult.Result);
        var memberGroups = Assert.IsAssignableFrom<IEnumerable<StudyGroupResponse>>(memberOk.Value).ToList();

        Assert.Contains(memberGroups, g => g.Slug == "locked-group");
    }

    [Fact]
    public async Task GetStudyGroupBySlug_LockedGroup_ReturnsNotFoundForNonMember()
    {
        using var db = CreateInMemoryDbContext();
        db.StudyGroups.Add(new StudyGroup { Id = 1, Name = "Locked", Slug = "locked-slug", Privacy = StudyGroupPrivacy.Locked, CreatedByUserId = 1 });
        await db.SaveChangesAsync();

        var controller = CreateStudyGroupsController(db, userId: 99);
        var result = await controller.GetStudyGroupBySlug("locked-slug");

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    [Fact]
    public async Task JoinStudyGroup_PublicGroup_JoinsInstantly()
    {
        using var db = CreateInMemoryDbContext();
        db.Users.Add(new User { Id = 5, Email = "joiner@ankix.local", DisplayName = "Joiner" });
        db.StudyGroups.Add(new StudyGroup { Id = 1, Name = "Open Group", Slug = "open-group", Privacy = StudyGroupPrivacy.Public, CreatedByUserId = 1 });
        await db.SaveChangesAsync();

        var controller = CreateStudyGroupsController(db, userId: 5);
        var result = await controller.JoinStudyGroup("open-group");

        Assert.IsType<OkObjectResult>(result);

        var membership = await db.StudyGroupMembers.FirstOrDefaultAsync(m => m.StudyGroupId == 1 && m.UserId == 5);
        Assert.NotNull(membership);
        Assert.Equal(StudyGroupMemberStatus.Active, membership.Status);
    }

    [Fact]
    public async Task JoinStudyGroup_PrivateGroup_ReturnsBadRequest()
    {
        using var db = CreateInMemoryDbContext();
        db.Users.Add(new User { Id = 5, Email = "joiner@ankix.local", DisplayName = "Joiner" });
        db.StudyGroups.Add(new StudyGroup { Id = 1, Name = "Private Group", Slug = "private-group", Privacy = StudyGroupPrivacy.Private, CreatedByUserId = 1 });
        await db.SaveChangesAsync();

        var controller = CreateStudyGroupsController(db, userId: 5);
        var result = await controller.JoinStudyGroup("private-group");

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("private", badRequest.Value?.ToString() ?? "", StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task RequestAccess_PrivateGroup_CreatesPendingRequest()
    {
        using var db = CreateInMemoryDbContext();
        db.Users.Add(new User { Id = 5, Email = "requester@ankix.local", DisplayName = "Requester" });
        db.StudyGroups.Add(new StudyGroup { Id = 1, Name = "Private Group", Slug = "private-group", Privacy = StudyGroupPrivacy.Private, CreatedByUserId = 1 });
        await db.SaveChangesAsync();

        var controller = CreateStudyGroupsController(db, userId: 5);
        var result = await controller.RequestAccess("private-group");

        Assert.IsType<OkObjectResult>(result);

        var membership = await db.StudyGroupMembers.FirstOrDefaultAsync(m => m.StudyGroupId == 1 && m.UserId == 5);
        Assert.NotNull(membership);
        Assert.Equal(StudyGroupMemberStatus.PendingRequest, membership.Status);
        Assert.NotNull(membership.RequestedAt);
    }

    [Fact]
    public async Task ApproveJoinRequest_ByOwner_SetsStatusActive()
    {
        using var db = CreateInMemoryDbContext();
        db.Users.Add(new User { Id = 1, Email = "owner@ankix.local", DisplayName = "Owner" });
        db.Users.Add(new User { Id = 5, Email = "requester@ankix.local", DisplayName = "Requester" });

        db.StudyGroups.Add(new StudyGroup { Id = 1, Name = "Private Group", Slug = "private-group", Privacy = StudyGroupPrivacy.Private, CreatedByUserId = 1 });
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 1, UserId = 1, Role = StudyGroupRoles.Owner, Status = StudyGroupMemberStatus.Active });
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 1, UserId = 5, Role = StudyGroupRoles.Member, Status = StudyGroupMemberStatus.PendingRequest, RequestedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var ownerController = CreateStudyGroupsController(db, userId: 1);
        var approveResult = await ownerController.ApproveJoinRequest("private-group", targetUserId: 5);

        Assert.IsType<OkObjectResult>(approveResult);

        var updatedMember = await db.StudyGroupMembers.FirstOrDefaultAsync(m => m.StudyGroupId == 1 && m.UserId == 5);
        Assert.NotNull(updatedMember);
        Assert.Equal(StudyGroupMemberStatus.Active, updatedMember.Status);
    }

    [Fact]
    public async Task RejectJoinRequest_ByOwner_RemovesRequest()
    {
        using var db = CreateInMemoryDbContext();
        db.Users.Add(new User { Id = 1, Email = "owner@ankix.local", DisplayName = "Owner" });
        db.Users.Add(new User { Id = 5, Email = "requester@ankix.local", DisplayName = "Requester" });

        db.StudyGroups.Add(new StudyGroup { Id = 1, Name = "Private Group", Slug = "private-group", Privacy = StudyGroupPrivacy.Private, CreatedByUserId = 1 });
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 1, UserId = 1, Role = StudyGroupRoles.Owner, Status = StudyGroupMemberStatus.Active });
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 1, UserId = 5, Role = StudyGroupRoles.Member, Status = StudyGroupMemberStatus.PendingRequest });
        await db.SaveChangesAsync();

        var ownerController = CreateStudyGroupsController(db, userId: 1);
        var rejectResult = await ownerController.RejectJoinRequest("private-group", targetUserId: 5);

        Assert.IsType<OkObjectResult>(rejectResult);

        var memberExists = await db.StudyGroupMembers.AnyAsync(m => m.StudyGroupId == 1 && m.UserId == 5);
        Assert.False(memberExists);
    }

    [Fact]
    public async Task InviteMember_LockedGroup_CreatesPendingInvite()
    {
        using var db = CreateInMemoryDbContext();
        db.Users.Add(new User { Id = 1, Email = "owner@ankix.local", DisplayName = "Owner" });
        db.Users.Add(new User { Id = 8, Email = "invitee@ankix.local", DisplayName = "Invitee" });

        db.StudyGroups.Add(new StudyGroup { Id = 1, Name = "Locked Group", Slug = "locked-group", Privacy = StudyGroupPrivacy.Locked, CreatedByUserId = 1 });
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 1, UserId = 1, Role = StudyGroupRoles.Owner, Status = StudyGroupMemberStatus.Active });
        await db.SaveChangesAsync();

        var ownerController = CreateStudyGroupsController(db, userId: 1);
        var inviteResult = await ownerController.InviteMember("locked-group", new InviteStudyGroupMemberRequest
        {
            Email = "invitee@ankix.local",
            Role = StudyGroupRoles.Member
        });

        Assert.IsType<OkObjectResult>(inviteResult);

        var inviteRecord = await db.StudyGroupMembers.FirstOrDefaultAsync(m => m.StudyGroupId == 1 && m.UserId == 8);
        Assert.NotNull(inviteRecord);
        Assert.Equal(StudyGroupMemberStatus.PendingInvite, inviteRecord.Status);
        Assert.Equal(1, inviteRecord.InvitedByUserId);
    }

    [Fact]
    public async Task AcceptInvitation_Invitee_SetsStatusActive()
    {
        using var db = CreateInMemoryDbContext();
        db.Users.Add(new User { Id = 1, Email = "owner@ankix.local", DisplayName = "Owner" });
        db.Users.Add(new User { Id = 8, Email = "invitee@ankix.local", DisplayName = "Invitee" });

        db.StudyGroups.Add(new StudyGroup { Id = 1, Name = "Locked Group", Slug = "locked-group", Privacy = StudyGroupPrivacy.Locked, CreatedByUserId = 1 });
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 1, UserId = 8, Role = StudyGroupRoles.Member, Status = StudyGroupMemberStatus.PendingInvite, InvitedByUserId = 1 });
        await db.SaveChangesAsync();

        var inviteeController = CreateStudyGroupsController(db, userId: 8);
        var acceptResult = await inviteeController.AcceptInvitation("locked-group");

        Assert.IsType<OkObjectResult>(acceptResult);

        var memberRecord = await db.StudyGroupMembers.FirstOrDefaultAsync(m => m.StudyGroupId == 1 && m.UserId == 8);
        Assert.NotNull(memberRecord);
        Assert.Equal(StudyGroupMemberStatus.Active, memberRecord.Status);
    }

    [Fact]
    public async Task DeclineInvitation_Invitee_RemovesInvite()
    {
        using var db = CreateInMemoryDbContext();
        db.Users.Add(new User { Id = 1, Email = "owner@ankix.local", DisplayName = "Owner" });
        db.Users.Add(new User { Id = 8, Email = "invitee@ankix.local", DisplayName = "Invitee" });

        db.StudyGroups.Add(new StudyGroup { Id = 1, Name = "Locked Group", Slug = "locked-group", Privacy = StudyGroupPrivacy.Locked, CreatedByUserId = 1 });
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 1, UserId = 8, Role = StudyGroupRoles.Member, Status = StudyGroupMemberStatus.PendingInvite, InvitedByUserId = 1 });
        await db.SaveChangesAsync();

        var inviteeController = CreateStudyGroupsController(db, userId: 8);
        var declineResult = await inviteeController.DeclineInvitation("locked-group");

        Assert.IsType<OkObjectResult>(declineResult);

        var memberExists = await db.StudyGroupMembers.AnyAsync(m => m.StudyGroupId == 1 && m.UserId == 8);
        Assert.False(memberExists);
    }

    [Fact]
    public async Task UpdateStudyGroupPrivacy_ByOwner_UpdatesPrivacy()
    {
        using var db = CreateInMemoryDbContext();
        db.Users.Add(new User { Id = 1, Email = "owner@ankix.local", DisplayName = "Owner" });
        db.StudyGroups.Add(new StudyGroup { Id = 1, Name = "Group", Slug = "group-slug", Privacy = StudyGroupPrivacy.Public, CreatedByUserId = 1 });
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 1, UserId = 1, Role = StudyGroupRoles.Owner, Status = StudyGroupMemberStatus.Active });
        await db.SaveChangesAsync();

        var ownerController = CreateStudyGroupsController(db, userId: 1);
        var updateResult = await ownerController.UpdateStudyGroupPrivacy("group-slug", new UpdateStudyGroupPrivacyRequest
        {
            Privacy = StudyGroupPrivacy.Locked
        });

        var okResult = Assert.IsType<OkObjectResult>(updateResult.Result);
        var groupResponse = Assert.IsType<StudyGroupResponse>(okResult.Value);
        Assert.Equal(StudyGroupPrivacy.Locked, groupResponse.Privacy);
    }

    [Fact]
    public async Task DeckAccess_PrivateAndLocked_IsolatedFromNonActiveMembers()
    {
        using var db = CreateInMemoryDbContext();
        db.Users.Add(new User { Id = 1, Email = "owner@ankix.local" });
        db.Users.Add(new User { Id = 2, Email = "pending_requester@ankix.local" });

        var privateGroup = new StudyGroup { Id = 10, Name = "Private", Slug = "private-sg", Privacy = StudyGroupPrivacy.Private, CreatedByUserId = 1 };
        db.StudyGroups.Add(privateGroup);

        var deck = new Deck { Id = 100, Title = "Secret Deck", StudyGroupId = 10, CreatedByUserId = 1 };
        db.Decks.Add(deck);

        db.Cards.Add(new Card { Id = 500, DeckId = 100, Prompt = "Secret Q", Answer = "Secret A" });

        // User 2 has pending request (NOT active member)
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 10, UserId = 2, Role = StudyGroupRoles.Member, Status = StudyGroupMemberStatus.PendingRequest });
        await db.SaveChangesAsync();

        var decksController = CreateDecksController(db, userId: 2);
        var previewResult = await decksController.GetDeckPreview(100);

        Assert.IsType<NotFoundObjectResult>(previewResult.Result);

        var cardsResult = await decksController.GetCardsByDeck(100);
        Assert.IsType<NotFoundObjectResult>(cardsResult.Result);
    }
}
