using System.Data.SqlClient;

string? conn = Environment.GetEnvironmentVariable("SEED_CONNECTION");
if (string.IsNullOrWhiteSpace(conn) && args.Length > 0) conn = args[0];
if (string.IsNullOrWhiteSpace(conn))
{
    Console.Error.WriteLine("Provide connection string via SEED_CONNECTION env var or as first arg.");
    return 1;
}

using var sql = new SqlConnection(conn);
await sql.OpenAsync();
Console.WriteLine("Connected to DB.");

using var tx = sql.BeginTransaction();
try
{
    // Insert user
    var insertUserCmd = new SqlCommand("INSERT INTO [Users] ([Email],[PasswordHash],[DisplayName],[Role],[CreatedAt]) VALUES (@e,@ph,@dn,@r,@ca); SELECT SCOPE_IDENTITY();", sql, tx);
    insertUserCmd.Parameters.AddWithValue("@e", "admin@ankix.local");
    insertUserCmd.Parameters.AddWithValue("@ph", "seeded-hash");
    insertUserCmd.Parameters.AddWithValue("@dn", "Admin");
    insertUserCmd.Parameters.AddWithValue("@r", "Admin");
    insertUserCmd.Parameters.AddWithValue("@ca", DateTime.UtcNow);
    var userId = Convert.ToInt32(await insertUserCmd.ExecuteScalarAsync());

    // Insert deck
    var insertDeckCmd = new SqlCommand("INSERT INTO [Decks] ([Title],[Description],[CreatedAt]) VALUES (@t,@d,@ca); SELECT SCOPE_IDENTITY();", sql, tx);
    insertDeckCmd.Parameters.AddWithValue("@t", "Seeded Deck");
    insertDeckCmd.Parameters.AddWithValue("@d", "A deck created by seed script");
    insertDeckCmd.Parameters.AddWithValue("@ca", DateTime.UtcNow);
    var deckId = Convert.ToInt32(await insertDeckCmd.ExecuteScalarAsync());

    // Insert cards
    var insertCardCmd = new SqlCommand("INSERT INTO [Cards] ([DeckId],[Type],[Prompt],[ValidationSpec],[CreatedAt]) VALUES (@deck,@type,@prompt,@vs,@ca);", sql, tx);
    insertCardCmd.Parameters.AddWithValue("@deck", deckId);
    insertCardCmd.Parameters.AddWithValue("@type", "basic");
    insertCardCmd.Parameters.AddWithValue("@prompt", "What is 2+2?");
    insertCardCmd.Parameters.AddWithValue("@vs", "{\"answer\":\"4\"}");
    insertCardCmd.Parameters.AddWithValue("@ca", DateTime.UtcNow);
    await insertCardCmd.ExecuteNonQueryAsync();

    insertCardCmd.Parameters[2].Value = "What is the capital of France?";
    insertCardCmd.Parameters[3].Value = "{\"answer\":\"Paris\"}";
    await insertCardCmd.ExecuteNonQueryAsync();

    tx.Commit();
    Console.WriteLine($"Seeded user {userId}, deck {deckId} and 2 cards.");
    return 0;
}
catch (Exception ex)
{
    Console.Error.WriteLine("Seed failed: " + ex.Message);
    try { tx.Rollback(); } catch { }
    return 2;
}
