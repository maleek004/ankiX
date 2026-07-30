using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AnkiX.Api.Controllers;

public sealed class ImageUploadResponse
{
    public string ImageUrl { get; set; } = string.Empty;
    public string OriginalName { get; set; } = string.Empty;
}

[ApiController]
[Authorize]
[Route("api/content/images")]
public sealed class ImagesController : ControllerBase
{
    private readonly IWebHostEnvironment environment;

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"
    };

    public ImagesController(IWebHostEnvironment environment)
    {
        this.environment = environment;
    }

    /// <summary>
    /// Uploads an image file and returns its relative static URL for embedding in markdown.
    /// </summary>
    [HttpPost]
    [RequestSizeLimit(5 * 1024 * 1024)] // 5 MB Limit
    public async Task<ActionResult<ImageUploadResponse>> UploadImage([FromForm] IFormFile? file)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new { message = "No image file provided." });
        }

        if (file.Length > 5 * 1024 * 1024)
        {
            return BadRequest(new { message = "File size exceeds maximum limit of 5MB." });
        }

        string extension = Path.GetExtension(file.FileName);
        if (string.IsNullOrEmpty(extension) || !AllowedExtensions.Contains(extension))
        {
            return BadRequest(new { message = "Invalid file type. Allowed formats: PNG, JPG, JPEG, GIF, WEBP, SVG." });
        }

        string webRootPath = environment.WebRootPath;
        if (string.IsNullOrEmpty(webRootPath))
        {
            webRootPath = Path.Combine(environment.ContentRootPath, "wwwroot");
        }

        string uploadsDir = Path.Combine(webRootPath, "uploads");
        if (!Directory.Exists(uploadsDir))
        {
            Directory.CreateDirectory(uploadsDir);
        }

        string uniqueFileName = $"{Guid.NewGuid():N}{extension.ToLowerInvariant()}";
        string filePath = Path.Combine(uploadsDir, uniqueFileName);

        using (FileStream stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        string imageUrl = $"/uploads/{uniqueFileName}";
        return Ok(new ImageUploadResponse
        {
            ImageUrl = imageUrl,
            OriginalName = file.FileName
        });
    }
}
