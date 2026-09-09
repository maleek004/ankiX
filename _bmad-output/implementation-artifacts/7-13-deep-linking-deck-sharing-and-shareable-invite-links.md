---
baseline_commit: 435a921914c00d012db9efd807d1842411b1463a
---

# Story 7.13: Deep-Linking for Decks, Direct Study Group Slugs & Shareable Invite Links

**Status:** done  
**Epic:** Epic 7: Modernized UI/UX Design System, Mobile Responsiveness & Workspace  
**Requirement IDs:** FR45  

---

## 1. User Story

**As a** learner sharing study materials and a study group admin building a learning cohort,  
**I want to** share direct links to decks and study groups and generate tokenized invite links for private/locked groups,  
**So that** new members can join easily from chat apps, decks retain proper parent group context, and private decks provide a clean, inviting access gate rather than an unhandled 403 or generic 404 error.

---

## 2. Acceptance Criteria & Specifications

### 2.1 Direct Deck URLs & Context Auto-Sync (`ankix.tech/decks/:id`)
1. **1-Click Share Deck Action:**
   - In `Deck.jsx` (and deck cards on `Decks.jsx`), provide a visible "🔗 Share Deck" button.
   - Clicking copies the canonical URL (`https://ankix.tech/decks/{id}`) to clipboard and triggers a clean toast notification ("Deck link copied to clipboard!").
2. **Parent Study Group Auto-Sync:**
   - Opening `/decks/:id` directly (or via external link) inspects the deck's parent study group.
   - Automatically synchronizes `StudyGroupProvider` state so the active group matches the deck's group.
   - Breadcrumbs, sidebar, and group navigation remain cohesive without requiring prior manual group selection.

### 2.2 Private Deck Access Gate
1. **Friendly Access Boundary:**
   - When an unauthenticated visitor or non-member visits `/decks/:id` belonging to a private or locked study group:
   - Do NOT display a raw 403 Forbidden or generic "Deck not found" error.
   - Render a polished **"Private Deck"** access gate containing:
     - Group name, description, and avatar (if available).
     - Informational copy: *"This deck is part of the private study group **[Group Name]**."*
     - If unauthenticated: Primary action `[Sign in to Request Access / Join]`.
     - If authenticated:
       - If user has an invite code: `[Enter Invite Code]` input with `[Join Group]` button.
       - If group accepts requests: `[Request to Join Group]` action.

### 2.3 Direct Study Group URLs (`ankix.tech/study-groups/:slug`)
1. **Slug-Based Group Routing:**
   - Add `<Route path="/study-groups/:slug" ... />` in `App.jsx`.
   - Backend endpoint resolves the group by slug.
   - Sets the active study group in `StudyGroupProvider` and renders the group's deck catalog / overview.
   - Handles nonexistent slugs gracefully with a "Study group not found" fallback and navigation link back to `/study-groups`.

### 2.4 Tokenized Shareable Invite Links (`ankix.tech/join/:inviteCode`)
1. **Admin Invite Link Management:**
   - Group Admins can view and copy a permanent shareable invite link from the Study Group settings/members modal: `https://ankix.tech/join/{inviteCode}`.
   - Admins can configure the default role granted by the link: `Member` (default) or `Contributor`.
   - Admins have a **"Revoke / Reset Link"** action that immediately invalidates the previous invite code and generates a fresh one.
2. **Invite Landing Experience (`/join/:inviteCode`):**
   - Resolves invite token via `GET /api/study-groups/invites/{inviteCode}` returning group public metadata (name, description, member count, avatar).
   - If user is logged in:
     - Prompts user: *"You've been invited to join **[Group Name]** as a [Role]"*.
     - 1-click `[Join Study Group]` button instantly adds the user and redirects to `/study-groups/{slug}`.
   - If user is a guest / unauthenticated:
     - Displays preview card with intent preservation (`redirectAfterLogin = /join/:inviteCode`).
     - Prompt user to sign in or create an account; upon authentication, immediately joins the study group.

---

## 3. Technical Architecture & Endpoints

### 3.1 Backend Schema & Models (`AnkiX.Api`)
- In `StudyGroup.cs` (or dedicated `StudyGroupInviteToken.cs`):
  ```csharp
  [MaxLength(32)]
  public string? InviteCode { get; set; }
  
  [MaxLength(20)]
  public string InviteRole { get; set; } = StudyGroupMemberRole.Member;
  ```
- Migration or EF Core update ensuring `InviteCode` has an index for rapid lookup.

### 3.2 Backend Endpoints (`StudyGroupsController.cs` & `DecksController.cs`)
1. `GET /api/study-groups/by-slug/{slug}`: Returns group details including privacy and member status of caller.
2. `GET /api/study-groups/invites/{inviteCode}`: Public metadata preview for invite landing page.
3. `POST /api/study-groups/invites/{inviteCode}/accept`: Joins authenticated caller to study group with designated role.
4. `POST /api/study-groups/{slug}/invite-link`: Generates/retrieves active invite link for group admins.
5. `POST /api/study-groups/{slug}/invite-link/reset`: Revokes current invite code and creates a new one.
6. `GET /api/decks/{id}`: In addition to deck data, return parent group metadata (`groupSlug`, `groupName`, `isPrivate`, `isMember`) so frontend can render the access gate without separate roundtrips.

