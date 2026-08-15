namespace AnkiX.Api.Services;

public interface IEmailService
{
    Task SendPasswordResetEmailAsync(string recipientEmail, string resetToken, string resetUrl);
    Task SendEmailVerificationAsync(string recipientEmail, string verificationToken, string verificationUrl);
}
