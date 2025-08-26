"""Reconciliation agent using CrewAI for data comparison and conflict resolution."""

import os
import re
import sys
from typing import Any

from crewai import Agent, Task
from langchain.prompts import PromptTemplate
from langchain.tools import Tool
from langchain_openai import ChatOpenAI

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.enums import DocumentType, ReconcileStatus, ReconcileStrategy
from app.schemas import RagSearchRequest, ReconcileDiff
from app.services.rag_service import rag_service


class ReconciliationAgent:
    """CrewAI agent for intelligent data reconciliation and conflict resolution."""

    def __init__(self, llm_model: str = "gpt-4o"):
        """Initialize the reconciliation agent."""
        # Load API key from config file
        api_key = None
        try:
            import os

            config_file = "config.json"
            if os.path.exists(config_file):
                import json

                with open(config_file) as f:
                    config = json.load(f)
                    api_key = config.get("openai_api_key")
        except:
            pass

        # Fallback to settings if config file doesn't have it
        if not api_key:
            api_key = settings.openai_api_key

        # Use the new OpenAI client format

        self.llm = ChatOpenAI(
            model=llm_model,
            temperature=1.0 if llm_model == "gpt-5" else 0.1,  # Use default temp for gpt-5
            openai_api_key=api_key,
        )

        self.reconciliation_prompt = PromptTemplate(
            input_variables=["extracted_data", "fetched_data", "strategy"],
            template="""
            You are an expert data analyst specializing in document reconciliation and conflict resolution.

            Strategy: {strategy}
            Extracted Data: {extracted_data}
            External Data: {fetched_data}

            Compare the extracted data with external source data and identify:
            1. Exact matches
            2. Close matches (within tolerance)
            3. Conflicts requiring attention
            4. Missing data in either source

            For each field comparison, provide:
            - field_name: Name of the field being compared
            - extracted_value: Value from extracted data
            - fetched_value: Value from external source
            - match_status: "MATCH", "MISMATCH", "MISSING_EXTRACTED", "MISSING_FETCHED", "CLOSE_MATCH"
            - confidence_score: How confident you are in this comparison (0.0-1.0)
            - reasoning: Brief explanation of the comparison logic
            - suggested_resolution: How to resolve conflicts if any

            Comparison rules based on strategy:
            - STRICT: Exact matches only, case-sensitive
            - LOOSE: Allow case differences, whitespace normalization, similar formats
            - FUZZY: Use semantic similarity, allow abbreviations, handle typos

            Special handling:
            - Dates: Accept different formats (2024-01-15 vs 01/15/2024)
            - Amounts: Allow small rounding differences (±0.01)
            - Names: Handle abbreviations (Inc vs Incorporated)
            - IDs: Case-insensitive comparison

            Return results as JSON array of field comparisons.
            """,
        )

        self.agent = Agent(
            role="Data Reconciliation Specialist",
            goal="Intelligently compare and reconcile data from multiple sources to identify discrepancies and suggest resolutions",
            backstory="""You are a seasoned data reconciliation expert with deep experience in
            financial data analysis and document processing. You excel at identifying subtle
            discrepancies, understanding data variations across systems, and providing actionable
            recommendations for conflict resolution.""",
            verbose=True,
            allow_delegation=False,
            llm=self.llm,
            tools=[],
        )

    def _create_reconciliation_tool(self):
        """Create the reconciliation tool."""

        def reconcile_data(comparison_data: str) -> str:
            """Reconcile data between extracted and fetched sources."""
            try:
                prompt = self.reconciliation_prompt.format(
                    extracted_data=comparison_data.split("|||")[0],
                    fetched_data=comparison_data.split("|||")[1],
                    strategy=(
                        comparison_data.split("|||")[2]
                        if len(comparison_data.split("|||")) > 2
                        else "LOOSE"
                    ),
                )
                response = self.llm.invoke(prompt)
                return response.content
            except Exception as e:
                return f"Error during reconciliation: {str(e)}"

        return Tool(
            name="data_reconciler",
            description="Compares and reconciles data from multiple sources",
            func=reconcile_data,
        )

    def reconcile_records(
        self,
        extracted_data: dict[str, Any],
        fetched_data: dict[str, Any],
        strategy: ReconcileStrategy = ReconcileStrategy.LOOSE,
        document_type: DocumentType = DocumentType.UNKNOWN,
    ) -> tuple[list[ReconcileDiff], float]:
        """Reconcile extracted data with fetched data using AI analysis."""

        # Get RAG reference data for context
        rag_context = self._get_rag_context(extracted_data, document_type)

        # Format data for the agent
        extracted_str = self._format_data_for_comparison(extracted_data, "Extracted")
        fetched_str = self._format_data_for_comparison(fetched_data, "Fetched")

        task = Task(
            description=f"""
            Perform intelligent reconciliation between extracted document data and external source data.

            Reference Context from Knowledge Base:
            {rag_context}

            Use this reference data to inform your reconciliation decisions.

            Strategy: {strategy.value}

            Extracted Data:
            {extracted_str}

            External Data:
            {fetched_str}

            Compare each field intelligently, considering the reconciliation strategy.
            Identify matches, mismatches, and provide confidence scores for each comparison.
            Handle data format variations and provide reasoning for each decision.
            """,
            agent=self.agent,
            expected_output="JSON array with detailed field comparison results",
        )

        try:
            # Execute reconciliation task
            result = task.execute()

            # Parse results and convert to ReconcileDiff objects
            return self._parse_reconciliation_results(result, extracted_data, fetched_data)

        except Exception:
            # Fallback to simple reconciliation if CrewAI fails
            return self._fallback_reconciliation(extracted_data, fetched_data, strategy)

    def _format_data_for_comparison(self, data: dict[str, Any], source_label: str) -> str:
        """Format data dictionary for comparison prompt."""
        formatted = [f"{source_label} Data:"]
        for key, value in data.items():
            formatted.append(f"  {key}: {value}")
        return "\n".join(formatted)

    def _parse_reconciliation_results(
        self, result: str, extracted_data: dict[str, Any], fetched_data: dict[str, Any]
    ) -> tuple[list[ReconcileDiff], float]:
        """Parse reconciliation results and convert to ReconcileDiff objects."""
        import json

        try:
            # Try to extract JSON from the result
            json_match = re.search(r"\[.*\]", result, re.DOTALL)
            if json_match:
                comparisons = json.loads(json_match.group())
            else:
                comparisons = json.loads(result)

            diffs = []
            total_score = 0.0
            field_count = 0

            for comp in comparisons:
                field_name = comp.get("field_name", "")
                match_status_str = comp.get("match_status", "MISMATCH")
                confidence_score = comp.get("confidence_score", 0.5)

                # Map string status to enum
                try:
                    status = ReconcileStatus(match_status_str)
                except ValueError:
                    status = ReconcileStatus.MISMATCH

                # Create ReconcileDiff object
                diff = ReconcileDiff(
                    field=field_name,
                    extracted_value=comp.get("extracted_value"),
                    fetched_value=comp.get("fetched_value"),
                    match_score=confidence_score,
                    status=status,
                )
                diffs.append(diff)

                # Calculate overall score
                if status in [ReconcileStatus.MATCH]:
                    total_score += confidence_score
                    field_count += 1
                elif status in [ReconcileStatus.MISMATCH]:
                    field_count += 1

            overall_score = total_score / field_count if field_count > 0 else 0.0
            return diffs, round(overall_score, 2)

        except (json.JSONDecodeError, KeyError):
            # If parsing fails, fall back to simple reconciliation
            return self._fallback_reconciliation(
                extracted_data, fetched_data, ReconcileStrategy.LOOSE
            )

    def _fallback_reconciliation(
        self,
        extracted_data: dict[str, Any],
        fetched_data: dict[str, Any],
        strategy: ReconcileStrategy,
    ) -> tuple[list[ReconcileDiff], float]:
        """Fallback reconciliation using simple comparison logic."""
        from ..utils.diff import reconcile_records

        # Use the existing utility function as fallback
        return reconcile_records(extracted_data, fetched_data, strategy.value)

    def analyze_discrepancies(self, reconciliation_results: list[ReconcileDiff]) -> dict[str, Any]:
        """Analyze reconciliation results to provide insights and recommendations."""

        mismatches = [r for r in reconciliation_results if r.status == ReconcileStatus.MISMATCH]

        if not mismatches:
            return {
                "summary": "No discrepancies found",
                "confidence": "high",
                "action_required": False,
                "recommendations": ["All fields match - proceed with processing"],
            }

        # Analyze mismatches
        critical_fields = ["amount", "total", "invoice_number", "date"]
        critical_mismatches = [
            m for m in mismatches if any(cf in m.field.lower() for cf in critical_fields)
        ]

        analysis = {
            "summary": f"Found {len(mismatches)} discrepancies ({len(critical_mismatches)} critical)",
            "confidence": "low" if critical_mismatches else "medium",
            "action_required": len(critical_mismatches) > 0,
            "critical_fields": [m.field for m in critical_mismatches],
            "total_mismatches": len(mismatches),
            "recommendations": [],
        }

        # Generate recommendations
        if critical_mismatches:
            analysis["recommendations"].append(
                "Manual review required for critical field discrepancies"
            )
            analysis["recommendations"].append("Verify source data accuracy before proceeding")
        else:
            analysis["recommendations"].append(
                "Minor discrepancies found - consider automated resolution"
            )

        # Field-specific recommendations
        for mismatch in mismatches[:3]:  # Limit to first 3 for brevity
            analysis["recommendations"].append(
                f"Review {mismatch.field}: '{mismatch.extracted_value}' vs '{mismatch.fetched_value}'"
            )

        return analysis

    def _get_rag_context(self, extracted_data: dict[str, Any], document_type: DocumentType) -> str:
        """Get relevant RAG context for reconciliation."""
        try:
            # Search for similar reference documents
            search_query = self._build_search_query(extracted_data, document_type)

            if search_query:
                request = RagSearchRequest(
                    query=search_query,
                    document_type=document_type,
                    limit=3,
                    similarity_threshold=0.6,
                )

                results = rag_service.search_rag_documents(request)

                if results:
                    context_parts = []
                    for result in results:
                        context_parts.append(
                            f"Reference (similarity: {result.similarity_score:.2f}):"
                        )
                        context_parts.append(f"  Data: {result.reference_data}")
                        if result.description:
                            context_parts.append(f"  Description: {result.description}")
                        context_parts.append("")

                    return "\n".join(context_parts)

            return "No relevant reference data found."

        except Exception as e:
            return f"Error retrieving reference data: {str(e)}"

    def _build_search_query(
        self, extracted_data: dict[str, Any], document_type: DocumentType
    ) -> str:
        """Build search query for RAG lookup."""
        if document_type == DocumentType.INVOICE:
            vendor = extracted_data.get("vendor_name", "")
            amount = extracted_data.get("total_amount", "")
            return f"vendor {vendor} amount {amount}"

        elif document_type == DocumentType.RECEIPT:
            merchant = extracted_data.get("merchant_name", "")
            amount = extracted_data.get("total_amount", "")
            return f"merchant {merchant} amount {amount}"

        elif document_type == DocumentType.ENTRY_EXIT_LOG:
            person = extracted_data.get("person_name", "")
            location = extracted_data.get("location", "")
            return f"person {person} location {location}"

        # Generic search
        key_fields = ["name", "amount", "date", "id", "number"]
        search_terms = []

        for field, value in extracted_data.items():
            if any(key in field.lower() for key in key_fields):
                search_terms.append(str(value))

        return " ".join(search_terms[:3])  # Limit to top 3 terms
