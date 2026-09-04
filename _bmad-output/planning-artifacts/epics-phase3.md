---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - file:///c:/Users/USER/Desktop/projects/ankiX/docs/prd-phase3.md
---

# ankix — Phase 3 Epic & Story Breakdown

## Overview

This document defines the Phase 3 Epics and User Stories for **AnkiX**, decomposing the Phase 3 PRD requirements into implementable stories with acceptance criteria.

---

## Requirements Inventory & Coverage Map

| Requirement ID | Requirement Description | Epic Coverage |
|---|---|---|
| **FR13** | Register and log in via Google and GitHub OAuth2 | Epic 5 (Story 5.1) |
| **FR14** | Auto-provisioning & linking OAuth accounts to user identities | Epic 5 (Story 5.1) |
| **FR28** | Self-service password reset via secure email tokens | Epic 5 (Story 5.4) |
| **FR36** | User Profile Center & Display Name Customization | Epic 5 (Story 5.5) |
| **FR37** | Persistent Session Resiliency, Silent Refresh Tokens & 401 Interceptor | Epic 5 (Story 5.6) |
| **FR15** | In-app notification when card follow-up is created | Epic 6 (Story 6.1) |
| **FR16** | In-app notification when exercise is linked to follow-up | Epic 6 (Story 6.1) |
| **FR17** | Header Notification Bell icon with unread badge & drawer | Epic 6 (Story 6.2, 6.3) |
| **FR18** | Platform Super-Admin Dashboard (Groups, Runs/Inserts, Online Users) | Epic 5 (Story 5.2) |
| **FR19** | Platform Super-Admin global user role management | Epic 5 (Story 5.3) |
| **FR20** | Vector icon system migration (`lucide-react`) | Epic 7 (Story 7.1) |
| **FR21** | Monaco Code Editor integration for code cards & exercises | Epic 7 (Story 7.2) |
| **FR22** | Dark / Light mode theme switcher engine | Epic 7 (Story 7.3) |
| **FR33** | Universal Mobile-First Responsiveness & Touch Adaptive UX | Epic 7 (Story 7.0) |
| **FR34** | Multi-Modal Exercise Integrity & Custom Topic Tagging | Epic 7 (Story 7.4) |
| **FR35** | Exercise Editing UI & Rich Markdown Rendering across Modalities | Epic 7 (Story 7.5) |
| **FR38** | Search Card Preview Modal Integrity & Rendering Resiliency | Epic 7 (Story 7.6) |
| **FR39** | Shared Card Modals & Linker Refactoring | Epic 7 (Story 7.7) |
| **FR40** | Study Group & Deck Name Management for Group Admins | Epic 7 (Story 7.8) |
| **FR41** | User-Level Card Ghosting (Suspension) & Queue Personalization | Epic 7 (Story 7.9) |
| **FR42** | LaTeX Mathematical & Scientific Notation Rendering | Epic 7 (Story 7.10) |
| **FR23** | GitHub-style study activity heatmap | Epic 8 (Story 8.1) |



| **FR24** | Daily study streak tracking & milestone badges | Epic 8 (Story 8.2) |
| **FR25** | Health probe endpoints (`GET /healthz`) & Load Balancer setup | Epic 9 (Story 9.1) |
| **FR26** | Redis distributed caching for SRS queues & sessions | Epic 9 (Story 9.2) |
| **FR27** | Isolated Docker worker pool for code execution | Epic 9 (Story 9.3) |
| **FR29** | Anonymous public study groups & decks discovery | Epic 10 (Story 10.1) |
| **FR30** | Ephemeral flashcard review & sandbox code execution | Epic 10 (Story 10.2) |
| **FR31** | Contextual OAuth sign-up gating & intent preservation | Epic 10 (Story 10.3) |
| **FR32** | Anonymous guest execution rate limiting & resource guards | Epic 10 (Story 10.4) |

---

## Epic List

* **Epic 5: Social Authentication, Self-Service Password Reset, User Profiles, Session Resiliency & Platform Super-Admin Operations** (FR13, FR14, FR28, FR36, FR37, FR18, FR19)
* **Epic 6: In-App Notification Center & Event Engine** (FR15, FR16, FR17)
* **Epic 7: Modernized UI/UX Design System, Mobile Responsiveness & Workspace** (FR33, FR34, FR35, FR20, FR21, FR22)




