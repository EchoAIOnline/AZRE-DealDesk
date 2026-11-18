import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  ArrowRight,
  Check,
  AlertCircle,
  Loader2,
  Save,
  Search,
  RotateCcw,
  CheckCircle2,
  ShieldCheck,
  Copy,
} from 'lucide-react';
import { OffMarketProperty } from '../../types';
import { supabase } from '../../services/api';
import {
  NUMERIC_OFF_MARKET_COLUMNS,
  DATE_OFF_MARKET_COLUMNS,
  normalizeToIsoDate,
} from './OffMarketPropertyModal';

declare const XLSX: any;

interface ImportOffMarketPropertiesModalProps {
  existingProperties?: OffMarketProperty[];
  onClose: () => void;
  onImportComplete: (imported: OffMarketProperty[]) => void;
}

interface TargetFieldDef {
  key: keyof OffMarketProperty;
  label: string;
  aliases?: string[];
}

const TARGET_FIELDS: TargetFieldDef[] = [
  { key: 'Address', label: 'Address', aliases: ['property address', 'street address', 'street', 'site address', 'prop address'] },
  { key: 'City', label: 'City', aliases: ['property city', 'site city'] },
  { key: 'State', label: 'State', aliases: ['property state', 'site state', 'st'] },
  { key: 'Zip', label: 'Zip', aliases: ['zip code', 'zipcode', 'postal code', 'property zip', 'site zip'] },
  { key: 'County', label: 'County', aliases: ['property county', 'county name'] },
  { key: 'Estimated Value', label: 'Estimated Value', aliases: ['est value', 'estimated market value', 'avm', 'property value'] },
  { key: 'Estimated Equity Percent', label: 'Estimated Equity Percent', aliases: ['equity percent', 'equity %', 'est equity %', 'estimated equity %'] },
  { key: 'Estimated Equity', label: 'Estimated Equity', aliases: ['est equity', 'equity', 'equity amount', 'equity dollars'] },
  { key: 'Living Square Feet', label: 'Living Square Feet', aliases: ['sqft', 'sq ft', 'living area', 'building sqft', 'square feet', 'living sqft'] },
  { key: 'Year Built', label: 'Year Built', aliases: ['yr built', 'built'] },
  { key: 'Lot (Acres)', label: 'Lot (Acres)', aliases: ['lot acres', 'acres', 'acreage'] },
  { key: 'Lot (Square Feet)', label: 'Lot (Square Feet)', aliases: ['lot sqft', 'lot sq ft', 'lot size', 'lot square feet'] },
  { key: 'Land Use', label: 'Land Use', aliases: ['land use code'] },
  { key: 'Property Type', label: 'Property Type', aliases: ['prop type', 'dwelling type'] },
  { key: 'Property Use', label: 'Property Use', aliases: ['use code'] },
  { key: 'Subdivision', label: 'Subdivision', aliases: ['subdivision name', 'neighborhood'] },
  { key: 'APN', label: 'APN', aliases: ['parcel number', 'parcel id', 'assessor parcel number', 'parcel'] },
  { key: 'Legal Description', label: 'Legal Description', aliases: ['legal desc', 'legal'] },
  { key: 'Units Count', label: 'Units Count', aliases: ['units', 'number of units', '# of units', 'unit count'] },
  { key: 'Bedrooms', label: 'Bedrooms', aliases: ['beds', 'bed', 'bd', 'br'] },
  { key: 'Bathrooms', label: 'Bathrooms', aliases: ['baths', 'bath', 'ba', 'total baths'] },
  { key: '# of Stories', label: '# of Stories', aliases: ['stories', 'number of stories', 'floors'] },
  { key: 'Garage Type', label: 'Garage Type', aliases: ['garage'] },
  { key: 'Garage Square Feet', label: 'Garage Square Feet', aliases: ['garage sqft', 'garage area'] },
  { key: 'Carport', label: 'Carport' },
  { key: 'Carport Area', label: 'Carport Area', aliases: ['carport sqft'] },
  { key: 'Air Conditioning Type', label: 'Air Conditioning Type', aliases: ['ac type', 'air conditioning', 'cooling', 'cooling type'] },
  { key: 'Heating Type', label: 'Heating Type', aliases: ['heating', 'heat type'] },
  { key: '# of Fireplaces', label: '# of Fireplaces', aliases: ['fireplaces', 'number of fireplaces'] },
  { key: 'Owner 1 First Name', label: 'Owner 1 First Name', aliases: ['owner first name', 'first name', 'owner1 first name'] },
  { key: 'Owner 1 Last Name', label: 'Owner 1 Last Name', aliases: ['owner last name', 'last name', 'owner1 last name'] },
  { key: 'Owner 1 Phone Number 1', label: 'Owner 1 Phone Number 1', aliases: ['owner 1 phone 1', 'phone 1', 'phone', 'owner phone 1', 'primary phone'] },
  { key: 'Owner 1 Phone Number 2', label: 'Owner 1 Phone Number 2', aliases: ['owner 1 phone 2', 'phone 2', 'owner phone 2'] },
  { key: 'Owner 1 Phone Number 3', label: 'Owner 1 Phone Number 3', aliases: ['owner 1 phone 3', 'phone 3', 'owner phone 3'] },
  { key: 'Owner 2 First Name', label: 'Owner 2 First Name', aliases: ['owner2 first name'] },
  { key: 'Owner 2 Last Name', label: 'Owner 2 Last Name', aliases: ['owner2 last name'] },
  { key: 'Owner 2 Phone Number 1', label: 'Owner 2 Phone Number 1', aliases: ['owner 2 phone 1'] },
  { key: 'Owner 2 Phone Number 2', label: 'Owner 2 Phone Number 2', aliases: ['owner 2 phone 2'] },
  { key: 'Owner 2 Phone Number 3', label: 'Owner 2 Phone Number 3', aliases: ['owner 2 phone 3'] },
  { key: 'Owner 3 First Name', label: 'Owner 3 First Name', aliases: ['owner3 first name'] },
  { key: 'Owner 3 Last Name', label: 'Owner 3 Last Name', aliases: ['owner3 last name'] },
  { key: 'Owner 3 Phone Number 1', label: 'Owner 3 Phone Number 1', aliases: ['owner 3 phone 1'] },
  { key: 'Owner 3 Phone Number 2', label: 'Owner 3 Phone Number 2', aliases: ['owner 3 phone 2'] },
  { key: 'Owner 3 Phone Number 3', label: 'Owner 3 Phone Number 3', aliases: ['owner 3 phone 3'] },
  { key: 'Owner 4 First Name', label: 'Owner 4 First Name', aliases: ['owner4 first name'] },
  { key: 'Owner 4 Last Name', label: 'Owner 4 Last Name', aliases: ['owner4 last name'] },
  { key: 'Owner 4 Phone Number 1', label: 'Owner 4 Phone Number 1', aliases: ['owner 4 phone 1'] },
  { key: 'Owner 4 Phone Number 2', label: 'Owner 4 Phone Number 2', aliases: ['owner 4 phone 2'] },
  { key: 'Owner 4 Phone Number 3', label: 'Owner 4 Phone Number 3', aliases: ['owner 4 phone 3'] },
  { key: 'Owner Mailing Address', label: 'Owner Mailing Address', aliases: ['mailing address', 'mail address'] },
  { key: 'Owner Mailing City', label: 'Owner Mailing City', aliases: ['mailing city', 'mail city'] },
  { key: 'Owner Mailing State', label: 'Owner Mailing State', aliases: ['mailing state', 'mail state'] },
  { key: 'Owner Mailing Zip', label: 'Owner Mailing Zip', aliases: ['mailing zip', 'mailing zip code', 'mail zip'] },
  { key: 'Ownership Length (Months)', label: 'Ownership Length (Months)', aliases: ['ownership length', 'length of ownership', 'months owned'] },
  { key: 'Owner Type', label: 'Owner Type', aliases: ['ownership type'] },
  { key: 'Owner Occupied', label: 'Owner Occupied', aliases: ['owner occupied?'] },
  { key: 'Vacant?', label: 'Vacant?', aliases: ['vacant', 'is vacant', 'vacancy'] },
  { key: 'Last Sale Date', label: 'Last Sale Date', aliases: ['sale date', 'last sold date'] },
  { key: 'Last Sale Amount', label: 'Last Sale Amount', aliases: ['sale amount', 'last sale price', 'sale price'] },
  { key: 'Open Mortgage Balance', label: 'Open Mortgage Balance', aliases: ['mortgage balance', 'est mortgage balance', 'loan balance'] },
  { key: 'Recorded Mortgage Interest Rate', label: 'Recorded Mortgage Interest Rate', aliases: ['mortgage interest rate', 'interest rate'] },
  { key: 'Mortgage Document Date', label: 'Mortgage Document Date', aliases: ['mortgage date', 'loan date'] },
  { key: 'Mortgage Loan Type', label: 'Mortgage Loan Type', aliases: ['loan type', 'mortgage type'] },
  { key: 'Lender Name', label: 'Lender Name', aliases: ['lender'] },
  { key: 'Deed Type', label: 'Deed Type' },
  { key: 'Position', label: 'Position', aliases: ['lien position', 'mortgage position'] },
  { key: 'Tax Amount', label: 'Tax Amount', aliases: ['annual tax', 'property tax', 'taxes'] },
  { key: 'Assessment Year', label: 'Assessment Year', aliases: ['tax year'] },
  { key: 'Assessed Total Value', label: 'Assessed Total Value', aliases: ['assessed value', 'total assessed value'] },
  { key: 'Assessed Land Value', label: 'Assessed Land Value' },
  { key: 'Assessed Improvement Value', label: 'Assessed Improvement Value' },
  { key: 'Assessed Improvement Percentage', label: 'Assessed Improvement Percentage', aliases: ['assessed improvement %'] },
  { key: 'Market Value', label: 'Market Value', aliases: ['total market value'] },
  { key: 'Market Land Value', label: 'Market Land Value' },
  { key: 'Market Improvement Value', label: 'Market Improvement Value' },
  { key: 'Market Improvement Percentage', label: 'Market Improvement Percentage', aliases: ['market improvement %'] },
  { key: 'Status', label: 'Status', aliases: ['property status', 'foreclosure status', 'lead status'] },
  { key: 'Default Amount', label: 'Default Amount' },
  { key: 'Opening bid', label: 'Opening bid', aliases: ['opening bid', 'opening bid amount'] },
  { key: 'Recording Date', label: 'Recording Date' },
  { key: 'Auction Date', label: 'Auction Date' },
  { key: 'Auction Time', label: 'Auction Time' },
  { key: 'Auction Courthouse', label: 'Auction Courthouse', aliases: ['courthouse'] },
  { key: 'Auction Address', label: 'Auction Address' },
  { key: 'Auction City State', label: 'Auction City State', aliases: ['auction city/state'] },
];

