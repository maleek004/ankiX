using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AnkiX.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUserGhostedCardsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserGhostedCards",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    CardId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserGhostedCards", x => new { x.UserId, x.CardId });
                    table.ForeignKey(
                        name: "FK_UserGhostedCards_Cards_CardId",
                        column: x => x.CardId,
                        principalTable: "Cards",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserGhostedCards_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserGhostedCards_CardId",
                table: "UserGhostedCards",
                column: "CardId");

            migrationBuilder.CreateIndex(
                name: "IX_UserGhostedCards_UserId",
                table: "UserGhostedCards",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserGhostedCards");
        }
    }
}
