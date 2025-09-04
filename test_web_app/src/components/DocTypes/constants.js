// Pipeline template definitions and constants for document types

export const PIPELINE_TEMPLATES = [
  // Extract & Send (trust AI, no review)
  {
    key: 'extract_send',
    name: 'Extract & Send',
    description: 'Trust AI: extract data and send without manual review',
    steps: [
      { step_type: 'extraction', name: 'Extract Data', description: 'Extract structured data', is_required: true, config: {}, depends_on: [] },
      { step_type: 'send', name: 'Send Data', description: 'Send to endpoint', is_required: true, config: {}, depends_on: [] }
    ]
  },
  // Extract, Review (HIL) & Send
  {
    key: 'extract_review_send',
    name: 'Extract, Review (HIL) & Send',
    description: 'Extract, human-in-the-loop review, then send',
    steps: [
      { step_type: 'extraction', name: 'Extract Data', description: 'Extract structured data', is_required: true, config: {}, depends_on: [] },
      { step_type: 'hil', name: 'Review Data', description: 'Manual review and correction', is_required: true, config: {}, depends_on: [] },
      { step_type: 'send', name: 'Send Data', description: 'Send processed data', is_required: true, config: {}, depends_on: [] }
    ]
  },
  // Dual Package Review and Send
  {
    key: 'parent_child_review_send',
    name: 'Dual Package Review and Send',
    description: 'Package 1 Review, Send, Package 2 Review & Send - Review Package 1 object, send; then review Package 2 entries and send',
    steps: [
      { step_type: 'extraction', name: 'Extract Data', description: 'Extract structured data', is_required: true, config: {}, depends_on: [] },
      { step_type: 'hil', name: 'Review Package 1 Object', description: 'Manual review of Package 1 fields', is_required: true, config: { scope: 'parent' }, depends_on: [] },
      { step_type: 'send', name: 'Send Package 1 Object', description: 'Send Package 1 data', is_required: true, config: { scope: 'parent' }, depends_on: [] },
      { step_type: 'hil', name: 'Review Package 2 Entries', description: 'Manual review of Package 2/line-item entries', is_required: true, config: { scope: 'children' }, depends_on: [] },
      { step_type: 'send', name: 'Send Package 2 Entries', description: 'Send reviewed Package 2 entries', is_required: true, config: { scope: 'children' }, depends_on: [] }
    ]
  },
  // Coming soon: Extract, Reconcile, Review & Send
  {
    key: 'extract_reconcile_review_send',
    name: 'Extract, Reconcile, Review & Send',
    description: 'Match with external data before review and send',
    comingSoon: true,
    disabled: true,
    steps: [
      { step_type: 'extraction', name: 'Extract Data', description: 'Extract structured data', is_required: true, config: {}, depends_on: [] },
      { step_type: 'reconcile', name: 'Reconcile', description: 'Match with external/reference data', is_required: false, config: {}, depends_on: [] },
      { step_type: 'hil', name: 'Review Data', description: 'Manual review and correction', is_required: true, config: {}, depends_on: [] },
      { step_type: 'send', name: 'Send Data', description: 'Send processed data', is_required: true, config: {}, depends_on: [] }
    ]
  },
  // Coming soon: Custom Pipelines
  {
    key: 'custom_pipelines',
    name: 'Custom Pipelines',
    description: 'Design a fully custom pipeline (coming soon)',
    comingSoon: true,
    disabled: true,
    steps: []
  }
];

export const FIELD_TYPES = [
  { value: 'array', label: 'Array' },
  { value: 'object', label: 'Record' }
];

export const NESTED_FIELD_TYPES = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' }
];

export const PACKAGE_MODES = {
  SINGLE: 'single',
  TWO: 'two'
};

export const SCHEMA_MODES = {
  BUILDER: 'builder',
  JSON: 'json'
};

export const WIZARD_STEPS = {
  BASIC_INFO: 1,
  PIPELINE_CONFIG: 2,
  SCHEMA_INSTRUCTIONS: 3,
  REVIEW: 4
};

