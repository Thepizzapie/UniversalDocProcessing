using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace UDP.AgentFramework.Config;

/// <summary>
/// Document type configuration loaded from doc_types.yaml (or equivalent).
/// </summary>
public class DocumentTypeDefinition
{
    public string Description { get; set; } = string.Empty;
    public string Instructions { get; set; } = string.Empty;
}

/// <summary>
/// Service to load and provide document type instructions.
/// </summary>
public class DocumentTypeConfigService
{
    private readonly Dictionary<string, DocumentTypeDefinition> _docTypes;

    public DocumentTypeConfigService()
    {
        _docTypes = LoadDocTypes();
    }

    private Dictionary<string, DocumentTypeDefinition> LoadDocTypes()
    {
        // Hardcoded for now - in production, load from embedded resource or file
        return new Dictionary<string, DocumentTypeDefinition>
        {
            ["invoice"] = new()
            {
                Description = "Invoice document",
                Instructions = @"Extract the following fields from the invoice:
  - Invoice Number: Unique identifier for the invoice.
  - Invoice Date: Date the invoice was issued.
  - Due Date: Date payment is due.
  - Vendor Name: Name of the company issuing the invoice.
  - Vendor Address: Address of the vendor, including city and zip code.
  - Customer Name: Name of the customer receiving the invoice.
  - Customer Address: Address of the customer, including city and zip code.
  - Total Amount Due: Total amount to be paid, including currency symbol.
  - Line Items: A list of items or services billed, including description, quantity, unit price, and line total.
Respond using JSON with keys matching the field names."
            },
            ["receipt"] = new()
            {
                Description = "Retail or service receipt",
                Instructions = @"Extract the following information from the receipt:
  - Receipt Number or Transaction ID (if available).
  - Purchase Date.
  - Merchant Name.
  - Merchant Address.
  - Itemized Purchases: List each purchased item with description, quantity, and price.
  - Total Paid.
  - Payment Method (cash, credit card, etc.) if present.
Return your response as a JSON object containing these fields."
            },
            ["insurance_card"] = new()
            {
                Description = "Medical or auto insurance card",
                Instructions = @"Extract these fields from the insurance card:
  - Policy Holder Name.
  - Policy Number.
  - Group Number (if available).
  - Insurance Company Name.
  - Effective Date.
  - Expiration Date.
  - Contact Phone Number.
Format your response as a JSON object with the above fields."
            },
            ["w2"] = new()
            {
                Description = "IRS W-2 wage and tax statement",
                Instructions = @"Extract the following fields from the W-2 form:
  - Employee's Name.
  - Employee's Address.
  - Employer's Name.
  - Employer's Address.
  - Employer Identification Number (EIN).
  - Wages, Tips, Other Compensation (Box 1).
  - Federal Income Tax Withheld (Box 2).
  - Social Security Wages (Box 3).
  - Social Security Tax Withheld (Box 4).
  - Medicare Wages and Tips (Box 5).
  - Medicare Tax Withheld (Box 6).
  - State Wages, Tips, Etc. (Box 16).
  - State Income Tax (Box 17).
Return your results as a JSON object."
            },
            ["resume"] = new()
            {
                Description = "Professional resume or CV",
                Instructions = @"Extract these items from the resume:
  - Candidate Name.
  - Contact Information (phone number, email address, and mailing address).
  - Summary or Objective Statement.
  - Education: List degrees, institutions, and graduation years.
  - Work Experience: For each position include job title, company name, dates of employment, and key responsibilities.
  - Certifications or Licenses (if any).
  - Skills: List of technical and soft skills.
Structure the output as a JSON object."
            },
            ["purchase_order"] = new()
            {
                Description = "Purchase order document",
                Instructions = @"Extract the following information from the purchase order:
  - Purchase Order Number.
  - Purchase Order Date.
  - Buyer's Name and Address.
  - Seller's Name and Address.
  - List of Items Ordered: Each item should include description, quantity, unit price, and line total.
  - Subtotal.
  - Taxes.
  - Total Amount.
Provide the extracted fields as a JSON object."
            },
            ["other"] = new()
            {
                Description = "Miscellaneous or unrecognized document",
                Instructions = @"The document type could not be confidently recognized. Extract any readable text using OCR and return the first 1000 characters as a raw string in a JSON object with the key 'raw_text'."
            }
        };
    }

    public string GetInstructions(string docType)
    {
        return _docTypes.TryGetValue(docType, out var definition)
            ? definition.Instructions
            : _docTypes["other"].Instructions;
    }

    public string GetDescription(string docType)
    {
        return _docTypes.TryGetValue(docType, out var definition)
            ? definition.Description
            : _docTypes["other"].Description;
    }

    public IEnumerable<string> GetAllTypes() => _docTypes.Keys;
}
