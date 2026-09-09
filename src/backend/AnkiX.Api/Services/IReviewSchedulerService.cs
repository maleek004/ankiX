using AnkiX.Api.Contracts.Study;
using AnkiX.Api.Models;

namespace AnkiX.Api.Services;

public interface IReviewSchedulerService
{
    ReviewScheduleResult CalculateNextSchedule(ReviewRecord? previousRecord, string outcome);

    /// <summary>
    /// Precomputes human-readable next-interval preview strings for all four rating outcomes
    /// (Again, Hard, Good, Easy) given the user's current review state.
    /// </summary>
    NextIntervalsDto CalculateNextIntervalPreviews(ReviewRecord? previousRecord);

    /// <summary>
    /// Formats a single ReviewScheduleResult into a human-readable interval string
    /// (e.g. "&lt;1m", "&lt;10m", "1d", "4d", "2.5mo", "1.3y").
    /// </summary>
    string FormatIntervalPreview(ReviewScheduleResult schedule);
}

public sealed class ReviewScheduleResult
{
    public decimal EaseFactor { get; set; }

    public int IntervalDays { get; set; }

    public DateTime NextReviewAt { get; set; }

    /// <summary>"learning" or "review"</summary>
    public string Phase { get; set; } = "learning";

    /// <summary>0 = 1-minute step, 1 = 10-minute step.</summary>
    public int LearningStep { get; set; }
}
