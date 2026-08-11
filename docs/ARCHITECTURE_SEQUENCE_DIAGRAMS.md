# AnkiX — Architecture Sequence Diagrams

> Visual execution traces for the 4 most critical workflows in the AnkiX platform.
> Each diagram follows the request from the user's browser through every architectural
> layer: React Component → api.js → ASP.NET Controller → Service → EF Core → Azure SQL.
>
> **Companion document**: [FEATURE_EXECUTION_TRACES.md](./FEATURE_EXECUTION_TRACES.md)

---

## Table of Contents

1. [Authentication Flow](#1-authentication-flow)
2. [Code Execution Flow](#2-code-execution-flow)
3. [SM-2 Spaced Repetition Review Flow](#3-sm-2-spaced-repetition-review-flow)
4. [Card Follow-up & Admin Linking Flow](#4-card-follow-up--admin-linking-flow)

---

## 1. Authentication Flow

### 1a. User Registration

```mermaid
sequenceDiagram
    actor User
    participant Register as Register.jsx
    participant API as api.js
    participant Auth as AuthController
    participant Pwd as PasswordService
    participant Helper as UserHelper
    participant Db as ApplicationDbContext
    participant SQL as Azure SQL<br/>Users Table

    User->>Register: Fills email, password, displayName<br/>Clicks "Create Account"
    activate Register
    Register->>Register: setIsLoading(true)
    Register->>API: auth.register(email, password, displayName)
    activate API

    API->>Auth: POST /api/auth/register<br/>{ email, password, displayName }
    activate Auth
    Note over Auth: No [Authorize] — public endpoint

    Auth->>Auth: normalizedEmail = email.Trim().ToLowerInvariant()

    Auth->>Db: Users.AnyAsync(u => u.Email == normalizedEmail)
    activate Db
    Db->>SQL: SELECT COUNT(*) FROM Users WHERE Email = @email
    activate SQL
    SQL-->>Db: 0 (not found)
    deactivate SQL
    Db-->>Auth: false (email available)
    deactivate Db

    alt Email already exists
        Auth-->>API: 409 Conflict { message: "Email already exists." }
        API-->>Register: throw Error("Email already exists.")
        Register->>User: alert("Register failed: Email already exists.")
    end

    Auth->>Helper: GetEffectiveDisplayName(displayName, email)
    activate Helper
    Note over Helper: If displayName is blank or<br/>looks like an email,<br/>extract part before @
    Helper-->>Auth: "alex" (derived display name)
    deactivate Helper

    Auth->>Pwd: HashPassword(password)
    activate Pwd
    Note over Pwd: PBKDF2-SHA256<br/>100,000 iterations<br/>16-byte salt, 32-byte hash
    Pwd->>Pwd: salt = RandomNumberGenerator.GetBytes(16)
    Pwd->>Pwd: hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, 100000, SHA256, 32)
    Pwd-->>Auth: "base64(salt):base64(hash)"
    deactivate Pwd

    Auth->>Auth: Create User entity<br/>{ Email, PasswordHash, DisplayName, Role="User", CreatedAt=UtcNow }

    Auth->>Db: Users.Add(user)
    activate Db
    Auth->>Db: SaveChangesAsync()
    Db->>SQL: INSERT INTO Users (Email, PasswordHash, DisplayName, Role, CreatedAt)<br/>VALUES (@email, @hash, @name, 'User', @now)
    activate SQL
    SQL-->>Db: Id = 42 (auto-increment)
    deactivate SQL
    Db-->>Auth: Saved (user.Id = 42)
    deactivate Db

    Auth-->>API: 201 Created<br/>{ userId: 42, email, displayName, role: "User" }
    deactivate Auth

    API-->>Register: Response data
    deactivate API

    Register->>User: alert("Registered successfully — please login")
    Register->>Register: window.location.href = '/login'
    deactivate Register
```

### 1b. User Login & JWT Generation

```mermaid
sequenceDiagram
    actor User
    participant Login as Login.jsx
    participant API as api.js
    participant Provider as AuthProvider
    participant Auth as AuthController
    participant Pwd as PasswordService
    participant Token as TokenService
    participant Helper as UserHelper
    participant Db as ApplicationDbContext
    participant SQL as Azure SQL<br/>Users Table

    User->>Login: Fills email & password<br/>Clicks "Log In"
    activate Login
    Login->>Login: setIsLoading(true)
    Login->>Provider: auth.login(email, password)
    activate Provider
    Provider->>API: api.login(email, password)
    activate API

    API->>Auth: POST /api/auth/login<br/>{ email, password }
    activate Auth
    Note over Auth: No [Authorize] — public endpoint

    Auth->>Auth: normalizedEmail = email.Trim().ToLowerInvariant()

    Auth->>Db: Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail)
    activate Db
    Db->>SQL: SELECT TOP 1 * FROM Users WHERE Email = @email
    activate SQL
    SQL-->>Db: User row { Id:42, Email, PasswordHash, DisplayName, Role }
    deactivate SQL
    Db-->>Auth: User entity (or null)
    deactivate Db

    alt User not found OR wrong password
        Auth-->>API: 401 Unauthorized { message: "Invalid credentials." }
        Note over Auth: Same error for both —<br/>prevents email enumeration
        API-->>Login: throw Error
        Login->>User: alert("Login failed")
    end

    Auth->>Pwd: VerifyPassword(password, user.PasswordHash)
    activate Pwd
    Pwd->>Pwd: Split hash at ":"<br/>salt = base64Decode(parts[0])<br/>expected = base64Decode(parts[1])
    Pwd->>Pwd: provided = Rfc2898DeriveBytes.Pbkdf2(password, salt, 100000, SHA256, 32)
    Pwd->>Pwd: CryptographicOperations.FixedTimeEquals(expected, provided)
    Note over Pwd: Timing-safe comparison<br/>prevents side-channel attacks
    Pwd-->>Auth: true ✓
    deactivate Pwd

    Auth->>Token: CreateToken(user)
    activate Token
    Token->>Token: signingKey = HMAC-SHA256(JwtOptions.SigningKey)
    Token->>Helper: GetEffectiveDisplayName(user.DisplayName, user.Email)
    Helper-->>Token: "alex"
    Token->>Token: Build claims:<br/>NameIdentifier = "42"<br/>Email = "alex@example.com"<br/>GivenName = "alex"<br/>displayName = "alex"<br/>Role = "User"
    Token->>Token: Expiry = UtcNow + 60 min<br/>Issuer = "ankiX.api"<br/>Audience = "ankiX.web"
    Token->>Token: JwtSecurityTokenHandler.WriteToken()
    Token-->>Auth: "eyJhbGciOi..."  (JWT string)
    deactivate Token

    Auth->>Auth: Build AuthResponse<br/>{ accessToken, expiresInSeconds: 3600, user: { id, email, displayName, role } }
    Auth-->>API: 200 OK { accessToken, expiresInSeconds, user }
    deactivate Auth

    API->>API: localStorage.setItem("ankix_token", accessToken)
    API->>API: localStorage.setItem("ankix_user", JSON.stringify(user))
    API-->>Provider: { accessToken, expiresInSeconds, user }
    deactivate API

    Provider->>Provider: setUser(data.user)
    Provider->>Provider: localStorage.setItem("ankix_user", JSON.stringify(data.user))
    Provider-->>Login: data
    deactivate Provider

    Login->>Login: window.location.href = '/decks'
    Login->>User: Redirect to Decks page (authenticated)
    deactivate Login
```

---

## 2. Code Execution Flow

```mermaid
sequenceDiagram
    actor User
    participant Deck as Deck.jsx<br/>(micro-coding card)
    participant API as api.js
    participant Ctrl as CardRunsController
    participant Exec as CodeExecutionService
    participant Piston as Piston API /<br/>Native Process
    participant Db as ApplicationDbContext
    participant SQL as Azure SQL

    User->>Deck: Types code in editor<br/>Clicks "▶ Run"
    activate Deck
    Deck->>Deck: setRunning(true)

    Deck->>API: api.runCardCode(cardId, userCode, 'python')
    activate API
    API->>API: authHeaders() — reads localStorage("ankix_token")<br/>Attaches Authorization: Bearer <JWT>

    API->>Ctrl: POST /api/cards/{cardId}/run<br/>{ submittedCode, language: "python" }
    activate Ctrl
    Note over Ctrl: [Authorize] — JWT validated<br/>by middleware pipeline

    Ctrl->>Ctrl: userId = User.FindFirstValue(ClaimTypes.NameIdentifier)
    alt Invalid JWT claims
        Ctrl-->>API: 401 Unauthorized
    end

    Ctrl->>Db: Cards.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cardId)
    activate Db
    Db->>SQL: SELECT * FROM Cards WHERE Id = @cardId
    activate SQL
    SQL-->>Db: Card { Id, DeckId, Type, Prompt, ValidationSpec }
    deactivate SQL
    Db-->>Ctrl: Card entity (or null → 404)
    deactivate Db

    alt Card not found
        Ctrl-->>API: 404 Not Found { message: "Card not found." }
    end

    Ctrl->>Exec: ExecuteAsync(submittedCode, "python", card.ValidationSpec, ct)
    activate Exec

    alt Empty submitted code
        Exec-->>Ctrl: { Passed:false, Details:"Submitted code cannot be empty." }
    end

    alt Path A — Piston API Proxy (BaseUrl configured)
        Exec->>Exec: NormalizePistonLanguage("python") → "python"
        Exec->>Exec: BuildTestHarness(code, language, validationSpec)
        Note over Exec: Combines user code + test<br/>assertions from validationSpec

        Exec->>Piston: POST /execute<br/>{ language:"python", version:"*",<br/>  files:[{ content: harness }] }
        activate Piston
        Note over Piston: Sandboxed container<br/>executes user code +<br/>test suite
        Piston-->>Exec: { run: { stdout:"✓ Passed!", stderr:"", code:0 } }
        deactivate Piston

        Exec->>Exec: passed = (code == 0 && stderr is empty)
        Exec->>Exec: details = stdout.Trim()
    else Path B — Native Host Process (no BaseUrl, local dev)
        Exec->>Exec: Write code + tests to temp file<br/>ankix_run_{guid}.py
        Exec->>Piston: Spawn: python3 "ankix_run_{guid}.py"
        activate Piston
        Note over Piston: Local OS process<br/>5-second timeout<br/>(CancellationTokenSource)
        Piston-->>Exec: stdout + stderr + exitCode
        deactivate Piston
        Exec->>Exec: passed = (exitCode == 0 && stderr empty)
        Exec->>Exec: Delete temp file in finally block
    end

    Exec-->>Ctrl: CodeExecutionResult { Passed:true, DurationMs:245, Details:"✓ All Tests Passed!" }
    deactivate Exec

    Ctrl->>Ctrl: Create CardRun entity<br/>{ CardId, UserId, SubmittedCode,<br/>  Result:true, ResultDetails, DurationMs, CreatedAt }

    Ctrl->>Db: CardRuns.Add(run)
    activate Db
    Ctrl->>Db: SaveChangesAsync()
    Db->>SQL: INSERT INTO CardRuns<br/>(CardId, UserId, SubmittedCode, Result,<br/> ResultDetails, DurationMs, CreatedAt)<br/>VALUES (@cardId, @userId, @code, 1, @details, 245, @now)
    activate SQL
    SQL-->>Db: Id = 1001 (bigint auto)
    deactivate SQL
    Db-->>Ctrl: Saved
    deactivate Db

    Ctrl-->>API: 200 OK<br/>{ runId:1001, result:"PASS", passed:true,<br/>  durationMs:245, details:"✓ All Tests Passed!" }
    deactivate Ctrl

    API-->>Deck: CodeRunResponse
    deactivate API

    Deck->>Deck: setRunResult({ passed:true, details, durationMs })
    Deck->>Deck: setRunning(false)
    Deck->>User: Display: ✅ PASS — "✓ All Tests Passed!" (245ms)
    deactivate Deck
```

---

## 3. SM-2 Spaced Repetition Review Flow

```mermaid
sequenceDiagram
    actor User
    participant Deck as Deck.jsx<br/>(Study Queue)
    participant API as api.js
    participant Rev as ReviewsController
    participant Sched as ReviewSchedulerService
    participant Db as ApplicationDbContext
    participant SQL as Azure SQL

    Note over Deck: User is studying card #7<br/>from the study queue<br/>(showing Prompt + Answer)

    User->>Deck: Clicks "Good" rating button
    activate Deck
    Deck->>Deck: setSubmittingRating(true)

    Deck->>API: api.submitReview(cardId=7, outcome="Good")
    activate API
    API->>API: authHeaders() — Bearer token attached

    API->>Rev: POST /api/reviews<br/>{ cardId: 7, outcome: "Good" }
    activate Rev
    Note over Rev: [Authorize] class-level<br/>[HttpPost]

    Rev->>Rev: userId = JWT ClaimTypes.NameIdentifier → 42

    Rev->>Db: Cards.AnyAsync(c => c.Id == 7)
    activate Db
    Db->>SQL: SELECT CASE WHEN EXISTS (SELECT 1 FROM Cards WHERE Id=7) THEN 1 ELSE 0 END
    activate SQL
    SQL-->>Db: 1 (exists)
    deactivate SQL
    Db-->>Rev: true ✓
    deactivate Db

    Rev->>Db: ReviewRecords.Where(r => r.UserId==42 && r.CardId==7)<br/>.OrderByDescending(r => r.CreatedAt).FirstOrDefaultAsync()
    activate Db
    Db->>SQL: SELECT TOP 1 * FROM ReviewRecords<br/>WHERE UserId=42 AND CardId=7<br/>ORDER BY CreatedAt DESC
    activate SQL
    SQL-->>Db: Previous record:<br/>{ Phase:"learning", LearningStep:0,<br/>  EaseFactor:2.50, IntervalDays:0 }
    deactivate SQL
    Db-->>Rev: ReviewRecord (previous)
    deactivate Db

    Rev->>Sched: CalculateNextSchedule(previousRecord, "Good")
    activate Sched

    Note over Sched: Previous: Phase=learning, Step=0<br/>Outcome: "Good"<br/>Rule: "Good" at step 0 → advance to step 1

    alt Brand-new card (previousRecord is null)
        Note over Sched: Again/Hard → learning step 0 (+1min)<br/>Good → learning step 1 (+10min)<br/>Easy → review (+1 day, ease 2.60)
    end

    alt Learning phase (this case)
        Sched->>Sched: outcome="Good", step=0<br/>→ MakeLearning(step:1, ease:2.50)
        Sched->>Sched: LearningStepMinutes[1] = 10
        Sched->>Sched: NextReviewAt = UtcNow + 10 minutes
        Sched-->>Rev: ReviewScheduleResult {<br/>  Phase: "learning",<br/>  LearningStep: 1,<br/>  EaseFactor: 2.50,<br/>  IntervalDays: 0,<br/>  NextReviewAt: +10min<br/>}
    end

    alt Review phase (graduated card)
        Note over Sched: Again → Lapse: back to learning, ease-0.20<br/>Hard → interval×1.20, ease-0.15<br/>Good → interval×ease (unchanged)<br/>Easy → interval×ease×1.30, ease+0.15
    end

    deactivate Sched

    Rev->>Rev: Create ReviewRecord entity:<br/>{ CardId:7, UserId:42, Outcome:"Good",<br/>  EaseFactor:2.50, IntervalDays:0,<br/>  NextReviewAt:+10min, Phase:"learning",<br/>  LearningStep:1, CreatedAt:UtcNow }

    Rev->>Db: ReviewRecords.Add(newRecord)
    activate Db
    Rev->>Db: SaveChangesAsync()
    Db->>SQL: INSERT INTO ReviewRecords<br/>(CardId, UserId, Outcome, EaseFactor,<br/> IntervalDays, NextReviewAt, Phase,<br/> LearningStep, CreatedAt)<br/>VALUES (7, 42, 'Good', 2.50, 0,<br/> @nextReview, 'learning', 1, @now)
    activate SQL
    SQL-->>Db: Id = 500 (bigint auto)
    deactivate SQL
    Db-->>Rev: Saved
    deactivate Db

    Rev-->>API: 200 OK ReviewResponse {<br/>  cardId:7, nextReviewAt: "...",<br/>  easeFactor:2.50, intervalDays:0,<br/>  phase:"learning"<br/>}
    deactivate Rev

    API-->>Deck: ReviewResponse
    deactivate API

    Deck->>Deck: Advance to next card:<br/>setCurrentIndex(prev + 1)
    Deck->>Deck: setShowAnswer(false)<br/>setUserCode('')
    Deck->>Deck: setSubmittingRating(false)

    alt All cards in queue reviewed
        Deck->>Deck: loadQueue() — reload study queue<br/>Cards re-sorted: Learning → Review → New
    end

    Deck->>User: Show next due card from queue
    deactivate Deck
```

### SM-2 Algorithm State Machine

```mermaid
stateDiagram-v2
    [*] --> New: Card never reviewed

    New --> Learning_Step0: Again / Hard
    New --> Learning_Step1: Good
    New --> Review: Easy (interval=1d, ease=2.60)

    state "Learning Phase" as LP {
        Learning_Step0: Step 0 (+1 min)
        Learning_Step1: Step 1 (+10 min)

        Learning_Step0 --> Learning_Step0: Again / Hard
        Learning_Step0 --> Learning_Step1: Good
        Learning_Step1 --> Learning_Step0: Again / Hard
    }

    Learning_Step1 --> Review: Good (graduate, +1 day)
    Learning_Step0 --> Review: Easy (+4 days, ease+0.15)
    Learning_Step1 --> Review: Easy (+4 days, ease+0.15)

    state "Review Phase" as RP {
        Review: Graduated Card
        Review --> Review: Hard (int×1.20, ease-0.15)
        Review --> Review: Good (int×ease)
        Review --> Review: Easy (int×ease×1.30, ease+0.15)
    }

    Review --> Learning_Step0: Again (LAPSE, ease-0.20)
```

---

## 4. Card Follow-up & Admin Linking Flow

### 4a. Adding a Follow-up Question (Any Authenticated User)

```mermaid
sequenceDiagram
    actor User
    participant Deck as Deck.jsx<br/>(Follow-up Panel)
    participant API as api.js
    participant Ctrl as FollowupsController
    participant Helper as UserHelper
    participant Db as ApplicationDbContext
    participant SQL as Azure SQL

    Note over Deck: User is studying Card #7<br/>Has a question about the topic

    User->>Deck: Clicks "Follow-ups" toggle
    activate Deck

    Deck->>API: api.getFollowups(cardId=7)
    activate API
    API->>Ctrl: GET /api/cards/7/followups
    activate Ctrl

    Ctrl->>Db: Cards.AnyAsync(c => c.Id == 7)
    activate Db
    Db->>SQL: SELECT ... FROM Cards WHERE Id = 7
    SQL-->>Db: exists ✓
    Db-->>Ctrl: true
    deactivate Db

    Ctrl->>Db: CardFollowups.Where(f => f.CardId == 7)<br/>.OrderBy(f => f.CreatedAt)
    activate Db
    Db->>SQL: SELECT * FROM CardFollowups<br/>WHERE CardId = 7 ORDER BY CreatedAt
    SQL-->>Db: 2 followup rows
    Db-->>Ctrl: List of CardFollowup entities
    deactivate Db

    Ctrl->>Db: Users.Where(u => authorIds.Contains(u.Id))
    activate Db
    Note over Ctrl: Batch-load author display names<br/>(single query for all distinct authors)
    Db->>SQL: SELECT Id, DisplayName, Email FROM Users<br/>WHERE Id IN (42, 55)
    SQL-->>Db: Author rows
    Db-->>Ctrl: Author data
    deactivate Db

    Ctrl->>Helper: GetEffectiveDisplayName(displayName, email)
    Note over Helper: For each author:<br/>derive clean display name

    Ctrl->>Ctrl: Build FollowupResponse[]<br/>including followup.GetLinkedCardIdList()
    Note over Ctrl: GetLinkedCardIdList() merges<br/>LinkedCardId + LinkedCardIds CSV<br/>into deduplicated List of int

    Ctrl-->>API: 200 OK [ FollowupResponse, FollowupResponse ]
    deactivate Ctrl
    API-->>Deck: followups array
    deactivate API

    Deck->>Deck: setFollowups(response)
    Deck->>User: Render follow-up list<br/>(author, timestamp, linked badge)

    User->>Deck: Types question:<br/>"What's the difference between<br/>merge sort and quick sort?"
    Deck->>Deck: setNewQuestion("What's the difference...")

    User->>Deck: Clicks "Submit"
    Deck->>Deck: setSubmittingFollowup(true)

    Deck->>API: api.addFollowup(7, questionText)
    activate API
    API->>Ctrl: POST /api/cards/7/followups<br/>{ questionText: "What's the difference..." }
    activate Ctrl
    Note over Ctrl: [Authorize] class-level<br/>Any authenticated user can post

    Ctrl->>Ctrl: userId = JWT claims → 42

    Ctrl->>Db: Cards.AnyAsync(c => c.Id == 7)
    activate Db
    Db->>SQL: Card exists check
    SQL-->>Db: true ✓
    Db-->>Ctrl: true
    deactivate Db

    Ctrl->>Ctrl: Create CardFollowup:<br/>{ CardId:7, AuthorUserId:42,<br/>  QuestionText: (trimmed),<br/>  LinkedCardId:null,<br/>  LinkedCardIds:null,<br/>  CreatedAt:UtcNow }

    Ctrl->>Db: CardFollowups.Add(followup)
    activate Db
    Ctrl->>Db: SaveChangesAsync()
    Db->>SQL: INSERT INTO CardFollowups<br/>(CardId, AuthorUserId, QuestionText,<br/> LinkedCardId, LinkedCardIds, CreatedAt)<br/>VALUES (7, 42, @text, NULL, NULL, @now)
    activate SQL
    SQL-->>Db: Id = 301 (bigint auto)
    deactivate SQL
    Db-->>Ctrl: Saved
    deactivate Db

    Ctrl->>Db: Users.Where(u => u.Id == 42)
    activate Db
    Db->>SQL: SELECT DisplayName, Email FROM Users WHERE Id=42
    SQL-->>Db: { DisplayName:"Alex", Email:"alex@..." }
    Db-->>Ctrl: Author info
    deactivate Db
    Ctrl->>Helper: GetEffectiveDisplayName("Alex", "alex@...")
    Helper-->>Ctrl: "Alex"

    Ctrl-->>API: 201 Created FollowupResponse {<br/>  id:301, cardId:7, authorUserId:42,<br/>  authorDisplayName:"Alex",<br/>  questionText:"What's the difference...",<br/>  linkedCardId:null, linkedCardIds:[],<br/>  createdAt:"..." }
    deactivate Ctrl

    API-->>Deck: new followup object
    deactivate API

    Deck->>Deck: setFollowups(prev => [...prev, newFollowup])
    Deck->>Deck: setNewQuestion('')
    Deck->>Deck: setSubmittingFollowup(false)
    Deck->>User: New follow-up appears in list ✓
    deactivate Deck
```

### 4b. Admin/Contributor Linking an Answer Card to a Follow-up

```mermaid
sequenceDiagram
    actor Admin
    participant Deck as Deck.jsx<br/>(Admin View)
    participant API as api.js
    participant Ctrl as FollowupsController
    participant Db as ApplicationDbContext
    participant SQL as Azure SQL

    Note over Admin: Admin sees unanswered follow-up #301<br/>on Card #7. Wants to link Card #15<br/>as the answer card.

    Admin->>Deck: Clicks "Link Card" on follow-up #301
    activate Deck
    Deck->>Deck: Open link modal<br/>Admin enters linkedCardId = 15

    Admin->>Deck: Confirms link
    Deck->>API: api.linkFollowupToCard(7, 301, 15)
    activate API
    API->>API: authHeaders() — Bearer token (Admin role)

    API->>Ctrl: PATCH /api/cards/7/followups/301/link<br/>{ linkedCardId: 15 }
    activate Ctrl
    Note over Ctrl: [HttpPatch("{followupId}/link")]<br/>[Authorize] class-level

    rect rgb(255, 245, 230)
        Note over Ctrl,SQL: Authorization Check: CanManageContentAsync()
        Ctrl->>Db: Cards.FirstOrDefaultAsync(c => c.Id == 7)
        activate Db
        Db->>SQL: SELECT * FROM Cards WHERE Id = 7
        SQL-->>Db: Card { DeckId: 3 }
        Db-->>Ctrl: card
        deactivate Db

        Ctrl->>Db: Decks.FirstOrDefaultAsync(d => d.Id == 3)
        activate Db
        Db->>SQL: SELECT * FROM Decks WHERE Id = 3
        SQL-->>Db: Deck { StudyGroupId: 1 }
        Db-->>Ctrl: deck
        deactivate Db

        Ctrl->>Ctrl: CanManageContentAsync(studyGroupId: 1)

        alt User.IsInRole("Admin") or User.IsInRole("Contributor")
            Note over Ctrl: ✓ Global role grants access
        else Check study group membership
            Ctrl->>Db: StudyGroupMembers.Where(<br/>m => m.StudyGroupId==1 && m.UserId==42)
            activate Db
            Db->>SQL: SELECT Role FROM StudyGroupMembers<br/>WHERE StudyGroupId=1 AND UserId=42
            SQL-->>Db: "Owner" / "Admin" / "Contributor"
            Db-->>Ctrl: memberRole
            deactivate Db
            Note over Ctrl: ✓ if Owner/Admin/Contributor<br/>✗ if Member or not found → 403 Forbid
        end
    end

    alt Authorization failed
        Ctrl-->>API: 403 Forbidden
        API-->>Deck: throw Error
        Deck->>Admin: Permission denied
    end

    Ctrl->>Db: CardFollowups.FirstOrDefaultAsync(<br/>f => f.Id == 301 && f.CardId == 7)
    activate Db
    Db->>SQL: SELECT * FROM CardFollowups<br/>WHERE Id=301 AND CardId=7
    activate SQL
    SQL-->>Db: CardFollowup entity
    deactivate SQL
    Db-->>Ctrl: followup (or null → 404)
    deactivate Db

    alt Follow-up not found
        Ctrl-->>API: 404 Not Found { message: "Follow-up not found." }
    end

    Ctrl->>Db: Cards.AnyAsync(c => c.Id == 15)
    activate Db
    Db->>SQL: SELECT ... FROM Cards WHERE Id = 15
    SQL-->>Db: exists ✓
    Db-->>Ctrl: true
    deactivate Db

    alt Answer card doesn't exist
        Ctrl-->>API: 400 Bad Request { message: "Linked answer card not found." }
    end

    Ctrl->>Ctrl: followup.AddLinkedCardId(15)
    Note over Ctrl: CardFollowup.AddLinkedCardId():<br/>1. current = GetLinkedCardIdList()<br/>   (merges LinkedCardId + LinkedCardIds CSV)<br/>2. Add 15 if not already present<br/>3. Set LinkedCardId = 15 (if was null)<br/>4. LinkedCardIds = "15" (comma-sep string)

    Ctrl->>Db: SaveChangesAsync()
    activate Db
    Db->>SQL: UPDATE CardFollowups<br/>SET LinkedCardId = 15,<br/>    LinkedCardIds = '15'<br/>WHERE Id = 301
    activate SQL
    SQL-->>Db: 1 row updated
    deactivate SQL
    Db-->>Ctrl: Saved ✓
    deactivate Db

    Ctrl-->>API: 200 OK {<br/>  message: "Follow-up linked to answer card.",<br/>  linkedCardId: 15,<br/>  linkedCardIds: [15]<br/>}
    deactivate Ctrl

    API-->>Deck: Success response
    deactivate API

    Deck->>Deck: Refresh followups list
    Deck->>Admin: Follow-up #301 now shows<br/>"📎 Linked to Card #15" badge
    deactivate Deck

    Note over Admin: Later, user studying Card #7<br/>can click the linked card badge<br/>to preview Card #15 as the answer
```

### 4c. Unlinking a Card from a Follow-up

```mermaid
sequenceDiagram
    actor Admin
    participant Deck as Deck.jsx
    participant API as api.js
    participant Ctrl as FollowupsController
    participant Db as ApplicationDbContext
    participant SQL as Azure SQL

    Admin->>Deck: Clicks "Unlink" on follow-up #301, card #15
    activate Deck

    Deck->>API: api.unlinkFollowupCard(7, 301, 15)
    activate API
    API->>Ctrl: DELETE /api/cards/7/followups/301/link/15
    activate Ctrl

    Note over Ctrl: Same CanManageContentAsync() check

    Ctrl->>Db: Load Card → Deck → check StudyGroup auth
    Db->>SQL: Auth queries (same as link flow)

    Ctrl->>Db: CardFollowups.FirstOrDefaultAsync(f => f.Id==301 && f.CardId==7)
    Db->>SQL: SELECT * FROM CardFollowups WHERE Id=301 AND CardId=7
    SQL-->>Db: CardFollowup entity

    Ctrl->>Ctrl: followup.RemoveLinkedCardId(15)
    Note over Ctrl: CardFollowup.RemoveLinkedCardId():<br/>1. current = GetLinkedCardIdList()<br/>2. current.Remove(15)<br/>3. LinkedCardIds = null (list empty)<br/>4. LinkedCardId = null (list empty)

    Ctrl->>Db: SaveChangesAsync()
    Db->>SQL: UPDATE CardFollowups<br/>SET LinkedCardId = NULL,<br/>    LinkedCardIds = NULL<br/>WHERE Id = 301
    SQL-->>Db: 1 row updated

    Ctrl-->>API: 200 OK { message: "Follow-up unlinked.", linkedCardIds: [] }
    deactivate Ctrl
    API-->>Deck: Success
    deactivate API

    Deck->>Admin: Badge removed, follow-up shows as unanswered
    deactivate Deck
```

---

> **End of Architecture Sequence Diagrams** — These 4 workflows trace every HTTP request
> from the user's browser through the full React → api.js → ASP.NET → EF Core → SQL stack,
> including all authorization checks, error branches, and database mutations.
