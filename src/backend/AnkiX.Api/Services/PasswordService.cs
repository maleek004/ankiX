using System.Security.Cryptography;

namespace AnkiX.Api.Services;

public sealed class PasswordService : IPasswordService
{
    private const int SaltSize = 16;
    private const int HashSize = 32;
    private const int Iterations = 100000;

    public string HashPassword(string password)
    {
        byte[] salt = RandomNumberGenerator.GetBytes(SaltSize);
        Rfc2898DeriveBytes deriveBytes = new Rfc2898DeriveBytes(password, salt, Iterations, HashAlgorithmName.SHA256);
        byte[] hash = deriveBytes.GetBytes(HashSize);
        string encodedSalt = Convert.ToBase64String(salt);
        string encodedHash = Convert.ToBase64String(hash);
        return $"{encodedSalt}:{encodedHash}";
    }

    public bool VerifyPassword(string password, string passwordHash)
    {
        string[] parts = passwordHash.Split(':', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 2)
        {
            return false;
        }

        byte[] salt = Convert.FromBase64String(parts[0]);
        byte[] expectedHash = Convert.FromBase64String(parts[1]);
        Rfc2898DeriveBytes deriveBytes = new Rfc2898DeriveBytes(password, salt, Iterations, HashAlgorithmName.SHA256);
        byte[] providedHash = deriveBytes.GetBytes(HashSize);
        return CryptographicOperations.FixedTimeEquals(expectedHash, providedHash);
    }
}
