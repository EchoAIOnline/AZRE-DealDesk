
import React, { useState, useEffect, useRef } from 'react';
import { X, Save, ArrowRight, FileSpreadsheet, AlertCircle, Loader2, Check, ArrowDown } from 'lucide-react';
import { Deal, Comparable } from '../../types';
import { generateId, getLogTimestamp, parseNumberFromCurrency, formatCurrency } from '../../services/utils';

// Access global XLSX from CDN
declare const XLSX: any;

interface ImportMapModalProps {
    file: File;
    onClose: () => void;
    onImport: (deals: Deal[]) => void;
}

const FIELD_DEFINITIONS: { key: string, label: string, aliases: string[], type: 'string' | 'number' | 'array' }[] = [
    { key: 'address', label: 'Property Address', aliases: ['address', 'street', 'location', 'addr', 'property address', 'prop addr'], type: 'string' },
    { key: 'subMarket', label: 'City / Sub-Market', aliases: ['sub market', 'submarket', 'city', 'market', 'town', 'area', 'municipality'], type: 'string' },
    { key: 'county', label: 'County', aliases: ['county', 'cnty'], type: 'string' },
    { key: 'state', label: 'State', aliases: ['state', 'st'], type: 'string' },
    { key: 'zip', label: 'Zip Code', aliases: ['zip', 'zip code', 'postal code'], type: 'string' },
    { key: 'mls', label: 'MLS Number', aliases: ['mls', 'mls #', 'mls id', 'listing id', 'mls number'], type: 'string' },
    { key: 'listPrice', label: 'List Price', aliases: ['list price', 'price', 'asking price', 'current price', 'amount', 'listing price'], type: 'number' },
    { key: 'offerPrice', label: 'My Offer Price', aliases: ['offer', 'my offer', 'offer price', 'offer amount'], type: 'number' },
    { key: 'originalAskingPrice', label: 'Original Ask', aliases: ['original', 'orig price', 'start price', 'original list price'], type: 'number' },
    { key: 'agentName', label: 'Agent Name', aliases: ['agent', 'agent name', 'listing agent', 'realtor', 'broker name'], type: 'string' },
    { key: 'agentPhone', label: 'Agent Phone', aliases: ['agent phone', 'phone', 'mobile', 'contact', 'cell'], type: 'string' },
    { key: 'agentEmail', label: 'Agent Email', aliases: ['agent email', 'email', 'contact email'], type: 'string' },
    { key: 'agentBrokerage', label: 'Brokerage', aliases: ['brokerage', 'broker', 'agency', 'company', 'office', 'firm'], type: 'string' },
    { key: 'acquisitionManager', label: 'Acquisition Manager', aliases: ['acq manager', 'manager', 'assigned to', 'acquisition', 'acq', 'rep', 'acquisitions manager', 'buyer agent'], type: 'string' },
    { key: 'offerDecision', label: 'Pipeline Status', aliases: ['status', 'pipeline status', 'stage', 'decision', 'offer status'], type: 'string' },
    { key: 'contactStatus', label: 'Contact Status', aliases: ['contact status', 'communication status', 'contact stage'], type: 'string' },
    { key: 'dealType', label: 'Deal Strategy', aliases: ['strategy', 'deal type', 'exit strategy', 'type'], type: 'array' }, // UPDATED to array type
    { key: 'interestLevel', label: 'Interest Level', aliases: ['interest', 'interest level', 'priority'], type: 'string' },
    { key: 'bedrooms', label: 'Bedrooms', aliases: ['beds', 'bedrooms', 'bd', 'bed'], type: 'number' },
    { key: 'bathrooms', label: 'Bathrooms', aliases: ['baths', 'bathrooms', 'ba', 'bath'], type: 'number' },
    { key: 'sqft', label: 'Sqft', aliases: ['sqft', 'square feet', 'size', 'living area', 'building size'], type: 'number' },
    { key: 'lotSqft', label: 'Lot Sqft', aliases: ['lot sqft', 'lot size', 'acreage', 'land', 'lot'], type: 'number' },
    { key: 'zoning', label: 'Zoning', aliases: ['zoning', 'zone', 'zoning code'], type: 'string' },
    { key: 'lockBoxCode', label: 'Lock Box Code', aliases: ['lockbox', 'lock box', 'access code', 'key code', 'cbs code'], type: 'string' },
    { key: 'listingDescription', label: 'Description', aliases: ['description', 'desc', 'remarks', 'notes', 'public remarks'], type: 'string' },
    { key: 'propertyType', label: 'Property Type', aliases: ['property type', 'prop type', 'dwelling type'], type: 'string' },
    { key: 'forSaleBy', label: 'For Sale By', aliases: ['for sale by', 'fsbo', 'listed by'], type: 'string' },
    { key: 'renovationARV', label: 'ARV', aliases: ['arv', 'after repair value', 'est value'], type: 'number' },
    { key: 'renovationEstimate', label: 'Reno Estimate', aliases: ['reno', 'renovation', 'repairs', 'repair cost', 'rehab'], type: 'number' },
    // Detailed Comparables
    { key: 'comp1_address', label: 'Comp 1 Address', aliases: ['comp 1 address', 'comp 1 addr', 'comparable 1 address'], type: 'string' },
    { key: 'comp1_date', label: 'Comp 1 Date', aliases: ['comp 1 date', 'sold date 1', 'comparable 1 date'], type: 'string' },
    { key: 'comp1_price', label: 'Comp 1 Price', aliases: ['comp 1 price', 'sold price 1', 'comparable 1 price'], type: 'number' },
    { key: 'comp2_address', label: 'Comp 2 Address', aliases: ['comp 2 address', 'comp 2 addr', 'comparable 2 address'], type: 'string' },
    { key: 'comp2_date', label: 'Comp 2 Date', aliases: ['comp 2 date', 'sold date 2', 'comparable 2 date'], type: 'string' },
    { key: 'comp2_price', label: 'Comp 2 Price', aliases: ['comp 2 price', 'sold price 2', 'comparable 2 price'], type: 'number' },
    { key: 'comp3_address', label: 'Comp 3 Address', aliases: ['comp 3 address', 'comp 3 addr', 'comparable 3 address'], type: 'string' },
    { key: 'comp3_date', label: 'Comp 3 Date', aliases: ['comp 3 date', 'sold date 3', 'comparable 3 date'], type: 'string' },
    { key: 'comp3_price', label: 'Comp 3 Price', aliases: ['comp 3 price', 'sold price 3', 'comparable 3 price'], type: 'number' },
];

