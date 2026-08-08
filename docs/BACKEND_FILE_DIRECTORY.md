# AnkiX Backend File Directory & Architecture Reference

This document provides a comprehensive inventory of all source files in the backend of the **AnkiX** project (`src/backend/AnkiX.Api`). Each entry contains a single-sentence explanation of the file's exact purpose, designed for onboarding junior developers or serving as context for LLM agents.

---

## ⚙️ Configuration & Entry Point

- **`AnkiX.Api.csproj`**: Defines the .NET project configuration, SDK version, package dependencies, and compilation settings for the backend REST API.
- **`AnkiX.Api.http`**: Provides HTTP request snippets for testing API endpoints directly within IDE HTTP client tools.
- **`appsettings.json`**: Stores default application configuration settings, database connection strings, and JWT authentication parameters.
- **`appsettings.Development.json`**: Contains development-specific configuration overrides, detailed logging settings, and local database connection settings.
- **`appsettings.Local.json`**: Holds local environment secret overrides (such as Azure SQL connection strings and JWT signing keys) ignored by version control.
- **`Program.cs`**: Serves as the application entry point that configures dependency injection services, middleware, database auto-migrations, seed data, and starts the ASP.NET Core web server.
- **`Properties/launchSettings.json`**: Configures local development hosting profiles, environment variables, and listening URLs for running the backend locally.

---

## 📦 Data Contracts (DTOs)

- **`Contracts/Auth/AuthResponse.cs`**: Defines the JSON response structure returned after successful user authentication, containing the JWT token, expiration timestamp, and user profile metadata.
- **`Contracts/Auth/LoginRequest.cs`**: Defines the request payload required for user login, specifying the email address and password fields.
- **`Contracts/Auth/RegisterRequest.cs`**: Defines the request payload required for new user registration, capturing email, password, and optional display name.
- **`Contracts/Content/CardDtos.cs`**: Specifies the request and response data structures for creating, updating, and returning flashcards.
- **`Contracts/Content/DeckDtos.cs`**: Specifies the request and response data structures for managing study decks and listing card counts.
- **`Contracts/Content/ExerciseDtos.cs`**: Specifies the request and response data structures for coding exercises, including starter code, solution code, test cases, and difficulty ratings.
- **`Contracts/Content/StudyGroupDtos.cs`**: Specifies the request and response data structures for study groups, member management, and role assignments.
- **`Contracts/Study/FollowupDtos.cs`**: Specifies the request and response payloads for submitting, viewing, and linking card follow-up questions.
- **`Contracts/Study/ReviewDtos.cs`**: Specifies the request and response structures for recording flashcard and exercise study reviews with SM-2 recall outcomes.
- **`Contracts/Study/RunDtos.cs`**: Specifies the request and response payloads for executing code submissions against test assertion runners.
- **`Contracts/Study/StudyQueueDtos.cs`**: Specifies the response format for retrieving a user's due flashcard study queue for SRS review sessions.

---

## 🎮 API Controllers

- **`Controllers/AdminUsersController.cs`**: Manages admin administrative tasks, such as querying registered platform users and updating user role permissions (`User`, `Contributor`, `Admin`).
- **`Controllers/AuthController.cs`**: Handles user authentication operations, including user registration, credential validation, and JWT token issuance.
- **`Controllers/CardRunsController.cs`**: Handles code execution requests for cards with interactive code runners.
- **`Controllers/ContentController.cs`**: Provides endpoints for browsing, retrieving, and inspecting global platform flashcards.
- **`Controllers/DecksController.cs`**: Manages CRUD operations for study decks and their associated flashcards.
- **`Controllers/ExercisesController.cs`**: Manages coding exercise creation, execution, personal collection enrollment, SRS queue reviews, and study group difficulty sorting.
- **`Controllers/FollowupsController.cs`**: Handles asking follow-up questions on study cards, linking follow-ups to standalone answer cards, and unlinking cards.
- **`Controllers/ReviewsController.cs`**: Handles recording SuperMemo SM-2 recall reviews for flashcards and updating review schedules.
- **`Controllers/SearchController.cs`**: Provides a global full-text search endpoint querying Decks, Cards, Exercises, and Follow-ups across the platform.
- **`Controllers/StudyGroupsController.cs`**: Manages CRUD operations for study groups, membership enrollment, and role management.
- **`Controllers/StudyQueueController.cs`**: Returns due study cards for a given deck scheduled by the SM-2 algorithm for user study sessions.

---

## 🗄️ Database Context & Entity Models

