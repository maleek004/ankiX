# Checkpoint 005 — API Contract Alignment, Role-Based Content Gating & Deck Creator Tracking

**Date:** July 28, 2026  
**Status:** Bug Fix & Feature Enhancement (Post Phase 1)

---

## 1. Executive Summary

This checkpoint documents a session focused on three categories of work for **AnkiX**:

1. **Critical startup fix** — EF Core migration crash (`SqlException: There is already an object named 'CardExercises'`) resolved by making the `AddExercisesAndFollowups` migration idempotent.
2. **Frontend-to-backend contract alignment** — Deck and card creation/deletion API calls in `api.js` were targeting non-existent routes (`/api/decks` POST, `/api/decks/{id}/cards` POST) instead of the backend's actual `ContentController` routes (`/api/content/decks`, `/api/content/cards`). Payload shapes were also mismatched (`{ front, back, code }` vs `{ deckId, type, prompt, validationSpec }`).
3. **Role-based content gating & deck creator tracking** — Only `Admin` and `Contributor` users can now create decks and cards (both backend enforcement and UI visibility). The `Decks` table now records who created each deck via a new `CreatedByUserId` column. Deck creation form includes a `Description` field.

---

## 2. Changes Implemented

### Backend (.NET 10 API)

* **Idempotent Migration ([20260728072511_AddExercisesAndFollowups.cs](file:///home/l2e/Desktop/ankiX/src/backend/AnkiX.Api/Migrations/20260728072511_AddExercisesAndFollowups.cs)):**
  - Replaced `migrationBuilder.CreateTable(...)` calls with raw SQL wrapped in `IF OBJECT_ID(...) IS NULL` guards for `CardExercises`, `CardFollowups`, and `Exercises` tables.
  - Index creation wrapped in `IF NOT EXISTS (SELECT * FROM sys.indexes ...)` checks.
  - Prevents crash when tables already exist in Azure SQL from previous manual DDL execution.

* **Deck Model ([Deck.cs](file:///home/l2e/Desktop/ankiX/src/backend/AnkiX.Api/Models/Deck.cs)):**
  - Added `public int? CreatedByUserId { get; set; }` property.

* **Deck DTOs ([DeckDtos.cs](file:///home/l2e/Desktop/ankiX/src/backend/AnkiX.Api/Contracts/Content/DeckDtos.cs)):**
  - Added `CreatedByUserId` to `DeckResponse`.

* **Content Controller ([ContentController.cs](file:///home/l2e/Desktop/ankiX/src/backend/AnkiX.Api/Controllers/ContentController.cs)):**
  - Added `using System.Security.Claims` import.
  - `CreateDeck`: Restored `[Authorize(Roles = "Contributor,Admin")]`, extracts `ClaimTypes.NameIdentifier` from JWT to populate `CreatedByUserId`.
  - `CreateCard`: Restored `[Authorize(Roles = "Contributor,Admin")]`.
  - `UpdateDeck`, `DeleteDeck`: `[Authorize(Roles = Roles.Admin)]`.
  - Added dual route aliases (`/api/content/decks` and `/api/decks`) on all endpoints for forward compatibility.
  - Card type validation expanded to accept `"basic"` alongside `"micro-coding"` and `"concept"`.
  - `CreateCard` accepts optional `[FromRoute] int? deckId` for `/api/decks/{deckId}/cards` route pattern.

* **Decks Controller ([DecksController.cs](file:///home/l2e/Desktop/ankiX/src/backend/AnkiX.Api/Controllers/DecksController.cs)):**
  - `GetDecks` response now includes `CreatedByUserId`.

* **EF Core Migration ([20260728121500_AddCreatedByUserIdToDecks.cs](file:///home/l2e/Desktop/ankiX/src/backend/AnkiX.Api/Migrations/20260728121500_AddCreatedByUserIdToDecks.cs)):**
  - Idempotent `ALTER TABLE [Decks] ADD [CreatedByUserId] INT NULL` with `IF NOT EXISTS` guard.
  - Companion `Designer.cs` and updated `ApplicationDbContextModelSnapshot.cs` with `CreatedByUserId` property.

### Frontend (React/Vite)

* **API Layer ([api.js](file:///home/l2e/Desktop/ankiX/src/frontend/src/api.js)):**
  - `createDeck(title, description)` → POST `/api/content/decks` with `{ title, description }`.
  - `createCard(deckId, prompt, validationSpec, type)` → POST `/api/content/cards` with `{ deckId, type, prompt, validationSpec }`.
  - `deleteDeck(id)` → DELETE `/api/content/decks/{id}`.
  - `deleteCard(deckId, cardId)` → DELETE `/api/content/cards/{cardId}`.
  - Added `getUser()`: Parses user from `localStorage` or JWT payload (handles .NET long claim URIs).
  - Added `canCreateContent()`: Returns `true` only for `Admin` / `Contributor` roles.
  - `login()` now persists `data.user` object to `localStorage`.
  - `logout()` clears both `ankix_token` and `ankix_user`.

* **Decks Page ([Decks.jsx](file:///home/l2e/Desktop/ankiX/src/frontend/src/pages/Decks.jsx)):**
  - `+ Add Deck` button only rendered when `canCreateContent()` is `true`.
  - Deck creation form expanded with a **Description** input field (optional).
  - Form includes Cancel/Save buttons in a right-aligned row.

* **Deck Study Page ([Deck.jsx](file:///home/l2e/Desktop/ankiX/src/frontend/src/pages/Deck.jsx)):**
  - `Edit` button and `+` card button only rendered when `canCreateContent()` is `true`.
  - `Limits` button remains visible to all authenticated users.

---

## 3. Errors Encountered & Resolutions

| # | Error / Issue | Root Cause | Resolution |
|---|---|---|---|
| 1 | `SqlException (0x80131904): There is already an object named 'CardExercises' in the database` — backend crashes on startup at `Program.cs:line 90` | `AddExercisesAndFollowups` migration used `migrationBuilder.CreateTable()` which unconditionally emits `CREATE TABLE`. Tables already existed from prior manual DDL. | Replaced with raw SQL using `IF OBJECT_ID(N'...', N'U') IS NULL` idempotency guards. |
| 2 | `Create deck failed: Failed to create deck` / `Create card failed: Failed to create card` | Frontend `api.js` posted to `/api/decks` (POST) and `/api/decks/{id}/cards` (POST) but backend only had these as GET routes on `DecksController`. Actual create routes live on `ContentController` at `/api/content/decks` and `/api/content/cards`. Card payload sent `{ front, back, code }` but backend expects `{ deckId, type, prompt, validationSpec }`. | Fixed all endpoint URLs and payload shapes in `api.js`. Added dual route aliases on `ContentController`. |
| 3 | Card type `"basic"` rejected by backend validation | `ContentController.CreateCard` only accepted `"micro-coding"` or `"concept"`. Frontend dropdown defaulted to `"basic"`. | Extended validation to accept `"basic"` as a third valid type. |
| 4 | `PendingModelChangesWarning: The model for context 'ApplicationDbContext' has pending changes` — backend refuses to start | Added `CreatedByUserId` to `Deck.cs` model but did not create the required `Designer.cs` companion file or update `ApplicationDbContextModelSnapshot.cs`. | Created `20260728121500_AddCreatedByUserIdToDecks.Designer.cs` with full target model, and added `CreatedByUserId` property to `ApplicationDbContextModelSnapshot.cs`. |

---

## 4. Migration Files Summary

| Migration | Tables/Columns Affected | Idempotent |
|---|---|---|
| `20260724115015_Initial` | All base tables (`Users`, `Decks`, `Cards`, `CardRuns`, `ReviewRecords`) | No (original) |
| `20260728072511_AddExercisesAndFollowups` | `CardExercises`, `CardFollowups`, `Exercises` + indexes | ✅ Yes (patched this session) |
| `20260728121500_AddCreatedByUserIdToDecks` | `Decks.CreatedByUserId INT NULL` | ✅ Yes |

---

## 5. Current Authorization Matrix

| Endpoint | Method | User | Contributor | Admin |
|---|---|---|---|---|
| `/api/decks` | GET | ✅ | ✅ | ✅ |
| `/api/decks/{id}/cards` | GET | ✅ | ✅ | ✅ |
| `/api/content/decks` | POST | ❌ | ✅ | ✅ |
| `/api/content/cards` | POST | ❌ | ✅ | ✅ |
| `/api/content/decks/{id}` | PUT | ❌ | ❌ | ✅ |
| `/api/content/decks/{id}` | DELETE | ❌ | ❌ | ✅ |
| `/api/content/cards/{id}` | PUT | ✅ | ✅ | ✅ |
| `/api/content/cards/{id}` | DELETE | ✅ | ✅ | ✅ |
| `/api/reviews` | POST | ✅ | ✅ | ✅ |
| `/api/cards/{id}/followups` | GET/POST | ✅ | ✅ | ✅ |

---

## 6. Next Steps

1. **Verify backend startup** — Run `dotnet run` and confirm all three migrations apply cleanly on Azure SQL.
2. **Test deck creation** — Log in as `admin@ankix.local` (Admin role) and verify the deck form submits with title + description and `CreatedByUserId` is populated in Azure SQL.
3. **Test role gating** — Register a new user (default `User` role) and confirm `+ Add Deck`, `Edit`, and `+` card buttons are hidden.
4. **Phase 2 planning** — Resume standalone exercises architecture and sandbox execution environment design.
