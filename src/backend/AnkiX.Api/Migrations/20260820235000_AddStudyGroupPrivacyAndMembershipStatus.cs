using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AnkiX.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddStudyGroupPrivacyAndMembershipStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Add Privacy column to StudyGroups
            migrationBuilder.AddColumn<string>(
                name: "Privacy",
                table: "StudyGroups",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Public");

            // 2. Backfill Privacy column based on existing IsPublic values
            migrationBuilder.Sql(
                @"UPDATE ""StudyGroups""
                  SET ""Privacy"" = 'Public'
                  WHERE ""IsPublic"" = true;"
            );

            migrationBuilder.Sql(
                @"UPDATE ""StudyGroups""
                  SET ""Privacy"" = 'Private'
                  WHERE ""IsPublic"" = false;"
            );

            // 3. Drop legacy IsPublic column
            migrationBuilder.DropColumn(
                name: "IsPublic",
                table: "StudyGroups");

            // 4. Add Status, RequestedAt, and InvitedByUserId columns to StudyGroupMembers
            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "StudyGroupMembers",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Active");

            migrationBuilder.AddColumn<DateTime>(
                name: "RequestedAt",
                table: "StudyGroupMembers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "InvitedByUserId",
                table: "StudyGroupMembers",
                type: "integer",
                nullable: true);

            // 5. Backfill Status on StudyGroupMembers
            migrationBuilder.Sql(
                @"UPDATE ""StudyGroupMembers""
                  SET ""Status"" = 'Active'
                  WHERE ""Status"" IS NULL OR ""Status"" = '';"
            );

            // 6. Create composite indexes on StudyGroupMembers for fast lookup
            migrationBuilder.CreateIndex(
                name: "IX_StudyGroupMembers_StudyGroupId_Status",
                table: "StudyGroupMembers",
                columns: new[] { "StudyGroupId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_StudyGroupMembers_UserId_Status",
                table: "StudyGroupMembers",
                columns: new[] { "UserId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_StudyGroupMembers_StudyGroupId_Status",
                table: "StudyGroupMembers");

            migrationBuilder.DropIndex(
                name: "IX_StudyGroupMembers_UserId_Status",
                table: "StudyGroupMembers");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "StudyGroupMembers");

            migrationBuilder.DropColumn(
                name: "RequestedAt",
                table: "StudyGroupMembers");

            migrationBuilder.DropColumn(
                name: "InvitedByUserId",
                table: "StudyGroupMembers");

            migrationBuilder.AddColumn<bool>(
                name: "IsPublic",
                table: "StudyGroups",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.Sql(
                @"UPDATE ""StudyGroups""
                  SET ""IsPublic"" = (""Privacy"" = 'Public');"
            );

            migrationBuilder.DropColumn(
                name: "Privacy",
                table: "StudyGroups");
        }
    }
}
