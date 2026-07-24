# Checkpoint 003 — Phase 1 Wrap-up

Date: 2026-07-24T16:12:10.520+01:00

Summary
-------
Phase 1 (API + Frontend scaffold, DB integration, seeding) progressed from planning into a working implementation:

- Backend: .NET 10 modular-monolith Web API implemented (auth, decks, cards, services). JWT auth and EF Core models/migrations created.
- Database: Initial EF migration created and applied to Azure SQL; seeding performed (seed tools + in-app seeder). Added test cards via tools/add-cards.
- Frontend: Vite + React scaffolded, auth flow wired, dev proxy to backend validated; UI shows seeded decks/cards.
- Dev tools: Small CLI helpers (seed, update-password, add-cards) created for DB ops.

Progress / How far in Phase 1
-----------------------------
Estimated completion: ~80%.

Completed (major):
- Project scaffold (backend + frontend)
- Auth, deck/card endpoints, DTOs, and services
- EF Core initial migration + applied to Azure
- DB seeding and additional test data insertion
- Frontend routing, auth provider, and CRUD flows (dev proxy validated)

Remaining (major):
- Replace placeholder secrets with env/Key Vault (critical)
- Replace obsolete PBKDF2 constructor usage with modern Pbkdf2 API
- Implement & E2E test study/run and review endpoints (SM-2 persistence)
- Integrate or mock external Execution API for run-type cards
- Add unit/integration tests and CI (GitHub Actions) with reproducible runtimes
- Address package advisories (Microsoft.OpenApi, System.Data.SqlClient warnings)

Files / Artifacts of note
-------------------------
- src/backend/AnkiX.Api/Program.cs (DI, JWT, DbContext, seeding)
- src/backend/AnkiX.Api/Data/ApplicationDbContext.cs (models & indexes)
- src/backend/AnkiX.Api/Controllers/* (Auth, Decks, Content)
- src/frontend/ (Vite + React app, api client, AuthProvider)
- tools/{seed,update-password,add-cards} (DB helpers)
- Session checkpoint: this file — docs/checkpoints/003-phase-1-wrap-up.md

Immediate next steps (recommended order)
---------------------------------------
1. Rotate/secure Azure DB credentials used during setup (move secrets to env or Key Vault).
2. Run update-password to set a secure admin password, then remove seeded credentials.
3. Replace Rfc2898DeriveBytes constructor usage with Pbkdf2 static API and run full build.
4. Implement and test study/run endpoints end-to-end (persist CardRuns, ReviewRecords; SM-2 scheduler).
5. Integrate or mock Execution API; add contract tests for run-type cards.
6. Add CI workflow: build, run migrations, seed on ephemeral DB, run tests (use correct Node/.NET runtimes).
7. Remediate package advisories (update or replace vulnerable packages).
8. Cleanup: remove test cards if needed or create a test-only flag for seeding.

Action items for follow-up
-------------------------
- Create GitHub Actions workflow for build/migrate/test.
- Decide and implement secret management (env vars vs Key Vault).
- Define Execution API contract or provide a mocked endpoint for dev.

Notes / Risks
------------
- Do NOT commit real secrets to repo. Rotate credentials after this session.
- Some libraries produced advisories; upgrade or replace before production.

Checkpoint created at:
docs/checkpoints/003-phase-1-wrap-up.md

End of checkpoint 003.
