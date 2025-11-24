namespace UDP.AgentFramework.Utils;

/// <summary>
/// Utility class for cleaning LLM responses to extract valid JSON.
/// </summary>
public static class JsonCleaner
{
    /// <summary>
    /// Clean LLM response text to extract valid JSON.
    /// Removes markdown code blocks, extra whitespace, and commentary.
    /// </summary>
    /// <param name="response">Raw LLM response text</param>
    /// <returns>Cleaned JSON string</returns>
    public static string CleanJsonResponse(string response)
    {
        if (string.IsNullOrWhiteSpace(response))
        {
            return "{}";
        }

        var span = response.AsSpan().Trim();

        // Remove markdown code blocks (```json ... ``` or ``` ... ```)
        if (span.StartsWith("```"))
        {
            var newlineIndex = span.IndexOf('\n');
            if (newlineIndex > 0)
            {
                span = span.Slice(newlineIndex + 1);
                var endMarker = span.IndexOf("```");
                if (endMarker > 0)
                {
                    span = span.Slice(0, endMarker);
                }
            }
        }

        // Find the first '{' or '[' (start of JSON)
        var jsonStart = span.IndexOfAny('{', '[');
        if (jsonStart >= 0)
        {
            span = span.Slice(jsonStart);
        }

        // Find the last '}' or ']' (end of JSON)
        var jsonEnd = span.LastIndexOfAny('}', ']');
        if (jsonEnd >= 0)
        {
            span = span.Slice(0, jsonEnd + 1);
        }

        return span.Trim().ToString();
    }
}
