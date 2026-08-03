using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AnkiX.Api.Models;

/// <summary>
/// Phase 1 stub — stores the identity of an exercise.
/// Full functionality (test cases, execution, SM-2) is deferred to Phase 2.
/// </summary>
public sealed class Exercise
{
    public int Id { get; set; }

    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(4000)]
    public string? Description { get; set; }

    [MaxLength(50)]
    public string Language { get; set; } = "csharp";

    [MaxLength(50)]
    public string ExerciseType { get; set; } = "CodeExecution";

    public string? ExerciseSpec { get; set; }

    public string? StarterCode { get; set; }

    public string? SolutionCode { get; set; }

    public string? TestCasesSpec { get; set; }

    public int? CreatedByUserId { get; set; }

    [Column(TypeName = "datetime2")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
