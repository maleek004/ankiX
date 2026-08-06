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
    options.ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
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
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

WebApplication app = builder.Build();

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

        IF OBJECT_ID(N'[dbo].[UserExercises]', N'U') IS NULL
        BEGIN
            CREATE TABLE [dbo].[UserExercises] (
                [UserId] INT NOT NULL,
                [ExerciseId] INT NOT NULL,
                [EnrolledAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                CONSTRAINT [PK_UserExercises] PRIMARY KEY CLUSTERED ([UserId] ASC, [ExerciseId] ASC)
            );
        END

        IF OBJECT_ID(N'[dbo].[Communities]', N'U') IS NULL
        BEGIN
            CREATE TABLE [dbo].[Communities] (
                [Id] INT IDENTITY(1,1) NOT NULL,
                [Name] NVARCHAR(100) NOT NULL,
                [Slug] NVARCHAR(100) NOT NULL,
                [Description] NVARCHAR(2000) NULL,
                [AvatarUrl] NVARCHAR(500) NULL,
                [IsPublic] BIT NOT NULL DEFAULT 1,
                [CreatedByUserId] INT NOT NULL DEFAULT 1,
                [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                CONSTRAINT [PK_Communities] PRIMARY KEY CLUSTERED ([Id] ASC)
            );
            CREATE UNIQUE NONCLUSTERED INDEX [IX_Communities_Slug] ON [dbo].[Communities] ([Slug] ASC);
        END

        IF OBJECT_ID(N'[dbo].[CommunityMembers]', N'U') IS NULL
        BEGIN
            CREATE TABLE [dbo].[CommunityMembers] (
                [CommunityId] INT NOT NULL,
                [UserId] INT NOT NULL,
                [Role] NVARCHAR(20) NOT NULL DEFAULT 'Member',
                [JoinedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                CONSTRAINT [PK_CommunityMembers] PRIMARY KEY CLUSTERED ([CommunityId] ASC, [UserId] ASC)
            );
        END

        IF NOT EXISTS (
            SELECT * FROM sys.columns 
            WHERE object_id = OBJECT_ID(N'[dbo].[Decks]') 
            AND name = N'CommunityId'
        )
        BEGIN
            ALTER TABLE [Decks] ADD [CommunityId] INT NULL;
        END

        IF NOT EXISTS (
            SELECT * FROM sys.columns 
            WHERE object_id = OBJECT_ID(N'[dbo].[Exercises]') 
            AND name = N'CommunityId'
        )
        BEGIN
            ALTER TABLE [Exercises] ADD [CommunityId] INT NULL;
        END

        IF NOT EXISTS (
            SELECT * FROM sys.columns 
            WHERE object_id = OBJECT_ID(N'[dbo].[Exercises]') 
            AND name = N'ExerciseType'
        )
        BEGIN
            ALTER TABLE [Exercises] ADD [ExerciseType] NVARCHAR(50) NOT NULL DEFAULT 'CodeExecution';
            ALTER TABLE [Exercises] ADD [ExerciseSpec] NVARCHAR(MAX) NULL;
        END

        -- Ensure sample community exists and backfill any unassigned decks or exercises
        IF NOT EXISTS (SELECT 1 FROM [Communities] WHERE [Slug] = 'sample')
        BEGIN
            INSERT INTO [Communities] ([Name], [Slug], [Description], [IsPublic], [CreatedByUserId], [CreatedAt])
            VALUES ('Sample Community', 'sample', 'Official AnkiX Sample Community containing starter decks, flashcards, and multi-modal exercises.', 1, 1, GETUTCDATE());
        END

        UPDATE [Decks] SET [CommunityId] = (SELECT TOP 1 [Id] FROM [Communities] WHERE [Slug] = 'sample') WHERE [CommunityId] IS NULL;
        UPDATE [Exercises] SET [CommunityId] = (SELECT TOP 1 [Id] FROM [Communities] WHERE [Slug] = 'sample') WHERE [CommunityId] IS NULL;
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
    }

    var sampleComm = db.Communities.FirstOrDefault(c => c.Slug == "sample");
    if (sampleComm == null)
    {
        sampleComm = new Community
        {
            Name = "Sample Community",
            Slug = "sample",
            Description = "Official AnkiX Sample Community containing starter decks, flashcards, and multi-modal exercises.",
            IsPublic = true,
            CreatedByUserId = 1,
            CreatedAt = DateTime.UtcNow
        };
        db.Communities.Add(sampleComm);
        db.SaveChanges();
    }

    var globalComm = db.Communities.FirstOrDefault(c => c.Slug == "global");
    if (globalComm == null)
    {
        globalComm = new Community
        {
            Name = "Global Learning Commons",
            Slug = "global",
            Description = "The default public community for all AnkiX flashcards and coding challenges.",
            IsPublic = true,
            CreatedByUserId = 1,
            CreatedAt = DateTime.UtcNow
        };
        db.Communities.Add(globalComm);
        db.SaveChanges();
    }

    var seComm = db.Communities.FirstOrDefault(c => c.Slug == "software-engineering");
    if (seComm == null)
    {
        seComm = new Community
        {
            Name = "Software Engineering & Paradigms",
            Slug = "software-engineering",
            Description = "Master OOP, Design Patterns, SOLID principles, and multi-language programming.",
            IsPublic = true,
            CreatedByUserId = 1,
            CreatedAt = DateTime.UtcNow
        };
        db.Communities.Add(seComm);
        db.SaveChanges();
    }

    if (!db.Decks.Any())
    {
        var deck = new Deck
        {
            Title = "Algorithms & Data Structures",
            Description = "Micro-coding cards and hands-on algorithm challenges",
            CommunityId = sampleComm.Id,
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
            CommunityId = sampleComm.Id,
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
            CommunityId = sampleComm.Id,
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
            CommunityId = sampleComm.Id,
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
            CommunityId = sampleComm.Id,
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
            CommunityId = sampleComm.Id,
            CreatedAt = DateTime.UtcNow
        };

        // Multi-Modal Sample Exercises (OOP, Interfaces, Polymorphism, Paradigms)
        var ex6 = new Exercise
        {
            Title = "Polymorphism Concept Check in C#",
            Language = "csharp",
            ExerciseType = "MultipleChoice",
            Description = "Which C# keyword is required on a base class method to allow a derived class to override its implementation polymorphically?",
            ExerciseSpec = "{\"options\":[\"override\",\"virtual\",\"abstract\",\"static\"],\"correctIndex\":1}",
            CommunityId = sampleComm.Id,
            CreatedAt = DateTime.UtcNow
        };

        var ex7 = new Exercise
        {
            Title = "Interface vs Abstract Class Principle",
            Language = "csharp",
            ExerciseType = "MultipleChoice",
            Description = "In Object-Oriented software architecture, what key capability does an Interface provide that a single C# base class does NOT?",
            ExerciseSpec = "{\"options\":[\"Multiple inheritance of contracts / capabilities\",\"Private state encapsulation\",\"Constructors with parameters\",\"Static property storage\"],\"correctIndex\":0}",
            CommunityId = sampleComm.Id,
            CreatedAt = DateTime.UtcNow
        };

        var ex8 = new Exercise
        {
            Title = "Encapsulation & Data Hiding in OOP",
            Language = "python",
            ExerciseType = "MultipleChoice",
            Description = "What is the primary objective of Encapsulation in Object-Oriented Programming?",
            ExerciseSpec = "{\"options\":[\"Allowing child classes to inherit parent methods\",\"Bundling data with methods and restricting direct access to internal state\",\"Executing different code paths based on dynamic method signatures\",\"Ensuring functions have no side effects\"],\"correctIndex\":1}",
            CommunityId = sampleComm.Id,
            CreatedAt = DateTime.UtcNow
        };

        var ex9 = new Exercise
        {
            Title = "OOP Pillar: Hiding Complexity",
            Language = "csharp",
            ExerciseType = "ExactString",
            Description = "Which pillar of Object-Oriented Programming refers to hiding internal implementation complexity and exposing only essential interfaces?",
            ExerciseSpec = "{\"acceptedAnswers\":[\"Abstraction\",\"abstraction\"],\"caseSensitive\":false}",
            CommunityId = sampleComm.Id,
            CreatedAt = DateTime.UtcNow
        };

        var ex10 = new Exercise
        {
            Title = "SOLID Principles: 'L' Acronym",
            Language = "python",
            ExerciseType = "ExactString",
            Description = "In the SOLID principles of Object-Oriented Design, what principle does the letter 'L' represent?",
            ExerciseSpec = "{\"acceptedAnswers\":[\"Liskov\",\"Liskov Substitution\",\"Liskov substitution\"],\"caseSensitive\":false}",
            CommunityId = sampleComm.Id,
            CreatedAt = DateTime.UtcNow
        };

        var ex11 = new Exercise
        {
            Title = "Programming Paradigm: Immutable State",
            Language = "javascript",
            ExerciseType = "ExactString",
            Description = "What programming term describes data structures or objects whose state CANNOT be modified after creation?",
            ExerciseSpec = "{\"acceptedAnswers\":[\"Immutable\",\"immutability\",\"immutable\"],\"caseSensitive\":false}",
            CommunityId = sampleComm.Id,
            CreatedAt = DateTime.UtcNow
        };

        db.Exercises.AddRange(ex1, ex2, ex3, ex4, ex5, ex6, ex7, ex8, ex9, ex10, ex11);
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
