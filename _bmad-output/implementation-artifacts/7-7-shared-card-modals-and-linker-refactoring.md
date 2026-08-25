# Story 7.7: Shared Card Modals & Linker Refactoring

Status: done

## Story

**As a** frontend developer maintaining AnkiX and a learner interacting with flashcards,  
**I want** child card dialogs (`CardExerciseLinkerModal`, `ConvertFollowupModal`, and `LinkedCardsPreviewModal`) extracted into shared, reusable component files,  
**So that** card exercise linking, follow-up conversion, and linked card carousels are unified, DRY, and maintain consistent indexing logic across both the study deck view and search preview.

## Acceptance Criteria

1. **Standalone Component Extraction:**
   - Extract `CardExerciseLinkerModal` into `src/frontend/src/components/CardExerciseLinkerModal.jsx`.
   - Extract `ConvertFollowupModal` into `src/frontend/src/components/ConvertFollowupModal.jsx`.
   - Extract `LinkedCardsPreviewModal` into `src/frontend/src/components/LinkedCardsPreviewModal.jsx`.
   - Ensure each component is cleanly exported as default or named exports with explicit prop interfaces (`card`/`parentCard`, `followup`, `onClose`, `onUpdated`/`onConverted`/`onUnlinked`).

2. **MCQ Index Resolution Bug Fix in Linker:**
   - In `CardExerciseLinkerModal.jsx`, eliminate the fragile `Number(mcqCorrect)` index assumption from `Deck.jsx`.
   - Use the hardened validation: verify the selected radio option text is non-empty (`rawOpts[mcqCorrect]?.trim()`), filter non-empty options, and resolve `correctIndex` against the filtered options array.

3. **Unified Integration in Consumers:**
   - In [`CardDetailModal.jsx`](file:///c:/Users/USER/Desktop/projects/ankiX/src/frontend/src/components/CardDetailModal.jsx), remove internal duplicate declarations of the three modals and import them from `src/components/`.
   - In [`Deck.jsx`](file:///c:/Users/USER/Desktop/projects/ankiX/src/frontend/src/pages/Deck.jsx), remove internal duplicate declarations of the three modals and import them from `src/components/`.

4. **Preserved Functionality & State Synchronization:**
   - Searching existing exercises and linking/unlinking updates linked exercise badges in both Deck and Search Preview.
   - Creating a new exercise and linking directly from the modal works identically across views.
   - Converting a follow-up into a new or linked card works identically across views.
   - Linked answer cards carousel navigation and unlinking works identically across views.

5. **Test Suite Verification:**
   - Run Vitest suite covering `DeckStudyCard.test.jsx`, `Decks.test.jsx`, `SearchPreview.test.jsx`, `Followups.test.jsx`, `SharedCardModals.test.jsx`, and `ExercisesManagement.test.jsx`.
   - All tests pass with zero regressions.

## Tasks / Subtasks

- [x] Task 1: Extract `src/frontend/src/components/CardExerciseLinkerModal.jsx` (AC: 1, 2)
  - [x] Create `CardExerciseLinkerModal.jsx` containing exercise search, tab switching, and exercise creation forms (CodeExecution, MultipleChoice, ExactString).
  - [x] Implement hardened MCQ option indexing and in-flight request guards.
  - [x] Export `CardExerciseLinkerModal` for reuse.
- [x] Task 2: Extract `src/frontend/src/components/ConvertFollowupModal.jsx` (AC: 1)
  - [x] Create `ConvertFollowupModal.jsx` containing existing card search and new card creation forms.
  - [x] Clean up redundant `targetDeckId` dependency in initial deck load effect.
  - [x] Export `ConvertFollowupModal` for reuse.
- [x] Task 3: Extract `src/frontend/src/components/LinkedCardsPreviewModal.jsx` (AC: 1)
  - [x] Create `LinkedCardsPreviewModal.jsx` supporting single card and carousel array preview with unlinking support.
  - [x] Export `LinkedCardsPreviewModal` for reuse.
- [x] Task 4: Refactor `CardDetailModal.jsx` & `Deck.jsx` (AC: 3, 4)
  - [x] Replace inline modal definitions with imports from `../components/`.
  - [x] Verify prop bindings and callbacks (`onUpdated`, `onConverted`, `onUnlinked`).
- [x] Task 5: Automated Verification & CI (AC: 5)
  - [x] Run `npm run test:ci` across the entire frontend suite (15 files, 50 tests passed).
  - [x] Run `npm run build` production bundle verification.

## Dev Notes & Architecture Guardrails

- **Shared Component Directory:** All three extracted components must reside in `src/frontend/src/components/`.
- **Dependencies:** Each extracted component must explicitly import its required dependencies (`useStudyGroup`, `MarkdownField`, `MarkdownViewer`, `tagUtils`, `api.js`) to prevent missing reference errors.
- **Backwards Compatibility:** Props passed from `Deck.jsx` and `CardDetailModal.jsx` must remain 100% compatible.
