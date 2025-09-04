# Document Types Component Architecture

## Overview
Breaking down the monolithic DocTypes.js (2,276 lines) into manageable, focused components.

## New Component Structure

### Core Container
- `DocTypesPage.js` - Main page container (100-150 lines)

### Feature Components
- `DocTypesList.js` - Display and manage existing doc types (200-300 lines)
- `CreateDocTypeWizard.js` - Creation wizard orchestrator (150-200 lines)

### Wizard Steps
- `BasicInfoStep.js` - Step 1: Name, description, webhook (100 lines)
- `PipelineStep.js` - Step 2: Pipeline template selection (150 lines)
- `SchemaStep.js` - Step 3: Schema definition with AI (200 lines)
- `ReviewStep.js` - Step 4: Final review and save (100 lines)

### Schema Components
- `SchemaBuilder.js` - Visual field builder (300-400 lines)
- `SchemaJsonEditor.js` - JSON editor with validation (100 lines)
- `DualSchemaEditor.js` - Parent/child schema manager (200 lines)

### Utility Components
- `AISchemaGenerator.js` - AI-powered schema generation (200 lines)
- `PipelineTemplates.js` - Template definitions and selection (150 lines)
- `TestExtraction.js` - Testing functionality (150 lines)

### Hooks & Services
- `useDocTypes.js` - API operations and state management (150 lines)
- `useSchemaValidation.js` - Schema validation logic (100 lines)
- `useWizardNavigation.js` - Wizard step management (100 lines)

### Constants & Types
- `constants.js` - Pipeline templates, field types (100 lines)
- `types.js` - TypeScript/PropTypes definitions (50 lines)

## Benefits
- **Single Responsibility**: Each component has one clear purpose
- **Testability**: Individual components can be unit tested
- **Reusability**: Schema components can be reused elsewhere
- **Maintainability**: Easier to find and fix issues
- **Performance**: Better code splitting and lazy loading
- **Developer Experience**: Easier to understand and modify

## Migration Strategy
1. Create new component structure
2. Extract and move components one by one
3. Update imports and references
4. Test each component individually
5. Remove original monolithic file
