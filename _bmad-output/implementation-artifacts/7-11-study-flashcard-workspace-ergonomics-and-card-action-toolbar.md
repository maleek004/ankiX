# Story 7.11: Study Flashcard Workspace Ergonomics, Card Action Toolbar & Import Repositioning

**Status:** Done  
**Epic:** Epic 7: Modernized UI/UX Design System, Mobile Responsiveness & Workspace  
**Requirement IDs:** FR43  

---

## 1. User Story

**As a** learner reviewing flashcards in a study session and a creator curating decks,  
**I want** card-specific actions separated into a dedicated header bar above the prompt with an overflow dropdown and the Import Cards action relocated to onboarding surfaces,  
**So that** card prompts enjoy 100% full-width typography without flexbox squishing, and study sessions remain uncluttered and focused on learning flow.

---

## 2. Acceptance Criteria & Ergonomic Standards

1. **Deduplicate Deck Top Bar (Row 1):**
   - Remove redundant `Edit` button from top deck toolbar (`Row 1`) in `Deck.jsx`.
   - Remove prominent `📥 Import Cards` button from daily study toolbar (`Row 1`).
   - Retain deck-level scope controls: `+ Add Card`, `👻 Ghosted [count]`, and queue status counters (Blue + Red + Green).

2. **Dedicated Card Action Header:**
   - Position card actions in a clean, dedicated header row directly *above* the card prompt text within the card container (`card-viewer-area`).
   - Guarantee the prompt (`card-prompt`) gets 100% horizontal width on desktop, tablet, and mobile, eliminating side-by-side flexbox crowding.

3. **Primary vs Overflow Action Hierarchy:**
   - Expose high-frequency actions as direct 1-click buttons:
     - `[👻 Ghost Card]` (or `[✨ Restore Card]` if viewed in ghosted context)
     - `[✏️ Edit]` (for users with create permissions)
   - Group secondary and destructive actions into an accessible `··· More Actions` dropdown menu:
     - `[📋 Copy Card]`
     - `[🔗 Link Exercises]` (if creator/admin)
     - `[🗑️ Delete Card]` (destructive red styling, if creator/admin)
   - Menu must support click-outside dismissal and keyboard `Escape` key dismissal with proper ARIA attributes (`aria-haspopup="menu"`, `aria-expanded`).

4. **Reposition Import Cards Action:**
   - Integrate file/bulk importing into the `+ Add Card` drawer as a segmented entry toggle: `[✍️ Manual Entry]` vs `[📥 Bulk File Import]`.
   - Add an `📥 Import Cards` option to each deck's `Actions ▾` dropdown on the `/decks` catalog page (`Decks.jsx`).
   - Extract and share `ImportCardsModal` as a reusable component in `src/frontend/src/components/ImportCardsModal.jsx`.

5. **Mobile Touch Ergonomics & Overflow Protection:**
   - Ensure the card action header neatly aligns on screens `< 480px` without horizontal overflow, awkward line wrapping, or prompt displacement.
   - Maintain comfortable touch targets (minimum 36px height) with safe-area spacing.

---

## 3. Tasks & Subtasks

- [x] **Task 1: Component Extraction & Import Repositioning**
  - [x] Extract `ImportCardsModal` from `Deck.jsx` into `src/frontend/src/components/ImportCardsModal.jsx`.
  - [x] Add `📥 Import Cards` option to the `Actions ▾` dropdown in `src/frontend/src/pages/Decks.jsx` with modal state and queue refresh.
  - [x] Update `+ Add Card` drawer in `Deck.jsx` to feature segmented toggle (`[✍️ Manual Entry]` vs `[📥 Bulk File Import]`).

- [x] **Task 2: Study Toolbar Cleanup & Card Action Header Refactor**
  - [x] Remove redundant `Edit` button and `📥 Import Cards` button from `study-top-bar` in `Deck.jsx`.
  - [x] Create dedicated `card-action-bar` inside `card-viewer-area` located directly above `card-prompt`.
  - [x] Wire 1-click primary buttons: `[👻 Ghost Card]` and `[✏️ Edit]`.
  - [x] Build accessible `··· More Actions` dropdown with click-outside and Escape key listener containing `Copy Card`, `Link Exercises`, and `Delete`.
  - [x] Ensure `card-prompt` renders full-width (100%) without flexbox horizontal squishing.

- [x] **Task 3: CSS Typography & Mobile Responsiveness**
  - [x] Add `.card-action-bar` and dropdown styles to `src/frontend/src/styles.css`.
  - [x] Add mobile media query handling for `< 480px` viewports in `styles.css`.

- [x] **Task 4: Test Suite Updates & Verification**
  - [x] Update `DeckStudyCard.test.jsx` to reflect Row 1 deduplication and the new card action header layout.
  - [x] Update `Decks.test.jsx` to verify `📥 Import Cards` option in the deck actions dropdown.
  - [x] Ensure all existing tests in `CardGhosting.test.jsx` and across `npm test` pass with zero regressions (69 passed).

### Review Findings
- [x] [Review][Patch] Disable card action buttons and More Actions dropdown during in-flight deletion or ghosting [`src/frontend/src/pages/Deck.jsx:810`]
- [x] [Review][Patch] Reset drawer tab state to manual entry on drawer close or card add [`src/frontend/src/pages/Deck.jsx:45`]
- [x] [Review][Patch] Enhance overflow menu keyboard navigation, return focus on Escape, and add role="separator" to divider [`src/frontend/src/pages/Deck.jsx:70`]
- [x] [Review][Patch] Add reactive Restore Card toggle if current card is in ghosted cards list [`src/frontend/src/pages/Deck.jsx:784`]
- [x] [Review][Patch] Avoid premature touch-scroll dismissal on document event listener [`src/frontend/src/pages/Deck.jsx:78`]
- [x] [Review][Patch] Clean up empty spacer DOM element and move duplicated inline segmented tab styles to CSS [`src/frontend/src/pages/Deck.jsx:508`, `src/frontend/src/styles.css:270`]
- [x] [Review][Patch] Guard against unmounted state updates on async import in ImportCardsModal [`src/frontend/src/components/ImportCardsModal.jsx:25`]


