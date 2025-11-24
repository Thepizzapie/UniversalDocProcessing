using Microsoft.AspNetCore.Mvc;
using UDP.AgentFramework.Models;
using UDP.AgentFramework.Services;

namespace UDP.AgentFramework.Controllers;

/// <summary>
/// REST API controller for document processing using Semantic Kernel.
/// </summary>
[ApiController]
[Route("")]
public class DocumentController : ControllerBase
{
    private readonly SemanticKernelOrchestrator _skOrchestrator;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<DocumentController> _logger;

    public DocumentController(
        SemanticKernelOrchestrator skOrchestrator,
        IHttpClientFactory httpClientFactory,
        ILogger<DocumentController> logger)
    {
        _skOrchestrator = skOrchestrator;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    /// <summary>
    /// Classify and extract fields from a document.
    /// Matches Python FastAPI /classify-extract endpoint.
    /// </summary>
    [HttpPost("classify-extract")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(ProcessingResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> ClassifyExtract(
        [FromForm] IFormFile? file = null,
        [FromForm] string? file_url = null,
        [FromForm] bool return_text = false,
        [FromForm] string? doc_type = null,
        [FromForm] bool refine = true,
        [FromForm] bool ocr_fallback = true)
    {
        if (file == null && string.IsNullOrEmpty(file_url))
        {
            return BadRequest(new { error = "Either 'file' or 'file_url' must be provided" });
        }

        byte[] fileBytes;
        string fileName;

        try
        {
            if (file != null)
            {
                // Process uploaded file
                using var memoryStream = new MemoryStream();
                await file.CopyToAsync(memoryStream);
                fileBytes = memoryStream.ToArray();
                fileName = file.FileName;
            }
            else
            {
                // Download from URL using IHttpClientFactory
                var httpClient = _httpClientFactory.CreateClient();
                fileBytes = await httpClient.GetByteArrayAsync(file_url!);
                fileName = Path.GetFileName(new Uri(file_url!).LocalPath);
            }

            _logger.LogInformation("Processing document: {FileName} ({Size} bytes)", fileName, fileBytes.Length);

            _logger.LogInformation("Processing document with Semantic Kernel");
            var result = await _skOrchestrator.ProcessAsync(
                fileBytes,
                fileName,
                forcedDocType: doc_type,
                returnText: return_text,
                cancellationToken: HttpContext.RequestAborted);

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing document");
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message });
        }
    }

    /// <summary>
    /// Health check endpoint.
    /// </summary>
    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new { status = "healthy", service = "UDP.AgentFramework" });
    }
}
