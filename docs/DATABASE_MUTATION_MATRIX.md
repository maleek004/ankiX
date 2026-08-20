# AnkiX — Database Mutation Matrix

> **Purpose**: A comprehensive reference document detailing all database table transformations, lifecycle operations (INSERT, UPDATE, DELETE), mutated columns, and integrity constraint safeguards across the AnkiX platform.
>
> **DbContext Source**: [`ApplicationDbContext.cs`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Data/ApplicationDbContext.cs)
> **Companion Documents**:
> - [FEATURE_EXECUTION_TRACES.md](./FEATURE_EXECUTION_TRACES.md)
> - [ARCHITECTURE_SEQUENCE_DIAGRAMS.md](./ARCHITECTURE_SEQUENCE_DIAGRAMS.md)

---

## Table of Contents

1. [DbContext Schema Overview](#1-dbcontext-schema-overview)
2. [Database Mutation Matrix Summary](#2-database-mutation-matrix-summary)
3. [Per-Table Detailed Mutation Traces](#3-per-table-detailed-mutation-traces)
   - [3.1 Users](#31-users)
   - [3.2 Decks](#32-decks)
   - [3.3 Cards](#33-cards)
   - [3.4 ReviewRecords](#34-reviewrecords)
   - [3.5 CardRuns](#35-cardruns)
   - [3.6 CardFollowups](#36-cardfollowups)
   - [3.7 Exercises](#37-exercises)
   - [3.8 UserExercises](#38-userexercises)
   - [3.9 CardExercises](#39-cardexercises)
   - [3.10 ExerciseReviewRecords](#310-exercisereviewrecords)
   - [3.11 StudyGroups](#311-studygroups)
   - [3.12 StudyGroupMembers](#312-studygroupmembers)
4. [Concurrency Control, Data Integrity & State Safeguards](#4-concurrency-control-data-integrity--state-safeguards)

---

## 1. DbContext Schema Overview

The AnkiX platform persistence layer is built on Entity Framework Core mapped to Azure SQL Database via `ApplicationDbContext`.

### Managed Tables (`DbSet<T>`)

| Table Name | Entity Class | Primary Key Strategy | Indexes & Key Constraints |
|---|---|---|---|
| **`Users`** | `User` | `int Id` (Identity) | `IX_Users_Email` (Unique) |
| **`Decks`** | `Deck` | `int Id` (Identity) | `IX_Decks_StudyGroupId` |
| **`Cards`** | `Card` | `int Id` (Identity) | `IX_Cards_DeckId` |
| **`ReviewRecords`** | `ReviewRecord` | `long Id` (Identity) | `IX_ReviewRecords_UserId_NextReviewAt` |
| **`CardRuns`** | `CardRun` | `long Id` (Identity) | `IX_CardRuns_UserId_CardId` |
| **`CardFollowups`** | `CardFollowup` | `long Id` (Identity) | `IX_CardFollowups_CardId`, `IX_CardFollowups_AuthorUserId` |
| **`Exercises`** | `Exercise` | `int Id` (Identity) | `IX_Exercises_StudyGroupId` |
| **`UserExercises`** | `UserExercise` | Composite `(UserId, ExerciseId)` | Clustered Composite PK |
| **`CardExercises`** | `CardExercise` | Composite `(CardId, ExerciseId)` | Clustered Composite PK, `IX_CardExercises_ExerciseId` |
| **`ExerciseReviewRecords`** | `ExerciseReviewRecord` | `long Id` (Identity) | `IX_ExerciseReviewRecords_UserId_NextReviewAt` |
| **`StudyGroups`** | `StudyGroup` | `int Id` (Identity) | `IX_StudyGroups_Slug` (Unique) |
| **`StudyGroupMembers`** | `StudyGroupMember` | Composite `(StudyGroupId, UserId)` | Clustered Composite PK |

---

## 2. Database Mutation Matrix Summary

| Table | INSERT Endpoints | UPDATE Endpoints & Mutated Columns | DELETE / Soft-Delete Endpoints | Integrity & Concurrency Safeguards |
|---|---|---|---|---|
| **`Users`** | `POST /api/auth/register`<br/>`POST /api/admin/users`<br/>`Program.cs` (Seed) | `PUT /api/admin/users/{id}/role`<br/>↳ `Role` | None (Permanent user retention) | Unique index on `Email`; timing-safe password hash verify; `409 Conflict` duplicate check |
| **`Decks`** | `POST /api/content/decks`<br/>`POST /api/decks`<br/>`Program.cs` (Seed) | `PUT /api/content/decks/{id}`<br/>`PUT /api/decks/{id}`<br/>↳ `Title`, `Description` | `DELETE /api/content/decks/{id}`<br/>`DELETE /api/decks/{id}`<br/>*(Blocked if cards exist)* | Ownership/Role check (`CanManageContentAsync`); foreign key guard prevents deck deletion with cards (`409 Conflict`) |
| **`Cards`** | `POST /api/content/cards`<br/>`POST /api/decks/{id}/cards`<br/>`POST /api/decks/{id}/import-cards`<br/>`POST /api/decks/{id}/import-cards-text`<br/>`Program.cs` (Seed) | `PUT /api/content/cards/{id}`<br/>`PUT /api/decks/{id}/cards/{id}`<br/>↳ `Type`, `Prompt`, `Answer` | `DELETE /api/content/cards/{id}`<br/>`DELETE /api/decks/{id}/cards/{id}` | Type discriminator (`basic`, `concept`); required non-empty Markdown `Prompt` & `Answer`; parent Deck existence check |
| **`ReviewRecords`** | `POST /api/reviews` | None (Append-only immutable audit ledger) | None | Compound index on `(UserId, NextReviewAt)`; outcome validation regex (`Again\|Hard\|Good\|Easy`) |
| *~~`CardRuns`~~* | *Dropped in Migration* | *N/A (Code execution migrated to Exercises)* | *N/A* | *Table dropped; execution runs live under `POST /api/exercises/{id}/run`* |
| **`CardFollowups`** | `POST /api/cards/{id}/followups` | `PATCH /api/cards/{id}/followups/{id}/link`<br/>↳ `LinkedCardId`, `LinkedCardIds`<br/>`DELETE /api/cards/{id}/followups/{id}/link/{linkedId}`<br/>↳ `LinkedCardId`, `LinkedCardIds` | None (Question text preserved) | `CanManageContentAsync` authorization on link/unlink; deduplicated CSV helper methods (`AddLinkedCardId`, `RemoveLinkedCardId`) |
| **`Exercises`** | `POST /api/exercises`<br/>`Program.cs` (Seed) | `PUT /api/exercises/{id}`<br/>↳ `Title`, `Description`, `Language`, `ExerciseType`, `ExerciseSpec`, `StarterCode`, `SolutionCode`, `TestCasesSpec` | `DELETE /api/exercises/{id}`<br/>*(Cascade cleanup of `CardExercises`)* | Authorization check; explicit manual cascade delete of `CardExercises` and `ExerciseReviewRecords` on deletion |
| **`UserExercises`** | `POST /api/exercises/{id}/enroll`<br/>`POST /api/exercises/{id}/reviews` *(Auto-enroll)* | None (Enrollment timestamp is fixed) | `DELETE /api/exercises/{id}/enroll` | Composite Primary Key `(UserId, ExerciseId)` prevents duplicate enrollments |
| **`CardExercises`** | `POST /api/cards/{id}/exercises/{exId}`<br/>`Program.cs` (Seed) | None | `DELETE /api/cards/{id}/exercises/{exId}` | Composite Primary Key `(CardId, ExerciseId)`; foreign key checks on both entities |
| **`ExerciseReviewRecords`** | `POST /api/exercises/{id}/reviews`<br/>`POST /api/exercises/{id}/enroll` *(Initial zero-record)* | None (Append-only immutable audit ledger) | `DELETE /api/exercises/{id}` *(Cascade cleanup when exercise deleted)* | Compound index on `(UserId, NextReviewAt)`; SM-2 bounds checking |
| **`StudyGroups`** | `POST /api/study-groups`<br/>`Program.cs` (Seed) | None | None | Unique index on `Slug`; slug sanitization & auto-uniqueness suffix generator |
| **`StudyGroupMembers`** | `POST /api/study-groups/{id}/join`<br/>`POST /api/study-groups/{id}/members`<br/>`POST /api/study-groups/{id}` *(Owner creator)* | `PUT /api/study-groups/{id}/members/{userId}`<br/>↳ `Role` | `POST /api/study-groups/{id}/leave`<br/>`DELETE /api/study-groups/{id}/members/{userId}` | Composite PK `(StudyGroupId, UserId)`; role validation (`Owner`, `Admin`, `Contributor`, `Member`) |

---

## 3. Per-Table Detailed Mutation Traces

### 3.1 Users

Stores platform user identities, authentication credentials (PBKDF2-SHA256 password hashes), and global role assignments.

- **INSERT Endpoints**:
  - `POST /api/auth/register` — Creates standard user accounts (`Role = "User"`).
  - `POST /api/admin/users` — Admin creation of accounts with specified role (`Admin`, `Contributor`, or `User`).
  - `Program.cs` (Seed) — Seeded default admin account (`admin@ankix.local`).
- **UPDATE Endpoints & Mutated Columns**:
  - `PUT /api/admin/users/{userId}/role`
    - Mutated Column: `Role` (string: `"Admin"`, `"Contributor"`, or `"User"`).
- **DELETE Endpoints**:
  - *None*. Users are permanently retained to preserve auditability of historical `ReviewRecords`, `CardRuns`, and `CardFollowups`.
- **Constraint Protections**:
  - Unique Non-Clustered Index: `IX_Users_Email` enforced at database level (`modelBuilder.Entity<User>().HasIndex(u => u.Email).IsUnique()`).
  - `AuthController.cs` pre-validates uniqueness via `dbContext.Users.AnyAsync(u => u.Email == normalizedEmail)` and returns `409 Conflict`.
  - Password hashes are verified using `CryptographicOperations.FixedTimeEquals` to prevent side-channel timing attacks.

---

### 3.2 Decks

Groups flashcards under a specific subject and study group.

- **INSERT Endpoints**:
  - `POST /api/content/decks` & `POST /api/decks`
    - Injected properties: `Title`, `Description`, `CreatedByUserId`, `StudyGroupId`, `CreatedAt` (UTC).
- **UPDATE Endpoints & Mutated Columns**:
  - `PUT /api/content/decks/{deckId}` & `PUT /api/decks/{deckId}`
    - Mutated Columns: `Title`, `Description`.
- **DELETE Endpoints**:
  - `DELETE /api/content/decks/{deckId}` & `DELETE /api/decks/{deckId}`
    - Hard delete of `Deck` row.
- **Constraint Protections**:
  - **Deletion Block Safeguard**: Pre-deletion query `dbContext.Cards.AnyAsync(card => card.DeckId == deckId)` returns `409 Conflict ("Deck cannot be deleted while cards exist.")` if cards remain.
  - **Role-Based Authorization**: `CanManageContentAsync(deck.StudyGroupId)` checks whether caller is global `Admin`/`Contributor` or holds `Owner`/`Admin`/`Contributor` membership in the parent `StudyGroup`.

---

### 3.3 Cards

Individual flashcards contained within decks. Rendered with GitHub Flavored Markdown, code syntax highlighting, and live preview.

- **INSERT Endpoints**:
  - `POST /api/content/cards` & `POST /api/decks/{deckId}/cards`
    - Injected properties: `DeckId`, `Type` (`basic`), `Prompt` (Markdown), `Answer` (Markdown), `CreatedAt`.
  - `POST /api/decks/{deckId}/import-cards` & `POST /api/decks/{deckId}/import-cards-text`
    - CSV/TSV/JSON batch import creating multiple `Card` entities with `Prompt, Answer`.
- **UPDATE Endpoints & Mutated Columns**:
  - `PUT /api/content/cards/{cardId}` & `PUT /api/decks/{deckId}/cards/{cardId}`
    - Mutated Columns: `Type`, `Prompt`, `Answer`.
- **DELETE Endpoints**:
  - `DELETE /api/content/cards/{cardId}` & `DELETE /api/decks/{deckId}/cards/{cardId}`
    - Hard delete of `Card` row.
- **Constraint Protections**:
  - Foreign key index on `DeckId` (`IX_Cards_DeckId`).
  - Required non-empty string validation for both `Prompt` and `Answer`.
  - Card type default: `basic`.
  - Target deck existence validation (`dbContext.Decks.FirstOrDefaultAsync(d => d.Id == targetDeckId)`) returns `404 Not Found`.

---

### 3.4 ReviewRecords

Immutable spaced-repetition audit log tracking user flashcard study reviews.

- **INSERT Endpoints**:
  - `POST /api/reviews`
    - Injected properties: `CardId`, `UserId`, `Outcome` (`Again`, `Hard`, `Good`, `Easy`), `EaseFactor` (decimal 4,2), `IntervalDays` (int), `NextReviewAt` (datetime2), `Phase` (`learning` or `review`), `LearningStep` (int), `CreatedAt` (UTC).
- **UPDATE Endpoints**:
  - *None*. `ReviewRecord` rows are **immutable append-only log entries**. Every review creates a new record; scheduling algorithms inspect the latest record via `Max(r.Id)`.
- **DELETE Endpoints**:
  - *None*.
- **Constraint Protections**:
  - Compound Index: `IX_ReviewRecords_UserId_NextReviewAt` optimizes study queue calculations.
  - Model regex validation: `[RegularExpression("Again|Hard|Good|Easy")]`.
  - Bound safeguards in `ReviewSchedulerService`: `EaseFactor` is clamped between `1.30` minimum and `9.99` maximum.

---

### 3.5 CardRuns *(Deprecated & Dropped)*

> [!NOTE]
> The `CardRuns` table and `/api/cards/{id}/run` endpoint were dropped in migration `20260820010945_RenameValidationSpecToAnswerAndDropCardRuns`. All active test execution and code evaluation is consolidated in the `Exercises` subsystem (`/api/exercises/{id}/run`).

---

### 3.6 CardFollowups

Q&A follow-up discussions attached to flashcards. Supports M:N linking to answer cards.

- **INSERT Endpoints**:
  - `POST /api/cards/{cardId}/followups`
    - Injected properties: `CardId`, `AuthorUserId`, `QuestionText`, `LinkedCardId = null`, `LinkedCardIds = null`, `CreatedAt`.
- **UPDATE Endpoints & Mutated Columns**:
  - `PATCH /api/cards/{cardId}/followups/{followupId}/link`
    - Mutated Columns: `LinkedCardId` (primary answer card ID), `LinkedCardIds` (comma-separated list of all linked card IDs).
    - Driven by domain method `followup.AddLinkedCardId(linkedCardId)`.
  - `DELETE /api/cards/{cardId}/followups/{followupId}/link/{linkedCardId}`
    - Mutated Columns: `LinkedCardId`, `LinkedCardIds`.
    - Driven by domain method `followup.RemoveLinkedCardId(linkedCardId)`.
- **DELETE Endpoints**:
  - *None*. Follow-up questions are preserved; unlinking removes card associations without deleting the question entity.
- **Constraint Protections**:
  - Indexes: `IX_CardFollowups_CardId`, `IX_CardFollowups_AuthorUserId`.
  - `GetLinkedCardIdList()` method sanitizes comma-separated string `LinkedCardIds` into a deduplicated `List<int>`.
  - Linking permission guarded by `CanManageContentAsync()`.

---

### 3.7 Exercises

Standalone coding challenges supporting multiple formats (`CodeExecution`, `MultipleChoice`, `ExactString`).

- **INSERT Endpoints**:
  - `POST /api/exercises`
    - Injected properties: `Title`, `Description`, `Language`, `ExerciseType`, `ExerciseSpec`, `StarterCode`, `SolutionCode`, `TestCasesSpec`, `CreatedByUserId`, `StudyGroupId`, `CreatedAt`.
- **UPDATE Endpoints & Mutated Columns**:
  - `PUT /api/exercises/{id}`
    - Mutated Columns: `Title`, `Description`, `Language`, `ExerciseType`, `ExerciseSpec`, `StarterCode`, `SolutionCode`, `TestCasesSpec`.
- **DELETE Endpoints**:
  - `DELETE /api/exercises/{id}`
    - Hard delete of `Exercise` entity.
    - Explicit cascade cleanup: deletes associated `CardExercise` join rows (`dbContext.CardExercises.RemoveRange(...)`) and `ExerciseReviewRecord` rows before deleting the exercise.
- **Constraint Protections**:
  - Index: `IX_Exercises_StudyGroupId`.
  - `CanManageContentAsync()` verification.

---

### 3.8 UserExercises

Enrollment join table connecting users to exercises in their practice collection.

- **INSERT Endpoints**:
  - `POST /api/exercises/{id}/enroll`
    - Creates explicit enrollment: `UserId`, `ExerciseId`, `EnrolledAt`.
  - `POST /api/exercises/{id}/reviews`
    - Auto-enrollment trigger: if user submits an exercise review without prior enrollment, `UserExercise` row is created automatically.
- **UPDATE Endpoints**:
  - *None*. Enrollment is a point-in-time timestamp event.
- **DELETE Endpoints**:
  - `DELETE /api/exercises/{id}/enroll`
    - Hard delete of enrollment pair `(UserId, ExerciseId)`.
- **Constraint Protections**:
  - Clustered Composite Primary Key: `HasKey(ue => new { ue.UserId, ue.ExerciseId })` prevents duplicate enrollments at database engine level.

---

### 3.9 CardExercises

Join table representing many-to-many relationships between flashcards and supplementary coding exercises.

- **INSERT Endpoints**:
  - `POST /api/cards/{cardId}/exercises/{exerciseId}`
    - Creates join row: `CardId`, `ExerciseId`.
- **UPDATE Endpoints**:
  - *None*.
- **DELETE Endpoints**:
  - `DELETE /api/cards/{cardId}/exercises/{exerciseId}`
    - Removes join row.
- **Constraint Protections**:
  - Clustered Composite Primary Key: `HasKey(ce => new { ce.CardId, ce.ExerciseId })`.
  - Non-Clustered Index: `IX_CardExercises_ExerciseId` for reverse lookup ("all cards linking to exercise X").

---

### 3.10 ExerciseReviewRecords

Spaced-repetition review audit trail for exercise challenges (SM-2 implementation parallel to cards).

- **INSERT Endpoints**:
  - `POST /api/exercises/{id}/reviews`
    - Submits exercise review outcome (`Again`, `Hard`, `Good`, `Easy`).
  - `POST /api/exercises/{id}/enroll`
    - Creates initial zero-day learning record (`Phase = "learning"`, `NextReviewAt = UtcNow`) if no prior review record exists.
- **UPDATE Endpoints**:
  - *None*. Append-only audit log.
- **DELETE Endpoints**:
  - `DELETE /api/exercises/{id}`
    - Cascade cleanup of associated exercise review records upon exercise deletion.
- **Constraint Protections**:
  - Compound Index: `IX_ExerciseReviewRecords_UserId_NextReviewAt`.

---

### 3.11 StudyGroups

Hierarchical containers (communities/namespaces) grouping decks, exercises, and members.

- **INSERT Endpoints**:
  - `POST /api/study-groups`
    - Injected properties: `Name`, `Slug`, `Description`, `AvatarUrl`, `IsPublic`, `CreatedByUserId`, `CreatedAt`.
    - Auto-creates owner membership in `StudyGroupMembers` (`Role = "Owner"`).
- **UPDATE Endpoints**:
  - *None currently exposed*.
- **DELETE Endpoints**:
  - *None currently exposed*.
- **Constraint Protections**:
  - Unique Index: `IX_StudyGroups_Slug`.
  - Slug generation sanitizes group name and appends a numeric suffix if a slug collision occurs.

---

### 3.12 StudyGroupMembers

Membership and role mapping table for study groups (`Owner`, `Admin`, `Contributor`, `Member`).

- **INSERT Endpoints**:
  - `POST /api/study-groups/{id}/join`
    - Joins public group as `Role = "Member"`.
  - `POST /api/study-groups/{id}/members`
    - Admin/Owner adds user by email with specified role.
  - `POST /api/study-groups`
    - Auto-inserts creator as `Role = "Owner"`.
- **UPDATE Endpoints & Mutated Columns**:
  - `PUT /api/study-groups/{id}/members/{userId}`
    - Mutated Column: `Role` (`Owner`, `Admin`, `Contributor`, `Member`).
- **DELETE Endpoints**:
  - `POST /api/study-groups/{id}/leave`
    - User leaves group. Owner leaving is blocked if they are the sole owner.
  - `DELETE /api/study-groups/{id}/members/{userId}`
    - Admin/Owner removes member from group.
- **Constraint Protections**:
  - Clustered Composite Primary Key: `HasKey(sgm => new { sgm.StudyGroupId, sgm.UserId })`.
  - Role string constants enforced via `StudyGroupRoles` class.

---

## 4. Concurrency Control, Data Integrity & State Safeguards

### 4.1 Primary Key & Unique Index Protections

1. **Email Uniqueness (`Users.Email`)**:
   - Protected by SQL Server unique non-clustered index `IX_Users_Email`.
   - Double-checked in application layer (`DbContext.Users.AnyAsync(u => u.Email == normalized)`) returning `409 Conflict`.
2. **Slug Uniqueness (`StudyGroups.Slug`)**:
   - Protected by SQL Server unique non-clustered index `IX_StudyGroups_Slug`.
   - Application slug generation loops until `dbContext.StudyGroups.AnyAsync(s => s.Slug == candidate)` returns `false`.
3. **Composite Join Key Uniqueness**:
   - `UserExercises`, `CardExercises`, and `StudyGroupMembers` use primary keys composed of two foreign keys (`(UserId, ExerciseId)`, `(CardId, ExerciseId)`, `(StudyGroupId, UserId)`).
   - Prevents duplicate relationship rows at the database engine layer without requiring auto-increment surrogate keys.

---

### 4.2 Spaced-Repetition State Integrity

1. **Immutable Audit Trail Architecture**:
   - Review records (`ReviewRecords`, `ExerciseReviewRecords`) are **never updated or overwritten**.
   - Scheduling state calculations always operate on the latest record (`OrderByDescending(r => r.CreatedAt)` or `GroupBy(r => r.CardId).Select(g => g.Max(r => r.Id))`).
   - Re-evaluating a card or exercise writes a new row, preserving historical study analytics.
2. **Ease Factor Clamping**:
   - `EaseFactor` calculation in `ReviewSchedulerService` strictly enforces `1.30 <= EaseFactor <= 9.99`.
   - Prevents floating-point/decimal decay or overflow from degrading card scheduling.

---

### 4.3 Authorization & Cross-Tenant Data Isolation

1. **Multi-Tenant Scoping via Study Groups**:
   - Global content search (`SearchController`) scopes queries to `scopedGroupIds` obtained directly from `StudyGroupMembers` for the authenticated user ID in the JWT token.
   - Users cannot search or retrieve decks outside of study groups they have joined.
2. **Hierarchical Permission Resolution (`CanManageContentAsync`)**:
   - Content management actions (Deck/Card/Exercise creation, modification, deletion, and Follow-up linking) execute `CanManageContentAsync(studyGroupId)`:
     ```
     Global Admin / Contributor  ──► GRANT
     Group Owner / Admin / Contributor ──► GRANT
     Group Member / Anonymous    ──► DENY (403 Forbidden)
     ```

---

### 4.4 Defensive Deletion Patterns

1. **Referential Integrity Integrity Guard on Decks**:
   - Attempting to delete a deck containing active cards is explicitly rejected with `409 Conflict` before issuing SQL commands.
2. **Explicit Cascade Cleaning on Exercises**:
   - When an exercise is deleted, `ExercisesController` explicitly queries and removes dependent `CardExercise` join rows and `ExerciseReviewRecord` rows in the same DbContext transaction before deleting the exercise entity.

---

> **End of Database Mutation Matrix** — Complete mapping of all 12 platform tables, lifecycle operations, column mutation scopes, and relational safeguards.
