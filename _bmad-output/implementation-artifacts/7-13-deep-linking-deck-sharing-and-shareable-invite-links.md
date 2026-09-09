# Story 7.13: Deep-Linking for Decks, Direct Study Group Slugs & Shareable Invite Links

**Status:** Ready for Dev  
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
