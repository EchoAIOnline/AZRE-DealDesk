import React, { useState, useEffect } from 'react';
import { useUploadStore } from '../store/useUploadStore';
import { Loader2, CheckCircle, XCircle, X, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';

export const UploadQueue: React.FC = () => {
  const { uploads, removeUpload, clearCompleted } = useUploadStore();
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    if (uploads.length === 0) return;
    
    const uploadingCount = uploads.filter(u => u.status === 'uploading').length;
    const errorCount = uploads.filter(u => u.status === 'error').length;
    
    if (uploadingCount === 0 && errorCount === 0) {
      const timer = setTimeout(() => {
        clearCompleted();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [uploads, clearCompleted]);

  if (uploads.length === 0) return null;

  const uploadingCount = uploads.filter(u => u.status === 'uploading').length;

  return (
    <div className="fixed bottom-6 right-6 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-[9999] flex flex-col max-h-[400px]">
      <div 
        className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-2">
          {uploadingCount > 0 ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          ) : (
            <CheckCircle className="h-4 w-4 text-green-500" />
          )}
          <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
            {uploadingCount > 0 
              ? `Uploading ${uploadingCount} file${uploadingCount !== 1 ? 's' : ''}...` 
              : 'Uploads complete'}
          </span>
        </div>
        <div className="flex items-center space-x-1">
          {uploads.some(u => u.status !== 'uploading') && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                clearCompleted();
              }}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md text-gray-500 dark:text-gray-400"
              title="Clear completed"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md text-gray-500 dark:text-gray-400">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="overflow-y-auto p-2 space-y-2 flex-1">
          {uploads.map((upload) => (
            <div key={upload.id} className="flex items-start justify-between p-2 bg-gray-50 dark:bg-gray-900/50 rounded border border-gray-100 dark:border-gray-800">
              <div className="flex items-start space-x-3 overflow-hidden">
                <div className="mt-0.5 flex-shrink-0">
                  {upload.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                  {upload.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                  {upload.status === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {upload.name}
                  </p>
                  {upload.status === 'error' && (
                    <p className="text-xs text-red-500 mt-1 line-clamp-2" title={upload.error}>
                      {upload.error}
                    </p>
                  )}
                  {upload.status === 'success' && (
                    <p className="text-xs text-green-500 mt-0.5">
                      Completed
                    </p>
                  )}
                </div>
              </div>
              {upload.status !== 'uploading' && (
                <button
                  onClick={() => removeUpload(upload.id)}
                  className="ml-2 p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
