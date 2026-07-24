using System.Net.Http.Headers;
using System.Net.Http.Json;
using AnkiX.Api.Options;
using Microsoft.Extensions.Options;

namespace AnkiX.Api.Services;

public sealed class CodeExecutionService : ICodeExecutionService
{
    private readonly HttpClient httpClient;
    private readonly ExecutionApiOptions executionApiOptions;

    public CodeExecutionService(HttpClient httpClient, IOptions<ExecutionApiOptions> executionApiOptions)
    {
        this.httpClient = httpClient;
        this.executionApiOptions = executionApiOptions.Value;
    }

    public async Task<CodeExecutionResult> ExecuteAsync(string submittedCode, string language, string? validationSpec, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(executionApiOptions.BaseUrl))
        {
            throw new InvalidOperationException("ExecutionApi:BaseUrl is required for code execution.");
        }

        if (!Uri.TryCreate(executionApiOptions.BaseUrl, UriKind.Absolute, out Uri? baseUri))
        {
            throw new InvalidOperationException("ExecutionApi:BaseUrl must be an absolute URI.");
        }

        httpClient.BaseAddress = baseUri;
        httpClient.Timeout = TimeSpan.FromSeconds(Math.Max(1, executionApiOptions.TimeoutSeconds));

        if (!string.IsNullOrWhiteSpace(executionApiOptions.ApiKey))
        {
            httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", executionApiOptions.ApiKey);
        }

        ExecutionApiRequest payload = new ExecutionApiRequest
        {
            SubmittedCode = submittedCode,
            Language = language,
            ValidationSpec = validationSpec
        };

        HttpResponseMessage response = await httpClient.PostAsJsonAsync(executionApiOptions.ExecutePath, payload, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"Execution API returned {(int)response.StatusCode}.");
        }

        ExecutionApiResponse? executionResponse = await response.Content.ReadFromJsonAsync<ExecutionApiResponse>(cancellationToken);
        if (executionResponse is null)
        {
            throw new HttpRequestException("Execution API returned empty response.");
        }

        string normalizedResult = executionResponse.Result.Trim().ToUpperInvariant();
        bool passed = normalizedResult == "PASS";

        return new CodeExecutionResult
        {
            Passed = passed,
            DurationMs = executionResponse.DurationMs,
            Details = executionResponse.Details
        };
    }

    private sealed class ExecutionApiRequest
    {
        public string SubmittedCode { get; set; } = string.Empty;

        public string Language { get; set; } = string.Empty;

        public string? ValidationSpec { get; set; }
    }

    private sealed class ExecutionApiResponse
    {
        public string Result { get; set; } = "FAIL";

        public int DurationMs { get; set; }

        public string Details { get; set; } = string.Empty;
    }
}
