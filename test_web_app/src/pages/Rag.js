import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Sparkles, ArrowLeft, Clock, Zap, Shield, Brain, BookOpen } from 'lucide-react';

// Coming Soon splash page for Recon RAG Knowledgebase
const Rag = () => {
  const navigate = useNavigate();



  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate(-1)} className="mr-4 p-2 text-muted hover:text-primary">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <Database className="h-8 w-8 text-accent-500 mr-3" />
            <div>
              <h1 className="text-3xl font-bold text-primary">Recon RAG Knowledgebase</h1>
              <p className="mt-2 text-secondary">AI-Powered Reconciliation Agent for Document Validation</p>
            </div>
          </div>
        </div>
      </div>

      {/* Coming Soon Hero */}
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-primary mb-4">Coming Soon</h2>
        <p className="text-xl text-secondary max-w-2xl mx-auto">
          We're building an intelligent reconciliation agent that uses historical document patterns to validate extracted data, identify special cases, and replace manual review processes.
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
        {/* Feature 1 */}
        <div className="card text-center">
          <div className="w-16 h-16 bg-accent-100 dark:bg-accent-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <Brain className="h-8 w-8 text-accent-600" />
          </div>
          <h3 className="text-lg font-semibold text-primary mb-2">Pattern Recognition</h3>
          <p className="text-secondary text-sm">
            Learns from historical reconciliation data to identify patterns, special cases, and anomalies that might be missed by standard extraction.
          </p>
        </div>

        {/* Feature 2 */}
        <div className="card text-center">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap className="h-8 w-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-primary mb-2">Smart Validation</h3>
          <p className="text-secondary text-sm">
            Cross-references extracted data against similar approved documents to validate accuracy and flag potential discrepancies.
          </p>
          </div>

        {/* Feature 3 */}
        <div className="card text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-green-600" />
            </div>
          <h3 className="text-lg font-semibold text-primary mb-2">Automated Review</h3>
          <p className="text-secondary text-sm">
            Reduces manual review workload by automatically approving routine documents and flagging only those requiring human attention.
          </p>
            </div>

        {/* Feature 4 */}
        <div className="card text-center">
          <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="h-8 w-8 text-purple-600" />
          </div>
          <h3 className="text-lg font-semibold text-primary mb-2">Statement Reconciliation</h3>
          <p className="text-secondary text-sm">
            Compares extracted invoice data against bank statements and other financial documents to ensure complete reconciliation.
          </p>
          </div>

        {/* Feature 5 */}
        <div className="card text-center">
          <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <Database className="h-8 w-8 text-orange-600" />
          </div>
          <h3 className="text-lg font-semibold text-primary mb-2">Exception Detection</h3>
          <p className="text-secondary text-sm">
            Identifies unusual patterns, special cases, and potential errors that deviate from established document processing norms.
          </p>
          </div>

        {/* Feature 6 */}
        <div className="card text-center">
          <div className="w-16 h-16 bg-teal-100 dark:bg-teal-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="h-8 w-8 text-teal-600" />
          </div>
          <h3 className="text-lg font-semibold text-primary mb-2">Confidence Scoring</h3>
          <p className="text-secondary text-sm">
            Provides confidence scores for each reconciliation decision, helping prioritize manual reviews for high-risk discrepancies.
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="card mb-8">
        <h3 className="text-xl font-semibold text-primary mb-6 text-center">Development Roadmap</h3>
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0 w-4 h-4 bg-accent-500 rounded-full"></div>
            <div className="flex-1">
              <h4 className="font-medium text-primary">Phase 1: Reconciliation Engine</h4>
              <p className="text-secondary text-sm">Building the core reconciliation agent with document comparison and basic pattern recognition capabilities.</p>
              <span className="text-xs text-accent-600 font-medium">In Development</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0 w-4 h-4 bg-gray-300 rounded-full"></div>
            <div className="flex-1">
              <h4 className="font-medium text-primary">Phase 2: Smart Validation</h4>
              <p className="text-secondary text-sm">Adding advanced validation algorithms, exception detection, and automated approval workflows.</p>
              <span className="text-xs text-muted">Coming Next</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0 w-4 h-4 bg-gray-300 rounded-full"></div>
            <div className="flex-1">
              <h4 className="font-medium text-primary">Phase 3: Enterprise Reconciliation</h4>
              <p className="text-secondary text-sm">Full enterprise integration with multi-document reconciliation, audit trails, and advanced reporting.</p>
              <span className="text-xs text-muted">Future Release</span>
            </div>
                          </div>
                        </div>
                      </div>

      {/* Call to Action */}
      <div className="text-center">
        <div className="card max-w-2xl mx-auto">
          <h3 className="text-xl font-semibold text-primary mb-4">Stay Tuned!</h3>
          <p className="text-secondary mb-6">
            We're building a revolutionary reconciliation system that will transform how you validate document extractions.
            Say goodbye to manual review bottlenecks and hello to intelligent, automated reconciliation workflows.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="btn btn-primary"
            >
              Return to Dashboard
            </button>
            <button
              onClick={() => navigate('/doc-types')}
              className="btn btn-secondary"
            >
              Explore Document Types
                        </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Rag;