### 3.3 Frontend Architecture (`src/frontend/src/`)
- `App.jsx`: Add routes `/study-groups/:slug` and `/join/:inviteCode`.
- `pages/JoinGroup.jsx`: Clean invite landing page handling authenticated & unauthenticated states.
- `pages/Deck.jsx`: Add "Share Deck" button, handle `isLocked`/`isPrivate` deck gating UI.
- `context/StudyGroupProvider.jsx`: Expose helper to sync active group when loading a direct deck or slug route.
- `pages/StudyGroups.jsx`: Invite link generator & reset UI inside study group admin settings.

---

## 4. Verification & Testing Plan

1. **Unit & Integration Tests (`AnkiX.Api.Tests`):**
   - `StudyGroupsControllerTests.cs`: Test invite link generation, reset, token lookup, and joining.
   - Verify non-members cannot access private deck contents directly.
   - Verify revoked invite codes return 404/expired.
2. **Frontend Component Tests (`src/frontend/src/__tests__`):**
   - Test `/join/:inviteCode` flow for authenticated vs guest visitors.
   - Test "Share Deck" clipboard copy and toast trigger.
   - Test private deck access gate presentation on 403 response.

---

## 5. Tasks & Subtasks

- [x] **Task 1: Backend Domain Models & Migration**
  - [x] Update `StudyGroup.cs` with `InviteCode` (max 32) and `InviteRole` (max 20, default Member).
  - [x] Add index on `InviteCode` in `ApplicationDbContext.cs`.
  - [x] Create and apply EF Core Migration for `AddStudyGroupInviteLinks`.

- [x] **Task 2: Backend Contracts & Endpoints**
  - [x] Add DTOs: `StudyGroupInviteResponse`, `StudyGroupInviteLinkResponse`, `SetInviteRoleRequest`, and update `DeckResponse` with parent group metadata (`StudyGroupSlug`, `StudyGroupName`, `StudyGroupPrivacy`, `IsMember`).
  - [x] Implement `GET /api/study-groups/by-slug/{slug}` in `StudyGroupsController.cs`.
  - [x] Implement `GET /api/study-groups/invites/{inviteCode}` in `StudyGroupsController.cs`.
  - [x] Implement `POST /api/study-groups/invites/{inviteCode}/accept` in `StudyGroupsController.cs`.
  - [x] Implement `POST /api/study-groups/{slug}/invite-link` and `POST /api/study-groups/{slug}/invite-link/reset` in `StudyGroupsController.cs`.
  - [x] Implement `GET /api/decks/{id}` in `DecksController.cs` with parent group metadata and membership awareness.

- [x] **Task 3: Backend Unit & Integration Tests**
  - [x] Write tests in `StudyGroupInviteAndDeepLinkTests.cs`: invite generation, reset, token lookup, joining, invalid/revoked tokens, role assignment.
  - [x] Write tests in `StudyGroupDeepLinkAndInviteTests.cs`: `GET /api/decks/{id}` returns parent group metadata, private group membership gating.
  - [x] Ensure all backend tests pass (`dotnet test`).

- [x] **Task 4: Frontend Routing & Context Auto-Sync**
  - [x] Update `App.jsx` with `<Route path="/study-groups/:slug" element={<StudyGroups />} />` and `<Route path="/join/:inviteCode" element={<JoinGroup />} />`.
  - [x] Update `StudyGroupProvider.jsx` with helper to sync active study group.
  - [x] Support direct slug navigation in `StudyGroups.jsx` with graceful 404 fallback.

- [x] **Task 5: Frontend 1-Click Share Deck & Private Deck Access Gate**
  - [x] Add visible "🔗 Share Deck" button with clipboard copy and toast notification in `Deck.jsx` and deck card in `Decks.jsx`.
  - [x] In `Deck.jsx`, auto-sync parent group in `StudyGroupProvider` when deck loads.
  - [x] In `Deck.jsx`, render polished "Private Deck" access gate when non-member visits private/locked deck with group preview, Sign In CTA, invite code input, and request access action.

- [x] **Task 6: Frontend Tokenized Invite Links & Admin Management**
  - [x] In `StudyGroups.jsx` modal (Invite tab), add shareable invite link generator, copy button, role selector, and Revoke/Reset Link action.
  - [x] Create `pages/JoinGroup.jsx` invite landing experience with metadata preview, 1-click Join for logged-in users, and redirect intent preservation for guests.

- [x] **Task 7: Frontend Component Tests & Regression Suite**
  - [x] Create `src/frontend/src/__tests__/DeepLinkingAndDeckSharing.test.jsx`.
  - [x] Verify invite landing flow, share deck copy, and private deck access gate.
  - [x] Run full test suite (`npm run test:ci`) and build (`npm run build`).

