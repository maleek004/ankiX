using System.Security.Cryptography;
using System.Data.SqlClient;

if (args.Length < 2)
{
    Console.Error.WriteLine("Usage: update-password <connection-string> <email> [newPassword]");
    return 2;
}

string conn = args[0];
string email = args[1];
string newPassword = args.Length >= 3 ? args[2] : "password123";

// PBKDF2 parameters matching PasswordService
const int SaltSize = 16;
const int HashSize = 32;
const int Iterations = 100000;

byte[] salt = RandomNumberGenerator.GetBytes(SaltSize);
using var derive = new Rfc2898DeriveBytes(newPassword, salt, Iterations, HashAlgorithmName.SHA256);
byte[] hash = derive.GetBytes(HashSize);
string encodedSalt = Convert.ToBase64String(salt);
string encodedHash = Convert.ToBase64String(hash);
string stored = $"{encodedSalt}:{encodedHash}";

using var sql = new SqlConnection(conn);
await sql.OpenAsync();
var cmd = new SqlCommand("UPDATE [Users] SET [PasswordHash] = @ph WHERE [Email] = @e", sql);
cmd.Parameters.AddWithValue("@ph", stored);
cmd.Parameters.AddWithValue("@e", email.ToLowerInvariant());
int affected = await cmd.ExecuteNonQueryAsync();
if (affected == 0)
{
    Console.Error.WriteLine("No user updated. Ensure the email matches and user exists.");
    return 3;
}
Console.WriteLine($"Password updated for {email} (rows affected: {affected}).");
return 0;
