using System.Collections.Concurrent;

namespace UDP.AgentFramework.Middleware;

/// <summary>
/// Simple in-memory rate limiting middleware
/// For production, use ASP.NET Core built-in RateLimiter or Redis
/// </summary>
public class RateLimitingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RateLimitingMiddleware> _logger;
    private readonly bool _enabled;
    private readonly int _maxRequestsPerMinute;

    // In-memory store: IP -> (Request count, Window start time)
    private static readonly ConcurrentDictionary<string, (int Count, DateTime WindowStart)> _requestCounts = new();
    private static DateTime _lastCleanup = DateTime.UtcNow;
    private static readonly object _cleanupLock = new();

    public RateLimitingMiddleware(
        RequestDelegate next,
        IConfiguration configuration,
        ILogger<RateLimitingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
        _enabled = configuration.GetValue<bool>("Security:EnableRateLimiting", true);
        _maxRequestsPerMinute = configuration.GetValue<int>("Security:MaxRequestsPerMinute", 10);
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (!_enabled)
        {
            await _next(context);
            return;
        }

        var clientIp = GetClientIpAddress(context);
        var now = DateTime.UtcNow;

        // Cleanup old entries every 5 minutes to prevent memory leak
        CleanupOldEntries(now);

        _requestCounts.AddOrUpdate(
            clientIp,
            _ => (1, now),
            (_, existing) =>
            {
                var windowElapsed = (now - existing.WindowStart).TotalMinutes;

                // Reset window if more than 1 minute has passed
                if (windowElapsed >= 1.0)
                {
                    return (1, now);
                }

                // Increment count within current window
                return (existing.Count + 1, existing.WindowStart);
            });

        var (count, windowStart) = _requestCounts[clientIp];

        if (count > _maxRequestsPerMinute)
        {
            var retryAfter = 60 - (int)(now - windowStart).TotalSeconds;

            _logger.LogWarning(
                "Rate limit exceeded for IP {ClientIp}: {Count} requests in current window (limit: {Limit})",
                clientIp,
                count,
                _maxRequestsPerMinute);

            context.Response.StatusCode = 429; // Too Many Requests
            context.Response.Headers["Retry-After"] = retryAfter.ToString();
            context.Response.ContentType = "application/json";

            await context.Response.WriteAsJsonAsync(new
            {
                error = "Rate limit exceeded",
                maxRequestsPerMinute = _maxRequestsPerMinute,
                retryAfterSeconds = retryAfter
            });
            return;
        }

        await _next(context);
    }

    /// <summary>
    /// Remove stale entries from the dictionary to prevent unbounded growth.
    /// Only runs once every 5 minutes to avoid performance overhead.
    /// </summary>
    private void CleanupOldEntries(DateTime now)
    {
        // Check if cleanup is needed (every 5 minutes)
        if ((now - _lastCleanup).TotalMinutes < 5)
        {
            return;
        }

        // Use lock to prevent multiple threads from cleaning simultaneously
        if (!Monitor.TryEnter(_cleanupLock))
        {
            return; // Another thread is already cleaning
        }

        try
        {
            // Double-check after acquiring lock
            if ((now - _lastCleanup).TotalMinutes < 5)
            {
                return;
            }

            var entriesToRemove = _requestCounts
                .Where(kvp => (now - kvp.Value.WindowStart).TotalMinutes > 5)
                .Select(kvp => kvp.Key)
                .ToList();

            foreach (var key in entriesToRemove)
            {
                _requestCounts.TryRemove(key, out _);
            }

            _lastCleanup = now;

            if (entriesToRemove.Count > 0)
            {
                _logger.LogInformation(
                    "Rate limit cleanup: Removed {Count} stale entries",
                    entriesToRemove.Count);
            }
        }
        finally
        {
            Monitor.Exit(_cleanupLock);
        }
    }

    private static string GetClientIpAddress(HttpContext context)
    {
        // Check for forwarded IP (when behind proxy/load balancer)
        var forwardedFor = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrEmpty(forwardedFor))
        {
            return forwardedFor.Split(',')[0].Trim();
        }

        // Fall back to direct connection IP
        return context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }
}
