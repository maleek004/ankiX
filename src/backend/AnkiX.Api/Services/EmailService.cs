using System.Net;
using System.Net.Http.Headers;
using System.Net.Mail;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AnkiX.Api.Services;

public sealed class EmailService : IEmailService
{
    private readonly ILogger<EmailService> logger;
    private readonly IConfiguration? configuration;
    private readonly HttpClient? httpClient;

    public EmailService(
        ILogger<EmailService> logger,
        IConfiguration? configuration = null,
        HttpClient? httpClient = null)
    {
        this.logger = logger;
        this.configuration = configuration;
        this.httpClient = httpClient;
    }

    public async Task SendPasswordResetEmailAsync(string recipientEmail, string resetToken, string resetUrl)
    {
        string subject = "AnkiX — Password Reset Request";
        string htmlBody = $@"
            <div style=""font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;"">
                <h2 style=""color: #2563eb; margin-top: 0;"">AnkiX Password Reset</h2>
                <p>Hello,</p>
                <p>We received a request to reset the password for your AnkiX account. Click the button below to set a new password:</p>
                <div style=""margin: 24px 0;"">
                    <a href=""{resetUrl}"" style=""background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;"">Reset My Password</a>
                </div>
                <p style=""color: #64748b; font-size: 0.875rem;"">This link is single-use and will expire in <strong>15 minutes</strong>.</p>
                <p style=""color: #64748b; font-size: 0.875rem;"">If you did not request this password reset, you can safely ignore this email.</p>
                <hr style=""border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;"" />
                <p style=""color: #94a3b8; font-size: 0.75rem;"">If the button doesn't work, copy and paste this link into your browser:<br /><a href=""{resetUrl}"" style=""color: #2563eb;"">{resetUrl}</a></p>
            </div>";

        await SendEmailAsync(recipientEmail, subject, htmlBody, resetUrl, "Password Reset");
    }

    public async Task SendEmailVerificationAsync(string recipientEmail, string verificationToken, string verificationUrl)
    {
        string subject = "AnkiX — Verify Your Email Address";
        string htmlBody = $@"
            <div style=""font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;"">
                <h2 style=""color: #2563eb; margin-top: 0;"">Welcome to AnkiX!</h2>
                <p>Thank you for creating an account with AnkiX. Please verify your email address to confirm your registration:</p>
                <div style=""margin: 24px 0;"">
                    <a href=""{verificationUrl}"" style=""background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;"">Verify Email Address</a>
                </div>
                <p style=""color: #64748b; font-size: 0.875rem;"">This verification link is valid for <strong>24 hours</strong>.</p>
                <hr style=""border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;"" />
                <p style=""color: #94a3b8; font-size: 0.75rem;"">If the button doesn't work, copy and paste this link into your browser:<br /><a href=""{verificationUrl}"" style=""color: #2563eb;"">{verificationUrl}</a></p>
            </div>";

        await SendEmailAsync(recipientEmail, subject, htmlBody, verificationUrl, "Email Verification");
    }

    public async Task SendStudyGroupInvitationAsync(string recipientEmail, string groupName, string inviterDisplayName, string groupUrl)
    {
        string subject = $"AnkiX — You've been invited to join '{groupName}'";
        string htmlBody = $@"
            <div style=""font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;"">
                <h2 style=""color: #2563eb; margin-top: 0;"">You're Invited!</h2>
                <p>Hello,</p>
                <p><strong>{inviterDisplayName}</strong> has invited you to join the private study group <strong>{groupName}</strong> on AnkiX.</p>
                <div style=""margin: 24px 0;"">
                    <a href=""{groupUrl}"" style=""background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;"">View & Accept Invitation</a>
                </div>
                <p style=""color: #64748b; font-size: 0.875rem;"">Log in to AnkiX and accept the invitation to access this study group's decks, cards, and exercises.</p>
                <hr style=""border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;"" />
                <p style=""color: #94a3b8; font-size: 0.75rem;"">If the button doesn't work, visit your Study Groups dashboard at:<br /><a href=""{groupUrl}"" style=""color: #2563eb;"">{groupUrl}</a></p>
            </div>";

        await SendEmailAsync(recipientEmail, subject, htmlBody, groupUrl, "Study Group Invitation");
    }

    private async Task SendEmailAsync(string recipientEmail, string subject, string htmlBody, string actionUrl, string flowType)
    {
        string resendApiKey = Environment.GetEnvironmentVariable("RESEND_API_KEY") 
            ?? configuration?["EmailSettings:ResendApiKey"] 
            ?? string.Empty;

        string fromEmail = Environment.GetEnvironmentVariable("EMAIL_FROM") 
            ?? configuration?["EmailSettings:FromEmail"] 
            ?? "AnkiX <onboarding@resend.dev>";

        // 1. If Resend API Key is provided, use Resend HTTP API
        if (!string.IsNullOrWhiteSpace(resendApiKey) && httpClient is not null)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", resendApiKey);

                var payload = new
                {
                    from = fromEmail,
                    to = new[] { recipientEmail },
                    subject = subject,
                    html = htmlBody
                };

                request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                var response = await httpClient.SendAsync(request);

                if (response.IsSuccessStatusCode)
                {
                    logger.LogInformation("Successfully dispatched {FlowType} email to {Email} via Resend API", flowType, recipientEmail);
                    return;
                }
                else
                {
                    string errContent = await response.Content.ReadAsStringAsync();
                    logger.LogWarning("Resend API returned status {StatusCode}: {Error}. Falling back to logging.", response.StatusCode, errContent);
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to send email via Resend API. Falling back to logging.");
            }
        }

        // 2. If SMTP configuration is provided, dispatch via SMTP
        string smtpHost = Environment.GetEnvironmentVariable("SMTP_HOST") ?? configuration?["EmailSettings:SmtpHost"] ?? string.Empty;
        if (!string.IsNullOrWhiteSpace(smtpHost))
        {
            try
            {
                int smtpPort = int.TryParse(Environment.GetEnvironmentVariable("SMTP_PORT") ?? configuration?["EmailSettings:SmtpPort"], out int p) ? p : 587;
                string smtpUser = Environment.GetEnvironmentVariable("SMTP_USER") ?? configuration?["EmailSettings:SmtpUser"] ?? string.Empty;
                string smtpPass = Environment.GetEnvironmentVariable("SMTP_PASS") ?? configuration?["EmailSettings:SmtpPass"] ?? string.Empty;

                using var smtpClient = new SmtpClient(smtpHost, smtpPort)
                {
                    EnableSsl = true,
                    Credentials = new NetworkCredential(smtpUser, smtpPass)
                };

                using var mailMessage = new MailMessage
                {
                    From = new MailAddress(fromEmail),
                    Subject = subject,
                    Body = htmlBody,
                    IsBodyHtml = true
                };
                mailMessage.To.Add(recipientEmail);

                await smtpClient.SendMailAsync(mailMessage);
                logger.LogInformation("Successfully sent {FlowType} email to {Email} via SMTP ({Host})", flowType, recipientEmail, smtpHost);
                return;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to send email via SMTP. Falling back to logging.");
            }
        }

        // 3. Fallback: Log action URL for dev / staging / preview
        logger.LogInformation(
            "[{FlowType}] Dispatched for {Email}. Action URL: {ActionUrl}",
            flowType,
            recipientEmail,
            actionUrl);
    }
}
