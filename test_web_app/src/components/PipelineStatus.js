import React from 'react';
import { 
  FileText, 
  User, 
  Download, 
  GitCompare, 
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';

const PipelineStatus = ({ currentState, document }) => {
  const steps = [
    {
      id: 'INGESTED',
      name: 'Ingested',
      icon: FileText,
      description: 'Document uploaded and processed'
    },
    {
      id: 'HIL_REQUIRED',
      name: 'HIL Required',
      icon: User,
      description: 'Human review needed'
    },
    {
      id: 'HIL_CONFIRMED',
      name: 'HIL Confirmed',
      icon: CheckCircle,
      description: 'Human review completed'
    },
    {
      id: 'FETCH_PENDING',
      name: 'Fetch Pending',
      icon: Clock,
      description: 'Fetching external data'
    },
    {
      id: 'FETCHED',
      name: 'Fetched',
      icon: Download,
      description: 'External data retrieved'
    },
    {
      id: 'RECONCILED',
      name: 'Reconciled',
      icon: GitCompare,
      description: 'Data reconciliation completed'
    },
    {
      id: 'FINAL_REVIEW',
      name: 'Final Review',
      icon: AlertTriangle,
      description: 'Awaiting final decision'
    },
    {
      id: 'APPROVED',
      name: 'Approved',
      icon: CheckCircle,
      description: 'Processing approved'
    },
    {
      id: 'REJECTED',
      name: 'Rejected',
      icon: XCircle,
      description: 'Processing rejected'
    }
  ];

  const getStepStatus = (stepId) => {
    const stepIndex = steps.findIndex(s => s.id === stepId);
    const currentIndex = steps.findIndex(s => s.id === currentState);
    
    if (currentState === 'FAILED') {
      return stepIndex <= currentIndex ? 'error' : 'pending';
    }
    
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-500 dark:bg-green-400 text-white';
      case 'current': return 'bg-accent-500 dark:bg-accent-400 text-white';
      case 'error': return 'bg-red-500 dark:bg-red-400 text-white';
      default: return 'bg-primary-300 dark:bg-primary-600 text-primary-500 dark:text-primary-300';
    }
  };

  const getStepColor = (status) => {
    switch (status) {
      case 'completed': return 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900';
      case 'current': return 'border-accent-200 dark:border-accent-800 bg-accent-50 dark:bg-accent-900';
      case 'error': return 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900';
      default: return 'border-primary-200 dark:border-primary-700 bg-primary-50 dark:bg-primary-800';
    }
  };

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-primary mb-6">Pipeline Status</h3>
      
      <div className="space-y-4">
        {steps.map((step, index) => {
          const status = getStepStatus(step.id);
          const Icon = step.icon;
          
          return (
            <div 
              key={step.id}
              className={`flex items-center p-4 rounded-lg border-2 transition-colors ${getStepColor(status)}`}
            >
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${getStatusColor(status)}`}>
                <Icon className="h-5 w-5" />
              </div>
              
              <div className="ml-4 flex-1">
                <h4 className="text-sm font-medium text-primary">{step.name}</h4>
                <p className="text-sm text-secondary">{step.description}</p>
              </div>
              
              <div className="flex-shrink-0">
                {status === 'completed' && (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                )}
                {status === 'current' && (
                  <Clock className="h-6 w-6 text-accent-500" />
                )}
                {status === 'error' && (
                  <XCircle className="h-6 w-6 text-red-500" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PipelineStatus;
