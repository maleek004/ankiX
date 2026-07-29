using System.ComponentModel.DataAnnotations;

namespace AnkiX.Api.Contracts.Content;

public sealed class ExerciseResponse
{
    public int Id { get; set; }

    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string Language { get; set; } = "csharp";

    public int? CreatedByUserId { get; set; }

    public DateTime CreatedAt { get; set; }

    public int LinkedCardsCount { get; set; }
}

public sealed class ExerciseDetailResponse
{
    public int Id { get; set; }

    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string Language { get; set; } = "csharp";

    public string? StarterCode { get; set; }

    public string? SolutionCode { get; set; }

    public string? TestCasesSpec { get; set; }

    public int? CreatedByUserId { get; set; }

    public DateTime CreatedAt { get; set; }
}

public sealed class CreateExerciseRequest
{
    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(4000)]
    public string? Description { get; set; }

    [Required]
    [MaxLength(50)]
    public string Language { get; set; } = "csharp";

    public string? StarterCode { get; set; }

    public string? SolutionCode { get; set; }

    public string? TestCasesSpec { get; set; }
}

public sealed class UpdateExerciseRequest
{
    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(4000)]
    public string? Description { get; set; }

    [Required]
    [MaxLength(50)]
    public string Language { get; set; } = "csharp";

    public string? StarterCode { get; set; }

    public string? SolutionCode { get; set; }

    public string? TestCasesSpec { get; set; }
}
