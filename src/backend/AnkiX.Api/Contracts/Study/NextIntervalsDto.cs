namespace AnkiX.Api.Contracts.Study;

/// <summary>
/// Human-readable next-interval preview strings for each of the four SM-2 rating outcomes.
/// Rendered above ease buttons so learners see scheduling consequences before grading.
/// </summary>
public sealed class NextIntervalsDto
{
    /// <summary>Interval preview if user rates "Again" (e.g. "&lt;1m", "&lt;10m").</summary>
    public string Again { get; set; } = string.Empty;

    /// <summary>Interval preview if user rates "Hard".</summary>
    public string Hard { get; set; } = string.Empty;

    /// <summary>Interval preview if user rates "Good".</summary>
    public string Good { get; set; } = string.Empty;

    /// <summary>Interval preview if user rates "Easy" (e.g. "1d", "4d", "2.5mo").</summary>
    public string Easy { get; set; } = string.Empty;
}