- **`Data/ApplicationDbContext.cs`**: Configures the Entity Framework Core database context, entity table mappings, composite primary keys, indexes, and database relationships.
- **`Models/Card.cs`**: Represents a flashcard entity containing its prompt, card type, validation spec, deck relationship, and creation timestamp.
- **`Models/CardExercise.cs`**: Represents the many-to-many join entity linking flashcards to their associated coding exercises.
- **`Models/CardFollowup.cs`**: Represents a user follow-up question asked on a flashcard, tracking author info, question text, and linked answer card IDs.
- **`Models/CardRun.cs`**: Stores historical code execution attempts submitted by users against flashcards or exercises.
- **`Models/Deck.cs`**: Represents a study deck containing title, description, creator user ID, and associated flashcards.
- **`Models/Exercise.cs`**: Represents a coding exercise containing its title, description, language, starter code, solution reference, test cases, and creator ID.
- **`Models/ExerciseReviewRecord.cs`**: Tracks historical SuperMemo SM-2 review outcomes, ease factors, intervals, and next review timestamps for coding exercises.
- **`Models/ReviewRecord.cs`**: Tracks historical SuperMemo SM-2 review outcomes, ease factors, intervals, and next review timestamps for flashcards.
- **`Models/Roles.cs`**: Defines string constants for system authorization roles (`Admin`, `Contributor`, `User`).
- **`Models/StudyGroup.cs`**: Represents a study group entity containing name, slug, description, visibility, and creator user ID.
- **`Models/StudyGroupMember.cs`**: Represents the join entity tracking user membership and roles in study groups.
- **`Models/StudyGroupRoles.cs`**: Defines string constants for study group roles (`Owner`, `Admin`, `Contributor`, `Member`).
- **`Models/User.cs`**: Represents a user account entity storing email, password hash, display name, role, and registration date.
- **`Models/UserExercise.cs`**: Represents the join entity tracking which coding exercises a user has enrolled into their personal collection.

---

## 🛠️ Business Services & Options

- **`Options/ExecutionApiOptions.cs`**: Binds configuration settings for external code execution API services.
- **`Options/JwtOptions.cs`**: Binds JWT authentication parameters including secret key, issuer, audience, and token expiration minutes.
- **`Services/ICodeExecutionService.cs`**: Defines the interface contract for executing multi-language code submissions against assertion test runners.
- **`Services/CodeExecutionService.cs`**: Implements code compilation and execution testing across 8 programming languages (Go, Python, JavaScript, TypeScript, C#, Java, C++, Rust).
- **`Services/IPasswordService.cs`**: Defines the interface contract for hashing passwords and verifying plain-text passwords against hashes.
- **`Services/PasswordService.cs`**: Implements secure password hashing and verification using HMAC-SHA256 with salt.
- **`Services/IReviewSchedulerService.cs`**: Defines the interface contract for calculating SuperMemo SM-2 spaced-repetition schedules.
- **`Services/ReviewSchedulerService.cs`**: Implements the SuperMemo SM-2 algorithm to calculate interval days, ease factors, and next review dates based on user ratings.
- **`Services/ITokenService.cs`**: Defines the interface contract for generating JSON Web Tokens for authenticated users.
- **`Services/TokenService.cs`**: Implements JWT security token generation with user claims and signature credentials.

---

## 📐 EF Core Database Migrations

- **`Migrations/20260724115015_Initial.cs`** & **`20260724115015_Initial.Designer.cs`**: Defines the initial EF Core migration schema for Users, Decks, Cards, ReviewRecords, and CardRuns.
- **`Migrations/20260728072511_AddExercisesAndFollowups.cs`** & **`20260728072511_AddExercisesAndFollowups.Designer.cs`**: Migration adding database tables for Exercises, CardExercises, and CardFollowups.
- **`Migrations/20260728121500_AddCreatedByUserIdToDecks.cs`** & **`20260728121500_AddCreatedByUserIdToDecks.Designer.cs`**: Migration adding `CreatedByUserId` column to Decks table.
- **`Migrations/20260729022943_AddPhaseToReviewRecord.cs`** & **`20260729022943_AddPhaseToReviewRecord.Designer.cs`**: Migration adding `Phase` and `LearningStep` columns to ReviewRecords table for SM-2 learning state tracking.
- **`Migrations/20260729130000_ExtendExerciseModel.cs`** & **`20260729130000_ExtendExerciseModel.Designer.cs`**: Migration extending Exercise entity with `StarterCode`, `SolutionCode`, `TestCasesSpec`, and `CreatedByUserId`.
- **`Migrations/20260729140000_AddExerciseReviewRecords.cs`** & **`20260729140000_AddExerciseReviewRecords.Designer.cs`**: Migration adding `ExerciseReviewRecords` table for coding exercise SRS scheduling.
- **`Migrations/20260730122500_AddLinkedCardIdsToCardFollowups.cs`** & **`20260730122500_AddLinkedCardIdsToCardFollowups.Designer.cs`**: Migration adding `LinkedCardIds` column to `CardFollowups` table for multi-card linking.
- **`Migrations/20260730164500_AddUserExercisesTable.cs`** & **`20260730164500_AddUserExercisesTable.Designer.cs`**: Migration adding `UserExercises` table for per-user exercise collection enrollment.
- **`Migrations/ApplicationDbContextModelSnapshot.cs`**: Holds the current Entity Framework Core database model metadata snapshot used to compute pending schema changes.
