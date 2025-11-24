using System.Text.Json;
using Microsoft.SemanticKernel;
using UDP.AgentFramework.Models;
using UDP.AgentFramework.Plugins;

namespace UDP.AgentFramework.Services;

/// <summary>
/// Orchestrates document processing using Semantic Kernel and plugins.
/// Coordinates OCR → Classification → Extraction → Refinement pipeline.
/// </summary>
public class SemanticKernelOrchestrator
{
    private readonly Kernel _kernel;
    private readonly ILogger<SemanticKernelOrchestrator> _logger;
    private readonly bool _enableRefinement;
    private readonly bool _enableOcrFallback;
    private readonly int _maxRetries;
    private readonly int _retryDelayMs;

    public SemanticKernelOrchestrator(
        Kernel kernel,
        IConfiguration configuration,
        ILogger<SemanticKernelOrchestrator> logger)
    {
        _kernel = kernel;
        _logger = logger;
        _enableRefinement = configuration.GetValue<bool>("DocumentProcessing:EnableRefinement", true);
        _enableOcrFallback = configuration.GetValue<bool>("DocumentProcessing:EnableOcrFallback", true);
        _maxRetries = configuration.GetValue<int>("DocumentProcessing:MaxRetries", 3);
        _retryDelayMs = configuration.GetValue<int>("DocumentProcessing:RetryDelayMs", 1000);

        _logger.LogInformation(
            "SemanticKernelOrchestrator initialized (Refinement: {EnableRefinement}, OcrFallback: {EnableOcrFallback}, MaxRetries: {MaxRetries})",
            _enableRefinement,
            _enableOcrFallback,
            _maxRetries);
    }

    /// <summary>
    /// Invoke a kernel function with retry logic for rate limit errors.
    /// </summary>
    private async Task<FunctionResult> InvokeWithRetryAsync(
        KernelFunction function,
        KernelArguments arguments,
        CancellationToken cancellationToken)
    {
        for (int attempt = 0; attempt <= _maxRetries; attempt++)
        {
            try
            {
                return await _kernel.InvokeAsync(function, arguments, cancellationToken);
            }
            catch (Microsoft.SemanticKernel.HttpOperationException ex) when (ex.Message.Contains("429") && attempt < _maxRetries)
            {
                var delay = _retryDelayMs * (int)Math.Pow(2, attempt); // Exponential backoff
                _logger.LogWarning(
                    "Rate limit hit (attempt {Attempt}/{MaxRetries}). Retrying in {Delay}ms...",
                    attempt + 1,
                    _maxRetries,
                    delay);
                await Task.Delay(delay, cancellationToken);
            }
        }

        throw new InvalidOperationException($"Failed after {_maxRetries} retry attempts");
    }

    /// <summary>
    /// Process a document through the full Semantic Kernel plugin pipeline.
    /// </summary>
    public async Task<ProcessingResult> ProcessAsync(
        byte[] fileBytes,
        string fileName,
        string? forcedDocType = null,
        bool returnText = false,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation(
            "SemanticKernelOrchestrator: Starting processing for {FileName} ({Size} bytes)",
            fileName,
            fileBytes.Length);

        string ocrText = string.Empty;
        ClassificationResult? classification = null;
        Dictionary<string, object> extractedData = new();

        try
        {
            // Step 1: OCR - Extract text from image
            _logger.LogInformation("Step 1/4: OCR - Extracting text from image");

            var ocrFunction = _kernel.Plugins["OcrPlugin"]["extract_text"];

            var ocrResult = await InvokeWithRetryAsync(
                ocrFunction,
                new KernelArguments
                {
                    ["imageBytes"] = fileBytes,
                    ["fileName"] = fileName
                },
                cancellationToken);

            ocrText = ocrResult.GetValue<string>() ?? string.Empty;

            if (string.IsNullOrWhiteSpace(ocrText))
            {
                throw new InvalidOperationException("OCR failed to extract any text from the document");
            }

            _logger.LogInformation("OCR extracted {Length} characters", ocrText.Length);

            // Step 2: Classification - Determine document type
            _logger.LogInformation("Step 2/4: Classification - Determining document type");

            var classificationFunction = _kernel.Plugins["ClassificationPlugin"]["classify_document"];

            var classificationResult = await InvokeWithRetryAsync(
                classificationFunction,
                new KernelArguments
                {
                    ["ocrText"] = ocrText,
                    ["forcedDocType"] = forcedDocType
                },
                cancellationToken);

            classification = classificationResult.GetValue<ClassificationResult>();

            if (classification == null)
            {
                throw new InvalidOperationException("Classification failed to return a result");
            }

            _logger.LogInformation(
                "Classified as {Type} with confidence {Confidence:F2}",
                classification.Type,
                classification.Confidence);

            // Step 3: Extraction - Extract structured fields
            _logger.LogInformation("Step 3/4: Extraction - Extracting structured fields");

            var extractionFunction = _kernel.Plugins["ExtractionPlugin"]["extract_fields"];

            var extractionResult = await InvokeWithRetryAsync(
                extractionFunction,
                new KernelArguments
                {
                    ["ocrText"] = ocrText,
                    ["documentType"] = classification.Type
                },
                cancellationToken);

            extractedData = extractionResult.GetValue<Dictionary<string, object>>() ?? new();

            _logger.LogInformation("Extracted {Count} fields", extractedData.Count);

            // Step 4: Refinement - Validate and improve extracted data (optional)
            if (_enableRefinement)
            {
                _logger.LogInformation("Step 4/4: Refinement - Validating and improving extracted data");

                var refinementFunction = _kernel.Plugins["RefinementPlugin"]["refine_data"];
                var extractedDataJson = JsonSerializer.Serialize(extractedData);

                var refinementResult = await InvokeWithRetryAsync(
                    refinementFunction,
                    new KernelArguments
                    {
                        ["ocrText"] = ocrText,
                        ["documentType"] = classification.Type,
                        ["extractedDataJson"] = extractedDataJson
                    },
                    cancellationToken);

                var refinedData = refinementResult.GetValue<Dictionary<string, object>>();

                if (refinedData != null && refinedData.Count > 0)
                {
                    extractedData = refinedData;
                    _logger.LogInformation("Data refinement completed successfully");
                }
            }
            else
            {
                _logger.LogInformation("Step 4/4: Refinement - Skipped (disabled in configuration)");
            }

            // Build final result
            var result = new ProcessingResult
            {
                Classification = classification,
                Data = extractedData
            };

            if (returnText || _enableOcrFallback)
            {
                result.RawText = ocrText;
            }

            _logger.LogInformation(
                "SemanticKernelOrchestrator: Successfully processed {FileName} as {DocType}",
                fileName,
                classification.Type);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SemanticKernelOrchestrator: Failed to process {FileName}", fileName);

            // Return error result with OCR fallback if enabled
            if (_enableOcrFallback && !string.IsNullOrEmpty(ocrText))
            {
                return new ProcessingResult
                {
                    Classification = new ClassificationResult { Type = "other", Confidence = 0.0 },
                    Data = new Dictionary<string, object> { ["error"] = ex.Message },
                    RawText = ocrText
                };
            }

            throw;
        }
    }
}
