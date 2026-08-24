namespace AnkiX.Api.Contracts.Auth;

public sealed class UserProfileResponse
{
    public int Id { get; set; }

    public string Email { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public string Role { get; set; } = string.Empty;

    public string AuthProvider { get; set; } = "local";

    public bool IsEmailVerified { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? LastActiveAt { get; set; }

    public UserStudyStatsDto Stats { get; set; } = new UserStudyStatsDto();
}

public sealed class UserStudyStatsDto
{
    public int ReviewsCount { get; set; }

    public int DecksCreatedCount { get; set; }
}
