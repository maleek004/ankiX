using System.Security.Claims;
using AnkiX.Api.Contracts.Content;
using AnkiX.Api.Data;
using AnkiX.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using AnkiX.Api.Contracts.Study;
using AnkiX.Api.Services;

namespace AnkiX.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/exercises")]
public sealed class ExercisesController : ControllerBase
{
    private readonly ApplicationDbContext dbContext;
    private readonly ICodeExecutionService codeExecutionService;
    private readonly IReviewSchedulerService reviewSchedulerService;

    public ExercisesController(
        ApplicationDbContext dbContext,
        ICodeExecutionService codeExecutionService,
        IReviewSchedulerService reviewSchedulerService)
    {
        this.dbContext = dbContext;
        this.codeExecutionService = codeExecutionService;
        this.reviewSchedulerService = reviewSchedulerService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ExerciseResponse>>> GetExercises([FromQuery] string? language = null, [FromQuery] int? communityId = null)
    {
        IQueryable<Exercise> query = dbContext.Exercises.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(language))
        {
            string normLang = language.Trim().ToLowerInvariant();
            query = query.Where(e => e.Language.ToLower() == normLang);
        }

        if (communityId.HasValue)
        {
            query = query.Where(e => e.CommunityId == communityId.Value);
        }

        var rawExercises = await query
            .Select(e => new
            {
                e.Id,
                e.Title,
                e.Description,
                e.Language,
                e.ExerciseType,
                e.ExerciseSpec,
                e.CreatedByUserId,
                e.CreatedAt,
                LinkedCardsCount = dbContext.CardExercises.Count(ce => ce.ExerciseId == e.Id),
                AverageEaseFactor = dbContext.ExerciseReviewRecords
                    .Where(r => r.ExerciseId == e.Id)
                    .Select(r => (double?)r.EaseFactor)
                    .Average() ?? 2.50,
                TotalReviewsCount = dbContext.ExerciseReviewRecords
                    .Count(r => r.ExerciseId == e.Id)
            })
            .ToListAsync();

        var exercises = rawExercises
            .OrderByDescending(e => e.AverageEaseFactor) // Easiest first (highest EaseFactor), up until hardest (lowest EaseFactor)
            .ThenByDescending(e => e.CreatedAt)
            .Select(e => new ExerciseResponse
            {
                Id = e.Id,
                Title = e.Title,
                Description = e.Description,
                Language = e.Language,
                ExerciseType = e.ExerciseType ?? "CodeExecution",
                ExerciseSpec = e.ExerciseSpec,
                CreatedByUserId = e.CreatedByUserId,
                CreatedAt = e.CreatedAt,
                LinkedCardsCount = e.LinkedCardsCount,
                AverageEaseFactor = Math.Round(e.AverageEaseFactor, 2),
                TotalReviewsCount = e.TotalReviewsCount
            })
            .ToList();

        return Ok(exercises);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ExerciseDetailResponse>> GetExercise([FromRoute] int id)
    {
        Exercise? exercise = await dbContext.Exercises
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == id);

        if (exercise is null)
        {
            return NotFound(new { message = "Exercise not found." });
        }

        return Ok(new ExerciseDetailResponse
        {
            Id = exercise.Id,
            Title = exercise.Title,
            Description = exercise.Description,
            Language = exercise.Language,
            ExerciseType = exercise.ExerciseType ?? "CodeExecution",
            ExerciseSpec = exercise.ExerciseSpec,
            StarterCode = exercise.StarterCode,
            SolutionCode = exercise.SolutionCode,
            TestCasesSpec = exercise.TestCasesSpec,
            CreatedByUserId = exercise.CreatedByUserId,
            CreatedAt = exercise.CreatedAt
        });
    }

