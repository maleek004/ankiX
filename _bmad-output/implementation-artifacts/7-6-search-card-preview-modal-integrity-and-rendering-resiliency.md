# Story 7.6: Search Card Preview Modal Integrity & Rendering Resiliency

Status: done

## Story

**As a** learner or contributor searching across study groups and decks on `/search`,  
**I want to** click the "👁 Preview" button on any search result card to inspect the full card prompt, answer, follow-ups, and linked exercises without crashing or receiving a blank screen,  
**So that** I can preview and interact with flashcards immediately from search results.

## Root Cause Analysis

When a user clicked the "👁 Preview" button on a search result card in `Search.jsx`:
1. `Search.jsx` set `previewCard = c`, which conditionally rendered `<CardDetailModal card={previewCard} ... />`.
2. Inside `CardDetailModal.jsx`, `useStudyGroup()` was invoked in three places (`CardDetailModal`, `CardExerciseLinkerModal`, and `ConvertFollowupModal`).
3. However, `useStudyGroup` was not imported from `../studyGroup/StudyGroupProvider`.
4. This threw an uncaught `ReferenceError: useStudyGroup is not defined` during React rendering.
5. In the browser, unhandled rendering errors bubble up and unmount the entire React root component tree, resulting in a blank white screen (`ankix.tech/search`).
6. Additionally, inside `CardExerciseLinkerModal`, the form submit handler was referenced as `onSubmit={handleCreateExercise}` when the defined function was named `handleCreateAndLink`.
7. In `Deck.jsx`, `MarkdownField` was referenced without an import from `../components/MarkdownField`.

## Acceptance Criteria & Fix Verification

1. **Modal Render Integrity:**
   - `CardDetailModal.jsx` imports `useStudyGroup` from `../studyGroup/StudyGroupProvider`.
   - `CardDetailModal` opens cleanly without throwing `ReferenceError`.
2. **Interactive Tab Switching:**
   - Tabs `[Card Details]`, `[Follow-ups]`, and `[Linked Exercises]` function correctly.
3. **Exercise Linker Form Binding:**
   - Form submission in `CardExerciseLinkerModal` properly invokes `onSubmit={handleCreateAndLink}`.
4. **Deck In-Place Card Creation & Editing:**
   - `Deck.jsx` imports `MarkdownField` from `../components/MarkdownField`.
5. **Automated Test Coverage:**
   - `SearchPreview.test.jsx` verifies the search query -> card list -> Preview click -> `CardDetailModal` render workflow passes.
   - Full test suite passes.

## Tasks / Subtasks

- [x] Task 1: Fix `CardDetailModal.jsx` Imports & Form Handlers
  - [x] Import `useStudyGroup` from `../studyGroup/StudyGroupProvider`.
  - [x] Update `onSubmit={handleCreateExercise}` to `onSubmit={handleCreateAndLink}`.
- [x] Task 2: Fix `Deck.jsx` Component Imports
  - [x] Import `MarkdownField` from `../components/MarkdownField`.
- [x] Task 3: Update Phase 3 Planning Artifacts
  - [x] Add FR38 and Story 7.6 to `_bmad-output/planning-artifacts/epics-phase3.md`.
  - [x] Update `_bmad-output/implementation-artifacts/sprint-status.yaml`.
- [x] Task 4: Automated Test & Build Verification
  - [x] Vitest `SearchPreview.test.jsx` passing.
  - [x] Full test suite `npm run test:ci` passing (14 files, 47 tests passed).
  - [x] Production build `npm run build` passing.

### Review Findings

- [x] [Review][Patch] Add in-flight guard to `handleCreateAndLink` in `CardDetailModal.jsx` to prevent concurrent duplicate submissions [CardDetailModal.jsx:715]
- [x] [Review][Patch] Validate selected MCQ option is non-empty before computing correctIndex in `CardDetailModal.jsx` [CardDetailModal.jsx:720]
- [x] [Review][Defer] Deduplicate `CardExerciseLinkerModal` and `ConvertFollowupModal` across `CardDetailModal.jsx` and `Deck.jsx` into shared components [CardDetailModal.jsx:650] — deferred, pre-existing
- [x] [Review][Defer] Align MCQ correctIndex calculation in `Deck.jsx` copy of `CardExerciseLinkerModal` [Deck.jsx:1445] — deferred, pre-existing
- [x] [Review][Defer] Add transaction / rollback support for two-step exercise creation and linkage [CardDetailModal.jsx:750] — deferred, pre-existing

