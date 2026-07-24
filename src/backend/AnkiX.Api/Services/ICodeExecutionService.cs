namespace AnkiX.Api.Services;

public interface ICodeExecutionService
{
    Task<CodeExecutionResult> ExecuteAsync(string submittedCode, string language, string? validationSpec, CancellationToken cancellationToken);
}

public sealed class CodeExecutionResult
{
    public bool Passed { get; set; }

    public int DurationMs { get; set; }

    public string Details { get; set; } = string.Empty;
}
