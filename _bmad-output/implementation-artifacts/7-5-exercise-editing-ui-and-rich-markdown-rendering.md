# Story 7.5: UI Exercise Management & Rich Markdown Rendering across Modalities

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As an** admin or contributor authoring exercises and a learner practicing them,  
**I want to** edit existing exercises directly from the UI and compose descriptions, instructions, prompts, and MCQ options with rich Markdown formatting,  
**So that** exercise content is easily maintainable and renders formatted code snippets, lists, emphasis, and diagrams cleanly.

## Acceptance Criteria

1. **UI Exercise Editing Modal & Workflow (`Exercises.jsx`):**
   - Study group admins and contributors (`canCreateContent(activeStudyGroup?.role)`) see an **"✏️ Edit"** button on exercise cards in both the "My Review Queue" and "All Study Group Exercises" tabs in `Exercises.jsx`.
   - Clicking **Edit** opens an Edit Exercise modal preloaded with the existing exercise's:
     - Title
     - Exercise Modality (`CodeExecution`, `MultipleChoice`, `ExactString`)
     - Topic Tag / Language (with locked C#/Python/JS/Go options for code, and custom topic tags `General`, `Linux`, `Networking`, `DevOps`, `SQL`, `Architecture`, `Security`, `Algorithms` for non-coding)
     - Description / Instructions (using `MarkdownField`)
     - Starter Code & Solution Code (for `CodeExecution`)
     - Options (with `MarkdownField` for options A, B, C, D) & Correct Option Index (for `MultipleChoice`)
     - Accepted Answer & Case Sensitivity (for `ExactString`)
   - Submitting the edit saves via API and updates the exercise in local state (`exercises`, `dueQueue`, `activeExercise`) without needing a full page reload.

2. **Frontend API Layer Integration (`api.js`):**
   - Implement and export `updateExercise(id, exerciseData)` in `src/frontend/src/api.js`.
   - Dispatches `PUT /api/exercises/${id}` with authenticated JWT headers and payload.
   - Robust error parsing using `parseApiError(res, 'Failed to update exercise')`.

3. **Rich Markdown Input Fields (`MarkdownField.jsx`):**
   - Replace plain textareas for Exercise Description / Instructions in both the Create (`Add New Exercise`) and Edit (`Edit Exercise`) modals with `MarkdownField`.
   - Provide live preview rendering and formatting hint indicators.

4. **Rich Markdown Display across Modalities (`MarkdownViewer.jsx`):**
   - In `Exercises.jsx`, render exercise instructions / descriptions inside the practice modal using `MarkdownViewer`.
   - In `Deck.jsx` (`ExercisePracticeModal`), render exercise instructions / descriptions using `MarkdownViewer`.
   - In `ExerciseComponents.jsx`:
     - In `MultipleChoiceExercise`, render MCQ options with `MarkdownViewer` so code keywords, markdown formatting, and formulas inside choice text render with rich syntax formatting.
     - Ensure radio selection and touch hit areas remain responsive and accessible.

5. **Permissions & Security Guardrails:**
   - Non-authorized users and guests cannot see or trigger the "✏️ Edit" action button.
   - Frozen study groups (`activeStudyGroup.isFrozen`) disable editing actions and display the read-only notice.

## Tasks / Subtasks

- [x] Task 1: Add `updateExercise` in `src/frontend/src/api.js` (AC: 2)
  - [x] Implement `updateExercise(id, exerciseData)` with `PUT /api/exercises/${id}`, auth headers, and error parsing.
- [x] Task 2: Enhance `ExerciseComponents.jsx` with Rich Markdown Rendering (AC: 4)
  - [x] Import `MarkdownViewer` in `ExerciseComponents.jsx`.
  - [x] Update `MultipleChoiceExercise` to render option labels using `MarkdownViewer`.
- [x] Task 3: Rich Markdown in Practice Modals (`Exercises.jsx` & `Deck.jsx`) (AC: 4)
  - [x] In `Exercises.jsx` practice modal, render `activeExercise.description` via `<MarkdownViewer content={activeExercise.description} />`.
  - [x] In `Deck.jsx` `ExercisePracticeModal`, render `currentEx.description` via `<MarkdownViewer content={currentEx.description} />`.
- [x] Task 4: Implement Exercise Editing Modal & State in `Exercises.jsx` (AC: 1, 3, 5)
  - [x] Add state for `editingExercise`, `showEditModal`, and edit form fields (`editTitle`, `editLanguage`, `editExerciseType`, `editDescription`, `editStarterCode`, `editSolutionCode`, `editTestCasesSpec`, `editMcqOpt1..4`, `editMcqCorrect`, `editExactAnswer`, `editExactCaseSensitive`, `isUpdating`).
  - [x] Add `handleOpenEdit(ex, e)` that loads full exercise details if needed and populates the edit form fields.
  - [x] Add `handleUpdate(e)` that validates inputs, constructs the payload, calls `updateExercise(editingExercise.id, payload)`, and updates `exercises`, `dueQueue`, and `activeExercise`.
  - [x] Replace plain textareas in Add Form and Edit Modal with `MarkdownField`.
  - [x] Add "✏️ Edit" action buttons to exercise cards in both "My Review Queue" and "All Study Group Exercises" for authorized users (`canCreate`).
- [x] Task 5: Automated Testing & Regression Verification (AC: 1, 2, 3, 4, 5)
  - [x] Add comprehensive unit tests in `src/frontend/src/__tests__/ExercisesManagement.test.jsx` covering edit modal opening, markdown rendering, updating an exercise, and permission gating.
  - [x] Run full test suite `npm run test:ci` and ensure all tests pass (11 test suites, 36 tests passed).
  - [x] Run backend test suite `dotnet test` (124 tests passed).

### Review Findings

- [x] [Review][Patch] State reset isolation on question transitions in MultipleChoice & ExactString [src/frontend/src/components/ExerciseComponents.jsx:16, 84]
- [x] [Review][Patch] MCQ correctIndex safety clamp when options are removed during creation or editing [src/frontend/src/pages/Exercises.jsx:174, 308]
- [x] [Review][Patch] Safe string normalization and compact paragraph spacing in MarkdownViewer [src/frontend/src/components/MarkdownViewer.jsx:130, 149]
- [x] [Review][Patch] Use safeFetch in updateExercise for resilient network failure handling [src/frontend/src/api.js:573]
- [x] [Review][Defer] CardExerciseLinkerModal in Deck.jsx uses plain textarea for creating new linked exercises [src/frontend/src/pages/Deck.jsx:1190] — deferred, pre-existing

## Dev Notes

### Backend Endpoint Contract
- `PUT /api/exercises/{id}` accepts `UpdateExerciseRequest`:
  - `Title` (string, max 200)
  - `Description` (string, max 4000)
  - `Language` (string, max 50)
  - `ExerciseType` (string: `CodeExecution`, `MultipleChoice`, `ExactString`)
  - `ExerciseSpec` (string: JSON for MCQ `{ options: [...], correctIndex: 0 }` or ExactString `{ acceptedAnswers: [...], caseSensitive: false }`)
  - `StarterCode` (string)
  - `SolutionCode` (string)
  - `TestCasesSpec` (string)

### Components Touched
- `src/frontend/src/api.js` (added `updateExercise`)
- `src/frontend/src/components/ExerciseComponents.jsx` (added `MarkdownViewer` to `MultipleChoiceExercise`)
- `src/frontend/src/pages/Exercises.jsx` (added Edit Exercise modal, `MarkdownField`, `MarkdownViewer`, Edit action buttons)
- `src/frontend/src/pages/Deck.jsx` (added `MarkdownViewer` for instructions in `ExercisePracticeModal`)
- `src/frontend/src/__tests__/ExercisesManagement.test.jsx` (created comprehensive unit tests)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (updated status to `done`)

## Dev Agent Record

### Agent Model Used
Gemini 3.7 Flash (Medium)

### Completion Notes List
- Successfully implemented full end-to-end UI editing workflow for exercises.
- Added live markdown preview fields to authoring modals.
- Enhanced multi-modal exercise practice views with rich markdown rendering.
- All 11 frontend test suites (36 tests) and backend test suite (124 tests) passed with 0 failures.

### File List
- `src/frontend/src/api.js`
- `src/frontend/src/components/ExerciseComponents.jsx`
- `src/frontend/src/pages/Exercises.jsx`
- `src/frontend/src/pages/Deck.jsx`
- `src/frontend/src/__tests__/ExercisesManagement.test.jsx`
- `_bmad-output/implementation-artifacts/7-5-exercise-editing-ui-and-rich-markdown-rendering.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
