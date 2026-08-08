namespace AnkiX.Api.Helpers;

public static class UserHelper
{
    public static string GetEffectiveDisplayName(string? displayName, string? email)
    {
        if (!string.IsNullOrWhiteSpace(displayName))
        {
            string trimmed = displayName.Trim();
            if (trimmed.Contains('@') && !trimmed.Contains(' '))
            {
                return trimmed.Split('@')[0];
            }
            return trimmed;
        }

        if (!string.IsNullOrWhiteSpace(email))
        {
            string trimmedEmail = email.Trim();
            return trimmedEmail.Contains('@') ? trimmedEmail.Split('@')[0] : trimmedEmail;
        }

        return "User";
    }
}
