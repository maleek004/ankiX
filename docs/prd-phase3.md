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

> [!NOTE]
> **Explicit Scope Boundary:** Multi-language execution additions (Rust, TypeScript, Java) and multi-test-case diff viewer UI are explicitly deferred to Phase 4.

---

## 2. User Roles & System Matrix

| Role | Access Scope | Primary Actions |
|---|---|---|
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

---

## 5. Success Metrics & Counter-Metrics

| Success Metric | Target | Counter-Metric | Risk Mitigation |
|---|---|---|---|
| **Social Login Adoption** | $\ge 60\%$ of new sign-ups via Google/GitHub | Duplicate accounts created with different emails | Account linking prompt upon duplicate email detection |
| **Notification Engagement** | $\ge 40\%$ click-through on follow-up resolution notifications | Notification fatigue / spam complaints | Per-user notification preferences & mark-all-read controls |
| **P95 Queue Latency** | $< 50\text{ms}$ with Redis caching | Cache invalidation staleness on card updates | Event-driven cache purging on card/review mutations |
