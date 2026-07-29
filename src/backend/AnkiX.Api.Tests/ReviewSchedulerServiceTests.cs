using AnkiX.Api.Models;
using AnkiX.Api.Services;

namespace AnkiX.Api.Tests;

public sealed class ReviewSchedulerServiceTests
{
    private readonly ReviewSchedulerService _sut = new();

    // ════════════════════════════════════════════════════════════════════════
    // Brand-new cards (no prior review history)
    // ════════════════════════════════════════════════════════════════════════

    [Theory]
    [InlineData("Again")]
    [InlineData("Hard")]
    public void NewCard_AgainOrHard_EntersLearningAtStep0(string outcome)
    {
        var result = _sut.CalculateNextSchedule(null, outcome);

        Assert.Equal("learning", result.Phase);
        Assert.Equal(0, result.LearningStep);
        Assert.Equal(0, result.IntervalDays); // minutes-based, not days
    }

    [Fact]
    public void NewCard_Good_EntersLearningAtStep1()
    {
        var result = _sut.CalculateNextSchedule(null, "Good");

        Assert.Equal("learning", result.Phase);
        Assert.Equal(1, result.LearningStep);
    }

    [Fact]
    public void NewCard_Easy_GraduatesDirectlyToReview()
    {
        var result = _sut.CalculateNextSchedule(null, "Easy");

        Assert.Equal("review", result.Phase);
        Assert.Equal(1, result.IntervalDays);
    }