    [HttpPost]
    [Authorize(Roles = $"{Roles.Contributor},{Roles.Admin}")]
    public async Task<ActionResult<ExerciseDetailResponse>> CreateExercise([FromBody] CreateExerciseRequest request)
    {
        int? userId = null;
        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (int.TryParse(userIdClaim, out int parsedId))
        {
            userId = parsedId;
        }

        Exercise exercise = new Exercise
        {
            Title = request.Title.Trim(),
            Description = request.Description,
            Language = request.Language.Trim().ToLowerInvariant(),
            ExerciseType = !string.IsNullOrWhiteSpace(request.ExerciseType) ? request.ExerciseType.Trim() : "CodeExecution",
            ExerciseSpec = request.ExerciseSpec,
            StarterCode = request.StarterCode,
            SolutionCode = request.SolutionCode,
            TestCasesSpec = request.TestCasesSpec,
            CreatedByUserId = userId,
            CommunityId = request.CommunityId,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.Exercises.Add(exercise);
        await dbContext.SaveChangesAsync();

        ExerciseDetailResponse response = new ExerciseDetailResponse
        {
            Id = exercise.Id,
            Title = exercise.Title,
            Description = exercise.Description,
            Language = exercise.Language,
            StarterCode = exercise.StarterCode,
            SolutionCode = exercise.SolutionCode,
            TestCasesSpec = exercise.TestCasesSpec,
            CreatedByUserId = exercise.CreatedByUserId,
            CreatedAt = exercise.CreatedAt
        };

        return CreatedAtAction(nameof(GetExercise), new { id = exercise.Id }, response);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> UpdateExercise([FromRoute] int id, [FromBody] UpdateExerciseRequest request)
    {
        Exercise? exercise = await dbContext.Exercises.FirstOrDefaultAsync(e => e.Id == id);
        if (exercise is null)
        {
            return NotFound(new { message = "Exercise not found." });
        }

        string language = request.Language.Trim().ToLowerInvariant();
        if (language is not "csharp" and not "python" and not "javascript" and not "go")
        {
            return BadRequest(new { message = "Language must be one of: csharp, python, javascript, go." });
        }

        exercise.Title = request.Title.Trim();
        exercise.Description = request.Description?.Trim();
        exercise.Language = language;
        exercise.StarterCode = request.StarterCode;
        exercise.SolutionCode = request.SolutionCode;
        exercise.TestCasesSpec = request.TestCasesSpec;

        await dbContext.SaveChangesAsync();
        return Ok();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> DeleteExercise([FromRoute] int id)
    {
        Exercise? exercise = await dbContext.Exercises.FirstOrDefaultAsync(e => e.Id == id);
        if (exercise is null)
        {
            return NotFound(new { message = "Exercise not found." });
        }

        // Also clean up join table records
        List<CardExercise> joins = await dbContext.CardExercises
            .Where(ce => ce.ExerciseId == id)
            .ToListAsync();
        dbContext.CardExercises.RemoveRange(joins);

        dbContext.Exercises.Remove(exercise);
        await dbContext.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("/api/cards/{cardId:int}/exercises")]
    public async Task<ActionResult<IEnumerable<ExerciseResponse>>> GetExercisesForCard([FromRoute] int cardId)
    {
        bool cardExists = await dbContext.Cards.AnyAsync(c => c.Id == cardId);
        if (!cardExists)
        {
            return NotFound(new { message = "Card not found." });
        }

        List<int> exerciseIds = await dbContext.CardExercises
            .Where(ce => ce.CardId == cardId)
            .Select(ce => ce.ExerciseId)
            .ToListAsync();

        List<ExerciseDetailResponse> exercises = await dbContext.Exercises
            .Where(e => exerciseIds.Contains(e.Id))
            .OrderBy(e => e.Title)
            .Select(e => new ExerciseDetailResponse
            {
                Id = e.Id,
                Title = e.Title,
                Description = e.Description,
                Language = e.Language,
                StarterCode = e.StarterCode,
                SolutionCode = e.SolutionCode,
                TestCasesSpec = e.TestCasesSpec,
                CreatedByUserId = e.CreatedByUserId,
                CreatedAt = e.CreatedAt
            })
            .ToListAsync();

        return Ok(exercises);
    }

    [HttpPost("/api/cards/{cardId:int}/exercises/{exerciseId:int}")]
    [Authorize(Roles = $"{Roles.Contributor},{Roles.Admin}")]
    public async Task<IActionResult> LinkExerciseToCard([FromRoute] int cardId, [FromRoute] int exerciseId)
    {
        bool cardExists = await dbContext.Cards.AnyAsync(c => c.Id == cardId);
        if (!cardExists)
        {
            return NotFound(new { message = "Card not found." });
        }

        bool exerciseExists = await dbContext.Exercises.AnyAsync(e => e.Id == exerciseId);
        if (!exerciseExists)
        {
            return NotFound(new { message = "Exercise not found." });
        }

        bool alreadyLinked = await dbContext.CardExercises.AnyAsync(ce => ce.CardId == cardId && ce.ExerciseId == exerciseId);
        if (alreadyLinked)
        {
            return Ok(new { message = "Already linked." });
        }

        dbContext.CardExercises.Add(new CardExercise
        {
            CardId = cardId,
            ExerciseId = exerciseId
        });

        await dbContext.SaveChangesAsync();
        return Ok(new { message = "Exercise linked to card successfully." });
    }

    [HttpDelete("/api/cards/{cardId:int}/exercises/{exerciseId:int}")]
    [Authorize(Roles = $"{Roles.Contributor},{Roles.Admin}")]
    public async Task<IActionResult> UnlinkExerciseFromCard([FromRoute] int cardId, [FromRoute] int exerciseId)
    {
        CardExercise? link = await dbContext.CardExercises
            .FirstOrDefaultAsync(ce => ce.CardId == cardId && ce.ExerciseId == exerciseId);

        if (link is null)
        {
            return NotFound(new { message = "Link not found." });
        }

        dbContext.CardExercises.Remove(link);
        await dbContext.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:int}/run")]
    public async Task<ActionResult<CodeRunResponse>> RunExercise(
        [FromRoute] int id,
        [FromBody] CodeRunRequest request,
        CancellationToken cancellationToken)
    {
        Exercise? exercise = await dbContext.Exercises
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == id, cancellationToken);

        if (exercise is null)
        {
            return NotFound(new { message = "Exercise not found." });
        }

        string type = exercise.ExerciseType ?? "CodeExecution";
        if (type.Equals("MultipleChoice", StringComparison.OrdinalIgnoreCase))
        {
            bool passed = false;
            string details = "";
            try
            {
                using var doc = System.Text.Json.JsonDocument.Parse(exercise.ExerciseSpec ?? "{}");
                int correctIdx = doc.RootElement.GetProperty("correctIndex").GetInt32();
                if (int.TryParse(request.SubmittedCode.Trim(), out int submittedIdx) && submittedIdx == correctIdx)
                {
                    passed = true;
                    details = "Correct choice selected!";
                }
                else
                {
                    details = "Incorrect choice. Try again!";
                }
            }
            catch
            {
                details = "Evaluation error parsing question specification.";
            }

            return Ok(new CodeRunResponse
            {
                RunId = 0,
                Result = passed ? "PASS" : "FAIL",
                Passed = passed,
                DurationMs = 1,
                Details = details
            });
        }
        else if (type.Equals("ExactString", StringComparison.OrdinalIgnoreCase))
        {
            bool passed = false;
            string details = "";
            try
            {
                using var doc = System.Text.Json.JsonDocument.Parse(exercise.ExerciseSpec ?? "{}");
                var root = doc.RootElement;
                bool caseSensitive = root.TryGetProperty("caseSensitive", out var csProp) && csProp.GetBoolean();
                var answers = new List<string>();
                if (root.TryGetProperty("acceptedAnswers", out var ansProp) && ansProp.ValueKind == System.Text.Json.JsonValueKind.Array)
                {
                    foreach (var item in ansProp.EnumerateArray())
                    {
                        answers.Add(item.GetString() ?? "");
                    }
                }

                string submitted = request.SubmittedCode?.Trim() ?? "";
                if (answers.Any(a => string.Equals(a.Trim(), submitted, caseSensitive ? StringComparison.Ordinal : StringComparison.OrdinalIgnoreCase)))
                {
                    passed = true;
                    details = "Correct answer!";
                }
                else
                {
                    details = "Incorrect answer. Check spelling/syntax and try again.";
                }
            }
            catch
            {
                details = "Evaluation error parsing question specification.";
            }

            return Ok(new CodeRunResponse
            {
                RunId = 0,
                Result = passed ? "PASS" : "FAIL",
                Passed = passed,
                DurationMs = 1,
                Details = details
            });
        }

        string lang = !string.IsNullOrWhiteSpace(request.Language) ? request.Language : exercise.Language;

        CodeExecutionResult execResult = await codeExecutionService.ExecuteAsync(
            request.SubmittedCode,
            lang,
            exercise.TestCasesSpec ?? exercise.SolutionCode,
            cancellationToken);

        return Ok(new CodeRunResponse
        {
            RunId = 0,
            Result = execResult.Passed ? "PASS" : "FAIL",
            Passed = execResult.Passed,
            DurationMs = execResult.DurationMs,
            Details = execResult.Details
        });
    }

    [HttpPost("{id:int}/reviews")]
    public async Task<ActionResult<ReviewResponse>> SubmitExerciseReview(
        [FromRoute] int id,
        [FromBody] ReviewRequest request)
    {
        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized(new { message = "Invalid user identity in token." });
        }

        bool exerciseExists = await dbContext.Exercises.AnyAsync(e => e.Id == id);
        if (!exerciseExists)
        {
            return NotFound(new { message = "Exercise not found." });
        }

        ReviewRecord? previousRecord = await dbContext.ExerciseReviewRecords
            .Where(r => r.UserId == userId && r.ExerciseId == id)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new ReviewRecord
            {
                CardId = r.ExerciseId,
                UserId = r.UserId,
                Outcome = r.Outcome,
                EaseFactor = r.EaseFactor,
                IntervalDays = r.IntervalDays,
                NextReviewAt = r.NextReviewAt,
                Phase = r.Phase,
                LearningStep = r.LearningStep,
                CreatedAt = r.CreatedAt
            })
            .FirstOrDefaultAsync();

        ReviewScheduleResult schedule = reviewSchedulerService.CalculateNextSchedule(previousRecord, request.Outcome);

        ExerciseReviewRecord newRecord = new ExerciseReviewRecord
        {
            ExerciseId = id,
            UserId = userId,
            Outcome = request.Outcome,
            EaseFactor = schedule.EaseFactor,
            IntervalDays = schedule.IntervalDays,
            NextReviewAt = schedule.NextReviewAt,
            Phase = schedule.Phase,
            LearningStep = schedule.LearningStep,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.ExerciseReviewRecords.Add(newRecord);

        bool alreadyEnrolled = await dbContext.UserExercises.AnyAsync(ue => ue.UserId == userId && ue.ExerciseId == id);
        if (!alreadyEnrolled)
        {
            dbContext.UserExercises.Add(new UserExercise { UserId = userId, ExerciseId = id, EnrolledAt = DateTime.UtcNow });
        }

        await dbContext.SaveChangesAsync();

        return Ok(new ReviewResponse
        {
            CardId = id,
            NextReviewAt = schedule.NextReviewAt,
            EaseFactor = schedule.EaseFactor,
            IntervalDays = schedule.IntervalDays,
            Phase = schedule.Phase
        });
    }

    /// <summary>
    /// Gets the list of exercise IDs in the current user's personal collection.
    /// </summary>
    [HttpGet("my-collection")]
    public async Task<ActionResult<List<int>>> GetMyCollectionExerciseIds()
    {
        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized(new { message = "Invalid user identity in token." });
        }

        List<int> enrolledIds = await dbContext.UserExercises
            .AsNoTracking()
            .Where(ue => ue.UserId == userId)
            .Select(ue => ue.ExerciseId)
            .ToListAsync();

        return Ok(enrolledIds);
    }

