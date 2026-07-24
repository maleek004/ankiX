-- Phase 1 migration: Global Shared Curriculum + role-based authorization
-- Target model:
-- 1) Users.Role (User | Contributor | Admin)
-- 2) Decks/Cards are global (no OwnerId / CreatedBy ownership columns)

SET XACT_ABORT ON;
BEGIN TRANSACTION;

/* 1) USERS: ensure Role exists (and backfill from IsAdmin when present) */
IF COL_LENGTH('dbo.Users', 'Role') IS NULL
BEGIN
    ALTER TABLE [dbo].[Users]
    ADD [Role] NVARCHAR(20) NULL;
END;

IF COL_LENGTH('dbo.Users', 'IsAdmin') IS NOT NULL
BEGIN
    UPDATE [dbo].[Users]
    SET [Role] = CASE WHEN [IsAdmin] = 1 THEN 'Admin' ELSE 'User' END
    WHERE [Role] IS NULL OR LTRIM(RTRIM([Role])) = '';
END
ELSE
BEGIN
    UPDATE [dbo].[Users]
    SET [Role] = 'User'
    WHERE [Role] IS NULL OR LTRIM(RTRIM([Role])) = '';
END;

IF COL_LENGTH('dbo.Users', 'Role') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[Users]
    ALTER COLUMN [Role] NVARCHAR(20) NOT NULL;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c
        ON dc.parent_object_id = c.object_id
       AND dc.parent_column_id = c.column_id
    WHERE dc.parent_object_id = OBJECT_ID('dbo.Users')
      AND c.name = 'Role'
)
BEGIN
    ALTER TABLE [dbo].[Users]
    ADD CONSTRAINT [DF_Users_Role] DEFAULT ('User') FOR [Role];
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.Users')
      AND name = 'CK_Users_Role'
)
BEGIN
    ALTER TABLE [dbo].[Users]
    ADD CONSTRAINT [CK_Users_Role] CHECK ([Role] IN ('User', 'Contributor', 'Admin'));
END;

/* 2) USERS: drop IsAdmin safely (drop bound default first if one exists) */
IF COL_LENGTH('dbo.Users', 'IsAdmin') IS NOT NULL
BEGIN
    DECLARE @IsAdminDefault SYSNAME;
    SELECT @IsAdminDefault = dc.name
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c
        ON dc.parent_object_id = c.object_id
       AND dc.parent_column_id = c.column_id
    WHERE dc.parent_object_id = OBJECT_ID('dbo.Users')
      AND c.name = 'IsAdmin';

    IF @IsAdminDefault IS NOT NULL
    BEGIN
        EXEC('ALTER TABLE [dbo].[Users] DROP CONSTRAINT [' + @IsAdminDefault + ']');
    END;

    ALTER TABLE [dbo].[Users] DROP COLUMN [IsAdmin];
END;

/* 3) DECKS: drop OwnerId and any FKs that depend on it */
IF COL_LENGTH('dbo.Decks', 'OwnerId') IS NOT NULL
BEGIN
    DECLARE @DeckOwnerFk SYSNAME;
    DECLARE deck_fk_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT fk.name
    FROM sys.foreign_keys fk
    INNER JOIN sys.foreign_key_columns fkc
        ON fk.object_id = fkc.constraint_object_id
    INNER JOIN sys.columns c
        ON c.object_id = fkc.parent_object_id
       AND c.column_id = fkc.parent_column_id
    WHERE fk.parent_object_id = OBJECT_ID('dbo.Decks')
      AND c.name = 'OwnerId';

    OPEN deck_fk_cursor;
    FETCH NEXT FROM deck_fk_cursor INTO @DeckOwnerFk;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        EXEC('ALTER TABLE [dbo].[Decks] DROP CONSTRAINT [' + @DeckOwnerFk + ']');
        FETCH NEXT FROM deck_fk_cursor INTO @DeckOwnerFk;
    END;
    CLOSE deck_fk_cursor;
    DEALLOCATE deck_fk_cursor;

    ALTER TABLE [dbo].[Decks] DROP COLUMN [OwnerId];
END;

/* 4) CARDS: drop CreatedBy and any FKs that depend on it */
IF COL_LENGTH('dbo.Cards', 'CreatedBy') IS NOT NULL
BEGIN
    DECLARE @CardCreatedByFk SYSNAME;
    DECLARE card_fk_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT fk.name
    FROM sys.foreign_keys fk
    INNER JOIN sys.foreign_key_columns fkc
        ON fk.object_id = fkc.constraint_object_id
    INNER JOIN sys.columns c
        ON c.object_id = fkc.parent_object_id
       AND c.column_id = fkc.parent_column_id
    WHERE fk.parent_object_id = OBJECT_ID('dbo.Cards')
      AND c.name = 'CreatedBy';

    OPEN card_fk_cursor;
    FETCH NEXT FROM card_fk_cursor INTO @CardCreatedByFk;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        EXEC('ALTER TABLE [dbo].[Cards] DROP CONSTRAINT [' + @CardCreatedByFk + ']');
        FETCH NEXT FROM card_fk_cursor INTO @CardCreatedByFk;
    END;
    CLOSE card_fk_cursor;
    DEALLOCATE card_fk_cursor;

    ALTER TABLE [dbo].[Cards] DROP COLUMN [CreatedBy];
END;

COMMIT TRANSACTION;
