
import React, { useState } from 'react';
import { Pencil, Trash2, Briefcase, Phone, Mail, Eye, User, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { Agent } from '../../types';
import { formatPhoneNumber } from '../../services/utils';

interface AgentCardProps {
    agent: Agent;
    onEdit: (agent: Agent) => void;
    onDelete: (id: string) => void;
    onView?: (agent: Agent) => void;
}

export const AgentCard: React.FC<AgentCardProps> = ({ agent, onEdit, onDelete, onView }) => {
    const [isDeleting, setIsDeleting] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    const renderFollowUp = () => {
        if (!agent.nextFollowUpDate) return null;
        
        // Ensure consistent parsing by appending time or parsing parts
        const [year, month, day] = agent.nextFollowUpDate.split('-').map(Number);
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


    
    return (
        <div 
          onClick={() => { if(!isDeleting) onView ? onView(agent) : onEdit(agent) }}
          className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:border-purple-500/50 transition group cursor-pointer shadow-sm hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-800/80 flex flex-col gap-4"
        >
            <div className="flex gap-4 items-start w-full">
            {/* Left Side: Large Rectangular Profile Picture */}
            <div className="w-24 h-32 shrink-0 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-100 dark:border-gray-600 shadow-sm relative">
                {agent.photo ? (
                    <img src={agent.photo} alt={agent.name} className="w-full h-full object-cover" />
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
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white leading-tight break-words">
                            {agent.name}
                        </h3>
                        <div className="text-xs text-purple-600 dark:text-purple-400 font-medium mt-1 flex items-start gap-1">
                            <Briefcase size={12} className="shrink-0 mt-0.5"/> 
                            <span className="break-words">{agent.brokerage || 'No Brokerage'}</span>
                        </div>
                    </div>
                    
                    <div className="space-y-1.5 mt-3">
                        <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                            <Phone size={14} className="text-gray-400 dark:text-gray-500 shrink-0 mt-0.5"/> 
                            <span className="break-all">{agent.phone ? formatPhoneNumber(agent.phone) : '-'}</span>
                        </div>
                        <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                            <Mail size={14} className="text-gray-400 dark:text-gray-500 shrink-0 mt-0.5"/> 
                            <span className="break-all">{agent.email || '-'}</span>
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
                                     <button onClick={(e) => {e.stopPropagation(); onDelete(agent.id)}} className="bg-red-600 text-white text-[10px] px-2 py-1 rounded font-bold hover:bg-red-700 flex-1">Yes</button>
                                     <button onClick={(e) => {e.stopPropagation(); setIsDeleting(false)}} className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white text-[10px] px-2 py-1 rounded hover:bg-gray-300 flex-1">No</button>
                                 </div>
                             </div>
                         ) : (
                             <>
                                 {onView && (
                                     <button onClick={(e) => {e.stopPropagation(); onView(agent)}} className="p-1.5 text-gray-400 hover:text-green-500 dark:hover:text-green-400 transition-colors rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="View Profile"><Eye size={16}/></button>
                                 )}
                                 <button onClick={(e) => {e.stopPropagation(); onEdit(agent)}} className="p-1.5 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Edit Agent"><Pencil size={16}/></button>
                                 <button onClick={(e) => {e.stopPropagation(); setIsDeleting(true)}} className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Delete Agent"><Trash2 size={16}/></button>
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

                </div>
            </div>
            {renderFollowUp()}
            {isExpanded && agent.notes && agent.notes.length > 0 && (
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded text-xs text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 animate-in fade-in slide-in-from-top-2">
                     <div className="font-bold mb-2 uppercase text-[10px] text-gray-400">Notes & Activity</div>
                     <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                         {agent.notes.map((note, idx) => (
                            <div key={idx} className="border-l-2 border-gray-300 dark:border-gray-700 pl-2">
                                {note}
                            </div>
                         ))}
                    </div>
                </div>
            )}
        </div>
    );
};
