import React, { useState, useRef, useEffect } from 'react';
import { Phone, Mail, Building, ChevronDown, ChevronUp, Activity, Trash2, Briefcase, DollarSign, MapPin, Calendar } from 'lucide-react';
import { Buyer } from '../../types';
import { getLogTimestamp, formatPhoneNumber, formatCurrency, processPhotoUrl } from '../../services/utils';

interface BuyerCardProps {
    buyer: Buyer;
    onEdit: (buyer: Buyer) => void;
    onDelete: (id: string) => void;
    onUpdate: (id: string, updates: Partial<Buyer>) => void;
}

export const BuyerCard: React.FC<BuyerCardProps> = ({ buyer, onEdit, onDelete, onUpdate }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const renderFollowUp = () => {
        if (!buyer.nextFollowUpDate) return null;
        
        const [year, month, day] = buyer.nextFollowUpDate.split('-').map(Number);
        if (!year || !month || !day) return null;
        const target = new Date(year, month - 1, day);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const diffTime = target.getTime() - today.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        
        let daysStr = '';
        let colorClasses = 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30';
        if (diffDays === 0) {
            daysStr = 'Today';
            colorClasses = 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30';
        } else if (diffDays === 1) {
            daysStr = 'In 1 day';
            colorClasses = 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30';
        } else if (diffDays === -1) {
            daysStr = '1 day ago';
            colorClasses = 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30';
        } else if (diffDays > 1) {
            daysStr = `In ${diffDays} days`;
            colorClasses = 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30';
        } else {
            daysStr = `${Math.abs(diffDays)} days ago`;
            colorClasses = 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30';
        }

        return (
            <div className="border-t border-gray-100 dark:border-gray-700 pt-3 flex justify-center w-full">
                <span className={`text-[11px] font-bold px-2 py-1.5 rounded flex items-center gap-1.5 w-full justify-center ${colorClasses}`}>
                    <Calendar size={12} className="shrink-0"/>
                    Follow-up {daysStr} - {formatter.format(target)}
                </span>
            </div>
        );
    };


    const [isDeleting, setIsDeleting] = useState(false);
    
    // Log editing state
    const [editingLogIdx, setEditingLogIdx] = useState(-1);
    const [tempLogValue, setTempLogValue] = useState("");
    const [isAddingLog, setIsAddingLog] = useState(false);
    const [newLogText, setNewLogText] = useState("");
    const newLogInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isAddingLog && newLogInputRef.current) {
            newLogInputRef.current.focus();
        }
    }, [isAddingLog]);

    // Helper for "MM/DD/YYYY" format
    const formatLastContactDate = (dateStr?: string) => {
        if (!dateStr) return "Never";
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return "Never";
        return date.toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric'
        });
    };

    const getStatusColor = (status: string) => {
        if (status.includes('VIP Buyer')) return 'bg-purple-600 text-white border-purple-500';
        if (status.includes('Repeat Buyer')) return 'bg-green-600 text-white border-green-500';
        if (status.includes('Vetted Buyer')) return 'bg-blue-600 text-white border-blue-500';
        if (status.includes('New Lead')) return 'bg-yellow-500 text-white border-yellow-400';
        return 'bg-gray-500 text-white border-gray-400';
    };

    const handleSaveLogEdit = (idx: number) => {
        if (tempLogValue.trim() === "") return;
        const newLogs = [...buyer.notes];
        newLogs[idx] = tempLogValue;
        onUpdate(buyer.id, { notes: newLogs });
        setEditingLogIdx(-1);
    };

    const handleAddNewLog = () => {
        if (newLogText.trim() === "") {
            setIsAddingLog(false);
            return;
        }
        const timestampedNote = `${getLogTimestamp()}: ${newLogText}`;
        // CHANGED: Prepend the new note to the top of the array
        onUpdate(buyer.id, { notes: [timestampedNote, ...(buyer.notes || [])] });
        setNewLogText("");
        setIsAddingLog(false);
    };

    return (
        <div 
            onClick={() => onEdit(buyer)}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-md transition hover:border-blue-500/50 cursor-pointer group overflow-hidden"
        >
            {/* Top Banner / Image Area */}
            <div className="h-44 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 relative flex items-center justify-center overflow-hidden">
                {buyer.photo ? (
                    <img src={processPhotoUrl(buyer.photo)} alt={buyer.companyName} className="w-full h-full object-cover opacity-90" />
                ) : (
                    <Building className="text-gray-300 dark:text-gray-600 w-16 h-16" />
                )}

                <div className="absolute top-2 left-2 z-10 flex flex-col p-1.5 rounded bg-white/90 dark:bg-black/60 backdrop-blur-sm border border-gray-200 dark:border-gray-700 shadow-sm">
                    <span className="text-[8px] font-bold uppercase tracking-tight text-gray-500 dark:text-gray-400 leading-none">
                        Last Contact
                    </span>
                    <span className="text-[10px] font-bold text-gray-900 dark:text-white mt-0.5">
                        {formatLastContactDate(buyer.lastContactDate)}
                    </span>
                </div>
                
                <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                    {buyer.status ? buyer.status.split(',').map(s => s.trim()).filter(s => s).map(s => (
                        <div key={s} className={`px-2 py-0.5 rounded text-[10px] font-bold shadow-sm border ${getStatusColor(s)}`}>
                            {s}
                        </div>
                    )) : (
                         <div className="px-2 py-0.5 rounded text-[10px] font-bold shadow-sm border bg-gray-500 text-white border-gray-400">No Status</div>
                    )}
                </div>

                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 flex-wrap max-w-[85%]">
                    <div className="bg-white/90 dark:bg-black/60 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 backdrop-blur-sm shadow-sm border border-gray-200 dark:border-gray-700">
                        <Briefcase size={10} className="text-blue-600 dark:text-blue-400" />
                        <span className="text-gray-800 dark:text-white">{buyer.propertiesBought} Bought</span>
                    </div>
                    {buyer.buyBox?.propertyTypes?.map(type => {
                        let colorClass = 'bg-gray-500 text-white border-gray-400';
                        if (type === 'Renovation') colorClass = 'bg-blue-600 text-white border-blue-500';
                        if (type === 'New Build') colorClass = 'bg-green-600 text-white border-green-500';
                        if (type === 'Rental') colorClass = 'bg-purple-600 text-white border-purple-500';
                        return (
                            <div key={type} className={`px-2 py-0.5 rounded text-[10px] font-bold shadow-sm border ${colorClass}`}>
                                {type}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="p-4 pt-3">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {buyer.name || buyer.companyName}
                            </h3>
                            <button onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
                                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </button>
                        </div>
                        {buyer.name && buyer.companyName && buyer.name !== buyer.companyName && (
                            <div className="text-sm text-purple-600 dark:text-purple-400 font-bold mb-1">
                                {buyer.companyName}
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-1.5 mb-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <Phone size={14} className="text-gray-400 dark:text-gray-500 shrink-0"/> 
                        <span>{buyer.phone ? formatPhoneNumber(buyer.phone) : <span className="text-gray-400 italic">No Phone</span>}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <Mail size={14} className="text-gray-400 dark:text-gray-500 shrink-0"/> 
                        <a href={`mailto:${buyer.email}`} onClick={e => e.stopPropagation()} className="truncate hover:text-blue-500 hover:underline">{buyer.email || <span className="text-gray-400 italic">No Email</span>}</a>
                    </div>
                </div>

                {/* Expandable Activity & Notes */}
            {renderFollowUp()}
                {isExpanded && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-200 mt-4 border-t border-gray-200 dark:border-gray-700 pt-3">
                        {/* REMOVED: Buy Box Target section was here */}

                        <div className="bg-gray-50 dark:bg-gray-900 rounded text-xs h-32 overflow-y-auto border border-gray-200 dark:border-gray-800 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent cursor-text relative" onClick={(e) => { e.stopPropagation(); if (!isAddingLog) setIsAddingLog(true); }}>
                            <div className="sticky top-0 bg-gray-50 dark:bg-gray-900 p-2 pb-1 z-10 flex justify-between items-center shadow-sm border-b border-gray-200 dark:border-gray-800/50">
                                <span className="text-gray-500 uppercase font-semibold flex items-center gap-1"><Activity size={10}/> Activity Log</span>
                                <span className="text-[10px] text-gray-600 font-normal mr-1">Click to add note</span>
                            </div>
                            <div className="p-2 pt-1 space-y-1">
                                {isAddingLog && (
                                    <div className="mb-2 flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-200 border-b border-blue-100 dark:border-blue-900/30 pb-2">
                                        <span className="text-green-600 dark:text-green-500 text-[10px] whitespace-nowrap">{getLogTimestamp()}:</span>
                                        <input ref={newLogInputRef} className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs px-1 rounded outline-none border border-blue-500 placeholder-gray-400" placeholder="Type note & hit Enter..." value={newLogText} onChange={(e) => setNewLogText(e.target.value)} onBlur={handleAddNewLog} onKeyDown={(e) => { if (e.key === 'Enter') handleAddNewLog(); if (e.key === 'Escape') setIsAddingLog(false); }} onClick={(e) => e.stopPropagation()} />
                                    </div>
                                )}
                                {buyer.notes && buyer.notes.length > 0 ? (
                                    buyer.notes.map((log, idx) => {
                                        return (
                                            <div key={idx} className="text-gray-700 dark:text-gray-300 break-words hover:bg-gray-200 dark:hover:bg-gray-800 rounded px-1 -mx-1 transition-colors">
                                                {editingLogIdx === idx ? (
                                                    <input autoFocus className="w-full bg-white dark:bg-black text-gray-900 dark:text-white px-1 rounded outline-none border border-blue-500" value={tempLogValue} onChange={(e) => setTempLogValue(e.target.value)} onBlur={() => handleSaveLogEdit(idx)} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLogEdit(idx); if (e.key === 'Escape') setEditingLogIdx(-1); }} onClick={(e) => e.stopPropagation()} />
                                                ) : (
                                                    <div onClick={(e) => { e.stopPropagation(); setEditingLogIdx(idx); setTempLogValue(log); }}>• {log}</div>
                                                )}
                                            </div>
                                        );
                                    })
                                ) : (!isAddingLog && <div className="text-gray-400 dark:text-gray-500 italic px-1">No activity recorded.</div>)}
                            </div>
                        </div>

                         <div className="mt-3 flex justify-end">
                            {isDeleting ? (
                                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                                    <span className="text-xs text-red-500 font-bold">Delete Buyer?</span>
                                    <button onClick={(e) => { e.stopPropagation(); onDelete(buyer.id); }} className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1 rounded font-bold">Yes</button>
                                    <button onClick={(e) => { e.stopPropagation(); setIsDeleting(false); }} className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-white text-xs px-3 py-1 rounded">No</button>
                                </div>
                            ) : (
                                <button onClick={(e) => { e.stopPropagation(); setIsDeleting(true); }} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="Delete Buyer">
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};