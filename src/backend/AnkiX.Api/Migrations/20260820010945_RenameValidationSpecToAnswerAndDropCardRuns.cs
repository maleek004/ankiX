using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AnkiX.Api.Migrations
{
    /// <inheritdoc />
    public partial class RenameValidationSpecToAnswerAndDropCardRuns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Unwrap JSON {"answer":"..."} values to plain text in Postgres
            migrationBuilder.Sql(
                @"UPDATE ""Cards""
                  SET ""ValidationSpec"" = (""ValidationSpec""::json->>'answer')
                  WHERE ""ValidationSpec"" LIKE '{""answer"":%';"
            );

            // 2. Convert all legacy micro-coding cards to basic
            migrationBuilder.Sql(
                @"UPDATE ""Cards""
                  SET ""Type"" = 'basic'
                  WHERE ""Type"" = 'micro-coding';"
            );

            // 3. Ensure non-null values for column migration
            migrationBuilder.Sql(
                @"UPDATE ""Cards""
                  SET ""ValidationSpec"" = ''
                  WHERE ""ValidationSpec"" IS NULL;"
            );

            // 4. Rename column from ValidationSpec to Answer
            migrationBuilder.RenameColumn(
                name: "ValidationSpec",
                table: "Cards",
                newName: "Answer");

            // 5. Enforce NOT NULL and default value on Answer
            migrationBuilder.AlterColumn<string>(
                name: "Answer",
                table: "Cards",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            // 6. Drop CardRuns table
            migrationBuilder.DropTable(
                name: "CardRuns");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Answer",
                table: "Cards");

            migrationBuilder.AddColumn<string>(
                name: "ValidationSpec",
                table: "Cards",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CardRuns",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CardId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DurationMs = table.Column<int>(type: "integer", nullable: true),
                    Result = table.Column<bool>(type: "boolean", nullable: true),
                    ResultDetails = table.Column<string>(type: "text", nullable: true),
                    SubmittedCode = table.Column<string>(type: "text", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CardRuns", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CardRuns_UserId_CardId",
                table: "CardRuns",
                columns: new[] { "UserId", "CardId" });
        }
    }
}
