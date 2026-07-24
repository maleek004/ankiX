using AnkiX.Api.Models;

namespace AnkiX.Api.Services;

public interface ITokenService
{
    string CreateToken(User user);

    int GetExpiresInSeconds();
}
