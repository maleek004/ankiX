using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AnkiX.Api.Models;
using AnkiX.Api.Options;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace AnkiX.Api.Services;

public sealed class TokenService : ITokenService
{
    private readonly JwtOptions jwtOptions;

    public TokenService(IOptions<JwtOptions> jwtOptions)
    {
        this.jwtOptions = jwtOptions.Value;
    }

    public string CreateToken(User user)
    {
        byte[] signingKeyBytes = Encoding.UTF8.GetBytes(jwtOptions.SigningKey);
        SymmetricSecurityKey signingKey = new SymmetricSecurityKey(signingKeyBytes);
        SigningCredentials credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

        List<Claim> claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role)
        };

        DateTime expiresAt = DateTime.UtcNow.AddMinutes(jwtOptions.ExpiresInMinutes);
        JwtSecurityToken token = new JwtSecurityToken(
            issuer: jwtOptions.Issuer,
            audience: jwtOptions.Audience,
            claims: claims,
            expires: expiresAt,
            signingCredentials: credentials
        );

        JwtSecurityTokenHandler handler = new JwtSecurityTokenHandler();
        return handler.WriteToken(token);
    }

    public int GetExpiresInSeconds()
    {
        return jwtOptions.ExpiresInMinutes * 60;
    }
}
