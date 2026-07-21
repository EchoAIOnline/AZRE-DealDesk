
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Phone, Mail, Briefcase, MessageSquare, User, Calendar, Save, Upload, Search, Loader2, MapPin, CheckCircle, AlertCircle, Clock, Link, ExternalLink, AlertTriangle, Plus, Home, Pencil, Trash2, ArrowRightLeft } from 'lucide-react';
import { Agent, Deal, User as UserType } from '../../types';
import { api } from '../../services/api';
import { formatPhoneNumber, fetchAgentPhotoFromGAMLS, fetchAgentDetailsFromGAMLS, getLogTimestamp, calculateDaysRemaining, formatCurrency, processPhotoUrl } from '../../services/utils';
import { ModalFooter, NavigationArrows, UnsavedChangesModal } from '../Shared/ModalComponents';
import { useAutoSave, SavedNotification } from '../Shared/AutoSave';

interface AgentProfileModalProps {
    agent: Agent;
    onClose: () => void;
    onUpdateAgent?: (agentId: string, updates: Partial<Agent>) => void;
    currentUser?: UserType | null;
    deals?: Deal[];
    onOpenDeal?: (deal: Deal) => void;
    onDelete?: (id: string) => void;
    
    // Navigation Props
    onNavigate?: (direction: 'prev' | 'next') => void;
    hasNext?: boolean;
    hasPrevious?: boolean;
    
    zIndex?: string; // New Prop for dynamic stacking

    // Move Props
    onMoveToBuyer?: () => void;
    onMoveToWholesaler?: () => void;
}

