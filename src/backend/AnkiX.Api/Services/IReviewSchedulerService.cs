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
}
