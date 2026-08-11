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
| **FR15** | In-app notification when card follow-up is created | Epic 6 (Story 6.1) |
| **FR16** | In-app notification when exercise is linked to follow-up | Epic 6 (Story 6.1) |
| **FR17** | Header Notification Bell icon with unread badge & drawer | Epic 6 (Story 6.2, 6.3) |
| **FR18** | Platform Super-Admin Dashboard (Groups, Runs/Inserts, Online Users) | Epic 5 (Story 5.2) |
| **FR19** | Platform Super-Admin global user role management | Epic 5 (Story 5.3) |
| **FR20** | Vector icon system migration (`lucide-react`) | Epic 7 (Story 7.1) |
| **FR21** | Monaco Code Editor integration for code cards & exercises | Epic 7 (Story 7.2) |
| **FR22** | Dark / Light mode theme switcher engine | Epic 7 (Story 7.3) |
| **FR23** | GitHub-style study activity heatmap | Epic 8 (Story 8.1) |
| **FR24** | Daily study streak tracking & milestone badges | Epic 8 (Story 8.2) |
| **FR25** | Health probe endpoints (`GET /healthz`) & Load Balancer setup | Epic 9 (Story 9.1) |
| **FR26** | Redis distributed caching for SRS queues & sessions | Epic 9 (Story 9.2) |
| **FR27** | Isolated Docker worker pool for code execution | Epic 9 (Story 9.3) |

---

## Epic List

* **Epic 5: Social Authentication, Self-Service Password Reset & Platform Super-Admin Operations** (FR13, FR14, FR28, FR18, FR19)
* **Epic 6: In-App Notification Center & Event Engine** (FR15, FR16, FR17)
* **Epic 7: Modernized UI/UX Design System & Workspace** (FR20, FR21, FR22)
* **Epic 8: Spaced Repetition Analytics & Gamification** (FR23, FR24)
* **Epic 9: High-Availability Infrastructure & Execution Isolation** (FR25, FR26, FR27)

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

### Epic 7: Modernized UI/UX Design System & Workspace

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
