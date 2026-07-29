using AnkiX.Api.Services;

namespace AnkiX.Api.Tests;

public sealed class PasswordServiceTests
{
    private readonly PasswordService _sut = new();

    // ── HashPassword ──────────────────────────────────────────────────────────

    [Fact]
    public void HashPassword_ReturnsNonEmptyString()
    {
        var hash = _sut.HashPassword("Password123!");

        Assert.NotNull(hash);
        Assert.NotEmpty(hash);
    }

    [Fact]
    public void HashPassword_ContainsSaltAndHashSeparatedByColon()
    {
        var hash = _sut.HashPassword("Password123!");
        var parts = hash.Split(':');

        Assert.Equal(2, parts.Length);
        Assert.All(parts, p => Assert.NotEmpty(p));
    }

    [Fact]
    public void HashPassword_ProducesDifferentHashForSamePassword()
    {
        // Each call uses a fresh random salt
        var hash1 = _sut.HashPassword("Password123!");
        var hash2 = _sut.HashPassword("Password123!");

        Assert.NotEqual(hash1, hash2);
    }

    // ── VerifyPassword ────────────────────────────────────────────────────────

    [Fact]
    public void VerifyPassword_CorrectPassword_ReturnsTrue()
    {
        const string password = "MySecurePassword!";
        var hash = _sut.HashPassword(password);

        Assert.True(_sut.VerifyPassword(password, hash));
    }

    [Fact]
    public void VerifyPassword_WrongPassword_ReturnsFalse()
    {
        var hash = _sut.HashPassword("CorrectPassword");

        Assert.False(_sut.VerifyPassword("WrongPassword", hash));
    }

    [Fact]
    public void VerifyPassword_EmptyPassword_ReturnsFalse()
    {
        var hash = _sut.HashPassword("CorrectPassword");

        Assert.False(_sut.VerifyPassword("", hash));
    }

    [Fact]
    public void VerifyPassword_TamperedHash_ReturnsFalse()
    {
        var hash = _sut.HashPassword("Password123!");
        var tampered = hash[..^4] + "XXXX"; // corrupt last 4 chars

        Assert.False(_sut.VerifyPassword("Password123!", tampered));
    }

    [Fact]
    public void VerifyPassword_MalformedHash_ReturnsFalse()
    {
        // Hash with no colon separator should not crash — return false
        Assert.False(_sut.VerifyPassword("anything", "notavalidhash"));
    }

    [Fact]
    public void VerifyPassword_CaseSensitive_ReturnsFalse()
    {
        var hash = _sut.HashPassword("Password123!");

        Assert.False(_sut.VerifyPassword("password123!", hash)); // different case
    }
}
