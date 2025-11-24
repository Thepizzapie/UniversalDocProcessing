using UDP.AgentFramework.Utils;
using System.ComponentModel;
using System.Text.Json;
using Microsoft.SemanticKernel;
using UDP.AgentFramework.Config;

namespace UDP.AgentFramework.Plugins;

/// <summary>
/// Semantic Kernel plugin that refines and validates extracted document data.
/// </summary>
public sealed class RefinementPlugin
{
    private readonly DocumentTypeConfigService _configService;
    private readonly ILogger<RefinementPlugin> _logger;
    private readonly int _maxTextLength;

    public RefinementPlugin(
        IConfiguration config,
        DocumentTypeConfigService configService,
        ILogger<RefinementPlugin> logger)
    {
        _configService = configService;
        _logger = logger;
        _maxTextLength = config.GetValue<int>("DocumentProcessing:MaxOcrTextLength", 3000);
    }

    [KernelFunction("refine_data")]
    [Description("Refine and validate extracted data to ensure correctness and completeness")]
    public async Task<Dictionary<string, object>> RefineDataAsync(
        Kernel kernel,
        [Description("The OCR extracted text from the document")] string ocrText,
        [Description("The document type (e.g., invoice, receipt, w2)")] string documentType,
        [Description("The currently extracted data as JSON string")] string extractedDataJson,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("RefinementPlugin: Starting data refinement for document type '{DocType}'", documentType);

        var instructions = _configService.GetInstructions(documentType);
        var truncatedText = ocrText.Length > _maxTextLength
            ? ocrText.Substring(0, _maxTextLength)
            : ocrText;

        var systemPrompt = "You are an extraction refiner. Validate and correct the extracted JSON so it matches the document text and the instructions. Output strictly valid JSON with the same schema. You are meticulous about data correctness. If a field is missing or wrong, fix it using the OCR text. Keep field names unchanged.";

        var userPrompt = $"Instructions (schema to follow):\n{instructions}\n\nOCR text:\n{truncatedText}\n\nCurrent extracted JSON (correct and return the improved JSON only):\n{extractedDataJson}";

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

            // Clean potential markdown formatting from LLM response
            var cleanJson = JsonCleaner.CleanJsonResponse(jsonResponse);

            var refinedData = JsonSerializer.Deserialize<Dictionary<string, object>>(cleanJson);

            if (refinedData != null && refinedData.Count > 0)
            {
                _logger.LogInformation("RefinementPlugin: Successfully refined data");
                return refinedData;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "RefinementPlugin: Refinement failed, returning original data");
        }

        // Return original data on failure
        try
        {
            var originalData = JsonSerializer.Deserialize<Dictionary<string, object>>(extractedDataJson);
            return originalData ?? new Dictionary<string, object>();
        }
        catch
        {
            return new Dictionary<string, object>();
        }
    }

}
