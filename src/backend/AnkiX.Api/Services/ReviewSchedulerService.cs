using AnkiX.Api.Models;

namespace AnkiX.Api.Services;

public sealed class ReviewSchedulerService : IReviewSchedulerService
{
    public ReviewScheduleResult CalculateNextSchedule(ReviewRecord? previousRecord, string outcome)
    {
        string normalizedOutcome = outcome.Trim();

        // "Again" maps to quality=1 in SM-2 — failed recall, reset immediately
        if (normalizedOutcome == "Again")
        {
            decimal againEase = previousRecord?.EaseFactor ?? 2.50m;
            decimal againNextEase = Math.Max(1.30m, againEase - 0.20m);
            return new ReviewScheduleResult
            {
                EaseFactor = againNextEase,
                IntervalDays = 1,
                NextReviewAt = DateTime.UtcNow.AddDays(1)
            };
        }

        int quality = normalizedOutcome switch
        {
            "Hard" => 3,
            "Good" => 4,
            "Easy" => 5,
            _ => throw new ArgumentException("Outcome must be one of Again, Hard, Good, Easy.")
        };

        decimal previousEase = previousRecord?.EaseFactor ?? 2.50m;
        int previousInterval = previousRecord?.IntervalDays ?? 0;

        decimal easeAdjustment = 0.10m - (5 - quality) * (0.08m + (5 - quality) * 0.02m);
        decimal nextEaseFactor = Math.Max(1.30m, previousEase + easeAdjustment);

        int nextIntervalDays;
        if (previousRecord is null)
        {
            nextIntervalDays = normalizedOutcome switch
            {
                "Hard" => 1,
                "Good" => 1,
                "Easy" => 2,
                _ => 1
            };
        }
        else if (previousInterval <= 1)
        {
            nextIntervalDays = normalizedOutcome switch
            {
                "Hard" => 3,
                "Good" => 6,
                "Easy" => 8,
                _ => 3
            };
        }
        else
        {
            decimal multiplier = normalizedOutcome switch
            {
                "Hard" => 1.20m,
                "Good" => nextEaseFactor,
                "Easy" => nextEaseFactor * 1.30m,
                _ => 1.00m
            };

            nextIntervalDays = Math.Max(1, (int)Math.Round(previousInterval * multiplier, MidpointRounding.AwayFromZero));
        }

        DateTime nextReviewAt = DateTime.UtcNow.AddDays(nextIntervalDays);
        return new ReviewScheduleResult
        {
            EaseFactor = nextEaseFactor,
            IntervalDays = nextIntervalDays,
            NextReviewAt = nextReviewAt
        };
    }
}
