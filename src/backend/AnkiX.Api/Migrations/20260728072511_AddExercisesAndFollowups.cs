using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AnkiX.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddExercisesAndFollowups : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'[dbo].[CardExercises]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [CardExercises] (
                        [CardId] int NOT NULL,
                        [ExerciseId] int NOT NULL,
                        CONSTRAINT [PK_CardExercises] PRIMARY KEY ([CardId], [ExerciseId])
                    );
                END
            ");

            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'[dbo].[CardFollowups]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [CardFollowups] (
                        [Id] bigint IDENTITY(1,1) NOT NULL,
                        [CardId] int NOT NULL,
                        [AuthorUserId] int NOT NULL,
                        [QuestionText] nvarchar(1000) NOT NULL,
                        [LinkedCardId] int NULL,
                        [CreatedAt] datetime2 NOT NULL,
                        CONSTRAINT [PK_CardFollowups] PRIMARY KEY ([Id])
                    );
                END
            ");

            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'[dbo].[Exercises]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [Exercises] (
                        [Id] int IDENTITY(1,1) NOT NULL,
                        [Title] nvarchar(200) NOT NULL,
                        [CreatedAt] datetime2 NOT NULL,
                        CONSTRAINT [PK_Exercises] PRIMARY KEY ([Id])
                    );
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_CardExercises_ExerciseId' AND object_id = OBJECT_ID(N'[dbo].[CardExercises]'))
                BEGIN
                    CREATE INDEX [IX_CardExercises_ExerciseId] ON [CardExercises] ([ExerciseId]);
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_CardFollowups_AuthorUserId' AND object_id = OBJECT_ID(N'[dbo].[CardFollowups]'))
                BEGIN
                    CREATE INDEX [IX_CardFollowups_AuthorUserId] ON [CardFollowups] ([AuthorUserId]);
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_CardFollowups_CardId' AND object_id = OBJECT_ID(N'[dbo].[CardFollowups]'))
                BEGIN
                    CREATE INDEX [IX_CardFollowups_CardId] ON [CardFollowups] ([CardId]);
                END
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CardExercises");

            migrationBuilder.DropTable(
                name: "CardFollowups");

            migrationBuilder.DropTable(
                name: "Exercises");
        }
    }
}
