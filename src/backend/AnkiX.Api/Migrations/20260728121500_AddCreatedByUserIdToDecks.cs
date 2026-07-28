using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AnkiX.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCreatedByUserIdToDecks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF NOT EXISTS (
                    SELECT * FROM sys.columns 
                    WHERE object_id = OBJECT_ID(N'[dbo].[Decks]') 
                    AND name = N'CreatedByUserId'
                )
                BEGIN
                    ALTER TABLE [Decks] ADD [CreatedByUserId] INT NULL;
                END
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF EXISTS (
                    SELECT * FROM sys.columns 
                    WHERE object_id = OBJECT_ID(N'[dbo].[Decks]') 
                    AND name = N'CreatedByUserId'
                )
                BEGIN
                    ALTER TABLE [Decks] DROP COLUMN [CreatedByUserId];
                END
            ");
        }
    }
}