    [Fact]
    public void NewCard_Easy_EaseFactorIncreasesAboveDefault()
    {
        var result = _sut.CalculateNextSchedule(null, "Easy");

        Assert.True(result.EaseFactor > 2.50m);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Learning phase — Step 0 (1-minute step)
    // ════════════════════════════════════════════════════════════════════════

    [Theory]
    [InlineData("Again")]
    [InlineData("Hard")]
    public void Learning_Step0_AgainOrHard_StaysAtStep0(string outcome)
    {
        var prev = MakeLearning(step: 0, ease: 2.50m);

        var result = _sut.CalculateNextSchedule(prev, outcome);

        Assert.Equal("learning", result.Phase);
        Assert.Equal(0, result.LearningStep);
    }

    [Fact]
    public void Learning_Step0_Good_AdvancesToStep1()
    {
        var prev = MakeLearning(step: 0, ease: 2.50m);

        var result = _sut.CalculateNextSchedule(prev, "Good");

        Assert.Equal("learning", result.Phase);
        Assert.Equal(1, result.LearningStep);
    }

    [Fact]
    public void Learning_Step0_Easy_GraduatesToReview()
    {
        var prev = MakeLearning(step: 0, ease: 2.50m);

        var result = _sut.CalculateNextSchedule(prev, "Easy");

        Assert.Equal("review", result.Phase);
        Assert.True(result.IntervalDays >= 1);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Learning phase — Step 1 (10-minute step)
    // ════════════════════════════════════════════════════════════════════════

    [Theory]
    [InlineData("Again")]
    [InlineData("Hard")]
    public void Learning_Step1_AgainOrHard_ResetsToStep0(string outcome)
    {
        var prev = MakeLearning(step: 1, ease: 2.50m);

        var result = _sut.CalculateNextSchedule(prev, outcome);

        Assert.Equal("learning", result.Phase);
        Assert.Equal(0, result.LearningStep);
    }

    [Fact]
    public void Learning_Step1_Good_GraduatesToReview()
    {
        var prev = MakeLearning(step: 1, ease: 2.50m);

        var result = _sut.CalculateNextSchedule(prev, "Good");

        Assert.Equal("review", result.Phase);
        Assert.Equal(1, result.IntervalDays);
    }

    [Fact]
    public void Learning_Step1_Easy_GraduatesToReviewWithBonusInterval()
    {
        var prev = MakeLearning(step: 1, ease: 2.50m);

        var result = _sut.CalculateNextSchedule(prev, "Easy");

        Assert.Equal("review", result.Phase);
        Assert.Equal(4, result.IntervalDays);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Review phase
    // ════════════════════════════════════════════════════════════════════════

    [Fact]
    public void Review_Again_LapsesBackToLearning()
    {
        var prev = MakeReview(intervalDays: 10, ease: 2.50m);

        var result = _sut.CalculateNextSchedule(prev, "Again");

        Assert.Equal("learning", result.Phase);
        Assert.Equal(0, result.LearningStep);
    }

    [Fact]
    public void Review_Again_ReducesEaseFactor()
    {
        var prev = MakeReview(intervalDays: 10, ease: 2.50m);

        var result = _sut.CalculateNextSchedule(prev, "Again");

        Assert.True(result.EaseFactor < 2.50m);
    }

    [Fact]
    public void Review_Again_EaseFactorNeverDropsBelowFloor()
    {
        var prev = MakeReview(intervalDays: 10, ease: 1.30m);

        var result = _sut.CalculateNextSchedule(prev, "Again");

        Assert.Equal(1.30m, result.EaseFactor);
    }

    [Fact]
    public void Review_Hard_StaysInReviewWithMultiplier120()
    {
        var prev = MakeReview(intervalDays: 10, ease: 2.50m);

        var result = _sut.CalculateNextSchedule(prev, "Hard");

        Assert.Equal("review", result.Phase);
        Assert.Equal(12, result.IntervalDays); // round(10 * 1.20)
    }

    [Fact]
    public void Review_Hard_ReducesEaseFactor()
    {
        var prev = MakeReview(intervalDays: 10, ease: 2.50m);

        var result = _sut.CalculateNextSchedule(prev, "Hard");

        Assert.True(result.EaseFactor < 2.50m);
    }

    [Fact]
    public void Review_Good_StaysInReviewWithEaseMultiplier()
    {
        var prev = MakeReview(intervalDays: 10, ease: 2.50m);

        var result = _sut.CalculateNextSchedule(prev, "Good");

        Assert.Equal("review", result.Phase);
        Assert.Equal(25, result.IntervalDays); // round(10 * 2.50)
    }

    [Fact]
    public void Review_Good_EaseFactorUnchanged()
    {
        var prev = MakeReview(intervalDays: 10, ease: 2.50m);

        var result = _sut.CalculateNextSchedule(prev, "Good");

        Assert.Equal(2.50m, result.EaseFactor);
    }

    [Fact]
    public void Review_Easy_StaysInReviewWithBonusMultiplier()
    {
        var prev = MakeReview(intervalDays: 10, ease: 2.50m);

        var result = _sut.CalculateNextSchedule(prev, "Easy");

        Assert.Equal("review", result.Phase);
        // round(10 * 2.50 * 1.30) = round(32.5) = 33
        Assert.Equal(33, result.IntervalDays);
    }

    [Fact]
    public void Review_Easy_IncreasesEaseFactor()
    {
        var prev = MakeReview(intervalDays: 10, ease: 2.50m);

        var result = _sut.CalculateNextSchedule(prev, "Easy");

        Assert.True(result.EaseFactor > 2.50m);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Edge Cases & Validation
    // ════════════════════════════════════════════════════════════════════════

    [Fact]
    public void EaseFactor_NeverDropsBelow130_InReviewHard()
    {
        var prev = MakeReview(intervalDays: 5, ease: 1.32m);

        var result = _sut.CalculateNextSchedule(prev, "Hard");

        Assert.True(result.EaseFactor >= 1.30m);
    }

    [Fact]
    public void IntervalDays_NeverDropsBelow1_InReview()
    {
        var prev = MakeReview(intervalDays: 1, ease: 1.30m);

        var result = _sut.CalculateNextSchedule(prev, "Hard");

        Assert.True(result.IntervalDays >= 1);
    }

    [Theory]
    [InlineData("again")]
    [InlineData("GOOD")]
    [InlineData("")]
    [InlineData("Unknown")]
    public void InvalidOutcome_Throws(string outcome)
    {
        Assert.Throws<ArgumentException>(() =>
            _sut.CalculateNextSchedule(null, outcome));
    }

    [Fact]
    public void WhitespacePaddedOutcome_IsNormalized()
    {
        var result = _sut.CalculateNextSchedule(null, "  Good  ");

        Assert.Equal("learning", result.Phase);
        Assert.Equal(1, result.LearningStep);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Helpers
    // ════════════════════════════════════════════════════════════════════════

    private static ReviewRecord MakeLearning(int step, decimal ease) =>
        new()
        {
            Id           = 1,
            CardId       = 1,
            UserId       = 1,
            Outcome      = "Good",
            Phase        = "learning",
            LearningStep = step,
            EaseFactor   = ease,
            IntervalDays = 0,
            NextReviewAt = DateTime.UtcNow,
            CreatedAt    = DateTime.UtcNow
        };

    private static ReviewRecord MakeReview(int intervalDays, decimal ease) =>
        new()
        {
            Id           = 1,
            CardId       = 1,
            UserId       = 1,
            Outcome      = "Good",
            Phase        = "review",
            LearningStep = 0,
            EaseFactor   = ease,
            IntervalDays = intervalDays,
            NextReviewAt = DateTime.UtcNow,
            CreatedAt    = DateTime.UtcNow
        };
}