const normalizeKey = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, '');

const buildDuplicateKeys = (rec: Record<string, any>): string[] => {
  const keys: string[] = [];
  const addr = normalizeKey(String(rec['Address'] ?? ''));
  const city = normalizeKey(String(rec['City'] ?? ''));
  const zip = normalizeKey(String(rec['Zip'] ?? ''));
  const apn = normalizeKey(String(rec['APN'] ?? ''));

  if (addr) {
    if (city || zip) {
      keys.push(`addr:${addr}|${city}|${zip}`);
    }
    keys.push(`addr_only:${addr}`);
  }
  if (apn && apn !== '0') {
    keys.push(`apn:${apn}`);
  }
  return keys;
};

const parseNumericValue = (raw: any, colKey: keyof OffMarketProperty): number | null => {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'boolean') return raw ? 1 : 0;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;

  const str = String(raw).trim();
  if (!str) return null;

  if (colKey === 'Owner Occupied' || colKey === 'Vacant?') {
    const lower = str.toLowerCase();
    if (['yes', 'y', 'true', '1'].includes(lower)) return 1;
    if (['no', 'n', 'false', '0'].includes(lower)) return 0;
  }

  const cleaned = str.replace(/[$,%\s,]/g, '');
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
};

interface ImportStatusState {
  phase: 'checking' | 'importing' | 'complete' | 'error';
  totalRows: number;
  rowsToInsert: number;
  importedCount: number;
  duplicatesSkipped: number;
  duplicateDetectionEnabled: boolean;
  currentBatch: number;
  totalBatches: number;
  error?: string | null;
}