export const DEFAULT_FORM_DATA = {
  name: '',
  description: '',
  output_schema: {},
  parent_schema: {},
  child_schema: {},
  instructions: {
    prompt: '',
    extraction_hints: []
  },
  hil_instructions: {
    required_review_fields: [],
    auto_approve_threshold: 0.85,
    require_manual_review: false
  },
  pipeline_config: {
    name: '',
    description: '',
    steps: [],
    objects: [],
    parallel_processing: false,
    global_config: {}
  },
  destination_webhook: ''
};

// Dual-package detection patterns for AI prompt analysis
export const DUAL_PACKAGE_INDICATORS = [
  // Header + Table patterns
  /header.*(?:and|then|followed by).*table|row/i,
  /table.*(?:and|then|followed by).*header|detail/i,

  // Parent + Child patterns
  /parent.*(?:and|then|followed by).*child/i,
  /child.*(?:and|then|followed by).*parent/i,

  // First/Then patterns with different data types
  /first.*extract.*(?:then|followed by).*extract/i,
  /extract.*header|detail.*(?:and|then).*extract.*table|row/i,

  // Multiple extraction patterns
  /(?:extract|get|pull).*header|detail.*(?:and|then|also).*extract|get|pull.*table|row/i,
  /table.*(?:with|containing).*row|entry|record/i,

  // Specific dual-package keywords
  /\b(header|detail|summary|info).*\b(table|row|entry|record|item)\b/i,
  /\b(table|row|entry|record|item).*\b(header|detail|summary|info)\b/i
];

// Pre-defined document schemas for AI fallback
export const DOCUMENT_SCHEMA_TEMPLATES = {
  invoice: {
    name: 'Business Invoice',
    description: 'Standard business invoice for goods or services',
    schema: {
      "invoice_number": {"type": "string", "required": true, "description": "Unique invoice identifier"},
      "vendor_name": {"type": "string", "required": true, "description": "Vendor or supplier name"},
      "invoice_date": {"type": "date", "required": true, "description": "Date invoice was issued"},
      "total_amount": {"type": "number", "required": true, "description": "Total amount due"},
      "line_items": {
        "type": "array",
        "required": false,
        "description": "List of items or services billed",
        "items": {
          "type": "object",
          "properties": {
            "description": {"type": "string", "required": true, "description": "Item description"},
            "quantity": {"type": "number", "required": true, "description": "Quantity ordered"},
            "unit_price": {"type": "number", "required": true, "description": "Price per unit"},
            "total": {"type": "number", "required": true, "description": "Line item total"}
          }
        }
      }
    },
    prompt: `Extract data from business invoices. Focus on vendor information, invoice details, line items with quantities and prices, and total amounts. Be precise with numbers and dates.`
  },
  receipt: {
    name: 'Purchase Receipt',
    description: 'Retail purchase receipt from stores or merchants',
    schema: {
      "merchant_name": {"type": "string", "required": true, "description": "Store or merchant name"},
      "transaction_date": {"type": "date", "required": true, "description": "Date of purchase"},
      "total_amount": {"type": "number", "required": true, "description": "Total amount paid"},
      "payment_method": {"type": "string", "required": false, "description": "Payment method used"}
    },
    prompt: `Extract data from retail receipts. Focus on merchant information, transaction details, and monetary amounts. Be precise with numbers and dates.`
  },
  generic: {
    name: 'Custom Document Type',
    description: 'Generic document type for custom extraction',
    schema: {
      "document_title": {"type": "string", "required": true, "description": "Document title or header"},
      "document_date": {"type": "date", "required": true, "description": "Document date"},
      "reference_number": {"type": "string", "required": false, "description": "Reference or ID number"},
      "amount": {"type": "number", "required": false, "description": "Monetary amount if applicable"}
    },
    prompt: `Extract structured data from the document. Focus on key information, dates, amounts, and relevant details.`
  }
};
