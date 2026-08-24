# Product Requirement Document (PRD) — Phase 3

**Project:** AnkiX — Multi-Language Coding & Spaced Repetition Platform  
**Version:** Phase 3 Scope Definition  
**Date:** August 11, 2026  
**Status:** Approved Draft  

---

## 1. Executive Summary

Phase 3 builds upon the operational **AnkiX v1.0 MVP** foundation (Phase 1 & Phase 2) by transforming the platform into a polished, high-engagement, enterprise-ready learning ecosystem. 

Key focus areas for Phase 3:
1. **OAuth2 Social Sign-In:** Google and GitHub authentication for low-friction onboarding.
2. **In-App Notification Center:** Real-time event notifications for card follow-ups, exercise linking alerts, and group invitations.
3. **Platform Super-Admin Command Center:** System-wide metrics tracking study group expansion, code execution & content insertion statistics, and live user online/offline status.
4. **Modern Design System & UI Overhaul:** Migration from emojis to a vector icon system (`lucide-react`), Monaco Code Editor integration, and a theme engine.
5. **Study Analytics & Gamification:** GitHub-style activity heatmaps, retention tracking, and daily study streaks.
6. **Infrastructure & Scalability:** Load balancer health probes, Redis queue caching, and isolated container execution pools.
7. **Anonymous Guest Browsing & Ephemeral Discovery:** Zero-friction unauthenticated browsing of public study groups, decks, and sandbox code exercises without upfront registration to maximize adoption and reach.

> [!NOTE]
> **Explicit Scope Boundary:** Multi-language execution additions (Rust, TypeScript, Java) and multi-test-case diff viewer UI are explicitly deferred to Phase 4.

---

## 2. User Roles & System Matrix

| Role | Access Scope | Primary Actions |
|---|---|---|
| **Unregistered / Guest User** | Public Study Groups & Public Decks only | Browse public catalog, ephemeral flashcard previews, ephemeral code exercise test runs (no DB records/SM-2), view existing card follow-ups. |
| **Learner (User)** | Personal study & joined Study Groups | OAuth login, study decks, run exercises, receive notifications, view study heatmaps. |
| **Contributor** | Personal & authorized Study Groups | All Learner actions + author decks/cards/exercises, receive notifications on card follow-ups. |
| **Study Group Admin** | Scope-restricted to specific Study Group | All Contributor actions + invite members by email, manage group deck assignments & permissions. |
| **Platform Super-Admin** | System-Wide (Global Platform Operator) | Full system dashboard, monitor active users, view platform-wide run/insert statistics, manage global user roles. |

---

## 3. Functional Requirements (FRs)

### Authentication & Identity
* **FR13:** Users can register and log in using **Google OAuth2** and **GitHub OAuth2** social credentials.
* **FR14:** System links OAuth identities to existing email accounts or provisions new learner accounts automatically.
* **FR28:** Users can request a password reset via email (`POST /api/auth/forgot-password`) and submit a cryptographically secure, time-limited token to update their password (`POST /api/auth/reset-password`).
* **FR36:** Registered users can access a dedicated **User Profile Center** (`/profile`) to view account metadata (Email, OAuth link status, Joined Date, Role) and customize their public **Display Name** across the platform.
* **FR37:** Seamless session persistence and silent token refresh:
  * **Sliding Session / Refresh Token Rotation:** The auth engine provides silent token refreshing (`POST /api/auth/refresh-token`) with extended persistent session lifetimes (e.g. 7–30 days) and rotating refresh tokens stored securely in PostgreSQL.
  * **Zero-Disruption 401 Interceptor:** Client network wrapper (`safeFetch`) catches 401 Unauthorized responses, silently requests a refreshed access token, and transparently retries the in-flight request without aborting user operations or clearing unsubmitted forms.
  * **In-Place Re-Auth Modal & Form State Preservation:** In the event of an unrecoverable auth expiry, the UI opens a lightweight modal to re-authenticate without navigating away or discarding active form drafts (e.g., markdown exercise editor or card creator).



### Anonymous Guest Access & Ephemeral Discovery Funnel
* **FR29:** Unregistered visitors can browse, search, and preview public study groups, public decks, cards, and standalone exercises. Private study groups remain strictly invisible to guest sessions at the query level.
* **FR30:** Unregistered visitors can flip cards and execute code exercises in ephemeral client sessions without SM-2 spaced repetition calculations, review log persistence, or streak recording.
* **FR31:** Gated actions (joining study groups, posting follow-up questions, creating decks/cards, saving spaced repetition progress) trigger contextual OAuth/login modals that preserve user intent.
* **FR32:** Anonymous code execution requests are protected by IP-based sliding window rate limiting (e.g. max 10 runs per 10 minutes per IP) to prevent worker pool resource exhaustion.

### In-App Notification Center
* **FR15:** The platform dispatches in-app notifications to card creators and group admins when a new follow-up question is posted to a card.
* **FR16:** The platform dispatches an in-app notification to the follow-up author when an exercise/solution is linked to resolve their follow-up.
* **FR17:** Navigation header features a **Notification Bell** icon displaying real-time unread badge counts, popover drawer, and a dedicated notification history page.

### Platform Super-Admin Command Center
* **FR18:** Super-Admins can access a dedicated `/admin` dashboard displaying system-wide operational metrics:
  * Total & monthly trend of Study Groups created.
  * Card runs, exercise runs, and content creation (insert) statistics.
  * Real-time online vs. offline platform user counts.
