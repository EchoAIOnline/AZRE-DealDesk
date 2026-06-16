
import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Plus, User, Briefcase, Calendar, Trash2, ChevronDown } from 'lucide-react';
import { Agent, Buyer, User as UserType } from '../../types';

interface CalendarEventModalProps {
    isOpen: boolean;
    onClose: () => void;
    date: Date;
    type: 'agents' | 'buyers';
    events: (Agent | Buyer)[];
    allItems: (Agent | Buyer)[];
    onAdd: (item: Agent | Buyer) => void;
    onView: (item: Agent | Buyer) => void;
    onRemove?: (item: Agent | Buyer) => void;
    onDateChange: (date: Date) => void;
    users?: UserType[];
    selectedManager?: string;
    onManagerChange?: (manager: string) => void;
}

export const CalendarEventModal: React.FC<CalendarEventModalProps> = ({ 
    isOpen, onClose, date, type, events, allItems, onAdd, onView, onRemove, onDateChange,
    users = [], selectedManager = 'All', onManagerChange
}) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (!isOpen) return null;

    const filteredItems = searchTerm.trim() 
        ? allItems.filter(item => {
            const nameMatch = (item.name || '').toLowerCase().includes(searchTerm.toLowerCase());
            const companyMatch = 'companyName' in item ? (item.companyName || '').toLowerCase().includes(searchTerm.toLowerCase()) : false;
            const brokerageMatch = 'brokerage' in item ? (item.brokerage || '').toLowerCase().includes(searchTerm.toLowerCase()) : false;
            return nameMatch || companyMatch || brokerageMatch;
        })
        : [];

    const handleAddItem = (item: Agent | Buyer) => {
        onAdd(item);
        setSearchTerm("");
        setShowSuggestions(false);
    };

    const formattedDate = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Helper for input value YYYY-MM-DD
    const toInputString = (d: Date) => {
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    };

    const handleDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if(!e.target.value) return;
        const [y, m, d] = e.target.value.split('-').map(Number);
        // Create date at local noon to avoid timezone shifts
        onDateChange(new Date(y, m - 1, d));
    };

    const displayEvents = selectedManager === 'All' 
        ? events 
        : events.filter(e => {
            const manager = 'acquisitionManager' in e ? e.acquisitionManager : (e as any).acquisitionManager;
            return manager === selectedManager;
        });

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-lg border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] h-[85vh]" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-start bg-gray-50 dark:bg-gray-800 shrink-0">
                    <div>
                        <div className="relative group w-fit">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                <Calendar className="text-blue-500" size={20} />
                                {formattedDate}
                                <ChevronDown size={16} className="text-gray-400" />
                            </h3>
                            <input 
                                type="date"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                value={toInputString(date)}
                                onChange={handleDateInput}
                            />
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Manage {type === 'agents' ? 'Agent' : 'Buyer'} Follow-Ups
                            </p>
                            {onManagerChange && users.length > 0 && (
                                <select 
                                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs px-2 py-1 text-gray-700 dark:text-gray-300 outline-none focus:border-blue-500 transition-colors"
                                    value={selectedManager}
                                    onChange={(e) => onManagerChange(e.target.value)}
                                >
                                    <option value="All">All Managers</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.name}>{u.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-white p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        <X size={20}/>
                    </button>
                </div>

                <div className="p-6 flex flex-col gap-6 flex-1 min-h-0">
                    
                    {/* Add Follow-Up Section */}
                    <div className="space-y-3 shrink-0">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                            <Plus size={14} className="text-blue-500"/> Add Follow-Up
                        </label>
                        <div className="relative" ref={searchRef}>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input 
                                    type="text" 
                                    placeholder={`Search ${type}...`} 
                                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg py-2.5 pl-10 pr-4 text-sm text-gray-900 dark:text-white focus:border-blue-500 outline-none transition-colors"
                                    value={searchTerm}
                                    onChange={(e) => { setSearchTerm(e.target.value); setShowSuggestions(true); }}
                                    onFocus={() => setShowSuggestions(true)}
                                />
                            </div>
                            
                            {showSuggestions && searchTerm.trim() && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50">
                                    {filteredItems.length > 0 ? (
                                        filteredItems.map((item, idx) => (
                                            <button 
                                                key={item.id}
                                                onClick={() => handleAddItem(item)}
                                                className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center justify-between group border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                                                        <User size={14} className="text-gray-500 dark:text-gray-400"/>
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-gray-900 dark:text-white">{item.name}</div>
                                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                                            {'brokerage' in item ? item.brokerage : ('companyName' in item ? item.companyName : '')}
                                                        </div>
                                                    </div>
                                                </div>
                                                <Plus size={16} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </button>
                                        ))
                                    ) : (
                                        <div className="p-4 text-center text-sm text-gray-500 italic">No results found.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="h-px bg-gray-200 dark:bg-gray-700 w-full shrink-0"></div>

                    {/* Scheduled Follow-Ups Section */}
                    <div className="flex flex-col gap-2 flex-1 min-h-0">
                        <div className="flex items-center justify-between px-1 shrink-0">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                <Calendar size={14} className="text-purple-500"/> Scheduled Follow-Ups
                            </label>
                            <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full font-bold">
                                {displayEvents.length}
                            </span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/30 p-2 space-y-2">
                            {displayEvents.length > 0 ? (
                                displayEvents.map((item, idx) => (
                                    <div 
                                        key={idx} 
                                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:border-blue-400 dark:hover:border-blue-500 transition-all group flex items-center justify-between shadow-sm cursor-pointer"
                                        onClick={() => onView(item)}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-1.5 h-10 rounded-full shrink-0 ${type === 'agents' ? 'bg-blue-500' : 'bg-purple-500'}`}></div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-gray-900 dark:text-white text-sm truncate">{item.name}</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 truncate">
                                                    <Briefcase size={10} className="shrink-0" />
                                                    <span className="truncate">{'brokerage' in item ? (item.brokerage || 'No Brokerage') : ('companyName' in item ? (item.companyName || 'No Company') : '')}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 pl-2">
                                            {onRemove && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); onRemove(item); }}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Remove"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
                                    <Calendar size={32} className="text-gray-300 dark:text-gray-600 mb-2"/>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">No follow-ups scheduled.</p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
                
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-end shrink-0">
                    <button onClick={onClose} className="px-6 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg font-bold text-sm transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
