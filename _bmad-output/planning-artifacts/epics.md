---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - /home/l2e/Desktop/ankiX/docs/product-brief-phase1.md
  - /home/l2e/Desktop/ankiX/docs/phase1-api-contract.md
  - /home/l2e/Desktop/ankiX/docs/data-model-phase1.md
  - /home/l2e/Desktop/ankiX/_bmad-output/planning-artifacts/research/technical-phase-1-implementation-architecture-for-net-api-react-azure-research-2026-07-24.md
---

# ankix - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for ankix, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Users can register with email/password and create an account.  
FR2: Users can authenticate via login and receive a valid access token session.  
FR3: Authenticated users can browse a global shared deck library.  
FR4: Authenticated users can view cards for a selected deck.  
FR5: The system supports two card types: micro-coding and concept cards.  
FR6: Users can submit code answers for micro-coding cards and receive PASS/FAIL feedback.  
FR7: The backend persists each code run attempt per user and card with execution details.  
FR8: Users can submit review outcomes (Hard/Good/Easy) for cards.  
FR9: The system computes and stores per-user SM-2 scheduling fields, including next review date.  
FR10: Contributors and Admins can create decks and cards.  
FR11: Only Admins can edit and delete decks and cards.  
FR12: Role-based access controls are enforced for all protected content and review/run endpoints.

### NonFunctional Requirements

NFR1: 95% of code-run requests should complete under 3 seconds.  
NFR2: API security must use JWT bearer authentication and role-based authorization.  
NFR3: Untrusted code execution must be proxied to a third-party execution API (no direct host execution).  
NFR4: Request payloads must be validated, and code-run limits/timeouts must be enforced.  
NFR5: The system must be deployable to Azure App Service with Azure SQL staging environment support.  
NFR6: Backend C# code should use explicit types and a flat endpoint design style for Phase 1 consistency.  
NFR7: SQL design should remain explicit/simple for Phase 1 (straightforward joins, no advanced SQL complexity).  
NFR8: Core role authorization behavior must be verifiably correct for User/Contributor/Admin.  
NFR9: Core scheduling logic should be testable and pass SM-2 parameter update checks.  
NFR10: Architecture should favor maintainable Phase 1 simplicity (modular monolith baseline, incremental scale path).

### Additional Requirements

- Starter/architecture direction: implement as a modular monolith with clear module boundaries and defer early microservice decomposition.
- Data model must include Users, Decks, Cards, CardRuns, and ReviewRecords with explicit relational constraints and indexes.
- Authorization model must use `Users.Role` (`User`, `Contributor`, `Admin`) and enforce endpoint-level policy rules.
- Global curriculum model: shared decks/cards (no per-deck ownership in Phase 1 baseline schema).
- API contract must include defined auth/content/review/run endpoints and common error responses (`400/401/403/404/429/502`).
- Integrations should use REST/JSON as Phase 1 edge contract; defer gRPC/event patterns unless justified by workload pressure.
- Deployment must use staging-slot release discipline with rollback-by-swap capability.
- Observability should include telemetry/monitoring readiness from early implementation stages.
- External execution API integration requires resilience controls (timeouts/retries and failure handling strategy).

### UX Design Requirements

No UX design contract (`DESIGN.md` + `EXPERIENCE.md`) was found in planning artifacts for this cycle.

### FR Coverage Map

### FR Coverage Map

FR1: Epic 1 - User can register with email/password.  
FR2: Epic 1 - User can log in and establish authenticated session access.  
FR3: Epic 1 - User can browse global deck library.  
FR4: Epic 1 - User can view cards in a selected deck.  
FR5: Epic 2 - Study experience supports both micro-coding and concept card types.  
FR6: Epic 2 - User can submit micro-coding answers and receive PASS/FAIL feedback.  
FR7: Epic 2 - System persists code run attempts and execution metadata per user/card.  
FR8: Epic 2 - User can submit review outcomes (Hard/Good/Easy).  
FR9: Epic 2 - System computes and stores per-user SM-2 next review schedule.  
FR10: Epic 3 - Contributor/Admin can create decks and cards.  
FR11: Epic 4 - Admin can edit/delete existing decks and cards.  
FR12: Epic 4 - Role-based authorization is enforced across protected workflows.

## Epic List

## Epic List

### Epic 1: Account Access and Curriculum Discovery
Users can register, sign in, and immediately explore the shared deck/card curriculum to start learning.
**FRs covered:** FR1, FR2, FR3, FR4

### Epic 2: Active Study Sessions and Personalized Scheduling
Users can complete concept and micro-coding study sessions, receive run feedback, and build a personalized review schedule.
**FRs covered:** FR5, FR6, FR7, FR8, FR9

### Epic 3: Contributor-Led Content Expansion
Contributors can safely publish new decks and cards so curriculum breadth can grow continuously.
**FRs covered:** FR10

### Epic 4: Admin Governance and Role Enforcement
Admins can govern curriculum quality through edit/delete controls while role policies are enforced end-to-end.
**FRs covered:** FR11, FR12

## Epic 1: Account Access and Curriculum Discovery

Users can register, sign in, and immediately explore the shared deck/card curriculum to start learning.

### Story 1.1: Register User Account

As a new learner,
I want to register with email and password,
So that I can access the flashcard platform.

**FRs:** FR1

**Acceptance Criteria:**

