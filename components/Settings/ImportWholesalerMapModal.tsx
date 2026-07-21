import React, { useState, useEffect, useRef } from 'react';
import { X, Save, ArrowRight, FileSpreadsheet, AlertCircle, Loader2, Check } from 'lucide-react';
import { Wholesaler } from '../../types';
import { api } from '../../services/api';
import { generateId, getLogTimestamp, formatPhoneNumber } from '../../services/utils';

// Access global XLSX from CDN
declare const XLSX: any;

interface ImportWholesalerMapModalProps {
    file: File;
    onClose: () => void;
    onImport: (wholesalers: Wholesaler[]) => void;
}

const FIELD_DEFINITIONS: { key: string, label: string, aliases: string[], type: 'string' }[] = [
    { key: 'name', label: 'Wholesaler Name', aliases: ['name', 'wholesaler', 'full name', 'wholesaler name', 'contact'], type: 'string' },
    { key: 'companyName', label: 'Company Name', aliases: ['company', 'companyName', 'agency', 'brokerage', 'firm', 'office', 'wholesaler company'], type: 'string' },
    { key: 'phone', label: 'Phone Number', aliases: ['phone', 'mobile', 'cell', 'phone number', 'contact phone', 'wholesaler phone'], type: 'string' },
    { key: 'email', label: 'Email Address', aliases: ['email', 'mail', 'wholesaler email', 'contact email', 'email address'], type: 'string' },
    { key: 'status', label: 'Status', aliases: ['status', 'stage', 'tier'], type: 'string' },
    { key: 'notes', label: 'Notes', aliases: ['notes', 'remarks', 'comments', 'description'], type: 'string' },
];

