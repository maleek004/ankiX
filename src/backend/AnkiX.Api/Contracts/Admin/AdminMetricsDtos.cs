namespace AnkiX.Api.Contracts.Admin;

public sealed class MetricTrendPointDto
{
    public string Period { get; set; } = string.Empty;
    public int Count { get; set; }
}

public sealed class ActivityRunTrendPointDto
{
    public string Period { get; set; } = string.Empty;
    public int CardRuns { get; set; }
    public int ExerciseRuns { get; set; }
    public int TotalRuns => CardRuns + ExerciseRuns;
}

public sealed class AdminDashboardSummaryDto
{
    public int TotalStudyGroups { get; set; }
    public int TotalDecks { get; set; }
    public int TotalCards { get; set; }
    public int TotalExercises { get; set; }
    public long TotalCardRuns { get; set; }
    public long TotalExerciseRuns { get; set; }
    public int TotalUsers { get; set; }
    public int OnlineUsers { get; set; }
    public int OfflineUsers { get; set; }
}

public sealed class AdminRolesBreakdownDto
{
    public int SuperAdmin { get; set; }
    public int Admin { get; set; }
    public int Contributor { get; set; }
    public int User { get; set; }
}

public sealed class AdminDashboardTrendsDto
{
    public List<MetricTrendPointDto> StudyGroups { get; set; } = new();
    public List<ActivityRunTrendPointDto> ActivityRuns { get; set; } = new();
    public List<MetricTrendPointDto> UserRegistrations { get; set; } = new();
}

public sealed class AdminDashboardMetricsResponse
{
    public AdminDashboardSummaryDto Summary { get; set; } = new();
    public AdminRolesBreakdownDto RolesBreakdown { get; set; } = new();
    public AdminDashboardTrendsDto Trends { get; set; } = new();
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
}
