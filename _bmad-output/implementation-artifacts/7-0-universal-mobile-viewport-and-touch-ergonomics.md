# Story 7.0: Universal Mobile-First Responsiveness & Touch Adaptive UX

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** learner using AnkiX on a mobile phone or tablet,  
**I want to** navigate, study flashcards, run code exercises, and manage content seamlessly with touch ergonomics,  
**So that** I have a first-class, distraction-free study experience on any device.

## Acceptance Criteria

1. **Collapsible Mobile Header (Option B):**
   - On viewports `< 768px`, the horizontal navbar collapses into a clean, compact header showing the brand title and a top-right hamburger menu button (`☰` or icon).
   - Tapping the hamburger button opens a slide-out navigation drawer with touch-friendly links (Study Groups, Decks, Exercises, Admin, Search, User profile, and Log In/Register/Logout).
   - Tapping the backdrop or clicking any navigation link closes the drawer automatically.

2. **Touch-Optimized Study Session (`Deck.jsx`):**
   - Flashcards expand to 100% viewport width without horizontal window blowout or clipping on small screens (`max-width: 100vw`).
   - Markdown code blocks inside `MarkdownViewer` support internal horizontal scrolling (`overflow-x: auto`) with a floating copy button.
   - The spaced repetition rating buttons (`[Again] [Hard] [Good] [Easy]`) and `Show Answer` button are pinned to a sticky bottom bar on mobile for one-handed thumb interaction.

3. **Tabbed Mobile Coding Sandbox (`Exercises.jsx`):**
   - On viewports `< 768px`, the coding challenge workspace transitions from desktop layout into a 3-tab mobile workspace:
     - **Tab 1:** `[Problem & Specs]` (Instructions, Description, Test Cases)
     - **Tab 2:** `[Code Editor]` (Language Selector, Code Editor textarea, Reset/Starter Code)
     - **Tab 3:** `[Terminal Output & Diffs]` (Run status, Output logs, Execution duration, SM-2 retention rating buttons)
   - A persistent floating action button (`▶ Run Code`) allows executing code from any tab without losing context.

4. **Adaptive Modals & Bottom Sheets:**
   - Modals (Rapid Add card drawer, Edit Card modal, Study Group dialogs, AuthModal, CopyModal, ImportCardsModal) render as responsive full-width bottom sheets on viewports `< 768px` with rounded top corners, safe keyboard auto-scrolling, and clean dismissal.

5. **Guest Landing Touch Optimization (`Home.jsx`):**
   - On mobile viewports, the hero action buttons (`Start Free Account`, `Enter in Guest Mode →`, social login buttons) stack vertically into full-width touch buttons with minimum 44px height.

6. **iOS Zoom Prevention & Touch Target Standards:**
   - Form inputs, textareas, and selects enforce a minimum `16px` font size on mobile (`@media (max-width: 768px) { input, select, textarea { font-size: 16px; } }`) to suppress iOS Safari auto-zoom on focus.
   - All interactive elements (buttons, links, drawer toggles) adhere to a minimum $44\text{px} \times 44\text{px}$ touch target size.

## Tasks / Subtasks

- [x] Task 1: CSS Design System Foundation for Mobile Viewports & Touch Standards (AC: 1, 2, 4, 6)
  - [x] Add global CSS rules in `src/frontend/src/styles.css` for mobile viewport resets, overflow bounds, and iOS 16px input font size safeguards.
  - [x] Add responsive styles for mobile navigation drawer, drawer backdrop, and hamburger button.
  - [x] Add bottom-sheet modal styles for mobile screens `< 768px` (`.modal-bottom-sheet` / media query overrides).
  - [x] Add sticky bottom study bar styles with thumb-zone ergonomics and $\ge 44\text{px}$ touch targets.

- [x] Task 2: Implement Collapsible Mobile Header & Slide-Out Drawer in `NavBar.jsx` (AC: 1)
  - [x] Add hamburger toggle state (`isOpen`) and menu trigger button in `NavBar.jsx` for `< 768px` screens.
  - [x] Render slide-out drawer with full route links, active study group indicators, user profile display, and auth actions.
  - [x] Ensure clicking outside or clicking any nav link closes the drawer automatically.
  - [x] Update `NavBar.test.jsx` with test assertions for mobile menu button and drawer toggle state.

- [x] Task 3: Touch-Optimize Spaced Repetition Study View in `Deck.jsx` (AC: 2, 4)
  - [x] Ensure card viewer container occupies 100% fluid width on mobile without horizontal clipping.
  - [x] Pin `study-bottom-bar` (with `Show Answer` and `Again/Hard/Good/Easy` rating buttons) to the sticky bottom of the viewport on mobile devices.
  - [x] Adapt rapid card add drawer, edit card modal, import modal, and exercise linker modal to render as bottom sheets on mobile.

