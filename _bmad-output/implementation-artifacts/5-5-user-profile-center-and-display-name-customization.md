# Story 5.5: User Profile Center & Display Name Customization

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** registered learner,  
**I want to** visit a dedicated `/profile` section and customize my display name,  
**So that** my profile, comments, decks, cards, and presence accurately reflect my identity across AnkiX.

## Acceptance Criteria

1. **Dedicated User Profile Route (`/profile`) & Navigation Linkage:**
   - Authenticated learners navigating to `/profile` (via top navigation user profile link, mobile drawer menu, or direct URL) see a clean, responsive profile center.
   - Profile summary clearly displays:
     - Account Email
     - Current Display Name
     - Assigned Platform Roles (e.g. `Learner`, `Admin`, `SuperAdmin`)
     - Auth Provider Badge (`Local Email`, `Google`, `GitHub`)
     - Email Verification Status Badge (`Verified` / `Pending Verification`)
     - Member Since Date (formatted cleanly)
     - Study Activity Snapshot (Reviews completed, Decks created).
   - Unauthenticated visitors attempting to access `/profile` are redirected to `/login` via `RequireAuth`, with login intent preservation.

2. **Display Name Customization API (`PUT /api/auth/profile` & `GET /api/auth/profile`):**
   - Implements authenticated endpoint `PUT /api/auth/profile` requiring a valid JWT bearer token.
   - Accepts request payload: `{ "displayName": string }`.
   - Validates input:
     - Length must be between 2 and 50 characters (after trimming leading/trailing whitespace).
     - Rejects empty, whitespace-only, or over-50-character strings with `400 Bad Request` and descriptive error message.
     - Sanitizes input to prevent HTML/XSS injection.
   - Updates `User.DisplayName` in the database and returns updated user payload `{ id, email, displayName, role, authProvider, isEmailVerified, createdAt }`.
   - Implements authenticated endpoint `GET /api/auth/profile` returning the user's full profile details and study activity summary stats.

3. **Instant Client State Synchronization (`AuthProvider` & Local Storage):**
   - Upon successful display name update, client state immediately reflects the change:
     - `AuthProvider` state (`user`) is updated via `updateUser(updatedUser)`.
     - `ankix_user` local storage entry is updated with the new display name.
     - Navigation bar avatar label, mobile drawer user info, and active session update immediately without requiring page refresh or logout.
   - Success toast / notification banner is displayed confirming the update.

4. **Self-Service Password & Security Quick Actions:**
   - Provide direct quick-action links within the Profile Center:
     - Link to password reset / change workflow (`/forgot-password`).
     - Resend verification email action if account is unverified (for local accounts).

## Tasks / Subtasks

- [x] Task 1: Backend DTO & API Endpoint (`PUT /api/auth/profile` & `GET /api/auth/profile`) (AC: 2)
  - [x] Create `UpdateProfileRequest.cs` in `src/backend/AnkiX.Api/Contracts/Auth/`.
  - [x] Create `UserProfileResponse.cs` in `src/backend/AnkiX.Api/Contracts/Auth/`.
  - [x] Implement `[Authorize] [HttpPut("profile")]` in `src/backend/AnkiX.Api/Controllers/AuthController.cs`.
  - [x] Implement `[Authorize] [HttpGet("profile")]` in `src/backend/AnkiX.Api/Controllers/AuthController.cs` to return full profile metadata and stats.
  - [x] Add unit tests in `src/backend/AnkiX.Api.Tests/ProfileTests.cs` testing validation, authorization, and updates.
- [x] Task 2: Frontend API Client Layer Integration (`api.js`) (AC: 2, 3)
  - [x] Add `updateProfile(displayName)` in `src/frontend/src/api.js`.
  - [x] Add `getProfile()` in `src/frontend/src/api.js`.
- [x] Task 3: Auth Context Synchronization in `AuthProvider.jsx` (AC: 3)
  - [x] Add `updateUser(partialUser)` in `src/frontend/src/auth/AuthProvider.jsx` to update state and `ankix_user` in localStorage.
- [x] Task 4: Profile Page UI & Navigation Integration (`Profile.jsx`, `NavBar.jsx`, `App.jsx`) (AC: 1, 3, 4)
  - [x] Create `src/frontend/src/pages/Profile.jsx` with account summary, edit display name form, provider badges, role badges, member since date, and study stats.
  - [x] Add `/profile` route wrapped with `RequireAuth` in `src/frontend/src/App.jsx`.
  - [x] Update `NavBar.jsx` to make the user badge clickable to `/profile` in both desktop header and mobile drawer.
- [x] Task 5: Automated Testing & Verification (AC: 1, 2, 3, 4)
  - [x] Create `src/frontend/src/__tests__/Profile.test.jsx` testing rendering, input validation, editing, and state update.
  - [x] Run backend tests (`dotnet test` - 130 tests passing).
  - [x] Run frontend tests (`npm run test:ci` - 12 suites, 41 tests passing).
  - [x] Update `sprint-status.yaml` to `done`.

### Review Findings

- [x] [Review][Patch] Fix redundant getProfile fetch by scoping useEffect dependency to user?.id [src/frontend/src/pages/Profile.jsx:47]
- [x] [Review][Patch] Synchronize text input state upon successful display name save [src/frontend/src/pages/Profile.jsx:66]
- [x] [Review][Patch] Handle surrogate pairs and emojis in avatar initial rendering [src/frontend/src/pages/Profile.jsx:108, src/frontend/src/components/NavBar.jsx:107, 216]
- [x] [Review][Patch] Sanitize control characters and collapse internal whitespace in backend [src/backend/AnkiX.Api/Controllers/AuthController.cs:496]
- [x] [Review][Patch] Add unmount timer cleanup for feedback messages [src/frontend/src/pages/Profile.jsx:71, 88]
- [x] [Review][Patch] Add cooldown and prevent concurrent submits on resend verification [src/frontend/src/pages/Profile.jsx:79]

## Dev Notes

### Backend Endpoint Contract
- `PUT /api/auth/profile`
  - Headers: `Authorization: Bearer <JWT>`
  - Request Body: `{ "displayName": "New Name" }`
  - Response (200 OK):
    ```json
    {
      "id": 1,
      "email": "user@example.com",
      "displayName": "New Name",
      "role": "User",
      "authProvider": "local",
      "isEmailVerified": true,
      "createdAt": "2026-07-24T12:00:00Z"
    }
    ```
- `GET /api/auth/profile`
  - Headers: `Authorization: Bearer <JWT>`
  - Response (200 OK):
    ```json
    {
      "id": 1,
      "email": "user@example.com",
      "displayName": "New Name",
      "role": "User",
      "authProvider": "local",
      "isEmailVerified": true,
      "createdAt": "2026-07-24T12:00:00Z",
      "stats": {
        "reviewsCount": 42,
        "decksCreatedCount": 3
      }
    }
    ```

### Components Touched
- `src/backend/AnkiX.Api/Contracts/Auth/UpdateProfileRequest.cs`
- `src/backend/AnkiX.Api/Contracts/Auth/UserProfileResponse.cs`
- `src/backend/AnkiX.Api/Controllers/AuthController.cs`
- `src/backend/AnkiX.Api.Tests/ProfileTests.cs`
- `src/frontend/src/api.js`
- `src/frontend/src/auth/AuthProvider.jsx`
- `src/frontend/src/pages/Profile.jsx`
- `src/frontend/src/components/NavBar.jsx`
- `src/frontend/src/App.jsx`
- `src/frontend/src/__tests__/Profile.test.jsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
