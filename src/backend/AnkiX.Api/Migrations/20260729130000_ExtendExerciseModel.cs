using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AnkiX.Api.Migrations
{
    /// <inheritdoc />
    public partial class ExtendExerciseModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Exercises]') AND name = N'Description')
                BEGIN
                    ALTER TABLE [Exercises] ADD [Description] nvarchar(4000) NULL;
                END

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Exercises]') AND name = N'Language')
                BEGIN
                    ALTER TABLE [Exercises] ADD [Language] nvarchar(50) NOT NULL DEFAULT N'csharp';
                END

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Exercises]') AND name = N'StarterCode')
                BEGIN
                    ALTER TABLE [Exercises] ADD [StarterCode] nvarchar(max) NULL;
                END

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Exercises]') AND name = N'SolutionCode')
                BEGIN
                    ALTER TABLE [Exercises] ADD [SolutionCode] nvarchar(max) NULL;
                END

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Exercises]') AND name = N'TestCasesSpec')
                BEGIN
                    ALTER TABLE [Exercises] ADD [TestCasesSpec] nvarchar(max) NULL;
                END

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Exercises]') AND name = N'CreatedByUserId')
                BEGIN
                    ALTER TABLE [Exercises] ADD [CreatedByUserId] int NULL;
                END
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Exercises]') AND name = N'Description')
                BEGIN
                    ALTER TABLE [Exercises] DROP COLUMN [Description];
                END

                IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Exercises]') AND name = N'Language')
                BEGIN
                    ALTER TABLE [Exercises] DROP COLUMN [Language];
                END

                IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Exercises]') AND name = N'StarterCode')
                BEGIN
                    ALTER TABLE [Exercises] DROP COLUMN [StarterCode];
                END

                IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Exercises]') AND name = N'SolutionCode')
                BEGIN
                    ALTER TABLE [Exercises] DROP COLUMN [SolutionCode];
                END

                IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Exercises]') AND name = N'TestCasesSpec')
                BEGIN
                    ALTER TABLE [Exercises] DROP COLUMN [TestCasesSpec];
                END

                IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Exercises]') AND name = N'CreatedByUserId')
                BEGIN
                    ALTER TABLE [Exercises] DROP COLUMN [CreatedByUserId];
                END
            ");
        }
    }
}
