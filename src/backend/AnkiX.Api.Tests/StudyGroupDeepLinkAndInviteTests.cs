using System.Security.Claims;
using AnkiX.Api.Contracts.Content;
using AnkiX.Api.Controllers;
using AnkiX.Api.Data;
using AnkiX.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AnkiX.Api.Tests;

public class StudyGroupDeepLinkAndInviteTests
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
    public async Task GetStudyGroupBySlug_ExistingSlug_ReturnsStudyGroupWithCallerRoleAndStatus()
    {
        using var db = CreateInMemoryDbContext();
        db.Users.Add(new User { Id = 1, Email = "owner@ankix.local", DisplayName = "Owner" });
        db.Users.Add(new User { Id = 2, Email = "member@ankix.local", DisplayName = "Member" });

        var group = new StudyGroup
        {
            Id = 10,
            Name = "Data Structures Cohort",
            Slug = "data-structures-cohort",
            Description = "Learn algorithms together",
            Privacy = StudyGroupPrivacy.Public,
            CreatedByUserId = 1
        };
        db.StudyGroups.Add(group);
        db.StudyGroupMembers.Add(new StudyGroupMember
        {
            StudyGroupId = 10,
            UserId = 2,
            Role = StudyGroupRoles.Member,
            Status = StudyGroupMemberStatus.Active
        });
        await db.SaveChangesAsync();

        var controller = CreateStudyGroupsController(db, userId: 2);
        var result = await controller.GetStudyGroupBySlug("data-structures-cohort");

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<StudyGroupResponse>(okResult.Value);
        Assert.Equal("data-structures-cohort", response.Slug);
        Assert.Equal("Data Structures Cohort", response.Name);
        Assert.Equal(StudyGroupRoles.Member, response.UserRole);
        Assert.Equal(StudyGroupMemberStatus.Active, response.UserMembershipStatus);
    }

    [Fact]
    public async Task GetStudyGroupBySlug_NonExistentSlug_Returns404NotFound()
    {
        using var db = CreateInMemoryDbContext();
        var controller = CreateStudyGroupsController(db, userId: 1);

        var result = await controller.GetStudyGroupBySlug("non-existent-cohort");
        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    [Fact]
    public async Task GetStudyGroupBySlug_LockedGroup_NonMember_Returns404NotFound()
    {
        using var db = CreateInMemoryDbContext();
        db.Users.Add(new User { Id = 1, Email = "owner@ankix.local", DisplayName = "Owner" });
        db.Users.Add(new User { Id = 2, Email = "stranger@ankix.local", DisplayName = "Stranger" });

        var lockedGroup = new StudyGroup
        {
            Id = 20,
            Name = "Top Secret Group",
            Slug = "top-secret-group",
            Privacy = StudyGroupPrivacy.Locked,
            CreatedByUserId = 1
        };
        db.StudyGroups.Add(lockedGroup);
        await db.SaveChangesAsync();

        var controller = CreateStudyGroupsController(db, userId: 2);
        var result = await controller.GetStudyGroupBySlug("top-secret-group");

        // Locked groups are hidden from non-members
        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    [Fact]
    public async Task GetInvitePreview_ValidInviteCode_ReturnsPublicMetadataAndRole()
    {
        using var db = CreateInMemoryDbContext();
        db.Users.Add(new User { Id = 1, Email = "owner@ankix.local", DisplayName = "Owner" });
        db.Users.Add(new User { Id = 2, Email = "member@ankix.local", DisplayName = "Member" });

        var group = new StudyGroup
        {
            Id = 30,
            Name = "Rustacean Collective",
            Slug = "rustacean-collective",
            Description = "Rust study group",
            Privacy = StudyGroupPrivacy.Private,
            InviteCode = "rust-invite-123",
            InviteRole = StudyGroupRoles.Contributor,
            CreatedByUserId = 1
        };
        db.StudyGroups.Add(group);
        db.StudyGroupMembers.Add(new StudyGroupMember
        {
            StudyGroupId = 30,
            UserId = 1,
            Role = StudyGroupRoles.Owner,
            Status = StudyGroupMemberStatus.Active
        });
        await db.SaveChangesAsync();

        // Guest visitor
        var guestController = CreateStudyGroupsController(db, userId: null);
        var result = await guestController.GetInvitePreview("rust-invite-123");

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<StudyGroupInviteResponse>(okResult.Value);
        Assert.Equal("Rustacean Collective", response.Name);
        Assert.Equal("rustacean-collective", response.Slug);
        Assert.Equal(StudyGroupRoles.Contributor, response.Role);
        Assert.Equal(1, response.MemberCount);
        Assert.False(response.IsAlreadyMember);
    }

    [Fact]
    public async Task GetInvitePreview_InvalidInviteCode_Returns404NotFound()
    {
        using var db = CreateInMemoryDbContext();
        var controller = CreateStudyGroupsController(db, userId: null);

        var result = await controller.GetInvitePreview("invalid-code-xyz");
        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    [Fact]
    public async Task GetInvitePreview_FrozenGroup_ReturnsBadRequest()
    {
        using var db = CreateInMemoryDbContext();
        var group = new StudyGroup
        {
            Id = 40,
            Name = "Frozen Group",
            Slug = "frozen-group",
            Privacy = StudyGroupPrivacy.Private,
            InviteCode = "frozen-token",
            IsFrozen = true,
            CreatedByUserId = 1
        };
        db.StudyGroups.Add(group);
        await db.SaveChangesAsync();

        var controller = CreateStudyGroupsController(db, userId: null);
        var result = await controller.GetInvitePreview("frozen-token");

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.NotNull(badRequest.Value);
    }

    [Fact]
    public async Task GenerateOrGetInviteLink_AdminCaller_ReturnsInviteCodeAndUrl()
    {
        using var db = CreateInMemoryDbContext();
        db.Users.Add(new User { Id = 1, Email = "owner@ankix.local", DisplayName = "Owner" });

        var group = new StudyGroup
        {
            Id = 50,
            Name = "Systems Programming",
            Slug = "systems-programming",
            Privacy = StudyGroupPrivacy.Private,
            CreatedByUserId = 1
        };
        db.StudyGroups.Add(group);
        db.StudyGroupMembers.Add(new StudyGroupMember
        {
            StudyGroupId = 50,
            UserId = 1,
            Role = StudyGroupRoles.Owner,
            Status = StudyGroupMemberStatus.Active
        });
        await db.SaveChangesAsync();

        var controller = CreateStudyGroupsController(db, userId: 1);
        var result = await controller.GetOrCreateInviteLink("systems-programming", new UpdateStudyGroupInviteRoleRequest { Role = StudyGroupRoles.Contributor });

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<StudyGroupInviteLinkResponse>(okResult.Value);
        Assert.False(string.IsNullOrWhiteSpace(response.InviteCode));
        Assert.Equal(StudyGroupRoles.Contributor, response.InviteRole);
        Assert.Equal($"/join/{response.InviteCode}", response.InviteUrl);
    }

    [Fact]
    public async Task GenerateOrGetInviteLink_InvalidRole_ReturnsBadRequest()
    {
        using var db = CreateInMemoryDbContext();
        db.Users.Add(new User { Id = 1, Email = "owner@ankix.local", DisplayName = "Owner" });

        var group = new StudyGroup
        {
            Id = 55,
            Name = "Systems Programming 2",
            Slug = "systems-programming-2",
            Privacy = StudyGroupPrivacy.Private,
            CreatedByUserId = 1
        };
        db.StudyGroups.Add(group);
        db.StudyGroupMembers.Add(new StudyGroupMember
        {
            StudyGroupId = 55,
            UserId = 1,
            Role = StudyGroupRoles.Owner,
            Status = StudyGroupMemberStatus.Active
        });
        await db.SaveChangesAsync();

        var controller = CreateStudyGroupsController(db, userId: 1);
        var result = await controller.GetOrCreateInviteLink("systems-programming-2", new UpdateStudyGroupInviteRoleRequest { Role = "InvalidSuperRole" });

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.NotNull(badRequest.Value);
    }

    [Fact]
    public async Task GenerateOrGetInviteLink_NonAdminCaller_ReturnsForbid()
    {
        using var db = CreateInMemoryDbContext();
        db.Users.Add(new User { Id = 1, Email = "owner@ankix.local", DisplayName = "Owner" });
        db.Users.Add(new User { Id = 2, Email = "member@ankix.local", DisplayName = "Member" });

        var group = new StudyGroup
        {
            Id = 60,
            Name = "Distributed Systems",
            Slug = "dist-sys",
            Privacy = StudyGroupPrivacy.Private,
            CreatedByUserId = 1
        };
        db.StudyGroups.Add(group);
        db.StudyGroupMembers.Add(new StudyGroupMember
        {
            StudyGroupId = 60,
            UserId = 2,
            Role = StudyGroupRoles.Member,
            Status = StudyGroupMemberStatus.Active
        });
        await db.SaveChangesAsync();

        var controller = CreateStudyGroupsController(db, userId: 2);
        var result = await controller.GetOrCreateInviteLink("dist-sys", null);

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task ResetInviteLink_AdminCaller_GeneratesNewInviteCode()
    {
        using var db = CreateInMemoryDbContext();
        db.Users.Add(new User { Id = 1, Email = "owner@ankix.local", DisplayName = "Owner" });

        var group = new StudyGroup
        {
            Id = 70,
            Name = "AI Engineering",
            Slug = "ai-engineering",
            Privacy = StudyGroupPrivacy.Private,
            InviteCode = "initial-invite-token",
            InviteRole = StudyGroupRoles.Member,
            CreatedByUserId = 1
        };
        db.StudyGroups.Add(group);
        db.StudyGroupMembers.Add(new StudyGroupMember
        {
            StudyGroupId = 70,
            UserId = 1,
            Role = StudyGroupRoles.Owner,
            Status = StudyGroupMemberStatus.Active
        });
        await db.SaveChangesAsync();

        var controller = CreateStudyGroupsController(db, userId: 1);
        var result = await controller.ResetInviteLink("ai-engineering");

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<StudyGroupInviteLinkResponse>(okResult.Value);
        Assert.NotEqual("initial-invite-token", response.InviteCode);
        Assert.False(string.IsNullOrWhiteSpace(response.InviteCode));

        // Old invite code lookup should now return 404
        var oldResult = await controller.GetInvitePreview("initial-invite-token");
        Assert.IsType<NotFoundObjectResult>(oldResult.Result);

        // New invite code lookup succeeds
        var newResult = await controller.GetInvitePreview(response.InviteCode);
        Assert.IsType<OkObjectResult>(newResult.Result);
    }

    [Fact]
    public async Task AcceptInvite_AuthenticatedUser_JoinsWithConfiguredRole()
    {
        using var db = CreateInMemoryDbContext();
        db.Users.Add(new User { Id = 1, Email = "owner@ankix.local", DisplayName = "Owner" });
        db.Users.Add(new User { Id = 2, Email = "newbie@ankix.local", DisplayName = "Newbie" });

        var group = new StudyGroup
        {
            Id = 80,
            Name = "Golang Concurrency",
            Slug = "golang-concurrency",
            Privacy = StudyGroupPrivacy.Private,
            InviteCode = "golang-join-now",
            InviteRole = StudyGroupRoles.Contributor,
            CreatedByUserId = 1
        };
        db.StudyGroups.Add(group);
        await db.SaveChangesAsync();

        var controller = CreateStudyGroupsController(db, userId: 2);
        var result = await controller.AcceptInvite("golang-join-now");

        Assert.IsType<OkObjectResult>(result);

        var membership = await db.StudyGroupMembers.FirstOrDefaultAsync(m => m.StudyGroupId == 80 && m.UserId == 2);
        Assert.NotNull(membership);
        Assert.Equal(StudyGroupRoles.Contributor, membership.Role);
        Assert.Equal(StudyGroupMemberStatus.Active, membership.Status);
    }

    [Fact]
    public async Task AcceptInvite_AlreadyActiveMember_ReturnsSuccessWithoutDuplication()
    {
        using var db = CreateInMemoryDbContext();
        db.Users.Add(new User { Id = 1, Email = "member@ankix.local", DisplayName = "Member" });

        var group = new StudyGroup
        {
            Id = 85,
            Name = "Existing Group",
            Slug = "existing-group",
            InviteCode = "existing-invite",
            InviteRole = StudyGroupRoles.Member,
            CreatedByUserId = 2
        };
        db.StudyGroups.Add(group);
        db.StudyGroupMembers.Add(new StudyGroupMember
        {
            StudyGroupId = 85,
            UserId = 1,
            Role = StudyGroupRoles.Member,
            Status = StudyGroupMemberStatus.Active
        });
        await db.SaveChangesAsync();

        var controller = CreateStudyGroupsController(db, userId: 1);
        var result = await controller.AcceptInvite("existing-invite");

        Assert.IsType<OkObjectResult>(result);
        var count = await db.StudyGroupMembers.CountAsync(m => m.StudyGroupId == 85 && m.UserId == 1);
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task AcceptInvite_PendingRequest_UpgradesToActiveMember()
    {
        using var db = CreateInMemoryDbContext();
        db.Users.Add(new User { Id = 1, Email = "requester@ankix.local", DisplayName = "Requester" });

        var group = new StudyGroup
        {
            Id = 88,
            Name = "Pending Group",
            Slug = "pending-group",
            InviteCode = "upgrade-token",
            InviteRole = StudyGroupRoles.Contributor,
            CreatedByUserId = 2
        };
        db.StudyGroups.Add(group);
        db.StudyGroupMembers.Add(new StudyGroupMember
        {
            StudyGroupId = 88,
            UserId = 1,
            Role = StudyGroupRoles.Member,
            Status = StudyGroupMemberStatus.PendingRequest,
            RequestedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var controller = CreateStudyGroupsController(db, userId: 1);
        var result = await controller.AcceptInvite("upgrade-token");

        Assert.IsType<OkObjectResult>(result);
        var membership = await db.StudyGroupMembers.FirstOrDefaultAsync(m => m.StudyGroupId == 88 && m.UserId == 1);
        Assert.NotNull(membership);
        Assert.Equal(StudyGroupMemberStatus.Active, membership.Status);
        Assert.Equal(StudyGroupRoles.Contributor, membership.Role);
    }

    [Fact]
    public async Task GetDeckById_PublicGroupDeck_ReturnsDeckWithParentGroupMetadataAndCanAccessTrue()
    {
        using var db = CreateInMemoryDbContext();
        var group = new StudyGroup
        {
            Id = 90,
            Name = "Public Web Dev",
            Slug = "public-web-dev",
            Privacy = StudyGroupPrivacy.Public,
            CreatedByUserId = 1
        };
        var deck = new Deck
        {
            Id = 101,
            Title = "JavaScript Fundamentals",
            Description = "JS basics",
            StudyGroupId = 90,
            CreatedByUserId = 1
        };
        db.StudyGroups.Add(group);
        db.Decks.Add(deck);
        db.Cards.Add(new Card { Id = 1, DeckId = 101, Prompt = "Q1", Answer = "A1" });
        await db.SaveChangesAsync();

        // Anonymous guest caller
        var controller = CreateDecksController(db, userId: null);
        var result = await controller.GetDeckById(101);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<DeckResponse>(okResult.Value);
        Assert.Equal(101, response.Id);
        Assert.Equal("JavaScript Fundamentals", response.Title);
        Assert.Equal("public-web-dev", response.StudyGroupSlug);
        Assert.Equal("Public Web Dev", response.StudyGroupName);
        Assert.False(response.IsPrivateDeck);
        Assert.True(response.CanAccess);
    }

    [Fact]
    public async Task GetDeckById_PrivateGroupDeck_NonMember_ReturnsParentGroupMetadataAndCanAccessFalse()
    {
        using var db = CreateInMemoryDbContext();
        db.Users.Add(new User { Id = 2, Email = "outsider@ankix.local", DisplayName = "Outsider" });

        var group = new StudyGroup
        {
            Id = 95,
            Name = "Secret Algo Guild",
            Slug = "secret-algo-guild",
            Description = "Private algorithmic practice",
            Privacy = StudyGroupPrivacy.Private,
            CreatedByUserId = 1
        };
        var deck = new Deck
        {
            Id = 102,
            Title = "Dynamic Programming Mastery",
            Description = "Hard DP problems",
            StudyGroupId = 95,
            CreatedByUserId = 1
        };
        db.StudyGroups.Add(group);
        db.Decks.Add(deck);
        await db.SaveChangesAsync();

        // Non-member authenticated user
        var controller = CreateDecksController(db, userId: 2);
        var result = await controller.GetDeckById(102);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<DeckResponse>(okResult.Value);
        Assert.Equal(102, response.Id);
        Assert.Equal("Dynamic Programming Mastery", response.Title);
        Assert.Equal("secret-algo-guild", response.StudyGroupSlug);
        Assert.Equal("Secret Algo Guild", response.StudyGroupName);
        Assert.True(response.IsPrivateDeck);
        Assert.False(response.IsMember);
        Assert.False(response.CanAccess);
    }

    [Fact]
    public async Task GetDeckById_PrivateGroupDeck_ActiveMember_ReturnsCanAccessTrue()
    {
        using var db = CreateInMemoryDbContext();
        db.Users.Add(new User { Id = 3, Email = "guild-member@ankix.local", DisplayName = "GuildMember" });

        var group = new StudyGroup
        {
            Id = 98,
            Name = "Exclusive ML Group",
            Slug = "exclusive-ml",
            Privacy = StudyGroupPrivacy.Private,
            CreatedByUserId = 1
        };
        var deck = new Deck
        {
            Id = 103,
            Title = "Transformer Architectures",
            StudyGroupId = 98,
            CreatedByUserId = 1
        };
        db.StudyGroups.Add(group);
        db.Decks.Add(deck);
        db.StudyGroupMembers.Add(new StudyGroupMember
        {
            StudyGroupId = 98,
            UserId = 3,
            Role = StudyGroupRoles.Member,
            Status = StudyGroupMemberStatus.Active
        });
        await db.SaveChangesAsync();

        var controller = CreateDecksController(db, userId: 3);
        var result = await controller.GetDeckById(103);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<DeckResponse>(okResult.Value);
        Assert.True(response.IsPrivateDeck);
        Assert.True(response.IsMember);
        Assert.True(response.CanAccess);
    }

    [Fact]
    public async Task GetDeckCards_PrivateGroupDeck_NonMember_ReturnsNotFound_AndDeckMetadataGated()
    {
        using var db = CreateInMemoryDbContext();
        db.Users.Add(new User { Id = 5, Email = "non-member@ankix.local", DisplayName = "NonMember" });

        var group = new StudyGroup
        {
            Id = 99,
            Name = "Confidential Group",
            Slug = "confidential-group",
            Privacy = StudyGroupPrivacy.Private,
            CreatedByUserId = 1
        };
        var deck = new Deck
        {
            Id = 104,
            Title = "Confidential Cards",
            StudyGroupId = 99,
            CreatedByUserId = 1
        };
        db.StudyGroups.Add(group);
        db.Decks.Add(deck);
        db.Cards.Add(new Card { Id = 10, DeckId = 104, Prompt = "P", Answer = "A" });
        await db.SaveChangesAsync();

        var controller = CreateDecksController(db, userId: 5);

        // Deck metadata reveals parent group for friendly gate UI, but CanAccess is false
        var deckResult = await controller.GetDeckById(104);
        var okResult = Assert.IsType<OkObjectResult>(deckResult.Result);
        var response = Assert.IsType<DeckResponse>(okResult.Value);
        Assert.True(response.IsPrivateDeck);
        Assert.False(response.CanAccess);
        Assert.Equal("Confidential Group", response.StudyGroupName);

        // Cards themselves are strictly protected from non-members
        var cardsResult = await controller.GetCardsByDeck(104);
        Assert.IsType<NotFoundObjectResult>(cardsResult.Result);
    }
}
