# Story 7.8: Group Admin Study Group & Deck Name Management

**Status:** Done  
**Epic:** Epic 7: Modernized UI/UX Design System, Mobile Responsiveness & Workspace  
**Requirement IDs:** FR40  

---

## 1. User Story

**As a** Study Group Admin, Owner, or Contributor,  
**I want to** edit the Study Group name and description, as well as deck names and descriptions directly from the UI,  
**So that** curricula and learning cohort titles can be updated, refined, and maintained accurately.

---

## 2. Acceptance Criteria

1. **Study Group Name & Details Update Endpoint (PUT /api/study-groups/{slug}):**
   - Allows Study Group Owners, Admins, and Platform Super-Admins to update the study group's Name, Description, and AvatarUrl.
   - Rejects updates with 403 Forbidden if the study group is frozen.
   - Rejects unauthorized users (non-members or regular members) with 403 Forbidden.
   - Rejects missing study groups with 404 Not Found.
   - Returns the updated StudyGroupResponse.

2. **Deck Name & Description Update Endpoint (PUT /api/decks/{deckId} & PUT /api/content/decks/{deckId}):**
   - Allows Study Group Admins, Contributors, and Deck Authors to update deck titles and descriptions.
   - Enforces freeze checks on the parent study group.

3. **Frontend API Integration (src/frontend/src/api.js):**
   - Exports updateStudyGroup(slug, payload) calling PUT /api/study-groups/.
   - Exports updateDeck(deckId, title, description) calling PUT /api/content/decks/{deckId}.

4. **Decks Workspace Actions Dropdown & Editing Modal (src/frontend/src/pages/Decks.jsx):**
   - Each deck card's Actions ▾ dropdown includes an  ✏️ Edit option for authorized users (canCreate).
   - Clicking opens an Edit Deck modal preloaded with the deck's title and description.
   - Saving updates the deck state locally in the table with zero page reloads.
   - Active study group header provides a rename/edit option for group owners and admins.

5. **Study Groups Management Modal (src/frontend/src/pages/StudyGroups.jsx):**
   - The Manage & Settings modal includes an ✏️ Edit Details tab for group admins and owners.
   - Saving updates the study group in the catalog list and updates the global ctiveStudyGroup state seamlessly.

---

## 3. Test & Verification Plan

- **Backend Integration Tests:**
  - StudyGroupGovernanceAndFreezeTests.cs:
    - UpdateStudyGroup_ByOwnerOrAdmin_UpdatesNameAndDescription (PASSED)
    - UpdateStudyGroup_ByRegularMember_ReturnsForbid (PASSED)
    - UpdateStudyGroup_WhenFrozen_ReturnsForbidden (PASSED)
    - UpdateStudyGroup_EmptyName_ReturnsBadRequest (PASSED)
    - UpdateDeck_ByGroupAdmin_UpdatesTitleAndDescription (PASSED)
- **Frontend Unit Tests:**
  - Decks.test.jsx:
    - opens Edit Deck modal from Actions dropdown and saves updated title (PASSED)
    - llows study group admin to rename group via Edit Group button in header (PASSED)
  - StudyGroups.test.jsx:
    - llows group owner to edit group name and description from Manage modal (PASSED)

---

### Review Findings

- [x] [Review][Patch] Safe Claim parsing & null route checking in UpdateStudyGroup [src/backend/AnkiX.Api/Controllers/StudyGroupsController.cs:749]
- [x] [Review][Patch] Clean AvatarUrl null/whitespace handling [src/backend/AnkiX.Api/Controllers/StudyGroupsController.cs:763-766]
- [x] [Review][Patch] Add MaxLength(2048) on AvatarUrl in UpdateStudyGroupRequest [src/backend/AnkiX.Api/Contracts/Content/StudyGroupDtos.cs:39]
- [x] [Review][Patch] Sync both name and description to activeStudyGroup [src/frontend/src/pages/StudyGroups.jsx:201]
- [x] [Review][Patch] Include SuperAdmin role in frontend admin edit checks [src/frontend/src/pages/Decks.jsx:165, src/frontend/src/pages/StudyGroups.jsx:598,920,1197]
- [x] [Review][Patch] Add maxLength attributes on title and description inputs [src/frontend/src/pages/Decks.jsx, src/frontend/src/pages/StudyGroups.jsx]
- [x] [Review][Defer] Standalone deck author authorization in CanManageContentAsync [src/backend/AnkiX.Api/Controllers/ContentController.cs:71] — deferred, pre-existing
- [x] [Review][Defer] Migrate browser alerts to toast notifications — deferred, pre-existing UI pattern
