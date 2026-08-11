# AnkiX — Feature Execution Traces

> **Purpose**: A deep architectural walkthrough for every core user flow in the AnkiX platform.
> Each trace follows a user action from the React button click, through the HTTP request,
> into the ASP.NET Core controller, through the service/DI layer, down to the exact
> Azure SQL table mutations, and back up with the response.
>
> **Last updated**: 2026-08-08

---

## Table of Contents

1. [System Overview & DI Registration](#1-system-overview--di-registration)
2. [Flow 1 — User Registration & Login (JWT Generation)](#2-flow-1--user-registration--login-jwt-generation)
3. [Flow 2 — Deck & Card Retrieval / Browsing](#3-flow-2--deck--card-retrieval--browsing)
4. [Flow 3 — Running Code Submissions (CardRunsController)](#4-flow-3--running-code-submissions-cardrunscontroller)
5. [Flow 4 — Submitting a Spaced-Repetition Review (ReviewsController)](#5-flow-4--submitting-a-spaced-repetition-review-reviewscontroller)
6. [Flow 5 — Adding a Follow-up Question (FollowupsController)](#6-flow-5--adding-a-follow-up-question-followupscontroller)
7. [Flow 6 — Admin Linking a Card to a Follow-up](#7-flow-6--admin-linking-a-card-to-a-follow-up)
8. [Flow 7 — Enrolling in & Reviewing Exercises](#8-flow-7--enrolling-in--reviewing-exercises)
9. [Entity Relationship Diagram](#9-entity-relationship-diagram)
10. [Full DI Container & Middleware Pipeline](#10-full-di-container--middleware-pipeline)

---

## 1. System Overview & DI Registration

### Architecture at a Glance

```
┌───────────────┐     HTTPS/JSON      ┌──────────────────────┐      EF Core       ┌──────────────┐
│  React SPA    │ ◄──────────────────► │  ASP.NET Core API    │ ◄────────────────► │  Azure SQL   │
│  (Vite)       │                      │  (Program.cs)        │                    │  Server      │
│               │                      │                      │                    │              │
│  api.js       │                      │  Controllers/        │                    │  Tables:     │
│  AuthProvider │                      │  Services/           │                    │  Users       │
│  Pages/       │                      │  Models/             │                    │  Decks       │
│  Components/  │                      │  Contracts/          │                    │  Cards       │
└───────────────┘                      └──────────────────────┘                    │  CardRuns    │
                                              │                                    │  ReviewRecs  │
                                              │ HttpClient                         │  Exercises   │
                                              ▼                                    │  ...         │
                                       ┌──────────────┐                            └──────────────┘
                                       │ Piston API / │
                                       │ Native proc  │
                                       │ (code exec)  │
                                       └──────────────┘
```

### DI Registrations in `Program.cs`

| Registration | Interface | Concrete Class | Lifetime |
|---|---|---|---|
| `AddDbContext<ApplicationDbContext>` | — | `ApplicationDbContext` | Scoped |
| `AddHttpClient<ICodeExecutionService, CodeExecutionService>` | `ICodeExecutionService` | `CodeExecutionService` | Transient (HttpClient managed) |
| `AddScoped<IPasswordService, PasswordService>` | `IPasswordService` | `PasswordService` | Scoped |
| `AddScoped<ITokenService, TokenService>` | `ITokenService` | `TokenService` | Scoped |
| `AddScoped<IReviewSchedulerService, ReviewSchedulerService>` | `IReviewSchedulerService` | `ReviewSchedulerService` | Scoped |
| `Configure<JwtOptions>` | — | `JwtOptions` (from `appsettings Jwt:` section) | Singleton (options pattern) |
| `Configure<ExecutionApiOptions>` | — | `ExecutionApiOptions` (from `appsettings ExecutionApi:` section) | Singleton (options pattern) |

### Middleware Pipeline Order

```
UseCors("FrontendPolicy")
UseHttpsRedirection()   // production only
UseAuthentication()     // JWT Bearer validation
UseAuthorization()      // [Authorize] attribute enforcement
MapControllers()        // route to controller actions
```

### Database Startup

On every startup, `Program.cs` runs:
1. `Database.Migrate()` — applies all pending EF Core migrations
2. `Database.ExecuteSqlRaw(...)` — idempotent SQL for table renames (Community → StudyGroup), column adds, etc.
3. Seed logic: creates `"sample"`, `"global"`, and `"software-engineering"` study groups if missing
4. Re-assigns orphan decks/exercises to the `"sample"` study group

---

## 2. Flow 1 — User Registration & Login (JWT Generation)

### 2a. Registration

#### Trigger & Payload

| Item | Value |
|---|---|
| **User Action** | Fills form on `/register`, clicks "Create Account" |
| **React Source** | [`Register.jsx`](file:///c:/Users/USER/Desktop/projects/ankiX/src/frontend/src/pages/Register.jsx) → `submit()` |
| **HTTP Endpoint** | `POST /api/auth/register` |
| **Request DTO** | `RegisterRequest` — `{ email: string, password: string, displayName?: string }` |

#### Frontend Trace

```
Register.jsx
├── useState: email, password, displayName, isLoading
├── submit(e)
│   ├── setIsLoading(true)
│   ├── auth.register(email, password, displayName)    ← calls AuthProvider
│   │   └── api.register(email, password, displayName) ← api.js
│   │       └── fetch(POST /api/auth/register, { email, password, displayName })
│   ├── on success: alert("Registered") → redirect to /login
│   └── on error:   alert("Register failed: ...")
└── finally: setIsLoading(false)
```

#### Backend Pipeline

| Layer | File | Detail |
|---|---|---|
| **Controller** | [`AuthController.cs`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Controllers/AuthController.cs) | `[HttpPost("register")]` — NO `[Authorize]` (public endpoint) |
| **Request DTO** | [`RegisterRequest.cs`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Contracts/Auth/RegisterRequest.cs) | `[Required] Email`, `[Required][MinLength(8)] Password`, `[MaxLength(128)] DisplayName?` |
| **DI Services** | `ApplicationDbContext`, `IPasswordService`, `ITokenService` (injected but not used for register) |

#### Service & Class Objects

1. **`AuthController.Register(RegisterRequest request)`**
   - Normalize email: `request.Email.Trim().ToLowerInvariant()`
   - Check uniqueness: `dbContext.Users.AnyAsync(u => u.Email == normalizedEmail)`
   - Derive display name: `UserHelper.GetEffectiveDisplayName(request.DisplayName, normalizedEmail)`
     - [`UserHelper.cs`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Helpers/UserHelper.cs): if displayName is blank or looks like an email, extracts the part before `@`
   - Hash password: `passwordService.HashPassword(request.Password)`
     - [`PasswordService.cs`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Services/PasswordService.cs): PBKDF2 with SHA-256, 100,000 iterations, 16-byte salt, 32-byte hash → stored as `"base64(salt):base64(hash)"`
   - Create `User` entity with `Role = Roles.User` (`"User"`)
   - `dbContext.Users.Add(user)` → `SaveChangesAsync()`

#### Database Mutations

| Table | Columns Written | FK / Index |
|---|---|---|
| **`Users`** | `Id` (auto-increment), `Email`, `PasswordHash`, `DisplayName`, `Role` = `"User"`, `CreatedAt` = UTC now | Unique index on `Email` |

#### Response

```json
201 Created
{
  "userId": 42,
  "email": "user@example.com",
  "displayName": "user",
  "role": "User"
}
```

#### Edge Cases & Exception Handling

| Error | Status | Cause | Code Path |
|---|---|---|---|
| Duplicate email | `409 Conflict` | `emailExists == true` | Returns `{ message: "Email already exists." }` |
| Missing/invalid email | `400 Bad Request` | Model validation: `[Required][EmailAddress]` | ASP.NET model binding |
| Password < 8 chars | `400 Bad Request` | Model validation: `[MinLength(8)]` | ASP.NET model binding |
| DB connection failure | `500` | `SaveChangesAsync` throws | Unhandled, returns generic 500 |

---

### 2b. Login (JWT Generation)

#### Trigger & Payload

| Item | Value |
|---|---|
| **User Action** | Fills form on `/login`, clicks "Log In" |
| **React Source** | [`Login.jsx`](file:///c:/Users/USER/Desktop/projects/ankiX/src/frontend/src/pages/Login.jsx) → `submit()` |
| **HTTP Endpoint** | `POST /api/auth/login` |
| **Request DTO** | `LoginRequest` — `{ email: string, password: string }` |

#### Frontend Trace

```
Login.jsx
├── useState: email, password, isLoading
├── submit(e)
│   ├── auth.login(email, password)             ← AuthProvider.login()
│   │   └── api.login(email, password)          ← api.js
│   │       ├── fetch(POST /api/auth/login)
│   │       ├── on 200: stores accessToken in localStorage("ankix_token")
│   │       ├── stores user object in localStorage("ankix_user")
│   │       └── returns { accessToken, expiresInSeconds, user }
│   ├── AuthProvider: setUser(data.user), stores to localStorage
│   └── window.location.href = '/decks'
└── on error: alert("Login failed: ...")
```

#### Backend Pipeline

| Layer | File | Detail |
|---|---|---|
| **Controller** | [`AuthController.cs`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Controllers/AuthController.cs) | `[HttpPost("login")]` — NO `[Authorize]` |
| **Request DTO** | [`LoginRequest.cs`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Contracts/Auth/LoginRequest.cs) | `[Required][EmailAddress] Email`, `[Required] Password` |
| **Response DTO** | [`AuthResponse.cs`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Contracts/Auth/AuthResponse.cs) | `AccessToken`, `ExpiresInSeconds`, `User { Id, Email, DisplayName, Role }` |

#### Service & Class Objects

1. **`AuthController.Login(LoginRequest request)`**
   - Normalize: `request.Email.Trim().ToLowerInvariant()`
   - Lookup: `dbContext.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail)`
   - Verify: `passwordService.VerifyPassword(request.Password, user.PasswordHash)`
     - [`PasswordService.VerifyPassword`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Services/PasswordService.cs): splits stored hash at `:`, re-derives hash with same salt, uses `CryptographicOperations.FixedTimeEquals` (timing-safe compare)
   - Generate token: `tokenService.CreateToken(user)`
     - [`TokenService.CreateToken`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Services/TokenService.cs):
       - Builds HMAC-SHA256 signing credentials from `JwtOptions.SigningKey`
       - Claims: `NameIdentifier` (user ID), `Email`, `GivenName` (display name), `"displayName"` (custom), `Role`
       - Expiry: `DateTime.UtcNow.AddMinutes(JwtOptions.ExpiresInMinutes)` (default: 60 min)
       - Issuer: `"ankiX.api"`, Audience: `"ankiX.web"`
   - Returns `AuthResponse` with `ExpiresInSeconds = ExpiresInMinutes * 60`

#### Database Mutations

| Table | Operation |
|---|---|
| **`Users`** | **READ ONLY** — `FirstOrDefaultAsync` lookup by email |

#### Token Anatomy (JWT Claims)

```json
{
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier": "42",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress": "user@example.com",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname": "user",
  "displayName": "user",
  "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": "User",
  "exp": 1723161600,
  "iss": "ankiX.api",
  "aud": "ankiX.web"
}
```

#### Frontend Token Consumption

[`api.js → getUser()`](file:///c:/Users/USER/Desktop/projects/ankiX/src/frontend/src/api.js): First tries `localStorage("ankix_user")`. Fallback: decodes the JWT payload via `atob(token.split('.')[1])` and extracts the role, email, id, and displayName from Microsoft's full claim URIs.

[`RequireAuth.jsx`](file:///c:/Users/USER/Desktop/projects/ankiX/src/frontend/src/auth/RequireAuth.jsx): Wraps protected routes; if `auth.user` is null, redirects to `/login`.

#### Edge Cases & Exception Handling

| Error | Status | Cause |
|---|---|---|
| User not found OR wrong password | `401 Unauthorized` | `user is null` or `VerifyPassword` returns false — **same error for both** (prevents email enumeration) |
| Invalid email format | `400 Bad Request` | Model validation |
| Expired/invalid JWT on later requests | `401 Unauthorized` | JWT middleware rejects (validated by `TokenValidationParameters` in `Program.cs`) |

---

## 3. Flow 2 — Deck & Card Retrieval / Browsing

### 3a. Loading the Decks List

#### Trigger & Payload

| Item | Value |
|---|---|
| **User Action** | Navigates to `/decks` (after login) |
| **React Source** | [`Decks.jsx`](file:///c:/Users/USER/Desktop/projects/ankiX/src/frontend/src/pages/Decks.jsx) → `useEffect` on mount |
| **HTTP Endpoint** | `GET /api/decks?studyGroupId={id}` |
| **Auth** | `Authorization: Bearer <JWT>` (via `authHeaders()` in api.js) |

#### Frontend Trace

```
Decks.jsx
├── useEffect on [activeStudyGroup]
│   ├── api.getDecks(activeStudyGroup?.id)
│   │   └── fetch(GET /api/decks?studyGroupId=X, { Authorization: Bearer ... })
│   ├── setDecks(response)
│   └── setLoading(false)
├── Renders deck cards with DueCount (red) and LearnCount (blue)
└── Each deck card links to /decks/:id
```

#### Backend Pipeline

| Layer | File | Detail |
|---|---|---|
| **Controller** | [`DecksController.cs`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Controllers/DecksController.cs) | `[HttpGet]`, `[Authorize]` (class-level) |
| **Response DTO** | [`DeckDtos.cs → DeckResponse`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Contracts/Content/DeckDtos.cs) | `Id, Title, Description, CreatedByUserId, DueCount, LearnCount` |

#### Service & Class Objects

1. **`DecksController.GetDecks(int? studyGroupId)`**
   - Extracts `userId` from `ClaimTypes.NameIdentifier`
   - Fetches user's joined groups: `dbContext.StudyGroupMembers.Where(m => m.UserId == userId)`
   - Determines `sampleGroupId` from `StudyGroups.Where(c => c.Slug == "sample")`
   - **Scoping logic** (which decks the user sees):
     - If `studyGroupId` is provided and user is a member → filter decks to that group
     - If the target group is `"sample"` → also include decks with `StudyGroupId == null`
     - If no group filter → union of all decks in user's joined groups
     - If user hasn't joined the requested group → returns empty `[]`
   - For each deck, counts cards and classifies:
     - **DueCount**: cards with latest `ReviewRecord.NextReviewAt <= now`
     - **LearnCount**: cards with no review record, OR cards with `NextReviewAt > now` (i.e. not yet due)

#### Database Tables Queried (READ ONLY)

| Table | Purpose |
|---|---|
| `StudyGroupMembers` | Check user membership |
| `StudyGroups` | Find sample group ID |
| `Decks` | Main query |
| `Cards` | Count per deck |
| `ReviewRecords` | Latest review per card per user (for due/learn counts) |

### 3b. Loading Cards for a Deck (Study Queue)

#### Trigger & Payload

| Item | Value |
|---|---|
| **User Action** | Clicks a deck card on `/decks` → navigates to `/decks/:id` |
| **React Source** | [`Deck.jsx`](file:///c:/Users/USER/Desktop/projects/ankiX/src/frontend/src/pages/Deck.jsx) → `loadQueue()` |
| **HTTP Endpoints** | `GET /api/decks/:id/study-queue` + `GET /api/decks/:id/cards` (parallel) |

#### Frontend Trace

```
Deck.jsx
├── loadQueue() called in useEffect([id])
│   ├── Promise.all([
│   │     api.getDeck(id),          → GET /api/decks/:id      (404 if not found)
│   │     api.getStudyQueue(id),    → GET /api/decks/:id/study-queue
│   │     api.getCards(id)          → GET /api/decks/:id/cards
│   │   ])
│   ├── setDeck(d), setQueue(q), setAllCards(cs)
│   ├── setCurrentIndex(0), setShowAnswer(false)
│   └── Resets followup/exercise panel states
├── Renders study card: queue.dueCards[currentIndex]
│   ├── "concept" cards: show Prompt + Answer toggle
│   ├── "micro-coding" cards: show code editor + Run button
│   └── Rating buttons: Again | Hard | Good | Easy
└── Admin/Edit drawer: shows allCards list for CRUD
```

#### Backend Pipeline — Study Queue

| Layer | File | Detail |
|---|---|---|
| **Controller** | [`StudyQueueController.cs`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Controllers/StudyQueueController.cs) | `[HttpGet]` on `api/decks/{deckId}/study-queue` |
| **Response DTO** | [`StudyQueueDtos.cs → StudyQueueResponse`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Contracts/Study/StudyQueueDtos.cs) | `NewCount, LearningCount, ReviewCount, DueCards[]` |

#### Service & Class Objects

1. **`StudyQueueController.GetStudyQueue(int deckId)`**
   - Loads all `Card` rows for the deck
   - Finds the latest `ReviewRecord` per card per user (2-query strategy: get max IDs, then load by ID)
   - Classifies cards into three buckets:
     - **New** (Blue): no review record exists
     - **Learning** (Red): `Phase == "learning"` AND `NextReviewAt <= now`
     - **Review** (Green): `Phase == "review"` AND `NextReviewAt <= now`
   - Queue priority: `[...learningDue, ...reviewDue, ...newCards]`

#### Database Tables Queried

| Table | Purpose |
|---|---|
| `Decks` | Verify deck exists |
| `Cards` | All cards in deck |
| `ReviewRecords` | Latest review per user+card for classification |

---

## 4. Flow 3 — Running Code Submissions (CardRunsController)

#### Trigger & Payload

| Item | Value |
|---|---|
| **User Action** | Types code in the card editor, clicks "▶ Run" on a `micro-coding` card |
| **React Source** | [`Deck.jsx`](file:///c:/Users/USER/Desktop/projects/ankiX/src/frontend/src/pages/Deck.jsx) → run button handler |
| **HTTP Endpoint** | `POST /api/cards/{cardId}/run` |
| **Request DTO** | `CodeRunRequest` — `{ submittedCode: string, language: "csharp" }` |

#### Frontend Trace

```
Deck.jsx
├── User types code in <textarea> → setUserCode(...)
├── On "Run" click:
│   ├── api.runCardCode(cardId, userCode, 'csharp')    ← api.js
│   │   └── fetch(POST /api/cards/{cardId}/run, { submittedCode, language })
│   ├── Display result: PASS/FAIL + details
│   └── runResult = { passed, details, durationMs }
```

#### Backend Pipeline

| Layer | File | Detail |
|---|---|---|
| **Controller** | [`CardRunsController.cs`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Controllers/CardRunsController.cs) | `[HttpPost]` on `api/cards/{cardId}/run`, `[Authorize]` class-level |
| **Request DTO** | [`RunDtos.cs → CodeRunRequest`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Contracts/Study/RunDtos.cs) | `[Required] SubmittedCode`, `Language = "csharp"` |
| **Response DTO** | [`RunDtos.cs → CodeRunResponse`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Contracts/Study/RunDtos.cs) | `RunId, Result ("PASS"/"FAIL"), Passed, DurationMs, Details` |
| **DI Services** | `ApplicationDbContext`, `ICodeExecutionService` |

#### Service & Class Objects

1. **`CardRunsController.RunCardCode(int cardId, CodeRunRequest request, CancellationToken)`**
   - Extracts `userId` from JWT claims
   - Loads `Card` (with `AsNoTracking()` — read only)
   - Calls `codeExecutionService.ExecuteAsync(submittedCode, language, card.ValidationSpec, ct)`

2. **[`CodeExecutionService.ExecuteAsync()`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Services/CodeExecutionService.cs)** — three execution paths:

   **Path A: Piston API Proxy** (when `ExecutionApiOptions.BaseUrl` is configured and URL contains "piston" or "emkc.org")
   - Normalizes language to Piston naming (`"csharp"`, `"python"`, `"javascript"`, `"go"`)
   - Builds test harness: appends `validationSpec` (test assertions) to user code
   - Sends `POST` to Piston with `{ language, version: "*", files: [{ content: harness }] }`
   - Parses `PistonResponse.Run`: checks `Code == 0` and `Stderr` is empty → `Passed`

   **Path B: Generic Execution API** (when BaseUrl is set but not Piston)
   - Sends `{ submittedCode, language, validationSpec }` to `ExecutePath`
   - Parses `ExecutionApiResponse { Result, DurationMs, Details }`

   **Path C: Native Host Process** (no BaseUrl configured — local dev)
   - Writes combined code + test harness to a temp file (`ankix_run_{guid}.py/js/go`)
   - For Go: rebuilds `package main` wrapper around user code + test `func main()`
   - For Python/JS: appends auto-generated test assertions if no tests found in validationSpec
   - Spawns `python3`, `node`, or `go run` via `System.Diagnostics.Process`
   - 5-second timeout via `CancellationTokenSource`
   - `Passed = exitCode == 0 && stderr is empty`
   - **Always** cleans up temp file in `finally` block
   - For unsupported languages (e.g. C#): falls through to `ValidateLocalSyntax()` (bracket matching + typo detection via Levenshtein distance)

3. **After execution**:
   - Creates `CardRun` entity with all result fields
   - `dbContext.CardRuns.Add(run)` → `SaveChangesAsync()`

#### Database Mutations

| Table | Columns Written | FK |
|---|---|---|
| **`CardRuns`** | `Id` (bigint auto), `CardId` → Cards.Id, `UserId` → Users.Id, `SubmittedCode`, `Result` (bool?), `ResultDetails`, `DurationMs`, `CreatedAt` | Index on `(UserId, CardId)` |

#### Edge Cases & Exception Handling

| Error | Status | Cause |
|---|---|---|
| Invalid JWT / missing token | `401 Unauthorized` | JWT middleware or `int.TryParse(userIdClaim)` fails |
| Card not found | `404 Not Found` | `card is null` |
| Empty submitted code | returns `{ Passed: false, Details: "Submitted code cannot be empty." }` | Checked in `CodeExecutionService` |
| Piston API returns error | `500` | `HttpRequestException` thrown, bubbles up |
| Native process timeout (>5s) | returns `{ Passed: false, DurationMs: 5000, Details: "Execution timed out" }` | `OperationCanceledException` caught |
| Process fails to start | returns `{ Passed: false, Details: "Failed to start process 'python3'" }` | `proc is null` check |

---

## 5. Flow 4 — Submitting a Spaced-Repetition Review (ReviewsController)

#### Trigger & Payload

| Item | Value |
|---|---|
| **User Action** | Clicks one of **Again** / **Hard** / **Good** / **Easy** buttons on a study card |
| **React Source** | [`Deck.jsx`](file:///c:/Users/USER/Desktop/projects/ankiX/src/frontend/src/pages/Deck.jsx) → rating button handler |
| **HTTP Endpoint** | `POST /api/reviews` |
| **Request DTO** | `ReviewRequest` — `{ cardId: int, outcome: "Again"|"Hard"|"Good"|"Easy" }` |

#### Frontend Trace

```
Deck.jsx
├── User clicks a rating button (e.g. "Good")
├── setSubmittingRating(true)
├── api.submitReview(cardId, outcome)         ← api.js
│   └── fetch(POST /api/reviews, { cardId, outcome })
├── On success: advance to next card in queue
│   ├── setCurrentIndex(prev => prev + 1)
│   ├── setShowAnswer(false)
│   ├── If all cards done → reload queue (loadQueue())
│   └── setUserCode('') — reset code editor
└── finally: setSubmittingRating(false)
```

#### Backend Pipeline

| Layer | File | Detail |
|---|---|---|
| **Controller** | [`ReviewsController.cs`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Controllers/ReviewsController.cs) | `[HttpPost]`, `[Authorize]` class-level |
| **Request DTO** | [`ReviewDtos.cs → ReviewRequest`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Contracts/Study/ReviewDtos.cs) | `[Required] CardId`, `[Required][RegularExpression("Again\|Hard\|Good\|Easy")] Outcome` |
| **Response DTO** | [`ReviewDtos.cs → ReviewResponse`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Contracts/Study/ReviewDtos.cs) | `CardId, NextReviewAt, EaseFactor, IntervalDays, Phase` |
| **DI Services** | `ApplicationDbContext`, `IReviewSchedulerService` |

#### Service & Class Objects

1. **`ReviewsController.SubmitReview(ReviewRequest request)`**
   - Extracts `userId` from JWT
   - Verifies card exists: `dbContext.Cards.AnyAsync(c => c.Id == request.CardId)`
   - Loads previous review: `dbContext.ReviewRecords.Where(r => r.UserId == userId && r.CardId == request.CardId).OrderByDescending(r => r.CreatedAt).FirstOrDefaultAsync()`
   - Calls `reviewSchedulerService.CalculateNextSchedule(previousRecord, request.Outcome)`

2. **[`ReviewSchedulerService.CalculateNextSchedule()`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Services/ReviewSchedulerService.cs)** — Modified SM-2 Algorithm:

   **Case: Brand-new card** (`previousRecord is null`):
   | Outcome | Phase | Step | EaseFactor | NextReviewAt |
   |---|---|---|---|---|
   | Again / Hard | learning | 0 | 2.50 | +1 minute |
   | Good | learning | 1 | 2.50 | +10 minutes |
   | Easy | review | — | 2.60 | +1 day |

   **Case: Learning phase** (`phase == "learning"`):
   | Outcome | Result |
   |---|---|
   | Again / Hard | Stay at step 0 (+1 min) |
   | Good at step 0 | Advance to step 1 (+10 min) |
   | Good at step 1+ | **Graduate** to review phase (+1 day) |
   | Easy | **Graduate** with interval +4 days, ease +0.15 |

   **Case: Review phase** (`phase == "review"`):
   | Outcome | EaseFactor | IntervalDays |
   |---|---|---|
   | Again | `max(1.30, ease - 0.20)` | **Lapse**: back to learning step 0 |
   | Hard | `max(1.30, ease - 0.15)` | `max(1, round(interval × 1.20))` |
   | Good | unchanged | `max(1, round(interval × ease))` |
   | Easy | `min(ease + 0.15, 9.99)` | `max(1, round(interval × ease × 1.30))` |

3. **After scheduling**:
   - Creates `ReviewRecord` entity with all schedule fields
   - `dbContext.ReviewRecords.Add(newRecord)` → `SaveChangesAsync()`

#### Database Mutations

| Table | Columns Written | FK / Index |
|---|---|---|
| **`ReviewRecords`** | `Id` (bigint auto), `CardId` → Cards.Id, `UserId` → Users.Id, `Outcome`, `EaseFactor` (decimal 4,2), `IntervalDays`, `NextReviewAt` (datetime2), `Phase` ("learning"/"review"), `LearningStep` (0/1), `CreatedAt` | Composite index: `(UserId, NextReviewAt)` |

#### Edge Cases & Exception Handling

| Error | Status | Cause |
|---|---|---|
| Invalid JWT | `401 Unauthorized` | `int.TryParse(userIdClaim)` fails |
| Card not found | `404 Not Found` | `cardExists == false` |
| Invalid outcome string | `400 Bad Request` | `[RegularExpression]` validation — also `ArgumentException` from service |
| No previous review | Works fine | `previousRecord` is null → brand-new card logic |
| EaseFactor clamp | — | `Math.Max(1.30m, ...)` and `Math.Min(..., 9.99m)` prevent degenerate values |

---

## 6. Flow 5 — Adding a Follow-up Question (FollowupsController)

#### Trigger & Payload

| Item | Value |
|---|---|
| **User Action** | While studying a card, opens "Follow-ups" panel, types a question, clicks "Submit" |
| **React Source** | [`Deck.jsx`](file:///c:/Users/USER/Desktop/projects/ankiX/src/frontend/src/pages/Deck.jsx) → follow-up submit handler |
| **HTTP Endpoint** | `POST /api/cards/{cardId}/followups` |
| **Request DTO** | `CreateFollowupRequest` — `{ questionText: string }` |

#### Frontend Trace

```
Deck.jsx
├── User toggles showFollowups → loads existing followups
│   ├── api.getFollowups(cardId) → GET /api/cards/{cardId}/followups
│   ├── setFollowups(response)
│   └── Renders list with author names, timestamps, linked card badges
├── User types in <input> → setNewQuestion(...)
├── On submit:
│   ├── setSubmittingFollowup(true)
│   ├── api.addFollowup(cardId, questionText)
│   │   └── fetch(POST /api/cards/{cardId}/followups, { questionText })
│   ├── On success: prepend new followup to list
│   │   └── setFollowups(prev => [...prev, newFollowup])
│   └── setNewQuestion('')
└── finally: setSubmittingFollowup(false)
```

#### Backend Pipeline

| Layer | File | Detail |
|---|---|---|
| **Controller** | [`FollowupsController.cs`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Controllers/FollowupsController.cs) | `[HttpPost]` on `api/cards/{cardId}/followups`, `[Authorize]` class-level |
| **Request DTO** | [`FollowupDtos.cs → CreateFollowupRequest`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Contracts/Study/FollowupDtos.cs) | `[Required][MaxLength(1000)] QuestionText` |
| **Response DTO** | [`FollowupDtos.cs → FollowupResponse`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Contracts/Study/FollowupDtos.cs) | `Id, CardId, AuthorUserId, AuthorDisplayName, QuestionText, LinkedCardId?, LinkedCardIds[], CreatedAt` |

#### Service & Class Objects

1. **`FollowupsController.CreateFollowup(int cardId, CreateFollowupRequest request)`**
   - Extracts `userId` from JWT
   - Verifies card exists
   - Creates `CardFollowup` entity:
     - [`CardFollowup.cs`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Models/CardFollowup.cs): `CardId`, `AuthorUserId`, `QuestionText` (trimmed), `LinkedCardId = null`, `LinkedCardIds = null`, `CreatedAt = UtcNow`
   - `dbContext.CardFollowups.Add(followup)` → `SaveChangesAsync()`
   - Looks up author's display name via `dbContext.Users` for the response
   - Returns `201 CreatedAtAction` with location pointing to `GetFollowups`

#### Database Mutations

| Table | Columns Written | FK / Index |
|---|---|---|
| **`CardFollowups`** | `Id` (bigint auto), `CardId` → Cards.Id, `AuthorUserId` → Users.Id, `QuestionText`, `LinkedCardId` (null), `LinkedCardIds` (null), `CreatedAt` | Indexes on `CardId` and `AuthorUserId` |

#### Loading Existing Follow-ups (`GET /api/cards/{cardId}/followups`)

1. Loads all `CardFollowup` where `CardId == cardId`, ordered by `CreatedAt ASC`
2. Batch-loads author display names: collects distinct `AuthorUserId`s → single `Users` query
3. Uses `UserHelper.GetEffectiveDisplayName()` to resolve display names
4. Calls `followup.GetLinkedCardIdList()` — combines `LinkedCardId` and `LinkedCardIds` (comma-separated) into a deduplicated `List<int>`

#### Edge Cases & Exception Handling

| Error | Status | Cause |
|---|---|---|
| Invalid JWT | `401 Unauthorized` | `int.TryParse(userIdClaim)` fails |
| Card not found | `404 Not Found` | `cardExists == false` |
| Question too long | `400 Bad Request` | `[MaxLength(1000)]` validation |
| No followups exist | `200 OK` | Returns empty array `[]` |

---

## 7. Flow 6 — Admin Linking a Card to a Follow-up

#### Trigger & Payload

| Item | Value |
|---|---|
| **User Action** | Admin/Contributor clicks "Link Card" on a follow-up, enters card ID, confirms |
| **React Source** | [`Deck.jsx`](file:///c:/Users/USER/Desktop/projects/ankiX/src/frontend/src/pages/Deck.jsx) → link handler |
| **HTTP Endpoint** | `PATCH /api/cards/{cardId}/followups/{followupId}/link` |
| **Request DTO** | `LinkFollowupRequest` — `{ linkedCardId: int }` |

#### Frontend Trace

```
Deck.jsx
├── Admin sees a follow-up with no linked card
├── Clicks "Link" button → opens link modal/input
├── Enters target card ID (the answer card)
├── api.linkFollowupToCard(cardId, followupId, linkedCardId)
│   └── fetch(PATCH /api/cards/{cardId}/followups/{followupId}/link, { linkedCardId })
├── On success: refresh followups list
│   └── Updated followup now shows linkedCardIds badge
└── Can also unlink: api.unlinkFollowupCard(cardId, followupId, linkedCardId)
    └── fetch(DELETE /api/cards/{cardId}/followups/{followupId}/link/{linkedCardId})
```

#### Backend Pipeline

| Layer | File | Detail |
|---|---|---|
| **Controller** | [`FollowupsController.cs`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Controllers/FollowupsController.cs) | `[HttpPatch("{followupId}/link")]`, `[Authorize]` class-level |
| **Request DTO** | [`FollowupDtos.cs → LinkFollowupRequest`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Contracts/Study/FollowupDtos.cs) | `[Required] LinkedCardId` |
| **Authorization** | Role-based via `CanManageContentAsync()` |

#### Service & Class Objects

1. **`FollowupsController.LinkAnswerCard(int cardId, long followupId, LinkFollowupRequest request)`**
   - **Authorization check** via `CanManageContentAsync(deck?.StudyGroupId)`:
     - Loads `Card` → `Deck` to get `StudyGroupId`
     - Returns `true` if user has global role `Admin` or `Contributor`
     - OR if user's `StudyGroupMember.Role` is `Owner`, `Admin`, or `Contributor` for that group
     - Returns `403 Forbid` if neither condition met
   - Loads `CardFollowup` where `Id == followupId && CardId == cardId`
   - Verifies the answer card exists: `dbContext.Cards.AnyAsync(c => c.Id == request.LinkedCardId)`
   - Calls **`followup.AddLinkedCardId(request.LinkedCardId)`**:
     - [`CardFollowup.AddLinkedCardId()`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Models/CardFollowup.cs):
       1. Gets current list via `GetLinkedCardIdList()` (union of `LinkedCardId` + `LinkedCardIds` CSV)
       2. Adds new ID if not already present
       3. Sets `LinkedCardId` to the new ID if it was null
       4. Updates `LinkedCardIds` to comma-separated string
   - `SaveChangesAsync()`

#### Database Mutations

| Table | Columns Modified | Detail |
|---|---|---|
| **`CardFollowups`** | `LinkedCardId` (set if was null), `LinkedCardIds` (comma-separated string updated) | Existing row UPDATE, not INSERT |

#### Unlinking (`DELETE /api/cards/{cardId}/followups/{followupId}/link/{linkedCardId}`)

- Same auth check via `CanManageContentAsync()`
- Calls `followup.RemoveLinkedCardId(linkedCardId)`:
  - Removes from list
  - Updates `LinkedCardIds`
  - Sets `LinkedCardId` to `current[0]` or `null` if list is empty

#### Edge Cases & Exception Handling

| Error | Status | Cause |
|---|---|---|
| User lacks permission | `403 Forbidden` | `CanManageContentAsync()` returns false |
| Follow-up not found | `404 Not Found` | `followup is null` |
| Answer card doesn't exist | `400 Bad Request` | `answerCardExists == false` |
| Linking same card twice | No-op | `AddLinkedCardId` checks `!current.Contains(cardId)` |

---

## 8. Flow 7 — Enrolling in & Reviewing Exercises

### 7a. Enrolling in an Exercise

#### Trigger & Payload

| Item | Value |
|---|---|
| **User Action** | On `/exercises`, clicks "Add to Collection" button on an exercise |
| **React Source** | [`Exercises.jsx`](file:///c:/Users/USER/Desktop/projects/ankiX/src/frontend/src/pages/Exercises.jsx) |
| **HTTP Endpoint** | `POST /api/exercises/{id}/enroll` |

#### Frontend Trace

```
Exercises.jsx
├── Each exercise card shows "Add to Collection" / "Remove from Collection"
│   based on enrolledIds.has(exercise.id)
├── On "Add to Collection":
│   ├── setEnrollingId(id)
│   ├── api.enrollExercise(id)
│   │   └── fetch(POST /api/exercises/{id}/enroll, { Authorization })
│   ├── setEnrolledIds(prev => new Set([...prev, id]))
│   └── Reload due queue
├── On "Remove from Collection":
│   ├── api.unenrollExercise(id)
│   │   └── fetch(DELETE /api/exercises/{id}/enroll)
│   └── setEnrolledIds(prev => { prev.delete(id); return new Set(prev) })
```

#### Backend Pipeline

| Layer | File | Detail |
|---|---|---|
| **Controller** | [`ExercisesController.cs`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Controllers/ExercisesController.cs) | `[HttpPost("{id}/enroll")]`, `[Authorize]` class-level |

#### Service & Class Objects

1. **`ExercisesController.EnrollExercise(int id)`**
   - Extracts `userId` from JWT
   - Verifies exercise exists
   - Checks if already enrolled: `dbContext.UserExercises.AnyAsync(ue => ue.UserId == userId && ue.ExerciseId == id)`
   - If not enrolled: `dbContext.UserExercises.Add(new UserExercise { UserId, ExerciseId, EnrolledAt = UtcNow })`
   - Also creates an initial `ExerciseReviewRecord` if none exists:
     - `EaseFactor = 2.50`, `IntervalDays = 0`, `NextReviewAt = UtcNow` (immediately due), `Phase = "learning"`, `LearningStep = 0`
   - `SaveChangesAsync()`

#### Database Mutations

| Table | Columns Written | FK |
|---|---|---|
| **`UserExercises`** | `UserId`, `ExerciseId`, `EnrolledAt` | Composite PK `(UserId, ExerciseId)` |
| **`ExerciseReviewRecords`** | `Id`, `ExerciseId`, `UserId`, `Outcome = "Good"`, `EaseFactor = 2.50`, `IntervalDays = 0`, `NextReviewAt = UtcNow`, `Phase = "learning"`, `LearningStep = 0`, `CreatedAt` | Index on `(UserId, NextReviewAt)` |

### 7b. Running Exercise Code

#### Trigger & Payload

| Item | Value |
|---|---|
| **User Action** | In the exercise practice workspace, types code, clicks "▶ Run" |
| **HTTP Endpoint** | `POST /api/exercises/{id}/run` |
| **Request DTO** | `CodeRunRequest` — `{ submittedCode, language }` |

#### Backend Pipeline

The `ExercisesController.RunExercise()` action handles **three exercise types**:

**1. `CodeExecution` type** (default):
- Uses `ICodeExecutionService.ExecuteAsync()` (same service as card runs)
- Passes `exercise.TestCasesSpec ?? exercise.SolutionCode` as the validation spec

**2. `MultipleChoice` type**:
- Parses `exercise.ExerciseSpec` JSON: `{ options: string[], correctIndex: int }`
- Compares `int.TryParse(request.SubmittedCode)` against `correctIndex`
- No external execution needed

**3. `ExactString` type**:
- Parses `exercise.ExerciseSpec` JSON: `{ acceptedAnswers: string[], caseSensitive: bool }`
- Compares submitted text against accepted answers (with optional case sensitivity)
- No external execution needed

> **Note**: Unlike `CardRunsController`, exercise runs are NOT persisted to any table. They return an in-memory `CodeRunResponse` only.

### 7c. Submitting an Exercise Review

#### Trigger & Payload

| Item | Value |
|---|---|
| **User Action** | After solving exercise, rates it: Again / Hard / Good / Easy |
| **HTTP Endpoint** | `POST /api/exercises/{id}/reviews` |
| **Request DTO** | `ReviewRequest` — `{ outcome: "Again"|"Hard"|"Good"|"Easy" }` (note: `cardId` field ignored, ID comes from route) |

#### Backend Pipeline

1. **`ExercisesController.SubmitExerciseReview(int id, ReviewRequest request)`**
   - Extracts `userId` from JWT
   - Loads previous `ExerciseReviewRecord` (not `ReviewRecord`) for this user+exercise
   - Maps `ExerciseReviewRecord` → `ReviewRecord` fields (for compatibility with shared `IReviewSchedulerService`)
   - Calls `reviewSchedulerService.CalculateNextSchedule(previousRecord, request.Outcome)` — **same SM-2 algorithm as card reviews**
   - Creates new `ExerciseReviewRecord`
   - **Auto-enrolls** if not already enrolled:
     ```csharp
     if (!alreadyEnrolled)
         dbContext.UserExercises.Add(new UserExercise { UserId, ExerciseId, EnrolledAt = UtcNow });
     ```
   - `SaveChangesAsync()`

#### Database Mutations

| Table | Columns Written |
|---|---|
| **`ExerciseReviewRecords`** | `Id`, `ExerciseId`, `UserId`, `Outcome`, `EaseFactor`, `IntervalDays`, `NextReviewAt`, `Phase`, `LearningStep`, `CreatedAt` |
| **`UserExercises`** | Conditionally: `UserId`, `ExerciseId`, `EnrolledAt` (auto-enroll) |

### 7d. Getting Due Exercises

| Endpoint | Purpose |
|---|---|
| `GET /api/exercises/my-due?studyGroupId=X` | Returns only **enrolled** exercises where `NextReviewAt <= now`, scoped to user's study groups |
| `GET /api/exercises/my-collection` | Returns list of exercise IDs the user has enrolled in |

---

## 9. Entity Relationship Diagram

```mermaid
erDiagram
    Users {
        int Id PK
        string Email UK
        string PasswordHash
        string DisplayName
        string Role
        datetime2 CreatedAt
    }

    StudyGroups {
        int Id PK
        string Name
        string Slug UK
        string Description
        string AvatarUrl
        bit IsPublic
        int CreatedByUserId
        datetime2 CreatedAt
    }

    StudyGroupMembers {
        int StudyGroupId PK_FK
        int UserId PK_FK
        string Role
        datetime2 JoinedAt
    }

    Decks {
        int Id PK
        string Title
        string Description
        int CreatedByUserId FK
        int StudyGroupId FK
        datetime2 CreatedAt
    }

    Cards {
        int Id PK
        int DeckId FK
        string Type
        string Prompt
        string ValidationSpec
        datetime2 CreatedAt
    }

    CardRuns {
        bigint Id PK
        int CardId FK
        int UserId FK
        string SubmittedCode
        bit Result
        string ResultDetails
        int DurationMs
        datetime2 CreatedAt
    }

    ReviewRecords {
        bigint Id PK
        int CardId FK
        int UserId FK
        string Outcome
        decimal EaseFactor
        int IntervalDays
        datetime2 NextReviewAt
        string Phase
        int LearningStep
        datetime2 CreatedAt
    }

    CardFollowups {
        bigint Id PK
        int CardId FK
        int AuthorUserId FK
        string QuestionText
        int LinkedCardId FK_nullable
        string LinkedCardIds
        datetime2 CreatedAt
    }

    Exercises {
        int Id PK
        string Title
        string Description
        string Language
        string ExerciseType
        string ExerciseSpec
        string StarterCode
        string SolutionCode
        string TestCasesSpec
        int CreatedByUserId FK
        int StudyGroupId FK
        datetime2 CreatedAt
    }

    CardExercises {
        int CardId PK_FK
        int ExerciseId PK_FK
    }

    ExerciseReviewRecords {
        bigint Id PK
        int ExerciseId FK
        int UserId FK
        string Outcome
        decimal EaseFactor
        int IntervalDays
        datetime2 NextReviewAt
        string Phase
        int LearningStep
        datetime2 CreatedAt
    }

    UserExercises {
        int UserId PK_FK
        int ExerciseId PK_FK
        datetime2 EnrolledAt
    }

    Users ||--o{ StudyGroupMembers : "joins"
    StudyGroups ||--o{ StudyGroupMembers : "has members"
    StudyGroups ||--o{ Decks : "owns"
    StudyGroups ||--o{ Exercises : "owns"
    Decks ||--o{ Cards : "contains"
    Cards ||--o{ CardRuns : "has runs"
    Cards ||--o{ ReviewRecords : "has reviews"
    Cards ||--o{ CardFollowups : "has followups"
    Cards ||--o{ CardExercises : "linked to"
    Exercises ||--o{ CardExercises : "linked from"
    Exercises ||--o{ ExerciseReviewRecords : "has reviews"
    Exercises ||--o{ UserExercises : "enrolled by"
    Users ||--o{ CardRuns : "submitted by"
    Users ||--o{ ReviewRecords : "reviewed by"
    Users ||--o{ ExerciseReviewRecords : "reviewed by"
    Users ||--o{ UserExercises : "enrolled"
    Users ||--o{ CardFollowups : "authored"
    CardFollowups }o--o| Cards : "links to answer card"
```

---

## 10. Full DI Container & Middleware Pipeline

### All Controller → DI Dependencies

| Controller | Injected Dependencies |
|---|---|
| `AuthController` | `ApplicationDbContext`, `IPasswordService`, `ITokenService` |
| `DecksController` | `ApplicationDbContext` |
| `ContentController` | `ApplicationDbContext` |
| `CardRunsController` | `ApplicationDbContext`, `ICodeExecutionService` |
| `ReviewsController` | `ApplicationDbContext`, `IReviewSchedulerService` |
| `FollowupsController` | `ApplicationDbContext` |
| `ExercisesController` | `ApplicationDbContext`, `ICodeExecutionService`, `IReviewSchedulerService` |
| `StudyQueueController` | `ApplicationDbContext` |
| `SearchController` | `ApplicationDbContext` |
| `StudyGroupsController` | `ApplicationDbContext` |
| `AdminUsersController` | `ApplicationDbContext` |

### Authorization Patterns Used

| Pattern | Controllers | What it protects |
|---|---|---|
| No `[Authorize]` | `AuthController` (register, login) | Public endpoints |
| Class-level `[Authorize]` | All others | Requires valid JWT |
| `[Authorize(Roles = "Admin")]` | `AdminUsersController` | Admin-only |
| `[Authorize(Roles = "Contributor,Admin")]` | `DecksController` (import) | Content management |
| `CanManageContentAsync()` helper | `ContentController`, `FollowupsController`, `ExercisesController` | Checks global role OR study group member role (Owner/Admin/Contributor) |

### Role Hierarchy

```
Global Roles (User.Role):                Study Group Roles (StudyGroupMember.Role):
├── Admin     → full access everywhere   ├── Owner        → full access in group
├── Contributor → create/edit content     ├── Admin        → manage group content
└── User      → study only               ├── Contributor  → create content in group
                                          └── Member       → study only in group
```

### Frontend Routing & Protection

| Route | Component | Auth Required | Special Logic |
|---|---|---|---|
| `/` | `Home` | No | — |
| `/login` | `Login` | No | — |
| `/register` | `Register` | No | — |
| `/decks` | `Decks` | Yes (`RequireAuth`) | Scoped to active study group |
| `/decks/:id` | `Deck` | Yes | Study queue + card CRUD + follow-ups + exercises |
| `/exercises` | `Exercises` | Yes | Enrollment + due queue + practice workspace |
| `/study-groups` | `StudyGroups` | Yes | Create/join/leave + member management |
| `/search` | `Search` | Yes | Global search scoped to joined groups |
| `/admin/users` | `AdminUsers` | Yes | Shows all users; role change (Admin-only in practice) |

### Frontend State Management

The app uses **React Context** for global state:

1. **`AuthProvider`** ([`AuthProvider.jsx`](file:///c:/Users/USER/Desktop/projects/ankiX/src/frontend/src/auth/AuthProvider.jsx)):
   - Provides: `{ user, login, logout, register }`
   - Persists user object in `localStorage("ankix_user")`
   - Token persisted in `localStorage("ankix_token")` by `api.js`

2. **`StudyGroupProvider`** ([`StudyGroupProvider.jsx`](file:///c:/Users/USER/Desktop/projects/ankiX/src/frontend/src/studyGroup/StudyGroupProvider.jsx)):
   - Provides: `{ activeStudyGroup, setActiveStudyGroup }`
   - Persists in `localStorage("ankix_active_study_group")`
   - All data queries (decks, exercises, search) are scoped to `activeStudyGroup.id`

---

> **End of Feature Execution Traces** — This document covers the complete request lifecycle for
> every core user flow in the AnkiX platform, from React state management through ASP.NET Core
> controllers and services, down to Azure SQL table mutations and back.
