export interface ClassificationResult {
  type: string;
  confidence: number;
}

export interface ProcessingResult {
  classification: ClassificationResult;
  data: Record<string, any>;
  raw_text?: string;
}

export interface ProcessedDocument {
  id: string;
  fileName: string;
  uploadedAt: string;
  status: 'pending' | 'processing' | 'processed' | 'error';
  result?: ProcessingResult;
  error?: string;
  forcedType?: string;
}

export const DOCUMENT_TYPES = [
  { value: '', label: 'Auto-detect' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'insurance_card', label: 'Insurance Card' },
  { value: 'w2', label: 'W-2 Tax Form' },
  { value: 'resume', label: 'Resume/CV' },
  { value: 'purchase_order', label: 'Purchase Order' },
  { value: 'other', label: 'Other' },
];
