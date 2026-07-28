# Checkpoint 004 — Review Persistence, AnkiWeb UI Overhaul, & Followups Architecture

**Date:** July 28, 2026  
**Status:** Phase 1 Feature Completion & Architectural Enhancement

---

## 1. Executive Summary

This checkpoint documents the major deliverables completed across the backend and frontend for **AnkiX**, including:
1. Complete frontend overhaul matching the **AnkiWeb** user interface and study workflow.
2. Full backend **SM-2 Review Persistence** via `POST /api/reviews`.
3. Architectural design and implementation of the **Followups** (community questions) feature.
4. Security modernization of password hashing algorithms.
5. EF Core database migration pipeline setup for Azure SQL.

---

## 2. Changes Implemented

### Frontend (AnkiWeb UI & Features)
* **Navbar Header ([NavBar.jsx](file:///c:/Users/USER/Desktop/projects/ankiX/src/frontend/src/components/NavBar.jsx)):** Styled header with **AnkiX** branding, navigation links (`Decks`, `Add`, `Search`), user display status, and `Log Out`.
* **Decks Table ([Decks.jsx](file:///c:/Users/USER/Desktop/projects/ankiX/src/frontend/src/pages/Decks.jsx)):** Replaced basic list with a structured table featuring card counts (`Due` / `Learning` in green and blue) and per-deck `Actions ▾` dropdown menus.
* **Single-Card Study Mode ([Deck.jsx](file:///c:/Users/USER/Desktop/projects/ankiX/src/frontend/src/pages/Deck.jsx)):** 
  * Displays one card at a time with a centered prompt.
  * Interactive code area for `micro-coding` card types.
  * Prominent **Show Answer** button.
  * SM-2 rating buttons (`<1m Again`, `<6m Hard`, `<10m Good`, `4d Easy`) that asynchronously submit reviews and advance the queue.
  * Slide-out `Edit` drawer for card creation and deletion.
* **Follow-ups UI:** Added toggleable `▼ Follow-ups` section below card answers. Features lazy-loading of questions, author display name resolution, submission form, and answer-link indicators.
* **Styling ([styles.css](file:///c:/Users/USER/Desktop/projects/ankiX/src/frontend/src/styles.css)):** Comprehensive CSS variables, card viewer layout, dropdowns, forms, and follow-ups styling.
* **API Integration ([api.js](file:///c:/Users/USER/Desktop/projects/ankiX/src/frontend/src/api.js)):** Fixed token parsing (`data.accessToken`), added centralized `authHeaders()`, and added `submitReview`, `getFollowups`, and `addFollowup` helpers.

### Backend (.NET 10 API)
* **SM-2 Scheduler ([ReviewSchedulerService.cs](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Services/ReviewSchedulerService.cs)):** Added `"Again"` outcome support (quality = 1, interval = 1 day, ease factor penalty).
* **Review Endpoint ([ReviewsController.cs](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Controllers/ReviewsController.cs)):** `POST /api/reviews` endpoint extracting `UserId` from JWT claims, retrieving prior review history, calculating SM-2 parameters, and saving `ReviewRecord` entities to Azure SQL.
* **Followups Domain ([FollowupsController.cs](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Controllers/FollowupsController.cs) & [FollowupDtos.cs](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Contracts/Study/FollowupDtos.cs)):**
  * `GET /api/cards/{cardId}/followups` — retrieves questions with author names resolved in a single batch query.
  * `POST /api/cards/{cardId}/followups` — adds user follow-up questions.
  * `PATCH /api/cards/{cardId}/followups/{id}/link` — allows Contributor/Admin to link a follow-up to an answer card.
* **Exercise Schema Stubs ([Exercise.cs](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Models/Exercise.cs) & [CardExercise.cs](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Models/CardExercise.cs)):** Created stub models and join table for future Phase 2 standalone exercises with many-to-many card relationships.
* **Security Modernization ([PasswordService.cs](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Services/PasswordService.cs)):** Refactored from deprecated `new Rfc2898DeriveBytes(...)` constructors to static `Rfc2898DeriveBytes.Pbkdf2(...)` API.
* **Database Startup ([Program.cs](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Program.cs)):** Updated startup sequence to execute `startupDb.Database.Migrate()` on every launch.

---

## 3. Terminal Commands Executed

```powershell
# Dependencies & EF Core Tooling
dotnet tool install --global dotnet-ef
dotnet add package Microsoft.EntityFrameworkCore.Design --version 10.0.0

# Process Management (Unlocking EXE binaries)
Stop-Process -Name "AnkiX.Api" -Force -ErrorAction SilentlyContinue

# Build & Migrations
dotnet build --no-restore
dotnet ef migrations add AddExercisesAndFollowups
dotnet ef migrations script
```

---

## 4. Errors Encountered & Resolutions

| # | Error / Issue | Root Cause | Resolution |
|---|---|---|---|
| 1 | `Microsoft.Data.SqlClient.SqlException: Connection Timeout Expired` | Client IP address changed; Azure SQL Server firewall blocked the pre-login handshake. | Whitelisted client IPv4 address in Azure Portal SQL Server Firewall Rules. |
| 2 | Missing `Authorization` header on protected requests (401 Unauthorized / sample deck fallback) | `api.js` looked for `data.token` instead of backend's `AuthResponse.accessToken`. | Updated `login()` in `api.js` to store `data.accessToken` and added strict `authHeaders()` helper. |
| 3 | `CS0136: A local or parameter named 'previousEase' cannot be declared in this scope` | Local variable name collision inside the `Again` early-return block. | Renamed block-scoped variables to `againEase` and `againNextEase` in `ReviewSchedulerService.cs`. |
| 4 | `MSB3027 / MSB3021: Could not copy AnkiX.Api.exe because it is being used by another process` | `dotnet build` tried to overwrite the executable while `AnkiX.Api.exe` was running in the background. | Executed `Stop-Process -Name "AnkiX.Api" -Force` to release file locks before building. |
| 5 | New models not created in Azure SQL database on restart | `EnsureCreated()` skips schema creation if the database already contains existing tables. | Added EF Core migration `AddExercisesAndFollowups` and updated `Program.cs` to call `Database.Migrate()`. |

---

## 5. Next Steps

1. **Verify Database Migration on Azure SQL:** Run `dotnet run` or execute the DDL script in Azure Portal Query Editor to verify `CardFollowups`, `Exercises`, and `CardExercises` tables exist.
2. **Phase 2 Planning (Standalone Exercises):**
   - Design test case runner & sandbox execution environment.
   - Implement `ExercisesController` and `CardExercises` relationship management.
3. **CI/CD Pipeline:** Create GitHub Actions workflow for automated building and migration testing.