**Given** a unique email and valid password payload
**When** I submit `POST /api/auth/register`
**Then** a user record is created with default `User` role
**And** the API returns `201` with user identity summary.

### Story 1.2: Login and Receive Access Token

As a registered learner,
I want to log in with my credentials,
So that I can access authenticated study endpoints.

**FRs:** FR2

**Acceptance Criteria:**

**Given** valid user credentials
**When** I submit `POST /api/auth/login`
**Then** the API returns a JWT access token with expiry metadata
**And** invalid credentials return an authorization error without exposing sensitive details.

### Story 1.3: Browse Global Decks and Deck Cards

As an authenticated learner,
I want to browse decks and view cards in a selected deck,
So that I can choose what to study.

**FRs:** FR3, FR4

**Acceptance Criteria:**

**Given** a valid JWT token
**When** I request `GET /api/decks` and `GET /api/decks/{deckId}/cards`
**Then** I receive global shared deck/card data
**And** unauthorized requests return `401`.

## Epic 2: Active Study Sessions and Personalized Scheduling

Users can complete concept and micro-coding study sessions, receive run feedback, and build a personalized review schedule.

### Story 2.1: Support Concept and Micro-Coding Card Rendering

As a learner,
I want study cards to render by type (concept or micro-coding),
So that I can interact with each card in the intended format.

**FRs:** FR5

**Acceptance Criteria:**

**Given** card data with `type` set to `concept` or `micro-coding`
**When** I open a study card
**Then** the UI presents the correct interaction mode for that card type
**And** unsupported card types are rejected safely.

### Story 2.2: Run Micro-Coding Answers and Persist Attempts

As a learner practicing coding,
I want to run submitted code and receive pass/fail feedback,
So that I can validate my solution quickly.

**FRs:** FR6, FR7

**Acceptance Criteria:**

**Given** a micro-coding card and submitted code
**When** I call `POST /api/cards/{cardId}/run`
**Then** the backend proxies execution to the configured third-party runner and returns result details
**And** a `CardRuns` record is persisted with duration and outcome metadata.

### Story 2.3: Save Review Outcomes and Compute Next Review Date

As a learner,
I want my review outcomes to update my next due date,
So that I get a personalized spaced-repetition schedule.

**FRs:** FR8, FR9

**Acceptance Criteria:**

**Given** a review outcome (`Hard`, `Good`, or `Easy`)
**When** I call `POST /api/reviews`
**Then** the system persists a `ReviewRecords` entry with updated `EaseFactor`, `IntervalDays`, and `NextReviewAt`
**And** the response returns the updated scheduling values.

## Epic 3: Contributor-Led Content Expansion

Contributors can safely publish new decks and cards so curriculum breadth can grow continuously.

### Story 3.1: Contributor Creates New Deck

As a contributor,
I want to create a new deck,
So that I can expand the shared curriculum.

**FRs:** FR10

**Acceptance Criteria:**

**Given** an authenticated user with role `Contributor` or `Admin`
**When** I submit `POST /api/content/decks` with valid payload
**Then** a new deck is created and visible in global deck listings
**And** users without required role receive `403`.

### Story 3.2: Contributor Creates New Card

As a contributor,
I want to create a concept or micro-coding card in a deck,
So that learners can study new content immediately.

**FRs:** FR10

**Acceptance Criteria:**

**Given** an authenticated user with role `Contributor` or `Admin` and an existing deck
**When** I submit `POST /api/content/cards` with valid card payload
**Then** a new card is created in that deck with required fields persisted
**And** invalid payloads return `400`.

### Story 3.3: Validate Contributor Authoring Inputs

As a platform maintainer,
I want contributor content payloads validated before persistence,
So that malformed curriculum data does not enter production.

**FRs:** FR10

**Acceptance Criteria:**

**Given** deck/card creation requests
**When** required fields are missing or invalid
**Then** the API rejects requests with clear validation errors
**And** no partial records are written.

## Epic 4: Admin Governance and Role Enforcement

Admins can govern curriculum quality through edit/delete controls while role policies are enforced end-to-end.

### Story 4.1: Admin Updates Existing Decks and Cards

As an admin,
I want to edit existing decks and cards,
So that I can correct and improve published content.

**FRs:** FR11, FR12

**Acceptance Criteria:**

**Given** an authenticated admin user
**When** I call `PUT /api/content/decks/{deckId}` or `PUT /api/content/cards/{cardId}`
**Then** the target resource is updated when it exists
**And** non-admin users receive `403`.

### Story 4.2: Admin Deletes Decks and Cards

As an admin,
I want to delete obsolete or incorrect content,
So that the curriculum remains accurate and clean.

**FRs:** FR11, FR12

**Acceptance Criteria:**

**Given** an authenticated admin user
**When** I call `DELETE /api/content/decks/{deckId}` or `DELETE /api/content/cards/{cardId}`
**Then** the target resource is removed according to referential constraints
**And** requests for missing resources return `404`.

### Story 4.3: Enforce Runtime Security and Release Guardrails

As a platform owner,
I want role enforcement, run limits/timeouts, and staged deployment guardrails,
So that production remains secure and stable during changes.

**FRs:** FR12

**Acceptance Criteria:**

**Given** protected endpoints and code-run flows
**When** unauthorized access or execution limit violations occur
**Then** the API enforces policy and returns expected error codes (`401/403/429/502` as applicable)
**And** deployments are validated through staging before production promotion.