- [x] Task 4: Implement 3-Tab Mobile Workspace for Coding Exercises in `Exercises.jsx` (AC: 3, 4)
  - [x] Add mobile tab state (`'problem' | 'code' | 'output'`) when viewport is `< 768px`.
  - [x] Render 3 tab navigation headers for Problem, Code Editor, and Terminal Output inside the active practice modal.
  - [x] Add persistent floating action button (`▶ Run Code`) visible on mobile practice view.
  - [x] Adapt Add Exercise modal to bottom sheet styling on mobile.

- [x] Task 5: Mobile Hero Optimization in `Home.jsx` & Modal Ergonomics (AC: 4, 5)
  - [x] Ensure hero action buttons stack cleanly with full-width width and $\ge 44\text{px}$ height on mobile.
  - [x] Adapt `AuthModal.jsx` and `CopyModal.jsx` to full-width bottom sheet layout on `< 768px`.

- [x] Task 6: Comprehensive Verification & Regression Testing (AC: 1, 2, 3, 4, 5, 6)
  - [x] Run full frontend test suite (`npm run test:ci`) and verify zero regressions.
  - [x] Add unit tests for mobile navbar drawer and tabbed exercise switching.

### Review Findings
- [x] [Review][Patch] Use `useLocation().pathname` in `NavBar.jsx` to auto-close drawer on route change [src/frontend/src/components/NavBar.jsx:13]
- [x] [Review][Patch] Auto-switch mobile practice tab to `'output'` when running exercise code [src/frontend/src/pages/Exercises.jsx:234]

## Dev Notes

### Architecture & Responsive Patterns
- **Breakpoint Convention:** `768px` (`@media (max-width: 768px)`) is the primary mobile/tablet boundary throughout the AnkiX frontend.
- **iOS Safari Safeguard:** iOS Safari triggers an aggressive auto-zoom if text inputs have `font-size < 16px`. Standardize all form inputs (`input`, `textarea`, `select`) to `font-size: 16px` on mobile viewports.
- **Sticky Thumb Zone:** On mobile, study session rating buttons (`.study-bottom-bar`) must stay fixed to the bottom of the viewport (`position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;`) with sufficient padding bottom for safe areas (`env(safe-area-inset-bottom)`).
- **Tabbed Practice Flow in `Exercises.jsx`:** Switching tabs on mobile must preserve `practiceCode`, `runResult`, and running status in component state without resetting.

### Source Tree Components to Touch
- `src/frontend/src/styles.css` (global responsive rules, mobile drawer, bottom sheet modal styles, sticky study bar, 16px iOS input fix)
- `src/frontend/src/components/NavBar.jsx` (hamburger button, mobile drawer menu, backdrop)
- `src/frontend/src/pages/Deck.jsx` (responsive card layout, sticky bottom rating bar, mobile bottom sheet modals)
- `src/frontend/src/pages/Exercises.jsx` (3-tab mobile practice modal, floating run button, responsive grid)
- `src/frontend/src/pages/Home.jsx` (stacked mobile hero action buttons)
- `src/frontend/src/components/AuthModal.jsx` (bottom sheet adaptation on mobile)
- `src/frontend/src/components/CopyModal.jsx` (bottom sheet adaptation on mobile)
- `src/frontend/src/__tests__/NavBar.test.jsx` (unit tests for mobile drawer rendering and interactions)

### Testing Standards Summary
- Run `npm run test:ci` in `src/frontend`.
- Ensure all existing and new test suites pass with zero failures.

### Project Structure Notes
- All changes are contained within the `src/frontend` React application.
- Naming conventions, component structures, and CSS variable styling patterns remain aligned with existing codebase standards.

### References
- [Source: _bmad-output/planning-artifacts/epics-phase3.md#Story 7.0](file:///c:/Users/USER/Desktop/projects/ankiX/_bmad-output/planning-artifacts/epics-phase3.md#L167-L179)
- [Source: docs/prd-phase3.md#FR33](file:///c:/Users/USER/Desktop/projects/ankiX/docs/prd-phase3.md#L69-L75)

## Dev Agent Record

### Agent Model Used
Gemini 3.7 Flash (High)

### Debug Log References

### Completion Notes List

### File List
- `src/frontend/src/styles.css`
- `src/frontend/src/components/NavBar.jsx`
- `src/frontend/src/pages/Deck.jsx`
- `src/frontend/src/pages/Exercises.jsx`
- `src/frontend/src/pages/Home.jsx`
- `src/frontend/src/components/AuthModal.jsx`
- `src/frontend/src/components/CopyModal.jsx`
- `src/frontend/src/__tests__/NavBar.test.jsx`
