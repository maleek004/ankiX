# Story 7.12: Dynamic Spaced Repetition Next-Interval Previews on Flashcard & Exercise Ratings

**Status:** Done  
**Epic:** Epic 7: Modernized UI/UX Design System, Mobile Responsiveness & Workspace  
**Requirement IDs:** FR44  

---

## 1. User Story

**As a** learner reviewing flashcards or solving coding exercises,  
**I want to** see the exact, dynamic next-review wait times (`<1m`, `<10m`, `1d`, `4d`, `12d`, `2.5mo`, `1.3y`) displayed above the ease buttons (`Again`, `Hard`, `Good`, `Easy`),  
**So that** I know the exact scheduling consequences of each rating before making my study evaluation.  

---

## 2. Acceptance Criteria & Specifications

1. **Backend SM-2 Precomputation:**
   - In `StudyQueueController.cs` and `ExercisesController.cs`, compute next review intervals for all 4 outcomes (`Again`, `Hard`, `Good`, `Easy`) using `ReviewSchedulerService.CalculateNextIntervalPreviews`.
   - Project human-readable interval strings in `NextIntervalsDto` (`Again`, `Hard`, `Good`, `Easy`).
2. **Dynamic Flashcard Rating Badges:**
   - In `Deck.jsx`, replace static placeholder text with dynamic intervals rendered above each of the 4 rating buttons via `getIntervalLabel`.
3. **Dynamic Exercise Rating Badges:**
   - In `Deck.jsx` (`ExercisePracticeModal`) and `Exercises.jsx`, render matching dynamic next-interval badges on the exercise review rating buttons upon completing an exercise.
4. **Lapse Cycle Verification:**
   - When a mature card or exercise in the `review` phase is failed (`Again`), the interval preview confirms an immediate lapse back to learning step 0 (`<1m`).
5. **Guest Session Exclusion:**
   - For unauthenticated visitors in ephemeral sandbox sessions (Epic 10), omit interval badges entirely, displaying clean rating buttons without misleading unpersisted intervals.

---

## 3. Technical Architecture & Endpoints

### 3.1 Backend Contracts & Services (`AnkiX.Api`)
- `Contracts/Study/NextIntervalsDto.cs`: Carries `Again`, `Hard`, `Good`, `Easy` interval strings.
- `Contracts/Content/CardDtos.cs`: Added `NextIntervalsDto? NextIntervals` to `CardResponse`.
- `Contracts/Content/ExerciseDtos.cs`: Added `NextIntervalsDto? NextIntervals` to `ExerciseDetailResponse`.
- `Services/IReviewSchedulerService.cs` & `ReviewSchedulerService.cs`:
  - `CalculateNextIntervalPreviews(ReviewRecord? previousRecord)`: Evaluates outcomes for all 4 rating choices.
  - `FormatIntervalPreview(ReviewScheduleResult schedule)`: Culture-invariant formatting for minutes (`<1m`, `<10m`), days (`Xd`), months (`Xmo`, `X.Xmo`), and years (`Xy`, `X.Xy`).

### 3.2 Backend Endpoints
- `GET /api/decks/{deckId}/study-queue`: Injects `IReviewSchedulerService` and enriches `DueCards` with precomputed `NextIntervals`.
- `GET /api/exercises/{id}`: Resolves caller's latest `ExerciseReviewRecord` (if authenticated) and attaches `NextIntervals`. For guests (`userId == 0`), returns `null`.

### 3.3 Frontend (`src/frontend/src`)
- `pages/Deck.jsx`:
  - Dynamic `getIntervalLabel` helper reading `currentCard.nextIntervals` and suppressing badges when `isGuest` is true.
  - `ExercisePracticeModal`: Renders dynamic intervals in rating buttons when authenticated and available.
- `pages/Exercises.jsx`:
  - Practice modal displays dynamic intervals when authenticated and omits them for guests.

---

## 4. Verification & Testing

- **Backend Unit Tests:** `AnkiX.Api.Tests/ReviewSchedulerServiceTests.cs` (50/50 passing) testing all phase transitions, lapse behaviors, and formatting thresholds.
- **Backend Full Suite:** 190/190 tests passing (`dotnet test`).
- **Frontend Component Tests:** `src/frontend/src/__tests__/DeckStudyCard.test.jsx` (7/7 passing) verifying dynamic badge rendering when authenticated and omission during guest sessions.
- **Frontend Full Suite:** 79/79 tests passing across 18 test suites (`npm run test:ci`).

---

## 5. Review Findings

- [x] [Review][Patch] Compute NextIntervals in GetExercisesForCard for card-linked exercise practice [`src/backend/AnkiX.Api/Controllers/ExercisesController.cs:354`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Controllers/ExercisesController.cs#L354)
- [x] [Review][Patch] Position dynamic interval badges above buttons using rating-col in ExercisePracticeModal [`src/frontend/src/pages/Deck.jsx:1395`](file:///c:/Users/USER/Desktop/projects/ankiX/src/frontend/src/pages/Deck.jsx#L1395)
- [x] [Review][Patch] Position dynamic interval badges above buttons using rating-col in Exercises page [`src/frontend/src/pages/Exercises.jsx:1292`](file:///c:/Users/USER/Desktop/projects/ankiX/src/frontend/src/pages/Exercises.jsx#L1292)
- [x] [Review][Patch] Add isGuest guard to ExercisePracticeModal to prevent unauthenticated interval display [`src/frontend/src/pages/Deck.jsx:1395`](file:///c:/Users/USER/Desktop/projects/ankiX/src/frontend/src/pages/Deck.jsx#L1395)
- [x] [Review][Patch] Defensive safeguards: Math.Clamp on LearningStep, null guard on schedule, and deterministic Id sorting [`src/backend/AnkiX.Api/Services/ReviewSchedulerService.cs:98`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Services/ReviewSchedulerService.cs#L98)
- [x] [Review][Defer] Missing composite DB index on ExerciseReviewRecords(UserId, ExerciseId) [`src/backend/AnkiX.Api/Data/ApplicationDbContext.cs`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Data/ApplicationDbContext.cs) — deferred, pre-existing database optimization
- [x] [Review][Defer] Domain model decoupling for ReviewSchedulerService [`src/backend/AnkiX.Api/Services/IReviewSchedulerService.cs`](file:///c:/Users/USER/Desktop/projects/ankiX/src/backend/AnkiX.Api/Services/IReviewSchedulerService.cs) — deferred, pre-existing domain entity usage
