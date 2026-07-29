using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AnkiX.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddExerciseReviewRecords : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'[dbo].[ExerciseReviewRecords]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [dbo].[ExerciseReviewRecords] (
                        [Id] bigint IDENTITY(1,1) NOT NULL,
                        [ExerciseId] int NOT NULL,
                        [UserId] int NOT NULL,
                        [Outcome] nvarchar(10) NOT NULL,
                        [EaseFactor] decimal(4,2) NOT NULL,
                        [IntervalDays] int NOT NULL,
                        [NextReviewAt] datetime2 NOT NULL,
                        [CreatedAt] datetime2 NOT NULL,
                        [Phase] nvarchar(10) NOT NULL DEFAULT N'learning',
                        [LearningStep] int NOT NULL DEFAULT 0,
                        CONSTRAINT [PK_ExerciseReviewRecords] PRIMARY KEY CLUSTERED ([Id] ASC)
                    );
                END

                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_ExerciseReviewRecords_UserId_NextReviewAt' AND object_id = OBJECT_ID(N'[dbo].[ExerciseReviewRecords]'))
                BEGIN
                    CREATE NONCLUSTERED INDEX [IX_ExerciseReviewRecords_UserId_NextReviewAt] 
                    ON [dbo].[ExerciseReviewRecords] ([UserId] ASC, [NextReviewAt] ASC);
                END
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'[dbo].[ExerciseReviewRecords]', N'U') IS NOT NULL
                BEGIN
                    DROP TABLE [dbo].[ExerciseReviewRecords];
                END
            ");
        }
    }
}
