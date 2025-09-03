"""Document extraction service - Step 1 of the pipeline."""

import requests
from loguru import logger

from ..services.crewai_service import crewai_service
from ..db import get_session_sync
from ..enums import ActorType, PipelineState
from ..models import Document, Extraction
from ..models import CustomDocTypeDefinition
from ..schemas import ExtractedField, ExtractedRecord
from .audit import log_audit_event
from .debug_service import record_extraction


class ExtractionService:
    """Service for extracting data from documents."""

    @staticmethod
    def extract(document: Document) -> ExtractedRecord:
        """Extract fields from a document using OCR and/or LLM extraction."""

        # Step 1: Get text content from document
        text_content = ExtractionService._get_document_text(document)

        if not text_content:
            logger.warning(f"No text content available for document {document.id}")
            return ExtractedRecord(root={})

        # Step 2: Get expected fields from custom schema FIRST
        doc_type = (
            document.document_type.value
            if hasattr(document.document_type, "value")
            else str(document.document_type)
        )

        # Get the expected fields based on custom schema
        expected_fields = ExtractionService._expected_fields_for_doc_type(doc_type, document)
        logger.info(f"Expected fields for {doc_type}: {expected_fields}")

        # Try to load a matching custom doc-type definition for tenant to use its instructions/schema
        matching_custom_def: CustomDocTypeDefinition | None = None
        if document and document.tenant_id:
            try:
                from ..db import get_session_sync as _get_session_sync_for_custom
                with _get_session_sync_for_custom() as _session_custom:
                    custom_defs = _session_custom.query(CustomDocTypeDefinition).filter(
                        CustomDocTypeDefinition.tenant_id == document.tenant_id
                    ).all()
                    doc_type_lower = (doc_type or "").lower()
                    for custom_def in custom_defs:
                        name_lower = (custom_def.name or "").lower()
                        if name_lower == doc_type_lower or (
                            doc_type_lower in name_lower
                            or ("receipt" in name_lower and "receipt" in doc_type_lower)
                            or ("invoice" in name_lower and "invoice" in doc_type_lower)
                            or ("purchase" in name_lower and "receipt" in doc_type_lower)
                        ):
                            matching_custom_def = custom_def
                            break
            except Exception as _e_match:
                logger.warning(f"Failed looking up custom doc type for tenant {document.tenant_id}: {_e_match}")

        logger.info(f"Starting CrewAI extraction for document {document.id}, type: {doc_type}")

        try:
            from tenacity import retry, stop_after_attempt, wait_exponential

            @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
            def _run_extraction() -> ExtractedRecord:
                # Build a schema-aware extraction context when a custom doc-type exists
                extraction_context: dict | None = None
                if matching_custom_def:
                    try:
                        logger.info(
                            f"Using custom doc-type '{matching_custom_def.name}' for tenant {document.tenant_id}"
                        )

                        def normalize_instructions(instr: dict | str | None) -> dict:
                            if isinstance(instr, dict):
                                if "extraction_instructions" in instr:
                                    return {"extraction_instructions": instr.get("extraction_instructions")}
                                if "prompt" in instr:
                                    return {"extraction_instructions": instr.get("prompt")}
                                return {"extraction_instructions": str(instr)}
                            if isinstance(instr, str):
                                return {"extraction_instructions": instr}
                            return {}

                        instructions: dict = {}
                        parent_schema: dict | None = None
                        child_schema: dict | None = None
                        collection_key: str = "child_entries"

                        pipeline_cfg = matching_custom_def.pipeline_config or {}
                        objects = pipeline_cfg.get("objects") or []
                        primary_obj = next(
                            (o for o in objects if isinstance(o, dict) and o.get("role") in ("parent", "primary")),
                            objects[0] if isinstance(objects, list) and objects and isinstance(objects[0], dict) else None,
                        )
                        if isinstance(primary_obj, dict):
                            if primary_obj.get("extraction_instructions"):
                                instructions = normalize_instructions({"extraction_instructions": primary_obj.get("extraction_instructions")})
                            if isinstance(primary_obj.get("object_schema"), dict):
                                parent_schema = primary_obj.get("object_schema")

                        child_obj = next(
                            (o for o in objects if isinstance(o, dict) and (o.get("role") == "children" or o.get("object_type") == "children")),
                            None,
                        )
                        if isinstance(child_obj, dict) and isinstance(child_obj.get("object_schema"), dict):
                            child_schema = child_obj.get("object_schema")
                            if isinstance(child_obj.get("name"), str) and child_obj.get("name").strip():
                                collection_key = child_obj.get("name").strip()

                        # Support new unified output_schema shape from frontend
                        output_schema = matching_custom_def.output_schema or {}
                        if isinstance(output_schema, dict) and ("parent_schema" in output_schema or "child_schema" in output_schema):
                            if isinstance(output_schema.get("parent_schema"), dict):
                                parent_schema = output_schema.get("parent_schema")
                            if isinstance(output_schema.get("child_schema"), dict):
                                child_schema = output_schema.get("child_schema")
                            if isinstance(output_schema.get("collection_key"), str) and output_schema.get("collection_key").strip():
                                collection_key = output_schema.get("collection_key").strip()

                        if not instructions:
                            instructions = normalize_instructions(matching_custom_def.instructions)

                        # If we have schemas, set expected_fields to parent fields for conformance fill
                        if isinstance(parent_schema, dict):
                            try:
                                props = parent_schema.get("properties") if isinstance(parent_schema.get("properties"), dict) else parent_schema
                                nonlocal expected_fields
                                expected_fields = list((props or {}).keys())
                            except Exception:
                                pass

                        if parent_schema or child_schema:
                            extraction_context = {
                                "instructions": instructions,
                                "parent_schema": parent_schema or {},
                                "child_schema": child_schema or {},
                                "collection_key": collection_key,
                            }
                    except Exception as _e_ctx:
                        logger.warning(f"Failed building extraction_context: {_e_ctx}")

                # CrewAI path only
                result = crewai_service.extract_document_data(
                    text_content, doc_type, expected_fields, extraction_context
                )
                if result:
                    return result
                # If CrewAI is disabled/unavailable, return empty result with meta
                logger.info("CrewAI not available; returning empty extraction result")
                return ExtractedRecord(
                    root={
                        "_extraction_mode": ExtractedField(value="disabled", confidence=1.0, type_hint="meta")
                    }
                )

            raw_extracted = _run_extraction()

            # Conform output to the document-type instructions - but prioritize what was actually extracted
            conformed_fields: dict[str, ExtractedField] = {}

            # First, include all successfully extracted fields
            for field_name, field_value in raw_extracted.root.items():
                if isinstance(field_value, ExtractedField) and field_value.value is not None:
                    conformed_fields[field_name] = field_value

            # Then, ensure all expected fields are present (with null values if not extracted)
            for field_name in expected_fields:
                if field_name not in conformed_fields:
                    conformed_fields[field_name] = ExtractedField(value=None, confidence=0.0, type_hint="text")

            # Add meta to help the UI understand which pipeline to show
            try:
                if matching_custom_def and matching_custom_def.name:
                    conformed_fields["_custom_doc_type_name"] = ExtractedField(
                        value=matching_custom_def.name, confidence=1.0, type_hint="meta"
                    )
                    conformed_fields["_extraction_mode"] = ExtractedField(
                        value="crewai_custom", confidence=1.0, type_hint="meta"
                    )
                else:
                    conformed_fields["_extraction_mode"] = ExtractedField(
                        value="crewai_generic", confidence=1.0, type_hint="meta"
                    )
            except Exception as _meta_e:
                logger.debug(f"Failed to attach extraction meta: {_meta_e}")

            record_extraction(True)
            logger.info(f"Final conformed fields: {list(conformed_fields.keys())}")
            return ExtractedRecord(root=conformed_fields)
        except Exception as e:
            logger.error(f"CrewAI extraction failed: {e}")
            fields = {"error": ExtractedField(value=f"Extraction failed: {str(e)}", confidence=0.1, type_hint="error")}
            record_extraction(False)
            return ExtractedRecord(root=fields)

    @staticmethod
    def extract_forced_custom(document: Document, forced_custom_name: str) -> ExtractedRecord:
        """Extract using a specific custom doc-type name, skipping CrewAI/generic paths.

        If the custom type is not found, return schema-shaped nulls when possible.
        """
        text_content = ExtractionService._get_document_text(document)
        if not text_content:
            logger.warning(f"No text for forced extraction on document {document.id}")
            return ExtractedRecord(root={})

        # Find exact custom doc type by name (case-insensitive)
        matching_custom_def: CustomDocTypeDefinition | None = None
        try:
            from ..db import get_session_sync as _get_session_sync_for_custom
            with _get_session_sync_for_custom() as _session_custom:
                custom_defs = _session_custom.query(CustomDocTypeDefinition).filter(
                    CustomDocTypeDefinition.tenant_id == document.tenant_id
                ).all()

                logger.info(f"DEBUG: Looking for custom doc type '{forced_custom_name}' in {len(custom_defs)} definitions")
                logger.info(f"DEBUG: Available custom doc types: {[cd.name for cd in custom_defs]}")

                name_target = (forced_custom_name or "").strip().lower()
                logger.info(f"DEBUG: Searching for normalized name: '{name_target}'")

                for cd in custom_defs:
                    cd_name_normalized = (cd.name or "").strip().lower()
                    logger.info(f"DEBUG: Comparing '{name_target}' with '{cd_name_normalized}' (id: {cd.id})")
                    if cd_name_normalized == name_target:
                        matching_custom_def = cd
                        logger.info(f"DEBUG: Found matching custom doc type: {cd.name} (id: {cd.id})")
                        logger.info(f"DEBUG: Custom schema: {cd.output_schema}")
                        logger.info(f"DEBUG: Custom instructions: {cd.instructions}")
                        logger.info(f"DEBUG: Pipeline config: {cd.pipeline_config}")
                        break
        except Exception as e:
            logger.warning(f"Forced custom lookup failed: {e}")

        if not matching_custom_def:
            logger.info(f"Forced custom type '{forced_custom_name}' not found for tenant {document.tenant_id}")
            return ExtractedRecord(
                root={
                    "_extraction_mode": ExtractedField(value="custom_forced_not_found", confidence=1.0, type_hint="meta"),
                    "_custom_doc_type_name": ExtractedField(value=forced_custom_name, confidence=1.0, type_hint="meta"),
                }
            )

        # Prepare instructions and schema
        def normalize_instructions(instr: dict | str | None) -> dict:
            if isinstance(instr, dict):
                if "extraction_instructions" in instr:
                    return {"extraction_instructions": instr.get("extraction_instructions")}
                if "prompt" in instr:
                    return {"extraction_instructions": instr.get("prompt")}
                return {"extraction_instructions": str(instr)}
            if isinstance(instr, str):
                return {"extraction_instructions": instr}
            return {}

        custom_instructions: dict = {}
        output_schema: dict = matching_custom_def.output_schema or {}
        logger.info(
            f"DEBUG: Initial output_schema from custom def: {list(output_schema.keys()) if isinstance(output_schema, dict) else 'Not a dict'}"
        )

        pipeline_cfg = matching_custom_def.pipeline_config or {}
        objects = pipeline_cfg.get("objects") or []
        primary_obj = next(
            (o for o in objects if isinstance(o, dict) and o.get("role") in ("parent", "primary")),
            objects[0] if isinstance(objects, list) and objects and isinstance(objects[0], dict) else None,
        )
        if isinstance(primary_obj, dict):
            if primary_obj.get("extraction_instructions"):
                custom_instructions = normalize_instructions({"extraction_instructions": primary_obj.get("extraction_instructions")})
            if primary_obj.get("object_schema") and isinstance(primary_obj.get("object_schema"), dict):
                output_schema = primary_obj.get("object_schema")

        # Detect optional child object
        child_obj = next(
            (o for o in objects if isinstance(o, dict) and (o.get("role") == "children" or o.get("object_type") == "children")),
            None,
        )
        child_schema = child_obj.get("object_schema") if isinstance(child_obj, dict) else None
        collection_key = child_obj.get("name").strip() if isinstance(child_obj, dict) and isinstance(child_obj.get("name"), str) and child_obj.get("name").strip() else "child_entries"

        # Support unified output_schema shape
        if isinstance(matching_custom_def.output_schema, dict) and (
            "parent_schema" in matching_custom_def.output_schema or "child_schema" in matching_custom_def.output_schema
        ):
            if isinstance(matching_custom_def.output_schema.get("parent_schema"), dict):
                output_schema = matching_custom_def.output_schema.get("parent_schema")
            if isinstance(matching_custom_def.output_schema.get("child_schema"), dict):
                child_schema = matching_custom_def.output_schema.get("child_schema")
            if isinstance(matching_custom_def.output_schema.get("collection_key"), str) and matching_custom_def.output_schema.get("collection_key").strip():
                collection_key = matching_custom_def.output_schema.get("collection_key").strip()

        if not custom_instructions:
            custom_instructions = normalize_instructions(matching_custom_def.instructions)

        # Expected fields from parent schema
        expected_fields: list[str] = []
        if output_schema and isinstance(output_schema, dict):
            if "properties" in output_schema and isinstance(output_schema["properties"], dict):
                expected_fields = list(output_schema["properties"].keys())
            else:
                expected_fields = list(output_schema.keys())

        # Build extraction context and call CrewAI
        extraction_context = {
            "instructions": custom_instructions,
            "parent_schema": output_schema or {},
            "child_schema": child_schema or {},
            "collection_key": collection_key,
        }

        result = crewai_service.extract_document_data(
            text_content, document.document_type.value if hasattr(document.document_type, "value") else str(document.document_type), expected_fields, extraction_context
        )

        if not result:
            empty_fields = {k: ExtractedField(value=None, confidence=0.0, type_hint="text") for k in expected_fields}
            empty_fields["_extraction_mode"] = ExtractedField(value="custom_forced_empty", confidence=1.0, type_hint="meta")
            empty_fields["_custom_doc_type_name"] = ExtractedField(value=forced_custom_name, confidence=1.0, type_hint="meta")
            return ExtractedRecord(root=empty_fields)

        # Attach meta and return
        result.root["_extraction_mode"] = ExtractedField(value="custom_forced_crewai", confidence=1.0, type_hint="meta")
        result.root["_custom_doc_type_name"] = ExtractedField(value=forced_custom_name, confidence=1.0, type_hint="meta")
        return result

    @staticmethod
    def process_document_forced(document_id: int, forced_custom_name: str) -> ExtractedRecord:
        """Process a document using a forced custom doc type name (no CrewAI/generic)."""
        with get_session_sync() as session:
            document = session.get(Document, document_id)
            if not document:
                raise ValueError(f"Document {document_id} not found")

            extracted_data = ExtractionService.extract_forced_custom(document, forced_custom_name)

            extraction = ExtractionService.create_extraction_record(
                document_id, extracted_data.root
            )

            # Update document state
            old_state = document.state
            document.state = PipelineState.HIL_REQUIRED
            session.commit()

            # Log audit event
            log_audit_event(
                document_id=document_id,
                actor_type=ActorType.SYSTEM,
                action="extraction_completed",
                from_state=old_state,
                to_state=PipelineState.HIL_REQUIRED,
                payload={
                    "extraction_id": extraction.id,
                    "fields_extracted": len(extracted_data.root),
                    "extraction_mode": extracted_data.root.get("_extraction_mode").value if extracted_data.root.get("_extraction_mode") else "custom_forced",
                },
            )

        return extracted_data



    @staticmethod
    def _get_document_text(document: Document) -> str:
        """Extract text content from a document - simplified for CrewAI."""

        # Use document content directly
        if document.content:
            logger.info("Using document content for CrewAI extraction")
            return str(document.content)  # CrewAI can handle various formats

        # Try to fetch from source URI
        if document.source_uri:
            try:
                logger.info(f"Fetching content from URL: {document.source_uri}")
                response = requests.get(document.source_uri, timeout=30)
                response.raise_for_status()
                return response.text
            except Exception as e:
                logger.error(f"Failed to fetch content from URL {document.source_uri}: {e}")

        # Generate sample content as last resort
        logger.warning("No content available, generating sample content for testing")
        return ExtractionService._generate_sample_content(document)

    @staticmethod
    def _generate_sample_content(document: Document) -> str:
        """Generate realistic sample content based on document type for AI extraction."""
        doc_type = (
            document.document_type.value
            if hasattr(document.document_type, "value")
            else str(document.document_type)
        )
        filename = document.filename or "document"

        if doc_type == "INVOICE":
            return f"""INVOICE
Invoice Number: INV-2024-{filename[-4:]}
Date: 2024-08-24
Due Date: 2024-09-24

Bill To:
ABC Company
123 Main Street
New York, NY 10001

From:
XYZ Services Inc.
456 Business Ave
Los Angeles, CA 90210

Description                    Quantity    Unit Price    Total
Consulting Services            40 hrs      $150.00      $6,000.00
Software License              1           $500.00      $500.00
Support Services              12 months   $100.00      $1,200.00

Subtotal: $7,700.00
Tax (8.5%): $654.50
Total: $8,354.50

Payment Terms: Net 30 days
"""
        elif doc_type == "RECEIPT":
            return f"""RECEIPT
Store: Tech Mart
Address: 789 Shopping Blvd, Chicago, IL 60601
Phone: (555) 123-4567

Date: 2024-08-24 14:30:22
Receipt #: {filename[-6:]}
Cashier: Sarah M.

Items:
Wireless Mouse               $29.99
USB Cable 6ft               $12.99
Screen Cleaner              $8.99
Laptop Stand                $45.99

Subtotal:                   $97.96
Tax (7.25%):                $7.10
Total:                     $105.06

Payment Method: Credit Card ****1234
Thank you for shopping with us!
"""
        elif doc_type == "ENTRY_EXIT_LOG":
            return f"""ENTRY/EXIT LOG
Facility: Corporate Office Building
Address: 100 Business Park Dr, Austin, TX 78701
Date: 2024-08-24

Employee ID: EMP-{filename[-4:]}
Name: John Smith
Department: Engineering
Badge #: 4578

Entry Time: 08:15:22 AM
Exit Time: 05:47:18 PM
Total Hours: 9 hours 32 minutes

Access Points:
- Main Entrance (Badge Scan): 08:15:22 AM
- Lab Room 204 (Keycard): 10:30:15 AM
- Conference Room B (Badge Scan): 02:15:33 PM
- Main Exit (Badge Scan): 05:47:18 PM

Authorized by: Security System
"""
        else:
            return f"""BUSINESS DOCUMENT
Document: {filename}
Type: {doc_type}
Date: 2024-08-24

This is a sample business document for AI extraction testing.
Company: Sample Corp
Contact: info@sample.com
Phone: (555) 987-6543
Address: 123 Sample St, Sample City, SC 12345

Amount: $1,234.56
Reference: REF-{filename[-6:]}
Status: Active
"""

    @staticmethod
    def create_extraction_record(
        document_id: int,
        extracted_data: dict[str, ExtractedField],
        provider: str = "default",
    ) -> Extraction:
        """Create and save an extraction record."""

        instructed_payload = {
            k: {"value": v.value, "confidence": v.confidence, "type_hint": v.type_hint}
            for k, v in extracted_data.items()
        }

        payload = {
            "instructed_fields": instructed_payload,
            "all_fields": instructed_payload,
        }

        extraction = Extraction(
            document_id=document_id,
            raw_json=payload,
            provider=provider,
            confidence=0.8,  # Default confidence
        )

        with get_session_sync() as session:
            session.add(extraction)
            session.commit()
            session.refresh(extraction)

        return extraction

    @staticmethod
    def _expected_fields_for_doc_type(document_type: str, document: Document | None = None) -> list[str]:
        """Return required+optional field names for a given document type.

        Looks up tenant-specific CustomDocTypeDefinition if available.
        """

        # Try custom definition first - use fuzzy matching
        from ..db import get_session_sync

        with get_session_sync() as session:
            if document and document.tenant_id:
                # Get all custom document types for this tenant
                custom_defs = session.query(CustomDocTypeDefinition).filter(
                    CustomDocTypeDefinition.tenant_id == document.tenant_id
                ).all()
                
                # Find matching custom document type using fuzzy matching
                matching_def = None
                doc_type_lower = document_type.lower()
                
                for custom_def in custom_defs:
                    name_lower = custom_def.name.lower()
                    # Check for exact match first
                    if name_lower == doc_type_lower:
                        matching_def = custom_def
                        break
                    # Check for partial matches (e.g., "Purchase Receipt" matches "RECEIPT")
                    elif (doc_type_lower in name_lower or 
                          'receipt' in name_lower and 'receipt' in doc_type_lower or
                          'invoice' in name_lower and 'invoice' in doc_type_lower or
                          'purchase' in name_lower and 'receipt' in doc_type_lower):
                        matching_def = custom_def
                        break
                
                if matching_def:
                    schema = matching_def.output_schema or {}
                    logger.info(f"Found custom schema '{matching_def.name}' for document type '{document_type}': {list(schema.keys())}")
                    return list(schema.keys())
                else:
                    logger.info(f"No custom schema found for document type '{document_type}', available custom types: {[cd.name for cd in custom_defs]}")
            else:
                logger.info(f"No tenant_id available for document, cannot lookup custom schemas")

        doc_type = (document_type or "UNKNOWN").upper()
        if doc_type == "INVOICE":
            return [
                "invoice_number",
                "vendor_name",
                "invoice_date",
                "total_amount",
                "currency",
                "vendor_address",
                "vendor_tax_id",
                "due_date",
                "subtotal",
                "tax_amount",
                "line_items",
                "payment_terms",
            ]
        if doc_type == "RECEIPT":
            return [
                "merchant_name",
                "transaction_date",
                "total_amount",
                "currency",
                "merchant_address",
                "transaction_time",
                "tax_amount",
                "payment_method",
                "items",
                "receipt_number",
            ]
        if doc_type == "ENTRY_EXIT_LOG":
            return [
                "person_name",
                "location",
                "person_id",
                "entry_time",
                "exit_time",
                "purpose",
                "authorized_by",
                "badge_number",
                "vehicle_info",
            ]
        return [
            "document_type",
            "date",
            "amount",
            "currency",
            "company_name",
            "person_name",
            "address",
            "phone_number",
            "email",
            "reference_number",
            "description",
        ]

    @staticmethod
    def process_document(document_id: int) -> ExtractedRecord:
        """Complete extraction process for a document."""

        with get_session_sync() as session:
            document = session.get(Document, document_id)
            if not document:
                raise ValueError(f"Document {document_id} not found")

            initial_doc_type_val = document.document_type.value
            # Extract data
            extracted_data = ExtractionService.extract(document)

            # Check if document type was detected in extraction and update if needed
            if document.document_type.value == "UNKNOWN" and "document_type" in extracted_data.root:
                detected_type = extracted_data.root["document_type"].value
                if detected_type and isinstance(detected_type, str):
                    detected_type_upper = detected_type.upper()
                    # Map common variations to our enum values
                    type_mapping = {
                        "RECEIPT": "RECEIPT",
                        "INVOICE": "INVOICE", 
                        "ENTRY_EXIT_LOG": "ENTRY_EXIT_LOG",
                        "ENTRY EXIT LOG": "ENTRY_EXIT_LOG",
                        "LOG": "ENTRY_EXIT_LOG"
                    }
                    
                    if detected_type_upper in type_mapping:
                        from ..enums import DocumentType
                        new_doc_type = getattr(DocumentType, type_mapping[detected_type_upper], None)
                        if new_doc_type:
                            logger.info(f"Updating document {document_id} type from UNKNOWN to {new_doc_type}")
                            document.document_type = new_doc_type
                            session.commit()

            # If document type changed from initial and we have a custom config, run a second pass using it
            try:
                if document.document_type.value != initial_doc_type_val:
                    logger.info(
                        f"Document type changed from {initial_doc_type_val} to {document.document_type.value}; running custom-config extraction pass"
                    )
                    # Second pass extraction will now pick up custom schema/instructions
                    extracted_data = ExtractionService.extract(document)
            except Exception as _e_second:
                logger.warning(f"Second extraction pass with custom config failed: {_e_second}")

            # Create extraction record
            extraction = ExtractionService.create_extraction_record(
                document_id, extracted_data.root
            )

            # Update document state
            old_state = document.state
            document.state = PipelineState.HIL_REQUIRED
            session.commit()

            # Log audit event
            log_audit_event(
                document_id=document_id,
                actor_type=ActorType.SYSTEM,
                action="extraction_completed",
                from_state=old_state,
                to_state=PipelineState.HIL_REQUIRED,
                payload={
                    "extraction_id": extraction.id,
                    "fields_extracted": len(extracted_data.root),
                    "document_type_updated": document.document_type.value,
                },
            )

        return extracted_data