export const ImportMapModal: React.FC<ImportMapModalProps> = ({ file, onClose, onImport }) => {
    const [step, setStep] = useState<'analyzing' | 'mapping' | 'preview'>('analyzing');
    const [headers, setHeaders] = useState<string[]>([]);
    const [rawData, setRawData] = useState<any[][]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({}); // HeaderIndex -> DealKey
    const [importing, setImporting] = useState(false);
    
    // Track the currently processed file to prevent re-running analysis on re-renders
    const processedFileRef = useRef<File | null>(null);

    useEffect(() => {
        if (!file) return;
        
        // Prevent re-running analysis if file object hasn't changed.
        // This is critical because parent re-renders (e.g. background polling) recreate the onClose prop,
        // which triggers this effect again, resetting the user's manual mappings.
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
                        
                        // 1. Exact or Keyword match
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

    // Helper to normalize dropdown values to match Title Case options
    const cleanDropdownValue = (val: string) => {
        if (!val) return '';
        return val.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    };

    const processImport = () => {
        setImporting(true);
        setTimeout(() => {
            const newDeals: Deal[] = rawData.map(row => {
                const deal: any = {
                    id: generateId(),
                    createdAt: new Date().toISOString(),
                    status: 'Analyzing',
                    offerDecision: 'No Offer Made Yet',
                    dealType: [], // UPDATED to empty array
                    logs: [`${getLogTimestamp()}: Imported from ${file.name}`],
                    dispo: { photos: false, blast: false },
                    listingDescription: '',
                    contactStatus: 'Agent Not Contacted Yet',
                    comparable1: { address: '', saleDate: '', salePrice: 0 },
                    comparable2: { address: '', saleDate: '', salePrice: 0 },
                    comparable3: { address: '', saleDate: '', salePrice: 0 }
                };

                // Apply mappings
                Object.entries(mapping).forEach(([colIdx, key]) => {
                    const fieldKey = key as string;
                    const val = row[parseInt(colIdx)] as any;
                    
                    if (val !== undefined && val !== null && fieldKey) {
                        
                        // Handle Comparables special mapping
                        if (fieldKey.startsWith('comp')) {
                            const compNum = fieldKey.charAt(4); // 1, 2, or 3
                            const type = fieldKey.split('_')[1]; // address, date, price
                            const compKey = `comparable${compNum}` as keyof Deal;
                            
                            // Initialize object if logic above missed it (safety)
                            if (!deal[compKey]) deal[compKey] = { address: '', saleDate: '', salePrice: 0 };
                            
                            const compObj = deal[compKey] as Comparable;
                            
                            if (type === 'price') {
                                 if (typeof val === 'string') {
                                    compObj.salePrice = parseNumberFromCurrency(val);
                                } else {
                                    compObj.salePrice = Number(val) || 0;
                                }
                            } else if (type === 'date') {
                                compObj.saleDate = String(val); 
                            } else if (type === 'address') {
                                compObj.address = String(val);
                            }
                            return; // Skip standard assignment
                        }

                        // Standard fields
                        const fieldDef = FIELD_DEFINITIONS.find(f => f.key === fieldKey);
                        if (fieldDef?.type === 'number') {
                            // Clean currency strings
                            if (typeof val === 'string') {
                                deal[fieldKey] = parseNumberFromCurrency(val);
                            } else {
                                deal[fieldKey] = Number(val) || 0;
                            }
                        } else if (fieldDef?.type === 'array') {
                            // UPDATED: Handle array fields (dealType)
                            if (typeof val === 'string') {
                                deal[fieldKey] = val.split(',').map(s => cleanDropdownValue(s.trim())).filter(Boolean);
                            } else {
                                deal[fieldKey] = [cleanDropdownValue(String(val))];
                            }
                        } else {
                            // String fields - attempt to clean up dropdowns
                            let strVal = String(val).trim();
                            if (['propertyType', 'interestLevel', 'forSaleBy'].includes(fieldKey)) {
                                strVal = cleanDropdownValue(strVal);
                            }
                            // Special casing for Acq Manager to try and match existing names if close
                            if (fieldKey === 'acquisitionManager') {
                                const lowerVal = strVal.toLowerCase();
                                if (lowerVal.includes('ashari') || lowerVal.includes('zakar')) strVal = 'Ashari Zakar';
                                else if (lowerVal.includes('angelica') || lowerVal.includes('henderson')) strVal = 'Angelica Henderson';
                                else if (lowerVal.includes('grias') || lowerVal.includes('ramos')) strVal = 'Grias Ramos';
                            }

                            deal[fieldKey] = strVal;
                        }
                    }
                });

                // Defaults if missing
                if (!deal.listPrice) deal.listPrice = 0;
                if (!deal.offerPrice) deal.offerPrice = 0;
                if (!deal.originalAskingPrice) deal.originalAskingPrice = 0;
                if (!deal.reducedAskingPrice) deal.reducedAskingPrice = 0;
                if (!deal.negotiatedAskingPrice) deal.negotiatedAskingPrice = 0;
                if (!deal.address) deal.address = 'Unknown Address';

                return deal as Deal;
            });

            onImport(newDeals);
        }, 500);
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
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <FileSpreadsheet className="text-green-600 dark:text-green-500" /> 
                            Import Deals
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
                                    We've automatically matched {Object.keys(mapping).length} columns based on your file headers. Please review the mappings above before importing.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3 shrink-0">
                    <button onClick={onClose} className="px-4 py-2 rounded text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm font-medium">Cancel</button>
                    <button 
                        onClick={processImport} 
                        disabled={importing || Object.keys(mapping).length === 0}
                        className="bg-green-600 hover:bg-green-500 text-white px-8 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {importing ? <Loader2 className="animate-spin" size={18}/> : <Save size={18} />}
                        Import {rawData.length} Deals
                    </button>
                </div>
            </div>
        </div>
    );
};
