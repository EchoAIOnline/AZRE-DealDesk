import React, { useState, useCallback, useRef } from 'react';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface UseAutoSaveProps {
    onSave: () => Promise<any>;
}

export const useAutoSave = ({ onSave }: UseAutoSaveProps) => {
    const [showSavedNotification, setShowSavedNotification] = useState(false);
    const [showErrorNotification, setShowErrorNotification] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const isSavingRef = useRef(false);
    const isDirtyRef = useRef(false);
    const onSaveRef = useRef(onSave);

    // Keep onSaveRef up to date
    React.useEffect(() => {
        onSaveRef.current = onSave;
    }, [onSave]);

    const triggerSave = useCallback(async () => {
        if (isSavingRef.current) {
            isDirtyRef.current = true; // Queue the save
            return;
        }
        
        isSavingRef.current = true;
        setIsSaving(true);
        setShowSavedNotification(false);
        setShowErrorNotification(false);
        setErrorMessage(null);

        try {
            await onSaveRef.current();
            setShowSavedNotification(true);
            setTimeout(() => setShowSavedNotification(false), 2000);
        } catch (error: any) {
            console.warn("Auto-save failed:", error);
            setErrorMessage(error.message || "Please check connection");
            setShowErrorNotification(true);
            setTimeout(() => setShowErrorNotification(false), 4000);
        } finally {
            isSavingRef.current = false;
            setIsSaving(false);
            
            // If another save was requested while we were saving, fire it now
            if (isDirtyRef.current) {
                isDirtyRef.current = false;
                triggerSave();
            }
        }
    }, []);

    const handleAutoSave = useCallback(() => {
        triggerSave();
    }, [triggerSave]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent | KeyboardEvent) => {
        const target = e.target as HTMLElement;
        const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
        if (e.key === 'Enter' && isInput) {
            // Ignore for Textareas to allow multi-line input
            if (target.tagName === 'TEXTAREA') return; 
            
            // If default is prevented (e.g. by specific Enter handlers like adding a log), do not blur.
            if (e.defaultPrevented) return;

            e.preventDefault();
            target.blur(); // Triggers onBlur which should call handleAutoSave/triggerSave
            triggerSave(); 
         }
        
        // Save Shortcut (S or Ctrl+S)
        if ((e.key.toLowerCase() === 's' && (e.metaKey || e.ctrlKey))) {
            e.preventDefault();
            triggerSave();
        }
    }, [triggerSave]);

    return {
        triggerSave,
        handleAutoSave,
        handleKeyDown,
        showSavedNotification,
        setShowSavedNotification,
        showErrorNotification,
        errorMessage,
        isSaving
    };
};

export const SavedNotification: React.FC<{ show: boolean, error?: boolean, errorMessage?: string | null }> = ({ show, error, errorMessage }) => {
    if (!show && !error) return null;
    
    if (error) {
        return (
            <div className="absolute top-20 right-8 bg-red-600 text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 z-[90] pointer-events-none border border-red-500">
                <AlertCircle size={20} className="text-white" />
                <div>
                    <div className="font-bold text-sm">Save Failed</div>
                    <div className="text-xs text-red-100">{errorMessage || "Please check connection"}</div>
                </div>
            </div>
        );
    }

    if (show) {
        return (
            <div className="absolute top-20 right-8 bg-green-600 text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 z-[90] pointer-events-none">
                <CheckCircle size={20} className="text-white" />
                <div>
                    <div className="font-bold text-sm">Success</div>
                    <div className="text-xs text-green-100">Changes Saved</div>
                </div>
            </div>
        );
    }
    
    return null;
};