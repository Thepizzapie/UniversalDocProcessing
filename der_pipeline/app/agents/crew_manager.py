"""CrewAI crew manager for orchestrating document processing agents."""

from typing import Dict, Any, List, Optional
from crewai import Crew, Process
from langchain_openai import ChatOpenAI

from .document_extraction_agent import DocumentExtractionAgent
from .validation_agent import ValidationAgent
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from .reconciliation_agent import ReconciliationAgent

from app.schemas import ExtractedRecord, CorrectedField, ReconcileDiff
from app.enums import ReconcileStrategy
from app.config import settings


class DocumentProcessingCrew:
    """CrewAI crew for orchestrating the complete document processing pipeline."""
    
    def __init__(self, llm_model: str = "gpt-4o"):
        """Initialize the document processing crew."""
        # Load API key from config file first
        api_key = None
        try:
            import os
            config_file = "config.json"
            if os.path.exists(config_file):
                import json
                with open(config_file, 'r') as f:
                    config = json.load(f)
                    api_key = config.get('openai_api_key')
        except:
            pass

        # Fallback to settings if config file doesn't have it
        if not api_key:
            api_key = settings.openai_api_key

        print(f"DEBUG: Crew manager using API key: {'Yes' if api_key else 'No'}")
        print(f"DEBUG: Crew manager using model: {llm_model}")

        self.llm = ChatOpenAI(
            model=llm_model,
            temperature=0.1,
            openai_api_key=api_key
        )
        
        # Initialize individual agents
        self.extraction_agent = DocumentExtractionAgent(llm_model)
        self.validation_agent = ValidationAgent(llm_model)
        self.reconciliation_agent = ReconciliationAgent(llm_model)
        
        # Create the crew
        self.crew = Crew(
            agents=[
                self.extraction_agent.agent,
                self.validation_agent.agent,
                self.reconciliation_agent.agent
            ],
            process=Process.sequential,  # Sequential processing for document pipeline
            verbose=True,
            max_execution_time=300,  # 5 minutes timeout
            memory=True  # Enable crew memory for context
        )
    
    def process_document_complete(
        self,
        document_text: str,
        document_type: str = "invoice",
        external_data: Optional[Dict[str, Any]] = None,
        reconcile_strategy: ReconcileStrategy = ReconcileStrategy.LOOSE
    ) -> Dict[str, Any]:
        """
        Process a document through the complete pipeline:
        1. Extract structured data
        2. Validate extracted data
        3. Reconcile with external data (if provided)
        """
        
        results = {
            "document_type": document_type,
            "processing_status": "started",
            "extraction_results": None,
            "validation_results": None,
            "reconciliation_results": None,
            "final_recommendations": []
        }
        
        try:
            # Step 1: Extract structured data
            extraction_results = self.extract_data(document_text, document_type)
            results["extraction_results"] = extraction_results
            results["processing_status"] = "extracted"
            
            # Step 2: Validate extracted data
            validation_results = self.validate_data(
                extraction_results.root, 
                document_text
            )
            results["validation_results"] = validation_results
            results["processing_status"] = "validated"
            
            # Step 3: Reconcile with external data (if provided)
            if external_data:
                reconciliation_results, overall_score = self.reconcile_data(
                    validation_results,
                    external_data,
                    reconcile_strategy
                )
                results["reconciliation_results"] = {
                    "comparisons": reconciliation_results,
                    "overall_score": overall_score,
                    "analysis": self.reconciliation_agent.analyze_discrepancies(reconciliation_results)
                }
                results["processing_status"] = "reconciled"
            
            # Generate final recommendations
            results["final_recommendations"] = self._generate_final_recommendations(results)
            results["processing_status"] = "completed"
            
        except Exception as e:
            results["processing_status"] = "failed"
            results["error"] = str(e)
            results["final_recommendations"] = ["Processing failed - manual review required"]
        
        return results
    
    def extract_data(self, document_text: str, document_type: str = "invoice") -> ExtractedRecord:
        """Extract structured data from document text."""
        return self.extraction_agent.extract_fields(document_text, document_type)
    
    def validate_data(
        self, 
        extracted_fields: Dict[str, Any], 
        document_context: str = ""
    ) -> Dict[str, Any]:
        """Validate extracted data for quality and consistency."""
        from ..schemas import ExtractedField
        
        # Convert dict to ExtractedField objects if needed
        if extracted_fields and not isinstance(list(extracted_fields.values())[0], ExtractedField):
            converted_fields = {}
            for key, value in extracted_fields.items():
                if isinstance(value, dict):
                    converted_fields[key] = ExtractedField(
                        value=value.get('value'),
                        confidence=value.get('confidence', 0.5),
                        type_hint=value.get('type_hint', 'text')
                    )
                else:
                    converted_fields[key] = ExtractedField(
                        value=value,
                        confidence=0.5,
                        type_hint='text'
                    )
            extracted_fields = converted_fields
        
        validated_fields = self.validation_agent.validate_extracted_fields(
            extracted_fields, 
            document_context
        )
        
        # Also get correction suggestions for low-confidence fields
        suggestions = self.validation_agent.suggest_corrections(
            validated_fields,
            document_context
        )
        
        return {
            "validated_fields": validated_fields,
            "correction_suggestions": suggestions,
            "validation_summary": self._summarize_validation(validated_fields)
        }
    
    def reconcile_data(
        self,
        validated_data: Dict[str, Any],
        external_data: Dict[str, Any],
        strategy: ReconcileStrategy = ReconcileStrategy.LOOSE
    ) -> tuple[List[ReconcileDiff], float]:
        """Reconcile validated data with external sources."""
        
        # Extract the validated fields for reconciliation
        fields_to_reconcile = validated_data.get("validated_fields", {})
        
        # Convert ExtractedField objects to simple values for reconciliation
        simple_fields = {}
        for key, field in fields_to_reconcile.items():
            if hasattr(field, 'value'):
                simple_fields[key] = field.value
            else:
                simple_fields[key] = field
        
        return self.reconciliation_agent.reconcile_records(
            simple_fields,
            external_data,
            strategy
        )
    
    def _summarize_validation(self, validated_fields: Dict[str, Any]) -> Dict[str, Any]:
        """Summarize validation results."""
        total_fields = len(validated_fields)
        high_confidence = sum(1 for f in validated_fields.values() if f.confidence >= 0.8)
        medium_confidence = sum(1 for f in validated_fields.values() if 0.5 <= f.confidence < 0.8)
        low_confidence = sum(1 for f in validated_fields.values() if f.confidence < 0.5)
        
        average_confidence = sum(f.confidence for f in validated_fields.values()) / total_fields if total_fields > 0 else 0
        
        return {
            "total_fields": total_fields,
            "high_confidence_fields": high_confidence,
            "medium_confidence_fields": medium_confidence,
            "low_confidence_fields": low_confidence,
            "average_confidence": round(average_confidence, 2),
            "quality_score": "high" if average_confidence >= 0.8 else "medium" if average_confidence >= 0.6 else "low"
        }
    
    def _generate_final_recommendations(self, results: Dict[str, Any]) -> List[str]:
        """Generate final processing recommendations based on all results."""
        recommendations = []
        
        # Check extraction quality
        if results.get("extraction_results"):
            extraction_fields = results["extraction_results"].root
            if len(extraction_fields) < 3:
                recommendations.append("Limited data extracted - verify document quality")
        
        # Check validation results
        if results.get("validation_results"):
            validation_summary = results["validation_results"].get("validation_summary", {})
            quality_score = validation_summary.get("quality_score", "unknown")
            
            if quality_score == "low":
                recommendations.append("Low data quality detected - manual review recommended")
            elif quality_score == "medium":
                recommendations.append("Moderate data quality - consider spot checking")
            else:
                recommendations.append("High data quality - automated processing recommended")
        
        # Check reconciliation results
        if results.get("reconciliation_results"):
            recon_analysis = results["reconciliation_results"].get("analysis", {})
            if recon_analysis.get("action_required", False):
                recommendations.append("Critical discrepancies found - manual reconciliation required")
                recommendations.extend(recon_analysis.get("recommendations", []))
            else:
                recommendations.append("Data reconciliation successful - proceed with confidence")
        
        # Default recommendation if none generated
        if not recommendations:
            recommendations.append("Document processing completed - ready for next stage")
        
        return recommendations
    
    def get_crew_status(self) -> Dict[str, Any]:
        """Get current status of the crew and its agents."""
        return {
            "crew_id": id(self.crew),
            "agents_count": len(self.crew.agents),
            "process_type": self.crew.process.value if hasattr(self.crew.process, 'value') else str(self.crew.process),
            "memory_enabled": getattr(self.crew, 'memory', False),
            "agents": [
                {
                    "role": agent.role,
                    "goal": agent.goal,
                    "tools_count": len(agent.tools) if hasattr(agent, 'tools') else 0
                }
                for agent in self.crew.agents
            ]
        }

