import axios from 'axios';
import { ProcessingResult } from '../types';

const API_BASE_URL = 'http://localhost:5001';

export const api = axios.create({
  baseURL: API_BASE_URL,
  // Don't set Content-Type header - axios will set it automatically with correct boundary for FormData
});

export const classifyExtract = async (
  file: File,
  docType?: string,
  returnText: boolean = false
): Promise<ProcessingResult> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('return_text', returnText.toString());
  formData.append('refine', 'true');
  formData.append('ocr_fallback', 'true');
  
  if (docType) {
    formData.append('doc_type', docType);
  }

  const response = await api.post<ProcessingResult>('/classify-extract', formData);
  return response.data;
};

export const checkHealth = async (): Promise<{ status: string; service: string }> => {
  const response = await api.get('/health');
  return response.data;
};
