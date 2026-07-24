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

    public DbSet<CardRun> CardRuns => Set<CardRun>();

    public DbSet<ReviewRecord> ReviewRecords => Set<ReviewRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>()
            .HasIndex(user => user.Email)
            .IsUnique();

        modelBuilder.Entity<Card>()
            .HasIndex(card => card.DeckId);

        modelBuilder.Entity<CardRun>()
            .HasIndex(run => new { run.UserId, run.CardId });

        modelBuilder.Entity<ReviewRecord>()
            .HasIndex(record => new { record.UserId, record.NextReviewAt });
    }
}