export const ImportWholesalerMapModal: React.FC<ImportWholesalerMapModalProps> = ({ file, onClose, onImport }) => {
    const [step, setStep] = useState<'analyzing' | 'mapping'>('analyzing');
    const [headers, setHeaders] = useState<string[]>([]);
    const [rawData, setRawData] = useState<any[][]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({}); 
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState<{current: number, total: number} | null>(null);
    
    const processedFileRef = useRef<File | null>(null);

    useEffect(() => {
        if (!file) return;
        if (file === processedFileRef.current) return;
        
        processedFileRef.current = file;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]; 
                
                if (jsonData && jsonData.length > 0) {
                    const fileHeaders = jsonData[0].map(h => String(h));
                    const fileRows = jsonData.slice(1).filter(r => r.length > 0);
                    
                    setHeaders(fileHeaders);
                    setRawData(fileRows);
                    
                    // Smart Mapping Logic
                    const initialMapping: Record<string, string> = {};
                    fileHeaders.forEach((header, idx) => {
                        const normHeader = header.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
                        
                        const match = FIELD_DEFINITIONS.find(def => 
                            def.aliases.some(alias => {
                                const normAlias = alias.replace(/[^a-z0-9]/g, '');
                                return normHeader === normAlias || normHeader.includes(normAlias) || normAlias.includes(normHeader);
                            })
                        );
                        
                        if (match) {
                            initialMapping[idx.toString()] = match.key;
                        }
                    });
                    
                    setMapping(initialMapping);
                    setStep('mapping');
                } else {
                    alert('File appears to be empty');
                    onClose();
                }
            } catch (err) {
                console.error("Error parsing file", err);
                alert("Failed to parse file. Please ensure it is a valid CSV or Excel file.");
                onClose();
            }
        };
        reader.readAsBinaryString(file);
    }, [file, onClose]);

    const handleMappingChange = (headerIndex: string, fieldKey: string) => {
        setMapping(prev => ({
            ...prev,
            [headerIndex]: fieldKey
        }));
    };

    const processImport = async () => {
        setImporting(true);
        try {
            const newWholesalers: Wholesaler[] = rawData.map(row => {
                const wholesaler: any = {
                    id: generateId(),
                    notes: [`${getLogTimestamp()}: Imported from ${file.name}`]
                };

                // Apply mappings
                Object.entries(mapping).forEach(([colIdx, key]) => {
                    const fieldKey = key as string;
                    const val = row[parseInt(colIdx)];
                    
                    if (val !== undefined && val !== null && fieldKey) {
                        const strVal = String(val).trim();
                        
                        if (fieldKey === 'notes') {
                            wholesaler.notes.push(strVal);
                        } else if (fieldKey === 'phone') {
                            wholesaler[fieldKey] = formatPhoneNumber(strVal);
                        } else if (fieldKey === 'name') {
                             // Title Case
                             wholesaler[fieldKey] = strVal.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
                        } else {
                            wholesaler[fieldKey] = strVal;
                        }
                    }
                });

                // Defaults
                if (!wholesaler.name) wholesaler.name = 'Unknown Wholesaler';
                if (!wholesaler.companyName) wholesaler.companyName = '';
                if (!wholesaler.phone) wholesaler.phone = '';
                if (!wholesaler.email) wholesaler.email = '';
                if (!wholesaler.status) wholesaler.status = 'New';
                if (!wholesaler.wholesalerType) wholesaler.wholesalerType = 'Acquisitions';

                return wholesaler as Wholesaler;
            });

            setImportProgress({ current: 0, total: newWholesalers.length });

            const chunkSize = 50;
            let savedWholesalers: Wholesaler[] = [];
            for (let i = 0; i < newWholesalers.length; i += chunkSize) {
                const chunk = newWholesalers.slice(i, i + chunkSize);
                const savedChunk = await api.saveBatch(chunk, 'Wholesalers');
                if (savedChunk) {
                    savedWholesalers = [...savedWholesalers, ...savedChunk];
                }
                setImportProgress({ current: Math.min(i + chunkSize, newWholesalers.length), total: newWholesalers.length });
            }

            onImport(savedWholesalers);
        } catch (error) {
            console.error("Error processing import:", error);
            alert("There was an error processing the import data.");
            setImporting(false);
            setImportProgress(null);
        }
    };

    if (step === 'analyzing') {
        return (
            <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white dark:bg-gray-900 rounded-xl p-8 flex flex-col items-center">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                    <p className="text-gray-900 dark:text-white">Analyzing file structure...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-4xl border border-gray-200 dark:border-gray-700 shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-end items-center gap-4 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <FileSpreadsheet className="text-blue-600 dark:text-blue-500" /> 
                            Import Wholesalers
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Map columns from <span className="text-gray-900 dark:text-white font-mono">{file.name}</span> to DealDesk fields.
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-white"><X size={24}/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-gray-900">
                    <div className="space-y-6">
                        {/* Mapping Grid */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <div className="grid grid-cols-12 gap-4 p-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                <div className="col-span-5">File Header</div>
                                <div className="col-span-2 text-center flex justify-center"><ArrowRight size={14}/></div>
                                <div className="col-span-5">DealDesk Field</div>
                            </div>
                            
                            {headers.map((header, idx) => {
                                const isMapped = !!mapping[idx.toString()];
                                return (
                                    <div key={idx} className={`grid grid-cols-12 gap-4 p-3 items-center border-b border-gray-100 dark:border-gray-700/50 last:border-0 ${isMapped ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                                        <div className="col-span-5">
                                            <div className="font-medium text-gray-900 dark:text-white truncate" title={header}>{header}</div>
                                            <div className="text-[10px] text-gray-500 truncate mt-0.5">Example: {rawData[0]?.[idx] || '(Empty)'}</div>
                                        </div>
                                        <div className="col-span-2 flex justify-center text-gray-600">
                                            {isMapped ? <Check size={16} className="text-green-600 dark:text-green-500"/> : <ArrowRight size={16}/>}
                                        </div>
                                        <div className="col-span-5">
                                            <select 
                                                className={`w-full bg-white dark:bg-gray-900 border rounded p-2 text-sm outline-none transition-colors ${isMapped ? 'border-blue-500/50 text-blue-600 dark:text-blue-300' : 'border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400'}`}
                                                value={mapping[idx.toString()] || ''}
                                                onChange={(e) => handleMappingChange(idx.toString(), e.target.value)}
                                            >
                                                <option value="">(Skip Column)</option>
                                                {FIELD_DEFINITIONS.map(field => (
                                                    <option key={field.key} value={field.key}>{field.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/50 p-4 rounded-lg flex items-start gap-3">
                            <AlertCircle className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" size={18} />
                            <div>
                                <h4 className="text-sm font-bold text-blue-600 dark:text-blue-400">Smart Mapping Active</h4>
                                <p className="text-xs text-blue-800 dark:text-blue-200 mt-1">
                                    We've automatically matched {Object.keys(mapping).length} columns based on your file headers.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end items-center gap-4 shrink-0">
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        {importProgress && (
                            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                <Loader2 size={16} className="animate-spin" />
                                <span>Importing... {importProgress.current} / {importProgress.total}</span>
                            </div>
                        )}
                        {!importProgress && importing && (
                            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                <Loader2 size={16} className="animate-spin" />
                                <span>Preparing import...</span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <button onClick={onClose} disabled={importing} className="px-4 py-2 rounded text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">Cancel</button>
                    <button 
                        onClick={processImport} 
                        disabled={importing || Object.keys(mapping).length === 0}
                        className="bg-green-600 hover:bg-green-500 text-white px-8 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {importing ? <Loader2 className="animate-spin" size={18}/> : <Save size={18} />}
                        Import {rawData.length} Wholesalers
                    </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
