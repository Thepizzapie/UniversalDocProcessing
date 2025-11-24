using System.Text.Json.Serialization;

namespace UDP.AgentFramework.Models;

/// <summary>
/// Classification result from the classifier agent.
/// </summary>
public class ClassificationResult
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = "other";

    [JsonPropertyName("confidence")]
    public double Confidence { get; set; }
}

/// <summary>
/// Complete pipeline result matching Python API response structure.
/// </summary>
public class ProcessingResult
{
    [JsonPropertyName("classification")]
    public ClassificationResult Classification { get; set; } = new();

    [JsonPropertyName("data")]
    public Dictionary<string, object> Data { get; set; } = new();

    [JsonPropertyName("raw_text")]
    public string? RawText { get; set; }
}

/// <summary>
/// State object passed through the agent pipeline.
/// </summary>
public class DocumentState
{
    public byte[] FileBytes { get; set; } = Array.Empty<byte>();
    public string FileName { get; set; } = string.Empty;
    public string OcrText { get; set; } = string.Empty;
    public DocumentType DocumentType { get; set; } = DocumentType.Other;
    public double Confidence { get; set; }
    public Dictionary<string, object> ExtractedData { get; set; } = new();
    public bool ReturnText { get; set; }
    public string? ForcedDocType { get; set; }
}
