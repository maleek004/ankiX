using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AnkiX.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUserExercisesTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'[dbo].[UserExercises]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [dbo].[UserExercises] (
                        [UserId] INT NOT NULL,
                        [ExerciseId] INT NOT NULL,
                        [EnrolledAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                        CONSTRAINT [PK_UserExercises] PRIMARY KEY CLUSTERED ([UserId] ASC, [ExerciseId] ASC)
                    );
                END
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'[dbo].[UserExercises]', N'U') IS NOT NULL
                BEGIN
                    DROP TABLE [dbo].[UserExercises];
                END
            ");
        }
    }
}
