using AnkiX.Api.Models;

namespace AnkiX.Api.Services;

public interface IReviewSchedulerService
{
    ReviewScheduleResult CalculateNextSchedule(ReviewRecord? previousRecord, string outcome);
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
