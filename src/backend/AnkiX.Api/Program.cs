using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using AnkiX.Api.Data;
using AnkiX.Api.Models;
using AnkiX.Api.Options;
using AnkiX.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

// appsettings.Local.json is gitignored — use it for local DB credentials
// without touching the committed appsettings files.
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: false);

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));
builder.Services.Configure<ExecutionApiOptions>(builder.Configuration.GetSection(ExecutionApiOptions.SectionName));

// Connection string: prefer ANKIX_DB_CONN env var (for CI/CD, Supabase, and App Services),
// fall back to appsettings ConnectionStrings:DefaultConnection.
string? rawConnectionString =
    Environment.GetEnvironmentVariable("ANKIX_DB_CONN")
    ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
    ?? builder.Configuration.GetConnectionString("DefaultConnection");

string defaultConnectionString = NormalizePostgresConnectionString(rawConnectionString);

builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    options.UseNpgsql(defaultConnectionString, npgsqlOptions =>
    {
        npgsqlOptions.EnableRetryOnFailure(
            maxRetryCount: 5,
            maxRetryDelay: TimeSpan.FromSeconds(30),
            errorCodesToAdd: null);
    });
    options.ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
});

JwtOptions jwtOptions = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
string signingKeyRaw = !string.IsNullOrWhiteSpace(jwtOptions.SigningKey)
    ? jwtOptions.SigningKey
    : "AnkiX_Production_Default_SigningKey_987654321_Fallback_Secret_Key!";

SymmetricSecurityKey signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKeyRaw));


builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
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
builder.Services.AddHttpClient<IOAuthService, OAuthService>();
builder.Services.AddHttpClient<IEmailService, EmailService>();

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto;
});

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out TimeSpan retryAfter))
        {
            context.HttpContext.Response.Headers.RetryAfter = ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString();
        }
        else
        {
            context.HttpContext.Response.Headers.RetryAfter = "600";
        }
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            message = "Rate limit exceeded for code execution. Please wait before retrying, or sign in to unlock full quotas."
        }, cancellationToken: token);
    };

    options.AddPolicy("GuestExecutionPolicy", httpContext =>
    {
        if (httpContext.User.Identity?.IsAuthenticated == true)
        {
            string userId = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "auth_user";
            return RateLimitPartition.GetSlidingWindowLimiter(
                partitionKey: $"auth_{userId}",
                factory: _ => new SlidingWindowRateLimiterOptions
                {
                    PermitLimit = 60,
                    Window = TimeSpan.FromMinutes(10),
                    SegmentsPerWindow = 5,
                    QueueLimit = 0
                });
        }

        string clientIp = httpContext.Connection.RemoteIpAddress?.ToString()
            ?? httpContext.Request.Headers["X-Forwarded-For"].FirstOrDefault()?.Split(',')[0].Trim()
            ?? "unknown_guest";

        return RateLimitPartition.GetSlidingWindowLimiter(
            partitionKey: $"guest_{clientIp}",
            factory: _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(10),
                SegmentsPerWindow = 5,
                QueueLimit = 0
            });
    });
});

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

WebApplication app = builder.Build();

app.UseForwardedHeaders();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("FrontendPolicy");

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.MapControllers();

app.MapGet("/", () => Results.Ok(new { status = "online", service = "AnkiX API", version = "1.0.0" }));
app.MapGet("/api", () => Results.Ok(new { status = "online", service = "AnkiX API", version = "1.0.0" }));
app.MapGet("/healthz", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }));


// Always ensure the database schema is up to date on startup using EF Core Migrations.
try
{
    using var startupScope = app.Services.CreateScope();
    var startupDb = startupScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    startupDb.Database.Migrate();
}
catch (Exception ex)
{
    Console.WriteLine($"[Startup Warning] Database migration error: {ex.Message}");
}


// Seed data when invoked with the 'seed' argument: dotnet run -- seed
bool shouldSeed = (args is not null && args.Any(a => string.Equals(a, "seed", StringComparison.OrdinalIgnoreCase)))
    || string.Equals(Environment.GetEnvironmentVariable("ANKIX_SEED"), "true", StringComparison.OrdinalIgnoreCase);

if (shouldSeed)
{
    using var scope = app.Services.CreateScope();
    var services = scope.ServiceProvider;
    var db = services.GetRequiredService<ApplicationDbContext>();
    var pwdSvc = services.GetRequiredService<IPasswordService>();

    // Seed only if no users exist
    if (!db.Users.Any())
    {
        var hash = pwdSvc.HashPassword("password123");
        var adminUser = new User
        {
            Email = "admin@ankix.local",
            DisplayName = "Admin",
            PasswordHash = hash,
            Role = Roles.Admin,
            CreatedAt = DateTime.UtcNow
        };
        db.Users.Add(adminUser);
        db.SaveChanges();
        Console.WriteLine("Created default admin user (admin@ankix.local).");
    }

    Console.WriteLine("Seeding complete.");
    return;
}

app.Run();

static string NormalizePostgresConnectionString(string? connectionString)
{
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return "Host=localhost;Port=5432;Database=ankixdb;Username=postgres;Password=postgres;";
    }

    string trimmed = connectionString.Trim();
    if (trimmed.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) ||
        trimmed.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
    {
        try
        {
            var uri = new Uri(trimmed);
            var userInfo = uri.UserInfo.Split(':', 2);
            var username = userInfo.Length > 0 && !string.IsNullOrEmpty(userInfo[0]) ? Uri.UnescapeDataString(userInfo[0]) : "postgres";
            var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : string.Empty;
            var port = uri.Port > 0 ? uri.Port : 5432;
            var database = uri.AbsolutePath.TrimStart('/');
            if (string.IsNullOrEmpty(database)) database = "postgres";

            var builder = new Npgsql.NpgsqlConnectionStringBuilder
            {
                Host = uri.Host,
                Port = port,
                Database = database,
                Username = username,
                Password = password,
                SslMode = Npgsql.SslMode.Require
            };
            return builder.ConnectionString;
        }
        catch
        {
            return trimmed;
        }
    }

    return trimmed;
}
