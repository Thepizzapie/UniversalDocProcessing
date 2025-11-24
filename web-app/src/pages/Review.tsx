import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDocumentById, updateDocument } from '../services/storage';
import { ProcessedDocument } from '../types';

const Review: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<ProcessedDocument | null>(null);
  const [editedData, setEditedData] = useState<Record<string, any>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (id) {
      const doc = getDocumentById(id);
      if (doc) {
        setDocument(doc);
        setEditedData(doc.result?.data || {});
      } else {
        navigate('/dashboard');
      }
    }
  }, [id, navigate]);

  const handleFieldChange = (key: string, value: any) => {
    setEditedData((prev) => ({
      ...prev,
      [key]: value,
    }));
    setSaved(false);
  };

  const handleSave = () => {
    if (document && document.result) {
      const updatedDoc: ProcessedDocument = {
        ...document,
        result: {
          ...document.result,
          data: editedData,
        },
      };
      updateDocument(document.id, updatedDoc);
      setDocument(updatedDoc);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const renderField = (key: string, value: any): JSX.Element => {
    if (Array.isArray(value)) {
      return (
        <div key={key} className="mb-4 p-4 bg-gray-50 rounded-md">
          <label className="block text-sm font-medium text-gray-700 mb-2">{key}</label>
          <div className="space-y-2">
            {value.map((item, index) => (
              <div key={index} className="pl-4 border-l-2 border-gray-300">
                {typeof item === 'object' ? (
                  Object.entries(item).map(([k, v]) => (
                    <div key={k} className="mb-2">
                      <span className="text-xs text-gray-500">{k}:</span>
                      <input
                        type="text"
                        value={String(v)}
                        onChange={(e) => {
                          const newArray = [...value];
                          newArray[index] = { ...item, [k]: e.target.value };
                          handleFieldChange(key, newArray);
                        }}
                        className="ml-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>
                  ))
                ) : (
                  <input
                    type="text"
                    value={String(item)}
                    onChange={(e) => {
                      const newArray = [...value];
                      newArray[index] = e.target.value;
                      handleFieldChange(key, newArray);
                    }}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (typeof value === 'object' && value !== null) {
      return (
        <div key={key} className="mb-4 p-4 bg-gray-50 rounded-md">
          <label className="block text-sm font-medium text-gray-700 mb-2">{key}</label>
          {Object.entries(value).map(([k, v]) => renderField(`${key}.${k}`, v))}
        </div>
      );
    }

    return (
      <div key={key} className="mb-4">
        <label htmlFor={key} className="block text-sm font-medium text-gray-700 mb-2">
          {key}
        </label>
        <input
          type="text"
          id={key}
          value={String(value)}
          onChange={(e) => handleFieldChange(key, e.target.value)}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        />
      </div>
    );
  };

  if (!document) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-blue-600 hover:text-blue-800 mb-2 flex items-center"
          >
            <svg
              className="w-5 h-5 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-800">Review Document</h1>
          <p className="text-gray-600 mt-1">{document.fileName}</p>
        </div>
        <button
          onClick={handleSave}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium flex items-center"
        >
          {saved ? (
            <>
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Saved
            </>
          ) : (
            'Save Changes'
          )}
        </button>
      </div>

      {/* Classification Info */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Classification</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-gray-500">Document Type:</span>
            <p className="text-lg font-medium text-gray-900 capitalize">
              {document.result?.classification.type.replace('_', ' ')}
            </p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Confidence:</span>
            <p className="text-lg font-medium text-gray-900">
              {(document.result!.classification.confidence * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Extracted Data */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Extracted Data</h2>
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          {Object.entries(editedData).map(([key, value]) => renderField(key, value))}
        </form>
      </div>

      {/* Raw Text (if available) */}
      {document.result?.raw_text && (
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Raw OCR Text</h2>
          <pre className="bg-gray-50 p-4 rounded-md text-sm overflow-auto max-h-96 whitespace-pre-wrap">
            {document.result.raw_text}
          </pre>
        </div>
      )}
    </div>
  );
};

export default Review;