export const ImportOffMarketPropertiesModal: React.FC<ImportOffMarketPropertiesModalProps> = ({
  existingProperties = [],
  onClose,
  onImportComplete,
}) => {
  const [step, setStep] = useState<'upload' | 'analyzing' | 'mapping' | 'status'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<any[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [headerSearch, setHeaderSearch] = useState('');
  const [detectDuplicates, setDetectDuplicates] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatusState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = (selectedFile: File) => {
    setErrorMessage(null);
    const name = selectedFile.name.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      setErrorMessage('Please upload a valid CSV or Excel (.xlsx, .xls) file.');
      return;
    }

    setFile(selectedFile);
    setStep('analyzing');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (typeof XLSX === 'undefined') {
          throw new Error('Spreadsheet parser (XLSX) is not loaded yet. Please refresh and try again.');
        }

        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          throw new Error('No sheets found in the uploaded file.');
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];

        if (!jsonData || jsonData.length < 2) {
          throw new Error('The file must contain a header row and at least one data row.');
        }

        const fileHeaders = jsonData[0].map((h, i) => {
          const text = String(h ?? '').trim();
          return text || `Column ${i + 1}`;
        });
        const fileRows = jsonData
          .slice(1)
          .filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim() !== ''));

        if (fileRows.length === 0) {
          throw new Error('No non-empty data rows were found in this file.');
        }

        // Smart auto-mapping: exact label match first, then alias match
        const initialMapping: Record<string, string> = {};
        const usedTargets = new Set<string>();

        fileHeaders.forEach((header, idx) => {
          const normHeader = normalizeKey(header);
          if (!normHeader) return;

          // 1. Exact column name match
          let match = TARGET_FIELDS.find(
            (def) => !usedTargets.has(def.key) && normalizeKey(def.label) === normHeader
          );

          // 2. Exact alias match
          if (!match) {
            match = TARGET_FIELDS.find(
              (def) =>
                !usedTargets.has(def.key) &&
                (def.aliases || []).some((a) => normalizeKey(a) === normHeader)
            );
          }

          if (match) {
            initialMapping[String(idx)] = match.key;
            usedTargets.add(match.key);
          }
        });

        setHeaders(fileHeaders);
        setRawData(fileRows);
        setMapping(initialMapping);
        setStep('mapping');
      } catch (err: any) {
        console.error('Error parsing Off-Market Properties file:', err);
        setErrorMessage(err?.message || 'Failed to parse file. Please ensure it is a valid CSV or Excel file.');
        setStep('upload');
        setFile(null);
      }
    };

    reader.onerror = () => {
      setErrorMessage('Failed to read the selected file.');
      setStep('upload');
      setFile(null);
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  const handleMappingChange = (colIdx: string, targetKey: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (!targetKey) {
        delete next[colIdx];
      } else {
        next[colIdx] = targetKey;
      }
      return next;
    });
  };

  const mappedCount = Object.values(mapping).filter(Boolean).length;

  const visibleHeaderIndices = useMemo(() => {
    const q = headerSearch.trim().toLowerCase();
    return headers
      .map((header, idx) => ({ header, idx }))
      .filter(({ header, idx }) => {
        if (!q) return true;
        const mapped = (mapping[String(idx)] || '').toLowerCase();
        return header.toLowerCase().includes(q) || mapped.includes(q);
      });
  }, [headers, headerSearch, mapping]);

  const getSampleValue = (colIdx: number): string => {
    for (let i = 0; i < Math.min(rawData.length, 10); i++) {
      const val = rawData[i]?.[colIdx];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return String(val).trim();
      }
    }
    return '(Empty)';
  };

  const resetToUpload = () => {
    setFile(null);
    setHeaders([]);
    setRawData([]);
    setMapping({});
    setHeaderSearch('');
    setErrorMessage(null);
    setImportStatus(null);
    setImporting(false);
    setStep('upload');
  };

  const handleProcessImport = async () => {
    if (mappedCount === 0) return;
    const duplicateCheckOn = detectDuplicates;
    setImporting(true);
    setErrorMessage(null);
    setStep('status');

    const initialStatus: ImportStatusState = {
      phase: duplicateCheckOn ? 'checking' : 'importing',
      totalRows: rawData.length,
      rowsToInsert: 0,
      importedCount: 0,
      duplicatesSkipped: 0,
      duplicateDetectionEnabled: duplicateCheckOn,
      currentBatch: 0,
      totalBatches: 0,
      error: null,
    };
    setImportStatus(initialStatus);

    const savedRows: OffMarketProperty[] = [];

    try {
      const parsedRecords: Record<string, any>[] = [];

      for (const row of rawData) {
        const record: Record<string, any> = {};
        let hasAnyValue = false;

        for (const [colIdxStr, targetKey] of Object.entries(mapping)) {
          if (!targetKey) continue;
          const colIdx = parseInt(colIdxStr, 10);
          const rawVal = row[colIdx];
          const key = targetKey as keyof OffMarketProperty;

          if (NUMERIC_OFF_MARKET_COLUMNS.has(key)) {
            const parsed = parseNumericValue(rawVal, key);
            record[key] = parsed;
            if (parsed !== null) hasAnyValue = true;
          } else if (DATE_OFF_MARKET_COLUMNS.has(key)) {
            const isoDate = normalizeToIsoDate(rawVal);
            record[key] = isoDate;
            if (isoDate !== null) hasAnyValue = true;
          } else {
            const strVal = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : '';
            record[key] = strVal === '' ? null : strVal;
            if (strVal !== '') hasAnyValue = true;
          }
        }

        if (hasAnyValue) {
          parsedRecords.push(record);
        }
      }

      if (parsedRecords.length === 0) {
        throw new Error('No valid rows with mapped values were found to import.');
      }

      let rowsToInsert = parsedRecords;
      let duplicatesSkipped = 0;

      if (duplicateCheckOn) {
        const seenKeys = new Set<string>();
        existingProperties.forEach((existing) => {
          buildDuplicateKeys(existing).forEach((k) => seenKeys.add(k));
        });

        const uniqueRows: Record<string, any>[] = [];
        for (const rec of parsedRecords) {
          const keys = buildDuplicateKeys(rec);
          const isDup = keys.length > 0 && keys.some((k) => seenKeys.has(k));
          if (isDup) {
            duplicatesSkipped += 1;
          } else {
            keys.forEach((k) => seenKeys.add(k));
            uniqueRows.push(rec);
          }
        }
        rowsToInsert = uniqueRows;
      }

      const chunkSize = 50;
      const totalBatches = Math.ceil(rowsToInsert.length / chunkSize);

      setImportStatus({
        phase: rowsToInsert.length > 0 ? 'importing' : 'complete',
        totalRows: parsedRecords.length,
        rowsToInsert: rowsToInsert.length,
        importedCount: 0,
        duplicatesSkipped,
        duplicateDetectionEnabled: duplicateCheckOn,
        currentBatch: 0,
        totalBatches,
        error: null,
      });

      if (rowsToInsert.length === 0) {
        setImporting(false);
        return;
      }

      for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
        const batchNum = Math.floor(i / chunkSize) + 1;
        const chunk = rowsToInsert.slice(i, i + chunkSize);

        setImportStatus((prev) =>
          prev
            ? { ...prev, phase: 'importing', currentBatch: batchNum, totalBatches }
            : prev
        );

        const { data, error } = await supabase
          .from('OffMarketProperties')
          .insert(chunk)
          .select();

        if (error) {
          throw new Error(error.message || 'Supabase failed to insert imported rows.');
        }

        if (data && Array.isArray(data)) {
          savedRows.push(...(data as OffMarketProperty[]));
        }

        setImportStatus((prev) =>
          prev
            ? {
                ...prev,
                importedCount: savedRows.length,
                currentBatch: batchNum,
              }
            : prev
        );
      }

      if (savedRows.length > 0) {
        onImportComplete(savedRows);
      }

      setImportStatus((prev) =>
        prev
          ? {
              ...prev,
              phase: 'complete',
              importedCount: savedRows.length,
              currentBatch: totalBatches,
            }
          : prev
      );
      setImporting(false);
    } catch (err: any) {
      console.error('Error importing OffMarketProperties:', err);
      const errMsg = err?.message || 'There was an error importing the file into OffMarketProperties.';
      if (savedRows.length > 0) {
        onImportComplete(savedRows);
      }
      setImportStatus((prev) =>
        prev
          ? {
              ...prev,
              phase: 'error',
              importedCount: savedRows.length,
              error: errMsg,
            }
          : {
              phase: 'error',
              totalRows: rawData.length,
              rowsToInsert: 0,
              importedCount: savedRows.length,
              duplicatesSkipped: 0,
              duplicateDetectionEnabled: duplicateCheckOn,
              currentBatch: 0,
              totalBatches: 0,
              error: errMsg,
            }
      );
      setImporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 z-[150] flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm"
      onClick={() => {
        if (!importing) onClose();
      }}
    >
      <div
        className="bg-white dark:bg-[#0B1220] rounded-2xl w-full max-w-4xl border border-gray-200 dark:border-gray-700 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 bg-gray-50 dark:bg-[#172235] border-b border-gray-200 dark:border-gray-700 flex justify-between items-start gap-4 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="text-green-600 dark:text-green-500" size={20} />
              Import Deals — Off-Market Scouter
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {file
                ? <>Map columns from <span className="text-gray-900 dark:text-white font-mono">{file.name}</span> to <span className="font-mono">OffMarketProperties</span> fields.</>
                : 'Upload a CSV or Excel (.xlsx, .xls) file to bulk import into OffMarketProperties.'}
            </p>
          </div>
          <button
            type="button"
            disabled={importing}
            onClick={onClose}
            className="text-gray-400 hover:text-gray-900 dark:hover:text-white p-1 rounded-lg hover:bg-gray-200/70 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-center gap-2 shrink-0">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Body */}
        {step === 'upload' && (
          <div className="flex-1 p-6 flex flex-col items-center justify-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelected(f);
                e.target.value = '';
              }}
            />
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFileSelected(f);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full max-w-xl border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#172235]/50 hover:border-blue-400 dark:hover:border-blue-500'
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
                <Upload size={26} />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                Drop your CSV or Excel file here
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Supports <span className="font-mono">.csv</span>, <span className="font-mono">.xlsx</span>, and <span className="font-mono">.xls</span> files
              </p>
              <span className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition-colors">
                Browse Files
              </span>
            </div>
          </div>
        )}

        {step === 'analyzing' && (
          <div className="flex-1 p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm text-gray-700 dark:text-gray-200 font-medium">
              Analyzing spreadsheet headers and rows...
            </p>
          </div>
        )}

        {step === 'mapping' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <input
                  type="text"
                  value={headerSearch}
                  onChange={(e) => setHeaderSearch(e.target.value)}
                  placeholder="Filter file columns..."
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg py-1.5 pl-8 pr-7 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 outline-none"
                />
                {headerSearch && (
                  <button
                    type="button"
                    onClick={() => setHeaderSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={importing}
                  onClick={resetToUpload}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RotateCcw size={13} />
                  Change File
                </button>
              </div>
            </div>

            {/* Duplicate Detection Option */}
            <label className="flex items-start gap-3 p-3.5 rounded-xl bg-gray-50 dark:bg-[#172235] border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500/70 transition-colors">
              <input
                type="checkbox"
                checked={detectDuplicates}
                onChange={(e) => setDetectDuplicates(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <div className="min-w-0">
                <div className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-blue-500 shrink-0" />
                  <span>Detect &amp; Skip Duplicate Properties</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  Automatically checks Address and APN against existing Off-Market Properties and within the uploaded file, skipping duplicates and reporting the count on the Import Status screen.
                </p>
              </div>
            </label>

            {/* Smart Mapping Summary */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/50 p-3.5 rounded-xl flex items-start gap-3">
              <AlertCircle className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" size={16} />
              <div>
                <h4 className="text-xs font-bold text-blue-700 dark:text-blue-300">
                  Smart Field Mapping Active
                </h4>
                <p className="text-xs text-blue-800/90 dark:text-blue-200/90 mt-0.5">
                  Matched <strong>{mappedCount}</strong> of <strong>{headers.length}</strong> columns across{' '}
                  <strong>{rawData.length.toLocaleString()}</strong> rows. Review or adjust any mapping below before importing.
                </p>
              </div>
            </div>

            {/* Mapping Table */}
            <div className="bg-gray-50 dark:bg-[#172235]/50 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="grid grid-cols-12 gap-3 p-3 bg-gray-100 dark:bg-[#172235] border-b border-gray-200 dark:border-gray-700 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <div className="col-span-5">File Header</div>
                <div className="col-span-2 text-center flex justify-center">
                  <ArrowRight size={14} />
                </div>
                <div className="col-span-5">OffMarketProperties Field</div>
              </div>

              {visibleHeaderIndices.map(({ header, idx }) => {
                const colKey = String(idx);
                const isMapped = !!mapping[colKey];
                return (
                  <div
                    key={idx}
                    className={`grid grid-cols-12 gap-3 p-3 items-center border-b border-gray-100 dark:border-gray-700/50 last:border-0 ${
                      isMapped ? 'bg-blue-50/70 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    <div className="col-span-5 min-w-0">
                      <div
                        className="text-sm font-medium text-gray-900 dark:text-white truncate"
                        title={header}
                      >
                        {header}
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        Sample: {getSampleValue(idx)}
                      </div>
                    </div>
                    <div className="col-span-2 flex justify-center text-gray-500">
                      {isMapped ? (
                        <Check size={16} className="text-green-600 dark:text-green-500" />
                      ) : (
                        <ArrowRight size={15} />
                      )}
                    </div>
                    <div className="col-span-5">
                      <select
                        value={mapping[colKey] || ''}
                        onChange={(e) => handleMappingChange(colKey, e.target.value)}
                        className={`w-full bg-white dark:bg-gray-900 border rounded-lg p-2 text-xs sm:text-sm outline-none transition-colors ${
                          isMapped
                            ? 'border-blue-500/60 text-blue-700 dark:text-blue-300 font-medium'
                            : 'border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        <option value="">(Skip Column)</option>
                        {TARGET_FIELDS.map((field) => (
                          <option key={field.key} value={field.key}>
                            {field.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}

              {visibleHeaderIndices.length === 0 && (
                <div className="p-6 text-center text-xs text-gray-500 dark:text-gray-400">
                  No file headers match &ldquo;{headerSearch}&rdquo;.
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'status' && importStatus && (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center">
            <div className="w-full max-w-2xl space-y-6">
              {/* Status Icon & Headline */}
              <div className="text-center space-y-2">
                <div className="flex justify-center">
                  {importStatus.phase === 'complete' ? (
                    <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <CheckCircle2 size={34} />
                    </div>
                  ) : importStatus.phase === 'error' ? (
                    <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center">
                      <AlertCircle size={34} />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <Loader2 size={34} className="animate-spin" />
                    </div>
                  )}
                </div>

                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {importStatus.phase === 'checking'
                    ? 'Checking for Duplicates...'
                    : importStatus.phase === 'importing'
                      ? 'Importing Properties...'
                      : importStatus.phase === 'error'
                        ? 'Import Stopped with an Error'
                        : importStatus.importedCount === 0 && importStatus.duplicatesSkipped > 0
                          ? 'No New Properties Imported'
                          : 'Import Complete'}
                </h3>

                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {file && (
                    <>
                      File: <span className="font-mono text-gray-700 dark:text-gray-300">{file.name}</span>
                    </>
                  )}
                  {importStatus.phase === 'importing' && importStatus.totalBatches > 0 && (
                    <> • Batch {importStatus.currentBatch} of {importStatus.totalBatches}</>
                  )}
                </p>
              </div>

              {/* Progress Bar */}
              {(() => {
                const pct =
                  importStatus.phase === 'complete'
                    ? 100
                    : importStatus.rowsToInsert > 0
                      ? Math.min(100, Math.round((importStatus.importedCount / importStatus.rowsToInsert) * 100))
                      : importStatus.phase === 'checking'
                        ? 15
                        : 0;
                return (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-gray-600 dark:text-gray-300">
                      <span>Import Status</span>
                      <span className="font-mono">{pct}%</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          importStatus.phase === 'error'
                            ? 'bg-red-500'
                            : importStatus.phase === 'complete'
                              ? 'bg-emerald-500'
                              : 'bg-blue-600'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Status Summary Cards */}
              <div
                className={`grid gap-3 ${
                  importStatus.duplicateDetectionEnabled ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'
                }`}
              >
                <div className="rounded-xl p-4 bg-gray-50 dark:bg-[#172235] border border-gray-200 dark:border-gray-700">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Total Rows Scanned
                  </div>
                  <div className="text-2xl font-bold font-mono text-gray-900 dark:text-white mt-1">
                    {importStatus.totalRows.toLocaleString()}
                  </div>
                </div>

                <div className="rounded-xl p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/60">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Properties Imported
                  </div>
                  <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-300 mt-1">
                    {importStatus.importedCount.toLocaleString()}
                  </div>
                </div>

                {importStatus.duplicateDetectionEnabled && (
                  <div className="rounded-xl p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <Copy size={12} />
                      <span>Duplicates Found</span>
                    </div>
                    <div className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-300 mt-1">
                      {importStatus.duplicatesSkipped.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                      Skipped during import
                    </div>
                  </div>
                )}
              </div>

              {/* Error Detail if Import Failed */}
              {importStatus.error && (
                <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{importStatus.error}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 sm:px-5 bg-gray-50 dark:bg-[#172235] border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-4 shrink-0">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
            {step === 'status' && importStatus && importing && (
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold">
                <Loader2 size={15} className="animate-spin" />
                <span>
                  {importStatus.phase === 'checking'
                    ? 'Checking for duplicates...'
                    : `Importing ${importStatus.importedCount.toLocaleString()} / ${importStatus.rowsToInsert.toLocaleString()}...`}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {step === 'status' ? (
              <>
                <button
                  type="button"
                  disabled={importing}
                  onClick={resetToUpload}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs sm:text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  Import Another File
                </button>
                <button
                  type="button"
                  disabled={importing}
                  onClick={onClose}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg font-bold text-xs sm:text-sm shadow-md disabled:opacity-50 transition-colors"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={importing}
                  className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-xs sm:text-sm font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                {step === 'mapping' && (
                  <button
                    type="button"
                    onClick={handleProcessImport}
                    disabled={importing || mappedCount === 0}
                    className="bg-green-600 hover:bg-green-500 text-white px-5 py-2 rounded-lg font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {importing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>Import {rawData.length.toLocaleString()} Properties</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