* **Epic 8: Spaced Repetition Analytics & Gamification** (FR23, FR24)
* **Epic 9: High-Availability Infrastructure & Execution Isolation** (FR25, FR26, FR27)
* **Epic 10: Anonymous Guest Access & Ephemeral Discovery Funnel** (FR29, FR30, FR31, FR32)

---

## Epic Details & Acceptance Criteria

### Epic 5: Social Authentication & Platform Super-Admin Operations

#### Story 5.1: Google & GitHub OAuth2 Social Login
**As a** new or existing learner,  
**I want to** sign in using my Google or GitHub credentials,  
**So that** I can authenticate quickly without entering a password.  

* **Acceptance Criteria:**
  * **Given** the login/registration page,  
    **When** I click "Continue with Google" or "Continue with GitHub",  
    **Then** I am redirected to the provider OAuth consent screen.
  * **Given** a successful OAuth callback,  
    **When** the email matches an existing user account,  
    **Then** the API links the OAuth provider and returns a valid JWT access token.
  * **Given** an unlinked OAuth login for a new email,  
    **When** authentication completes,  
    **Then** a new `User` record is created and logged in seamlessly.

#### Story 5.2: Platform Super-Admin Dashboard Metrics
**As a** Platform Super-Admin,  
**I want to** view global platform operational metrics on a `/admin` dashboard,  
**So that** I can monitor system growth, usage activity, and user presence.  

* **Acceptance Criteria:**
  * **Given** an authenticated user with `SuperAdmin` role,  
    **When** I navigate to `/admin`,  
    **Then** I see live summary tiles and growth charts for:
    * Total Study Groups created (with historical trend).
    * Total Card Runs, Exercise Runs, and Content Inserts.
    * Real-time count of online vs. offline users.
  * **Given** a non-SuperAdmin user,  
    **When** accessing `/admin`,  
    **Then** the system responds with `403 Forbidden`.

#### Story 5.3: Platform-Wide User Role Management
**As a** Platform Super-Admin,  
**I want to** search for users and manage their global roles,  
**So that** I can elevate users to Contributor, Admin, or SuperAdmin status.  

* **Acceptance Criteria:**
  * **Given** the Super-Admin user management panel,  
    **When** I search for a user by display name or email,  
    **Then** I see their current role and account status.
  * **Given** a selected user,  
    **When** I change their role and click Save,  
    **Then** the user's global role is updated in the database and audit logged.

#### Story 5.4: Self-Service Password Reset & Verification
**As a** registered learner who forgot their password,  
**I want to** request a password reset email and use a secure token link to set a new password,  
**So that** I can regain access to my account safely without admin intervention.  

* **Acceptance Criteria:**
  * **Given** a registered user's email address on the "Forgot Password" page,  
    **When** submitted (`POST /api/auth/forgot-password`),  
    **Then** the backend generates a cryptographically secure, single-use, time-limited reset token (15 min expiry) and sends an email containing the reset URL.
  * **Given** a valid reset token and new password payload (`POST /api/auth/reset-password`),  
    **When** submitted,  
    **Then** the user's PBKDF2 password hash is updated, the reset token is invalidated, and active auth sessions/tokens are revoked.
  * **Given** an expired, altered, or previously used reset token,  
    **When** submitted to `/api/auth/reset-password`,  
    **Then** the request is rejected with `400 Bad Request` and a clear error message.

#### Story 5.5: User Profile Center & Display Name Customization

**As a** registered learner,  
**I want to** visit a dedicated `/profile` section and edit my display name,  
**So that** my profile, comments, cards, and presence accurately reflect my identity across AnkiX.  

