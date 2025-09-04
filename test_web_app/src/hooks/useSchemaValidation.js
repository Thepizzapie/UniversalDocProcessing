import { useCallback } from 'react';

export const useSchemaValidation = () => {
  // Validate schema structure and content
  const validateSchema = useCallback((schema) => {
    const errors = [];
    
    if (!schema || Object.keys(schema).length === 0) {
      errors.push('Schema cannot be empty');
      return errors;
    }

    // Check if this is a JSON Schema format (has $schema, type, properties)
    if (schema.$schema && schema.type === 'object' && schema.properties) {
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
  }, []);

  // Convert fields array to schema object (SIMPLIFIED FORMAT)
  const fieldsToSchema = useCallback((fields) => {
    const buildNestedSchema = (nestedFields) => {
      const schema = {};
      nestedFields.forEach(field => {
        if (field.name && field.name.trim()) {
          // Simple schema format - just show the default value for the type
          switch (field.type) {
            case 'string':
              schema[field.name] = "";
              break;
            case 'number':
              schema[field.name] = 0;
              break;
            case 'boolean':
              schema[field.name] = false;
              break;
            case 'date':
              schema[field.name] = "date";
              break;
            default:
              schema[field.name] = "";
          }
        }
      });
      return schema;
    };

    const schema = {};
    fields.forEach(field => {
      if (field.name && field.name.trim()) {
        if (field.type === 'object' && field.nestedFields?.length > 0) {
          // For records: just the nested object
          schema[field.name] = buildNestedSchema(field.nestedFields);
        } else if (field.type === 'array') {
          if (field.nestedFields?.length > 0) {
            // For arrays: put the nested schema in an array format
            schema[field.name] = [buildNestedSchema(field.nestedFields)];
          } else {
            // Empty array
            schema[field.name] = [];
          }
        } else {
          // Simple field types
          switch (field.type) {
            case 'string':
              schema[field.name] = "";
              break;
            case 'number':
              schema[field.name] = 0;
              break;
            case 'boolean':
              schema[field.name] = false;
              break;
            case 'date':
              schema[field.name] = "date";
              break;
            default:
              schema[field.name] = "";
          }
        }
      }
    });
    return schema;
  }, []);

  // Convert schema object to fields array (SIMPLIFIED FORMAT ONLY)
  const schemaToFields = useCallback((schema) => {
    // Only handle simplified format: { field_name: "default_value" }
    return Object.entries(schema || {}).map(([name, value]) => {
      if (Array.isArray(value)) {
        return {
          id: Math.random(),
          name,
          type: 'array',
          required: false,
          description: '',
          default: '',
          nestedFields: value.length > 0 && typeof value[0] === 'object' 
            ? Object.entries(value[0] || {}).map(([nestedName, nestedValue]) => ({
                id: Math.random(),
                name: nestedName,
                type: typeof nestedValue === 'number' ? 'number' : typeof nestedValue === 'boolean' ? 'boolean' : nestedValue === 'date' ? 'date' : 'string',
                required: false,
                description: '',
                default: ''
              }))
            : []
        };
      }
      
      if (typeof value === 'object' && value !== null) {
        return {
          id: Math.random(),
          name,
          type: 'object',
          required: false,
          description: '',
          default: '',
          nestedFields: Object.entries(value || {}).map(([nestedName, nestedValue]) => ({
            id: Math.random(),
            name: nestedName,
            type: typeof nestedValue === 'number' ? 'number' : typeof nestedValue === 'boolean' ? 'boolean' : nestedValue === 'date' ? 'date' : 'string',
            required: false,
            description: '',
            default: ''
          }))
        };
      }
      
      return {
        id: Math.random(),
        name,
        type: typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : value === 'date' ? 'date' : 'string',
        required: false,
        description: '',
        default: '',
        nestedFields: []
      };
    });
  }, []);

  return {
    validateSchema,
    fieldsToSchema,
    schemaToFields
  };
};
