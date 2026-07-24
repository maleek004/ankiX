# Product Brief — Phase 1: Micro-Coding Flashcards

Date: 2026-07-23

## Elevator pitch
A lightweight Anki-style web app for mastering C#, React, and T-SQL through atomic practice cards. Users study from one shared global curriculum while the system tracks each user’s personal review schedule and code-attempt history.

## Primary goals
1. Deliver a working flashcard engine with global decks and cards.
2. Support micro-coding cards where users type code, run it, and get immediate PASS/FAIL feedback.
3. Keep personalized progress per user via review history and run history.
4. Support contributor content creation with controlled permissions.
5. Deploy a usable Phase 1 product on Azure.

## Tech stack
- Backend: C# (.NET Web API)
- Frontend: React (Vite)
- Database: SQL Server (T-SQL)
- Code execution: third-party execution API (proxied through backend)

## Scope (in)
- Email/password authentication.
- Global shared deck library (all users see the same decks and cards).
- Two card types:
  - Micro-coding cards (editor + run + PASS/FAIL)
  - Standard concept cards
- Personalized user progress:
  - `ReviewRecords` (spaced repetition state/history)
  - `CardRuns` (code attempts + results)
- Role-based content management:
  - `Admin`: can create, edit, delete decks/cards.
  - `Contributor`: can create new decks/cards only; no edits/deletes.
  - `User`: review-only access.
- Contributor-created content is published immediately in Phase 1.
- SM-2 style spaced-repetition parameters for scheduling.

## Out of scope (Phase 1)
- Moderation workflow/approval queue for contributor content.
- Community voting/reputation.
- Bulk import/export.
- Advanced analytics dashboards.
- Advanced architecture patterns (CQRS/MediatR) and advanced SQL constructs.

## Guardrails
- C#: explicit types; avoid `var`; flat endpoint design.
- React: use `useState` and `useEffect`; no heavy external state management.
- T-SQL: explicit straightforward joins; avoid CTE/window-function complexity for Phase 1.
- Educational style: inline comments for non-obvious implementation details.

## Security and authorization
- Backend proxies code runs to a third-party execution API (no direct untrusted execution on app host).
- Enforce role checks on content endpoints:
  - Create: `Admin` and `Contributor`
  - Edit/Delete: `Admin` only
- Validate all request payloads and enforce run limits/timeouts.

## Acceptance criteria
- Users can register/login and browse global decks/cards.
- Users can review both card types.
- Users can submit micro-coding answers and receive PASS/FAIL feedback within target latency.
- SM-2 scheduling updates per-user `NextReviewAt` correctly.
- Contributor can create new decks/cards but cannot edit/delete existing ones.
- Admin can create/edit/delete decks/cards.
- Deployed to Azure App Service + Azure SQL (staging).

## Minimal API surface (example)
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/decks`
- `GET /api/decks/{id}/cards`
- `POST /api/cards/{id}/run`
- `POST /api/reviews`
- `POST /api/content/decks` (Admin + Contributor)
- `POST /api/content/cards` (Admin + Contributor)
- `PUT /api/content/decks/{id}` (Admin only)
- `PUT /api/content/cards/{id}` (Admin only)
- `DELETE /api/content/decks/{id}` (Admin only)
- `DELETE /api/content/cards/{id}` (Admin only)

## Minimal data model (high level)
- User `{ id, email, passwordHash, role, createdAt }`
- Deck `{ id, title, description, createdAt }`
- Card `{ id, deckId, type, prompt, validationSpec, createdAt }`
- CardRun `{ id, cardId, userId, submittedCode, result, durationMs, createdAt }`
- ReviewRecord `{ id, cardId, userId, outcome, easeFactor, intervalDays, nextReviewAt, createdAt }`

## Success metrics
- End-to-end flow works for 10+ sample cards across both card types.
- 95% of code-run requests complete under 3 seconds.
- Role authorization behaves correctly for Admin/Contributor/User.
- Core scheduling tests pass for SM-2 parameter updates.

---
Phase 1 is intentionally minimal: one global curriculum, personal progress, and clear role-based permissions.
