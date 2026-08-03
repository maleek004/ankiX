using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AnkiX.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMultiModalExerciseTypes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF NOT EXISTS (
                    SELECT * FROM sys.columns 
                    WHERE object_id = OBJECT_ID(N'[dbo].[Exercises]') 
                    AND name = N'ExerciseType'
                )
                BEGIN
                    ALTER TABLE [Exercises] ADD [ExerciseType] NVARCHAR(50) NOT NULL DEFAULT 'CodeExecution';
                    ALTER TABLE [Exercises] ADD [ExerciseSpec] NVARCHAR(MAX) NULL;
                END
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF EXISTS (
                    SELECT * FROM sys.columns 
                    WHERE object_id = OBJECT_ID(N'[dbo].[Exercises]') 
                    AND name = N'ExerciseType'
                )
                BEGIN
                    ALTER TABLE [Exercises] DROP COLUMN [ExerciseType];
                    ALTER TABLE [Exercises] DROP COLUMN [ExerciseSpec];
                END
            ");
        }
    }
}
