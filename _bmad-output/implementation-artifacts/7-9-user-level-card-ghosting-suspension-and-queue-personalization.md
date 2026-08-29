# Story 7.9: User-Level Card Ghosting / Suspension & Queue Personalization

**Status:** Done  
**Epic:** Epic 7: Modernized UI/UX Design System, Mobile Responsiveness & Workspace  
**Requirement IDs:** FR41  

---

## 1. User Story

**As a** learner reviewing cards in a large, shared, or complex deck,  
**I want to** mark specific flashcards as "Ghosted" (👻) directly during study sessions or preview modals,  
**So that** the spaced repetition queue permanently excludes those cards from my personal study sessions without deleting them for other members of the study group.

---

## 2. Acceptance Criteria

1. **Interactive Ghost Button on Cards:** In `Deck.jsx` (during study mode) and `CardDetailModal.jsx` (card preview), an interactive "👻 Ghost Card" (and "✨ Restore Card" / "✨ Un-ghost") toggle button is available for authenticated learners.
2. **User-Scoped Ghosting API (`POST /api/cards/{cardId}/ghost` & `DELETE /api/cards/{cardId}/ghost`):** Backend persists user-level card suspensions (`UserGhostedCard` entity / table) mapped strictly to `(UserId, CardId)`.
3. **Queue Exclusion:** The study queue endpoint (`GET /api/decks/{deckId}/study-queue`) and review scheduler filter out all cards ghosted by the requesting user, reducing cognitive fatigue and deck intimidation.
4. **"Ghosted Cards" Drawer & Restoration:** In `Deck.jsx`, learners can open a "Ghosted Cards" drawer / view to inspect all cards they have muted in that deck, and click "✨ Un-ghost" to restore any card back to their active review queue.
5. **Shared Deck Isolation:** Ghosting a card by user $A$ has zero impact on user $B$ or the master deck definition; cards remain visible in deck totals for creators and other group members.

---

## 3. Tasks & Subtasks

- [x] **Task 1: Backend Data Model & Migrations**
  - [x] Create `UserGhostedCard` model with `UserId`, `CardId`, and `CreatedAt`
  - [x] Configure `DbSet<UserGhostedCard>` and composite primary key in `ApplicationDbContext`
  - [x] Add EF Core migration for `UserGhostedCards` table and update snapshot
- [x] **Task 2: Backend API Endpoints & Queue Exclusion**
  - [x] Add `IsGhosted` property to `CardResponse` and `GhostCardStatusResponse` DTO
  - [x] Implement `POST /api/cards/{cardId}/ghost` and `DELETE /api/cards/{cardId}/ghost` in `ContentController`
  - [x] Implement `GET /api/decks/{deckId}/ghosted-cards` in `DecksController`
  - [x] Filter out user ghosted cards in `StudyQueueController.GetStudyQueue`
  - [x] Handle cascade cleanup in `ContentController.DeleteCard` and `DeleteDeck`
- [x] **Task 3: Backend Integration Tests**
  - [x] Write integration test suite `CardGhostingTests.cs` verifying ghost, unghost, study queue exclusion, and deck isolation
- [x] **Task 4: Frontend API & UI Implementation**
  - [x] Add `ghostCard`, `unghostCard`, and `getGhostedCards` in `src/frontend/src/api.js`
  - [x] Add interactive "👻 Ghost Card" button, ghosted drawer button, and ghosted cards restoration drawer in `Deck.jsx`
  - [x] Add "👻 Ghost Card" / "✨ Restore Card" toggle button and state synchronization in `CardDetailModal.jsx`
- [x] **Task 5: Frontend Unit & Integration Tests**
  - [x] Write `CardGhosting.test.jsx` covering study session ghosting, ghosted cards drawer, and preview modal toggling
- [x] **Task 6: Full Regression & Verification**
  - [x] Run full backend test suite (`dotnet test` - 165 passed)
  - [x] Run full frontend test suite (`npm test` - 67 passed)

### Review Findings
- [x] [Review][Patch] Check Study Group read authorization in GhostCard and UnghostCard endpoints [`src/backend/AnkiX.Api/Controllers/ContentController.cs:395`]
- [x] [Review][Patch] Validate Study Group access in GetStudyQueue and GetGhostedCardsByDeck [`src/backend/AnkiX.Api/Controllers/StudyQueueController.cs:32`]
- [x] [Review][Patch] Catch DbUpdateException and DbUpdateConcurrencyException in GhostCard and UnghostCard for bulletproof concurrency [`src/backend/AnkiX.Api/Controllers/ContentController.cs:409`]
- [x] [Review][Patch] Use direct SQL query join/exists for ghosted card filtering instead of in-memory lists [`src/backend/AnkiX.Api/Controllers/StudyQueueController.cs:47`]
- [x] [Review][Patch] Exclude ghosted cards from DecksController.GetDecks Due/Learn badge counters [`src/backend/AnkiX.Api/Controllers/DecksController.cs:104`]
- [x] [Review][Patch] Auto-hydrate isGhosted in CardDetailModal when opened from search or external references [`src/frontend/src/components/CardDetailModal.jsx:50`]
- [x] [Review][Patch] Preserve active study session index and avoid full loading screen when un-ghosting from drawer [`src/frontend/src/pages/Deck.jsx:338`]
- [x] [Review][Patch] Add security authorization and privacy boundary integration tests in CardGhostingTests.cs [`src/backend/AnkiX.Api.Tests/CardGhostingTests.cs:1`]

---

## 4. Test & Verification Plan

- **Backend Integration Tests:**
  - `CardGhostingTests.cs`:
    - `GhostCard_AuthenticatedUser_PersistsGhostRecord` (PASSED)
    - `GhostCard_Idempotent_Returns200` (PASSED)
    - `GhostCard_Unauthenticated_ReturnsUnauthorized` (PASSED)
    - `GhostCard_NonExistentCard_ReturnsNotFound` (PASSED)
    - `UnghostCard_AuthenticatedUser_RemovesGhostRecord` (PASSED)
    - `GetStudyQueue_ExcludesGhostedCards_ForGhostingUserOnly` (PASSED)
    - `GetGhostedCardsByDeck_ReturnsOnlyUserGhostedCardsForDeck` (PASSED)
    - `DeleteCard_CleansUpGhostRecords` (PASSED)
- **Frontend Unit Tests:**
  - `CardGhosting.test.jsx`:
    - renders Ghost Card button on active card and Ghosted drawer button in toolbar (PASSED)
    - ghosting an active card calls api.ghostCard and advances to next card (PASSED)
    - opens Ghosted Cards drawer and allows unghosting cards back to queue (PASSED)
    - hides ghosting controls when in guest mode (unauthenticated) (PASSED)
    - renders Ghost Card button and toggles to Restore Card on click in CardDetailModal (PASSED)