export const AgentProfileModal: React.FC<AgentProfileModalProps> = ({ 
    agent, onClose, onUpdateAgent, currentUser, deals = [], onOpenDeal, onDelete,
    onNavigate, hasNext = false, hasPrevious = false,
    zIndex = 'z-[140]', // Default if not provided
    onMoveToBuyer, onMoveToWholesaler
}) => {
    const [isFetchingPhoto, setIsFetchingPhoto] = useState(false);
    const [isFetchingInfo, setIsFetchingInfo] = useState(false);
    const cleanAgentNotes = (inputAgent: Agent): Agent => {
        const cleanedAgent = { ...inputAgent };
        if (cleanedAgent.notes && cleanedAgent.notes.length > 0) {
            const cleanedNotes: string[] = [];
            let hasAddedNote = false;
            cleanedAgent.notes.forEach(note => {
                if (note.includes('Added from deal')) {
                    if (!hasAddedNote) {
                        cleanedNotes.push(note);
                        hasAddedNote = true;
                    }
                } else {
                    cleanedNotes.push(note);
                }
            });
            cleanedAgent.notes = cleanedNotes;
        }
        return cleanedAgent;
    };

    const [formData, _setFormData] = useState<Agent>(() => cleanAgentNotes(agent));
    const formDataRef = useRef(formData);

    const setFormData = useCallback((newData: Agent | ((prev: Agent) => Agent)) => {
        if (typeof newData === 'function') {
            const updated = newData(formDataRef.current);
            formDataRef.current = updated;
            _setFormData(updated);
        } else {
            formDataRef.current = newData;
            _setFormData(newData);
        }
    }, []);

    const [newNote, setNewNote] = useState("");
    const [dealSearch, setDealSearch] = useState("");
    const [showDealSearch, setShowDealSearch] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Note Editing State
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [tempNoteContent, setTempNoteContent] = useState("");
    const [users, setUsers] = useState<UserType[]>([]);

    // Scroll Restoration Logic
    useEffect(() => {
        const scrollContainer = document.querySelector('main.flex-1.overflow-y-auto');
        let scrollPos = 0;
        if (scrollContainer) {
            scrollPos = scrollContainer.scrollTop;
        }

        return () => {
            if (scrollContainer) {
                setTimeout(() => {
                    scrollContainer.scrollTop = scrollPos;
                }, 10);
                setTimeout(() => {
                    scrollContainer.scrollTop = scrollPos;
                }, 50); // Fallback to ensure it's set after all renders
            }
        };
    }, []);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const fetchedUsers = await api.load('Users') as UserType[];
                // You can also consider using the org restricted hook or we just assume they're already fetched
                setUsers(fetchedUsers);
            } catch (e) {
                console.error("Failed to load users for acquisition manager dropdown", e);
            }
        };
        fetchUsers();
    }, []);

    // Save Logic States
    const initialAgentJson = useRef(JSON.stringify(agent));
    const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
    const [warningSelectedOption, setWarningSelectedOption] = useState<'yes' | 'no'>('yes');
    const [pendingNavigation, setPendingNavigation] = useState<'prev' | 'next' | null>(null);

    // --- STATE REF PATTERN FOR AUTO-SAVE ---
    // Helper to save specific data immediately (avoiding stale state closure issues)
    const saveData = useCallback(async (dataToSave: Agent) => {
        if (onUpdateAgent) {
            await Promise.resolve(onUpdateAgent(agent.id, dataToSave));
        }
        initialAgentJson.current = JSON.stringify(dataToSave);
    }, [agent.id, onUpdateAgent]);

    // Auto-Save Hook
    const { triggerSave, showSavedNotification, setShowSavedNotification, showErrorNotification, errorMessage,  handleAutoSave } = useAutoSave({
        onSave: () => saveData(formDataRef.current)
    });

    // Helper to update state AND save immediately (for buttons/toggles)
    const updateAndSave = (updates: Partial<Agent>) => {
        const newData = { ...formDataRef.current, ...updates };
        setFormData(newData);
        saveData(newData);
        setShowSavedNotification(true);
        setTimeout(() => setShowSavedNotification(false), 1000);
    };

    // Update internal state when agent prop changes (navigation)
    useEffect(() => {
        const cleanedAgent = cleanAgentNotes(agent);
        setFormData(cleanedAgent);
        formDataRef.current = cleanedAgent;
        initialAgentJson.current = JSON.stringify(cleanedAgent);
        
        // If the cleaned agent is different from the original agent, save it back
        if (JSON.stringify(cleanedAgent.notes) !== JSON.stringify(agent.notes)) {
            if (onUpdateAgent) {
                onUpdateAgent(cleanedAgent.id, { notes: cleanedAgent.notes });
            }
        }
        
        setPendingNavigation(null);
        setIsDeleting(false);
        setEditingNoteIndex(null);
        setTempNoteContent("");
    }, [agent.id]);

    const handleCloseClick = () => {
        const currentJson = JSON.stringify(formDataRef.current);
        if (currentJson !== initialAgentJson.current) {
            setWarningSelectedOption('yes');
            setShowUnsavedWarning(true);
        } else {
            onClose();
        }
    };

    const handleNavigationClick = (direction: 'prev' | 'next') => {
        const currentJson = JSON.stringify(formDataRef.current);
        if (currentJson !== initialAgentJson.current) {
            setPendingNavigation(direction);
            setWarningSelectedOption('yes');
            setShowUnsavedWarning(true);
        } else if (onNavigate) {
            onNavigate(direction);
        }
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Priority 1: Warning Modal Interaction
            if (showUnsavedWarning) {
                 if (['ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
                    e.preventDefault();
                    e.stopPropagation();
                 }
                 
                 if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                     setWarningSelectedOption(prev => prev === 'yes' ? 'no' : 'yes');
                 } else if (e.key === 'Enter') {
                     if (warningSelectedOption === 'yes') {
                         saveData(formDataRef.current);
                         if (pendingNavigation && onNavigate) {
                             onNavigate(pendingNavigation);
                         } else {
                             onClose();
                         }
                         setShowUnsavedWarning(false);
                     } else {
                         setShowUnsavedWarning(false);
                         if (pendingNavigation && onNavigate) {
                             onNavigate(pendingNavigation);
                         } else {
                             onClose();
                         }
                     }
                 }
                 return;
            }

            const target = e.target as HTMLElement;
            const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;

            // NEW: Enter key to blur inputs (deselect field)
            if (e.key === 'Enter' && isInput) {
                // Ignore for Textareas to allow multi-line input
                if (target.tagName === 'TEXTAREA') return; 
                
                if (e.defaultPrevented) return;

                e.preventDefault();
                target.blur();
                triggerSave(); 
                return;
            }

            // Save Shortcut (S or Ctrl+S)
            if ((e.key.toLowerCase() === 's' && (e.metaKey || e.ctrlKey))) {
                e.preventDefault();
                triggerSave();
                return;
            }

            // Escape to Close
            if (e.key === 'Escape') {
                e.preventDefault();
                handleCloseClick();
                return;
            }

            if (isInput) return;

            // Navigation Arrows
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (hasPrevious) handleNavigationClick('prev');
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                if (hasNext) handleNavigationClick('next');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showUnsavedWarning, warningSelectedOption, saveData, onClose, pendingNavigation, hasNext, hasPrevious, onNavigate, triggerSave]);

    const handleChange = (field: keyof Agent, value: any) => {
        setFormData(prev => {
            const newData = { ...prev, [field]: value };
            
            if (field === 'agentFirstName' || field === 'agentLastName') {
                const firstName = newData.agentFirstName || '';
                const lastName = newData.agentLastName || '';
                newData.name = `${firstName} ${lastName}`.trim();
            }
            
            formDataRef.current = newData; // Update ref immediately for blur events
            return newData;
        });
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                updateAndSave({ photo: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAutoFetchPhoto = async () => {
        setIsFetchingPhoto(true);
        try {
            const photoUrl = await fetchAgentPhotoFromGAMLS(formData.name, formData.phone);
            if (photoUrl) {
                updateAndSave({ photo: photoUrl });
            } else {
                alert("Could not automatically locate a profile picture on GAMLS for this agent. Please upload one manually.");
            }
        } catch (e: any) {
            if (e.message === "PERMISSION_NEEDED") {
                alert("Action Required: Please open your Google Apps Script project and click 'Run' on any function to authorize external requests.");
            } else {
                alert("Error connecting to GAMLS search.");
            }
        } finally {
            setIsFetchingPhoto(false);
        }
    };

    const handleAutoFetchDetails = async () => {
        setIsFetchingInfo(true);
        try {
            const details = await fetchAgentDetailsFromGAMLS(formData.name);
            if (details) {
                updateAndSave({
                    phone: details.phone ? formatPhoneNumber(details.phone) : formData.phone,
                    email: details.email || formData.email,
                    brokerage: details.brokerage || formData.brokerage,
                    brokeragePhone: details.brokeragePhone ? formatPhoneNumber(details.brokeragePhone) : formData.brokeragePhone,
                    brokerageAddress: details.brokerageAddress || formData.brokerageAddress,
                    photo: details.photoUrl || formData.photo
                });
            } else {
                alert("Could not automatically locate details for this agent.");
            }
        } catch (e: any) {
            if (e.message === "PERMISSION_NEEDED") {
                alert("Action Required: Please open your Google Apps Script project and click 'Run' on any function to authorize external requests.");
            } else {
                alert("Error connecting to search service.");
            }
        } finally {
            setIsFetchingInfo(false);
        }
    };

    const handleAddNote = () => {
        if (!newNote.trim()) return;
        const userName = currentUser?.name || 'User';
        const timestampedNote = `${getLogTimestamp()} - ${userName}: ${newNote}`;
        const updatedNotes = [timestampedNote, ...(formData.notes || [])];
        updateAndSave({ notes: updatedNotes });
        setNewNote("");
    };

    const handleSaveNoteEdit = (index: number) => {
        if (!tempNoteContent.trim()) return;
        const updatedNotes = [...(formData.notes || [])];
        updatedNotes[index] = tempNoteContent;
        updateAndSave({ notes: updatedNotes });
        setEditingNoteIndex(null);
    };

    const handleDeleteNote = (index: number) => {
        if (confirm("Delete this note?")) {
            const updatedNotes = (formData.notes || []).filter((_, i) => i !== index);
            updateAndSave({ notes: updatedNotes });
        }
    };

    const handleLinkDeal = (dealId: string) => {
        const currentIds = formData.closedDealIds || [];
        if (!currentIds.includes(dealId)) {
            updateAndSave({ closedDealIds: [...currentIds, dealId] });
        }
        setDealSearch("");
        setShowDealSearch(false);
    };

    const handleUnlinkDeal = (dealId: string) => {
        const currentIds = formData.closedDealIds || [];
        updateAndSave({ closedDealIds: currentIds.filter(id => id !== dealId) });
    };

    const handleRelationshipToggle = (field: keyof Agent, dateField: string) => {
        const newValue = !formData[field];
        const dates = { ...(formData.agentRelationshipDates || {}) };
        if (newValue) {
            dates[dateField] = new Date().toISOString();
        } else {
            delete dates[dateField];
        }
        updateAndSave({ [field]: newValue, agentRelationshipDates: dates });
    };

    // Helper for Relationship Buttons
    const RelationshipButton = ({ label, active, onClick, colorClass, date }: { label: string, active: boolean, onClick: () => void, colorClass: string, date?: string }) => (
        <button 
            type="button"
            onClick={onClick}
            className={`w-full h-full flex-1 py-3 px-2 rounded-lg text-xs md:text-sm font-bold border transition-all shadow-sm active:scale-95 flex flex-col items-center justify-center text-center gap-1 ${
                active ? colorClass : 'bg-gray-50 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
        >
            <div className="flex flex-col md:flex-row items-center justify-center text-center gap-2">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 ${active ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'}`}>
                    {active && <CheckCircle size={14} />}
                </span>
                <span>{label}</span>
            </div>
            {active && date && (
                <span className="text-[10px] opacity-80 font-normal mt-1">
                    {new Date(date).toLocaleDateString()}
                </span>
            )}
        </button>
    );

    // Follow Up Logic
    const getLastContactText = () => {
        if (!formData.lastContactDate) return 'Not Set';
        const days = calculateDaysRemaining(formData.lastContactDate);
        if (days === null) return 'Not Set';
        const absDays = Math.abs(days);
        if (days > 0) return `In ${absDays} Days`;
        if (days === 0) return 'Today';
        return `${absDays} Days Ago`;
    };

    const getFollowUpText = () => {
        if (!formData.nextFollowUpDate) return 'Not Set';
        const days = calculateDaysRemaining(formData.nextFollowUpDate);
        if (days === null) return 'Not Set';
        if (days < 0) return `${Math.abs(days)} Days Overdue`;
        if (days === 0) return 'Due Today';
        return `${days} Days`;
    };

    const getFollowUpColor = () => {
        if (!formData.nextFollowUpDate) return 'text-gray-400';
        const days = calculateDaysRemaining(formData.nextFollowUpDate);
        if (days === null) return 'text-gray-400';
        if (days < 0) return 'text-red-600 dark:text-red-400 font-bold';
        if (days <= 3) return 'text-yellow-600 dark:text-yellow-400 font-bold';
        return 'text-green-600 dark:text-green-400';
    };

    const daysUntilFollowUp = formData.nextFollowUpDate ? calculateDaysRemaining(formData.nextFollowUpDate) : null;

    // Filtered deals for search
    const filteredDeals = dealSearch.length > 2 
        ? deals.filter(d => d && (d.address || '').toLowerCase().includes(dealSearch.toLowerCase()) && !(formData.closedDealIds || []).includes(d.id))
        : [];

    const listedProperties = deals.filter(d => d && d.agentName && d.agentName.toLowerCase().trim() === (agent.name || '').toLowerCase().trim());

    return (
        <div className={`fixed inset-0 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm ${zIndex}`} onClick={handleCloseClick}>
            <style>{`
                .date-input-icon::-webkit-calendar-picker-indicator {
                    cursor: pointer;
                }
                .dark .date-input-icon::-webkit-calendar-picker-indicator {
                    filter: invert(1);
                }
            `}</style>
            
            {/* Navigation Arrows */}
            <NavigationArrows 
                onPrev={() => handleNavigationClick('prev')}
                onNext={() => handleNavigationClick('next')}
                hasPrev={hasPrevious}
                hasNext={hasNext}
                titlePrev="Previous Agent"
                titleNext="Next Agent"
            />

            <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-6xl border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden flex flex-col h-[90vh] relative" onClick={e => e.stopPropagation()}>
                
                <SavedNotification show={showSavedNotification} error={showErrorNotification} errorMessage={errorMessage} />

                {/* Header Section */}
                <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex flex-col md:flex-row items-center gap-6 shrink-0">
                     <div className="w-32 h-40 md:w-44 md:h-52 rounded-xl bg-white dark:bg-gray-700 border-4 border-white dark:border-gray-600 shadow-lg overflow-hidden relative group shrink-0">
                         {formData.photo ? (
                            <img src={processPhotoUrl(formData.photo)} alt="Agent" className="w-full h-full object-cover object-top" />
                         ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <User size={48} />
                            </div>
                         )}
                         <label className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                            <Upload size={20} className="text-white mb-1"/>
                            <span className="text-[10px] text-white font-bold uppercase tracking-wider">Upload</span>
                            <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                        </label>
                    </div>
                    
                    <div className="flex-1 text-center md:text-left space-y-2">
                        <div className="flex flex-col md:flex-row items-center gap-3">
                            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{formData.name}</h2>
                            {(isFetchingPhoto || isFetchingInfo) && <span className="text-xs flex items-center gap-1 text-blue-500 animate-pulse"><Loader2 size={12} className="animate-spin"/> Fetching...</span>}
                            <div className="flex gap-2">
                                <button onClick={handleAutoFetchPhoto} disabled={isFetchingPhoto || isFetchingInfo} className="text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 px-2 py-1 rounded text-gray-700 dark:text-gray-300 transition-colors">Auto-Fetch Photo</button>
                                <button onClick={handleAutoFetchDetails} disabled={isFetchingPhoto || isFetchingInfo} className="text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 px-2 py-1 rounded text-gray-700 dark:text-gray-300 transition-colors">Auto-Fetch Agent Info</button>
                            </div>
                        </div>
                        <div className="flex items-center justify-center md:justify-start gap-2 text-purple-600 dark:text-purple-400 font-medium text-lg">
                            <Briefcase size={18} />
                            {formData.brokerage || 'No Brokerage Listed'}
                        </div>
                        <div className="flex items-center justify-center md:justify-start gap-2 mt-2">
                            <label className="text-xs text-gray-500 font-bold uppercase shrink-0">Acquisition Manager:</label>
                            <select
                                className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-1 text-sm focus:border-blue-500 outline-none max-w-[200px]"
                                value={(formData as any).acquisitionManager || ''}
                                onChange={(e) => handleChange('acquisitionManager', e.target.value)}
                                onBlur={handleAutoSave}
                            >
                                <option value="">Unassigned</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.name}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button onClick={handleCloseClick} className="absolute top-4 right-4 bg-gray-200 dark:bg-gray-700 p-2 rounded-full text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
                        <X size={20}/>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-gray-50 dark:bg-gray-900/50">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                        
                        {/* LEFT COLUMN */}
                        <div className="space-y-8">
                            
                            {/* Contact Information */}
                            <section>
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 pb-2 mb-4 flex items-center gap-2">
                                    <Phone size={16}/> Contact Information
                                </h3>
                                <div className="space-y-4 bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Agent Full Name</label>
                                            <input className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-2 text-sm focus:border-blue-500 outline-none" 
                                                value={formData.name} onChange={e => handleChange('name', e.target.value)} onBlur={handleAutoSave} />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">First Name</label>
                                            <input className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-2 text-sm focus:border-blue-500 outline-none" 
                                                value={formData.agentFirstName || ''} onChange={e => handleChange('agentFirstName', e.target.value)} onBlur={handleAutoSave} />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Last Name</label>
                                            <input className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-2 text-sm focus:border-blue-500 outline-none" 
                                                value={formData.agentLastName || ''} onChange={e => handleChange('agentLastName', e.target.value)} onBlur={handleAutoSave} />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Mobile Number</label>
                                            <input className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-2 text-sm focus:border-blue-500 outline-none" 
                                                value={formData.phone} onChange={e => handleChange('phone', formatPhoneNumber(e.target.value))} onBlur={handleAutoSave} placeholder="(555) 555-5555" />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Email Address</label>
                                            <input className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-2 text-sm focus:border-blue-500 outline-none" 
                                                value={formData.email || ''} onChange={e => handleChange('email', e.target.value)} onBlur={handleAutoSave} placeholder="agent@example.com" />
                                {errorMessage?.includes('already exists') && (
                                    <label className="flex items-center gap-2 mt-2 text-xs text-red-500 font-bold bg-red-50 dark:bg-red-900/10 p-2 rounded border border-red-200 dark:border-red-900/50">
                                        <input 
                                            type="checkbox" 
                                            checked={(formData as any).overrideDuplicate || false}
                                            onChange={e => {
                                                handleChange('overrideDuplicate', e.target.checked);
                                                if (e.target.checked) setTimeout(() => triggerSave(), 50);
                                            }}
                                            className="rounded"
                                        />
                                        Save despite duplicate email
                                    </label>
                                )}
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Email List Subscription Status</label>
                                            <select
                                                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-2 text-sm focus:border-blue-500 outline-none"
                                                value={formData.subscriptionStatus || 'Subscribed'}
                                                onChange={e => updateAndSave({ subscriptionStatus: e.target.value as any })}
                                            >
                                                <option value="Subscribed">Subscribed</option>
                                                <option value="Unsubscribed">Unsubscribed</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Brokerage Name</label>
                                            <input className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-2 text-sm focus:border-blue-500 outline-none" 
                                                value={formData.brokerage} onChange={e => handleChange('brokerage', e.target.value)} onBlur={handleAutoSave} />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Brokerage Office Number</label>
                                            <input className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-2 text-sm focus:border-blue-500 outline-none" 
                                                value={formData.brokeragePhone || ''} onChange={e => handleChange('brokeragePhone', formatPhoneNumber(e.target.value))} onBlur={handleAutoSave} placeholder="(555) 555-5555" />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Brokerage Address</label>
                                            <input className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-2 text-sm focus:border-blue-500 outline-none" 
                                                value={formData.brokerageAddress || ''} onChange={e => handleChange('brokerageAddress', e.target.value)} onBlur={handleAutoSave} placeholder="123 Broker Lane, Atlanta GA" />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Agent Relationship */}
                            <section>
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 pb-2 mb-4 flex items-center gap-2">
                                    <User size={16}/> Agent Relationship
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 auto-rows-fr gap-3">
                                        <RelationshipButton 
                                            label="Sent Text To Agent" 
                                            active={!!formData.sentTextToAgent} 
                                            date={formData.agentRelationshipDates?.sentTextToAgent}
                                            onClick={() => handleRelationshipToggle('sentTextToAgent', 'sentTextToAgent')}
                                            colorClass="bg-pink-600 text-white border-pink-600 hover:bg-pink-500"
                                        />
                                        <RelationshipButton 
                                            label="Agent Responded To Text" 
                                            active={!!formData.agentRespondedToText} 
                                            date={formData.agentRelationshipDates?.agentRespondedToText}
                                            onClick={() => handleRelationshipToggle('agentRespondedToText', 'agentRespondedToText')}
                                            colorClass="bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-500"
                                        />
                                        <RelationshipButton 
                                            label="Investor Friendly" 
                                            active={!!formData.investorFriendly} 
                                            date={formData.agentRelationshipDates?.investorFriendly}
                                            onClick={() => handleRelationshipToggle('investorFriendly', 'investorFriendly')}
                                            colorClass="bg-blue-600 text-white border-blue-600 hover:bg-blue-500"
                                        />
                                        <RelationshipButton 
                                            label="Agreed To Send Deals" 
                                            active={!!formData.agreedToSend} 
                                            date={formData.agentRelationshipDates?.agreedToSend}
                                            onClick={() => handleRelationshipToggle('agreedToSend', 'agreedToSend')}
                                            colorClass="bg-purple-600 text-white border-purple-600 hover:bg-purple-500"
                                        />
                                        <RelationshipButton 
                                            label="Spoke With Agent" 
                                            active={!!formData.spokeWithAgent} 
                                            date={formData.agentRelationshipDates?.spokeWithAgent}
                                            onClick={() => handleRelationshipToggle('spokeWithAgent', 'spokeWithAgent')}
                                            colorClass="bg-orange-600 text-white border-orange-600 hover:bg-orange-500"
                                        />
                                        <RelationshipButton 
                                            label="Agent Sent Deal" 
                                            active={!!formData.agentSentDeal} 
                                            date={formData.agentRelationshipDates?.agentSentDeal}
                                            onClick={() => handleRelationshipToggle('agentSentDeal', 'agentSentDeal')}
                                            colorClass="bg-teal-600 text-white border-teal-600 hover:bg-teal-500"
                                        />
                                        <RelationshipButton 
                                            label="Closed With AZRE" 
                                            active={!!formData.hasClosedDeals} 
                                            date={formData.agentRelationshipDates?.hasClosedDeals}
                                            onClick={() => handleRelationshipToggle('hasClosedDeals', 'hasClosedDeals')}
                                            colorClass="bg-green-600 text-white border-green-600 hover:bg-green-500"
                                        />
                                </div>
                            </section>

                        </div>

                        {/* RIGHT COLUMN */}
                        <div className="space-y-8">
                            
                            {/* Closed Deals */}
                            <section>
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 pb-2 mb-4 flex items-center gap-2">
                                    <Link size={16}/> Closed Deals
                                </h3>
                                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm min-h-[160px] flex flex-col">
                                    <div className="relative mb-3">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14}/>
                                        <input 
                                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg py-2 pl-9 pr-4 text-sm focus:border-blue-500 outline-none"
                                            placeholder="Search deals by address to link..."
                                            value={dealSearch}
                                            onChange={(e) => { setDealSearch(e.target.value); setShowDealSearch(true); }}
                                            onFocus={() => setShowDealSearch(true)}
                                            onBlur={() => setTimeout(() => setShowDealSearch(false), 200)}
                                        />
                                        {showDealSearch && filteredDeals.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto z-10">
                                                {filteredDeals.map(deal => (
                                                    <div key={deal.id} onMouseDown={() => handleLinkDeal(deal.id)} className="px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/50 cursor-pointer text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                                                        {deal.address}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 flex flex-col gap-2">
                                        {formData.closedDealIds && formData.closedDealIds.length > 0 ? (
                                            formData.closedDealIds.map(dealId => {
                                                const deal = deals.find(d => d.id === dealId);
                                                if (!deal) return null;
                                                return (
                                                    <div key={dealId} className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-2 text-sm">
                                                        <button 
                                                            type="button"
                                                            onClick={() => onOpenDeal && onOpenDeal(deal)}
                                                            className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-medium hover:underline truncate"
                                                        >
                                                            <ExternalLink size={12}/> {deal.address}
                                                        </button>
                                                        <button onClick={() => handleUnlinkDeal(dealId)} className="text-gray-400 hover:text-red-500">
                                                            <X size={14}/>
                                                        </button>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm italic border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                                                No closed deals linked yet
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>

                            {/* Current Listed Properties */}
                            <section>
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 pb-2 mb-4 flex items-center gap-2">
                                    <Home size={16}/> Current Listed Properties
                                </h3>
                                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm min-h-[160px] flex flex-col">
                                    <div className="flex-1 overflow-y-auto max-h-[200px] space-y-2">
                                        {listedProperties.length > 0 ? (
                                            listedProperties.map(deal => (
                                                <div key={deal.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded p-2 text-sm">
                                                    <div className="flex flex-col truncate">
                                                        <button 
                                                            type="button"
                                                            onClick={() => onOpenDeal && onOpenDeal(deal)}
                                                            className="text-left font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 truncate transition-colors"
                                                        >
                                                            {deal.address}
                                                        </button>
                                                        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">{deal.offerDecision}</span>
                                                    </div>
                                                    <div className="text-xs font-mono font-medium text-gray-600 dark:text-gray-400">
                                                        {formatCurrency(deal.listPrice)}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm italic">
                                                No active listings found for this agent.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>

                            {/* Follow-Up Assistant (Moved from Left Column) */}
                            <section>
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 pb-2 mb-4 flex items-center gap-2">
                                    <Clock size={16}/> Follow-Up Assistant
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <label className="text-xs text-gray-500 block mb-2 uppercase font-bold">Last Contacted</label>
                                        <input type="date" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-2 text-sm focus:border-blue-500 outline-none mb-2 date-input-icon" 
                                            value={formData.lastContactDate || ''} onChange={e => handleChange('lastContactDate', e.target.value)} onBlur={handleAutoSave} />
                                        <div className="text-center bg-gray-100 dark:bg-gray-700/50 rounded py-2">
                                            <span className="text-[10px] uppercase text-gray-500 dark:text-gray-400 font-bold block">Time Since</span>
                                            <span className="text-sm font-bold text-gray-800 dark:text-white">{getLastContactText()}</span>
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <label className="text-xs text-gray-500 block mb-2 uppercase font-bold">Next Follow-Up</label>
                                        <input type="date" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-2 text-sm focus:border-blue-500 outline-none mb-2 date-input-icon" 
                                            value={formData.nextFollowUpDate || ''} onChange={e => handleChange('nextFollowUpDate', e.target.value)} onBlur={handleAutoSave} />
                                        <div className={`text-center bg-gray-100 dark:bg-gray-700/50 rounded py-2 border ${daysUntilFollowUp !== null && daysUntilFollowUp <= 0 ? 'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10' : 'border-transparent'}`}>
                                            <span className="text-[10px] uppercase text-gray-500 dark:text-gray-400 font-bold block">Due In</span>
                                            <span className={`text-sm font-bold ${getFollowUpColor()}`}>{getFollowUpText()}</span>
                                        </div>
                                    </div>
                                </div>
                            </section>

                        </div>
                    </div>

                    {/* Notes About The Agent (Moved to Bottom, Full Width) */}
                    <section className="flex flex-col h-[400px]">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 pb-2 mb-4 flex items-center gap-2">
                            <MessageSquare size={16}/> Notes About The Agent
                        </h3>
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col flex-1 overflow-hidden shadow-sm">
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900/50">
                                {formData.notes && formData.notes.length > 0 ? (
                                    formData.notes.map((note, idx) => (
                                        <div key={idx} className="bg-white dark:bg-gray-800 p-3 rounded shadow-sm border border-gray-100 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 group relative">
                                            {editingNoteIndex === idx ? (
                                                <div className="flex flex-col gap-2">
                                                    <textarea
                                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-2 text-sm focus:border-blue-500 outline-none resize-none"
                                                        value={tempNoteContent}
                                                        onChange={(e) => setTempNoteContent(e.target.value)}
                                                        rows={3}
                                                        autoFocus
                                                    />
                                                    <div className="flex justify-end gap-2">
                                                        <button 
                                                            onClick={() => setEditingNoteIndex(null)}
                                                            className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button 
                                                            onClick={() => handleSaveNoteEdit(idx)}
                                                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
                                                        >
                                                            Save
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="pr-14 whitespace-pre-wrap leading-relaxed">{note}</div>
                                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-700 shadow-sm">
                                                        <button 
                                                            onClick={() => {
                                                                setEditingNoteIndex(idx);
                                                                setTempNoteContent(note);
                                                            }}
                                                            className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
                                                            title="Edit Note"
                                                        >
                                                            <Pencil size={12} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteNote(idx)}
                                                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors border-l border-gray-100 dark:border-gray-700"
                                                            title="Delete Note"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center text-gray-400 italic mt-10">No notes yet. Add one below.</div>
                                )}
                            </div>
                            <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                                <div className="flex gap-2">
                                    <input 
                                        className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-2 text-sm focus:border-blue-500 outline-none"
                                        placeholder="Type a new note..."
                                        value={newNote}
                                        onChange={e => setNewNote(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                                    />
                                    <button 
                                        onClick={handleAddNote}
                                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold text-sm transition-colors"
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Move Contact Section */}
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Move Contact</h3>
                            <div className="flex gap-4">
                                {onMoveToWholesaler && (
                                    <button 
                                        type="button" 
                                        onClick={onMoveToWholesaler} 
                                        className="px-4 py-2 border border-orange-500/50 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg text-xs font-bold transition-all flex items-center gap-2"
                                    >
                                        <ArrowRightLeft size={14} /> Move To Wholesaler Database
                                    </button>
                                )}
                                {onMoveToBuyer && (
                                    <button 
                                        type="button" 
                                        onClick={onMoveToBuyer} 
                                        className="px-4 py-2 border border-blue-500/50 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-xs font-bold transition-all flex items-center gap-2"
                                    >
                                        <ArrowRightLeft size={14} /> Move To Buyer Database
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {isDeleting ? (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border-t border-red-100 dark:border-red-900/50 flex justify-between items-center shrink-0 animate-in fade-in slide-in-from-bottom-2">
                         <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-sm">
                            <AlertTriangle size={16} /> Confirm Deletion?
                         </div>
                         <div className="flex gap-2">
                             <button onClick={() => setIsDeleting(false)} className="px-4 py-2 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold shadow-sm border border-gray-200 dark:border-gray-700">Cancel</button>
                             <button onClick={() => { if(onDelete) onDelete(agent.id); onClose(); }} className="px-4 py-2 rounded bg-red-600 text-white text-xs font-bold hover:bg-red-500 shadow-md">Yes, Delete</button>
                         </div>
                    </div>
                ) : (
                    <ModalFooter 
                        onClose={handleCloseClick} 
                        onSave={() => triggerSave()} 
                        saveLabel="Save Profile"
                        showSaveButton={false}
                        onDelete={onDelete ? () => setIsDeleting(true) : undefined}
                    />
                )}
            </div>

            {/* Unsaved Changes Warning Modal using Shared Component */}
            {showUnsavedWarning && (
                <UnsavedChangesModal 
                    selectedOption={warningSelectedOption}
                    onDiscard={() => {
                        setShowUnsavedWarning(false);
                        if (pendingNavigation && onNavigate) {
                            onNavigate(pendingNavigation);
                        } else {
                            onClose();
                        }
                    }}
                    onSave={() => {
                        saveData(formDataRef.current);
                        if (pendingNavigation && onNavigate) {
                            onNavigate(pendingNavigation);
                        } else {
                            onClose();
                        }
                        setShowUnsavedWarning(false);
                    }}
                />
            )}
        </div>
    );
};
