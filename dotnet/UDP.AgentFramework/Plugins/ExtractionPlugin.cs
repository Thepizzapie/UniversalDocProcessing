using UDP.AgentFramework.Utils;
using System.ComponentModel;
using System.Text.Json;
using Microsoft.SemanticKernel;
using UDP.AgentFramework.Config;

namespace UDP.AgentFramework.Plugins;

/// <summary>
/// Semantic Kernel plugin that extracts structured fields from document text.
/// </summary>
public sealed class ExtractionPlugin
{
    private readonly DocumentTypeConfigService _configService;
    private readonly ILogger<ExtractionPlugin> _logger;
    private readonly int _maxTextLength;

    public ExtractionPlugin(
        IConfiguration config,
        DocumentTypeConfigService configService,
        ILogger<ExtractionPlugin> logger)
    {
        _configService = configService;
        _logger = logger;
        _maxTextLength = config.GetValue<int>("DocumentProcessing:MaxOcrTextLength", 3000);
    }

    [KernelFunction("extract_fields")]
    [Description("Extract structured fields from document text based on document type")]
    public async Task<Dictionary<string, object>> ExtractFieldsAsync(
        Kernel kernel,
        [Description("The OCR extracted text from the document")] string ocrText,
        [Description("The document type (e.g., invoice, receipt, w2)")] string documentType,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("ExtractionPlugin: Starting field extraction for document type '{DocType}'", documentType);

        var instructions = _configService.GetInstructions(documentType);
        var truncatedText = ocrText.Length > _maxTextLength
            ? ocrText.Substring(0, _maxTextLength)
            : ocrText;

        var systemPrompt = "You are an information extraction specialist. Follow the instructions carefully to extract data from the provided document text. When you extract data, respond only with a valid JSON object. Do not include any additional commentary.";
        var userPrompt = $"Instructions:\n{instructions}\n\nDocument text:\n{truncatedText}";

        try
        {
            var chatCompletion = kernel.GetRequiredService<Microsoft.SemanticKernel.ChatCompletion.IChatCompletionService>();

            var chatHistory = new Microsoft.SemanticKernel.ChatCompletion.ChatHistory();
            chatHistory.AddSystemMessage(systemPrompt);
            chatHistory.AddUserMessage(userPrompt);

            var executionSettings = new Microsoft.SemanticKernel.Connectors.OpenAI.OpenAIPromptExecutionSettings
            {
                MaxTokens = 800, // Reduced from 1500 to save tokens
                Temperature = 0.0
            };

            var response = await chatCompletion.GetChatMessageContentsAsync(
                chatHistory,
                executionSettings,
                cancellationToken: cancellationToken);

            var jsonResponse = response[0].Content ?? "{}";

            // Strip markdown code blocks if present
            var cleanJson = JsonCleaner.CleanJsonResponse(jsonResponse);

            var result = JsonSerializer.Deserialize<Dictionary<string, object>>(cleanJson);

            if (result != null)
            {
                _logger.LogInformation("ExtractionPlugin: Successfully extracted {Count} fields", result.Count);
                return result;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ExtractionPlugin: Extraction failed for document type '{DocType}'", documentType);
        }

        // Return empty data on failure
        return new Dictionary<string, object>();
    }

}
