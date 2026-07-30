using System.Text;
using AnkiX.Api.Data;
using AnkiX.Api.Models;
using AnkiX.Api.Options;
using AnkiX.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

// appsettings.Local.json is gitignored — use it for local DB credentials
// without touching the committed appsettings files.
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: false);

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));
builder.Services.Configure<ExecutionApiOptions>(builder.Configuration.GetSection(ExecutionApiOptions.SectionName));

// Connection string: prefer ANKIX_DB_CONN env var (for CI/CD and Azure App Service),
// fall back to appsettings ConnectionStrings:DefaultConnection.
string? defaultConnectionString =
    Environment.GetEnvironmentVariable("ANKIX_DB_CONN")
    ?? builder.Configuration.GetConnectionString("DefaultConnection");

if (string.IsNullOrWhiteSpace(defaultConnectionString))
{
    throw new InvalidOperationException(
        "Database connection string is required. " +
        "Set the ANKIX_DB_CONN environment variable or configure ConnectionStrings:DefaultConnection in appsettings.");
}

builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    options.UseSqlServer(defaultConnectionString, sqlOptions =>
    {
        sqlOptions.EnableRetryOnFailure(
            maxRetryCount: 5,
            maxRetryDelay: TimeSpan.FromSeconds(30),
            errorNumbersToAdd: null);
    });
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

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseCors("FrontendPolicy");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Always ensure the database schema is up to date on startup using EF Core Migrations.
using (var startupScope = app.Services.CreateScope())
{
    var startupDb = startupScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    startupDb.Database.Migrate();
    startupDb.Database.ExecuteSqlRaw(@"
        IF NOT EXISTS (
            SELECT * FROM sys.columns 
            WHERE object_id = OBJECT_ID(N'[dbo].[CardFollowups]') 
            AND name = N'LinkedCardIds'
        )
        BEGIN
            ALTER TABLE [CardFollowups] ADD [LinkedCardIds] NVARCHAR(500) NULL;
        END
    ");
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
            Title = "Algorithms & Data Structures",
            Description = "Micro-coding cards and hands-on algorithm challenges",
            CreatedAt = DateTime.UtcNow
        };
        db.Decks.Add(deck);
        db.SaveChanges();

        db.Cards.AddRange(new[] {
            new Card { DeckId = deck.Id, Type = "basic", Prompt = "What is the time complexity of Binary Search?", ValidationSpec = "{\"answer\":\"O(log n)\"}", CreatedAt = DateTime.UtcNow },
            new Card { DeckId = deck.Id, Type = "micro-coding", Prompt = "Write a C# method that reverses a string in-place.", ValidationSpec = "{\"answer\":\"Reverse\"}", CreatedAt = DateTime.UtcNow },
            new Card { DeckId = deck.Id, Type = "micro-coding", Prompt = "Write a Python function for Two Sum problem.", ValidationSpec = "{\"answer\":\"seen\"}", CreatedAt = DateTime.UtcNow }
        });
        db.SaveChanges();
    }

    // Always re-seed exercises when seed argument is passed to ensure clean basic coding challenges
    if (db.CardExercises.Any()) db.CardExercises.RemoveRange(db.CardExercises);
    if (db.ExerciseReviewRecords.Any()) db.ExerciseReviewRecords.RemoveRange(db.ExerciseReviewRecords);
    if (db.Exercises.Any()) db.Exercises.RemoveRange(db.Exercises);
    db.SaveChanges();

    {
        var ex1 = new Exercise
        {
            Title = "Check Even Number in Python",
            Language = "python",
            Description = "Write a function is_even(n) that returns True if integer n is even, and False if n is odd.",
            StarterCode = "def is_even(n):\n    # Write your solution here\n    pass",
            SolutionCode = "def is_even(n):\n    return n % 2 == 0",
            TestCasesSpec = "# Unit Tests\nif __name__ == '__main__':\n    assert is_even(4) is True, f'Expected True for 4, got {is_even(4)!r}'\n    assert is_even(7) is False, f'Expected False for 7, got {is_even(7)!r}'\n    assert is_even(0) is True, f'Expected True for 0, got {is_even(0)!r}'\n    print('✓ All Unit Tests Passed!')",
            CreatedAt = DateTime.UtcNow
        };

        var ex2 = new Exercise
        {
            Title = "Reverse String in Python",
            Language = "python",
            Description = "Write a function reverse_string(s) that takes a string s and returns the reversed string.",
            StarterCode = "def reverse_string(s):\n    # Write your solution here\n    pass",
            SolutionCode = "def reverse_string(s):\n    return s[::-1]",
            TestCasesSpec = "# Unit Tests\nif __name__ == '__main__':\n    assert reverse_string('hello') == 'olleh', f'Expected olleh, got {reverse_string(\"hello\")!r}'\n    assert reverse_string('Python') == 'nohtyP', f'Expected nohtyP, got {reverse_string(\"Python\")!r}'\n    print('✓ All Unit Tests Passed!')",
            CreatedAt = DateTime.UtcNow
        };

        var ex3 = new Exercise
        {
            Title = "Add Two Numbers in JavaScript",
            Language = "javascript",
            Description = "Write a function addNumbers(a, b) that takes two numbers and returns their sum.",
            StarterCode = "function addNumbers(a, b) {\n  // Write your solution here\n}",
            SolutionCode = "function addNumbers(a, b) {\n  return a + b;\n}",
            TestCasesSpec = "// Unit Tests\ntry {\n  if (addNumbers(2, 3) !== 5) throw new Error(`Expected 5, got ${addNumbers(2, 3)}`);\n  if (addNumbers(-1, 1) !== 0) throw new Error(`Expected 0, got ${addNumbers(-1, 1)}`);\n  console.log('✓ All Unit Tests Passed!');\n} catch(e) { console.error('Assertion Error:', e.message); process.exit(1); }",
            CreatedAt = DateTime.UtcNow
        };

        var ex4 = new Exercise
        {
            Title = "Find Maximum in Array (JavaScript)",
            Language = "javascript",
            Description = "Write a function getMax(numbers) that returns the maximum number in an array of numbers.",
            StarterCode = "function getMax(numbers) {\n  // Write your solution here\n}",
            SolutionCode = "function getMax(numbers) {\n  return Math.max(...numbers);\n}",
            TestCasesSpec = "// Unit Tests\ntry {\n  if (getMax([1, 5, 3, 9, 2]) !== 9) throw new Error(`Expected 9, got ${getMax([1, 5, 3, 9, 2])}`);\n  if (getMax([-10, -3, -5]) !== -3) throw new Error(`Expected -3, got ${getMax([-10, -3, -5])}`);\n  console.log('✓ All Unit Tests Passed!');\n} catch(e) { console.error('Assertion Error:', e.message); process.exit(1); }",
            CreatedAt = DateTime.UtcNow
        };

        var ex5 = new Exercise
        {
            Title = "Calculate Square in Go",
            Language = "go",
            Description = "Write a Go function Square(n int) int that returns the square of an integer n.",
            StarterCode = "package main\n\nfunc Square(n int) int {\n    // Write your solution here\n    return 0\n}",
            SolutionCode = "package main\n\nfunc Square(n int) int {\n    return n * n\n}",
            TestCasesSpec = "import \"fmt\"\n\nfunc main() {\n    if Square(4) != 16 { panic(fmt.Sprintf(\"Expected 16, got %d\", Square(4))) }\n    if Square(-3) != 9 { panic(fmt.Sprintf(\"Expected 9, got %d\", Square(-3))) }\n    fmt.Println(\"✓ All Unit Tests Passed!\")\n}",
            CreatedAt = DateTime.UtcNow
        };

        db.Exercises.AddRange(ex1, ex2, ex3, ex4, ex5);
        db.SaveChanges();

        // Link seeded cards to exercises
        var microCard1 = db.Cards.FirstOrDefault(c => c.Type == "micro-coding" && c.Prompt.Contains("C#"));
        var microCard2 = db.Cards.FirstOrDefault(c => c.Type == "micro-coding" && c.Prompt.Contains("Python"));

        if (microCard1 != null) db.CardExercises.Add(new CardExercise { CardId = microCard1.Id, ExerciseId = ex2.Id });
        if (microCard2 != null) db.CardExercises.Add(new CardExercise { CardId = microCard2.Id, ExerciseId = ex1.Id });
        db.SaveChanges();
    }

    db.SaveChanges();
    Console.WriteLine("Seeding complete.");
    return;
}

app.Run();