* **Acceptance Criteria:**
  * **Given** an authenticated user,  
    **When** navigating to `/profile` (via navigation user dropdown, mobile hamburger menu, or direct route),  
    **Then** a clean profile view renders their account email, current display name, assigned roles, auth provider badge (Local Email, Google, or GitHub), member since date, and study stats.
  * **Given** an updated display name input (`2–50 characters`),  
    **When** submitted (`PUT /api/auth/profile`),  
    **Then** the backend validates and updates `User.DisplayName`, returns the updated user object, and sanitizes input.
  * **Given** a successful profile update response,  
    **When** received by the frontend,  
    **Then** the local storage user session (`ankix_user`), context, and navigation avatar/label update immediately without requiring a full logout or page reload.
  * **Given** an unauthenticated visitor attempting to access `/profile`,  
    **When** loaded,  
    **Then** they are redirected to `/login` with an intent redirect back to `/profile` post-authentication.

#### Story 5.6: Persistent Active Session Resiliency, Silent Refresh Tokens & Seamless Retry Interceptor

**As a** learner actively studying decks or an author writing rich markdown exercises,  
**I want** my authenticated session to persist reliably across long active sessions with silent token refresh and zero-disruption retry on expired tokens,  
**So that** I am never unexpectedly logged out or blocked from saving my work with a `401 Unauthorized` error in the middle of active engagement.  

* **Acceptance Criteria:**
  * **Silent Token Refresh Engine (`POST /api/auth/refresh-token`):** The backend issues a cryptographically secure refresh token stored in PostgreSQL with token rotation and revocation support. A dedicated endpoint `POST /api/auth/refresh-token` validates the refresh token and returns a new JWT access token without requiring manual user re-login.
  * **Extended Session Lifetimes:** Increase standard JWT access token lifetime or sliding session renewal window so active users browsing for hours or days do not face hard cut-offs.
  * **Transparent 401 Client Interceptor (`safeFetch`):** In `src/frontend/src/api.js`, wrap authenticated requests with a silent refresh retry mechanism: when an API call returns `401 Unauthorized`, `safeFetch` intercepts the error, calls `POST /api/auth/refresh-token`, updates the stored JWT token, and transparently retries the original pending request with the fresh token.
  * **Zero Work Discard & In-Place Re-Auth:** If a session is genuinely expired or revoked beyond refresh limits, the UI triggers a non-destructive contextual re-auth modal that saves the in-flight form data (e.g. exercise drafting in progress) and completes the original submission immediately upon successful login.

---

### Epic 6: In-App Notification Center & Event Engine



#### Story 6.1: Notification Event Dispatcher
**As a** learner or content author,  
**I want to** trigger and store notifications for key platform actions,  
**So that** relevant parties are informed automatically.  

* **Acceptance Criteria:**
  * **Given** a card follow-up created by a user,  
    **When** saved to the database,  
    **Then** notification records are created for the card author and Study Group admins.
  * **Given** an exercise linked to resolve a follow-up,  
    **When** saved,  
    **Then** a notification record is created for the follow-up creator (*"An answer exercise was linked to your follow-up!"*).

#### Story 6.2: Header Notification Bell & Live Unread Counter
**As a** user,  
**I want to** see an unread badge counter on a notification bell icon in the top header,  
**So that** I know when new updates require my attention.  

* **Acceptance Criteria:**
  * **Given** unread notifications for the active user,  
    **When** viewing any page on the app,  
    **Then** the header bell icon displays a dynamic unread badge count.
  * **Given** no unread notifications,  
    **When** viewing the header,  
    **Then** the badge is hidden cleanly.

#### Story 6.3: Interactive Notification Drawer & History View
**As a** user,  
**I want to** open a notification drawer and click on items to navigate directly to the relevant card or follow-up,  
**So that** I can take action on updates immediately.  

* **Acceptance Criteria:**
  * **Given** the header notification bell,  
    **When** clicked,  
    **Then** a dropdown popover slides out listing recent notifications with timestamp and read/unread status.
  * **Given** a notification item in the drawer,  
    **When** clicked,  
    **Then** the notification marks as read and redirects the browser directly to the target URL (e.g. `/study?cardId=123`).

---

### Epic 7: Modernized UI/UX Design System, Mobile Responsiveness & Workspace

