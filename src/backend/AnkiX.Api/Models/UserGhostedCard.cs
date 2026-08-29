namespace AnkiX.Api.Models;

/// <summary>
/// Represents a user-level card suspension (ghosting).
/// When a user ghosts a card, it is excluded from their personal study queue,
/// but remains active and untouched for other study group members and deck authors.
/// </summary>
public sealed class UserGhostedCard
{
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public int CardId { get; set; }
    public Card Card { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
