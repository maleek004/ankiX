namespace AnkiX.Api.Models;

/// <summary>
/// Join table for the many-to-many relationship between Cards and Exercises.
/// A card can link to multiple exercises as supplementary practice;
/// an exercise can be linked from multiple cards.
/// </summary>
public sealed class CardExercise
{
    public int CardId { get; set; }

    public int ExerciseId { get; set; }
}
