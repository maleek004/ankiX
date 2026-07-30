using System.ComponentModel.DataAnnotations.Schema;

namespace AnkiX.Api.Models;

public sealed class UserExercise
{
    public int UserId { get; set; }

    public int ExerciseId { get; set; }

    [Column(TypeName = "datetime2")]
    public DateTime EnrolledAt { get; set; } = DateTime.UtcNow;
}
