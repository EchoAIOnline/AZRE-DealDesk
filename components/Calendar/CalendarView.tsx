
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, User, Users, Briefcase, Trash2, Plus } from 'lucide-react';
import { Agent, Buyer, User as UserType } from '../../types';
import { formatPhoneNumber } from '../../services/utils';
import { api } from '../../services/api';
import { CalendarEventModal } from './CalendarEventModal';

interface CalendarViewProps {
    agents: Agent[];
    buyers: Buyer[];
    onUpdateAgent: (agentId: string, updates: Partial<Agent>) => void;
    onUpdateBuyer: (buyerId: string, updates: Partial<Buyer>) => void;
    onViewAgent?: (agent: Agent) => void;
    onViewBuyer?: (buyer: Buyer) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ agents, buyers, onUpdateAgent, onUpdateBuyer, onViewAgent, onViewBuyer }) => {
    const [viewMode, setViewMode] = useState<'agents' | 'buyers'>('agents');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedAcqManager, setSelectedAcqManager] = useState<string>('All');
    const [users, setUsers] = useState<UserType[]>([]);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const fetchedUsers = await api.load('Users') as UserType[];
                setUsers(fetchedUsers);
            } catch (e) {
                console.error("Failed to load users for acquisition manager dropdown", e);
            }
        };
        fetchUsers();
    }, []);

    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const monthName = currentDate.toLocaleString('default', { month: 'long' });

    // Calculate exact number of rows needed to display the month
    const numRows = Math.ceil((firstDay + daysInMonth) / 7);

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const goToToday = () => setCurrentDate(new Date());

    const formatDateStr = (date: Date) => {
        const y = date.getFullYear();
        const m = date.getMonth();
        const d = date.getDate();
        return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    };

    const formatDbDate = (y: number, m: number, d: number) => {
        return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    };

    const getEventsForDay = (day: number) => {
        const dateStr = formatDbDate(year, month, day);
        if (viewMode === 'agents') {
            let filtered = agents.filter(a => a.nextFollowUpDate && a.nextFollowUpDate === dateStr);
            if (selectedAcqManager !== 'All') {
                filtered = filtered.filter(a => a.acquisitionManager === selectedAcqManager);
            }
            return filtered;
        } else {
            let filtered = buyers.filter(b => b.nextFollowUpDate && b.nextFollowUpDate === dateStr);
            if (selectedAcqManager !== 'All') {
                filtered = filtered.filter(b => (b as any).acquisitionManager === selectedAcqManager);
            }
            return filtered;
        }
    };

    const isToday = (day: number) => {
        const today = new Date();
        return today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
    };

    const handleEventClick = (item: Agent | Buyer) => {
        if (viewMode === 'agents' && onViewAgent) {
            onViewAgent(item as Agent);
        } else if (viewMode === 'buyers' && onViewBuyer) {
            onViewBuyer(item as Buyer);
        }
    };

    const handleDateClick = (day: number) => {
        const date = new Date(year, month, day);
        setSelectedDate(date);
    };

    const handleAddFollowUp = (item: Agent | Buyer) => {
        if (!selectedDate) return;
        const dateStr = formatDateStr(selectedDate);
        
        if (viewMode === 'agents') {
            onUpdateAgent(item.id, { nextFollowUpDate: dateStr, overrideDuplicate: true });
        } else {
            onUpdateBuyer(item.id, { nextFollowUpDate: dateStr, overrideDuplicate: true });
        }
    };

    const handleRemoveFollowUp = (item: Agent | Buyer) => {
        // Use null to clear the date effectively
        if (viewMode === 'agents') {
            onUpdateAgent(item.id, { nextFollowUpDate: null as any, overrideDuplicate: true });
        } else {
            onUpdateBuyer(item.id, { nextFollowUpDate: null as any, overrideDuplicate: true });
        }
    };

    const handleRemoveDirectly = (e: React.MouseEvent, item: Agent | Buyer) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.confirm(`Remove follow-up for ${item.name}?`)) {
            handleRemoveFollowUp(item);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-6 overflow-hidden">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4 gap-4">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-3 w-full lg:w-auto">
                    <h2 className="text-2xl font-bold flex items-center gap-2 shrink-0">
                        <CalendarIcon className="text-blue-500" size={24} />
                        Calendar
                    </h2>
                    
                    <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
                        <div className="flex flex-col sm:flex-row bg-white dark:bg-gray-800 rounded-md p-1 border border-gray-200 dark:border-gray-700 flex-1 md:flex-none">
                            <button 
                                onClick={() => setViewMode('agents')}
                                className={`flex-1 md:flex-none px-2.5 py-1 rounded text-[10px] uppercase font-bold transition-all flex items-center justify-center gap-1 whitespace-nowrap ${viewMode === 'agents' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                            >
                                <User size={12} /> Agent Follow-Ups
                            </button>
                            <button 
                                onClick={() => setViewMode('buyers')}
                                className={`flex-1 md:flex-none px-2.5 py-1 rounded text-[10px] uppercase font-bold transition-all flex items-center justify-center gap-1 whitespace-nowrap ${viewMode === 'buyers' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                            >
                                <Users size={12} /> Buyer Follow-Ups
                            </button>
                        </div>
                        
                        <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-md p-0.5 border border-gray-200 dark:border-gray-700">
                            <Briefcase size={12} className="text-gray-500 ml-1.5" />
                            <select 
                                className="bg-transparent text-[10px] font-bold outline-none text-gray-700 dark:text-gray-300 py-0.5 pr-1 focus:ring-0"
                                value={selectedAcqManager}
                                onChange={(e) => setSelectedAcqManager(e.target.value)}
                            >
                                <option value="All">All Managers</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.name}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                        <button 
                            onClick={() => setSelectedDate(new Date())}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded-md shadow-sm flex items-center justify-center gap-1 text-[10px] uppercase font-bold transition-all flex-1 md:flex-none whitespace-nowrap"
                        >
                            <Plus size={12} /> 
                            <span className="">Add Follow-Up</span>
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-between w-full md:w-auto gap-2 bg-white dark:bg-gray-800 p-1 rounded-md border border-gray-200 dark:border-gray-700 shadow-sm">
                    <button onClick={prevMonth} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-400 hover:text-gray-900 dark:hover:text-white transition"><ChevronLeft size={16} /></button>
                    <span className="text-xs font-bold flex-1 text-center select-none whitespace-nowrap min-w-[100px] uppercase">{monthName} {year}</span>
                    <button onClick={nextMonth} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-400 hover:text-gray-900 dark:hover:text-white transition"><ChevronRight size={16} /></button>
                    <button onClick={goToToday} className="text-[10px] uppercase font-bold bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-2 py-0.5 rounded transition">Today</button>
                </div>
            </div>

            <div className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-2xl flex flex-col min-h-0">
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shrink-0">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="py-3 text-center text-sm font-bold text-gray-500 uppercase tracking-wider">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 flex-1 min-h-0" style={{ gridTemplateRows: `repeat(${numRows}, minmax(0, 1fr))` }}>
                    {/* Empty cells for days before start of month */}
                    {Array.from({ length: firstDay }).map((_, i) => (
                        <div key={`empty-${i}`} className="bg-gray-50 dark:bg-gray-800/50 border-r border-b border-gray-200 dark:border-gray-700/50"></div>
                    ))}

                    {/* Days of month */}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const events = getEventsForDay(day);
                        const today = isToday(day);

                        return (
                            <div 
                                key={day} 
                                onClick={() => handleDateClick(day)}
                                className={`border-r border-b border-gray-200 dark:border-gray-700 p-2 group transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30 flex flex-col cursor-pointer overflow-hidden ${today ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-1 pointer-events-none shrink-0">
                                    <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium ${today ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-900 dark:group-hover:text-white'}`}>
                                        {day}
                                    </div>
                                </div>
                                
                                {/* Desktop View: List */}
                                <div className="hidden md:block flex-1 overflow-y-auto custom-scrollbar space-y-1.5 min-h-0 pr-1">
                                    {viewMode === 'agents' ? (
                                        events.length > 0 && (
                                            <div className="text-xs p-2 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200 border border-blue-200 dark:border-blue-900 font-medium text-center shadow-sm">
                                                {events.length} Agent Follow-Ups Scheduled
                                            </div>
                                        )
                                    ) : (
                                        events.map((item, idx) => (
                                            <div 
                                                key={idx} 
                                                onClick={(e) => { e.stopPropagation(); handleEventClick(item); }}
                                                className={`group/item relative text-xs p-1.5 rounded border border-l-4 shadow-sm cursor-pointer transition hover:scale-[1.02] active:scale-95 pr-6 bg-purple-50 dark:bg-purple-900/40 border-purple-200 dark:border-purple-900 border-l-purple-500 text-purple-700 dark:text-purple-200`}
                                                title={item.name}
                                            >
                                                <div className="font-bold truncate">{item.name}</div>
                                                {viewMode === 'buyers' && (item as Buyer).phone && (
                                                    <div className="text-[10px] opacity-70 truncate">{formatPhoneNumber((item as Buyer).phone)}</div>
                                                )}
                                                
                                                <button 
                                                    type="button"
                                                    onClick={(e) => handleRemoveDirectly(e, item)}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    onMouseUp={(e) => e.stopPropagation()}
                                                    className="absolute top-1 right-1 p-1.5 rounded md:opacity-0 group-hover/item:opacity-100 hover:bg-white dark:hover:bg-gray-700 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-all z-20 pointer-events-auto"
                                                    title="Remove"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Mobile View: 'View' Button */}
                                {events.length > 0 && (
                                    <div className="md:hidden flex-1 flex items-end w-full">
                                        <button className="w-full py-1.5 bg-blue-100/80 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 text-[10px] font-bold rounded transition-colors backdrop-blur-sm shadow-sm">
                                            View
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    
                    {/* Fill remaining cells to complete the grid if needed */}
                    {Array.from({ length: (42 - (daysInMonth + firstDay)) % 7 }).map((_, i) => (
                        <div key={`end-empty-${i}`} className="bg-gray-50 dark:bg-gray-800/50 border-r border-b border-gray-200 dark:border-gray-700/50"></div>
                    ))}
                </div>
            </div>

            {selectedDate && (
                <CalendarEventModal 
                    isOpen={true}
                    onClose={() => setSelectedDate(null)}
                    date={selectedDate}
                    type={viewMode}
                    events={
                        viewMode === 'agents' 
                        ? agents.filter(a => a.nextFollowUpDate === formatDateStr(selectedDate))
                        : buyers.filter(b => b.nextFollowUpDate === formatDateStr(selectedDate))
                    }
                    allItems={viewMode === 'agents' ? agents : buyers}
                    onAdd={handleAddFollowUp}
                    onView={(item) => { handleEventClick(item); }}
                    onRemove={handleRemoveFollowUp}
                    onDateChange={setSelectedDate}
                    users={users}
                    selectedManager={selectedAcqManager}
                    onManagerChange={setSelectedAcqManager}
                />
            )}
        </div>
    );
};
