using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AnkiX.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddStudyGroupInviteLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "InviteCode",
                table: "StudyGroups",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InviteRole",
                table: "StudyGroups",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Member");

            migrationBuilder.CreateIndex(
                name: "IX_StudyGroups_InviteCode",
                table: "StudyGroups",
                column: "InviteCode");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_StudyGroups_InviteCode",
                table: "StudyGroups");

            migrationBuilder.DropColumn(
                name: "InviteCode",
                table: "StudyGroups");

            migrationBuilder.DropColumn(
                name: "InviteRole",
                table: "StudyGroups");
        }
    }
}
