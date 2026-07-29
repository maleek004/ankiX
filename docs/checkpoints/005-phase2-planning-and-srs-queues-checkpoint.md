# Checkpoint 005 — SM-2 Queue Engine Overhaul, Test Suite, & Phase 2 Architecture Planning

**Date:** July 29, 2026  
**Status:** Phase 1 Operational Sign-off & Phase 2 Planning Complete

---

## 1. Executive Summary

This checkpoint records:
1. **Phase 1 Final Wrap-up:** Secrets cleanup, 38 passing xUnit unit tests, and GitHub Actions CI workflow setup.
2. **SM-2 Queue Engine Overhaul:** Real-time queue classification (🔵 New, 🔴 Learning, 🟢 Review), learning steps (1 min / 10 min), lapse recovery, and `StudyQueueController` integration.
3. **Phase 2 Architectural Blueprint:** Multi-language standalone coding exercises (**Go, Python, C#, JavaScript**), sandboxed execution engine, independent exercise SRS schedules, and MVP release strategy.

---

## 2. Changes Delivered Since Checkpoint 004

### A. Security & Configuration Cleanup
* **Clean Settings:** Removed plain-text Azure SQL passwords from `appsettings.json` and `appsettings.Development.json`.
* **Environment Fallback:** Updated `Program.cs` to read `ANKIX_DB_CONN` environment variable first, falling back to local gitignored `appsettings.Local.json`.
* **Root `.gitignore`:** Added comprehensive rules ignoring `.NET` build artifacts (`**/bin/`, `**/obj/`), Node dependencies (`**/node_modules/`, `**/.vite/`), and local secrets (`appsettings.Local.json`).

### B. Automated Testing & CI Pipeline
* **xUnit Test Project (`AnkiX.Api.Tests`):** 38 unit tests created and passing:
  * `ReviewSchedulerServiceTests` (29 tests) — New card initial routing, Learning step 0/1 progression, Review phase SM-2 multipliers, lapse handling, ease factor floor ($\ge 1.30$).
  * `PasswordServiceTests` (9 tests) — `Pbkdf2` salt generation, hash verification, tamper detection, and malformed hash safety.
* **GitHub Actions Workflow ([.github/workflows/ci.yml](file:///c:/Users/USER/Desktop/projects/ankiX/.github/workflows/ci.yml)):** Parallel `backend` (build, test, TRX test artifact upload) and `frontend` (npm ci, vite build) jobs.

### C. Phase-Aware SM-2 Engine & Live Study Queue
* **Model Upgrade ([ReviewRecord.cs](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Models/ReviewRecord.cs)):** Added `Phase` (`"learning"` | `"review"`) and `LearningStep` (0 = 1min, 1 = 10min) columns.
* **Phase-Aware Scheduler ([ReviewSchedulerService.cs](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Services/ReviewSchedulerService.cs)):**
  * **New Cards:** Again/Hard/Good → Learning phase; Easy → Review phase (1d+).
  * **Learning Phase:** Step 0 (1 min) → Step 1 (10 min) → Review Graduation. Hard/Again in learning resets to Step 0.
  * **Review Phase:** Again causes a lapse back to Learning step 0 with ease factor reduction.
* **Study Queue Endpoint ([StudyQueueController.cs](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Controllers/StudyQueueController.cs)):** `GET /api/decks/{id}/study-queue` returning real-time `NewCount` (Blue), `LearningCount` (Red), `ReviewCount` (Green), and ordered due cards (`Learning > Review > New`).
* **Frontend Sync ([Deck.jsx](file:///c:/Users/USER/Desktop/projects/ankiX/src/frontend/src/pages/Deck.jsx)):** Updated header counter labels and study queue auto-reloading upon completing current queue batch.
* **Migration:** Generated `AddPhaseToReviewRecord` EF Core migration.

---

## 3. Phase 2 Architectural Blueprint

* **Supported Languages:** Go, Python, C#, JavaScript (Node.js).
* **Sandboxed Execution API:** Payload generation in `IExecutionService` executing code against hidden test cases via Judge0 / Piston execution API.
* **Independent SRS for Exercises:** `ExerciseReviewRecord` tracks exercise mastery schedules separately from flashcard decks.
* **MVP Release Strategy:** Official **v1.0 MVP** will be released immediately upon completing Phase 2.

---

## 4. Git Actions & Status

* **Files Untracked:** `bin/`, `obj/`, `node_modules/` safely untracked from Git index.
* **Repository Commit:** All Phase 1 completion & Phase 2 planning files staged and pushed to GitHub `master` branch.
