using System.ComponentModel.DataAnnotations;

namespace AnkiX.Api.Contracts.Auth;

public sealed class UpdateProfileRequest
{
    [Required(ErrorMessage = "DisplayName is required.")]
    [StringLength(50, MinimumLength = 2, ErrorMessage = "DisplayName must be between 2 and 50 characters.")]
    public string DisplayName { get; set; } = string.Empty;
}
