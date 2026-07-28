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

    [Column(TypeName = "datetime2")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
