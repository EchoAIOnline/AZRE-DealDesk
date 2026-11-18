import React, { useState, useMemo, useRef } from 'react';
import {
  Upload,
  Download,
  Copy,
  Check,
  Trash2,
  Search,
  FileCode2,
  AlertCircle,
  Loader2,
  X,
  ArrowUpDown,
  Filter,
} from 'lucide-react';

export interface ExtractedHarProperty {
  key: string;
  zpid: string;
  streetAddress: string;
  city: string;
  state: string;
  zipcode: string;
  homeStatus: string;
  resultStatus: string;
  price: number | string;
}

interface ParseSummary {
  filesProcessed: string[];
  entriesScanned: number;
  graphqlResponsesMatched: number;
  rawRecordsFound: number;
  duplicatesRemoved: number;
}

type SortField =
  | 'zpid'
  | 'streetAddress'
  | 'city'
  | 'state'
  | 'zipcode'
  | 'homeStatus'
  | 'resultStatus'
  | 'price';

const CSV_COLUMNS: Array<keyof Omit<ExtractedHarProperty, 'key'>> = [
  'zpid',
  'streetAddress',
  'city',
  'state',
  'zipcode',
  'homeStatus',
  'resultStatus',
  'price',
];

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function decodeBase64Utf8(base64: string): string {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

function extractPropertiesFromHarText(
  harText: string,
  existingMap: Map<string, ExtractedHarProperty>
): {
  entriesScanned: number;
  graphqlResponsesMatched: number;
  rawRecordsFound: number;
  duplicatesRemoved: number;
} {
  let har: any;
  try {
    har = JSON.parse(harText);
  } catch {
    throw new Error('File is not valid JSON / HAR format.');
  }

  const entries: any[] = har?.log?.entries;
  if (!Array.isArray(entries)) {
    throw new Error('Invalid HAR structure: missing log.entries array.');
  }

  let graphqlResponsesMatched = 0;
  let rawRecordsFound = 0;
  let duplicatesRemoved = 0;

  for (const entry of entries) {
    const url: string = entry?.request?.url || '';
    const content = entry?.response?.content;
    if (!content?.text) continue;

    // Quickly skip non-GraphQL entries unless text explicitly references hdpMapSearch
    const isGraphqlUrl = url.includes('/graphql/');
    let responseText: string = content.text;

    if (content.encoding === 'base64') {
      if (!isGraphqlUrl) continue;
      responseText = decodeBase64Utf8(responseText);
      if (!responseText) continue;
    } else if (!isGraphqlUrl && !responseText.includes('hdpMapSearch')) {
      continue;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      continue;
    }

    const results = parsed?.data?.hdpMapSearch;
    if (!Array.isArray(results) || results.length === 0) continue;

    graphqlResponsesMatched++;

    for (const result of results) {
      const prop = result?.property || {};
      const streetAddress = prop.streetAddress != null ? String(prop.streetAddress).trim() : '';
      const city = prop.city != null ? String(prop.city).trim() : '';
      const state = prop.state != null ? String(prop.state).trim() : '';
      const zipcode = prop.zipcode != null ? String(prop.zipcode).trim() : '';

      if (!streetAddress || !city || !state || !zipcode) {
        continue;
      }

      rawRecordsFound++;

      const zpid = prop.zpid != null ? String(prop.zpid).trim() : '';
      const homeStatus = prop.homeStatus != null ? String(prop.homeStatus).trim() : '';
      const resultStatusRaw =
        result?.resultStatus ?? prop.resultStatus ?? result?.resultType ?? '';
      const resultStatus = resultStatusRaw != null ? String(resultStatusRaw).trim() : '';
      const price =
        prop.price !== null && prop.price !== undefined && prop.price !== ''
          ? prop.price
          : '';

      const dedupeKey = zpid || `${streetAddress}|${city}|${state}|${zipcode}`.toLowerCase();

      if (existingMap.has(dedupeKey)) {
        duplicatesRemoved++;
      }

      existingMap.set(dedupeKey, {
        key: dedupeKey,
        zpid,
        streetAddress,
        city,
        state,
        zipcode,
        homeStatus,
        resultStatus,
        price,
      });
    }
  }

  return {
    entriesScanned: entries.length,
    graphqlResponsesMatched,
    rawRecordsFound,
    duplicatesRemoved,
  };
}

export const HarListBuilder: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [properties, setProperties] = useState<ExtractedHarProperty[]>([]);
  const [summary, setSummary] = useState<ParseSummary>({
    filesProcessed: [],
    entriesScanned: 0,
    graphqlResponsesMatched: 0,
    rawRecordsFound: 0,
    duplicatesRemoved: 0,
  });
  const [isParsing, setIsParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [homeStatusFilter, setHomeStatusFilter] = useState<string>('ALL');
  const [resultStatusFilter, setResultStatusFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<SortField>('streetAddress');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [copiedCsv, setCopiedCsv] = useState(false);
  const [fileName, setFileName] = useState(() => {
    const today = new Date().toISOString().slice(0, 10);
    return `har_properties_${today}.csv`;
  });

  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setIsParsing(true);
    setError(null);

    try {
      const mergedMap = new Map<string, ExtractedHarProperty>();
      properties.forEach((p) => mergedMap.set(p.key, p));

      let addedEntries = 0;
      let addedGraphql = 0;
      let addedRaw = 0;
      let addedDupes = 0;
      const newFileNames: string[] = [];

      for (const file of files) {
        const text = await file.text();
        const stats = extractPropertiesFromHarText(text, mergedMap);
        addedEntries += stats.entriesScanned;
        addedGraphql += stats.graphqlResponsesMatched;
        addedRaw += stats.rawRecordsFound;
        addedDupes += stats.duplicatesRemoved;
        newFileNames.push(file.name);
      }

      setProperties(Array.from(mergedMap.values()));
      setSummary((prev) => ({
        filesProcessed: [...prev.filesProcessed, ...newFileNames],
        entriesScanned: prev.entriesScanned + addedEntries,
        graphqlResponsesMatched: prev.graphqlResponsesMatched + addedGraphql,
        rawRecordsFound: prev.rawRecordsFound + addedRaw,
        duplicatesRemoved: prev.duplicatesRemoved + addedDupes,
      }));
    } catch (err: any) {
      setError(err?.message || 'Failed to parse HAR file.');
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleClearAll = () => {
    setProperties([]);
    setSummary({
      filesProcessed: [],
      entriesScanned: 0,
      graphqlResponsesMatched: 0,
      rawRecordsFound: 0,
      duplicatesRemoved: 0,
    });
    setSearchQuery('');
    setHomeStatusFilter('ALL');
    setResultStatusFilter('ALL');
    setError(null);
  };

  const handleRemoveRow = (key: string) => {
    setProperties((prev) => prev.filter((p) => p.key !== key));
  };

  const homeStatusOptions = useMemo(() => {
    const set = new Set<string>();
    properties.forEach((p) => {
      if (p.homeStatus) set.add(p.homeStatus);
    });
    return Array.from(set).sort();
  }, [properties]);

  const resultStatusOptions = useMemo(() => {
    const set = new Set<string>();
    properties.forEach((p) => {
      if (p.resultStatus) set.add(p.resultStatus);
    });
    return Array.from(set).sort();
  }, [properties]);

  const filteredProperties = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = properties.filter((p) => {
      if (homeStatusFilter !== 'ALL' && p.homeStatus !== homeStatusFilter) return false;
      if (resultStatusFilter !== 'ALL' && p.resultStatus !== resultStatusFilter) return false;
      if (!q) return true;
      return (
        p.zpid.toLowerCase().includes(q) ||
        p.streetAddress.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.state.toLowerCase().includes(q) ||
        p.zipcode.toLowerCase().includes(q) ||
        p.homeStatus.toLowerCase().includes(q) ||
        p.resultStatus.toLowerCase().includes(q) ||
        String(p.price).toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'price') {
        const na = Number(a.price) || 0;
        const nb = Number(b.price) || 0;
        cmp = na - nb;
      } else {
        cmp = String(a[sortField] ?? '').localeCompare(String(b[sortField] ?? ''), undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [properties, searchQuery, homeStatusFilter, resultStatusFilter, sortField, sortDirection]);

  const handleToggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const buildCsvString = (rows: ExtractedHarProperty[]): string => {
    const header = CSV_COLUMNS.join(',');
    const lines = rows.map((row) =>
      CSV_COLUMNS.map((col) => escapeCsvCell(row[col])).join(',')
    );
    return [header, ...lines].join('\r\n');
  };

  const handleDownloadCsv = () => {
    if (filteredProperties.length === 0) return;
    const csvContent = buildCsvString(filteredProperties);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const cleanName = fileName.trim()
      ? fileName.trim().endsWith('.csv')
        ? fileName.trim()
        : `${fileName.trim()}.csv`
      : `har_properties_${new Date().toISOString().slice(0, 10)}.csv`;
    link.href = url;
    link.setAttribute('download', cleanName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyCsv = async () => {
    if (filteredProperties.length === 0) return;
    try {
      await navigator.clipboard.writeText(buildCsvString(filteredProperties));
      setCopiedCsv(true);
      setTimeout(() => setCopiedCsv(false), 1800);
    } catch {
      setError('Unable to copy CSV to clipboard.');
    }
  };

  const formatPriceDisplay = (price: number | string) => {
    if (price === '' || price === null || price === undefined) return '—';
    const num = Number(price);
    if (Number.isNaN(num)) return String(price);
    return `$${num.toLocaleString()}`;
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-50 dark:bg-[#0B1220] text-gray-900 dark:text-white">
      {/* Top Upload & Stats Section */}
      <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111a2b] flex flex-col gap-4 shrink-0">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`rounded-xl border-2 border-dashed p-4 sm:p-5 transition-all flex flex-col sm:flex-row items-center justify-between gap-4 ${
            isDragging
              ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-700 bg-gray-50/70 dark:bg-[#0B1220]/60'
          }`}
        >
          <div className="flex items-center gap-3.5 text-center sm:text-left">
            <div className="w-11 h-11 rounded-xl bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              {isParsing ? <Loader2 size={22} className="animate-spin" /> : <FileCode2 size={22} />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Drop .HAR file(s) here to extract property records
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Reads <span className="font-mono">data.hdpMapSearch</span> GraphQL responses locally in your browser, deduplicates by ZPID, and builds a clean CSV list.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept=".har,.json"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
              }}
            />
            <button
              type="button"
              disabled={isParsing}
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-60"
            >
              <Upload size={14} />
              <span>{properties.length > 0 ? 'Add More .HAR Files' : 'Select .HAR File(s)'}</span>
            </button>
            {properties.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Trash2 size={14} />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/25 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Stats + Export Controls */}
        {summary.filesProcessed.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/70 text-blue-700 dark:text-blue-300 font-semibold">
                {properties.length.toLocaleString()} Unique Properties
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-medium">
                {summary.filesProcessed.length} {summary.filesProcessed.length === 1 ? 'File' : 'Files'}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-medium">
                {summary.graphqlResponsesMatched} GraphQL Responses
              </span>
              {summary.duplicatesRemoved > 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/25 border border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300 font-medium">
                  {summary.duplicatesRemoved.toLocaleString()} Duplicates Merged
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="output.csv"
                className="w-48 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 dark:text-white focus:border-blue-500 outline-none font-mono"
                title="CSV File Name"
              />
              <button
                type="button"
                disabled={filteredProperties.length === 0}
                onClick={handleCopyCsv}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {copiedCsv ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                <span>{copiedCsv ? 'Copied!' : 'Copy CSV'}</span>
              </button>
              <button
                type="button"
                disabled={filteredProperties.length === 0}
                onClick={handleDownloadCsv}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Download size={14} />
                <span>Download CSV ({filteredProperties.length})</span>
              </button>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        {properties.length > 0 && (
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by ZPID, address, city, state, zip, status, or price..."
                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg py-1.5 pl-8 pr-7 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {homeStatusOptions.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Filter size={13} className="text-gray-400" />
                <select
                  value={homeStatusFilter}
                  onChange={(e) => setHomeStatusFilter(e.target.value)}
                  className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 dark:text-white focus:border-blue-500 outline-none"
                >
                  <option value="ALL">All Home Statuses</option>
                  {homeStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {resultStatusOptions.length > 0 && (
              <select
                value={resultStatusFilter}
                onChange={(e) => setResultStatusFilter(e.target.value)}
                className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 dark:text-white focus:border-blue-500 outline-none"
              >
                <option value="ALL">All Result Statuses</option>
                {resultStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* Extracted Properties Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        {properties.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-10 text-center text-gray-500 dark:text-gray-400">
            <FileCode2 size={42} className="opacity-25 mb-3" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              No HAR data loaded yet
            </p>
            <p className="text-xs mt-1 max-w-md">
              Upload one or more <span className="font-mono">.har</span> files above to extract{' '}
              <span className="font-mono">zpid</span>, <span className="font-mono">streetAddress</span>,{' '}
              <span className="font-mono">city</span>, <span className="font-mono">state</span>,{' '}
              <span className="font-mono">zipcode</span>, <span className="font-mono">homeStatus</span>,{' '}
              <span className="font-mono">resultStatus</span>, and <span className="font-mono">price</span> into a downloadable CSV.
            </p>
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-10 text-center text-gray-500 dark:text-gray-400">
            <Search size={32} className="opacity-25 mb-2" />
            <p className="text-sm font-medium">No extracted properties match your current filter.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-[#172235] border-b border-gray-200 dark:border-gray-700 text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                {(
                  [
                    { field: 'zpid', label: 'zpid' },
                    { field: 'streetAddress', label: 'streetAddress' },
                    { field: 'city', label: 'city' },
                    { field: 'state', label: 'state' },
                    { field: 'zipcode', label: 'zipcode' },
                    { field: 'homeStatus', label: 'homeStatus' },
                    { field: 'resultStatus', label: 'resultStatus' },
                    { field: 'price', label: 'price' },
                  ] as Array<{ field: SortField; label: string }>
                ).map((col) => (
                  <th key={col.field} className="py-2.5 px-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleToggleSort(col.field)}
                      className="inline-flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      <span>{col.label}</span>
                      <ArrowUpDown
                        size={11}
                        className={
                          sortField === col.field ? 'text-blue-500' : 'opacity-40'
                        }
                      />
                    </button>
                  </th>
                ))}
                <th className="py-2.5 px-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800/80 text-xs">
              {filteredProperties.map((prop, idx) => (
                <tr
                  key={prop.key}
                  className="hover:bg-blue-50/50 dark:hover:bg-white/[0.03] transition-colors"
                >
                  <td className="py-2 px-3 text-center text-gray-400 font-mono text-[11px]">
                    {idx + 1}
                  </td>
                  <td className="py-2 px-3 font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {prop.zpid || '—'}
                  </td>
                  <td className="py-2 px-3 font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                    {prop.streetAddress}
                  </td>
                  <td className="py-2 px-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {prop.city}
                  </td>
                  <td className="py-2 px-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {prop.state}
                  </td>
                  <td className="py-2 px-3 font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {prop.zipcode}
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    {prop.homeStatus ? (
                      <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/70 text-[10px] font-semibold">
                        {prop.homeStatus}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    {prop.resultStatus ? (
                      <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[10px] font-medium">
                        {prop.resultStatus}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-2 px-3 font-mono font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                    {formatPriceDisplay(prop.price)}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(prop.key)}
                      className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                      title="Remove row from list"
                    >
                      <X size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