#### Story 7.0: Universal Mobile-First Responsiveness & Touch Adaptive UX
**As a** learner using AnkiX on a mobile phone or tablet,  
**I want to** navigate, study flashcards, run code exercises, and manage content seamlessly with touch ergonomics,  
**So that** I have a first-class, distraction-free study experience on any device.  

* **Acceptance Criteria:**
  * **Collapsible Mobile Header (Option B):** On viewports `<768px`, the horizontal navbar collapses into a clean header with brand title and a top-right hamburger menu icon (☰) that opens a slide-out navigation drawer with touch-friendly links (Study Groups, Decks, Exercises, Admin, Profile, Logout).
  * **Touch-Optimized Study Session (`Deck.jsx`):** Flashcards expand to 100% viewport width without horizontal window blowout. Wide markdown code blocks feature internal horizontal scroll with a floating copy button. The `[Again] [Hard] [Good] [Easy]` rating buttons are pinned to a sticky bottom bar at the bottom of the screen for one-handed thumb interaction.
  * **Tabbed Mobile Coding Sandbox (`Exercises.jsx`):** On screens `<768px`, the coding challenge workspace transitions from side-by-side columns into a 3-tab layout: `[Problem & Specs]`, `[Code Editor]`, `[Terminal Output & Diffs]`, accompanied by a persistent floating action button (`▶ Run Code`).
  * **Adaptive Modals & Bottom Sheets:** The Rapid Add card drawer, Edit Card modal, and Study Group dialogs render as full-width bottom sheets on mobile devices with safe keyboard auto-scrolling.
  * **Guest Landing Touch Optimization:** On mobile viewports, the landing hero action buttons (`Try as Guest`, `Explore Groups`, `Sign In`) stack vertically into full-width touch buttons (min 44px height).
  * **iOS Zoom Prevention & Touch Targets:** Form inputs enforce a minimum `16px` font size on mobile to prevent iOS Safari auto-zoom, and all buttons adhere to a minimum 44px tap target.

#### Story 7.1: Vector Icon Migration (`lucide-react`)

**As a** platform user,  
**I want to** experience a clean, modern interface using vector icons instead of inline emojis,  
**So that** the app feels professional and visually cohesive.  

* **Acceptance Criteria:**
  * **Given** the frontend codebase,  
    **When** rendered,  
    **Then** legacy emojis across headers, deck lists, cards, study controls, and exercise filters are replaced with matching `lucide-react` icons.

#### Story 7.2: Monaco Code Editor Integration
**As a** learner practicing micro-coding cards or exercises,  
**I want to** type code in a Monaco Code Editor,  
**So that** I have auto-indentation, line numbers, and syntax highlighting.  