    /// <summary>
    /// Adds an exercise to the current user's personal collection.
    /// </summary>
    [HttpPost("{id:int}/enroll")]
    public async Task<IActionResult> EnrollExercise([FromRoute] int id)
    {
        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized(new { message = "Invalid user identity in token." });
        }

        bool exerciseExists = await dbContext.Exercises.AnyAsync(e => e.Id == id);
        if (!exerciseExists)
        {
            return NotFound(new { message = "Exercise not found." });
        }

        bool alreadyEnrolled = await dbContext.UserExercises.AnyAsync(ue => ue.UserId == userId && ue.ExerciseId == id);
        if (!alreadyEnrolled)
        {
            dbContext.UserExercises.Add(new UserExercise { UserId = userId, ExerciseId = id, EnrolledAt = DateTime.UtcNow });
        }

        bool hasReviewRecord = await dbContext.ExerciseReviewRecords.AnyAsync(r => r.UserId == userId && r.ExerciseId == id);
        if (!hasReviewRecord)
        {
            dbContext.ExerciseReviewRecords.Add(new ExerciseReviewRecord
            {
                ExerciseId = id,
                UserId = userId,
                Outcome = "Good",
                EaseFactor = 2.50m,
                IntervalDays = 0,
                NextReviewAt = DateTime.UtcNow,
                Phase = "learning",
                LearningStep = 0,
                CreatedAt = DateTime.UtcNow
            });
        }

