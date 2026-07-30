using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AnkiX.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLinkedCardIdsToCardFollowups : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF NOT EXISTS (
                    SELECT * FROM sys.columns 
                    WHERE object_id = OBJECT_ID(N'[dbo].[CardFollowups]') 
                    AND name = N'LinkedCardIds'
                )
                BEGIN
                    ALTER TABLE [CardFollowups] ADD [LinkedCardIds] NVARCHAR(500) NULL;
                END
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF EXISTS (
                    SELECT * FROM sys.columns 
                    WHERE object_id = OBJECT_ID(N'[dbo].[CardFollowups]') 
                    AND name = N'LinkedCardIds'
                )
                BEGIN
                    ALTER TABLE [CardFollowups] DROP COLUMN [LinkedCardIds];
                END
            ");
        }
    }
}
