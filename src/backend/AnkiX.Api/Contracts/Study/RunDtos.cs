using System.ComponentModel.DataAnnotations;

namespace AnkiX.Api.Contracts.Study;

public sealed class RunCardRequest
{
    [Required]
    public string SubmittedCode { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string Language { get; set; } = "csharp";
}

public sealed class RunCardResponse
{
    public string Result { get; set; } = "FAIL";

    public int DurationMs { get; set; }

    public string Details { get; set; } = string.Empty;
}
