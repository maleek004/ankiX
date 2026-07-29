using AnkiX.Api.Models;

namespace AnkiX.Api.Services;

public sealed class ReviewSchedulerService : IReviewSchedulerService
{
    // Learning steps in minutes. Step 0 = 1 min, Step 1 = 10 min.
    private static readonly int[] LearningStepMinutes = [1, 10];

    public ReviewScheduleResult CalculateNextSchedule(ReviewRecord? previousRecord, string outcome)
    {
        string o = outcome.Trim();

        if (o is not ("Again" or "Hard" or "Good" or "Easy"))
        {
            throw new ArgumentException("Outcome must be one of Again, Hard, Good, Easy.");
        }

        // ── Brand-new card (never reviewed) ───────────────────────────────────
        if (previousRecord is null)
        {
            return o switch
            {
                "Again" or "Hard" => MakeLearning(step: 0, ease: 2.50m),
                "Good"            => MakeLearning(step: 1, ease: 2.50m),
                "Easy"            => MakeReview(intervalDays: 1, ease: 2.60m),
                _                 => MakeLearning(step: 0, ease: 2.50m)
            };
        }

        decimal ease = previousRecord.EaseFactor;
        int interval = previousRecord.IntervalDays;
        int step = previousRecord.LearningStep;
        string phase = previousRecord.Phase;

        // ── Learning phase ────────────────────────────────────────────────────
        // Cards in this phase cycle through 1-minute → 10-minute steps.
        // Good at step 1, or Easy at any step, graduates the card to Review.
        if (phase == "learning")
        {
            return o switch
            {
                "Again"                 => MakeLearning(step: 0, ease: ease),
                "Hard"                  => MakeLearning(step: 0, ease: ease),
                "Good" when step == 0   => MakeLearning(step: 1, ease: ease),
                "Good"                  => MakeReview(intervalDays: 1, ease: ease),   // graduate
                "Easy"                  => MakeReview(intervalDays: 4, ease: Math.Min(ease + 0.15m, 9.99m)),
                _                       => MakeLearning(step: 0, ease: ease)
            };
        }

        // ── Review phase ──────────────────────────────────────────────────────
        // Again causes a lapse — card falls back to the Learning queue.
        // Hard/Good/Easy apply SM-2 interval multipliers and keep the card in Review.
        decimal nextEase;
        int nextInterval;

        switch (o)
        {
            case "Again":
                // Lapse: drop back to learning with a reduced ease factor
                return MakeLearning(step: 0, ease: Math.Max(1.30m, ease - 0.20m));

            case "Hard":
                nextEase     = Math.Max(1.30m, ease - 0.15m);
                nextInterval = Math.Max(1, (int)Math.Round(interval * 1.20m, MidpointRounding.AwayFromZero));
                return MakeReview(intervalDays: nextInterval, ease: nextEase);

            case "Good":
                nextEase     = ease; // unchanged
                nextInterval = Math.Max(1, (int)Math.Round(interval * ease, MidpointRounding.AwayFromZero));
                return MakeReview(intervalDays: nextInterval, ease: nextEase);

            case "Easy":
                nextEase     = Math.Min(ease + 0.15m, 9.99m);
                nextInterval = Math.Max(1, (int)Math.Round(interval * ease * 1.30m, MidpointRounding.AwayFromZero));
                return MakeReview(intervalDays: nextInterval, ease: nextEase);

            default:
                throw new ArgumentException("Outcome must be one of Again, Hard, Good, Easy.");
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static ReviewScheduleResult MakeLearning(int step, decimal ease)
    {
        int clampedStep = Math.Min(step, LearningStepMinutes.Length - 1);
        int minutes = LearningStepMinutes[clampedStep];
        return new ReviewScheduleResult
        {
            Phase        = "learning",
            LearningStep = clampedStep,
            EaseFactor   = ease,
            IntervalDays = 0, // learning intervals are in minutes, not days
            NextReviewAt = DateTime.UtcNow.AddMinutes(minutes)
        };
    }

    private static ReviewScheduleResult MakeReview(int intervalDays, decimal ease)
    {
        return new ReviewScheduleResult
        {
            Phase        = "review",
            LearningStep = 0,
            EaseFactor   = ease,
            IntervalDays = intervalDays,
            NextReviewAt = DateTime.UtcNow.AddDays(intervalDays)
        };
    }
}
