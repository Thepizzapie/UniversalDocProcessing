import { ProcessedDocument } from '../types';

const STORAGE_KEY = 'udp_documents';

export const getDocuments = (): ProcessedDocument[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const saveDocument = (doc: ProcessedDocument): void => {
  const docs = getDocuments();
  const existingIndex = docs.findIndex(d => d.id === doc.id);
  
  if (existingIndex >= 0) {
    docs[existingIndex] = doc;
  } else {
    docs.push(doc);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
};

export const updateDocument = (id: string, updates: Partial<ProcessedDocument>): void => {
  const docs = getDocuments();
  const index = docs.findIndex(d => d.id === id);
  
  if (index >= 0) {
    docs[index] = { ...docs[index], ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  }
};

export const deleteDocument = (id: string): void => {
  const docs = getDocuments().filter(d => d.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
};

export const getDocumentById = (id: string): ProcessedDocument | undefined => {
  return getDocuments().find(d => d.id === id);
};
