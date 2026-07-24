# Data Model — Phase 1: Global Shared Curriculum

Date: 2026-07-23

Purpose: define a minimal, explicit schema for Phase 1 where decks/cards are globally shared, while user progress remains personal.

## Core entities
- `Users`
- `Decks`
- `Cards`
- `CardRuns`
- `ReviewRecords`

## T-SQL DDL (Phase 1 baseline)

```sql
CREATE TABLE [dbo].[Users] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [Email] NVARCHAR(254) NOT NULL UNIQUE,
    [PasswordHash] VARBINARY(MAX) NOT NULL,
    [DisplayName] NVARCHAR(128) NULL,
    [Role] NVARCHAR(20) NOT NULL DEFAULT 'User', -- User | Contributor | Admin
    [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE [dbo].[Decks] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [Title] NVARCHAR(200) NOT NULL,
    [Description] NVARCHAR(1000) NULL,
    [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE [dbo].[Cards] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [DeckId] INT NOT NULL REFERENCES [dbo].[Decks](Id),
    [Type] NVARCHAR(50) NOT NULL, -- micro-coding | concept
    [Prompt] NVARCHAR(MAX) NOT NULL,
    [ValidationSpec] NVARCHAR(MAX) NULL, -- used for micro-coding cards
    [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE [dbo].[CardRuns] (
    [Id] BIGINT IDENTITY(1,1) PRIMARY KEY,
    [CardId] INT NOT NULL REFERENCES [dbo].[Cards](Id),
    [UserId] INT NOT NULL REFERENCES [dbo].[Users](Id),
    [SubmittedCode] NVARCHAR(MAX) NOT NULL,
    [Result] BIT NULL, -- 1 pass, 0 fail, NULL pending/error
    [ResultDetails] NVARCHAR(MAX) NULL,
    [DurationMs] INT NULL,
    [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE [dbo].[ReviewRecords] (
    [Id] BIGINT IDENTITY(1,1) PRIMARY KEY,
    [CardId] INT NOT NULL REFERENCES [dbo].[Cards](Id),
    [UserId] INT NOT NULL REFERENCES [dbo].[Users](Id),
    [Outcome] NVARCHAR(10) NOT NULL, -- Hard | Good | Easy
    [EaseFactor] DECIMAL(4,2) NOT NULL,
    [IntervalDays] INT NOT NULL,
    [NextReviewAt] DATETIME2 NOT NULL,
    [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX IX_Cards_DeckId ON [dbo].[Cards]([DeckId]);
CREATE INDEX IX_CardRuns_UserId_CardId ON [dbo].[CardRuns]([UserId], [CardId]);
CREATE INDEX IX_ReviewRecords_UserId_NextReviewAt ON [dbo].[ReviewRecords]([UserId], [NextReviewAt]);
```

## Authorization mapping (API layer)
- `User`: read/review only.
- `Contributor`: create new decks/cards; no edit/delete.
- `Admin`: full create/edit/delete on decks/cards.

## SM-2 scheduling notes
- Persist `EaseFactor` and `IntervalDays` on each review event.
- Compute and store `NextReviewAt` per user/card after each `Hard/Good/Easy` outcome.

## Migration notes from prior drafts
- Remove `Decks.OwnerId` (global curriculum, no deck ownership).
- Remove `Cards.CreatedBy` (no per-card ownership in this phase model).
- Replace `Users.IsAdmin` with `Users.Role` for three-role authorization.
