using AnkiX.Api.Models;

namespace AnkiX.Api.Services;

public interface ITokenService
{
    string CreateToken(User user);

    int GetExpiresInSeconds();

    string GenerateRefreshToken();

    string HashToken(string token);

    int GetRefreshTokenExpiresInDays();
}
