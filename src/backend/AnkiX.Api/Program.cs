using System.Text;
using AnkiX.Api.Data;
using AnkiX.Api.Models;
using AnkiX.Api.Options;
using AnkiX.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));
builder.Services.Configure<ExecutionApiOptions>(builder.Configuration.GetSection(ExecutionApiOptions.SectionName));

string? defaultConnectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(defaultConnectionString))
{
    throw new InvalidOperationException("Connection string 'DefaultConnection' is required.");
}

builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    options.UseSqlServer(defaultConnectionString);
});

JwtOptions jwtOptions = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
if (string.IsNullOrWhiteSpace(jwtOptions.SigningKey))
{
    throw new InvalidOperationException("Jwt:SigningKey must be configured.");
}

SymmetricSecurityKey signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey));

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = signingKey,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddHttpClient<ICodeExecutionService, CodeExecutionService>();
builder.Services.AddScoped<IPasswordService, PasswordService>();
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IReviewSchedulerService, ReviewSchedulerService>();

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

WebApplication app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors("FrontendPolicy");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Seed data when invoked with the 'seed' argument: dotnet run -- seed
bool shouldSeed = (args is not null && args.Any(a => string.Equals(a, "seed", StringComparison.OrdinalIgnoreCase)))
    || string.Equals(Environment.GetEnvironmentVariable("ANKIX_SEED"), "true", StringComparison.OrdinalIgnoreCase);

if (shouldSeed)
{
    using var scope = app.Services.CreateScope();
    var services = scope.ServiceProvider;
    var db = services.GetRequiredService<ApplicationDbContext>();
    var pwdSvc = services.GetRequiredService<IPasswordService>();

    // Ensure DB is available
    db.Database.EnsureCreated();

    // Seed only if no users exist
    if (!db.Users.Any())
    {
        var hash = pwdSvc.HashPassword("password123");
        db.Users.Add(new User
        {
            Email = "admin@ankix.local",
            DisplayName = "Admin",
            PasswordHash = hash,
            Role = Roles.Admin,
            CreatedAt = DateTime.UtcNow
        });
    }

    if (!db.Decks.Any())
    {
        var deck = new Deck
        {
            Title = "Sample Deck",
            Description = "Automated seed deck",
            CreatedAt = DateTime.UtcNow
        };
        db.Decks.Add(deck);
        db.SaveChanges();

        db.Cards.AddRange(new[] {
            new Card { DeckId = deck.Id, Type = "basic", Prompt = "What is 2+2?", ValidationSpec = "{\"answer\":\"4\"}", CreatedAt = DateTime.UtcNow },
            new Card { DeckId = deck.Id, Type = "basic", Prompt = "What is the capital of France?", ValidationSpec = "{\"answer\":\"Paris\"}", CreatedAt = DateTime.UtcNow }
        });
    }

    db.SaveChanges();
    Console.WriteLine("Seeding complete.");
    return;
}

app.Run();
