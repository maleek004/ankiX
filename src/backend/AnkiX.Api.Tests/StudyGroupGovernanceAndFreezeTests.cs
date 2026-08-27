using System.Security.Claims;
using AnkiX.Api.Contracts.Content;
using AnkiX.Api.Controllers;
using AnkiX.Api.Data;
using AnkiX.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

namespace AnkiX.Api.Tests;

public class StudyGroupGovernanceAndFreezeTests
{
    private static ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
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

    [Fact]
    public async Task UpdateMemberRole_OwnerCannotChangeOwnRole_ReturnsBadRequest()
    {
        using var db = CreateInMemoryDbContext();

        db.Users.Add(new User { Id = 1, Email = "owner@ankix.local", DisplayName = "Owner" });
        db.StudyGroups.Add(new StudyGroup { Id = 10, Name = "Alpha", Slug = "alpha", CreatedByUserId = 1 });
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 10, UserId = 1, Role = StudyGroupRoles.Owner, Status = StudyGroupMemberStatus.Active });
        await db.SaveChangesAsync();

        var controller = CreateStudyGroupsController(db, userId: 1);
        var result = await controller.UpdateMemberRole("alpha", 1, new UpdateMemberRoleRequest { Role = StudyGroupRoles.Admin });

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("cannot change their own role", badRequest.Value?.ToString() ?? "");
    }

    [Fact]
    public async Task UpdateMemberRole_CannotDirectlyAssignOwnerRole_ReturnsBadRequest()
    {
        using var db = CreateInMemoryDbContext();

        db.Users.Add(new User { Id = 1, Email = "owner@ankix.local", DisplayName = "Owner" });
        db.Users.Add(new User { Id = 2, Email = "member@ankix.local", DisplayName = "Member" });
        db.StudyGroups.Add(new StudyGroup { Id = 10, Name = "Alpha", Slug = "alpha", CreatedByUserId = 1 });
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 10, UserId = 1, Role = StudyGroupRoles.Owner, Status = StudyGroupMemberStatus.Active });
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 10, UserId = 2, Role = StudyGroupRoles.Member, Status = StudyGroupMemberStatus.Active });
        await db.SaveChangesAsync();

        var controller = CreateStudyGroupsController(db, userId: 1);
        var result = await controller.UpdateMemberRole("alpha", 2, new UpdateMemberRoleRequest { Role = StudyGroupRoles.Owner });

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("Owner role cannot be assigned directly", badRequest.Value?.ToString() ?? "");
    }

    [Fact]
    public async Task TransferOwnership_ByOwner_AtomicallyPromotesTargetAndDemotesOldOwner()
    {
        using var db = CreateInMemoryDbContext();

        db.Users.Add(new User { Id = 1, Email = "owner@ankix.local", DisplayName = "Owner" });
        db.Users.Add(new User { Id = 2, Email = "target@ankix.local", DisplayName = "Target" });
        db.StudyGroups.Add(new StudyGroup { Id = 10, Name = "Alpha", Slug = "alpha", CreatedByUserId = 1 });
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 10, UserId = 1, Role = StudyGroupRoles.Owner, Status = StudyGroupMemberStatus.Active });
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 10, UserId = 2, Role = StudyGroupRoles.Member, Status = StudyGroupMemberStatus.Active });
        await db.SaveChangesAsync();

        var controller = CreateStudyGroupsController(db, userId: 1);
        var result = await controller.TransferOwnership("alpha", new TransferOwnershipRequest { NewOwnerUserId = 2 });

        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.Contains("Ownership transferred successfully", okResult.Value?.ToString() ?? "");

        var groupInDb = await db.StudyGroups.FirstOrDefaultAsync(g => g.Id == 10);
        Assert.NotNull(groupInDb);
        Assert.Equal(2, groupInDb.CreatedByUserId);

        var member1 = await db.StudyGroupMembers.FirstOrDefaultAsync(m => m.StudyGroupId == 10 && m.UserId == 1);
        var member2 = await db.StudyGroupMembers.FirstOrDefaultAsync(m => m.StudyGroupId == 10 && m.UserId == 2);

        Assert.NotNull(member1);
        Assert.NotNull(member2);
        Assert.Equal(StudyGroupRoles.Admin, member1.Role);
        Assert.Equal(StudyGroupRoles.Owner, member2.Role);
    }

    [Fact]
    public async Task FreezeAndUnfreeze_ByOwner_TogglesIsFrozen()
    {
        using var db = CreateInMemoryDbContext();

        db.Users.Add(new User { Id = 1, Email = "owner@ankix.local", DisplayName = "Owner" });
        db.StudyGroups.Add(new StudyGroup { Id = 10, Name = "Alpha", Slug = "alpha", CreatedByUserId = 1, IsFrozen = false });
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 10, UserId = 1, Role = StudyGroupRoles.Owner, Status = StudyGroupMemberStatus.Active });
        await db.SaveChangesAsync();

        var controller = CreateStudyGroupsController(db, userId: 1);

        // 1. Freeze
        var freezeResult = await controller.FreezeStudyGroup("alpha");
        var freezeOk = Assert.IsType<OkObjectResult>(freezeResult);
        Assert.Contains("frozen", freezeOk.Value?.ToString() ?? "");

        var groupInDb = await db.StudyGroups.FirstOrDefaultAsync(g => g.Id == 10);
        Assert.NotNull(groupInDb);
        Assert.True(groupInDb.IsFrozen);
        Assert.NotNull(groupInDb.FrozenAt);

        // 2. Unfreeze
        var unfreezeResult = await controller.UnfreezeStudyGroup("alpha");
        var unfreezeOk = Assert.IsType<OkObjectResult>(unfreezeResult);
        Assert.Contains("unfreezed", unfreezeOk.Value?.ToString() ?? "");

        groupInDb = await db.StudyGroups.FirstOrDefaultAsync(g => g.Id == 10);
        Assert.NotNull(groupInDb);
        Assert.False(groupInDb.IsFrozen);
        Assert.Null(groupInDb.FrozenAt);
    }

    [Fact]
    public async Task Freeze_SampleGroup_ReturnsBadRequest()
    {
        using var db = CreateInMemoryDbContext();

        db.Users.Add(new User { Id = 1, Email = "admin@ankix.local", DisplayName = "Admin" });
        db.StudyGroups.Add(new StudyGroup { Id = 1, Name = "Sample Community", Slug = "sample", CreatedByUserId = 1 });
        await db.SaveChangesAsync();

        var controller = CreateStudyGroupsController(db, userId: 1, role: "Admin");
        var result = await controller.FreezeStudyGroup("sample");

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("sample study group cannot be frozen", badRequest.Value?.ToString() ?? "");
    }

    [Fact]
    public async Task Delete_SampleGroup_ReturnsBadRequest()
    {
        using var db = CreateInMemoryDbContext();

        db.Users.Add(new User { Id = 1, Email = "admin@ankix.local", DisplayName = "Admin" });
        db.StudyGroups.Add(new StudyGroup { Id = 1, Name = "Sample Community", Slug = "sample", CreatedByUserId = 1 });
        await db.SaveChangesAsync();

        var controller = CreateStudyGroupsController(db, userId: 1, role: "Admin");
        var result = await controller.DeleteStudyGroup("sample");

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("sample study group cannot be deleted", badRequest.Value?.ToString() ?? "");
    }

    [Fact]
    public async Task DeleteStudyGroup_ByOwner_WipesGroupAndAllRelatedDecksCardsAndExercises()
    {
        using var db = CreateInMemoryDbContext();

        db.Users.Add(new User { Id = 1, Email = "owner@ankix.local", DisplayName = "Owner" });
        var group = new StudyGroup { Id = 10, Name = "To Wipe", Slug = "to-wipe", CreatedByUserId = 1 };
        db.StudyGroups.Add(group);

        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 10, UserId = 1, Role = StudyGroupRoles.Owner, Status = StudyGroupMemberStatus.Active });

        var deck = new Deck { Id = 101, Title = "Deck in Group", StudyGroupId = 10 };
        db.Decks.Add(deck);

        var card = new Card { Id = 1001, DeckId = 101, Prompt = "Q", Answer = "A", Type = "basic" };
        db.Cards.Add(card);

        var followup = new CardFollowup { Id = 501, CardId = 1001, AuthorUserId = 1, QuestionText = "Help?" };
        db.CardFollowups.Add(followup);

        var exercise = new Exercise { Id = 201, Title = "Exercise in Group", StudyGroupId = 10, Language = "csharp", StarterCode = "//" };
        db.Exercises.Add(exercise);

        var cardExercise = new CardExercise { CardId = 1001, ExerciseId = 201 };
        db.CardExercises.Add(cardExercise);

        await db.SaveChangesAsync();

        var controller = CreateStudyGroupsController(db, userId: 1);
        var result = await controller.DeleteStudyGroup("to-wipe");

        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.Contains("permanently erased", okResult.Value?.ToString() ?? "");

        Assert.Null(await db.StudyGroups.FirstOrDefaultAsync(g => g.Id == 10));
        Assert.Empty(await db.StudyGroupMembers.Where(m => m.StudyGroupId == 10).ToListAsync());
        Assert.Null(await db.Decks.FirstOrDefaultAsync(d => d.Id == 101));
        Assert.Null(await db.Cards.FirstOrDefaultAsync(c => c.Id == 1001));
        Assert.Null(await db.CardFollowups.FirstOrDefaultAsync(f => f.Id == 501));
        Assert.Null(await db.Exercises.FirstOrDefaultAsync(e => e.Id == 201));
        Assert.Empty(await db.CardExercises.Where(ce => ce.ExerciseId == 201).ToListAsync());
    }

    [Fact]
    public async Task UpdateMemberRole_SystemAdminCannotDemoteOwnerDirectly_ReturnsBadRequest()
    {
        using var db = CreateInMemoryDbContext();

        db.Users.Add(new User { Id = 1, Email = "owner@ankix.local", DisplayName = "Owner" });
        db.Users.Add(new User { Id = 99, Email = "sysadmin@ankix.local", DisplayName = "Admin" });
        db.StudyGroups.Add(new StudyGroup { Id = 10, Name = "Alpha", Slug = "alpha", CreatedByUserId = 1 });
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 10, UserId = 1, Role = StudyGroupRoles.Owner, Status = StudyGroupMemberStatus.Active });
        await db.SaveChangesAsync();

        var controller = CreateStudyGroupsController(db, userId: 99, role: "Admin");
        var result = await controller.UpdateMemberRole("alpha", 1, new UpdateMemberRoleRequest { Role = StudyGroupRoles.Member });

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("cannot change their own role or be demoted directly", badRequest.Value?.ToString() ?? "");
    }

    [Fact]
    public async Task TransferOwnership_SampleGroup_ReturnsBadRequest()
    {
        using var db = CreateInMemoryDbContext();

        db.Users.Add(new User { Id = 1, Email = "owner@ankix.local", DisplayName = "Owner" });
        db.Users.Add(new User { Id = 2, Email = "member@ankix.local", DisplayName = "Member" });
        db.StudyGroups.Add(new StudyGroup { Id = 1, Name = "Sample Community", Slug = "sample", CreatedByUserId = 1 });
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 1, UserId = 1, Role = StudyGroupRoles.Owner, Status = StudyGroupMemberStatus.Active });
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 1, UserId = 2, Role = StudyGroupRoles.Member, Status = StudyGroupMemberStatus.Active });
        await db.SaveChangesAsync();

        var controller = CreateStudyGroupsController(db, userId: 1);
        var result = await controller.TransferOwnership("sample", new TransferOwnershipRequest { NewOwnerUserId = 2 });

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("sample study group ownership cannot be transferred", badRequest.Value?.ToString() ?? "");
    }

    [Fact]
    public async Task TransferOwnership_TargetAlreadyOwner_ReturnsBadRequest()
    {
        using var db = CreateInMemoryDbContext();

        db.Users.Add(new User { Id = 1, Email = "owner@ankix.local", DisplayName = "Owner" });
        db.StudyGroups.Add(new StudyGroup { Id = 10, Name = "Alpha", Slug = "alpha", CreatedByUserId = 1 });
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 10, UserId = 1, Role = StudyGroupRoles.Owner, Status = StudyGroupMemberStatus.Active });
        await db.SaveChangesAsync();

        var controller = CreateStudyGroupsController(db, userId: 1);
        var result = await controller.TransferOwnership("alpha", new TransferOwnershipRequest { NewOwnerUserId = 1 });

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("already the owner", badRequest.Value?.ToString() ?? "");
    }

    [Fact]
    public async Task UpdateStudyGroup_ByOwnerOrAdmin_UpdatesNameAndDescription()
    {
        using var db = CreateInMemoryDbContext();

        db.Users.Add(new User { Id = 1, Email = "owner@ankix.local", DisplayName = "Owner" });
        db.StudyGroups.Add(new StudyGroup { Id = 10, Name = "Original Name", Slug = "original-slug", Description = "Old Desc", CreatedByUserId = 1 });
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 10, UserId = 1, Role = StudyGroupRoles.Owner, Status = StudyGroupMemberStatus.Active });
        await db.SaveChangesAsync();

        var controller = CreateStudyGroupsController(db, userId: 1);
        var result = await controller.UpdateStudyGroup("original-slug", new UpdateStudyGroupRequest
        {
            Name = "Updated Name",
            Description = "Updated Desc"
        });

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<StudyGroupResponse>(okResult.Value);
        Assert.Equal("Updated Name", response.Name);
        Assert.Equal("Updated Desc", response.Description);

        var updatedGroup = await db.StudyGroups.FirstOrDefaultAsync(g => g.Id == 10);
        Assert.NotNull(updatedGroup);
        Assert.Equal("Updated Name", updatedGroup.Name);
        Assert.Equal("Updated Desc", updatedGroup.Description);
    }

    [Fact]
    public async Task UpdateStudyGroup_ByRegularMember_ReturnsForbid()
    {
        using var db = CreateInMemoryDbContext();

        db.Users.Add(new User { Id = 1, Email = "owner@ankix.local", DisplayName = "Owner" });
        db.Users.Add(new User { Id = 2, Email = "member@ankix.local", DisplayName = "Member" });
        db.StudyGroups.Add(new StudyGroup { Id = 10, Name = "Alpha", Slug = "alpha", CreatedByUserId = 1 });
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 10, UserId = 1, Role = StudyGroupRoles.Owner, Status = StudyGroupMemberStatus.Active });
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 10, UserId = 2, Role = StudyGroupRoles.Member, Status = StudyGroupMemberStatus.Active });
        await db.SaveChangesAsync();

        var controller = CreateStudyGroupsController(db, userId: 2);
        var result = await controller.UpdateStudyGroup("alpha", new UpdateStudyGroupRequest
        {
            Name = "Hacked Name"
        });

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task UpdateStudyGroup_WhenFrozen_ReturnsForbidden()
    {
        using var db = CreateInMemoryDbContext();

        db.Users.Add(new User { Id = 1, Email = "owner@ankix.local", DisplayName = "Owner" });
        db.StudyGroups.Add(new StudyGroup { Id = 10, Name = "Alpha", Slug = "alpha", CreatedByUserId = 1, IsFrozen = true });
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 10, UserId = 1, Role = StudyGroupRoles.Owner, Status = StudyGroupMemberStatus.Active });
        await db.SaveChangesAsync();

        var controller = CreateStudyGroupsController(db, userId: 1);
        var result = await controller.UpdateStudyGroup("alpha", new UpdateStudyGroupRequest
        {
            Name = "New Name"
        });

        var statusResult = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status403Forbidden, statusResult.StatusCode);
    }

    [Fact]
    public async Task UpdateStudyGroup_EmptyName_ReturnsBadRequest()
    {
        using var db = CreateInMemoryDbContext();

        db.Users.Add(new User { Id = 1, Email = "owner@ankix.local", DisplayName = "Owner" });
        db.StudyGroups.Add(new StudyGroup { Id = 10, Name = "Alpha", Slug = "alpha", CreatedByUserId = 1 });
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 10, UserId = 1, Role = StudyGroupRoles.Owner, Status = StudyGroupMemberStatus.Active });
        await db.SaveChangesAsync();

        var controller = CreateStudyGroupsController(db, userId: 1);
        var result = await controller.UpdateStudyGroup("alpha", new UpdateStudyGroupRequest
        {
            Name = "   "
        });

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task UpdateDeck_ByGroupAdmin_UpdatesTitleAndDescription()
    {
        using var db = CreateInMemoryDbContext();

        db.Users.Add(new User { Id = 1, Email = "admin@ankix.local", DisplayName = "Admin" });
        db.StudyGroups.Add(new StudyGroup { Id = 10, Name = "Alpha", Slug = "alpha", CreatedByUserId = 1 });
        db.StudyGroupMembers.Add(new StudyGroupMember { StudyGroupId = 10, UserId = 1, Role = StudyGroupRoles.Admin, Status = StudyGroupMemberStatus.Active });
        db.Decks.Add(new Deck { Id = 100, Title = "Old Title", Description = "Old Desc", StudyGroupId = 10, CreatedByUserId = 1 });
        await db.SaveChangesAsync();

        var contentController = new ContentController(db);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, "1"),
            new(ClaimTypes.Role, "User")
        };
        contentController.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth")) }
        };

        var result = await contentController.UpdateDeck(100, new UpdateDeckRequest
        {
            Title = "Updated Deck Title",
            Description = "Updated Deck Desc"
        });

        Assert.IsType<OkResult>(result);

        var deck = await db.Decks.FirstOrDefaultAsync(d => d.Id == 100);
        Assert.NotNull(deck);
        Assert.Equal("Updated Deck Title", deck.Title);
        Assert.Equal("Updated Deck Desc", deck.Description);
    }
}
