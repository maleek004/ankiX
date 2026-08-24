using AnkiX.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AnkiX.Api.Data;

public sealed class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();

    public DbSet<Deck> Decks => Set<Deck>();

    public DbSet<Card> Cards => Set<Card>();

    public DbSet<ReviewRecord> ReviewRecords => Set<ReviewRecord>();

    // Phase 1 stubs — Exercise functionality implemented in Phase 2
    public DbSet<Exercise> Exercises => Set<Exercise>();

    public DbSet<CardExercise> CardExercises => Set<CardExercise>();

    // Followups
    public DbSet<CardFollowup> CardFollowups => Set<CardFollowup>();

    public DbSet<ExerciseReviewRecord> ExerciseReviewRecords => Set<ExerciseReviewRecord>();

    public DbSet<UserExercise> UserExercises => Set<UserExercise>();

    public DbSet<StudyGroup> StudyGroups => Set<StudyGroup>();

    public DbSet<StudyGroupMember> StudyGroupMembers => Set<StudyGroupMember>();

    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>()
            .HasIndex(user => user.Email)
            .IsUnique();

        modelBuilder.Entity<User>()
            .HasIndex(user => user.LastActiveAt);

        modelBuilder.Entity<StudyGroup>()
            .HasIndex(sg => sg.Slug)
            .IsUnique();

        modelBuilder.Entity<StudyGroupMember>()
            .HasKey(sgm => new { sgm.StudyGroupId, sgm.UserId });

        modelBuilder.Entity<StudyGroupMember>()
            .HasIndex(sgm => new { sgm.StudyGroupId, sgm.Status });

        modelBuilder.Entity<StudyGroupMember>()
            .HasIndex(sgm => new { sgm.UserId, sgm.Status });

        modelBuilder.Entity<Deck>()
            .HasIndex(d => d.StudyGroupId);

        modelBuilder.Entity<Exercise>()
            .HasIndex(e => e.StudyGroupId);

        modelBuilder.Entity<Card>()
            .HasIndex(card => card.DeckId);

        modelBuilder.Entity<ReviewRecord>()
            .HasIndex(record => new { record.UserId, record.NextReviewAt });

        modelBuilder.Entity<ExerciseReviewRecord>()
            .HasIndex(record => new { record.UserId, record.NextReviewAt });

        modelBuilder.Entity<UserExercise>()
            .HasKey(ue => new { ue.UserId, ue.ExerciseId });

        // CardExercise: composite PK is the join key — no surrogate Id needed
        modelBuilder.Entity<CardExercise>()
            .HasKey(ce => new { ce.CardId, ce.ExerciseId });

        modelBuilder.Entity<CardExercise>()
            .HasIndex(ce => ce.ExerciseId); // efficient lookup: "all cards for exercise X"

        // CardFollowup: index on CardId for fast per-card retrieval
        modelBuilder.Entity<CardFollowup>()
            .HasIndex(f => f.CardId);

        modelBuilder.Entity<CardFollowup>()
            .HasIndex(f => f.AuthorUserId);

        modelBuilder.Entity<RefreshToken>()
            .HasIndex(rt => new { rt.UserId, rt.TokenHash });

        modelBuilder.Entity<RefreshToken>()
            .HasIndex(rt => rt.TokenHash)
            .IsUnique();

        modelBuilder.Entity<RefreshToken>()
            .HasIndex(rt => rt.ExpiresAt);
    }
}
