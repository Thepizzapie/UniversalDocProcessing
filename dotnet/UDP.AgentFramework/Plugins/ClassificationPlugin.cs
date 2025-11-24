using System.ComponentModel;
using System.Text.Json;
using Microsoft.SemanticKernel;
using UDP.AgentFramework.Config;
using UDP.AgentFramework.Models;
using UDP.AgentFramework.Utils;

namespace UDP.AgentFramework.Plugins;

/// <summary>
/// Semantic Kernel plugin that classifies document text into a known document type.
/// </summary>
public sealed class ClassificationPlugin
{
    private readonly DocumentTypeConfigService _configService;
    private readonly ILogger<ClassificationPlugin> _logger;

    public ClassificationPlugin(
        DocumentTypeConfigService configService,
        ILogger<ClassificationPlugin> logger)
    {
        _configService = configService;
        _logger = logger;
    }

    [KernelFunction("classify_document")]
    [Description("Classify a document based on its extracted text content")]
    public async Task<ClassificationResult> ClassifyDocumentAsync(
        Kernel kernel,
        [Description("The OCR extracted text from the document")] string ocrText,
        [Description("Optional forced document type")] string? forcedDocType = null,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("ClassificationPlugin: Starting document classification");

        // If document type is forced, skip classification
        if (!string.IsNullOrEmpty(forcedDocType))
        {
            _logger.LogInformation("ClassificationPlugin: Using forced type '{ForcedDocType}'", forcedDocType);
            return new ClassificationResult
            {
                Type = forcedDocType,
                Confidence = 1.0
            };
        }

        var allowedTypes = string.Join(", ", _configService.GetAllTypes());

        var systemPrompt = @$"You are a document classification expert. Choose the most appropriate document type from the following list:
{allowedTypes}

Respond in JSON format with two fields:
- ""type"": one of the allowed document types.
- ""confidence"": a number between 0 and 1 representing your confidence in the classification.
Only provide the JSON and nothing else.";

        var userPrompt = $"Document text:\n{ocrText}";

        try
        {
            var chatCompletion = kernel.GetRequiredService<Microsoft.SemanticKernel.ChatCompletion.IChatCompletionService>();

            var chatHistory = new Microsoft.SemanticKernel.ChatCompletion.ChatHistory();
            chatHistory.AddSystemMessage(systemPrompt);
            chatHistory.AddUserMessage(userPrompt);

            var executionSettings = new Microsoft.SemanticKernel.Connectors.OpenAI.OpenAIPromptExecutionSettings
            {
                MaxTokens = 100, // Reduced from 500 - classification only needs short response
                Temperature = 0.0
            };

            var response = await chatCompletion.GetChatMessageContentsAsync(
                chatHistory,
                executionSettings,
                cancellationToken: cancellationToken);

            var jsonResponse = response[0].Content ?? "{}";

            // Strip markdown code blocks if present
            var cleanJson = JsonCleaner.CleanJsonResponse(jsonResponse);

            var result = JsonSerializer.Deserialize<ClassificationResult>(cleanJson);

            if (result != null)
            {
                _logger.LogInformation(
                    "ClassificationPlugin: Classified as {Type} with confidence {Confidence:F2}",
                    result.Type, result.Confidence);

                return result;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ClassificationPlugin: Classification failed, falling back to 'other'");
        }

        // Fallback to 'other'
        return new ClassificationResult
        {
            Type = "other",
            Confidence = 0.0
        };
    }
}
