import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  TestTube,
  Save,
  Wand2,
  Code,
  ArrowRight,
  ArrowLeft,
  Eye,
  CheckCircle,
  Settings,
  Upload
} from 'lucide-react';
import api, { apiService } from '../services/api';

const DocTypes = () => {
  // ===== STATE MANAGEMENT =====
  // Core state
  const [docTypes, setDocTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [tenantId, setTenantId] = useState(localStorage.getItem('tenantId') || '1');

  // Modal and wizard state
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editModalTab, setEditModalTab] = useState('basic');
  const [isEditing, setIsEditing] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [editingId, setEditingId] = useState(null);

  // Form and schema state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    output_schema: {},
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
  });

  // UI state
  const [schemaMode, setSchemaMode] = useState('builder');
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatingSchema, setGeneratingSchema] = useState(false);
  const [schemaFields, setSchemaFields] = useState([]);
  const [expandedObjects, setExpandedObjects] = useState(new Set());
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [packageMode, setPackageMode] = useState('single');
  const [showPipelineBuilder, setShowPipelineBuilder] = useState(false);

  // Dual schema state for two-package pipelines
  const [parentSchema, setParentSchema] = useState({});
  const [childSchema, setChildSchema] = useState({});
  const [parentSchemaFields, setParentSchemaFields] = useState([]);
  const [childSchemaFields, setChildSchemaFields] = useState([]);
  const [parentSchemaMode, setParentSchemaMode] = useState('builder');
  const [childSchemaMode, setChildSchemaMode] = useState('builder');
  const [parentSchemaJson, setParentSchemaJson] = useState('{}');
  const [childSchemaJson, setChildSchemaJson] = useState('{}');
  // Package structure & labels
  const [childCollectionKey, setChildCollectionKey] = useState('child_entries');
  const [singlePackageType, setSinglePackageType] = useState('object'); // 'object' | 'array'
  const [singleCollectionKey, setSingleCollectionKey] = useState('records');

  // Testing state
  const [testing, setTesting] = useState(false);
  const [testFile, setTestFile] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [showTestOutput, setShowTestOutput] = useState(false);

  // ===== CONSTANTS =====
  const pipelineTemplates = [
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
    // Parent review, send, then child review & send
    {
      key: 'parent_child_review_send',
      name: 'Parent Review, Send, Child Review & Send',
      description: 'Review parent object, send; then review child entries and send',
      steps: [
        { step_type: 'extraction', name: 'Extract Data', description: 'Extract structured data', is_required: true, config: {}, depends_on: [] },
        { step_type: 'hil', name: 'Review Parent Object', description: 'Manual review of parent-level fields', is_required: true, config: { scope: 'parent' }, depends_on: [] },
        { step_type: 'send', name: 'Send Parent Object', description: 'Send parent-level data', is_required: true, config: { scope: 'parent' }, depends_on: [] },
        { step_type: 'hil', name: 'Review Child Entries', description: 'Manual review of child/line-item entries', is_required: true, config: { scope: 'children' }, depends_on: [] },
        { step_type: 'send', name: 'Send Child Entries', description: 'Send reviewed child entries', is_required: true, config: { scope: 'children' }, depends_on: [] }
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

  // ===== UTILITY FUNCTIONS =====
  const resetForm = () => ({
    name: '',
    description: '',
    output_schema: {},
    instructions: { prompt: '', extraction_hints: [] },
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
  });

  // ===== API FUNCTIONS =====
  const loadDocTypes = useCallback(async () => {
    if (!tenantId) return;

    try {
      apiService.setTenantId(tenantId);
      const res = await apiService.getCustomDocTypes();
      setDocTypes(res.data || []);
    } catch (e) {
      console.error('Error loading doc types:', e);
      setMessage('Error loading document types: ' + (e.response?.data?.detail || e.message));
    }
  }, [tenantId]);

  const createDocType = async () => {
    if (!tenantId) {
      setMessage('Please set tenant ID first');
      return;
    }

    // Validate based on package mode: single uses output_schema; dual validates parent/child schemas
    const validationErrors = packageMode === 'two'
      ? [
          ...validateSchema(parentSchema),
          ...validateSchema(childSchema)
        ]
      : validateSchema(formData.output_schema);
    if (validationErrors.length > 0) {
      setMessage('Schema validation errors: ' + validationErrors.join('; '));
      return;
    }

    setLoading(true);
    try {
      apiService.setTenantId(tenantId);
      
      let payload;

  if (packageMode === 'two') {
        // For two-package pipelines, use dual schemas
        const updatedPipelineConfig = {
          ...formData.pipeline_config,
          objects: [
            {
              name: 'parent_object',
              object_type: 'parent',
              parent_object_name: null,
              object_schema: parentSchema,
              extraction_instructions: formData.instructions?.prompt || '',
              hil_config: formData.hil_instructions,
              send_config: { scope: 'parent' }
            },
            {
              name: 'child_entries',
              object_type: 'children',
              parent_object_name: 'parent_object',
              object_schema: childSchema,
              extraction_instructions: formData.instructions?.prompt || '',
              hil_config: formData.hil_instructions,
              send_config: { scope: 'children' }
            }
          ]
        };

        // Do NOT send a combined schema; include only the two distinct schemas
        // Keeping them under explicit keys avoids accidental combined-output behavior downstream
        payload = {
        name: formData.name,
        description: formData.description,
        instructions: formData.instructions,
          output_schema: {
            parent_schema: parentSchema,
            child_schema: childSchema,
            collection_key: childCollectionKey || 'child_entries'
          },
          destination_webhook: formData.destination_webhook || null,
          pipeline_config: updatedPipelineConfig
        };
      } else {
        // For single package pipelines, use the existing structure
        // If user chose array type for single package, reflect that in preview output schema
        const objectProps = (formData.output_schema?.properties) ? formData.output_schema.properties : formData.output_schema;
        const singleOutputSchema = singlePackageType === 'array'
          ? { [singleCollectionKey || 'records']: { type: 'array', items: { type: 'object', properties: objectProps || {} } } }
          : formData.output_schema;

        payload = {
          name: formData.name,
          description: formData.description,
          instructions: formData.instructions,
          output_schema: singleOutputSchema,
        destination_webhook: formData.destination_webhook || null,
        pipeline_config: formData.pipeline_config
      };
      }

      let response;
      if (editingId) {
        response = await apiService.updateCustomDocType(editingId, payload);
        setMessage('Updated successfully');
      } else {
        response = await apiService.createCustomDocType(payload);
        setMessage('Created successfully');
      }

      loadDocTypes();

      // Always reset the form after saving (both create and edit)
        setTimeout(() => {
          setFormData(resetForm());
          setSchemaFields([]);
        setPackageMode('single');
        closeModals();
        }, 1500);
    } catch (e) {
      setMessage('Error: ' + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };

    const deleteDocType = async (id) => {
    if (!window.confirm('Delete this document type?')) return;

    try {
      apiService.setTenantId(tenantId);
      await apiService.deleteCustomDocType(id);
      setMessage('Deleted successfully');
      loadDocTypes();
    } catch (e) {
      setMessage('Delete error: ' + (e.response?.data?.detail || e.message));
    }
  };

  // ===== SCHEMA FUNCTIONS =====
  // Analyze prompt for dual-package indicators
  const analyzePromptForDualPackage = (prompt) => {
    const dualPackageIndicators = [
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

    return dualPackageIndicators.some(pattern => pattern.test(prompt));
  };

  const generateSchemaWithAI = async () => {
    if (!aiPrompt.trim()) {
      setMessage('Please describe the document type you want to create');
      return;
    }

    setGeneratingSchema(true);

    // Check for dual-package requirements in prompt
    const promptRequiresDualPackage = analyzePromptForDualPackage(aiPrompt.toLowerCase());

    if (promptRequiresDualPackage && packageMode === 'single') {
      // Automatically switch to dual-package mode for better results
      console.log('Detected dual-package requirements in prompt, auto-switching to dual mode');
      setPackageMode('two');

      // Auto-select the Parent/Child pipeline for dual-package processing
      const parentChildTemplate = pipelineTemplates.find(t => t.key === 'parent_child_review_send');
      if (parentChildTemplate) {
        console.log('Found Parent/Child template:', parentChildTemplate.name);
        setSelectedTemplate(parentChildTemplate.name);
        setFormData(prev => {
          console.log('Updating formData with Parent/Child pipeline config');
          return {
            ...prev,
            pipeline_config: {
              ...prev.pipeline_config,
              steps: parentChildTemplate.steps,
              objects: [], // Will be populated when schema is generated
              parallel_processing: false
              // Note: We don't update name/description here as those are for the document type, not the pipeline
            }
          };
        });
        console.log('Auto-selected Parent/Child pipeline template:', parentChildTemplate.name);
      } else {
        console.error('Parent/Child template not found!');
      }

      setMessage('🔄 Auto-switched to dual-package mode with Parent/Child Review pipeline for your header + table extraction.');

      // Brief pause to show the message
      await new Promise(resolve => setTimeout(resolve, 800));
    } else if (promptRequiresDualPackage && packageMode === 'two') {
      console.log('Dual-package mode already selected, proceeding with dual-package generation');
      console.log('Current selectedTemplate:', selectedTemplate);
      // Ensure the right pipeline is selected
      const parentChildTemplate = pipelineTemplates.find(t => t.key === 'parent_child_review_send');
      if (parentChildTemplate) {
        console.log('Parent/Child template name:', parentChildTemplate.name);
        console.log('Template match?', selectedTemplate === parentChildTemplate.name);
        if (selectedTemplate !== parentChildTemplate.name) {
          console.log('Setting Parent/Child template');
          setSelectedTemplate(parentChildTemplate.name);
          setFormData(prev => ({
            ...prev,
            pipeline_config: {
              ...prev.pipeline_config,
              steps: parentChildTemplate.steps,
              objects: [],
              parallel_processing: false
              // Note: We don't update name/description here as those are for the document type, not the pipeline
            }
          }));
        } else {
          console.log('Parent/Child template already selected');
        }
      } else {
        console.error('Parent/Child template not found when packageMode is two!');
      }
    } else if (!promptRequiresDualPackage && packageMode === 'two') {
      // Optional: Ask if they want to switch back to single mode
      console.log('Single-package prompt detected but dual mode selected - keeping dual mode for flexibility');
    }

    // Try AI service first
    try {
      console.log('Attempting AI schema generation...');
      const aiResponse = await apiService.generateAiSchema(aiPrompt.trim());

      if (aiResponse.data.status === 'success' && aiResponse.data.schema) {
        console.log('AI schema generation successful');
        const aiSchema = aiResponse.data.schema;
        const aiDocName = 'Custom Document Type';
        const aiDocDescription = 'AI-generated document type with custom fields';

        // Generate basic extraction prompt
        const aiPromptText = `Extract structured data from: ${aiPrompt}. Focus on key information, dates, amounts, and relevant details. Be precise with numbers and dates.`;

        // Update form data with AI-generated schema
        setFormData(prev => ({
          ...prev,
          name: aiDocName,
          description: aiDocDescription,
          output_schema: aiSchema,
          instructions: { prompt: aiPromptText, extraction_hints: [] },
          pipeline_config: {
            name: 'Extract, Review (HIL) & Send',
            description: 'Extract, human review, then send',
            steps: [
              { step_type: 'extraction', name: 'Extract Data', description: 'Extract structured data', is_required: true, config: {}, depends_on: [] },
              { step_type: 'hil', name: 'Review Data', description: 'Manual review and correction', is_required: true, config: {}, depends_on: [] },
              { step_type: 'send', name: 'Send Data', description: 'Send processed data', is_required: true, config: {}, depends_on: [] }
            ],
            objects: [{
              name: 'main_object',
              object_type: 'standalone',
              parent_object_name: null,
              object_schema: aiSchema,
              extraction_instructions: aiPromptText,
              hil_config: prev.hil_instructions,
              send_config: {}
            }],
            parallel_processing: false,
            global_config: {}
          }
        }));

        // Convert AI schema to fields for builder
        console.log('Converting AI schema to fields:', aiSchema);
        const aiNewFields = Object.entries(aiSchema.properties || {}).map(([name, def]) => {
          console.log(`Processing field: ${name}`, def);
          // Handle array fields with object items (like loadEntries)
          if (def.type === 'array' && def.items?.type === 'object' && def.items?.properties) {
            return {
              id: Math.random(),
              name,
              type: 'array',
              required: (aiSchema.required || []).includes(name),
              description: def.description || def.title || '',
              default: def.default || '',
              nestedFields: Object.entries(def.items.properties).map(([propName, propDef]) => ({
                id: Math.random(),
                name: propName,
                type: propDef.type || 'string',
                required: (def.items.required || []).includes(propName),
                description: propDef.description || propDef.title || '',
                default: propDef.default || propDef.examples?.[0] || ''
              })),
              arrayItemType: 'object'
            };
          }

          // Handle regular object fields
          if (def.type === 'object' && def.properties) {
            return {
              id: Math.random(),
              name,
              type: 'object',
              required: (aiSchema.required || []).includes(name),
              description: def.description || def.title || '',
              default: def.default || '',
              nestedFields: Object.entries(def.properties).map(([propName, propDef]) => ({
                id: Math.random(),
                name: propName,
                type: propDef.type || 'string',
                required: (def.required || []).includes(propName),
                description: propDef.description || propDef.title || '',
                default: propDef.default || propDef.examples?.[0] || ''
              })),
              arrayItemType: 'string'
            };
          }

          // Handle simple fields
          return {
            id: Math.random(),
            name,
            type: def.type || 'string',
            required: (aiSchema.required || []).includes(name),
            description: def.description || def.title || '',
            default: def.default || def.examples?.[0] || '',
            nestedFields: [],
            arrayItemType: 'string'
          };
        });

        console.log('Generated fields:', aiNewFields);
        console.log('Full AI schema received:', aiSchema);

        // Check if this should be two-package mode (has array with objects)
        console.log('Checking for arrays with objects...');
        console.log('AI new fields:', aiNewFields);
        const hasArrayWithObjects = aiNewFields.some(field => {
          const isArray = field.type === 'array';
          const hasObjectItems = field.arrayItemType === 'object';
          const hasNestedFields = field.nestedFields && field.nestedFields.length > 0;
          console.log(`Field ${field.name}: type=${field.type}, arrayItemType=${field.arrayItemType}, nestedFields=${field.nestedFields?.length || 0}`);
          console.log(`  isArray=${isArray}, hasObjectItems=${hasObjectItems}, hasNestedFields=${hasNestedFields}`);
          return isArray && hasObjectItems && hasNestedFields;
        });
        console.log('Has array with objects:', hasArrayWithObjects);

        if (hasArrayWithObjects) {
          // Separate parent fields from child array
          const parentFields = aiNewFields.filter(field => field.type !== 'array');
          const childArrayField = aiNewFields.find(field => field.type === 'array' && field.arrayItemType === 'object');

          console.log('Detected parent-child structure, switching to two-package mode');
          console.log('Parent fields:', parentFields);
          console.log('Child array field:', childArrayField);

          // Build parent schema
          const parentSchemaObj = { type: 'object', properties: {} };
          parentFields.forEach(field => {
            parentSchemaObj.properties[field.name] = {
              type: field.type,
              ...(field.description && { description: field.description }),
              ...(field.default !== '' && { default: field.default })
            };
          });
          parentSchemaObj.required = parentFields.filter(f => f.required).map(f => f.name);
          setParentSchema(parentSchemaObj);

          // Build child schema
          const childSchemaObj = { type: 'object', properties: {} };
          childArrayField.nestedFields.forEach(field => {
            childSchemaObj.properties[field.name] = {
              type: field.type,
              ...(field.description && { description: field.description }),
              ...(field.default !== '' && { default: field.default })
            };
          });
          childSchemaObj.required = childArrayField.nestedFields.filter(f => f.required).map(f => f.name);
          setChildSchema(childSchemaObj);

          setParentSchemaFields(parentFields);
          setChildSchemaFields(childArrayField.nestedFields);
          setPackageMode('two');
          setSchemaMode('builder');
          setChildCollectionKey(childArrayField?.name || 'child_entries');

          console.log('Setting parent schema:', parentSchemaObj);
          console.log('Setting child schema:', childSchemaObj);
          console.log('Setting parent fields:', parentFields);
          console.log('Setting child fields:', childArrayField.nestedFields);

          setMessage(`✅ AI generated dual-package schema for: ${aiDocName || 'Custom Document Type'}`);
          setMessage(`Parent: ${parentFields.length} fields, Child: ${childArrayField.nestedFields.length} fields per entry`);
        } else {
          setSchemaFields(aiNewFields);
          setPackageMode('single');
          setSchemaMode('builder');
          setSinglePackageType('object');
          setMessage(`✅ AI generated schema with ${aiResponse.data.field_count || 0} fields for: Custom Document Type`);
        }

        setAiPrompt('');
        setGeneratingSchema(false);
        return; // Exit early on success
      } else {
        // Handle AI service errors
        const aiErrorMessage = aiResponse.data.message || 'AI schema generation failed';
        console.error('AI service returned error:', aiErrorMessage);
        setMessage(`⚠️ AI generation failed: ${aiErrorMessage}. Using template fallback.`);
      }
    } catch (aiError) {
      console.error('AI service error:', aiError);
      setMessage('⚠️ AI service unavailable. Using template fallback.');
    }

    // Fallback to template-based generation
    try {
      console.log('Using template-based generation...');
      const prompt = aiPrompt.toLowerCase().trim();
      let generatedSchema = {};
      let generatedPrompt = '';
      let docName = '';
      let docDescription = '';

      // Smart parsing: Look for specific field mentions in the prompt
      const fieldMatches = [];
      if (prompt.includes('merchant name') || prompt.includes('store name') || prompt.includes('business name')) {
        fieldMatches.push({ name: 'merchant_name', type: 'string', description: 'Merchant or store name' });
      }
      if (prompt.includes('total amount') || prompt.includes('total') || prompt.includes('amount')) {
        fieldMatches.push({ name: 'total_amount', type: 'number', description: 'Total amount' });
      }
      if (prompt.includes('date')) {
        fieldMatches.push({ name: 'document_date', type: 'date', description: 'Document date' });
      }
      if (prompt.includes('invoice number') || prompt.includes('reference number') || prompt.includes('id')) {
        fieldMatches.push({ name: 'reference_number', type: 'string', description: 'Reference or ID number' });
      }
      if (prompt.includes('vendor') || prompt.includes('supplier')) {
        fieldMatches.push({ name: 'vendor_name', type: 'string', description: 'Vendor or supplier name' });
      }
      if (prompt.includes('customer') || prompt.includes('client')) {
        fieldMatches.push({ name: 'customer_name', type: 'string', description: 'Customer or client name' });
      }

      // Use matched fields if present
      if (fieldMatches.length > 0) {
        docName = 'Custom Document Type';
        docDescription = 'AI-generated document type with custom fields';
        fieldMatches.forEach(field => {
          generatedSchema[field.name] = {
            type: field.type,
            required: true,
            description: field.description
          };
        });
        generatedPrompt = `You are extracting data from documents. Focus on: ${fieldMatches.map(f => f.description.toLowerCase()).join(', ')}. ${aiPrompt}`;
      } else if (prompt.match(/invoice|bill|billing/) && !prompt.includes('just') && !prompt.includes('only')) {
        docName = 'Business Invoice';
        docDescription = 'Standard business invoice for goods or services';
        generatedSchema = {
          "invoice_number": {"type": "string", "required": true, "description": "Unique invoice identifier"},
          "vendor_info": {
            "type": "object",
            "required": true,
            "description": "Vendor company information",
            "properties": {
              "name": {"type": "string", "required": true, "description": "Supplier or vendor company name"},
              "address": {"type": "string", "required": false, "description": "Vendor business address"},
              "phone": {"type": "string", "required": false, "description": "Vendor contact phone number"},
              "email": {"type": "string", "required": false, "description": "Vendor contact email"}
            }
          },
          "invoice_date": {"type": "date", "required": true, "description": "Date invoice was issued"},
          "due_date": {"type": "date", "required": true, "description": "Payment due date"},
          "line_items": {
            "type": "array",
            "required": true,
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
          },
          "subtotal": {"type": "number", "required": true, "description": "Amount before tax"},
          "tax_amount": {"type": "number", "required": false, "description": "Tax amount"},
          "total_amount": {"type": "number", "required": true, "description": "Final total amount due"},
          "currency": {"type": "string", "required": true, "default": "USD", "description": "Currency code"},
          "payment_terms": {"type": "string", "required": false, "description": "Payment terms (e.g., Net 30)"}
        };
        generatedPrompt = `You are extracting data from business invoices. Extract vendor information including nested contact details, all line items with quantities and prices, monetary amounts, and payment terms. Be extremely precise with numbers - include cents/decimals. Dates should be in YYYY-MM-DD format.`;
      } else if (prompt.match(/receipt|purchase|store|shop/)) {
        docName = 'Purchase Receipt';
        docDescription = 'Retail purchase receipt from stores or merchants';
        generatedSchema = {
          "merchant_name": {"type": "string", "required": true, "description": "Store or merchant name"},
          "merchant_address": {"type": "string", "required": false, "description": "Store location address"},
          "transaction_date": {"type": "date", "required": true, "description": "Date of purchase"},
          "transaction_time": {"type": "string", "required": false, "description": "Time of purchase"},
          "receipt_number": {"type": "string", "required": false, "description": "Receipt or transaction number"},
          "subtotal": {"type": "number", "required": true, "description": "Amount before tax"},
          "tax_amount": {"type": "number", "required": false, "description": "Sales tax amount"},
          "total_amount": {"type": "number", "required": true, "description": "Total amount paid"},
          "currency": {"type": "string", "required": true, "default": "USD", "description": "Currency"},
          "payment_method": {"type": "string", "required": false, "description": "Payment method used"}
        };
        generatedPrompt = `You are extracting data from retail receipts. Focus on merchant information, transaction details, and all monetary amounts. Be precise with numbers and include tax calculations.`;
      } else if (prompt.match(/expense|reimbursement|employee|travel/)) {
        docName = 'Expense Report';
        docDescription = 'Employee expense reimbursement form';
        generatedSchema = {
          "employee_info": {
            "type": "object",
            "required": true,
            "description": "Employee identification information",
            "properties": {
              "name": {"type": "string", "required": true, "description": "Employee full name"},
              "id": {"type": "string", "required": true, "description": "Employee ID or badge number"},
              "department": {"type": "string", "required": false, "description": "Employee department"},
              "manager": {"type": "string", "required": false, "description": "Approving manager name"}
            }
          },
          "expenses": {
            "type": "array",
            "required": true,
            "description": "List of individual expenses",
            "items": {
              "type": "object",
              "properties": {
                "date": {"type": "date", "required": true, "description": "Date expense was incurred"},
                "category": {"type": "string", "required": true, "description": "Type of expense (travel, meals, supplies, etc.)"},
                "amount": {"type": "number", "required": true, "description": "Expense amount"},
                "description": {"type": "string", "required": true, "description": "Detailed description of expense"},
                "receipt_attached": {"type": "boolean", "required": false, "description": "Whether receipt is attached"}
              }
            }
          },
          "total_amount": {"type": "number", "required": true, "description": "Total reimbursement amount"},
          "currency": {"type": "string", "required": true, "default": "USD", "description": "Currency"},
          "business_purpose": {"type": "string", "required": true, "description": "Overall business justification"},
          "approval_status": {"type": "string", "required": false, "description": "Current approval status"}
        };
        generatedPrompt = `You are extracting data from employee expense forms. Extract employee information, multiple expense line items with dates and categories, total amounts, and approval details.`;
      } else if (prompt.match(/medical|prescription|patient|health|doctor/)) {
        docName = 'Medical Prescription';
        docDescription = 'Prescription form with patient and medication details';
        generatedSchema = {
          "patient_info": {
            "type": "object",
            "required": true,
            "description": "Patient identification information",
            "properties": {
              "name": {"type": "string", "required": true, "description": "Patient full name"},
              "date_of_birth": {"type": "date", "required": true, "description": "Patient date of birth"},
              "address": {"type": "string", "required": false, "description": "Patient address"},
              "phone": {"type": "string", "required": false, "description": "Patient phone number"}
            }
          },
          "prescription_info": {
            "type": "object",
            "required": true,
            "description": "Prescription details",
            "properties": {
              "date": {"type": "date", "required": true, "description": "Prescription date"},
              "rx_number": {"type": "string", "required": true, "description": "Prescription number"},
              "refills_remaining": {"type": "number", "required": false, "description": "Number of refills left"}
            }
          },
          "medications": {
            "type": "array",
            "required": true,
            "description": "List of prescribed medications",
            "items": {
              "type": "object",
              "properties": {
                "name": {"type": "string", "required": true, "description": "Medication name"},
                "strength": {"type": "string", "required": true, "description": "Medication strength/dosage"},
                "quantity": {"type": "number", "required": true, "description": "Quantity prescribed"},
                "directions": {"type": "string", "required": true, "description": "Usage instructions"},
                "refills_allowed": {"type": "number", "required": false, "description": "Number of refills allowed"}
              }
            }
          },
          "prescribing_doctor": {
            "type": "object",
            "required": true,
            "description": "Prescribing physician information",
            "properties": {
              "name": {"type": "string", "required": true, "description": "Doctor full name"},
              "license_number": {"type": "string", "required": true, "description": "Medical license number"},
              "phone": {"type": "string", "required": false, "description": "Doctor's office phone"},
              "dea_number": {"type": "string", "required": false, "description": "DEA registration number"}
            }
          }
        };
        generatedPrompt = `You are extracting data from medical prescriptions. Extract patient information, prescription details, medication lists with dosages and instructions, and prescribing doctor information.`;
      } else if (prompt.match(/load.*sheet|harvest.*operation|harvest.*detail|field.*operation|agricultural.*load|extract.*table|table.*data|column.*names/i)) {
        docName = 'Harvest Load Sheet';
        docDescription = 'Agricultural harvest operation load sheet with header details and load table';
        generatedSchema = {
          "harvest_operation_details": {
            "type": "object",
            "required": true,
            "description": "Header information from the top 5 boxes",
            "properties": {
              "harvest_date": {"type": "date", "required": true, "description": "Date of harvest operation"},
              "field": {"type": "string", "required": true, "description": "Field identifier or name"},
              "acres": {"type": "number", "required": true, "description": "Number of acres harvested"},
              "shift_number": {"type": "string", "required": true, "description": "Shift number"},
              "shake_number": {"type": "string", "required": true, "description": "Shake number"}
            }
          },
          "load_table": {
            "type": "array",
            "required": true,
            "description": "Table of load information with multiple rows",
            "items": {
              "type": "object",
              "properties": {
                "load_number": {"type": "string", "required": true, "description": "Load identification number"},
                "ticket_number": {"type": "string", "required": true, "description": "Ticket number"},
                "front_trailer": {"type": "string", "required": true, "description": "Front trailer identifier"},
                "back_trailer": {"type": "string", "required": true, "description": "Back trailer identifier"},
                "harvest_time": {"type": "string", "required": true, "description": "Time of harvest for this load"}
              }
            }
          },
          "total_loads": {"type": "number", "required": false, "description": "Total number of loads processed"},
          "supervisor": {"type": "string", "required": false, "description": "Supervising person or signature"}
        };
        generatedPrompt = `You are extracting data from agricultural harvest load sheets. Extract header details and all rows from the load table with columns listed.`;
      } else if (prompt.match(/table|columns?|rows?|extract.*data.*from/i) && prompt.includes('column')) {
        // Generic table extraction - parse column names if present
        const columnMatches = prompt.match(/column.*names?[:\s]*(.*?)(?:\.|$)/i);
        const columns = columnMatches
          ? columnMatches[1].split(/[,;]|\s+and\s+/).map(col => col.trim().toLowerCase().replace(/\s+/g, '_'))
          : ['column_1', 'column_2', 'column_3'];
        docName = 'Table Data Extraction';
        docDescription = 'Generic table data extraction with custom columns';
        const tableProperties = {};
        columns.forEach(col => {
          if (col) {
            tableProperties[col] = {
              type: 'string',
              required: true,
              description: `${col.replace(/_/g, ' ')} from the table`
            };
          }
        });
        generatedSchema = {
          "document_header": {
            "type": "object",
            "required": false,
            "description": "Header information if present",
            "properties": {
              "document_date": {"type": "date", "required": false, "description": "Document date"},
              "document_title": {"type": "string", "required": false, "description": "Document title"},
              "reference_id": {"type": "string", "required": false, "description": "Reference or ID number"}
            }
          },
          "table_data": {
            "type": "array",
            "required": true,
            "description": "Extracted table rows",
            "items": { "type": "object", "properties": tableProperties }
          },
          "summary_info": {
            "type": "object",
            "required": false,
            "description": "Summary or totals if present",
            "properties": {
              "total_rows": {"type": "number", "required": false, "description": "Total number of rows"},
              "notes": {"type": "string", "required": false, "description": "Additional notes or comments"}
            }
          }
        };
        generatedPrompt = `You are extracting tabular data from documents. Extract header information and table rows with the specified columns.`;
      } else {
        // Generic document type fallback
        docName = 'Custom Document Type';
        docDescription = 'AI-generated document type for custom document processing';
        generatedSchema = {
          "document_title": {"type": "string", "required": true, "description": "Document title or header"},
          "document_date": {"type": "date", "required": true, "description": "Document date"},
          "reference_number": {"type": "string", "required": false, "description": "Reference or ID number"},
          "company_name": {"type": "string", "required": false, "description": "Company or organization name"},
          "contact_person": {"type": "string", "required": false, "description": "Primary contact person"},
          "amount": {"type": "number", "required": false, "description": "Monetary amount if applicable"},
          "currency": {"type": "string", "required": false, "default": "USD", "description": "Currency"},
          "notes": {"type": "string", "required": false, "description": "Additional notes or comments"}
        };
        generatedPrompt = `You are extracting structured data from: ${aiPrompt}. Focus on key information, dates, amounts, and relevant details.`;
      }

      // Wrap generated schema in proper JSON Schema format
      const jsonSchema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": generatedSchema,
        "required": Object.entries(generatedSchema)
          .filter(([_, fieldDef]) => fieldDef.required)
          .map(([fieldName, _]) => fieldName)
      };

      // Update form data: keep existing pipeline steps if present, but sync objects to new schema/prompt
      setFormData(prev => {
        const baseObject = {
            name: 'main_object',
            object_type: 'standalone',
            parent_object_name: null,
            object_schema: jsonSchema,
            extraction_instructions: generatedPrompt,
          hil_config: prev.hil_instructions || {
            required_review_fields: [],
            auto_approve_threshold: 0.85,
            require_manual_review: false
          },
            send_config: {}
        };

        const hasExisting = prev.pipeline_config && ((prev.pipeline_config.steps?.length || 0) > 0 || (prev.pipeline_config.objects?.length || 0) > 0);
        const pipeline_config = hasExisting
          ? {
              ...prev.pipeline_config,
              objects: (prev.pipeline_config.objects && prev.pipeline_config.objects.length > 0)
                ? prev.pipeline_config.objects.map(obj => ({
                    ...baseObject,
                    name: obj.name || baseObject.name,
                    object_type: obj.object_type || baseObject.object_type,
                    parent_object_name: obj.parent_object_name ?? baseObject.parent_object_name,
                    send_config: obj.send_config || baseObject.send_config
                  }))
                : [baseObject]
            }
          : {
              name: 'Extract, Review (HIL) & Send',
              description: 'Extract, human review, then send',
              steps: [
                { step_type: 'extraction', name: 'Extract Data', description: 'Extract structured data', is_required: true, config: {}, depends_on: [] },
                { step_type: 'hil', name: 'Review Data', description: 'Manual review and correction', is_required: true, config: {}, depends_on: [] },
                { step_type: 'send', name: 'Send Data', description: 'Send processed data', is_required: true, config: {}, depends_on: [] }
              ],
              objects: [baseObject],
              parallel_processing: false,
          global_config: {}
            };

        return {
        ...prev,
        name: prev.name || docName,  // Preserve existing name if present
        description: prev.description || docDescription,  // Preserve existing description if present
        output_schema: jsonSchema,
        instructions: { prompt: generatedPrompt, extraction_hints: [] },
          pipeline_config
        };
      });

      // Convert schema to fields for builder (objects, arrays with nested props)
      const newFields = Object.entries(jsonSchema.properties).map(([name, def]) => {
        const field = {
          id: Math.random(),
          name,
        type: def.type || 'string',
          required: def.required || false,
          description: def.description || '',
          default: def.default || '',
          nestedFields: [],
          arrayItemType: 'string'
        };
        if (def.type === 'object' && def.properties) {
          field.nestedFields = Object.entries(def.properties).map(([propName, propDef]) => ({
            id: Math.random(),
            name: propName,
            type: propDef.type || 'string',
            required: propDef.required || false,
            description: propDef.description || '',
            default: propDef.default || ''
          }));
        }
        if (def.type === 'array' && def.items) {
          field.arrayItemType = def.items.type || 'string';
          if (def.items.type === 'object' && def.items.properties) {
            field.nestedFields = Object.entries(def.items.properties).map(([propName, propDef]) => ({
              id: Math.random(),
              name: propName,
              type: propDef.type || 'string',
              required: propDef.required || false,
              description: propDef.description || '',
              default: propDef.default || ''
            }));
          }
        }
        return field;
      });

      setSchemaFields(newFields);
      setMessage(`📝 Template generated schema for: ${docName}`);
  setAiPrompt('');
  setSchemaMode('builder');
    } catch (templateError) {
      console.error('Template generation error:', templateError);
      setMessage('❌ Both AI and template generation failed. Please try again.');
    } finally {
      setGeneratingSchema(false);
    }
  };

  const validateSchema = (schema) => {
    const errors = [];
    if (!schema || Object.keys(schema).length === 0) {
      errors.push('Schema cannot be empty');
      return errors;
    }

    // Check if this is a JSON Schema format (has $schema, type, properties)
  if ((schema.$schema && schema.type === 'object' && schema.properties) ||
    (schema.type === 'object' && schema.properties)) {
      // Validate the properties object
      const properties = schema.properties;
      Object.entries(properties).forEach(([fieldName, fieldDef]) => {
        if (!fieldName || !fieldName.trim()) {
          errors.push('Field name cannot be empty');
        }
        if (!fieldDef.type) {
          errors.push(`Field '${fieldName}' must have a type`);
        }
      });

      // Validate required fields exist
      if (schema.required && Array.isArray(schema.required)) {
        schema.required.forEach(requiredField => {
          if (!properties[requiredField]) {
            errors.push(`Required field '${requiredField}' is not defined in properties`);
          }
        });
      }
    } else {
      // Legacy format - validate directly as properties
    Object.entries(schema).forEach(([fieldName, fieldDef]) => {
      if (!fieldName || !fieldName.trim()) {
        errors.push('Field name cannot be empty');
      }
      if (!fieldDef.type) {
        errors.push(`Field '${fieldName}' must have a type`);
      }
    });
    }

    return errors;
  };

  // ===== PIPELINE FUNCTIONS =====
  const addPipelineStep = () => {
    const newStep = {
      step_type: 'extraction',
      name: 'New Step',
      description: 'Step description',
      is_required: true,
      config: {},
      depends_on: []
    };

    setFormData(prev => ({
      ...prev,
      pipeline_config: {
        ...prev.pipeline_config,
        steps: [...(prev.pipeline_config?.steps || []), newStep]
      }
    }));
  };

  const updatePipelineStep = (index, updatedStep) => {
    setFormData(prev => ({
      ...prev,
      pipeline_config: {
        ...prev.pipeline_config,
        steps: prev.pipeline_config.steps.map((step, i) =>
          i === index ? updatedStep : step
        )
      }
    }));
  };

  const removePipelineStep = (index) => {
    setFormData(prev => ({
      ...prev,
      pipeline_config: {
        ...prev.pipeline_config,
        steps: prev.pipeline_config.steps.filter((_, i) => i !== index)
      }
    }));
  };

  // ===== SCHEMA FIELD FUNCTIONS =====
  const addSchemaField = () => {
    const newField = {
      id: Math.random(),
      name: 'new_field',
      type: 'string',
      required: false,
      description: '',
      default: '',
      nestedFields: [],
      arrayItemType: 'string'
    };
    setSchemaFields([...schemaFields, newField]);
  };

  const updateSchemaField = (fieldId, property, value) => {
    const updatedFields = schemaFields.map(field => 
      field.id === fieldId ? { ...field, [property]: value } : field
    );
    setSchemaFields(updatedFields);
    updateSchemaFromFields(updatedFields);
  };

  const removeSchemaField = (fieldId) => {
    const updatedFields = schemaFields.filter(field => field.id !== fieldId);
    setSchemaFields(updatedFields);
    updateSchemaFromFields(updatedFields);
  };

  const updateSchemaFromFields = (fields) => {
    const buildNestedSchema = (nestedFields) => {
      const schema = {};
      nestedFields.forEach(field => {
        if (field.name && field.name.trim()) {
            schema[field.name] = {
              type: field.type,
              required: field.required,
              description: field.description,
              ...(field.default && { default: field.default })
            };
        }
      });
      return schema;
    };

    const schema = {};
    fields.forEach(field => {
      if (field.name && field.name.trim()) {
        if (field.type === 'object' && field.nestedFields?.length > 0) {
          schema[field.name] = {
            type: 'object',
            required: field.required,
            description: field.description,
            properties: buildNestedSchema(field.nestedFields)
          };
        } else if (field.type === 'array') {
          const itemSchema = field.arrayItemType === 'object' && field.nestedFields?.length > 0
            ? { type: 'object', properties: buildNestedSchema(field.nestedFields) }
            : { type: field.arrayItemType || 'string' };
          schema[field.name] = {
            type: 'array',
            required: field.required,
            description: field.description,
            items: itemSchema
          };
        } else {
          schema[field.name] = {
            type: field.type,
            required: field.required,
            description: field.description,
            ...(field.default && { default: field.default })
          };
        }
      }
    });
    setFormData(prev => ({ ...prev, output_schema: schema }));
  };

  // ===== UI FUNCTIONS =====
  const startWizard = () => {
          setEditingId(null);
    setShowEditModal(false);
    setWizardStep(1);
    setShowCreateWizard(true);
  };

  const editDocType = (docType) => {
    const hilFromPipeline = (docType.pipeline_config?.objects && docType.pipeline_config.objects[0]?.hil_config) || {
      required_review_fields: [],
      auto_approve_threshold: 0.85,
      require_manual_review: false
    };

    setFormData({
      name: docType.name,
      description: docType.description || '',
      output_schema: docType.output_schema || {},
      instructions: docType.instructions || { prompt: '', extraction_hints: [] },
      hil_instructions: docType.hil_instructions || hilFromPipeline,
    pipeline_config: docType.pipeline_config || {
        name: 'Custom Pipeline',
        description: 'Custom pipeline',
        steps: [],
        objects: [{
          name: 'main_object',
          object_type: 'standalone',
          parent_object_name: null,
          object_schema: docType.output_schema || {},
          extraction_instructions: (docType.instructions && docType.instructions.prompt) || '',
      hil_config: hilFromPipeline,
          send_config: {}
        }],
        parallel_processing: false,
        global_config: {}
      },
      destination_webhook: docType.destination_webhook || ''
    });

    // Convert schema to fields for the builder
    const fields = Object.entries(docType.output_schema || {}).map(([name, def]) => ({
        id: Math.random(),
        name,
        type: def.type || 'string',
        required: def.required || false,
        description: def.description || '',
        default: def.default || '',
      nestedFields: def.type === 'object' && def.properties ?
        Object.entries(def.properties).map(([propName, propDef]) => ({
          id: Math.random(),
          name: propName,
          type: propDef.type || 'string',
          required: propDef.required || false,
          description: propDef.description || '',
          default: propDef.default || ''
        })) : [],
      arrayItemType: def.type === 'array' ? (def.items?.type || 'string') : 'string'
    }));

    setSchemaFields(fields);
    setEditingId(docType.id);
    setIsEditing(true);
    setWizardStep(1);
    setShowCreateWizard(true);

    // Populate the AI prompt field with the document description for reference
    if (docType.description) {
      setAiPrompt(docType.description);
    }

    // Detect dual-package mode from output schema (arrays) or pipeline config
    const outputSchema = docType.output_schema || {};
    const hasArrayInOutputSchema = Object.values(outputSchema).some(field =>
      field && typeof field === 'object' && field.type === 'array'
    );

    const pipelineObjects = docType.pipeline_config?.objects || [];
    const hasParentChildObjects = pipelineObjects.some(o => o.object_type === 'parent') &&
                                  pipelineObjects.some(o => o.object_type === 'children');

    if (hasArrayInOutputSchema || hasParentChildObjects) {
      console.log('Detected dual-package mode from:', { hasArrayInOutputSchema, hasParentChildObjects });

      if (hasParentChildObjects) {
        // Use pipeline objects for dual-package setup
        const parentObj = pipelineObjects.find(o => o.object_type === 'parent');
        const childObj = pipelineObjects.find(o => o.object_type === 'children');
        setChildCollectionKey('child_entries');

        if (parentObj?.object_schema) {
          setParentSchema(parentObj.object_schema);
          const parentFields = Object.entries(parentObj.object_schema).map(([name, def]) => ({
            id: Math.random(),
            name,
            type: def.type || 'string',
            required: def.required || false,
            description: def.description || '',
            default: def.default || '',
            nestedFields: def.type === 'object' && def.properties ?
              Object.entries(def.properties).map(([propName, propDef]) => ({
                id: Math.random(),
                name: propName,
                type: propDef.type || 'string',
                required: propDef.required || false,
                description: propDef.description || '',
                default: propDef.default || ''
              })) : [],
            arrayItemType: def.type === 'array' ? (def.items?.type || 'string') : 'string'
          }));
          setParentSchemaFields(parentFields);
          setParentSchemaJson(JSON.stringify(parentObj.object_schema, null, 2));
        }

        if (childObj?.object_schema) {
          setChildSchema(childObj.object_schema);
          const childFields = Object.entries(childObj.object_schema).map(([name, def]) => ({
            id: Math.random(),
            name,
            type: def.type || 'string',
            required: def.required || false,
            description: def.description || '',
            default: def.default || '',
            nestedFields: def.type === 'object' && def.properties ?
              Object.entries(def.properties).map(([propName, propDef]) => ({
                id: Math.random(),
                name: propName,
                type: propDef.type || 'string',
                required: propDef.required || false,
                description: propDef.description || '',
                default: propDef.default || ''
              })) : [],
            arrayItemType: def.type === 'array' ? (def.items?.type || 'string') : 'string'
          }));
          setChildSchemaFields(childFields);
          setChildSchemaJson(JSON.stringify(childObj.object_schema, null, 2));
        }
  } else if (hasArrayInOutputSchema) {
        // Extract parent and child schemas from output_schema
        console.log('Setting up dual-package from output schema arrays');

        const parentFields = [];
        let childArrayField = null;

    Object.entries(outputSchema).forEach(([name, def]) => {
          if (def && typeof def === 'object' && def.type === 'array' && def.items) {
            // This is the child array field
            childArrayField = {
              name,
              definition: def,
              items: def.items
            };
      setChildCollectionKey(name);
          } else {
            // This is a parent field
            parentFields.push({
              name,
              definition: def
            });
          }
        });

        if (parentFields.length > 0) {
          // Build parent schema
          const parentSchemaObj = { type: 'object', properties: {} };
          parentFields.forEach(field => {
            parentSchemaObj.properties[field.name] = field.definition;
          });
          parentSchemaObj.required = parentFields
            .filter(field => field.definition && field.definition.required)
            .map(field => field.name);

          setParentSchema(parentSchemaObj);

          // Convert to parent fields
          const parentFieldObjs = parentFields.map(field => ({
            id: Math.random(),
            name: field.name,
            type: field.definition?.type || 'string',
            required: field.definition?.required || false,
            description: field.definition?.description || '',
            default: field.definition?.default || '',
            nestedFields: field.definition?.type === 'object' && field.definition?.properties ?
              Object.entries(field.definition.properties).map(([propName, propDef]) => ({
                id: Math.random(),
                name: propName,
                type: propDef.type || 'string',
                required: propDef.required || false,
                description: propDef.description || '',
                default: propDef.default || ''
              })) : [],
            arrayItemType: 'string'
          }));

          setParentSchemaFields(parentFieldObjs);
          setParentSchemaJson(JSON.stringify(parentSchemaObj, null, 2));
        }

        if (childArrayField) {
          // Build child schema from array items
          const childSchemaObj = childArrayField.items;
          if (childSchemaObj && typeof childSchemaObj === 'object') {
            setChildSchema(childSchemaObj);

            // Convert to child fields
            const childFieldObjs = childSchemaObj.properties ?
              Object.entries(childSchemaObj.properties).map(([name, def]) => ({
                id: Math.random(),
                name,
                type: def?.type || 'string',
                required: (childSchemaObj.required || []).includes(name),
                description: def?.description || '',
                default: def?.default || '',
                nestedFields: def?.type === 'object' && def?.properties ?
                  Object.entries(def.properties).map(([propName, propDef]) => ({
                    id: Math.random(),
                    name: propName,
                    type: propDef?.type || 'string',
                    required: propDef?.required || false,
                    description: propDef?.description || '',
                    default: propDef?.default || ''
                  })) : [],
                arrayItemType: 'string'
              })) : [];

            setChildSchemaFields(childFieldObjs);
            setChildSchemaJson(JSON.stringify(childSchemaObj, null, 2));
          }
        }
      }

      setPackageMode('two');
    } else {
      // If single but schema is wrapped as array, set controls accordingly
      const entries = Object.entries(outputSchema || {});
      const arrayKey = entries.find(([_, def]) => def && def.type === 'array');
      if (arrayKey) {
        setSinglePackageType('array');
        setSingleCollectionKey(arrayKey[0]);
      } else {
        setSinglePackageType('object');
        setSingleCollectionKey('records');
      }
      setPackageMode('single');
    }

    // Auto-select a matching pipeline template if present
    try {
      const allowedNames = pipelineTemplates.map(t => t.name);
      const currentName = docType.pipeline_config?.name;
      if (currentName && allowedNames.includes(currentName)) {
        setSelectedTemplate(currentName);
      } else {
        setSelectedTemplate('');
      }
    } catch (_) {
      setSelectedTemplate('');
    }

  // Package mode is already set above based on pipelineObjects
  };

  const closeModals = () => {
    setShowEditModal(false);
    setShowCreateWizard(false);
    setEditModalTab('basic');
    setEditingId(null);
    setIsEditing(false);
    setTestFile(null);
    setTestResults(null);
    setShowTestOutput(false);
    setMessage('');

    // Reset dual schema states
    setParentSchema({});
    setChildSchema({});
    setParentSchemaFields([]);
    setChildSchemaFields([]);
    setParentSchemaMode('builder');
    setChildSchemaMode('builder');
    setParentSchemaJson('{}');
    setChildSchemaJson('{}');
  setChildCollectionKey('child_entries');
  setSinglePackageType('object');
  setSingleCollectionKey('records');
  };

  const canProceedToStep = (step) => {
    switch (step) {
      case 2:
        return formData.name.trim() && formData.description.trim();
      case 3:
        return (
          !!selectedTemplate &&
          !!formData.pipeline_config &&
          Array.isArray(formData.pipeline_config.steps) &&
          formData.pipeline_config.steps.length > 0 &&
          !!packageMode
        );
      case 4:
        // Check if schema is properly defined based on package mode
        let schemaValid = false;
        if (packageMode === 'single') {
          schemaValid = Object.keys(formData.output_schema || {}).length > 0;
        } else if (packageMode === 'two') {
          schemaValid = Object.keys(parentSchema).length > 0 && Object.keys(childSchema).length > 0;
        }
        return schemaValid && (formData.instructions?.prompt || '').trim();
      case 5:
        return true;
      default:
        return true;
    }
  };

  // ===== TESTING FUNCTIONS =====
  const testExtraction = async () => {
    if (!testFile) {
      setMessage('Please upload a test document');
      return;
    }

    setTesting(true);
    try {
      let fileContent;
      if (testFile.type.startsWith('text/') || testFile.name.endsWith('.txt')) {
        fileContent = await readFileAsText(testFile);
      } else if (testFile.type.startsWith('image/')) {
        fileContent = await readFileAsBase64(testFile);
      } else {
        try {
          fileContent = await readFileAsText(testFile);
        } catch (e) {
          fileContent = await readFileAsBase64(testFile);
        }
      }
      
      apiService.setTenantId(tenantId);
      
      const testConfig = {
        name: formData.name,
        description: formData.description,
        instructions: formData.instructions,
        output_schema: packageMode === 'two'
          ? { parent_schema: parentSchema, child_schema: childSchema, collection_key: childCollectionKey || 'child_entries' }
          : formData.output_schema,
        destination_webhook: formData.destination_webhook,
        pipeline_config: formData.pipeline_config || (packageMode === 'two'
          ? {
              name: 'Test Pipeline',
              description: 'Temporary pipeline for testing (dual)',
              steps: [
                { step_type: 'extraction', name: 'Extract Data', description: 'Extract structured data from document', is_required: true, config: {}, depends_on: [] }
              ],
              objects: [
                {
                  name: 'parent_object',
                  object_type: 'parent',
                  parent_object_name: null,
                  object_schema: parentSchema,
                  extraction_instructions: formData.instructions.prompt,
                  hil_config: formData.hil_instructions,
                  send_config: { scope: 'parent' }
                },
                {
                  name: childCollectionKey || 'child_entries',
                  object_type: 'children',
                  parent_object_name: 'parent_object',
                  object_schema: childSchema,
                  extraction_instructions: formData.instructions.prompt,
                  hil_config: formData.hil_instructions,
                  send_config: { scope: 'children' }
                }
              ],
              parallel_processing: false,
              global_config: {}
            }
          : {
          name: 'Test Pipeline',
          description: 'Temporary pipeline for testing',
          steps: [
            {
              step_type: 'extraction',
              name: 'Extract Data',
              description: 'Extract structured data from document',
              is_required: true,
              config: {},
              depends_on: []
            }
          ],
          objects: [{
            name: 'main_object',
            object_type: 'standalone',
            parent_object_name: null,
            object_schema: formData.output_schema,
            extraction_instructions: formData.instructions.prompt,
            hil_config: formData.hil_instructions,
            send_config: {}
          }],
          parallel_processing: false,
          global_config: {}
            })
      };
      
      const res = await api.post('/test-extraction', {
        sample_text: fileContent,
        test_config: testConfig
      });
      
      setTestResults(res.data);
      setShowTestOutput(true);
    } catch (e) {
      console.error('Test extraction error:', e);
      setTestResults({
        error: e.response?.data?.detail || e.message,
        test_status: 'failed'
      });
      setShowTestOutput(true);
    } finally {
      setTesting(false);
    }
  };

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const base64 = e.target.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // ===== EFFECTS =====
  useEffect(() => {
    loadDocTypes();
  }, [loadDocTypes]);

  // ===== RENDER FUNCTIONS =====
  const renderWizardStep = () => {
    switch (wizardStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-accent-100 dark:bg-accent-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-accent-600 dark:text-accent-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Basic Information</h3>
              <p className="text-gray-600 dark:text-slate-300">Tell us about your document type</p>
            </div>

            <div className="max-w-md mx-auto space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Document Type Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:border-accent-500 focus:outline-none"
                  placeholder="e.g., Purchase Receipt"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full border-2 border-gray-300 dark:border-slate-600 p-3 rounded-lg h-24 focus:border-accent-500 focus:outline-none"
                  placeholder="Describe what this document type is for..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Destination Webhook (Optional)</label>
                <input
                  type="url"
                  value={formData.destination_webhook}
                  onChange={(e) => setFormData(prev => ({ ...prev, destination_webhook: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:border-accent-500 focus:outline-none"
                  placeholder="https://your-api.com/webhook"
                />
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  URL where processed documents will be sent
                </p>
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">Or let AI create everything for you</p>
                <button
                  onClick={() => {
                    // Only set defaults if not already in dual-package mode (respect auto-detection)
                    if (packageMode !== 'two') {
                      const defaultTemplate = pipelineTemplates.find(t => t.key === 'extract_review_send');
                      if (defaultTemplate) {
                        setSelectedTemplate(defaultTemplate.name);
                        setPackageMode('single');
                        setFormData(prev => ({
                          ...prev,
                          pipeline_config: {
                            ...prev.pipeline_config,
                            steps: defaultTemplate.steps,
                            objects: [{
                              name: 'main_object',
                              object_type: 'standalone',
                              parent_object_name: null,
                              object_schema: prev.output_schema,
                              extraction_instructions: prev.instructions?.prompt || '',
                              hil_config: prev.hil_instructions,
                              send_config: {}
                            }],
                            parallel_processing: false
                            // Note: We don't update name/description here as those are for the document type, not the pipeline
                          }
                        }));
                      }
                    }
                    // Prefill the AI prompt to avoid an empty disabled button in Step 3
                    setAiPrompt(prev => prev || formData.description || formData.name || '');
                    setWizardStep(3);
                  }}
                  className="bg-gradient-to-r from-purple-600 to-accent-600 text-white px-6 py-3 rounded-lg flex items-center space-x-2 mx-auto hover:from-purple-700 hover:to-accent-700 transition-all shadow-lg"
                >
                  <Wand2 className="h-5 w-5" />
                  <span>Generate with AI</span>
                </button>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ArrowRight className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Pipeline Configuration</h3>
              <p className="text-gray-600 dark:text-slate-300">Choose how your document will be processed</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Choose a Pipeline Template
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pipelineTemplates.map((template, index) => {
                    const isDisabled = template.disabled || template.comingSoon;
                    const isSelected = selectedTemplate === template.name;
                    return (
                      <div
                        key={index}
                        onClick={() => {
                          if (isDisabled) return;
                          setSelectedTemplate(template.name);
                          // Build objects depending on template
                          setFormData(prev => {
                            let objects = [{
                                name: 'main_object',
                                object_type: 'standalone',
                                parent_object_name: null,
                                object_schema: prev.output_schema,
                                extraction_instructions: prev.instructions?.prompt || '',
                                hil_config: prev.hil_instructions,
                                send_config: {}
                            }];

                            // If parent-child template, split into two packages
                            if (template.key === 'parent_child_review_send') {
                              // Find first array field as child entries
                              const entries = Object.entries(prev.output_schema || {});
                              let childFieldName = null;
                              let childItems = null;
                              for (const [fname, fdef] of entries) {
                                if (fdef?.type === 'array') {
                                  childFieldName = fname;
                                  childItems = fdef.items || { type: 'string' };
                                  break;
                                }
                              }

                              // Parent schema is full schema without the child array (if found)
                              const parentSchema = { ...(prev.output_schema || {}) };
                              if (childFieldName) {
                                try { delete parentSchema[childFieldName]; } catch (_) {}
                              }

                              // Child schema derived from array item type (prefer object properties)
                              let childSchema;
                              if (childItems?.type === 'object' && childItems?.properties) {
                                childSchema = { type: 'object', properties: childItems.properties };
                              } else if (childItems?.type) {
                                childSchema = { type: 'object', properties: { value: { type: childItems.type, required: false, description: 'Child entry value' } } };
                              } else {
                                childSchema = { type: 'object', properties: {} };
                              }

                objects = [
                                {
                                  name: 'parent_object',
                                  object_type: 'parent',
                                  parent_object_name: null,
                                  object_schema: parentSchema,
                                  extraction_instructions: prev.instructions?.prompt || '',
                                  hil_config: prev.hil_instructions,
                                  send_config: { scope: 'parent' }
                                },
                                {
                  name: childCollectionKey || 'child_entries',
                                  object_type: 'children',
                                  parent_object_name: 'parent_object',
                                  object_schema: childSchema,
                                  extraction_instructions: prev.instructions?.prompt || '',
                                  hil_config: prev.hil_instructions,
                                  send_config: { scope: 'children' }
                                }
                              ];

                              setPackageMode('two');
                setChildCollectionKey(childFieldName || 'child_entries');
                            } else {
                              setPackageMode('single');
                            }

                            return {
                              ...prev,
                              pipeline_config: {
                                ...prev.pipeline_config,
                                name: template.name,
                                description: template.description,
                                steps: template.steps,
                                objects,
                              parallel_processing: false
                            }
                            };
                          });
                        }}
                        className={`relative p-4 border-2 rounded-lg transition-all ${
                          isDisabled
                            ? 'opacity-60 cursor-not-allowed border-slate-200 dark:border-slate-700'
                            : `cursor-pointer ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'}`
                        }`}
                      >
                        <div className="flex items-start justify-between">
                        <h4 className="font-semibold text-slate-800 dark:text-slate-200">{template.name}</h4>
                          {template.comingSoon && (
                            <span className="text-xs px-2 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">Coming soon</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{template.description}</p>
                        {template.steps?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {template.steps.map((step, stepIndex) => (
                              <span key={stepIndex} className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                                {step.name || step.step_type}
                              </span>
                            ))}
                          </div>
                        )}
                        </div>
                    );
                  })}
                      </div>
              </div>

              {selectedTemplate && (
                <div className="border-t pt-4">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Output Structure
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Single package card */}
                    <div
                      onClick={() => {
                        const isParentChild = selectedTemplate === pipelineTemplates.find(t => t.key === 'parent_child_review_send')?.name;
                        if (isParentChild) return; // forced two packages
                        setPackageMode('single');
                      }}
                      className={`p-4 border-2 rounded-lg transition-all ${
                        selectedTemplate === pipelineTemplates.find(t => t.key === 'parent_child_review_send')?.name
                          ? 'opacity-60 cursor-not-allowed border-slate-200'
                          : `cursor-pointer ${packageMode === 'single' ? 'border-green-500 bg-green-50' : 'border-slate-200 hover:border-slate-300'}`
                      }`}
                      title={selectedTemplate === pipelineTemplates.find(t => t.key === 'parent_child_review_send')?.name ? 'Parent/Child pipeline requires two packages' : undefined}
                    >
                      <h5 className="font-semibold">Single package</h5>
                      <p className="text-sm text-slate-600">All extracted fields in one result object</p>
                    </div>

                    {/* Two packages card */}
                    <div
                      onClick={() => {
                        const isParentChild = selectedTemplate === pipelineTemplates.find(t => t.key === 'parent_child_review_send')?.name;
                        if (!isParentChild) return; // only enabled for parent/child template
                        setPackageMode('two');
                      }}
                      className={`p-4 border-2 rounded-lg transition-all ${
                        selectedTemplate === pipelineTemplates.find(t => t.key === 'parent_child_review_send')?.name
                          ? `${packageMode === 'two' ? 'border-green-500 bg-green-50' : 'cursor-pointer border-slate-200 hover:border-slate-300'}`
                          : 'opacity-60 cursor-not-allowed border-slate-200'
                      }`}
                      title={selectedTemplate === pipelineTemplates.find(t => t.key === 'parent_child_review_send')?.name ? undefined : 'Two-package mode is available only for the Parent/Child template'}
                    >
                      <h5 className="font-semibold">Two packages</h5>
                      <p className="text-sm text-slate-600">Parent object sent first, then child entries as a second package</p>
                  </div>
                  </div>
                  {/* Single package additional options */}
                  {packageMode === 'single' && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Single Package Type</label>
                        <select
                          value={singlePackageType}
                          onChange={(e) => setSinglePackageType(e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                        >
                          <option value="object">Single object</option>
                          <option value="array">Array of objects</option>
                        </select>
                      </div>
                      {singlePackageType === 'array' && (
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Collection Key</label>
                          <input
                            type="text"
                            value={singleCollectionKey}
                            onChange={(e) => setSingleCollectionKey(e.target.value)}
                            placeholder="records"
                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                          />
                        </div>
                      )}
                    </div>
                  )}
                  {/* Dual package additional options */}
                  {packageMode === 'two' && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Child Collection Key</label>
                        <input
                          type="text"
                          value={childCollectionKey}
                          onChange={(e) => setChildCollectionKey(e.target.value)}
                          placeholder="child_entries"
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                        />
                        <p className="text-xs text-slate-500 mt-1">Used only for preview/export shape. Extraction/HIL use per-object schemas.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Code className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Schema & Instructions</h3>
              <p className="text-gray-600 dark:text-slate-300">Define what to extract and how to extract it</p>
            </div>

            {/* AI Generator Section */}
            <div className="bg-gradient-to-r from-purple-50 to-accent-50 border-2 border-purple-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                <Wand2 className="h-6 w-6 text-purple-600" />
                <h4 className="text-lg font-semibold text-purple-800">AI Schema Generator</h4>
                </div>

                {/* Package Mode and Pipeline Indicator */}
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-purple-700">Package Mode:</span>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                      packageMode === 'single'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {packageMode === 'single' ? 'Single Package' : 'Dual Package'}
                    </div>
                    {packageMode === 'two' && (
                      <span className="text-xs text-purple-600">🔄 Auto-detected</span>
                    )}
                  </div>

                  {selectedTemplate && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-purple-700">Pipeline:</span>
                      <div className="px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                        {selectedTemplate}
                      </div>
                      {packageMode === 'two' && (
                        <span className="text-xs text-purple-600">🔄 Auto-selected</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium mb-2 text-purple-700">Describe Your Document Type</label>
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="w-full border-2 border-purple-300 p-3 rounded-lg h-24 focus:border-purple-500 focus:outline-none"
                    placeholder="e.g., 'Medical prescription with patient info, medication details, and dosage' or 'First extract header with date and total, THEN extract table rows with item details'"
                  />
                  <p className="text-xs text-purple-600 mt-1">
                    💡 Be specific about fields, amounts, dates, and categories you want to extract
                  </p>
                  <p className="text-xs text-purple-500 mt-1">
                    🎯 For dual-package: Use phrases like "first extract header THEN extract table", "parent object AND child entries"
                  </p>
                  <p className="text-xs text-purple-400 mt-1">
                    ⚙️ System auto-selects Parent/Child Review pipeline for dual-package processing
                  </p>
                </div>
                <div className="flex flex-col justify-center">
                  <button
                    onClick={generateSchemaWithAI}
                    disabled={generatingSchema || !aiPrompt.trim()}
                    className="bg-gradient-to-r from-purple-600 to-accent-600 text-white px-6 py-3 rounded-lg flex items-center justify-center space-x-2 disabled:opacity-50 hover:from-purple-700 hover:to-accent-700 transition-all"
                  >
                    <Wand2 className="h-5 w-5" />
                    <span>{generatingSchema ? 'Generating...' : 'Generate'}</span>
                  </button>
                </div>
                </div>
              </div>

              {/* Enhanced Schema Editor */}
              <div className="bg-gray-50 dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-lg p-6">
                {/* Schema Editor Header */}
                <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-accent-100 dark:bg-accent-900 rounded-lg flex items-center justify-center">
                          <FileText className="h-4 w-4 text-accent-600 dark:text-accent-400" />
                        </div>
                        <div>
                      <h5 className="font-semibold text-gray-900 dark:text-white">Schema Editor</h5>
                      <p className="text-sm text-gray-600 dark:text-slate-300">
                        {packageMode === 'single' ? 'Define the structure for your single package' : 'Define structures for parent and child packages'}
                      </p>
                      </div>
                    </div>
                    
                  {/* Editor Mode Toggle */}
                          <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        if (packageMode === 'single') {
                          setSchemaMode('builder');
                        } else {
                          setParentSchemaMode('builder');
                          setChildSchemaMode('builder');
                        }
                      }}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        (packageMode === 'single' && schemaMode === 'builder') ||
                        (packageMode === 'two' && parentSchemaMode === 'builder')
                          ? 'bg-accent-100 text-accent-700 dark:bg-accent-900 dark:text-accent-300'
                          : 'text-gray-600 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      Builder
                    </button>
                    <button
                      onClick={() => {
                        if (packageMode === 'single') {
                          setSchemaMode('json');
                        } else {
                          setParentSchemaMode('json');
                          setChildSchemaMode('json');
                        }
                      }}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        (packageMode === 'single' && schemaMode === 'json') ||
                        (packageMode === 'two' && parentSchemaMode === 'json')
                          ? 'bg-accent-100 text-accent-700 dark:bg-accent-900 dark:text-accent-300'
                          : 'text-gray-600 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      JSON
                    </button>
                          </div>
                        </div>

                {/* Single Package Schema Editor */}
                {packageMode === 'single' && (
                  <div className="space-y-4">
                    {schemaMode === 'builder' ? (
                      <SchemaBuilder
                        fields={schemaFields}
                        onFieldsChange={setSchemaFields}
                        onSchemaChange={(schema) => {
                          // For single package, we store plain properties object by default
                          // If user selected array type, wrap under items
                          if (singlePackageType === 'array') {
                            const wrapped = { type: 'object', properties: schema };
                            setFormData(prev => ({ ...prev, output_schema: wrapped }));
                          } else {
                            setFormData(prev => ({ ...prev, output_schema: schema }));
                          }
                        }}
                      />
                    ) : (
                      <SchemaJsonEditor
                        schema={formData.output_schema}
                        onSchemaChange={(schema) => setFormData(prev => ({ ...prev, output_schema: schema }))}
                      />
                    )}
                    </div>
                )}

                {/* Two Package Schema Editor */}
                {packageMode === 'two' && (
                  <div className="space-y-6">
                    {/* Parent Schema */}
                    <div className="border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50/50 dark:bg-blue-900/10">
                      <div className="flex items-center justify-between mb-4">
                        <h6 className="font-semibold text-blue-800 dark:text-blue-200">Parent Package Schema</h6>
                        <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-2 py-1 rounded">
                          Header Data
                        </span>
                      </div>
                      {parentSchemaMode === 'builder' ? (
                        <SchemaBuilder
                          fields={parentSchemaFields}
                          onFieldsChange={setParentSchemaFields}
                          onSchemaChange={setParentSchema}
                        />
                      ) : (
                        <SchemaJsonEditor
                          schema={parentSchema}
                          onSchemaChange={setParentSchema}
                        />
                    )}
                  </div>

                    {/* Child Schema */}
                    <div className="border-2 border-green-200 dark:border-green-800 rounded-lg p-4 bg-green-50/50 dark:bg-green-900/10">
                      <div className="flex items-center justify-between mb-4">
                        <h6 className="font-semibold text-green-800 dark:text-green-200">Child Package Schema</h6>
                        <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-2 py-1 rounded">
                          Line Items
                        </span>
                      </div>
                      {childSchemaMode === 'builder' ? (
                        <SchemaBuilder
                          fields={childSchemaFields}
                          onFieldsChange={setChildSchemaFields}
                          onSchemaChange={setChildSchema}
                        />
                      ) : (
                        <SchemaJsonEditor
                          schema={childSchema}
                          onSchemaChange={setChildSchema}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Schema Preview */}
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-4">
                    <h6 className="font-semibold text-gray-900 dark:text-white">Schema Preview</h6>
                    <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-slate-400">
                      {packageMode === 'single' ? (
                        (() => {
                          const sch = formData.output_schema || {};
                          const props = sch.properties || sch;
                          // If schema is array-wrapped at root (single array collection), try to read items.properties
                          let count = Object.keys(props || {}).length;
                          if (count === 0 && !sch.properties && typeof sch === 'object') {
                            const arrayEntry = Object.values(sch).find(v => v && v.type === 'array');
                            if (arrayEntry && arrayEntry.items && arrayEntry.items.properties) {
                              count = Object.keys(arrayEntry.items.properties).length;
                            }
                          }
                          return <span>{count} fields</span>;
                        })()
                      ) : (
                        <>
                          <span>Parent: {parentSchemaFields.length} fields</span>
                          <span>Child: {childSchemaFields.length} fields per entry</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg p-4 max-h-48 overflow-y-auto">
                    <pre className="text-xs text-gray-800 dark:text-slate-200 whitespace-pre-wrap">
                      {(() => {
                        if (packageMode === 'single') {
                          const props = formData.output_schema?.properties ? formData.output_schema.properties : formData.output_schema;
                          if (singlePackageType === 'array') {
                            const preview = {
                              [singleCollectionKey || 'records']: {
                                type: 'array',
                                items: { type: 'object', properties: props || {} }
                              }
                            };
                            return JSON.stringify(preview, null, 2);
                          }
                          // object
                          return JSON.stringify(formData.output_schema, null, 2);
                        }
                        // dual-package preview: show distinct schemas to avoid implying a combined output
                        const preview = {
                          parent_schema: parentSchema,
                          child_schema: childSchema,
                          collection_key: childCollectionKey || 'child_entries'
                        };
                        return JSON.stringify(preview, null, 2);
                      })()}
                    </pre>
                  </div>
                </div>
            </div>

            {/* Extraction Instructions */}
            <div className="border-t-2 border-gray-200 dark:border-slate-700 pt-8">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Extraction Instructions</h4>
              <div className="bg-yellow-50 border-2 border-yellow-200 dark:bg-yellow-900 dark:border-yellow-800 rounded-xl p-6">
                <div className="flex items-start space-x-3 mb-4">
                  <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">AI</span>
                  </div>
                  <div>
                    <h5 className="font-semibold text-yellow-800 mb-1">AI Extraction Guidance</h5>
                    <p className="text-sm text-yellow-700">
                      Provide specific instructions to help AI extract data accurately, especially for handwritten documents.
                    </p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2 text-yellow-800">Extraction Prompt</label>
                  <textarea
                    value={formData.instructions.prompt}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      instructions: { ...prev.instructions, prompt: e.target.value }
                    }))}
                    className="w-full border-2 border-yellow-300 p-4 rounded-lg h-32 focus:border-yellow-500 focus:outline-none bg-white"
                    placeholder="Example: 'Extract data from handwritten expense forms. Look for employee signature at bottom-right. Amounts may be written in cursive.'"
                  />
                    </div>
                    </div>
                  </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {editingId ? `Ready to Update "${formData.name || 'Document Type'}"` : 'Ready to Save'}
              </h3>
              <p className="text-gray-600 dark:text-slate-300">
                {editingId ? 'Review and update your document type configuration' : 'Review your document type configuration'}
              </p>
            </div>

            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-green-50 border-2 border-green-200 dark:bg-green-900/20 dark:border-green-800 rounded-lg p-6">
                <h4 className="font-semibold mb-3 text-green-800 dark:text-green-200">Configuration Summary</h4>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-green-200 dark:border-green-700">
                      <h5 className="font-medium text-gray-900 dark:text-white mb-2">Basic Information</h5>
                      <p className="text-sm text-gray-600 dark:text-slate-300">
                        <strong>Name:</strong> {formData.name || 'Not set'}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-slate-300">
                        <strong>Description:</strong> {formData.description || 'Not set'}
                      </p>
                    </div>
                    
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-green-200 dark:border-green-700">
                      <h5 className="font-medium text-gray-900 dark:text-white mb-2">Schema Fields</h5>
                      {packageMode === 'single' ? (
                        <>
                      <p className="text-sm text-gray-600 dark:text-slate-300">
                        <strong>Fields Defined:</strong> {schemaFields.length}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-slate-300">
                        <strong>Required Fields:</strong> {schemaFields.filter(f => f.required).length}
                      </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-gray-600 dark:text-slate-300">
                            <strong>Parent Fields:</strong> {parentSchemaFields.length}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-slate-300">
                            <strong>Child Fields:</strong> {childSchemaFields.length}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-green-200 dark:border-green-700">
                    <h5 className="font-medium text-gray-900 dark:text-white mb-2">Instructions</h5>
                    <p className="text-sm text-gray-600 dark:text-slate-300">
                      {formData.instructions?.prompt ? 
                        `"${formData.instructions.prompt.substring(0, 100)}${formData.instructions.prompt.length > 100 ? '...' : ''}"`
                        : 'No custom instructions provided'
                      }
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border-2 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white font-bold text-xs">💡</span>
                  </div>
                  <div>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>What happens next:</strong> After saving, you can upload documents, configure webhooks, 
                      and further customize your extraction pipeline in the main interface.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ===== MAIN RENDER =====
  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 transition-colors">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-accent-600 rounded-xl flex items-center justify-center shadow-lg">
              <FileText className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Document Types</h1>
              <p className="text-gray-600 dark:text-slate-300">Configure custom extraction templates</p>
            </div>
          </div>
          {!showCreateWizard && (
            <button
              onClick={startWizard}
              className="bg-gradient-to-r from-blue-600 to-accent-600 text-white px-6 py-3 rounded-xl flex items-center space-x-2 hover:from-blue-700 hover:to-accent-700 transition-all shadow-lg"
            >
              <Plus className="h-5 w-5" />
              <span>Create New Type</span>
            </button>
          )}
        </div>

        {/* Tenant Selection */}
        <div className="bg-gray-50 dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-accent-100 dark:bg-accent-900 rounded-lg flex items-center justify-center">
              <span className="text-accent-600 dark:text-accent-400 font-semibold">T</span>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-200 mb-1">Current Tenant</label>
              <div className="flex items-center space-x-3">
                <input
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="Enter Tenant ID"
                  className="border-2 border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:border-accent-500 focus:outline-none"
                />
                <button 
                  onClick={() => { apiService.setTenantId(tenantId); loadDocTypes(); }}
                  className="bg-accent-600 text-white px-4 py-2 rounded-lg hover:bg-accent-700 transition-colors"
                >
                  Connect
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        {message && (
          <div className="bg-blue-50 dark:bg-slate-800 border-l-4 border-blue-500 dark:border-blue-400 text-blue-700 dark:text-slate-200 p-4 rounded-lg mb-8">
            {message}
          </div>
        )}

        {/* Creation Wizard */}
        {showCreateWizard && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Progress Bar */}
            <div className="bg-slate-50 dark:bg-slate-900 px-8 py-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Step {wizardStep} of 5
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Creating: {formData.name || 'New Document Type'}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div 
                  className="bg-slate-700 dark:bg-slate-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(wizardStep / 5) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Step Content */}
            <div className="p-8">
              {renderWizardStep()}
            </div>

            {/* Navigation */}
            <div className="bg-slate-50 dark:bg-slate-900 px-8 py-6 border-t border-slate-200 dark:border-slate-700 flex justify-between">
              <button
                onClick={() => wizardStep > 1 ? setWizardStep(wizardStep - 1) : closeModals()}
                className="flex items-center space-x-2 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>{wizardStep > 1 ? 'Previous' : 'Cancel'}</span>
              </button>

              <div className="flex space-x-3">
                {wizardStep < 5 ? (
                  <button
                    onClick={() => setWizardStep(wizardStep + 1)}
                    disabled={!canProceedToStep(wizardStep + 1)}
                    className="bg-slate-700 dark:bg-slate-600 text-white px-6 py-2 rounded-lg flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 dark:hover:bg-slate-500 transition-colors"
                  >
                    <span>Next</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={createDocType}
                    disabled={loading || !formData.name || Object.keys(formData.output_schema).length === 0}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-2 rounded-lg flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed hover:from-green-700 hover:to-emerald-700 transition-all"
                  >
                    <Save className="h-4 w-4" />
                    <span>{loading ? 'Saving...' : 'Create Type'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Document Types List */}
        {!showCreateWizard && (
                  <div className="space-y-6">
            {docTypes.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 dark:bg-slate-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-600">
                <FileText className="h-20 w-20 mx-auto mb-4 text-gray-500 dark:text-slate-400" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Document Types</h3>
                <p className="text-gray-600 dark:text-slate-300 mb-6">Create your first document type to get started with automated extraction</p>
                          <button
                  onClick={startWizard}
                  className="bg-gradient-to-r from-blue-600 to-accent-600 text-white px-8 py-3 rounded-xl flex items-center space-x-2 mx-auto hover:from-blue-700 hover:to-accent-700 transition-all shadow-lg"
                          >
                  <Plus className="h-5 w-5" />
                  <span>Create Your First Type</span>
                          </button>
                          </div>
                        ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {docTypes.map((docType) => (
                  <div key={docType.id} className="group bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden hover:border-gray-300 dark:hover:border-slate-600 hover:shadow-lg transition-all duration-200">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate mb-1">
                            {docType.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                            {docType.description || 'Document processing configuration'}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => editDocType(docType)}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="Edit document type"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteDocType(docType.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:text-slate-500 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Delete document type"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      {/* Key Metrics */}
                      <div className="grid grid-cols-3 gap-4 mb-5">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                            {(() => {
                              const sch = docType.output_schema || {};
                              const props = sch.properties || sch;
                              let count = Object.keys(props || {}).length;
                              if (count === 0 && !sch.properties && typeof sch === 'object') {
                                const arrKey = Object.keys(sch).find(k => sch[k] && sch[k].type === 'array');
                                const arr = arrKey ? sch[arrKey] : null;
                                if (arr && arr.items && arr.items.properties) {
                                  count = Object.keys(arr.items.properties).length;
                                }
                              }
                              return count;
                            })()}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider font-medium">
                            Fields
                          </div>
                        </div>
                        <div className="text-center border-l border-r border-gray-200 dark:border-slate-700">
                          <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                            {(docType.pipeline_config?.steps || []).length}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider font-medium">
                            Steps
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="w-6 h-6 mx-auto mb-1">
                            {docType.destination_webhook ? (
                              <div className="w-full h-full bg-green-500 rounded-full flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                              </div>
                            ) : (
                              <div className="w-full h-full border-2 border-gray-300 dark:border-slate-600 rounded-full"></div>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider font-medium">
                            Webhook
                          </div>
                        </div>
                      </div>

                      {/* Pipeline Info */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Pipeline</span>
                          <span className="text-sm text-gray-900 dark:text-white font-medium">
                            {docType.pipeline_config?.name || 'Custom'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Processing</span>
                          <span className="text-sm text-gray-900 dark:text-white">
                            {docType.pipeline_config?.parallel_processing ? 'Parallel' : 'Sequential'}
                          </span>
                        </div>
                      </div>

                      {/* Edit Button */}
                      <button
                        onClick={() => editDocType(docType)}
                        className="w-full mt-5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-2.5 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-50 transition-colors font-medium flex items-center justify-center space-x-2"
                      >
                        <Edit className="h-4 w-4" />
                        <span>Configure</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ===== SCHEMA BUILDER COMPONENT =====
const SchemaBuilder = ({ fields, onFieldsChange, onSchemaChange }) => {
  const addField = () => {
    const newField = {
      id: Math.random(),
      name: 'new_field',
      type: 'object',
      required: false,
      description: '',
      default: '',
      nestedFields: [],
      arrayItemType: 'string'
    };
    onFieldsChange([...fields, newField]);
  };

  const updateField = (fieldId, property, value) => {
    const updatedFields = fields.map(field =>
      field.id === fieldId ? { ...field, [property]: value } : field
    );
    onFieldsChange(updatedFields);
    updateSchemaFromFields(updatedFields);
  };

  const removeField = (fieldId) => {
    const updatedFields = fields.filter(field => field.id !== fieldId);
    onFieldsChange(updatedFields);
    updateSchemaFromFields(updatedFields);
  };

  // Nested fields management for object fields and array-of-object item schemas
  const addNestedField = (parentFieldId) => {
    const updatedFields = fields.map(field => {
      if (field.id !== parentFieldId) return field;
      const nested = field.nestedFields ? [...field.nestedFields] : [];
      nested.push({
        id: Math.random(),
        name: 'new_subfield',
        type: 'string',
        required: false,
        description: '',
        default: ''
      });
      return { ...field, nestedFields: nested };
    });
    onFieldsChange(updatedFields);
    updateSchemaFromFields(updatedFields);
  };

  const updateNestedField = (parentFieldId, nestedFieldId, property, value) => {
    const updatedFields = fields.map(field => {
      if (field.id !== parentFieldId) return field;
      const updatedNested = (field.nestedFields || []).map(nf =>
        nf.id === nestedFieldId ? { ...nf, [property]: value } : nf
      );
      return { ...field, nestedFields: updatedNested };
    });
    onFieldsChange(updatedFields);
    updateSchemaFromFields(updatedFields);
  };

  const removeNestedField = (parentFieldId, nestedFieldId) => {
    const updatedFields = fields.map(field => {
      if (field.id !== parentFieldId) return field;
      const updatedNested = (field.nestedFields || []).filter(nf => nf.id !== nestedFieldId);
      return { ...field, nestedFields: updatedNested };
    });
    onFieldsChange(updatedFields);
    updateSchemaFromFields(updatedFields);
  };

  // Convenience: for arrays, ensure items are objects and add a nested item field
  const addArrayItemField = (parentFieldId) => {
    const updatedFields = fields.map(field => {
      if (field.id !== parentFieldId) return field;
      const nested = field.nestedFields ? [...field.nestedFields] : [];
      nested.push({
        id: Math.random(),
        name: 'item_field',
        type: 'string',
        required: false,
        description: '',
        default: ''
      });
      return { ...field, arrayItemType: 'object', nestedFields: nested };
    });
    onFieldsChange(updatedFields);
    updateSchemaFromFields(updatedFields);
  };

  const updateSchemaFromFields = (fields) => {
    const buildNestedSchema = (nestedFields) => {
      const schema = {};
      nestedFields.forEach(field => {
        if (field.name && field.name.trim()) {
            schema[field.name] = {
              type: field.type,
              required: field.required,
              description: field.description,
              ...(field.default && { default: field.default })
            };
        }
      });
      return schema;
    };

    const schema = {};
    fields.forEach(field => {
      if (field.name && field.name.trim()) {
        if (field.type === 'object' && field.nestedFields?.length > 0) {
          schema[field.name] = {
            type: 'object',
            required: field.required,
            description: field.description,
            properties: buildNestedSchema(field.nestedFields)
          };
        } else if (field.type === 'array') {
          const itemSchema = field.arrayItemType === 'object' && field.nestedFields?.length > 0
            ? { type: 'object', properties: buildNestedSchema(field.nestedFields) }
            : { type: field.arrayItemType || 'string' };
          schema[field.name] = {
            type: 'array',
            required: field.required,
            description: field.description,
            items: itemSchema
          };
        } else {
          schema[field.name] = {
            type: field.type,
            required: field.required,
            description: field.description,
            ...(field.default && { default: field.default })
          };
        }
      }
    });
    onSchemaChange(schema);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h6 className="font-medium text-gray-900 dark:text-white">Field Builder</h6>
        <button
          onClick={addField}
          className="bg-accent-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-accent-700 transition-colors flex items-center space-x-1"
        >
          <Plus className="h-4 w-4" />
          <span>Add Field</span>
        </button>
      </div>

      {fields.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg">
          <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-500 dark:text-slate-400">No fields defined yet</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Click "Add Field" to get started</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {fields.map((field, index) => (
            <div key={field.id} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Field Name</label>
                  <input
                    type="text"
                    value={field.name}
                    onChange={(e) => updateField(field.id, 'name', e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded focus:border-accent-500 focus:outline-none bg-white dark:bg-slate-800"
                    placeholder="field_name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Type</label>
                  <select
                    value={field.type === 'object' || field.type === 'array' ? field.type : 'object'}
                    onChange={(e) => updateField(field.id, 'type', e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded focus:border-accent-500 focus:outline-none bg-white dark:bg-slate-800"
                  >
                    <option value="object">Record</option>
                    <option value="array">Array</option>
                  </select>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`required-${field.id}`}
                    checked={field.required}
                    onChange={(e) => updateField(field.id, 'required', e.target.checked)}
                    className="rounded border-gray-300 dark:border-slate-600"
                  />
                  <label htmlFor={`required-${field.id}`} className="text-xs text-gray-700 dark:text-slate-300">Required</label>
                </div>
                <div className="flex items-center justify-end">
                  <button
                    onClick={() => removeField(field.id)}
                    className="text-red-500 hover:text-red-700 p-1 rounded transition-colors"
                    title="Remove field"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Description</label>
                  <input
                    type="text"
                    value={field.description}
                    onChange={(e) => updateField(field.id, 'description', e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded focus:border-accent-500 focus:outline-none bg-white dark:bg-slate-800"
                    placeholder="Field description"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Default Value</label>
                  <input
                    type="text"
                    value={field.default}
                    onChange={(e) => updateField(field.id, 'default', e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded focus:border-accent-500 focus:outline-none bg-white dark:bg-slate-800"
                    placeholder="Default value (optional)"
                  />
                </div>
              </div>

              {field.type === 'array' && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-2">Array Item Type</label>
                      <select
                        value={field.arrayItemType}
                        onChange={(e) => updateField(field.id, 'arrayItemType', e.target.value)}
                        className="px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded focus:border-accent-500 focus:outline-none bg-white dark:bg-slate-800"
                      >
                        <option value="string">String</option>
                        <option value="number">Number</option>
                        <option value="boolean">Boolean</option>
                        <option value="date">Date</option>
                        <option value="object">Object</option>
                      </select>
                    </div>
                    <button
                      onClick={() => addArrayItemField(field.id)}
                      className="bg-accent-600 text-white px-2 py-1 rounded text-xs mt-6 hover:bg-accent-700"
                      title="Add a field to the array item (switches items to objects if needed)"
                    >
                      + Add Item Field
                    </button>
                  </div>
                </div>
              )}

              {/* Nested fields for object and array-of-object */}
              {(field.type === 'object' || (field.type === 'array' && field.arrayItemType === 'object')) && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <h6 className="text-xs font-semibold text-gray-800 dark:text-slate-200">
                      {field.type === 'object' ? 'Object Fields' : 'Array Item Fields'}
                    </h6>
                    <button
                      onClick={() => addNestedField(field.id)}
                      className="bg-accent-600 text-white px-2 py-1 rounded text-xs hover:bg-accent-700"
                    >
                      Add Field
                    </button>
                  </div>
                  {(field.nestedFields || []).length === 0 ? (
                    <div className="text-center py-4 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg text-xs text-gray-500 dark:text-slate-400">
                      No fields yet. Click "Add Field" to define {field.type === 'object' ? 'object properties' : 'array item properties'}.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(field.nestedFields || []).map(nf => (
                        <div key={nf.id} className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded p-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2 items-start">
                            <div>
                              <label className="block text-[10px] font-medium text-gray-700 dark:text-slate-300 mb-1">Name</label>
                              <input
                                type="text"
                                value={nf.name}
                                onChange={(e) => updateNestedField(field.id, nf.id, 'name', e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                                placeholder="subfield_name"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium text-gray-700 dark:text-slate-300 mb-1">Type</label>
                              <select
                                value={nf.type}
                                onChange={(e) => updateNestedField(field.id, nf.id, 'type', e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                              >
                                <option value="string">String</option>
                                <option value="number">Number</option>
                                <option value="boolean">Boolean</option>
                                <option value="date">Date</option>
                                <option value="array">Array</option>
                                <option value="object">Object</option>
                              </select>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`nf-required-${nf.id}`}
                                checked={nf.required}
                                onChange={(e) => updateNestedField(field.id, nf.id, 'required', e.target.checked)}
                                className="rounded border-gray-300 dark:border-slate-600"
                              />
                              <label htmlFor={`nf-required-${nf.id}`} className="text-[10px] text-gray-700 dark:text-slate-300">Required</label>
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium text-gray-700 dark:text-slate-300 mb-1">Description</label>
                              <input
                                type="text"
                                value={nf.description}
                                onChange={(e) => updateNestedField(field.id, nf.id, 'description', e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                                placeholder="Description"
                              />
                            </div>
                            <div className="flex items-center justify-end">
                              <button
                                onClick={() => removeNestedField(field.id, nf.id)}
                                className="text-red-500 hover:text-red-700 p-1 rounded"
                                title="Remove nested field"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <div className="mt-2">
                            <label className="block text-[10px] font-medium text-gray-700 dark:text-slate-300 mb-1">Default</label>
                            <input
                              type="text"
                              value={nf.default}
                              onChange={(e) => updateNestedField(field.id, nf.id, 'default', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                              placeholder="Default value (optional)"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ===== JSON SCHEMA EDITOR COMPONENT =====
const SchemaJsonEditor = ({ schema, onSchemaChange }) => {
  const [jsonText, setJsonText] = useState(JSON.stringify(schema, null, 2));
  const [error, setError] = useState(null);

  useEffect(() => {
    setJsonText(JSON.stringify(schema, null, 2));
    setError(null);
  }, [schema]);

  const handleJsonChange = (value) => {
    setJsonText(value);
    try {
      const parsed = JSON.parse(value);
      onSchemaChange(parsed);
      setError(null);
    } catch (e) {
      setError('Invalid JSON syntax');
    }
  };

  const formatJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const formatted = JSON.stringify(parsed, null, 2);
      setJsonText(formatted);
      onSchemaChange(parsed);
      setError(null);
    } catch (e) {
      setError('Invalid JSON - cannot format');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h6 className="font-medium text-gray-900 dark:text-white">JSON Schema Editor</h6>
        <button
          onClick={formatJson}
          className="bg-gray-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-gray-700 transition-colors"
        >
          Format JSON
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="relative">
        <textarea
          value={jsonText}
          onChange={(e) => handleJsonChange(e.target.value)}
          className={`w-full h-64 p-4 text-sm font-mono border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 ${
            error
              ? 'border-red-300 bg-red-50 dark:bg-red-900/10'
              : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800'
          }`}
          placeholder="Enter your JSON schema here..."
          spellCheck={false}
        />
        <div className="absolute bottom-2 right-2 text-xs text-gray-400">
          {jsonText.split('\n').length} lines
        </div>
      </div>

      <div className="text-xs text-gray-500 dark:text-slate-400">
        💡 Tip: Use the Format JSON button to pretty-print your schema. Make sure your JSON is valid before proceeding.
      </div>
    </div>
  );
};

export default DocTypes;