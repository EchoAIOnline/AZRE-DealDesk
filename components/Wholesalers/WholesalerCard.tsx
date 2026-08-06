
import React, { useState } from 'react';
import { Pencil, Trash2, Briefcase, Phone, Mail, Eye, User, ChevronDown, ChevronUp } from 'lucide-react';
import { Wholesaler } from '../../types';
import { formatPhoneNumber, processPhotoUrl } from '../../services/utils';

interface WholesalerCardProps {
    wholesaler: Wholesaler;
    onEdit: (wholesaler: Wholesaler) => void;
    onDelete: (id: string) => void;
    onView?: (wholesaler: Wholesaler) => void;
}

export const WholesalerCard: React.FC<WholesalerCardProps> = ({ wholesaler, onEdit, onDelete, onView }) => {
    const [isDeleting, setIsDeleting] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    
    return (
        <div 
          onClick={() => { if(!isDeleting) onView ? onView(wholesaler) : onEdit(wholesaler) }}
          className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:border-orange-500/50 transition group cursor-pointer shadow-sm hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-800/80 flex gap-4 items-start"
        >
            {/* Left Side: Large Rectangular Profile Picture */}
            <div className="w-24 h-32 shrink-0 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-100 dark:border-gray-600 shadow-sm relative">
                {wholesaler.photo ? (
                    <img src={processPhotoUrl(wholesaler.photo)} alt={wholesaler.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500">
                        <User size={32} fill="currentColor" className="opacity-50 mb-1" />
                    </div>
                )}
            </div>
            
            {/* Right Side: Info */}
            <div className="flex-1 min-w-0 flex flex-col min-h-[8rem]">
                <div className="flex-1">
                    <div className="min-w-0 pr-2">
                        <div className="flex justify-between items-start">
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white leading-tight break-words">
                                {wholesaler.name}
                            </h3>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                                wholesaler.status === 'Vetted' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' :
                                wholesaler.status === 'Blacklisted' ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' :
                                wholesaler.status === 'JV Partner' ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800' :
                                'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
                            }`}>
                                {wholesaler.status || 'New'}
                            </span>
                        </div>
                        <div className="text-xs text-orange-600 dark:text-orange-400 font-medium mt-1 flex items-start gap-1">
                            <Briefcase size={12} className="shrink-0 mt-0.5"/> 
                            <span className="break-words">{wholesaler.companyName || 'No Company'}</span>
                        </div>
                    </div>
                    
                    <div className="space-y-1.5 mt-3">
                        <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                            <Phone size={14} className="text-gray-400 dark:text-gray-500 shrink-0 mt-0.5"/> 
                            <span className="break-all">{wholesaler.phone ? formatPhoneNumber(wholesaler.phone) : '-'}</span>
                        </div>
                        <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                            <Mail size={14} className="text-gray-400 dark:text-gray-500 shrink-0 mt-0.5"/> 
                            <span className="break-all">{wholesaler.email || '-'}</span>
                        </div>
                    </div>
                </div>

                {/* Bottom Actions Row */}
                <div className="flex justify-end items-center gap-2 mt-2 pt-2" onClick={(e) => e.stopPropagation()}>
                    {/* Action Buttons */}
                    <div className="flex gap-1 relative">
                         {isDeleting ? (
                             <div className="absolute right-0 bottom-full mb-2 z-10 bg-white dark:bg-gray-800 p-2 rounded shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col gap-2 min-w-[100px]">
                                 <span className="text-[10px] font-bold text-red-600 text-center whitespace-nowrap">Confirm Delete?</span>
                                 <div className="flex gap-1 justify-center">
                                     <button onClick={(e) => {e.stopPropagation(); setIsDeleting(false); onDelete(wholesaler.id); }} className="bg-red-600 text-white text-[10px] px-2 py-1 rounded font-bold hover:bg-red-700 flex-1">Yes</button>
                                     <button onClick={(e) => {e.stopPropagation(); setIsDeleting(false)}} className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white text-[10px] px-2 py-1 rounded hover:bg-gray-300 flex-1">No</button>
                                 </div>
                             </div>
                         ) : (
                             <>
                                 {onView && (
                                     <button onClick={(e) => {e.stopPropagation(); onView(wholesaler)}} className="p-1.5 text-gray-400 hover:text-green-500 dark:hover:text-green-400 transition-colors rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="View Profile"><Eye size={16}/></button>
                                 )}
                                 <button onClick={(e) => {e.stopPropagation(); onEdit(wholesaler)}} className="p-1.5 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Edit Wholesaler"><Pencil size={16}/></button>
                                 <button onClick={(e) => {e.stopPropagation(); setIsDeleting(true)}} className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Delete Wholesaler"><Trash2 size={16}/></button>
                             </>
                         )}
                    </div>

                    <button 
                         onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                         className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 transition-colors"
                         title={isExpanded ? "Collapse" : "Expand Details"}
                    >
                         {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                </div>

                {isExpanded && wholesaler.notes && wholesaler.notes.length > 0 && (
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded text-xs text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 animate-in fade-in slide-in-from-top-2">
                         <div className="font-bold mb-2 uppercase text-[10px] text-gray-400">Notes & Activity</div>
                         <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                             {wholesaler.notes.map((note, idx) => (
                                <div key={idx} className="border-l-2 border-gray-300 dark:border-gray-700 pl-2">
                                    {note}
                                </div>
                             ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
