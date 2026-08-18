using System.Net.Mail;
using System.Text.RegularExpressions;

namespace AnkiX.Api.Helpers;

public static class EmailValidator
{
    private static readonly Regex EmailRegex = new(
        @"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public static bool IsValid(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return false;
        }

        string trimmed = email.Trim();
        if (trimmed.Length > 254 || !EmailRegex.IsMatch(trimmed))
        {
            return false;
        }

        try
        {
            MailAddress mailAddress = new MailAddress(trimmed);
            string host = mailAddress.Host;
            if (!host.Contains('.') || host.EndsWith('.'))
            {
                return false;
            }

            string[] parts = host.Split('.');
            if (parts.Any(p => string.IsNullOrWhiteSpace(p)) || parts.Last().Length < 2)
            {
                return false;
            }

            return true;
        }
        catch
        {
            return false;
        }
    }
}
