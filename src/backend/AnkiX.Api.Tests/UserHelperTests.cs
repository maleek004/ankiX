using AnkiX.Api.Helpers;

namespace AnkiX.Api.Tests;

public sealed class UserHelperTests
{
    [Fact]
    public void GetEffectiveDisplayName_WhenDisplayNameProvided_ReturnsTrimmedDisplayName()
    {
        string result = UserHelper.GetEffectiveDisplayName("  Alice Smith  ", "alice@example.com");
        Assert.Equal("Alice Smith", result);
    }

    [Fact]
    public void GetEffectiveDisplayName_WhenDisplayNameNull_SplitsEmailAtAtSign()
    {
        string result = UserHelper.GetEffectiveDisplayName(null, "bob.builder@example.com");
        Assert.Equal("bob.builder", result);
    }

    [Fact]
    public void GetEffectiveDisplayName_WhenDisplayNameEmptyOrWhitespace_SplitsEmailAtAtSign()
    {
        string result = UserHelper.GetEffectiveDisplayName("   ", "charlie@domain.org");
        Assert.Equal("charlie", result);
    }

    [Fact]
    public void GetEffectiveDisplayName_WhenDisplayNameIsFullEmail_SplitsAtAtSign()
    {
        string result = UserHelper.GetEffectiveDisplayName("dave@example.com", "dave@example.com");
        Assert.Equal("dave", result);
    }

    [Fact]
    public void GetEffectiveDisplayName_WhenBothNullOrWhitespace_ReturnsUser()
    {
        string result = UserHelper.GetEffectiveDisplayName(null, null);
        Assert.Equal("User", result);
    }
}
