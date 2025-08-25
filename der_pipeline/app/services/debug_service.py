"""AI-powered debugging service for pipeline analysis."""

import json
from datetime import datetime
from typing import Any, Dict, List
from sqlmodel import Session
from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate

from ..db import get_session
from ..models import DebugSession, Document
from ..schemas import DebugRequest, DebugResponse
from ..config import settings


class DebugService:
    """Service for AI-powered pipeline debugging and analysis."""
    
    def __init__(self):
        """Initialize the debug service."""
        try:
            self.llm = ChatOpenAI(
                api_key=settings.openai_api_key,
                model_name="gpt-3.5-turbo",
                temperature=0.1
            )
            self.initialized = True
        except Exception as e:
            print(f"Warning: Could not initialize debug service: {e}")
            self.initialized = False
    
    def analyze_extraction_issues(self, document_id: int, request: DebugRequest) -> DebugResponse:
        """Analyze extraction stage issues."""
        if not self.initialized:
            return self._fallback_analysis(document_id, request)
        
        prompt = PromptTemplate(
            input_variables=["extracted_data", "expected_fields", "confidence_scores"],
            template="""
            You are an AI expert analyzing document extraction issues. 

            Extracted Data: {extracted_data}
            Expected Fields: {expected_fields}
            Confidence Scores: {confidence_scores}

            Please analyze the extraction results and provide:
            1. Issues identified (missing fields, low confidence, formatting problems)
            2. Potential causes (OCR quality, document format, model limitations)
            3. Specific recommendations for improvement
            4. Confidence assessment of your analysis (0.0-1.0)

            Return your analysis as JSON with keys: issues, causes, recommendations, confidence.
            """
        )
        
        try:
            formatted_prompt = prompt.format(
                extracted_data=json.dumps(request.input_data.get("extracted_data", {}), indent=2),
                expected_fields=request.input_data.get("expected_fields", []),
                confidence_scores=request.input_data.get("confidence_scores", {})
            )
            
            response = self.llm.invoke(formatted_prompt)
            analysis = json.loads(response.content)
            
            # Store debug session
            session_id = self._store_debug_session(
                document_id, request, analysis, analysis.get("confidence", 0.8)
            )
            
            return DebugResponse(
                session_id=session_id,
                stage=request.stage,
                debug_type=request.debug_type,
                ai_analysis=analysis,
                recommendations=analysis.get("recommendations", []),
                confidence_score=analysis.get("confidence", 0.8)
            )
            
        except Exception as e:
            print(f"Error in extraction analysis: {e}")
            return self._fallback_analysis(document_id, request)
    
    def analyze_reconciliation_issues(self, document_id: int, request: DebugRequest) -> DebugResponse:
        """Analyze reconciliation stage issues."""
        if not self.initialized:
            return self._fallback_analysis(document_id, request)
        
        prompt = PromptTemplate(
            input_variables=["extracted_data", "fetched_data", "reconciliation_result", "strategy"],
            template="""
            You are an AI expert analyzing document reconciliation issues.

            Extracted Data: {extracted_data}
            Fetched Data: {fetched_data}
            Reconciliation Result: {reconciliation_result}
            Strategy Used: {strategy}

            Please analyze the reconciliation process and provide:
            1. Reconciliation issues (mismatches, missing data, score discrepancies)
            2. Root causes (data quality, matching algorithm, threshold settings)
            3. Recommendations to improve reconciliation accuracy
            4. Suggested strategy adjustments
            5. Confidence in your analysis (0.0-1.0)

            Return as JSON with keys: issues, causes, recommendations, strategy_suggestions, confidence.
            """
        )
        
        try:
            formatted_prompt = prompt.format(
                extracted_data=json.dumps(request.input_data.get("extracted_data", {}), indent=2),
                fetched_data=json.dumps(request.input_data.get("fetched_data", {}), indent=2),
                reconciliation_result=json.dumps(request.input_data.get("reconciliation_result", {}), indent=2),
                strategy=request.input_data.get("strategy", "LOOSE")
            )
            
            response = self.llm.invoke(formatted_prompt)
            analysis = json.loads(response.content)
            
            session_id = self._store_debug_session(
                document_id, request, analysis, analysis.get("confidence", 0.8)
            )
            
            return DebugResponse(
                session_id=session_id,
                stage=request.stage,
                debug_type=request.debug_type,
                ai_analysis=analysis,
                recommendations=analysis.get("recommendations", []) + analysis.get("strategy_suggestions", []),
                confidence_score=analysis.get("confidence", 0.8)
            )
            
        except Exception as e:
            print(f"Error in reconciliation analysis: {e}")
            return self._fallback_analysis(document_id, request)
    
    def analyze_hil_feedback(self, document_id: int, request: DebugRequest) -> DebugResponse:
        """Analyze HIL corrections to improve future extractions."""
        if not self.initialized:
            return self._fallback_analysis(document_id, request)
        
        prompt = PromptTemplate(
            input_variables=["original_extraction", "hil_corrections", "correction_notes"],
            template="""
            You are an AI expert analyzing human-in-the-loop corrections to improve extraction quality.

            Original Extraction: {original_extraction}
            HIL Corrections: {hil_corrections}
            Correction Notes: {correction_notes}

            Please analyze the corrections and provide:
            1. Patterns in correction types
            2. Areas where the extraction model consistently fails
            3. Training data recommendations
            4. Model parameter adjustments
            5. Process improvements
            6. Confidence in analysis (0.0-1.0)

            Return as JSON with keys: patterns, failure_areas, training_recommendations, model_adjustments, process_improvements, confidence.
            """
        )
        
        try:
            formatted_prompt = prompt.format(
                original_extraction=json.dumps(request.input_data.get("original_extraction", {}), indent=2),
                hil_corrections=json.dumps(request.input_data.get("hil_corrections", {}), indent=2),
                correction_notes=request.input_data.get("correction_notes", "")
            )
            
            response = self.llm.invoke(formatted_prompt)
            analysis = json.loads(response.content)
            
            session_id = self._store_debug_session(
                document_id, request, analysis, analysis.get("confidence", 0.8)
            )
            
            recommendations = []
            for key in ["training_recommendations", "model_adjustments", "process_improvements"]:
                if key in analysis:
                    if isinstance(analysis[key], list):
                        recommendations.extend(analysis[key])
                    else:
                        recommendations.append(str(analysis[key]))
            
            return DebugResponse(
                session_id=session_id,
                stage=request.stage,
                debug_type=request.debug_type,
                ai_analysis=analysis,
                recommendations=recommendations,
                confidence_score=analysis.get("confidence", 0.8)
            )
            
        except Exception as e:
            print(f"Error in HIL analysis: {e}")
            return self._fallback_analysis(document_id, request)
    
    def analyze_pipeline_performance(self, document_id: int, request: DebugRequest) -> DebugResponse:
        """Analyze overall pipeline performance for a document."""
        if not self.initialized:
            return self._fallback_analysis(document_id, request)
        
        prompt = PromptTemplate(
            input_variables=["pipeline_data", "timing_data", "error_logs"],
            template="""
            You are an AI expert analyzing document processing pipeline performance.

            Pipeline Data: {pipeline_data}
            Timing Data: {timing_data}
            Error Logs: {error_logs}

            Please analyze the pipeline performance and provide:
            1. Performance bottlenecks
            2. Error patterns
            3. Optimization opportunities
            4. Resource utilization insights
            5. Scalability recommendations
            6. Confidence in analysis (0.0-1.0)

            Return as JSON with keys: bottlenecks, error_patterns, optimizations, resource_insights, scalability, confidence.
            """
        )
        
        try:
            formatted_prompt = prompt.format(
                pipeline_data=json.dumps(request.input_data.get("pipeline_data", {}), indent=2),
                timing_data=json.dumps(request.input_data.get("timing_data", {}), indent=2),
                error_logs=request.input_data.get("error_logs", "")
            )
            
            response = self.llm.invoke(formatted_prompt)
            analysis = json.loads(response.content)
            
            session_id = self._store_debug_session(
                document_id, request, analysis, analysis.get("confidence", 0.8)
            )
            
            recommendations = []
            for key in ["optimizations", "scalability"]:
                if key in analysis:
                    if isinstance(analysis[key], list):
                        recommendations.extend(analysis[key])
                    else:
                        recommendations.append(str(analysis[key]))
            
            return DebugResponse(
                session_id=session_id,
                stage=request.stage,
                debug_type=request.debug_type,
                ai_analysis=analysis,
                recommendations=recommendations,
                confidence_score=analysis.get("confidence", 0.8)
            )
            
        except Exception as e:
            print(f"Error in performance analysis: {e}")
            return self._fallback_analysis(document_id, request)
    
    def _store_debug_session(self, document_id: int, request: DebugRequest, 
                           analysis: Dict[str, Any], confidence: float) -> int:
        """Store debug session in database."""
        try:
            with Session(get_session().bind) as session:
                debug_session = DebugSession(
                    document_id=document_id,
                    stage=request.stage,
                    debug_type=request.debug_type,
                    input_data=request.input_data,
                    ai_analysis=analysis,
                    recommendations=analysis.get("recommendations", []),
                    created_at=datetime.utcnow()
                )
                
                session.add(debug_session)
                session.commit()
                session.refresh(debug_session)
                
                return debug_session.id
        except Exception as e:
            print(f"Error storing debug session: {e}")
            return 0
    
    def _fallback_analysis(self, document_id: int, request: DebugRequest) -> DebugResponse:
        """Fallback analysis when AI service is not available."""
        analysis = {
            "status": "fallback_mode",
            "message": "AI debugging service unavailable, using rule-based analysis",
            "basic_checks": self._perform_basic_checks(request.input_data),
            "confidence": 0.3
        }
        
        session_id = self._store_debug_session(document_id, request, analysis, 0.3)
        
        return DebugResponse(
            session_id=session_id,
            stage=request.stage,
            debug_type=request.debug_type,
            ai_analysis=analysis,
            recommendations=["Enable AI service for detailed analysis", "Check system logs for errors"],
            confidence_score=0.3
        )
    
    def _perform_basic_checks(self, input_data: Dict[str, Any]) -> List[str]:
        """Perform basic rule-based checks."""
        checks = []
        
        if "extracted_data" in input_data:
            extracted = input_data["extracted_data"]
            if not extracted:
                checks.append("No data extracted")
            elif len(extracted) < 3:
                checks.append("Very few fields extracted")
        
        if "confidence_scores" in input_data:
            scores = input_data["confidence_scores"]
            if scores and isinstance(scores, dict):
                avg_confidence = sum(scores.values()) / len(scores)
                if avg_confidence < 0.7:
                    checks.append("Low average confidence scores")
        
        if "reconciliation_result" in input_data:
            result = input_data["reconciliation_result"]
            if result and isinstance(result, dict):
                if result.get("score_overall", 0) < 0.8:
                    checks.append("Low reconciliation score")
        
        return checks if checks else ["Basic validation passed"]

    def get_debug_history(self, document_id: int) -> List[DebugResponse]:
        """Get debug history for a document."""
        try:
            with Session(get_session().bind) as session:
                stmt = session.query(DebugSession).filter(
                    DebugSession.document_id == document_id
                ).order_by(DebugSession.created_at.desc())
                
                debug_sessions = stmt.all()
                
                return [
                    DebugResponse(
                        session_id=ds.id,
                        stage=ds.stage,
                        debug_type=ds.debug_type,
                        ai_analysis=ds.ai_analysis,
                        recommendations=ds.recommendations,
                        confidence_score=ds.ai_analysis.get("confidence", 0.0)
                    )
                    for ds in debug_sessions
                ]
        except Exception as e:
            print(f"Error getting debug history: {e}")
            return []


# Global instance
debug_service = DebugService()
