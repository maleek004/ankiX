using AnkiX.Api.Contracts.Content;

namespace AnkiX.Api.Contracts.Study;

public sealed class StudyQueueResponse
{
    /// <summary>Cards with no review history for this user (shown in the Blue counter).</summary>
    public int NewCount { get; set; }

    /// <summary>Cards currently in the learning phase that are due now (Red counter).</summary>
    public int LearningCount { get; set; }

    /// <summary>Cards that have graduated to the review phase and are due today (Green counter).</summary>
    public int ReviewCount { get; set; }

    /// <summary>
    /// Ordered queue of cards due right now.
    /// Priority: Learning → Review → New.
    /// </summary>
    public List<CardResponse> DueCards { get; set; } = [];
}