        await dbContext.SaveChangesAsync();
        return Ok(new { message = "Exercise added to your personal collection.", isEnrolled = true });
    }

    /// <summary>
    /// Removes an exercise from the current user's personal collection.
    /// </summary>
    [HttpDelete("{id:int}/enroll")]
    public async Task<IActionResult> UnenrollExercise([FromRoute] int id)
    {
        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized(new { message = "Invalid user identity in token." });
        }

        UserExercise? enrollment = await dbContext.UserExercises
            .FirstOrDefaultAsync(ue => ue.UserId == userId && ue.ExerciseId == id);

        if (enrollment != null)
        {
            dbContext.UserExercises.Remove(enrollment);
            await dbContext.SaveChangesAsync();
        }

        return Ok(new { message = "Exercise removed from your personal collection.", isEnrolled = false });
    }

    /// <summary>
    /// Gets all exercises in the current user's personal collection that are due for review.
    /// </summary>
    [HttpGet("my-due")]
    public async Task<ActionResult<IEnumerable<ExerciseResponse>>> GetMyDueExercises()
    {
        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized(new { message = "Invalid user identity in token." });
        }

        DateTime now = DateTime.UtcNow;

        List<int> enrolledIds = await dbContext.UserExercises
            .AsNoTracking()
            .Where(ue => ue.UserId == userId)
            .Select(ue => ue.ExerciseId)
            .ToListAsync();

        if (enrolledIds.Count == 0)
        {
            return Ok(new List<ExerciseResponse>());
        }

        var rawExercises = await dbContext.Exercises
            .AsNoTracking()
            .Where(e => enrolledIds.Contains(e.Id))
            .Select(e => new
            {
                e.Id,
                e.Title,
                e.Description,
                e.Language,
                e.CreatedByUserId,
                e.CreatedAt,
                LatestReview = dbContext.ExerciseReviewRecords
                    .Where(r => r.ExerciseId == e.Id && r.UserId == userId)
                    .OrderByDescending(r => r.CreatedAt)
                    .Select(r => new { r.NextReviewAt })
                    .FirstOrDefault()
            })
            .ToListAsync();

        var dueList = rawExercises
            .Where(e => e.LatestReview == null || e.LatestReview.NextReviewAt <= now)
            .Select(e => new ExerciseResponse
            {
                Id = e.Id,
                Title = e.Title,
                Description = e.Description,
                Language = e.Language,
                CreatedByUserId = e.CreatedByUserId,
                CreatedAt = e.CreatedAt,
                LinkedCardsCount = dbContext.CardExercises.Count(ce => ce.ExerciseId == e.Id)
            })
            .ToList();

        return Ok(dueList);
    }

    [HttpGet("due")]
    public async Task<ActionResult<IEnumerable<ExerciseResponse>>> GetDueExercises()
    {
        string? userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized(new { message = "Invalid user identity in token." });
        }

        DateTime now = DateTime.UtcNow;

        var rawExercises = await dbContext.Exercises
            .AsNoTracking()
            .Select(e => new
            {
                e.Id,
                e.Title,
                e.Description,
                e.Language,
                e.CreatedByUserId,
                e.CreatedAt,
                LatestReview = dbContext.ExerciseReviewRecords
                    .Where(r => r.ExerciseId == e.Id && r.UserId == userId)
                    .OrderByDescending(r => r.CreatedAt)
                    .Select(r => new { r.NextReviewAt })
                    .FirstOrDefault()
            })
            .ToListAsync();

        var dueList = rawExercises
            .Where(e => e.LatestReview == null || e.LatestReview.NextReviewAt <= now)
            .Select(e => new ExerciseResponse
            {
                Id = e.Id,
                Title = e.Title,
                Description = e.Description,
                Language = e.Language,
                CreatedByUserId = e.CreatedByUserId,
                CreatedAt = e.CreatedAt,
                LinkedCardsCount = dbContext.CardExercises.Count(ce => ce.ExerciseId == e.Id)
            })
            .ToList();

        return Ok(dueList);
    }

    [HttpPost("reseed")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> ReseedBasicExercises()
    {
        if (await dbContext.CardExercises.AnyAsync()) dbContext.CardExercises.RemoveRange(dbContext.CardExercises);
        if (await dbContext.ExerciseReviewRecords.AnyAsync()) dbContext.ExerciseReviewRecords.RemoveRange(dbContext.ExerciseReviewRecords);
        if (await dbContext.Exercises.AnyAsync()) dbContext.Exercises.RemoveRange(dbContext.Exercises);
        await dbContext.SaveChangesAsync();

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

        dbContext.Exercises.AddRange(ex1, ex2, ex3, ex4, ex5);
        await dbContext.SaveChangesAsync();

        return Ok(new { message = "Exercises database re-seeded successfully with 5 basic coding challenges and test assertion suites." });
    }
}