### Review Findings
- [x] [Review][Defer] StudyGroupPrivacy.Locked and Shareable Invite Links Policy [src/backend/AnkiX.Api/Controllers/StudyGroupsController.cs:788,834] — deferred, reason: Want to test current implementation with users to see if it's better to disallow shareable links for locked groups or not.
- [x] [Review][Patch] Prevent infinite re-render loop by memoizing StudyGroupContext and avoiding redundant state mutations [src/frontend/src/studyGroup/StudyGroupProvider.jsx:23-46]
- [x] [Review][Patch] Fix deck title rendering in Deck.jsx Access Gate from deck.name to deck.title [src/frontend/src/pages/Deck.jsx:741]
- [x] [Review][Patch] Disable StudyGroups Copy Link button when invite link is not loaded or missing inviteCode [src/frontend/src/pages/StudyGroups.jsx:1320]
- [x] [Review][Patch] Sanitize gate invite code parsing against trailing URL hash fragments and spaces [src/frontend/src/pages/Deck.jsx:446-448]
- [x] [Review][Patch] Verify and warn user if accepted invite code does not match the parent study group of the gated deck [src/frontend/src/pages/Deck.jsx:449-451]
- [x] [Review][Patch] Add Promise rejection handling to navigator.clipboard.writeText [src/frontend/src/pages/Deck.jsx:432, src/frontend/src/pages/Decks.jsx:108]
- [x] [Review][Patch] Validate role parameter in GetOrCreateInviteLink and return 400 Bad Request on invalid input [src/backend/AnkiX.Api/Controllers/StudyGroupsController.cs:809-816]
- [x] [Review][Patch] Add missing styles in styles.css for .btn-secondary, .card, and .spinner used in JoinGroup.jsx [src/frontend/src/styles.css:1060]

---

## 6. Dev Agent Record

### Implementation Plan
- TDD approach: Red-Green-Refactor.
- Domain models and EF migration completed for `InviteCode` and `InviteRole`.
- Endpoints implemented in `StudyGroupsController` and `DecksController`.
- Frontend deep linking, parent group auto-sync, 1-click sharing, and private deck access gate implemented.
- Shareable invite link landing page (`/join/:inviteCode`) and admin management modal integrated.
- Comprehensive test coverage established across backend (206 tests) and frontend (88 tests).

### Completion Notes
- All 7 tasks and acceptance criteria (AC 2.1 - AC 2.4) implemented and verified.
- Backend: 206 tests passing (`dotnet test`).
- Frontend: 88 tests passing across 19 test files (`vitest --run`).
- Production bundle builds cleanly (`npm run build`).

---

## 7. File List
- `src/backend/AnkiX.Api/Models/StudyGroup.cs`
- `src/backend/AnkiX.Api/Data/ApplicationDbContext.cs`
- `src/backend/AnkiX.Api/Migrations/20260909121805_AddStudyGroupInviteLinks.cs`
- `src/backend/AnkiX.Api/Contracts/Content/StudyGroupDtos.cs`
- `src/backend/AnkiX.Api/Contracts/Content/DeckDtos.cs`
- `src/backend/AnkiX.Api/Controllers/StudyGroupsController.cs`
- `src/backend/AnkiX.Api/Controllers/DecksController.cs`
- `src/backend/AnkiX.Api.Tests/StudyGroupDeepLinkAndInviteTests.cs`
- `src/frontend/src/api.js`
- `src/frontend/src/App.jsx`
- `src/frontend/src/studyGroup/StudyGroupProvider.jsx`
- `src/frontend/src/pages/JoinGroup.jsx`
- `src/frontend/src/pages/StudyGroups.jsx`
- `src/frontend/src/pages/Deck.jsx`
- `src/frontend/src/pages/Decks.jsx`
- `src/frontend/src/__tests__/DeepLinkingAndDeckSharing.test.jsx`
- `_bmad-output/implementation-artifacts/7-13-deep-linking-deck-sharing-and-shareable-invite-links.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

---

## 8. Change Log
- 2026-09-09: Initialized Story 7.13 implementation with baseline commit `435a921914c00d012db9efd807d1842411b1463a`.
- 2026-09-09: Completed backend models, migrations, endpoints, and 17 unit/integration tests in `StudyGroupDeepLinkAndInviteTests.cs`.
- 2026-09-09: Completed frontend routes (`/study-groups/:slug`, `/join/:inviteCode`), parent group auto-sync, 1-click Share Deck button, private deck access gate, and `/join/:inviteCode` landing page.
- 2026-09-09: Verified all 206 backend tests and 88 frontend tests pass; production bundle built cleanly. Story moved to review.
- 2026-09-09: Completed adversarial code review (Blind Hunter, Edge Case Hunter, Acceptance Auditor). Applied 8 patches across StudyGroupProvider, Deck.jsx, Decks.jsx, StudyGroups.jsx, StudyGroupsController.cs, and styles.css; deferred Locked group invite link policy for user testing. 207 backend tests and 88 frontend tests passing. Story marked done.