def extract_document_fields(document_id: int) -> ExtractedRecord:
    """Convenience function to extract document fields."""
    return ExtractionService.process_document(document_id)


async def extract_structured_data(document: dict, instructions: dict, output_schema: dict) -> dict:
    """Test extraction function for custom document types."""
    try:
        # Get the document content
        text_content = document.get("content", "")
        
        if not text_content:
            return {
                "error": "No document content provided for testing",
                "suggestion": "Please upload a sample document to test extraction"
            }
        
        # Extract the expected fields from the output schema (support both JSON Schema and flat dict formats)
        expected_fields: list[str] = []
        try:
            if isinstance(output_schema, dict):
                if "properties" in output_schema and isinstance(output_schema.get("properties"), dict):
                    expected_fields = list(output_schema["properties"].keys())
                else:
                    expected_fields = list(output_schema.keys())
        except Exception:
            expected_fields = []
        
        if not expected_fields:
            return {
                "error": "No fields defined in output schema",
                "suggestion": "Please add field definitions to your output schema before testing extraction. Go to the 'Output Schema' step and define the fields you want to extract.",
                "test_status": "failed",
                "helpful_tips": [
                    "Click 'Add Field' to define what data you want to extract",
                    "Each field should have a name and description",
                    "Common fields include: company_name, total_amount, date, etc."
                ]
            }
        
        logger.info(f"Testing extraction with {len(expected_fields)} fields: {expected_fields}")
        logger.info(f"Document content length: {len(text_content)} characters")
        
        # Build CrewAI extraction context for testing
        parent_schema = output_schema
        child_schema = {}
        collection_key = "entries"
        if isinstance(output_schema, dict) and ("parent_schema" in output_schema or "child_schema" in output_schema):
            parent_schema = output_schema.get("parent_schema") or {}
            child_schema = output_schema.get("child_schema") or {}
            if isinstance(output_schema.get("collection_key"), str) and output_schema.get("collection_key").strip():
                collection_key = output_schema.get("collection_key").strip()

        extraction_context = {
            "instructions": instructions,
            "parent_schema": parent_schema or {},
            "child_schema": child_schema or {},
            "collection_key": collection_key,
        }

        from ..services.crewai_service import crewai_service as _crewai
        result = _crewai.extract_document_data(text_content, (document.get("document_type") or "custom"), expected_fields, extraction_context)

        if not result:
            return {
                "error": "Extraction returned no data",
                "suggestion": "Check if your document contains the fields you're looking for, or refine your extraction instructions",
            }
        
        # Convert to simple dict format expected by frontend
        extracted_data = {}
        fields_found = 0
        fields_with_values = 0
        
        for field_name in expected_fields:
            if field_name in result.root:
                field_value = result.root[field_name]
                fields_found += 1
                
                if hasattr(field_value, "value"):
                    actual_value = field_value.value
                    confidence = field_value.confidence or 0.0
                elif isinstance(field_value, dict) and "value" in field_value:
                    actual_value = field_value.get("value")
                    confidence = field_value.get("confidence", 0.0)
                else:
                    actual_value = field_value
                    confidence = 0.8  # Default confidence

                extracted_data[field_name] = {
                    "value": actual_value,
                    "confidence": confidence,
                    "found": actual_value is not None and actual_value != "",
                }

                if actual_value is not None and actual_value != "":
                    fields_with_values += 1
            else:
                extracted_data[field_name] = {
                    "value": None,
                    "confidence": 0.0,
                    "found": False,
                }

        # Include child collection preview if present
        if collection_key in result.root:
            coll_val = result.root[collection_key]
            if hasattr(coll_val, "value"):
                coll_val = coll_val.value
            extracted_data[collection_key] = {
                "value": coll_val,
                "confidence": 0.8,
                "found": isinstance(coll_val, list) and len(coll_val) > 0,
            }
        
        # Add extraction summary for user feedback
        extraction_summary = {
            "total_fields": len(expected_fields),
            "fields_processed": fields_found,
            "fields_with_values": fields_with_values,
            "success_rate": round((fields_with_values / len(expected_fields)) * 100, 1) if expected_fields else 0,
            "status": "success" if fields_with_values > 0 else "no_data_found"
        }
        
        logger.info(f"Extraction completed: {fields_with_values}/{len(expected_fields)} fields found")
        
        return {
            "extracted_data": extracted_data,
            "summary": extraction_summary,
            "test_status": "success"
        }
            
    except Exception as e:
        logger.error(f"Extraction test failed: {e}")
        # Provide helpful error messages
        error_message = str(e)
        suggestion = "Please check your document format and try again"
        
        if "api key" in error_message.lower():
            suggestion = "OpenAI API key is not configured properly"
        elif "timeout" in error_message.lower():
            suggestion = "Request timed out - try with a smaller document or simpler instructions"
        elif "token" in error_message.lower():
            suggestion = "Document is too large - try with a shorter document"
        
        return {
            "error": error_message,
            "suggestion": suggestion,
            "test_status": "failed"
        }
