import React, { useState, useEffect } from 'react';
import { FileText, Plus, Edit, Trash2, TestTube, Save, Copy, Upload, Wand2, Code, Eye, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import api, { apiService } from '../services/api';

const DocTypes = () => {
  const [docTypes, setDocTypes] = useState([]);
  const [templates, setTemplates] = useState({});
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [tenantId, setTenantId] = useState(localStorage.getItem('tenantId') || '1');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // UI mode toggles
  const [schemaMode, setSchemaMode] = useState('builder');
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [showSchemaEditor, setShowSchemaEditor] = useState(false);

  // Form state
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
    }
  });

  // Schema builder state
  const [schemaFields, setSchemaFields] = useState([]);
  const [expandedObjects, setExpandedObjects] = useState(new Set()); // Track which objects are expanded for editing
  const [arrayItemTypes, setArrayItemTypes] = useState({}); // Track array item types

  // Test extraction state
  const [testFile, setTestFile] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [testing, setTesting] = useState(false);
  const [showTestOutput, setShowTestOutput] = useState(false);

  // AI Generator state
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatingSchema, setGeneratingSchema] = useState(false);

  useEffect(() => {
    loadDocTypes();
    loadTemplates();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDocTypes = async () => {
    try {
      if (!tenantId) {
        setMessage('Please set tenant ID first');
        return;
      }
      apiService.setTenantId(tenantId);
      const res = await api.get('/doc-types');
      setDocTypes(res.data || []);
    } catch (e) {
      setMessage('Load error: ' + (e.response?.data?.detail || e.message));
    }
  };

  const loadTemplates = async () => {
    try {
      const res = await api.get('/doc-types/templates');
      setTemplates(res.data || {});
    } catch (e) {
      console.error('Failed to load templates:', e);
    }
  };

  const startWizard = (templateKey = null) => {
    // Reset editing state - wizard is only for creating new types
    setEditingId(null);
    setShowEditModal(false);
    
    if (templateKey && templates[templateKey]) {
      const template = templates[templateKey];
      setFormData({
        name: template.name,
        description: template.description,
        output_schema: template.output_schema,
        instructions: template.instructions,
        hil_instructions: template.hil_instructions
      });
      
      const fields = Object.entries(template.output_schema).map(([name, def]) => {
        const field = {
          id: Math.random(),
          name,
          type: def.type,
          required: def.required || false,
          description: def.description || '',
          default: def.default || '',
          nestedFields: [],
          arrayItemType: 'string'
        };

        // Handle nested object fields
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

        // Handle array item types
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
      setSchemaFields(fields);
      setWizardStep(2);
    } else {
      setWizardStep(1);
    }
    setShowCreateWizard(true);
  };

  const generateSchemaWithAI = async () => {
    if (!aiPrompt.trim()) {
      setMessage('Please describe the document type you want to create');
      return;
    }

    setGeneratingSchema(true);
    try {
      const prompt = aiPrompt.toLowerCase().trim();
      let generatedSchema = {};
      let generatedPrompt = '';
      let docName = '';
      let docDescription = '';

      if (prompt.match(/invoice|bill|billing|vendor/)) {
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
        generatedPrompt = `You are extracting data from business invoices. Extract vendor information including nested contact details, all line items with quantities and prices, monetary amounts, and payment terms. Be extremely precise with numbers - include cents/decimals. Dates should be in YYYY-MM-DD format. For handwritten invoices, pay attention to cursive numbers and varying date formats.`;
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
        generatedPrompt = `You are extracting data from retail receipts. Focus on merchant information, transaction details, and all monetary amounts. Be precise with numbers and include tax calculations. For handwritten receipts, look for amounts in the bottom-right area and dates at the top.`;
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
        generatedPrompt = `You are extracting data from employee expense forms. Extract employee information, multiple expense line items with dates and categories, total amounts, and approval details. For handwritten forms, employee signatures are usually at the bottom. Amounts may be in various formats - handle both $XX.XX and XX.XX formats.`;
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
        generatedPrompt = `You are extracting data from medical prescriptions. Extract patient information, prescription details, medication lists with dosages and instructions, and prescribing doctor information. Be extremely careful with medication names, dosages, and numbers - these must be extracted precisely.`;
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
        generatedPrompt = `You are extracting data from agricultural harvest load sheets. First extract the header details from the top 5 boxes: harvest date, field, acres, shift number, and shake number. Then extract all rows from the load table with columns: load number, ticket number, front trailer, back trailer, and harvest time. Be precise with numbers and times. Look for tabular data that may span multiple rows.`;
      } else if (prompt.match(/table|columns?|rows?|extract.*data.*from/i) && prompt.includes('column')) {
        // Generic table extraction - try to parse column names from the prompt
        const columnMatches = prompt.match(/column.*names?[:\s]*(.*?)(?:\.|$)/i);
        const columns = columnMatches ? 
          columnMatches[1].split(/[,;]|\s+and\s+/).map(col => col.trim().toLowerCase().replace(/\s+/g, '_')) :
          ['column_1', 'column_2', 'column_3'];
        
        docName = 'Table Data Extraction';
        docDescription = 'Generic table data extraction with custom columns';
        
        // Build table schema from detected columns
        const tableProperties = {};
        columns.forEach(col => {
          if (col) {
            tableProperties[col] = {
              "type": "string",
              "required": true,
              "description": `${col.replace(/_/g, ' ')} from the table`
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
            "items": {
              "type": "object",
              "properties": tableProperties
            }
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
        generatedPrompt = `You are extracting tabular data from documents. Look for header information, then extract all rows from the main table with the specified columns. Be precise with data extraction and maintain the structure of the original table. If there are summary totals or additional notes, include those as well.`;
      } else {
        docName = aiPrompt.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        docDescription = `Custom document type: ${aiPrompt}`;
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
        generatedPrompt = `You are extracting structured data from: ${aiPrompt}. Focus on identifying key information, dates, amounts, and relevant details specific to this document type. For handwritten documents, be patient with unclear handwriting and use context clues.`;
      }

      setFormData(prev => ({
        ...prev,
        name: docName,
        description: docDescription,
        output_schema: generatedSchema,
        instructions: {
          prompt: generatedPrompt,
          extraction_hints: []
        }
      }));

      const newFields = Object.entries(generatedSchema).map(([name, def]) => {
        const field = {
          id: Math.random(),
          name,
          type: def.type,
          required: def.required || false,
          description: def.description || '',
          default: def.default || '',
          nestedFields: [],
          arrayItemType: 'string'
        };

        // Handle nested object fields
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

        // Handle array item types
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

      setMessage(`AI generated schema for: ${docName}`);
      setAiPrompt('');
    } catch (e) {
      setMessage('AI generation failed: ' + e.message);
    } finally {
      setGeneratingSchema(false);
    }
  };

  const addSchemaField = () => {
    const newField = {
      id: Math.random(),
      name: 'new_field',
      type: 'string',
      required: false,
      description: '',
      default: '',
      nestedFields: [], // For object types
      arrayItemType: 'string' // For array types
    };
    const updatedFields = [...schemaFields, newField];
    setSchemaFields(updatedFields);
    updateSchemaFromFields(updatedFields);
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

  const addNestedField = (parentFieldId) => {
    const updatedFields = schemaFields.map(field => {
      if (field.id === parentFieldId) {
        const newNestedField = {
          id: Math.random(),
          name: 'nested_field',
          type: 'string',
          required: false,
          description: '',
          default: ''
        };
        return {
          ...field,
          nestedFields: [...(field.nestedFields || []), newNestedField]
        };
      }
      return field;
    });
    setSchemaFields(updatedFields);
    updateSchemaFromFields(updatedFields);
  };

  const updateNestedField = (parentFieldId, nestedFieldId, property, value) => {
    const updatedFields = schemaFields.map(field => {
      if (field.id === parentFieldId) {
        const updatedNestedFields = field.nestedFields.map(nestedField =>
          nestedField.id === nestedFieldId
            ? { ...nestedField, [property]: value }
            : nestedField
        );
        return { ...field, nestedFields: updatedNestedFields };
      }
      return field;
    });
    setSchemaFields(updatedFields);
    updateSchemaFromFields(updatedFields);
  };

  const removeNestedField = (parentFieldId, nestedFieldId) => {
    const updatedFields = schemaFields.map(field => {
      if (field.id === parentFieldId) {
        return {
          ...field,
          nestedFields: field.nestedFields.filter(nestedField => nestedField.id !== nestedFieldId)
        };
      }
      return field;
    });
    setSchemaFields(updatedFields);
    updateSchemaFromFields(updatedFields);
  };

  const toggleObjectExpansion = (fieldId) => {
    const newExpanded = new Set(expandedObjects);
    if (newExpanded.has(fieldId)) {
      newExpanded.delete(fieldId);
    } else {
      newExpanded.add(fieldId);
    }
    setExpandedObjects(newExpanded);
  };

  const validateSchema = (schema) => {
    const errors = [];

    // Check for empty schema
    if (!schema || Object.keys(schema).length === 0) {
      errors.push('Schema cannot be empty');
      return errors;
    }

    // Check each field
    Object.entries(schema).forEach(([fieldName, fieldDef]) => {
      // Check field name
      if (!fieldName || !fieldName.trim()) {
        errors.push('Field name cannot be empty');
      }

      // Check field type
      if (!fieldDef.type) {
        errors.push(`Field '${fieldName}' must have a type`);
      }

      // Validate object fields
      if (fieldDef.type === 'object') {
        if (!fieldDef.properties || Object.keys(fieldDef.properties).length === 0) {
          errors.push(`Object field '${fieldName}' must have properties defined`);
        } else {
          // Recursively validate nested properties
          Object.entries(fieldDef.properties).forEach(([propName, propDef]) => {
            if (!propName || !propName.trim()) {
              errors.push(`Property name in '${fieldName}' cannot be empty`);
            }
            if (!propDef.type) {
              errors.push(`Property '${propName}' in '${fieldName}' must have a type`);
            }
          });
        }
      }

      // Validate array fields
      if (fieldDef.type === 'array') {
        if (!fieldDef.items) {
          errors.push(`Array field '${fieldName}' must specify item type in 'items'`);
        } else if (!fieldDef.items.type) {
          errors.push(`Array field '${fieldName}' items must have a type`);
        }
      }

      // Check description for required fields
      if (fieldDef.required && (!fieldDef.description || !fieldDef.description.trim())) {
        errors.push(`Required field '${fieldName}' should have a description`);
      }
    });

    return errors;
  };

  const updateSchemaFromFields = (fields) => {
    const buildNestedSchema = (nestedFields) => {
      const schema = {};
      nestedFields.forEach(field => {
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

  const createDocType = async () => {
    if (!tenantId) {
      setMessage('Please set tenant ID first');
      return;
    }

    // Validate schema before saving
    const validationErrors = validateSchema(formData.output_schema);
    if (validationErrors.length > 0) {
      setMessage('Schema validation errors: ' + validationErrors.join('; '));
      return;
    }

    setLoading(true);
    try {
      apiService.setTenantId(tenantId);
      const payload = {
        tenant_id: Number(tenantId),
        name: formData.name,
        description: formData.description,
        instructions: formData.instructions,
        output_schema: formData.output_schema
      };

      let response;
      if (editingId) {
        response = await api.put(`/doc-types/${editingId}`, payload);
        setMessage('Updated successfully');
        // If we're in edit modal, close it after successful update
        if (showEditModal) {
          setTimeout(() => closeEditModal(), 1000);
        }
      } else {
        response = await api.post('/doc-types/', payload);
        setMessage('Created successfully');
      }

      if (!editingId && response.data?.id) {
        setEditingId(response.data.id);
      }

      loadDocTypes();
    } catch (e) {
      setMessage('Error: ' + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };

  const editDocType = (docType) => {
    setFormData({
      name: docType.name,
      description: docType.description || '',
      output_schema: docType.output_schema || {},
      instructions: docType.instructions || { prompt: '', extraction_hints: [] },
      hil_instructions: docType.hil_instructions || {
        required_review_fields: [],
        auto_approve_threshold: 0.85,
        require_manual_review: false
      }
    });

    const fields = Object.entries(docType.output_schema || {}).map(([name, def]) => {
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

      // Handle nested object fields
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

      // Handle array item types
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
    setSchemaFields(fields);

    setEditingId(docType.id);
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingId(null);
    setTestFile(null);
    setTestResults(null);
    setShowTestOutput(false);
    setMessage('');
  };

  const deleteDocType = async (id) => {
    if (!window.confirm('Delete this document type?')) return;
    
    try {
      apiService.setTenantId(tenantId);
      await api.delete(`/doc-types/${id}`);
      setMessage('Deleted successfully');
      loadDocTypes();
    } catch (e) {
      setMessage('Delete error: ' + (e.response?.data?.detail || e.message));
    }
  };

  const testExtraction = async () => {
    if (!testFile) {
      setMessage('Please upload a test document');
      return;
    }

    if (!editingId) {
      setMessage('Please save the document type first');
      return;
    }

    setTesting(true);
    try {
      // Read file content as text
      let fileContent;
      
      if (testFile.type.startsWith('text/') || testFile.name.endsWith('.txt')) {
        // For text files, read as text
        fileContent = await readFileAsText(testFile);
      } else if (testFile.type.startsWith('image/')) {
        // For images, we need to convert to base64
        fileContent = await readFileAsBase64(testFile);
      } else {
        // For other files (PDFs, etc.), try to read as text first
        try {
          fileContent = await readFileAsText(testFile);
        } catch (e) {
          // If text reading fails, convert to base64
          fileContent = await readFileAsBase64(testFile);
        }
      }
      
      apiService.setTenantId(tenantId);
      
      const res = await api.post(`/doc-types/${editingId}/test`, {
        sample_text: fileContent
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
        // Remove the data URL prefix to get just the base64 string
        const base64 = e.target.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const resetWizard = () => {
    setFormData({
      name: '',
      description: '',
      output_schema: {},
      instructions: { prompt: '', extraction_hints: [] },
      hil_instructions: {
        required_review_fields: [],
        auto_approve_threshold: 0.85,
        require_manual_review: false
      }
    });
    setSchemaFields([]);
    setExpandedObjects(new Set());
    setArrayItemTypes({});
    setEditingId(null);
    setShowCreateWizard(false);
    setWizardStep(1);
    setTestResults(null);
    setTestFile(null);
    setShowTestOutput(false);
    setSchemaMode('builder');
  };

  const toggleHilField = (fieldName) => {
    const current = formData.hil_instructions.required_review_fields || [];
    const updated = current.includes(fieldName) 
      ? current.filter(f => f !== fieldName)
      : [...current, fieldName];
    
    setFormData(prev => ({
      ...prev,
      hil_instructions: {
        ...prev.hil_instructions,
        required_review_fields: updated
      }
    }));
  };

  const canProceedToStep = (step) => {
    switch (step) {
      case 2:
        return formData.name.trim() && formData.description.trim();
      case 3:
        return Object.keys(formData.output_schema).length > 0 && formData.instructions.prompt.trim();
      case 4:
        return true;
      default:
        return true;
    }
  };

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
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full border-2 border-gray-300 dark:border-slate-600 p-3 rounded-lg focus:border-accent-500 focus:outline-none"
                  placeholder="e.g., Custom Invoice, Medical Form"
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

              <div className="text-center">
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">Or let AI create everything for you</p>
                <button
                  onClick={() => setShowAIGenerator(true)}
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
              <div className="flex items-center space-x-3 mb-4">
                <Wand2 className="h-6 w-6 text-purple-600" />
                <h4 className="text-lg font-semibold text-purple-800">AI Schema Generator</h4>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium mb-2 text-purple-700">Describe Your Document Type</label>
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="w-full border-2 border-purple-300 p-3 rounded-lg h-24 focus:border-purple-500 focus:outline-none"
                    placeholder="e.g., 'Medical prescription with patient info, medication details, and dosage' or 'Employee expense report for travel reimbursements'"
                  />
                  <p className="text-xs text-purple-600 mt-1">
                    💡 Be specific about fields, amounts, dates, and categories you want to extract
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

            {/* Schema Editor */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Output Fields</h4>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowSchemaEditor(true)}
                    className="bg-accent-600 text-white px-6 py-3 rounded-lg flex items-center space-x-2 hover:bg-accent-700 transition-colors shadow-lg"
                  >
                    <Code className="h-5 w-5" />
                    <span>Open Schema Editor</span>
                  </button>
                </div>
              </div>

              {/* Schema Summary */}
              <div className="bg-gray-50 dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-lg p-6">
                {schemaFields.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-accent-100 dark:bg-accent-900 rounded-lg flex items-center justify-center">
                          <FileText className="h-4 w-4 text-accent-600 dark:text-accent-400" />
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900 dark:text-white">Schema Defined</h5>
                          <p className="text-sm text-gray-600 dark:text-slate-300">{schemaFields.length} fields configured</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500 dark:text-slate-400">Field Types</div>
                        <div className="flex space-x-2 mt-1">
                          {[...new Set(schemaFields.map(f => f.type))].map(type => (
                            <span key={type} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-accent-100 dark:bg-accent-900 text-accent-800 dark:text-accent-200">
                              {type === 'string' && '📝'} 
                              {type === 'number' && '🔢'} 
                              {type === 'date' && '📅'} 
                              {type === 'boolean' && '☑️'} 
                              {type === 'object' && '📦'} 
                              {type === 'array' && '📋'} 
                              {type}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {schemaFields.slice(0, 4).map(field => (
                        <div key={field.id} className="bg-white border border-gray-200 dark:border-slate-700 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm text-gray-900 dark:text-white">{field.name}</span>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              field.required ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
                            }`}>
                              {field.required ? 'Required' : 'Optional'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">{field.description}</div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-medium text-accent-600 dark:text-accent-400">{field.type}</span>
                            {field.type === 'array' && (
                              <span className="text-xs text-gray-500 dark:text-slate-400">of {field.arrayItemType}</span>
                            )}
                            {(field.nestedFields || []).length > 0 && (
                              <span className="text-xs text-green-600">
                                {field.nestedFields.length} nested fields
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {schemaFields.length > 4 && (
                      <div className="text-center py-2">
                        <span className="text-sm text-gray-500 dark:text-slate-400">
                          +{schemaFields.length - 4} more fields...
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto mb-3 text-gray-500 dark:text-slate-400" />
                    <h5 className="font-semibold text-gray-900 dark:text-white mb-1">No Schema Defined</h5>
                    <p className="text-sm text-gray-600 dark:text-slate-300 mb-4">Open the schema editor to define your extraction fields</p>
                    <button
                      onClick={() => setShowSchemaEditor(true)}
                      className="bg-accent-600 text-white px-4 py-2 rounded-lg hover:bg-accent-700 transition-colors"
                    >
                      Get Started
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Extraction Instructions Section */}
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
                      Provide specific instructions to help AI extract data accurately, especially for handwritten documents, 
                      unusual layouts, or documents with special formatting requirements.
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
                    placeholder="Example: 'Extract data from handwritten expense forms. Look for employee signature at bottom-right. Amounts may be written in cursive. Date format varies - could be MM/DD/YY or DD/MM/YYYY. If expense category is unclear, classify as 'Other'.'"
                  />
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-yellow-700">
                    <div>
                      <strong>💡 Tips for better extraction:</strong>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>Mention handwriting challenges</li>
                        <li>Specify date/number formats</li>
                        <li>Note field locations on document</li>
                      </ul>
                    </div>
                    <div>
                      <strong>📝 For handwritten documents:</strong>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>Describe typical writing styles</li>
                        <li>Mention common abbreviations</li>
                        <li>Handle unclear or missing data</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Review Settings</h3>
              <p className="text-gray-600 dark:text-slate-300">Configure human review requirements</p>
            </div>

            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-gray-50 dark:bg-slate-800 p-6 rounded-lg">
                <label className="block text-sm font-medium mb-3">Auto-Approval Confidence</label>
                <div className="space-y-2">
                  <input
                    type="range"
                    min="0.5"
                    max="1.0"
                    step="0.05"
                    value={formData.hil_instructions.auto_approve_threshold}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      hil_instructions: {
                        ...prev.hil_instructions,
                        auto_approve_threshold: parseFloat(e.target.value)
                      }
                    }))}
                    className="w-full h-2 bg-gray-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400">
                    <span>Conservative (50%)</span>
                    <span className="font-semibold text-accent-600 dark:text-accent-400">
                      {Math.round(formData.hil_instructions.auto_approve_threshold * 100)}% Confidence
                    </span>
                    <span>Aggressive (100%)</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-slate-800 p-6 rounded-lg">
                <label className="flex items-center space-x-3 text-sm font-medium mb-4">
                  <input
                    type="checkbox"
                    checked={formData.hil_instructions.require_manual_review}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      hil_instructions: {
                        ...prev.hil_instructions,
                        require_manual_review: e.target.checked
                      }
                    }))}
                    className="h-5 w-5 text-accent-600 dark:text-accent-400 rounded focus:ring-accent-500"
                  />
                  <span>Always require manual review (overrides confidence threshold)</span>
                </label>

                <div>
                  <label className="block text-sm font-medium mb-3">Fields Requiring Manual Review</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.keys(formData.output_schema).map(fieldName => (
                      <label key={fieldName} className="flex items-center space-x-2 text-sm bg-white p-2 rounded border">
                        <input
                          type="checkbox"
                          checked={formData.hil_instructions.required_review_fields.includes(fieldName)}
                          onChange={() => toggleHilField(fieldName)}
                          className="h-4 w-4 text-accent-600 dark:text-accent-400 rounded focus:ring-accent-500"
                        />
                        <span>{fieldName}</span>
                      </label>
                    ))}
                  </div>
                  {Object.keys(formData.output_schema).length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-slate-400 italic">Define output fields first to configure review settings</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-accent-100 dark:bg-accent-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <TestTube className="h-8 w-8 text-accent-600 dark:text-accent-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Test Your Extraction</h3>
              <p className="text-gray-600 dark:text-slate-300">Upload a sample document to test your schema</p>
            </div>

            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-6">
                <h4 className="font-semibold mb-3 text-purple-800">Test Your Extraction</h4>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Upload Test Document</label>
                    <div className="border-2 border-dashed border-purple-300 rounded-lg p-6 text-center bg-white">
                      <input
                        type="file"
                        onChange={(e) => setTestFile(e.target.files[0])}
                        className="hidden"
                        id="test-file-upload"
                        accept=".txt,.pdf,.doc,.docx,.jpg,.png"
                      />
                      <label htmlFor="test-file-upload" className="cursor-pointer">
                        <Upload className="h-12 w-12 mx-auto mb-3 text-purple-400" />
                        <p className="text-sm text-gray-900 dark:text-white font-medium">
                          {testFile ? `📄 ${testFile.name}` : 'Click to upload test document'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                          PDF, images, text files supported
                        </p>
                      </label>
                    </div>
                  </div>

                  <button
                    onClick={testExtraction}
                    disabled={testing || !testFile}
                    className="w-full bg-purple-600 text-white py-3 rounded-lg flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-700 transition-colors"
                  >
                    <TestTube className="h-5 w-5" />
                    <span>{testing ? 'Testing Extraction...' : 'Test Extraction'}</span>
                  </button>
                </div>
              </div>

              <div className="bg-yellow-50 border-2 border-yellow-200 dark:bg-yellow-900 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white font-bold text-xs">!</span>
                  </div>
                  <div>
                    <p className="text-sm text-yellow-800">
                      <strong>Note:</strong> You can configure webhook endpoints and other integrations after saving the document type.
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
              onClick={() => startWizard()}
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

        {message && (
          <div className="bg-blue-50 dark:bg-slate-800 border-l-4 border-blue-500 dark:border-blue-400 text-blue-700 dark:text-slate-200 p-4 rounded-lg mb-8">
            {message}
          </div>
        )}

        {/* AI Generator Modal */}
        {showAIGenerator && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl max-w-lg w-full mx-4 shadow-2xl">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-accent-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wand2 className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">AI Schema Generator</h3>
                <p className="text-gray-600 dark:text-slate-300">Describe your document type and let AI create the perfect schema</p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-slate-200">Document Description</label>
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="w-full border-2 border-gray-300 dark:border-slate-600 p-3 rounded-lg h-32 focus:border-accent-500 focus:outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    placeholder="e.g., 'Medical prescription with patient information, medication details, and dosage instructions' or 'Employee expense report for travel reimbursements'"
                  />
                </div>
                
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-purple-700">
                    <strong>💡 Tip:</strong> Be specific! Mention key information like amounts, dates, people, or categories you want to extract.
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowAIGenerator(false)}
                  className="border-2 border-gray-300 dark:border-slate-600 px-6 py-2 rounded-lg hover:bg-gray-50 dark:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={generateSchemaWithAI}
                  disabled={generatingSchema || !aiPrompt.trim()}
                  className="bg-gradient-to-r from-purple-600 to-accent-600 text-white px-6 py-2 rounded-lg flex items-center space-x-2 disabled:opacity-50 hover:from-purple-700 hover:to-accent-700 transition-all"
                >
                  <Wand2 className="h-4 w-4" />
                  <span>{generatingSchema ? 'Generating...' : 'Generate Schema'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Creation Wizard */}
        {showCreateWizard && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Progress Bar */}
            <div className="bg-slate-50 dark:bg-slate-900 px-8 py-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Step {wizardStep} of 4
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Creating: {formData.name || 'New Document Type'}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div 
                  className="bg-slate-700 dark:bg-slate-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(wizardStep / 4) * 100}%` }}
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
                onClick={() => wizardStep > 1 ? setWizardStep(wizardStep - 1) : resetWizard()}
                className="flex items-center space-x-2 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>{wizardStep > 1 ? 'Previous' : 'Cancel'}</span>
              </button>

              <div className="flex space-x-3">
                {wizardStep < 4 ? (
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
                    <span>{loading ? 'Saving...' : (editingId ? 'Update Type' : 'Create Type')}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-accent-600 px-8 py-6 border-b border-gray-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Edit Document Type</h2>
                    <p className="text-blue-100 mt-1">Modify settings for "{formData.name}"</p>
                  </div>
                  <button
                    onClick={closeEditModal}
                    className="text-white hover:text-slate-300 transition-colors"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-8 overflow-y-auto max-h-[calc(90vh-140px)]">
                <div className="space-y-8">
                  {/* Basic Information */}
                  <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center text-gray-900 dark:text-white">
                      <FileText className="h-5 w-5 mr-2 text-blue-600 dark:text-accent-400" />
                      Basic Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">Document Type Name</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
                          placeholder="e.g., Purchase Receipt"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">Description</label>
                        <input
                          type="text"
                          value={formData.description}
                          onChange={(e) => setFormData({...formData, description: e.target.value})}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
                          placeholder="Brief description of this document type"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Extraction Instructions */}
                  <div className="bg-gradient-to-r from-blue-50 to-accent-50 dark:bg-slate-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center text-gray-900 dark:text-white">
                      <Wand2 className="h-5 w-5 mr-2 text-blue-600 dark:text-accent-400" />
                      Extraction Instructions
                    </h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">AI Extraction Prompt</label>
                      <textarea
                        value={formData.instructions?.prompt || ''}
                        onChange={(e) => setFormData({
                          ...formData, 
                          instructions: {...formData.instructions, prompt: e.target.value}
                        })}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
                        rows={4}
                        placeholder="Provide specific instructions for AI extraction. For example: 'Focus on merchant information, transaction details, and monetary amounts. Be precise with numbers and include tax calculations.'"
                      />
                    </div>
                  </div>

                  {/* AI Schema Generator */}
                  <div className="bg-gradient-to-r from-purple-50 to-accent-50 dark:bg-slate-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center text-gray-900 dark:text-white">
                      <Wand2 className="h-5 w-5 mr-2 text-purple-600 dark:text-accent-400" />
                      AI Schema Generator
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                          Describe what data you want to extract
                        </label>
                        <textarea
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          rows={3}
                          placeholder="e.g., 'Extract merchant name, date, total amount, tax, and line items from receipts'"
                        />
                      </div>
                      <button
                        onClick={generateSchemaWithAI}
                        disabled={!aiPrompt.trim() || generatingSchema}
                        className="bg-purple-600 text-white px-6 py-3 rounded-lg flex items-center space-x-2 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Wand2 className="h-4 w-4" />
                        <span>{generatingSchema ? 'Generating...' : 'Generate Schema'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Schema Fields */}
                  <div className="bg-green-50 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold flex items-center">
                        <Code className="h-5 w-5 mr-2 text-green-600" />
                        Data Fields ({schemaFields.length})
                      </h3>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setSchemaMode('builder')}
                          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                            schemaMode === 'builder' 
                              ? 'bg-green-600 text-white' 
                              : 'bg-white text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:bg-slate-800'
                          }`}
                        >
                          Builder
                        </button>
                        <button
                          onClick={() => setSchemaMode('editor')}
                          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                            schemaMode === 'editor' 
                              ? 'bg-green-600 text-white' 
                              : 'bg-white text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:bg-slate-800'
                          }`}
                        >
                          JSON Editor
                        </button>
                      </div>
                    </div>
                    {schemaMode === 'builder' ? (
                      <div className="space-y-4 max-h-60 overflow-y-auto">
                        {schemaFields.map((field) => (
                          <div key={field.id} className="bg-white rounded-lg p-4 border border-gray-200 dark:border-slate-700">
                            <div className="flex items-start justify-between mb-3">
                              <h4 className="font-medium text-gray-900 dark:text-white">{field.name || 'Untitled Field'}</h4>
                              <button
                                onClick={() => removeSchemaField(field.id)}
                                className="text-red-500 hover:text-red-700 transition-colors"
                                title="Remove field"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1">Field Name</label>
                                <input
                                  type="text"
                                  value={field.name}
                                  onChange={(e) => updateSchemaField(field.id, 'name', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1">Type</label>
                                <select
                                  value={field.type}
                                  onChange={(e) => updateSchemaField(field.id, 'type', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm"
                                >
                                  <option value="string">Text</option>
                                  <option value="number">Number</option>
                                  <option value="date">Date</option>
                                  <option value="boolean">Yes/No</option>
                                  <option value="array">List</option>
                                  <option value="object">Object</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1">Required</label>
                                <input
                                  type="checkbox"
                                  checked={field.required}
                                  onChange={(e) => updateSchemaField(field.id, 'required', e.target.checked)}
                                  className="mt-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-slate-600 rounded"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1">Description</label>
                                <input
                                  type="text"
                                  value={field.description}
                                  onChange={(e) => updateSchemaField(field.id, 'description', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm"
                                  placeholder="Field description"
                                />
                              </div>
                            </div>

                            {/* Array Item Type */}
                            {field.type === 'array' && (
                              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1">Array Item Type</label>
                                  <select
                                    value={field.arrayItemType}
                                    onChange={(e) => updateSchemaField(field.id, 'arrayItemType', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm"
                                  >
                                    <option value="string">Text</option>
                                    <option value="number">Number</option>
                                    <option value="object">Object</option>
                                  </select>
                                </div>
                              </div>
                            )}

                            {/* Nested Object Fields */}
                            {(field.type === 'object' || (field.type === 'array' && field.arrayItemType === 'object')) && (
                              <div className="mt-4">
                                <div className="flex items-center justify-between mb-2">
                                  <label className="block text-sm font-medium text-gray-600 dark:text-slate-300">
                                    {field.type === 'object' ? 'Object Properties' : 'Array Item Properties'}
                                  </label>
                                  <button
                                    onClick={() => addNestedField(field.id)}
                                    className="text-sm text-green-600 hover:text-green-700 flex items-center space-x-1"
                                  >
                                    <Plus className="h-3 w-3" />
                                    <span>Add Property</span>
                                  </button>
                                </div>
                                <div className="space-y-2 pl-4 border-l-2 border-gray-200 dark:border-slate-700">
                                  {field.nestedFields?.map((nestedField) => (
                                    <div key={nestedField.id} className="bg-gray-50 dark:bg-slate-800 rounded-md p-3">
                                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                                        <input
                                          type="text"
                                          value={nestedField.name}
                                          onChange={(e) => updateNestedField(field.id, nestedField.id, 'name', e.target.value)}
                                          className="px-2 py-1 border border-gray-300 dark:border-slate-600 rounded text-sm"
                                          placeholder="Property name"
                                        />
                                        <select
                                          value={nestedField.type}
                                          onChange={(e) => updateNestedField(field.id, nestedField.id, 'type', e.target.value)}
                                          className="px-2 py-1 border border-gray-300 dark:border-slate-600 rounded text-sm"
                                        >
                                          <option value="string">Text</option>
                                          <option value="number">Number</option>
                                          <option value="date">Date</option>
                                          <option value="boolean">Yes/No</option>
                                        </select>
                                        <input
                                          type="text"
                                          value={nestedField.description}
                                          onChange={(e) => updateNestedField(field.id, nestedField.id, 'description', e.target.value)}
                                          className="px-2 py-1 border border-gray-300 dark:border-slate-600 rounded text-sm"
                                          placeholder="Description"
                                        />
                                        <button
                                          onClick={() => removeNestedField(field.id, nestedField.id)}
                                          className="text-red-500 hover:text-red-700 transition-colors"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={addSchemaField}
                          className="w-full border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-4 text-gray-500 dark:text-slate-400 hover:border-gray-400 hover:text-gray-600 dark:text-slate-300 transition-colors"
                        >
                          <Plus className="h-5 w-5 mx-auto mb-2" />
                          Add Field
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">JSON Schema</label>
                          <textarea
                            value={JSON.stringify(formData.output_schema, null, 2)}
                            onChange={(e) => {
                              try {
                                const parsed = JSON.parse(e.target.value);
                                setFormData({...formData, output_schema: parsed});
                                // Sync with schema fields
                                const fields = Object.entries(parsed).map(([name, def]) => ({
                                  id: Math.random(),
                                  name,
                                  type: def.type || 'string',
                                  required: def.required || false,
                                  description: def.description || '',
                                  default: def.default || '',
                                  nestedFields: [],
                                  arrayItemType: 'string'
                                }));
                                setSchemaFields(fields);
                              } catch (err) {
                                // Invalid JSON, don't update
                              }
                            }}
                            className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-sm"
                            rows={12}
                            placeholder="Enter JSON schema..."
                          />
                        </div>
                        <div className="text-sm text-gray-600 dark:text-slate-300">
                          <p className="font-medium mb-1">Example schema format:</p>
                          <pre className="bg-gray-100 dark:bg-slate-700 p-2 rounded text-xs overflow-x-auto">
{`{
  "field_name": {
    "type": "string",
    "required": true,
    "description": "Field description"
  }
}`}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Test Section */}
                  <div className="bg-orange-50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <TestTube className="h-5 w-5 mr-2 text-orange-600" />
                      Test Extraction
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">Upload Test Document</label>
                        <input
                          type="file"
                          onChange={(e) => setTestFile(e.target.files[0])}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          accept="image/*,.pdf,.txt"
                        />
                      </div>
                      <button
                        onClick={testExtraction}
                        disabled={!testFile || testing}
                        className="bg-orange-600 text-white px-6 py-3 rounded-lg flex items-center space-x-2 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <TestTube className="h-4 w-4" />
                        <span>{testing ? 'Testing...' : 'Test Extraction'}</span>
                      </button>
                    </div>

                    {/* Test Results */}
                    {showTestOutput && testResults && (
                      <div className="mt-6 p-4 bg-white rounded-lg border border-orange-200">
                        <h4 className="font-semibold mb-3">Test Results:</h4>
                        {testResults.error ? (
                          <div className="text-red-600">
                            <p className="font-medium">Error:</p>
                            <p className="text-sm">{testResults.error}</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {Object.entries(testResults.extracted_fields || {}).map(([field, data]) => (
                              <div key={field} className="flex justify-between items-center py-2 border-b border-gray-100">
                                <span className="font-medium text-gray-900 dark:text-white">{field}:</span>
                                <div className="text-right">
                                  <span className="text-gray-900 dark:text-white">{data.value || 'null'}</span>
                                  <span className="text-sm text-gray-500 dark:text-slate-400 ml-2">
                                    ({Math.round(data.confidence * 100)}% confident)
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 dark:bg-slate-800 px-8 py-6 border-t border-gray-200 dark:border-slate-700 flex justify-between">
                <button
                  onClick={closeEditModal}
                  className="px-6 py-3 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white hover:bg-gray-50 dark:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    createDocType().then(() => {
                      if (!loading) {
                        closeEditModal();
                      }
                    });
                  }}
                  disabled={loading}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-lg flex items-center space-x-2 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                >
                  <Save className="h-4 w-4" />
                  <span>{loading ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Templates (when not in wizard) */}
        {!showCreateWizard && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-8 mb-8">
            <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">Quick Start Templates</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Object.entries(templates).map(([key, template]) => (
                <div key={key} className="group border-2 border-gray-200 dark:border-slate-700 rounded-xl p-6 hover:border-accent-400 hover:shadow-lg transition-all cursor-pointer bg-gray-50 dark:bg-slate-700 hover:bg-white dark:hover:bg-slate-600">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-accent-500 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <FileText className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">{template.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-slate-300 mb-4">{template.description}</p>
                    <button
                      onClick={() => startWizard(key)}
                      className="bg-gradient-to-r from-blue-600 to-accent-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 mx-auto hover:from-blue-700 hover:to-accent-700 transition-colors"
                    >
                      <Copy className="h-4 w-4" />
                      <span>Use Template</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Existing Doc Types */}
        {!showCreateWizard && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-8">
            <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">Your Document Types</h2>
            {docTypes.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-accent-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-10 w-10 text-blue-600 dark:text-accent-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No document types yet</h3>
                <p className="text-gray-600 dark:text-slate-300 mb-6">Create your first document type to start extracting data</p>
                <button
                  onClick={() => startWizard()}
                  className="bg-gradient-to-r from-blue-600 to-accent-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-accent-700 transition-colors"
                >
                  Create Your First Type
                </button>
              </div>
            ) : (
              <div className="grid gap-6">
                {docTypes.map(docType => (
                  <div key={docType.id} className="border border-gray-200 dark:border-slate-700 rounded-xl p-6 hover:shadow-lg transition-all bg-gray-50 dark:bg-slate-700 hover:bg-white dark:hover:bg-slate-600">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-accent-100 dark:bg-accent-900 rounded-lg flex items-center justify-center">
                            <FileText className="h-5 w-5 text-blue-600 dark:text-accent-400" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{docType.name}</h3>
                            <p className="text-sm text-gray-600 dark:text-slate-300">{docType.description}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
                            <div className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-1">Fields</div>
                            <div className="text-lg font-bold text-accent-600 dark:text-accent-400">{Object.keys(docType.output_schema || {}).length}</div>
                          </div>
                          <div className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
                            <div className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-1">Status</div>
                            <div className="text-sm font-medium text-green-600">
                              ✓ Active
                            </div>
                          </div>
                          <div className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
                            <div className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-1">Created</div>
                            <div className="text-sm text-gray-600 dark:text-slate-300">{new Date(docType.created_at).toLocaleDateString()}</div>
                          </div>
                        </div>

                        {Object.keys(docType.output_schema || {}).length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-2">Output Fields</div>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(docType.output_schema || {}).slice(0, 6).map(([name, def]) => (
                                <span
                                  key={name}
                                  className={`text-xs px-3 py-1 rounded-full font-medium ${
                                    def.required 
                                      ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 border border-red-200' 
                                      : 'bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white border border-gray-200 dark:border-slate-700'
                                  }`}
                                >
                                  {name} ({def.type})
                                </span>
                              ))}
                              {Object.keys(docType.output_schema || {}).length > 6 && (
                                <span className="text-xs px-3 py-1 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400">
                                  +{Object.keys(docType.output_schema).length - 6} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex space-x-2 ml-6">
                        <button
                          onClick={() => editDocType(docType)}
                          className="text-blue-600 dark:text-accent-400 hover:text-blue-800 dark:hover:text-accent-200 hover:bg-blue-50 dark:hover:bg-slate-600 p-2 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => deleteDocType(docType.id)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-slate-600 p-2 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Test Results Modal */}
        {showTestOutput && testResults && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden shadow-2xl">
              <div className="bg-gradient-to-r from-purple-600 to-accent-600 text-white p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <TestTube className="h-6 w-6" />
                    <h3 className="text-xl font-semibold">Extraction Test Results</h3>
                  </div>
                  <button
                    onClick={() => setShowTestOutput(false)}
                    className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-96">
                {testResults.test_status === 'success' ? (
                  <div className="space-y-6">
                    {Object.keys(testResults.extracted_fields || {}).length > 0 ? (
                      <>
                        <div className="flex items-center space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                          <CheckCircle className="h-6 w-6 text-green-600" />
                          <div>
                            <div className="font-semibold text-green-800">Extraction Successful!</div>
                            <div className="text-sm text-green-600">
                              Found {Object.keys(testResults.extracted_fields).length} fields in your document
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-semibold mb-3 text-gray-900 dark:text-white">📄 Extracted JSON Output</h4>
                          <div className="bg-gray-900 rounded-lg p-4 overflow-auto">
                            <pre className="text-green-400 text-sm font-mono">
{JSON.stringify(testResults.extracted_fields, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center space-x-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-bold text-sm">!</span>
                          </div>
                          <div>
                            <div className="font-semibold text-yellow-800">No Data Extracted</div>
                            <div className="text-sm text-yellow-700">
                              The extraction completed but no fields were found in your document
                            </div>
                          </div>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <h5 className="font-semibold text-accent-800 dark:text-accent-200 mb-2">💡 Possible Solutions:</h5>
                          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                            <li>Make sure your test document matches the document type you created</li>
                            <li>Check that your extraction instructions are specific enough</li>
                            <li>Try with a clearer, higher-quality document</li>
                            <li>For load sheets, ensure the document has the header fields and table data</li>
                          </ul>
                        </div>

                        <div>
                          <h4 className="font-semibold mb-3 text-gray-900 dark:text-white">📄 Raw Response</h4>
                          <div className="bg-gray-900 rounded-lg p-4 overflow-auto">
                            <pre className="text-gray-400 text-sm font-mono">
{JSON.stringify(testResults.extracted_fields || {}, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}

                    {testResults.schema_compliance && (
                      <div>
                        <h4 className="font-semibold mb-3 text-gray-900 dark:text-white">✅ Schema Validation</h4>
                        <div className={`p-4 rounded-lg border-2 ${
                          testResults.schema_compliance.valid 
                            ? 'bg-green-50 border-green-200 text-green-800' 
                            : 'bg-orange-50 border-orange-200 text-orange-800'
                        }`}>
                          {testResults.schema_compliance.valid ? (
                            <div className="flex items-center space-x-2">
                              <CheckCircle className="h-5 w-5 text-green-600" />
                              <span className="font-medium">All required fields extracted successfully</span>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="font-medium">⚠️ Schema validation issues found:</div>
                              {testResults.schema_compliance.missing_required.length > 0 && (
                                <div className="text-sm">
                                  <strong>Missing required fields:</strong> {testResults.schema_compliance.missing_required.join(', ')}
                                </div>
                              )}
                              {testResults.schema_compliance.type_mismatches.length > 0 && (
                                <div className="text-sm">
                                  <strong>Type mismatches:</strong> {testResults.schema_compliance.type_mismatches.join(', ')}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-red-600 text-2xl">⚠</span>
                    </div>
                    <h4 className="font-semibold text-red-800 mb-2">Extraction Failed</h4>
                    <div className="text-sm bg-red-50 p-4 rounded-lg border border-red-200 max-w-md mx-auto">
                      {testResults.error}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Schema Editor Modal */}
        {showSchemaEditor && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Code className="h-6 w-6" />
                    <h3 className="text-xl font-semibold">Schema Editor</h3>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex border border-white/30 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setSchemaMode('builder')}
                        className={`px-4 py-2 flex items-center space-x-2 transition-all ${
                          schemaMode === 'builder' 
                            ? 'bg-white text-accent-600 dark:text-accent-400' 
                            : 'text-white hover:bg-white/20'
                        }`}
                      >
                        <Eye className="h-4 w-4" />
                        <span>Visual Builder</span>
                      </button>
                      <button
                        onClick={() => setSchemaMode('json')}
                        className={`px-4 py-2 flex items-center space-x-2 transition-all ${
                          schemaMode === 'json' 
                            ? 'bg-white text-accent-600 dark:text-accent-400' 
                            : 'text-white hover:bg-white/20'
                        }`}
                      >
                        <Code className="h-4 w-4" />
                        <span>JSON Editor</span>
                      </button>
                    </div>
                    <button
                      onClick={() => setShowSchemaEditor(false)}
                      className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                {schemaMode === 'builder' ? (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Output Fields</h4>
                        <p className="text-sm text-gray-600 dark:text-slate-300">Define the fields to extract from your documents</p>
                      </div>
                      <button
                        onClick={addSchemaField}
                        className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-lg flex items-center space-x-2 hover:from-green-700 hover:to-emerald-700 transition-colors shadow-lg"
                      >
                        <Plus className="h-5 w-5" />
                        <span>Add Field</span>
                      </button>
                    </div>

                    <div className="grid gap-6">
                      {schemaFields.map(field => (
                        <div key={field.id} className="bg-gray-50 dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-xl p-6 hover:border-gray-300 dark:border-slate-600 transition-colors">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-4">
                            <div>
                              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Field Name</label>
                              <input
                                value={field.name}
                                onChange={(e) => updateSchemaField(field.id, 'name', e.target.value)}
                                className="w-full border-2 border-gray-300 dark:border-slate-600 p-3 rounded-lg focus:border-accent-500 focus:outline-none"
                                placeholder="field_name"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Data Type</label>
                              <select
                                value={field.type}
                                onChange={(e) => updateSchemaField(field.id, 'type', e.target.value)}
                                className="w-full border-2 border-gray-300 dark:border-slate-600 p-3 rounded-lg focus:border-accent-500 focus:outline-none"
                              >
                                <option value="string">📝 Text</option>
                                <option value="number">🔢 Number</option>
                                <option value="date">📅 Date</option>
                                <option value="boolean">☑️ Yes/No</option>
                                <option value="object">📦 Object</option>
                                <option value="array">📋 List</option>
                              </select>
                            </div>
                            <div className="flex items-end">
                              <button
                                onClick={() => removeSchemaField(field.id)}
                                className="w-full bg-red-500 text-white p-3 rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center space-x-2"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span>Remove</span>
                              </button>
                            </div>
                          </div>
                          
                          <div className="mb-4">
                            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Description</label>
                            <input
                              value={field.description}
                              onChange={(e) => updateSchemaField(field.id, 'description', e.target.value)}
                              className="w-full border-2 border-gray-300 dark:border-slate-600 p-3 rounded-lg focus:border-accent-500 focus:outline-none"
                              placeholder="What this field represents..."
                            />
                          </div>

                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-6">
                              <label className="flex items-center space-x-3">
                                <input
                                  type="checkbox"
                                  checked={field.required}
                                  onChange={(e) => updateSchemaField(field.id, 'required', e.target.checked)}
                                  className="h-5 w-5 text-accent-600 dark:text-accent-400 rounded focus:ring-accent-500"
                                />
                                <span className={`font-medium ${field.required ? 'text-red-600' : 'text-gray-600 dark:text-slate-300'}`}>
                                  {field.required ? '🔴 Required Field' : '⚪ Optional Field'}
                                </span>
                              </label>
                              
                              {field.type === 'string' && (
                                <div className="flex items-center space-x-2">
                                  <label className="text-sm text-gray-600 dark:text-slate-300">Default Value:</label>
                                  <input
                                    value={field.default}
                                    onChange={(e) => updateSchemaField(field.id, 'default', e.target.value)}
                                    className="border border-gray-300 dark:border-slate-600 p-2 rounded text-sm w-24"
                                    placeholder="USD"
                                  />
                                </div>
                              )}
                              
                              {field.type === 'array' && (
                                <div className="flex items-center space-x-2">
                                  <label className="text-sm text-gray-600 dark:text-slate-300">Array Item Type:</label>
                                  <select
                                    value={field.arrayItemType || 'string'}
                                    onChange={(e) => updateSchemaField(field.id, 'arrayItemType', e.target.value)}
                                    className="border border-gray-300 dark:border-slate-600 p-2 rounded text-sm"
                                  >
                                    <option value="string">Text</option>
                                    <option value="number">Number</option>
                                    <option value="date">Date</option>
                                    <option value="boolean">Yes/No</option>
                                    <option value="object">Object</option>
                                  </select>
                                </div>
                              )}
                            </div>

                            {(field.type === 'object' || (field.type === 'array' && field.arrayItemType === 'object')) && (
                              <button
                                onClick={() => toggleObjectExpansion(field.id)}
                                className="bg-accent-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-accent-700 transition-colors"
                              >
                                {expandedObjects.has(field.id) ? '▼ Collapse' : '▶ Expand'} 
                                {field.type === 'object' ? ' Fields' : ' Item Schema'}
                              </button>
                            )}
                          </div>

                          {/* Nested Fields Editor */}
                          {(field.type === 'object' || (field.type === 'array' && field.arrayItemType === 'object')) && expandedObjects.has(field.id) && (
                            <div className="mt-6 p-6 bg-blue-50 border-2 border-blue-200 rounded-xl">
                              <div className="flex items-center justify-between mb-4">
                                <h5 className="text-lg font-medium text-accent-800 dark:text-accent-200">
                                  {field.type === 'object' ? 'Object Properties' : 'Array Item Properties'}
                                </h5>
                                <button
                                  onClick={() => addNestedField(field.id)}
                                  className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:from-green-700 hover:to-emerald-700 transition-colors"
                                >
                                  <Plus className="h-4 w-4" />
                                  <span>Add Property</span>
                                </button>
                              </div>

                              <div className="space-y-4">
                                {(field.nestedFields || []).map(nestedField => (
                                  <div key={nestedField.id} className="bg-white border border-blue-200 rounded-lg p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                                      <div>
                                        <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1">Property Name</label>
                                        <input
                                          value={nestedField.name}
                                          onChange={(e) => updateNestedField(field.id, nestedField.id, 'name', e.target.value)}
                                          className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded"
                                          placeholder="property_name"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1">Type</label>
                                        <select
                                          value={nestedField.type}
                                          onChange={(e) => updateNestedField(field.id, nestedField.id, 'type', e.target.value)}
                                          className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded"
                                        >
                                          <option value="string">📝 Text</option>
                                          <option value="number">🔢 Number</option>
                                          <option value="date">📅 Date</option>
                                          <option value="boolean">☑️ Yes/No</option>
                                          <option value="array">📋 List</option>
                                        </select>
                                      </div>
                                      <div className="flex items-end">
                                        <button
                                          onClick={() => removeNestedField(field.id, nestedField.id)}
                                          className="w-full bg-red-500 text-white p-2 rounded hover:bg-red-600 transition-colors"
                                        >
                                          <Trash2 className="h-4 w-4 mx-auto" />
                                        </button>
                                      </div>
                                    </div>

                                    <div className="mb-3">
                                      <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1">Description</label>
                                      <input
                                        value={nestedField.description}
                                        onChange={(e) => updateNestedField(field.id, nestedField.id, 'description', e.target.value)}
                                        className="w-full border border-gray-300 dark:border-slate-600 p-2 rounded"
                                        placeholder="What this property represents..."
                                      />
                                    </div>

                                    <div className="flex items-center space-x-4">
                                      <label className="flex items-center space-x-2">
                                        <input
                                          type="checkbox"
                                          checked={nestedField.required}
                                          onChange={(e) => updateNestedField(field.id, nestedField.id, 'required', e.target.checked)}
                                          className="h-4 w-4 text-accent-600 dark:text-accent-400 rounded"
                                        />
                                        <span className={`text-sm ${nestedField.required ? 'text-red-600' : 'text-gray-600 dark:text-slate-300'}`}>
                                          {nestedField.required ? 'Required' : 'Optional'}
                                        </span>
                                      </label>
                                      {nestedField.type === 'string' && (
                                        <div className="flex items-center space-x-2">
                                          <label className="text-sm text-gray-600 dark:text-slate-300">Default:</label>
                                          <input
                                            value={nestedField.default}
                                            onChange={(e) => updateNestedField(field.id, nestedField.id, 'default', e.target.value)}
                                            className="border border-gray-300 dark:border-slate-600 p-1 rounded text-sm w-20"
                                            placeholder="value"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}

                                {(field.nestedFields || []).length === 0 && (
                                  <div className="text-center py-8 bg-white rounded-lg border-2 border-dashed border-blue-300">
                                    <FileText className="h-12 w-12 mx-auto mb-3 text-blue-300" />
                                    <p className="text-accent-600 dark:text-accent-400 mb-3">No nested properties defined</p>
                                    <button
                                      onClick={() => addNestedField(field.id)}
                                      className="bg-accent-600 text-white px-4 py-2 rounded-lg hover:bg-accent-700 transition-colors"
                                    >
                                      Add First Property
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {schemaFields.length === 0 && (
                      <div className="text-center py-16 bg-gray-50 dark:bg-slate-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-600">
                        <FileText className="h-20 w-20 mx-auto mb-4 text-gray-500 dark:text-slate-400" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Fields Defined</h3>
                        <p className="text-gray-600 dark:text-slate-300 mb-6">Start building your schema by adding your first field</p>
                        <button
                          onClick={addSchemaField}
                          className="bg-accent-600 text-white px-6 py-3 rounded-lg hover:bg-accent-700 transition-colors flex items-center space-x-2 mx-auto"
                        >
                          <Plus className="h-5 w-5" />
                          <span>Add Your First Field</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">JSON Schema Editor</h4>
                      <p className="text-sm text-gray-600 dark:text-slate-300">Edit the raw JSON schema directly</p>
                    </div>
                    <textarea
                      value={JSON.stringify(formData.output_schema, null, 2)}
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value);
                          setFormData(prev => ({ ...prev, output_schema: parsed }));
                        } catch (err) {
                          // Invalid JSON, don't update
                        }
                      }}
                      className="w-full border-2 border-gray-300 dark:border-slate-600 p-4 rounded-lg font-mono text-sm h-96 focus:border-accent-500 focus:outline-none"
                      placeholder='{\n  "field_name": {\n    "type": "string",\n    "required": true,\n    "description": "Field description"\n  }\n}'
                    />
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="bg-gray-50 dark:bg-slate-800 px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-between items-center">
                <div className="text-sm text-gray-600 dark:text-slate-300">
                  {schemaFields.length} field{schemaFields.length !== 1 ? 's' : ''} defined
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowSchemaEditor(false)}
                    className="border-2 border-gray-300 dark:border-slate-600 px-6 py-2 rounded-lg hover:bg-gray-50 dark:bg-slate-800 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => setShowSchemaEditor(false)}
                    className="bg-accent-600 text-white px-6 py-2 rounded-lg hover:bg-accent-700 transition-colors"
                  >
                    Save & Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocTypes;