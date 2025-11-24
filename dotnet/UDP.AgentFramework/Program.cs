using Microsoft.SemanticKernel;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using UDP.AgentFramework.Config;
using UDP.AgentFramework.Middleware;
using UDP.AgentFramework.Plugins;
using UDP.AgentFramework.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure HttpClient factory
builder.Services.AddHttpClient();

// Register document processing services
builder.Services.AddSingleton<DocumentTypeConfigService>();

// Semantic Kernel setup with OpenAI
builder.Services.AddSingleton<Kernel>(sp =>
{
    var config = sp.GetRequiredService<IConfiguration>();
    var kernelBuilder = Kernel.CreateBuilder();

    var apiKey = config["OpenAI:ApiKey"] ?? Environment.GetEnvironmentVariable("OPENAI_API_KEY");
    var visionModel = config["OpenAI:VisionModel"] ?? "gpt-4o";

    if (string.IsNullOrEmpty(apiKey))
    {
        throw new InvalidOperationException("OpenAI API key not configured. Set in appsettings.json or OPENAI_API_KEY environment variable.");
    }

    // Add OpenAI chat completion (supports both text and vision)
    kernelBuilder.AddOpenAIChatCompletion(
        modelId: visionModel,
        apiKey: apiKey);

    // Register plugins
    var documentTypeConfigService = sp.GetRequiredService<DocumentTypeConfigService>();
    var loggerFactory = sp.GetRequiredService<ILoggerFactory>();

    kernelBuilder.Plugins.AddFromObject(
        new OcrPlugin(loggerFactory.CreateLogger<OcrPlugin>()),
        "OcrPlugin");

    kernelBuilder.Plugins.AddFromObject(
        new ClassificationPlugin(documentTypeConfigService, loggerFactory.CreateLogger<ClassificationPlugin>()),
        "ClassificationPlugin");

    kernelBuilder.Plugins.AddFromObject(
        new ExtractionPlugin(config, documentTypeConfigService, loggerFactory.CreateLogger<ExtractionPlugin>()),
        "ExtractionPlugin");

    kernelBuilder.Plugins.AddFromObject(
        new RefinementPlugin(config, documentTypeConfigService, loggerFactory.CreateLogger<RefinementPlugin>()),
        "RefinementPlugin");

    return kernelBuilder.Build();
});

// Semantic Kernel orchestrator service
builder.Services.AddScoped<SemanticKernelOrchestrator>();

// Configure OpenTelemetry for observability
builder.Services.AddOpenTelemetry()
    .WithTracing(tracerProviderBuilder =>
    {
        tracerProviderBuilder
            .AddSource("UDP.AgentFramework")
            .SetResourceBuilder(ResourceBuilder.CreateDefault().AddService("UDP.AgentFramework"))
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddConsoleExporter();
    });

// Configure CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:3000", "http://localhost:3001")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline
// Enable Swagger in all environments for testing
app.UseSwagger();
app.UseSwaggerUI();

app.UseCors();

// Add security middleware
app.UseMiddleware<RateLimitingMiddleware>();
app.UseMiddleware<FileValidationMiddleware>();

// Add root endpoint with service info
app.MapGet("/", () => new
{
    service = "UDP.AgentFramework",
    version = "1.0.0",
    status = "running",
    endpoints = new[]
    {
        "POST /classify-extract - Process documents",
        "GET /health - Health check",
        "GET /swagger - API documentation"
    }
});

app.MapControllers();

app.Logger.LogInformation("UDP.AgentFramework starting on {Urls}", string.Join(", ", app.Urls));

app.Run();
