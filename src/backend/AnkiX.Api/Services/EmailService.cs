using Microsoft.Extensions.Logging;

namespace AnkiX.Api.Services;

public sealed class EmailService : IEmailService
{
    private readonly ILogger<EmailService> logger;

    public EmailService(ILogger<EmailService> logger)
    {
        this.logger = logger;
    }

    public Task SendPasswordResetEmailAsync(string recipientEmail, string resetToken, string resetUrl)
    {
        logger.LogInformation(
            "Sending Password Reset Email to {Email}. Reset URL: {ResetUrl}, Token: {Token}",
            recipientEmail,
            resetUrl,
            resetToken);

        // Note: For production email providers (SendGrid, Azure Communication Services, SMTP),
        // integration can be plugged in here or configured via environment settings.
        return Task.CompletedTask;
    }

    public Task SendEmailVerificationAsync(string recipientEmail, string verificationToken, string verificationUrl)
    {
        logger.LogInformation(
            "Sending Email Verification to {Email}. Verification URL: {VerificationUrl}, Token: {Token}",
            recipientEmail,
            verificationUrl,
            verificationToken);

        return Task.CompletedTask;
    }
}
