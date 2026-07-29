using System.ComponentModel.DataAnnotations;

namespace AnkiX.Api.Contracts.Study;

public sealed class CodeRunRequest
{
    [Required]
    public string SubmittedCode { get; set; } = string.Empty;

    public string Language { get; set; } = "csharp";
}

public sealed class CodeRunResponse
{
    public long RunId { get; set; }

    public string Result { get; set; } = "FAIL";

    public bool Passed { get; set; }

    public int DurationMs { get; set; }

    public string Details { get; set; } = string.Empty;
}
