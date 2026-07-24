using System.Data.SqlClient;

if (args.Length < 2)
{
    Console.Error.WriteLine("Usage: add-cards <connection-string> <deckId> [count]");
    return 2;
}

string conn = args[0];
int deckId = int.Parse(args[1]);
int count = args.Length >= 3 ? int.Parse(args[2]) : 3;

using var sql = new SqlConnection(conn);
await sql.OpenAsync();
Console.WriteLine("Connected to DB.");

using var tx = sql.BeginTransaction();
try
{
    var cmd = new SqlCommand("INSERT INTO [Cards] ([DeckId],[Type],[Prompt],[ValidationSpec],[CreatedAt]) VALUES (@deck,@type,@prompt,@vs,@ca);", sql, tx);
    cmd.Parameters.Add(new SqlParameter("@deck", deckId));
    cmd.Parameters.Add(new SqlParameter("@type", "basic"));
    cmd.Parameters.Add(new SqlParameter("@prompt", ""));
    cmd.Parameters.Add(new SqlParameter("@vs", ""));
    cmd.Parameters.Add(new SqlParameter("@ca", DateTime.UtcNow));

    for (int i = 1; i <= count; i++)
    {
        cmd.Parameters[2].Value = $"Sample question {i}: What is {i}+{i}?";
        cmd.Parameters[3].Value = $"{{\"answer\":\"{i+i}\"}}";
        await cmd.ExecuteNonQueryAsync();
    }

    tx.Commit();
    Console.WriteLine($"Inserted {count} cards into deck {deckId}.");
    return 0;
}
catch (Exception ex)
{
    Console.Error.WriteLine("Failed to insert cards: " + ex.Message);
    try{ tx.Rollback(); } catch{}
    return 3;
}
