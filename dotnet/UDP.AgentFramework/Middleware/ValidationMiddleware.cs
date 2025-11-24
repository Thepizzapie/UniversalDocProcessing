namespace UDP.AgentFramework.Middleware;

/// <summary>
/// Middleware for validating file uploads and enforcing security policies
/// </summary>
public class FileValidationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<FileValidationMiddleware> _logger;
    private readonly long _maxFileSize;
    private readonly HashSet<string> _allowedExtensions;

    public FileValidationMiddleware(
        RequestDelegate next,
        IConfiguration configuration,
        ILogger<FileValidationMiddleware> logger)
    {
        _next = next;
        _logger = logger;

        _maxFileSize = configuration.GetValue<long>("DocumentProcessing:MaxFileSizeBytes", 10485760); // 10MB default

        var allowedTypes = configuration.GetSection("Security:AllowedFileTypes").Get<string[]>()
            ?? new[] { ".pdf", ".png", ".jpg", ".jpeg", ".tiff" };

        _allowedExtensions = new HashSet<string>(
            allowedTypes.Select(ext => ext.ToLowerInvariant()),
            StringComparer.OrdinalIgnoreCase);
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Path.StartsWithSegments("/classify-extract") &&
            context.Request.Method == "POST")
        {
            if (context.Request.HasFormContentType)
            {
                var form = await context.Request.ReadFormAsync();
                var file = form.Files.FirstOrDefault();

                if (file != null)
                {
                    // Validate file size
                    if (file.Length > _maxFileSize)
                    {
                        context.Response.StatusCode = 413; // Payload Too Large
                        context.Response.ContentType = "application/json";
                        await context.Response.WriteAsJsonAsync(new
                        {
                            error = $"File size exceeds maximum allowed size of {_maxFileSize / 1024 / 1024}MB",
                            maxSizeBytes = _maxFileSize,
                            receivedBytes = file.Length
                        });
                        return;
                    }

                    // Validate file extension
                    var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
                    if (!_allowedExtensions.Contains(extension))
                    {
                        context.Response.StatusCode = 400; // Bad Request
                        context.Response.ContentType = "application/json";
                        await context.Response.WriteAsJsonAsync(new
                        {
                            error = $"File type '{extension}' is not allowed",
                            allowedTypes = _allowedExtensions.ToArray()
                        });
                        return;
                    }

                    // Validate file is not empty
                    if (file.Length == 0)
                    {
                        context.Response.StatusCode = 400;
                        context.Response.ContentType = "application/json";
                        await context.Response.WriteAsJsonAsync(new
                        {
                            error = "File is empty"
                        });
                        return;
                    }

                    _logger.LogInformation(
                        "File validation passed: {FileName} ({Size} bytes, {Extension})",
                        file.FileName,
                        file.Length,
                        extension);
                }
            }
        }

        await _next(context);
    }
}
