namespace UDP.AgentFramework.Models;

/// <summary>
/// Enumeration of supported document types, matching Python DocumentType enum.
/// </summary>
public enum DocumentType
{
    Invoice,
    Receipt,
    InsuranceCard,
    W2,
    Resume,
    PurchaseOrder,
    Other
}

public static class DocumentTypeExtensions
{
    public static string ToSnakeCase(this DocumentType docType) => docType switch
    {
        DocumentType.Invoice => "invoice",
        DocumentType.Receipt => "receipt",
        DocumentType.InsuranceCard => "insurance_card",
        DocumentType.W2 => "w2",
        DocumentType.Resume => "resume",
        DocumentType.PurchaseOrder => "purchase_order",
        DocumentType.Other => "other",
        _ => "other"
    };

    public static DocumentType FromSnakeCase(string value) => value switch
    {
        "invoice" => DocumentType.Invoice,
        "receipt" => DocumentType.Receipt,
        "insurance_card" => DocumentType.InsuranceCard,
        "w2" => DocumentType.W2,
        "resume" => DocumentType.Resume,
        "purchase_order" => DocumentType.PurchaseOrder,
        _ => DocumentType.Other
    };
}
