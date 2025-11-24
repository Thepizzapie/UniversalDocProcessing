using System.ComponentModel;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using UDP.AgentFramework.Models;

namespace UDP.AgentFramework.Plugins;

/// <summary>
/// Semantic Kernel plugin that performs OCR on document images using Vision LLM.
/// </summary>
public sealed class OcrPlugin
{
    private readonly ILogger<OcrPlugin> _logger;

    public OcrPlugin(ILogger<OcrPlugin> logger)
    {
        _logger = logger;
    }

    [KernelFunction("extract_text")]
    [Description("Extract all visible text from a document image using OCR")]
    public async Task<string> ExtractTextAsync(
        Kernel kernel,
        [Description("The document image as byte array")] byte[] imageBytes,
        [Description("The file name to determine image format")] string fileName,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("OcrPlugin: Starting text extraction for {FileName}", fileName);

        try
        {
            var systemMessage = "You are an OCR specialist. Extract all visible text from the provided image. " +
                              "Maintain the original layout and structure as much as possible. " +
                              "Return only the extracted text without any additional commentary.";

            var mimeType = GetMediaType(fileName);

            // Use Semantic Kernel's proper vision API with ImageContent
            var chatCompletion = kernel.GetRequiredService<IChatCompletionService>();

            var chatHistory = new ChatHistory();
            chatHistory.AddSystemMessage(systemMessage);

            // Create message with image content using proper vision API
            var messageContent = new ChatMessageContentItemCollection
            {
                new TextContent("Please extract all text from this document image."),
                new ImageContent(imageBytes, mimeType)
            };
            chatHistory.AddUserMessage(messageContent);

            var response = await chatCompletion.GetChatMessageContentsAsync(
                chatHistory,
                cancellationToken: cancellationToken);

            var extractedText = response[0].Content ?? string.Empty;

            _logger.LogInformation("OcrPlugin: Successfully extracted {Length} characters", extractedText.Length);

            return extractedText;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OcrPlugin: Failed to extract text from {FileName}", fileName);
            return string.Empty;
        }
    }

    private static string GetMediaType(string fileName)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        return extension switch
        {
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".webp" => "image/webp",
            ".gif" => "image/gif",
            ".tiff" => "image/tiff",
            _ => "image/jpeg"
        };
    }
}
