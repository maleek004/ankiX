using System.ComponentModel.DataAnnotations;

namespace AnkiX.Api.Contracts.Auth;

public sealed class ForgotPasswordRequest
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;
}

public sealed class ResetPasswordRequest
{
    [Required]
    public string Token { get; set; } = string.Empty;

    [Required]
    [MinLength(8)]
    public string NewPassword { get; set; } = string.Empty;
}

public sealed class VerifyResetTokenRequest
{
    [Required]
    public string Token { get; set; } = string.Empty;
}

public sealed class SendVerificationRequest
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;
}

public sealed class VerifyEmailRequest
{
    [Required]
    public string Token { get; set; } = string.Empty;
}
