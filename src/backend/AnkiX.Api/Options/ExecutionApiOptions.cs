namespace AnkiX.Api.Options;

public sealed class ExecutionApiOptions
{
    public const string SectionName = "ExecutionApi";

    public string BaseUrl { get; set; } = string.Empty;

    public string ExecutePath { get; set; } = "/execute";

    public string ApiKey { get; set; } = string.Empty;

    public int TimeoutSeconds { get; set; } = 10;
}
