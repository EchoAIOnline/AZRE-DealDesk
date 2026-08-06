import React, { useState, useRef, useEffect } from 'react';
import { Phone, Mail, Briefcase, User, RefreshCw, XCircle, ArrowRight, ChevronUp, ChevronDown, ImageIcon, Pencil, MapPin, DollarSign, Clock } from 'lucide-react';
import { Deal, Agent } from '../../types';
import { GOOGLE_MAPS_API_KEY, UNDER_CONTRACT_STATUSES, DECLINED_STATUSES, CLOSED_STATUSES } from '../../constants';
// ✅ FIXED IMPORT: Added processPhotoUrl
import { calculateDaysRemaining, formatCurrency, getLogTimestamp, serverFunctions, processPhotoUrl } from '../../services/utils';

interface DealCardProps {
    deal: Deal;
    agents?: Agent[];
    onMove: (id: string, decision: string) => void;
    onUpdate: (id: string, updates: Partial<Deal>) => void;
    onDelete: (id: string) => void;
    onEdit: (deal: Deal) => void;
    selected?: boolean;
    onSelect?: (id: string, selected: boolean) => void;
}

export const DealCard: React.FC<DealCardProps> = ({ deal, agents, onMove, onUpdate, onDelete, onEdit, selected = false, onSelect }) => {
  const isUnderContract = UNDER_CONTRACT_STATUSES.includes(deal.offerDecision);
  const isDeclined = DECLINED_STATUSES.includes(deal.offerDecision);
  const isClosed = CLOSED_STATUSES.includes(deal.offerDecision);
  const isCurrent = isUnderContract; 
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); 
  
  const [editingLogIdx, setEditingLogIdx] = useState(-1);
  const [tempLogValue, setTempLogValue] = useState("");
  const [isAddingLog, setIsAddingLog] = useState(false);
  const [newLogText, setNewLogText] = useState("");
  const newLogInputRef = useRef<HTMLInputElement>(null);

  const daysToInsp = calculateDaysRemaining(deal.inspectionDate);
  const daysToEMD = calculateDaysRemaining(deal.emdDate);

  // --- AUTO CAPTURE LOGIC (Saves to Drive) ---
  const attemptRef = useRef(false);

  useEffect(() => {
    // Only capture if we have an API Key, an address, and NO photos yet
    // And we haven't tried yet in this session (prevents loops)
    if (GOOGLE_MAPS_API_KEY && (!deal.photos || deal.photos.length === 0) && deal.address && !attemptRef.current) {
        attemptRef.current = true;
        
        // Call the backend script to save to Drive
        serverFunctions.saveStreetViewToDrive(deal.id, deal.address, GOOGLE_MAPS_API_KEY)
            .then(response => {
                // The backend returns { status: 'success', url: 'https://drive...' }
                if (response && response.status === 'success' && response.url) {
                    // Update with the Drive URL
                    onUpdate(deal.id, { photos: [response.url] });
                }
            })
            .catch(e => console.error("Auto-capture failed:", e));
    }
  }, [deal.id, deal.photos, deal.address]);

  // Dynamic Agent Lookup
  const matchingAgent = agents?.find(a => a && String(a.name || '').toLowerCase() === (deal.agentName || '').toLowerCase());
  const displayPhone = matchingAgent?.phone || deal.agentPhone;
  const displayEmail = matchingAgent?.email || deal.agentEmail;
  const displayBrokerage = matchingAgent?.brokerage || (matchingAgent as any)?.companyName || deal.agentBrokerage;

  const getUrgencyColor = (days: number | null) => {
    if (days === null) return 'text-gray-400';
    if (days < 0) return 'text-red-600 font-bold';
    if (days <= 3) return 'text-red-500 dark:text-red-400 font-bold';
    return 'text-green-600 dark:text-green-400';
  };

  const getAddedIndicator = () => {
    let diffDays = 999;
    let targetDate: Date | null = null;
    if (deal.logs && deal.logs.length > 0) {
        const firstLog = deal.logs[0];
        if (typeof firstLog === 'string') {
            const separatorIdx = firstLog.indexOf(': ');
            let dateStr = separatorIdx > 0 ? firstLog.substring(0, separatorIdx) : firstLog;
            const now = new Date();
            const hasYear = /\d{4}/.test(dateStr);
            if (!hasYear) dateStr = `${dateStr} ${now.getFullYear()}`;
            const parsed = new Date(dateStr);
            if (!isNaN(parsed.getTime())) {
                targetDate = parsed;
                if (targetDate > now) targetDate.setFullYear(targetDate.getFullYear() - 1);
            }
        }
    }
    if (!targetDate && deal.createdAt) targetDate = new Date(deal.createdAt);
    if (targetDate && !isNaN(targetDate.getTime())) {
        const now = new Date();
        const tDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const nDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const diffTime = nDate.getTime() - tDate.getTime();
        diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }
    let textLines: string[] = [];
    let colorClass = '';
    if (diffDays <= 0) { textLines = ['Today']; colorClass = 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800'; }
    else if (diffDays < 7) { textLines = ['This', 'Week']; colorClass = 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'; }
    else if (diffDays < 14) { textLines = ['Last', 'Week']; colorClass = 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800'; }
    else { textLines = ['2 Weeks+', 'Ago']; colorClass = 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'; }
    return (
        <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded border flex flex-col items-center justify-center leading-none shadow-sm ${colorClass} shrink-0`}>
            {textLines.map((line, i) => <span key={i}>{line}</span>)}
        </div>
    );
  };

  // --- DISPLAY LOGIC ---
  // ✅ FIXED: Using processPhotoUrl for the user selected main photo
  const userPhotoRaw = deal.photos && deal.photos.length > 0 && deal.photos[0].length > 10 ? deal.photos[0] : null;
  const userPhoto = userPhotoRaw ? processPhotoUrl(userPhotoRaw) : null;
  
  // Priority: User Saved Photo Only. We do NOT fallback to live API to save quota.
  const displayImageUrl = userPhoto;

  useEffect(() => {
    if (isAddingLog && newLogInputRef.current) newLogInputRef.current.focus();
  }, [isAddingLog]);

  const handleSaveLogEdit = (idx: number) => {
      if (tempLogValue.trim() === "") return;
      const newLogs = [...deal.logs];
      newLogs[idx] = tempLogValue;
      onUpdate(deal.id, { logs: newLogs });
      setEditingLogIdx(-1);
  };

  const handleAddNewLog = () => {
      if (newLogText.trim() === "") { setIsAddingLog(false); return; }
      const timestampedNote = `${getLogTimestamp()}: ${newLogText}`;
      onUpdate(deal.id, { logs: [timestampedNote, ...(deal.logs || [])] });
      setNewLogText("");
      setIsAddingLog(false);
  };

  return (
    <div 
      onClick={() => onEdit(deal)}
      className={`bg-white dark:bg-gray-800 rounded-lg mb-4 border shadow-md transition hover:border-blue-500/50 cursor-pointer group overflow-hidden ${selected ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 dark:border-gray-700'}`}
    >
      <div className="w-full h-32 bg-gray-100 dark:bg-gray-900 relative">
        {onSelect && (
            <div 
                className="absolute top-2 left-2 z-10 p-1 bg-white/80 dark:bg-black/60 backdrop-blur rounded hover:bg-white dark:hover:bg-black transition-colors"
                onClick={(e) => e.stopPropagation()}
            >
                <input 
                    type="checkbox" 
                    checked={selected}
                    onChange={(e) => onSelect(deal.id, e.target.checked)}
                    className="w-4 h-4 cursor-pointer text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
            </div>
        )}
        {displayImageUrl ? (
            <img 
              src={displayImageUrl} 
              alt={`Property view of ${deal.address}`}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer" /* CRITICAL FIX for Google Maps */
              onError={(e) => { 
                  const target = e.target as HTMLImageElement;
                  target.onerror = null; 
                  // If image fails, show placeholder
                  if (target.src !== 'https://placehold.co/600x300/1f2937/9ca3af?text=No+Image') {
                      target.src = 'https://placehold.co/600x300/1f2937/9ca3af?text=No+Image';
                  }
              }}
            />
        ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-600 bg-gray-200 dark:bg-gray-900">
                <ImageIcon size={24} className="mb-1 opacity-50"/>
                <span className="text-[10px] uppercase tracking-wider">No Image Found</span>
            </div>
        )}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-gray-900/50 dark:from-gray-900/90 to-transparent pointer-events-none"></div>
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
            <div className={`px-2 py-1 rounded text-xs font-bold shadow-sm ${isClosed ? 'bg-purple-600 text-white' : isUnderContract ? 'bg-green-600 text-white' : isDeclined ? 'bg-red-600 text-white' : 'bg-yellow-500 text-white'}`}>
              {deal.offerDecision || 'New'}
            </div>
        </div>
      </div>

      <div className="p-4 pt-2">
        <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
                <div className="flex items-center justify-between">
                     <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {deal.address} 
                        <Pencil size={14} className="opacity-0 group-hover:opacity-100 text-gray-400 dark:text-gray-500" />
                    </h3>
                    <button onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400">
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                </div>
                <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-3">
                        <div className="text-xs text-blue-600 dark:text-blue-400 font-mono">MLS: {deal.mls}</div>
                        {deal.acquisitionManager && (
                             <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                                <User size={12} className="text-gray-500 dark:text-gray-400"/>
                                {deal.acquisitionManager}
                            </div>
                        )}
                    </div>
                    {getAddedIndicator()}
                </div>
            </div>
        </div>

        <div className="flex gap-6 mb-3 text-sm">
            <div className="flex flex-col">
                <span className="text-gray-500 dark:text-gray-400 text-[11px] uppercase tracking-wide font-semibold mb-0.5">List Price:</span>
                <span className="text-gray-900 dark:text-white font-bold">{formatCurrency(deal.listPrice)}</span>
            </div>
            <div className="flex flex-col">
                <span className="text-gray-500 dark:text-gray-400 text-[11px] uppercase tracking-wide font-semibold mb-0.5">My Offer:</span>
                <div className="flex items-center gap-2">
                    <span className="text-green-600 dark:text-green-400 font-bold">{deal.offerPrice ? formatCurrency(deal.offerPrice) : '-'}</span>
                    {deal.loiSent && (
                        <div className="px-1.5 h-[22px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-[10px] font-bold flex items-center gap-1 border border-green-200 dark:border-green-800/50 whitespace-nowrap">
                            <Mail size={10} /> LOI Sent
                        </div>
                    )}
                </div>
            </div>
        </div>

        {isExpanded && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="text-sm text-gray-600 dark:text-gray-300 mb-3 space-y-1.5 border-2 border-blue-500 rounded-lg p-3 bg-blue-50/10">
                    <div className="flex items-center gap-2 text-gray-900 dark:text-white font-medium">
                        <Phone size={14} className="text-gray-400 dark:text-gray-500 shrink-0"/> 
                        <span>{deal.agentName} <span className="text-gray-500 font-normal">{displayPhone || '(No Phone)'}</span></span>
                    </div>
                    {displayEmail && (
                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm">
                            <Mail size={14} className="shrink-0" /> 
                            <a href={`mailto:${displayEmail}`} onClick={(e) => e.stopPropagation()} className="hover:underline truncate">{displayEmail}</a>
                        </div>
                    )}
                    {displayBrokerage && (
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs">
                            <Briefcase size={14} className="shrink-0" /> 
                            <span>{displayBrokerage}</span>
                        </div>
                    )}
                </div>
                
                {!isUnderContract ? (
                    <div className="space-y-2 mb-3">
                    <div className="bg-gray-50 dark:bg-gray-900 rounded text-xs h-24 overflow-y-auto border border-gray-200 dark:border-gray-800 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent cursor-text relative" onClick={(e) => { e.stopPropagation(); if (!isAddingLog) setIsAddingLog(true); }}>
                        <div className="sticky top-0 bg-gray-50 dark:bg-gray-900 p-2 pb-1 z-10 flex justify-between items-center shadow-sm border-b border-gray-200 dark:border-gray-800/50">
                            <span className="text-gray-500 uppercase font-semibold">Activity Log</span>
                            <span className="text-[10px] text-gray-600 font-normal mr-1">Click to edit</span>
                        </div>
                        <div className="p-2 pt-1 space-y-1">
                            {deal.logs && deal.logs.length > 0 ? (
                                deal.logs.map((log, idx) => {
                                    const logText = typeof log === 'string' ? log : JSON.stringify(log);
                                    return (
                                        <div key={idx} className="text-gray-700 dark:text-gray-300 break-words hover:bg-gray-200 dark:hover:bg-gray-800 rounded px-1 -mx-1 transition-colors">
                                            {editingLogIdx === idx ? (
                                                <input autoFocus className="w-full bg-white dark:bg-black text-gray-900 dark:text-white px-1 rounded outline-none border border-blue-500" value={tempLogValue} onChange={(e) => setTempLogValue(e.target.value)} onBlur={() => handleSaveLogEdit(idx)} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLogEdit(idx); if (e.key === 'Escape') setEditingLogIdx(-1); }} onClick={(e) => e.stopPropagation()} />
                                            ) : (
                                                <div onClick={(e) => { e.stopPropagation(); setEditingLogIdx(idx); setTempLogValue(logText); }}>• {logText}</div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (!isAddingLog && <div className="text-gray-400 dark:text-gray-500 italic px-1">No activity recorded.</div>)}
                            {isAddingLog && (
                                <div className="mt-1 flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <span className="text-green-600 dark:text-green-500 text-[10px] whitespace-nowrap">{getLogTimestamp()}:</span>
                                    <input ref={newLogInputRef} className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs px-1 rounded outline-none border border-blue-500 placeholder-gray-400" placeholder="Type note & hit Enter..." value={newLogText} onChange={(e) => setNewLogText(e.target.value)} onBlur={handleAddNewLog} onKeyDown={(e) => { if (e.key === 'Enter') handleAddNewLog(); if (e.key === 'Escape') setIsAddingLog(false); }} onClick={(e) => e.stopPropagation()} />
                                </div>
                            )}
                        </div>
                    </div>
                    </div>
                ) : (
                    <div className="space-y-3 mt-3 border-t border-gray-200 dark:border-gray-700 pt-3 mb-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-transparent">
                            <div className="text-gray-500 text-xs">Insp. Ends</div>
                            <div className={getUrgencyColor(daysToInsp)}>{daysToInsp !== null ? `${daysToInsp} Days` : 'Not Set'}</div>
                            <input type="date" onClick={(e) => e.stopPropagation()} className="w-full bg-transparent text-xs text-gray-500 mt-1 outline-none" value={deal.inspectionDate || ''} onChange={(e) => onUpdate(deal.id, { inspectionDate: e.target.value })} />
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-transparent">
                            <div className="text-gray-500 text-xs">EMD Due</div>
                            <div className={getUrgencyColor(daysToEMD)}>{daysToEMD !== null ? `${daysToEMD} Days` : 'Not Set'}</div>
                            <input type="date" onClick={(e) => e.stopPropagation()} className="w-full bg-transparent text-xs text-gray-500 mt-1 outline-none" value={deal.emdDate || ''} onChange={(e) => onUpdate(deal.id, { emdDate: e.target.value })} />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer"><input type="checkbox" onClick={(e) => e.stopPropagation()} checked={deal.dispo.photos} onChange={(e) => onUpdate(deal.id, { dispo: { ...deal.dispo, photos: e.target.checked } })} className="rounded text-green-500 focus:ring-green-500 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600"/><span>Photos Taken</span></label>
                        <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer"><input type="checkbox" onClick={(e) => e.stopPropagation()} checked={deal.dispo.blast} onChange={(e) => onUpdate(deal.id, { dispo: { ...deal.dispo, blast: e.target.checked } })} className="rounded text-green-500 focus:ring-green-500 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600"/><span>Sent to Buyers</span></label>
                    </div>
                    </div>
                )}
            </div>
        )}
        
        <div className="flex gap-2 mt-2 border-t border-gray-200 dark:border-gray-700/50 pt-2">
            {isDeclined ? (
                isRestoring ? (
                    <>
                        <button onClick={(e) => { e.stopPropagation(); onMove(deal.id, 'No Offer Made Yet'); setIsRestoring(false); }} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs py-2 rounded font-bold animate-in fade-in">Confirm</button>
                        <button onClick={(e) => { e.stopPropagation(); setIsRestoring(false); }} className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-white text-xs py-2 rounded">Cancel</button>
                    </>
                ) : (
                    <>
                        <button onClick={(e) => { e.stopPropagation(); setIsRestoring(true); }} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs py-2 rounded flex items-center justify-center gap-1 transition"><RefreshCw size={14} /> Restore Offer</button>
                        <button onClick={(e) => { e.stopPropagation(); onMove(deal.id, 'Deal Under Contract'); }} className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs py-2 rounded flex items-center justify-center gap-1 transition">Offer Accepted <ArrowRight size={12}/></button>
                    </>
                )
            ) : isCurrent ? null : isDeclining ? (
                <>
                    <button onClick={(e) => { e.stopPropagation(); onMove(deal.id, 'Offer Declined'); }} className="flex-1 bg-red-600 hover:bg-red-500 text-white text-xs py-2 rounded font-bold animate-in fade-in">Confirm</button>
                    <button onClick={(e) => { e.stopPropagation(); setIsDeclining(false); }} className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-white text-xs py-2 rounded">Cancel</button>
                </>
            ) : (
                <>
                    <button onClick={(e) => { e.stopPropagation(); setIsDeclining(true); }} className="flex-1 bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 dark:bg-gray-700 dark:hover:bg-red-900/40 dark:text-gray-300 dark:hover:text-red-300 text-xs py-2 rounded text-center transition flex items-center justify-center gap-1"><XCircle size={14} /> Offer Declined</button>
                    <button onClick={(e) => { e.stopPropagation(); onMove(deal.id, 'Deal Under Contract'); }} className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs py-2 rounded flex items-center justify-center gap-1 transition">Offer Accepted <ArrowRight size={12}/></button>
                </>
            )}
        </div>
        
        {isDeleting ? (
            <div className="mt-2 flex gap-2 border-t border-gray-200 dark:border-gray-700/50 pt-2">
                <button onClick={(e) => { e.stopPropagation(); onDelete(deal.id); }} className="flex-1 bg-red-600 hover:bg-red-500 text-white text-xs py-2 rounded font-bold animate-in fade-in">Confirm Delete</button>
                <button onClick={(e) => { e.stopPropagation(); setIsDeleting(false); }} className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-white text-xs py-2 rounded">Cancel</button>
            </div>
        ) : (
            <button onClick={(e) => { e.stopPropagation(); setIsDeleting(true); }} className="mt-2 w-full text-[10px] text-red-400 hover:text-red-500 dark:hover:text-red-300 hover:underline text-center transition-colors">Delete Deal</button>
        )}
      </div>
    </div>
  );
};