* **FR19:** Super-Admins can view and manage user roles globally across the entire platform.

### UI/UX & Design System Modernization
* **FR20:** Replace all legacy inline emojis across frontend views with vector SVG icons using `lucide-react`.
* **FR21:** Integrate **Monaco Editor** into code flashcards and standalone exercises with auto-indentation and syntax highlighting.
* **FR22:** Implement a system-wide Dark / Light mode theme switcher using CSS custom variables.
* **FR33:** The entire web application is fully responsive and touch-optimized across mobile (<480px), tablet (481px–768px), and desktop (>768px) viewports:
  * **Collapsible Mobile Navigation:** Header collapses into a clean brand bar with notification bell and top hamburger menu drawer (☰) sliding out touch-friendly navigation links and user profile actions.
  * **Ergonomic Mobile Flashcard Study Interface:** Flashcard canvas fluidly expands to full viewport width with horizontal scrolling for wide markdown code blocks, and SRS rating buttons (`Again`, `Hard`, `Good`, `Easy`) are pinned as a sticky bottom bar in the natural thumb zone.
  * **Tabbed Mobile Coding Sandbox:** Coding challenge interface on screens `<768px` transitions from desktop side-by-side into a 3-tab workspace (`[Problem & Specs]`, `[Code Editor]`, `[Terminal Output & Diffs]`) with a persistent floating action button (`▶ Run Code`).
  * **Adaptive Modals & Bottom Sheets:** Card creation/editing drawers, study group invite modals, and dialogs render as native-feeling bottom sheets with 100% width and safe keyboard auto-scrolling.
  * **Guest Hero Touch Optimization:** Landing hero actions (`Try as Guest`, `Explore Groups`, `Sign In`) stack vertically into full-width touch targets (min 44px height) on mobile devices.
* **FR34:** Multi-Modal Exercise Integrity & Custom Topic Tagging:
  * **Consistent Multi-Modal Projection:** Linked card exercises (`GET /api/cards/{cardId}/exercises`) consistently return `ExerciseType` and `ExerciseSpec`, rendering MCQ, Short Answer, and Code Execution formats identically across card views and the catalog.
  * **Locked Execution Runtime:** Code execution exercises strictly execute in the exact language chosen at creation time (Python, C#, JavaScript, Go); runtime switching dropdown during practice is disabled.
  * **Custom Topic & Domain Tags:** MCQ and Short Answer exercises allow custom topic tagging (e.g., Linux, Networking, SQL, DevOps, Architecture, General) rather than forcing programming language assignments.
  * **Deduplicated Action Controls:** Action buttons (`▶ Run Solution`, `Check Answer`, `Submit Answer`) render as single, unified controls across standalone views and linked card modals.
* **FR35:** Exercise Management & Rich Markdown Rendering across Modalities:
  * **UI Exercise Editing:** Allow study group admins and contributors (with content creation permissions) to edit existing exercises directly in the UI with a modal preloaded with full exercise data (title, tag, type, description, specs, code).
  * **Full Markdown Support:** Exercise inputs (descriptions, instructions, prompts, and MCQ option choices) accept full Markdown syntax and render cleanly via `MarkdownViewer` across all exercise practice views, dialogs, and catalog lists.



### Analytics & Gamification
* **FR23:** Provide a **GitHub-style study activity heatmap** on the user dashboard displaying daily card reviews and exercise runs.
* **FR24:** Calculate and display daily study streaks and achievement milestones.

### Infrastructure & Scalability
* **FR25:** Expose standardized health probes (`GET /healthz`) for load balancing readiness.
* **FR26:** Utilize Redis for distributed caching of hot SRS study queues and user session tokens.
* **FR27:** Execute user code solutions in isolated Docker container worker pools with strict CPU and memory bounds.


---

## 4. Non-Functional Requirements (NFRs)

* **NFR11 (Performance):** 95% of cached SRS study queue requests (`GET /api/decks/{id}/study-queue`) must return in under 50ms via Redis caching.
* **NFR12 (Security):** OAuth2 authentication flows must enforce strict PKCE state checks and CSRF token validation.
* **NFR13 (Notification Latency):** In-app notification delivery must occur within 500ms of event dispatch.
* **NFR14 (Scalability):** Backend API statelessness must support horizontal scaling behind NGINX / Azure Application Gateway load balancers.
* **NFR15 (Sandbox Isolation):** Containerized execution workers must operate in isolated bridge networks without outbound internet access.
* **NFR16 (Guest Abuse Prevention & Privacy):** Unauthenticated requests cannot access any private group or user data, and guest code executions are capped at 10 runs / 10 minutes per IP with strict sandbox timeout limits ($< 3\text{s}$).

---

## 5. Success Metrics & Counter-Metrics

| Success Metric | Target | Counter-Metric | Risk Mitigation |
|---|---|---|---|
| **Social Login Adoption** | $\ge 60\%$ of new sign-ups via Google/GitHub | Duplicate accounts created with different emails | Account linking prompt upon duplicate email detection |
| **Guest-to-Learner Conversion** | $\ge 15\%$ of active guest explorers sign up | Anonymous runner resource exhaustion / bot spam | IP sliding-window rate limiting & sandbox execution quotas |
| **Notification Engagement** | $\ge 40\%$ click-through on follow-up resolution notifications | Notification fatigue / spam complaints | Per-user notification preferences & mark-all-read controls |
| **P95 Queue Latency** | $< 50\text{ms}$ with Redis caching | Cache invalidation staleness on card updates | Event-driven cache purging on card/review mutations |