* **Acceptance Criteria:**
  * **Given** a micro-coding card or standalone exercise view,  
    **When** opened,  
    **Then** the plain text textarea is replaced by an embedded Monaco Code Editor tailored to the target language (Python, JS, Go, C#).

#### Story 7.3: Dark / Light Mode Theme System
**As a** user,  
**I want to** toggle between Dark and Light mode themes,  
**So that** I can adjust the UI for comfortable reading day or night.  

* **Acceptance Criteria:**
  * **Given** the theme toggle switch in settings or navbar,  
    **When** clicked,  
    **Then** the theme switches instantly between dark and light palettes, saving the selection in `localStorage`.

#### Story 7.4: Multi-Modal Exercise Integrity, Controlled Folksonomy Tagging & Locked Runtime Engine

**As a** learner practicing exercises and a contributor authoring them,  
**I want to** experience consistent multi-modal rendering (MCQ, Short Answer, Code), controlled folksonomy topic tagging with creatable autocomplete, locked execution runtimes, dynamic catalog filtering, and clean deduplicated action controls,  
**So that** linked card exercises render faithfully, catalog filtering adapts dynamically, and authors can tag exercises with any subject domain.  

* **Acceptance Criteria:**
  * **Consistent Linked Card Exercise Projection:** `GET /api/cards/{cardId}/exercises` backend projection includes `ExerciseType` and `ExerciseSpec`, ensuring MCQ and Short Answer exercises render their respective native radio buttons and text response forms in the linked card modal (`ExercisePracticeModal`) rather than defaulting to a code editor.
  * **Deduplicated Execution & Submission Controls:** In `Deck.jsx` `ExercisePracticeModal`, the duplicate hardcoded "▶ Run Solution" button is removed, delegating action control entirely to `ExerciseRenderer` (which renders a single, clean `Check Answer`, `Submit Answer`, or `▶ Run Solution` button based on exercise modality).
  * **Locked Execution Runtime:** For Code Execution exercises, the practice view locks execution strictly to the exercise's authored language (Python, C#, JavaScript, Go) and removes the runtime `<select>` switcher, rendering the language as a read-only tag badge.
  * **Controlled Folksonomy & Creatable Autocomplete for Non-Coding Exercises:** MCQ and Short Answer creation and editing interfaces provide a smart topic tag input with `<datalist>` autocomplete suggestions from popular presets and existing catalog tags, while allowing authors to type any custom topic/domain tag (e.g. `Kubernetes`, `React`, `Neuroscience`, `Docker`). Input is automatically sanitized and normalized.
  * **Dynamic Catalog Filter Chips & Palette Generator:** The `/exercises` catalog dynamically derives filter chips from all distinct tags in the active catalog, and renders custom badges using a deterministic, high-contrast pastel palette.
  * **Polished Tag Badge Rendering:** Non-coding exercises display their custom topic badge with a clean, neutral or deterministically colored theme rather than defaulting to a purple `C#` badge.

#### Story 7.5: UI Exercise Management & Rich Markdown Rendering across Modalities

**As an** admin or contributor authoring exercises and a learner practicing them,  
**I want to** edit existing exercises directly from the UI and compose descriptions, instructions, prompts, and MCQ options with rich Markdown formatting,  
**So that** exercise content is easily maintainable and renders formatted code snippets, lists, emphasis, and diagrams cleanly.  

* **Acceptance Criteria:**
  * **UI Exercise Editing Modal:** Study group admins and contributors (with manage/create permissions) see an "✏️ Edit" button on exercise cards in `Exercises.jsx`. Clicking opens an Edit Exercise modal preloaded with title, modality (Code Execution, MCQ, Exact String), topic tag/language, description, starter/solution code, test specs, and MCQ options.
  * **Frontend API Integration:** Add `updateExercise(id, payload)` in `src/frontend/src/api.js` calling `PUT /api/exercises/{id}` with proper auth headers and error handling.
  * **Rich Markdown Input Fields:** Replace plain textareas for Exercise Description / Instructions and MCQ options in both Create and Edit modals with `MarkdownField` (providing live preview, syntax hint, and tab switching).
  * **Rich Markdown Display across Modalities:** Use `MarkdownViewer` to render exercise descriptions, instructions, prompts, and MCQ option choices in both standalone exercise views (`Exercises.jsx`) and linked card modals (`ExercisePracticeModal` in `Deck.jsx`), supporting inline code, multi-line code blocks, bold/italics, and lists.
  * **Permissions & State Synchronization:** Submitting an exercise edit updates the exercise state in-place in both the catalog and active practice workspace without requiring a full page refresh.

#### Story 7.6: Search Card Preview Modal Integrity & Rendering Resiliency

**As a** learner or contributor searching across study groups and decks on `/search`,  
**I want to** click the "👁 Preview" button on any search result card to inspect the full card prompt, answer, follow-ups, and linked exercises without crashing or receiving a blank screen,  
**So that** I can preview and interact with flashcards immediately from search results.  

* **Acceptance Criteria:**
  * **Modal Render Integrity:** Clicking "👁 Preview" on any card in the `/search` page renders `CardDetailModal` seamlessly without throwing `ReferenceError: useStudyGroup is not defined` or unmounting the React tree.
  * **Interactive Tab Switching:** Inside the preview modal, users can switch between `[Card Details]`, `[Follow-ups]`, and `[Linked Exercises]` smoothly.
  * **Exercise Linker Form Binding:** The "✨ Create & Link New Exercise" sub-form inside the card detail linker correctly binds to the submission handler without unhandled reference errors.
  * **Inline Editing & Synchronization:** Authorized contributors/admins can edit card prompt and answer within the preview modal, synchronizing changes with search result state upon saving.

#### Story 7.7: Shared Card Modals & Linker Refactoring

**As a** frontend developer maintaining AnkiX and a learner interacting with flashcards,  
**I want** child card dialogs (`CardExerciseLinkerModal`, `ConvertFollowupModal`, and `LinkedCardsPreviewModal`) extracted into shared, reusable component files,  
**So that** card exercise linking, follow-up conversion, and linked card carousels are unified, DRY, and maintain consistent indexing logic across both the study deck view and search preview.  

* **Acceptance Criteria:**
  * **Component Extraction:** Extract `CardExerciseLinkerModal`, `ConvertFollowupModal`, and `LinkedCardsPreviewModal` from `CardDetailModal.jsx` and `Deck.jsx` into standalone components in `src/frontend/src/components/`.
  * **MCQ Indexing Alignment:** In the shared `CardExerciseLinkerModal`, ensure MCQ `correctIndex` resolves accurately without off-by-one shifts when option slots are left empty, matching the patched validation logic.
  * **Unified Usage:** Both `CardDetailModal.jsx` and `Deck.jsx` import and render the shared components with identical prop interfaces and behavior.
  * **Regression Testing:** All existing study session, search preview, deck editing, and exercise management tests continue to pass without regression.

#### Story 7.8: Group Admin Study Group & Deck Name Management

**As a** Study Group Admin, Owner, or Contributor,  
**I want to** edit the Study Group name and description, as well as deck names and descriptions directly from the UI,  
**So that** curricula and learning cohort titles can be updated, refined, and maintained accurately.  

* **Acceptance Criteria:**
  * **Study Group Name & Details Editing (`PUT /api/study-groups/{slug}`):** Group Owners, Admins, and Platform Super-Admins can update the group name, description, and avatar URL. If the group is frozen, the API rejects modifications with `403 Forbidden`. Unauthorized members receive `403 Forbidden`.
  * **Deck Name & Description Editing (`PUT /api/content/decks/{deckId}`):** Group Admins, Contributors, and Deck Authors can update deck titles and descriptions. Requests enforce content management permissions and respect group freeze locks.
  * **Deck Actions Dropdown Integration:** On `Decks.jsx`, each deck's `Actions ▾` dropdown includes an "✏️ Edit" option that opens an Edit Deck modal with preloaded Title and Description. Submitting updates the deck state immediately in the table.
  * **Study Group Workspace Renaming:** On `StudyGroups.jsx` (inside the Manage & Settings modal) and `Decks.jsx` (in the active study group header), authorized admins see controls to edit and rename the study group, with instant UI synchronization.

#### Story 7.9: User-Level Card Ghosting / Suspension & Queue Personalization

**As a** learner reviewing cards in a large, shared, or complex deck,  
**I want to** mark specific flashcards as "Ghosted" (👻) directly during study sessions or preview modals,  
**So that** the spaced repetition queue permanently excludes those cards from my personal study sessions without deleting them for other members of the study group.  

* **Acceptance Criteria:**
  * **Interactive Ghost Button on Cards:** In `Deck.jsx` (during study mode) and `CardDetailModal.jsx` (card preview), an interactive "👻 Ghost Card" (and "✨ Restore Card") toggle button is available for authenticated learners.
  * **User-Scoped Ghosting API (`POST /api/cards/{cardId}/ghost` & `DELETE /api/cards/{cardId}/ghost`):** Backend persists user-level card suspensions (e.g. `UserGhostedCard` entity / table) mapped strictly to `(UserId, CardId)`.
  * **Queue Exclusion:** The study queue endpoint (`GET /api/decks/{deckId}/queue`) and review scheduler filter out all cards ghosted by the requesting user, reducing cognitive fatigue and deck intimidation.
  * **"Ghosted Cards" Drawer & Restoration:** In `Deck.jsx`, learners can open a "Ghosted Cards" drawer / view to inspect all cards they have muted in that deck, and click "✨ Un-ghost" to restore any card back to their active review queue.
  * **Shared Deck Isolation:** Ghosting a card by user $A$ has zero impact on user $B$ or the master deck definition; cards remain visible in deck totals for creators and other group members.

#### Story 7.10: LaTeX Mathematical Notation Support (KaTeX)

**As a** learner reviewing algorithmic, computer science, and mathematical flashcards,  
**I want** mathematical notation formatted with LaTeX to render clearly with formulas, superscripts, subscripts, and equations,  
**So that** I can study algorithms, Big-O notations, data structures, and scientific formulas with proper mathematical typography.  

* **Acceptance Criteria:**
  * **Inline & Block Math Processing:** Integrate `remark-math` and `rehype-katex` into `MarkdownViewer.jsx` alongside `remark-gfm` and `rehype-highlight`. Expressions surrounded by `$formula$` render as crisp inline math, and expressions enclosed in `$$formula$$` render as centered display equations.
  * **Visual Typography & Styling:** Import `katex/dist/katex.min.css` to render standard mathematical fonts, fractions, square roots, integrals, and summations cleanly in dark and light modes.
  * **Authoring Live Preview & Hint:** Update `MarkdownField.jsx` hint to inform authors of LaTeX support (`$inline$`, `$$block$$`), and verify formulas render dynamically in the live markdown preview tab during card and exercise authoring.
  * **Mobile Equation Overflow Protection:** Add CSS overflow handling (`overflow-x: auto`) for KaTeX display blocks so large equations scroll horizontally on mobile screens (<480px) without breaking page layout.
  * **Code Block Dollar Sign Preservation:** Verify that literal dollar signs inside code snippets (e.g. bash variables `$HOME` or PHP `$var`) remain untouched and continue to be highlighted as code.

---

### Epic 8: Spaced Repetition Analytics & Gamification





#### Story 8.1: GitHub-Style Study Activity Heatmap
**As a** learner,  
**I want to** see a contribution-style activity heatmap on my dashboard,  
**So that** I can visualize my daily study consistency over the past year.  

* **Acceptance Criteria:**
  * **Given** the user dashboard,  
    **When** loaded,  
    **Then** an interactive heatmap renders daily review/run intensity with color-coded density cells.

#### Story 8.2: Study Streak Counter & Milestone Badges
**As a** learner,  
**I want to** maintain a daily study streak and earn milestone badges,  
**So that** I stay motivated to review cards every day.  

* **Acceptance Criteria:**
  * **Given** a completed daily study session,  
    **When** reviews are recorded,  
    **Then** my `CurrentStreak` increments by 1.
  * **Given** missing a full calendar day of reviews,  
    **When** checked,  
    **Then** the streak resets to 0 (unless a streak freeze is active).

---

### Epic 9: High-Availability Infrastructure & Execution Isolation

#### Story 9.1: Health Probe Endpoints & NGINX Load Balancing
**As a** DevOps engineer,  
**I want** explicit health probe endpoints and load balancer routing configs,  
**So that** the API can scale horizontally across multiple web instances.  

* **Acceptance Criteria:**
  * **Given** `GET /healthz`,  
    **When** requested by a load balancer probe,  
    **Then** the API verifies database/cache connectivity and returns `200 OK`.

#### Story 9.2: Redis Queue & Session Caching
**As a** platform system,  
**I want to** cache hot SRS study queues in Redis,  
**So that** study queue fetching completes in under 50ms.  

* **Acceptance Criteria:**
  * **Given** `GET /api/decks/{id}/study-queue`,  
    **When** called repeatedly,  
    **Then** subsequent responses are served directly from Redis cache and invalidated automatically upon review submissions.

#### Story 9.3: Isolated Docker Code Execution Runner Pool
**As a** platform operator,  
**I want** user code execution to run inside isolated Docker worker containers,  
**So that** untrusted code cannot affect the host server or main API process.  

* **Acceptance Criteria:**
  * **Given** a code run submission,  
    **When** processed by `CodeExecutionService`,  
    **Then** execution is dispatched to a containerized sandbox with memory (128MB max), CPU execution timeout (3s max), and disabled network access.

---

### Epic 10: Anonymous Guest Access & Ephemeral Discovery Funnel

#### Story 10.1: Public Study Groups & Decks Discovery for Unregistered Guests
**As an** unregistered visitor,  
**I want to** search and browse public study groups, decks, and cards without creating an account,  
**So that** I can evaluate AnkiX content and curriculum before registering.  

* **Acceptance Criteria:**
  * **Given** an unauthenticated visitor,  
    **When** requesting `GET /api/study-groups/public` or `GET /api/decks/public`,  
    **Then** the API returns public groups and decks with card counts and descriptions (`[AllowAnonymous]`).
  * **Given** an unauthenticated visitor,  
    **When** browsing or searching study groups,  
    **Then** private and invite-only study groups are strictly excluded from the query results.
  * **Given** an unauthenticated request to a private group endpoint (`GET /api/study-groups/{id}`),  
    **When** requested,  
    **Then** the API returns `404 Not Found` or `401 Unauthorized` without leaking group metadata.
  * **Given** the frontend public explore/catalog view,  
    **When** viewed in guest mode,  
    **Then** public content renders with a subtle "Guest Mode — Explore & Preview" top banner.

#### Story 10.2: Ephemeral Flashcard Preview & Sandbox Code Execution
**As an** unregistered visitor,  
**I want to** flip flashcards and run test suites on public coding exercises in an ephemeral sandbox,  
**So that** I can experience the interactive study workflow without persisting database state.  

* **Acceptance Criteria:**
  * **Given** an unauthenticated visitor previewing a public deck,  
    **When** stepping through flashcards,  
    **Then** cards render in sequential preview mode and no review attempts (`POST /api/reviews`) or SM-2 interval calculations are dispatched or stored in the database.
  * **Given** an unauthenticated visitor solving a public coding exercise,  
    **When** clicking "Run Code",  
    **Then** the solution executes against the sandbox runner via ephemeral endpoint (`POST /api/exercises/{id}/run-ephemeral`) and returns test assertion output to the UI without saving an execution log to PostgreSQL.
  * **Given** an unauthenticated request to authenticated mutation endpoints (`POST /api/reviews`, `POST /api/cards/{id}/follow-ups`),  
    **When** sent,  
    **Then** the API rejects the request with `401 Unauthorized`.

#### Story 10.3: Contextual Auth Modals & Intent-Preserving Sign-Up Gating
**As an** unregistered visitor,  
**I want** clear, contextual sign-up prompts when attempting gated actions,  
**So that** I understand the benefits of an account and can sign up with one click without losing my place.  

* **Acceptance Criteria:**
  * **Given** an unregistered visitor on a study group or card view,  
    **When** clicking "Join Study Group", "Ask Follow-up", or "Save Progress / Start Spaced Repetition",  
    **Then** an authentication modal appears explaining the value proposition (e.g., *"Sign in with Google or GitHub to join study groups and activate the SM-2 Spaced Repetition engine"*).
  * **Given** a user authenticating via OAuth or registration through the modal,  
    **When** login completes,  
    **Then** the application redirects the user back to their active card or completes the intended join action seamlessly.
  * **Given** an unregistered visitor viewing a card with community follow-up discussions,  
    **When** opened,  
    **Then** all existing follow-up questions and verified solutions render in read-only mode with the question submission form prompting sign-up.

#### Story 10.4: Guest IP Sliding-Window Rate Limiting & Resource Guards
**As a** platform operator,  
**I want to** enforce sliding-window IP rate limiting on anonymous code runs and apply strict execution resource caps,  
**So that** guest traffic cannot exhaust runner container pools or abuse sandbox resources.  

* **Acceptance Criteria:**
  * **Given** an anonymous IP address submitting ephemeral code runs,  
    **When** request volume exceeds 10 runs within a 10-minute sliding window,  
    **Then** the API responds with `429 Too Many Requests` and a standard `Retry-After` header.
  * **Given** any ephemeral guest execution request,  
    **When** processed in the Docker sandbox,  
    **Then** execution is constrained to a 3-second CPU timeout, 128MB RAM limit, and isolated network namespace.
  * **Given** an authenticated user session,  
    **When** running code exercises,  
    **Then** their user-tier quota applies independently of guest IP limits.

