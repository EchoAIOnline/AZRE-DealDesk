
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Phone, Mail, Briefcase, MessageSquare, User, Calendar, Save, Upload, Search, Loader2, MapPin, CheckCircle, AlertCircle, Clock, Link, ExternalLink, AlertTriangle, Plus, Home, Pencil, Trash2, ArrowRightLeft } from 'lucide-react';
import { Wholesaler, Deal, User as UserType, WholesalerProperty } from '../../types';
import { formatPhoneNumber, getLogTimestamp, calculateDaysRemaining, formatCurrency, processPhotoUrl, generateId } from '../../services/utils';
import { ModalFooter, NavigationArrows, UnsavedChangesModal } from '../Shared/ModalComponents';
import { useAutoSave, SavedNotification } from '../Shared/AutoSave';

interface EditWholesalerModalProps {
    wholesaler: Wholesaler;
    onClose: () => void;
    onSave: (wholesaler: Wholesaler, shouldClose?: boolean) => void;
    currentUser?: UserType | null;
    deals?: Deal[];
    onOpenDeal?: (deal: Deal) => void;
    onDelete?: (id: string) => void;
    
    // Navigation Props
    onNavigate?: (direction: 'prev' | 'next') => void;
    hasNext?: boolean;
    hasPrevious?: boolean;
    
    zIndex?: string; 

    // Move Props
    onMoveToBuyer?: () => void;
    onMoveToAgent?: () => void;
}

export const EditWholesalerModal: React.FC<EditWholesalerModalProps> = ({ 
    wholesaler, onClose, onSave, currentUser, deals = [], onOpenDeal, onDelete,
    onNavigate, hasNext = false, hasPrevious = false,
    zIndex = 'z-[140]',
    onMoveToBuyer, onMoveToAgent
}) => {
    const [formData, setFormData] = useState<Wholesaler>({ ...wholesaler });
    const [newNote, setNewNote] = useState("");
    const [dealSearch, setDealSearch] = useState("");
    const [showDealSearch, setShowDealSearch] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Properties State
    const [newPropertyAddress, setNewPropertyAddress] = useState("");
    const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Note Editing State
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [tempNoteContent, setTempNoteContent] = useState("");

    // Save Logic States
    const initialJson = useRef(JSON.stringify(wholesaler));
    const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
    const [warningSelectedOption, setWarningSelectedOption] = useState<'yes' | 'no'>('yes');
    const [pendingNavigation, setPendingNavigation] = useState<'prev' | 'next' | null>(null);

    // --- STATE REF PATTERN FOR AUTO-SAVE ---
    const formDataRef = useRef(formData);
    useEffect(() => { formDataRef.current = formData; }, [formData]);

    const saveData = useCallback(async (dataToSave: Wholesaler) => {
        await Promise.resolve(onSave(dataToSave, false));
        initialJson.current = JSON.stringify(dataToSave);
    }, [onSave]);

    // Auto-Save Hook
    const { triggerSave, showSavedNotification, setShowSavedNotification } = useAutoSave({
        onSave: () => saveData(formDataRef.current)
    });

    const handleAutoSave = () => {
        setTimeout(() => {
            triggerSave();
        }, 0);
    };

    const updateAndSave = (updates: Partial<Wholesaler>) => {
        setFormData(prev => {
            const newData = { ...prev, ...updates };
            formDataRef.current = newData; 
            saveData(newData);
            setShowSavedNotification(true);
            setTimeout(() => setShowSavedNotification(false), 1000);
            return newData;
        });
    };

    useEffect(() => {
        setFormData({ ...wholesaler });
        formDataRef.current = { ...wholesaler };
        initialJson.current = JSON.stringify(wholesaler);
        setPendingNavigation(null);
        setIsDeleting(false);
        setEditingNoteIndex(null);
        setTempNoteContent("");
        setNewPropertyAddress("");
        setAddressSuggestions([]);
        setShowSuggestions(false);
    }, [wholesaler.id]);

    const handleCloseClick = () => {
        const currentJson = JSON.stringify(formDataRef.current);
        if (currentJson !== initialJson.current) {
            setWarningSelectedOption('yes');
            setShowUnsavedWarning(true);
        } else {
            onClose();
        }
    };

    const handleNavigationClick = (direction: 'prev' | 'next') => {
        const currentJson = JSON.stringify(formDataRef.current);
        if (currentJson !== initialJson.current) {
            setPendingNavigation(direction);
            setWarningSelectedOption('yes');
            setShowUnsavedWarning(true);
        } else if (onNavigate) {
            onNavigate(direction);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
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

            if (e.key === 'Enter' && isInput) {
                if (target.tagName === 'TEXTAREA') return; 
                if (e.defaultPrevented) return;
                e.preventDefault();
                target.blur();
                triggerSave(); 
                return;
            }

            if ((e.key.toLowerCase() === 's' && (e.metaKey || e.ctrlKey))) {
                e.preventDefault();
                triggerSave();
                return;
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                handleCloseClick();
                return;
            }

            if (isInput) return;

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

    const handleChange = (field: keyof Wholesaler, value: any) => {
        setFormData(prev => {
            const newData = { ...prev, [field]: value };
            formDataRef.current = newData; 
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

    const handleAddressInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setNewPropertyAddress(val);
        setShowSuggestions(true);
        
        if (val.length > 2 && (window as any).google && (window as any).google.maps && (window as any).google.maps.places) {
            const service = new (window as any).google.maps.places.AutocompleteService();
            service.getPlacePredictions({ input: val, types: ['address'] }, (predictions: any[], status: any) => {
                if (status === (window as any).google.maps.places.PlacesServiceStatus.OK && predictions) {
                    setAddressSuggestions(predictions.map(p => ({ formatted: p.description, place_id: p.place_id })));
                } else {
                    setAddressSuggestions([]);
                }
            });
        } else {
            setAddressSuggestions([]);
        }
    };

    const handleAddressSelect = (suggestion: any) => {
        setNewPropertyAddress(suggestion.formatted);
        setAddressSuggestions([]);
        setShowSuggestions(false);
    };

    const handleAddProperty = () => {
        if (!newPropertyAddress.trim()) return;
        const newProp: WholesalerProperty = {
            id: generateId(),
            address: newPropertyAddress.trim(),
            status: 'Available'
        };
        const updatedProperties = [newProp, ...(formData.properties || [])];
        updateAndSave({ properties: updatedProperties });
        setNewPropertyAddress("");
    };

    const handleUpdatePropertyStatus = (id: string, newStatus: 'Available' | 'No Longer Available') => {
        const updatedProperties = (formData.properties || []).map(p => 
            p.id === id ? { ...p, status: newStatus } : p
        );
        updateAndSave({ properties: updatedProperties });
    };

    const handleDeleteProperty = (id: string) => {
        const updatedProperties = (formData.properties || []).filter(p => p.id !== id);
        updateAndSave({ properties: updatedProperties });
    };

    const StatusButton = ({ label, active, onClick, colorClass }: { label: string, active: boolean, onClick: () => void, colorClass: string }) => (
        <button 
            type="button"
            onClick={onClick}
            className={`flex-1 py-3 px-2 rounded-lg text-xs md:text-sm font-bold border transition-all shadow-sm active:scale-95 flex flex-col md:flex-row items-center justify-center gap-2 ${
                active ? colorClass : 'bg-gray-50 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
        >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${active ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'}`}>
                {active && <CheckCircle size={14} />}
            </span>
            {label}
        </button>
    );

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

    const filteredDeals = dealSearch.length > 2 
        ? deals.filter(d => d && (d.address || '').toLowerCase().includes(dealSearch.toLowerCase()) && !(formData.closedDealIds || []).includes(d.id))
        : [];

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
            
            <NavigationArrows 
                onPrev={() => handleNavigationClick('prev')}
                onNext={() => handleNavigationClick('next')}
                hasPrev={hasPrevious}
                hasNext={hasNext}
                titlePrev="Previous Wholesaler"
                titleNext="Next Wholesaler"
            />

            <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-6xl border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden flex flex-col h-[90vh] relative" onClick={e => e.stopPropagation()}>
                
                <SavedNotification show={showSavedNotification} />

                {/* Header Section */}
                <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex flex-col md:flex-row items-center gap-6 shrink-0">
                     <div className="w-32 h-40 md:w-44 md:h-52 rounded-xl bg-white dark:bg-gray-700 border-4 border-white dark:border-gray-600 shadow-lg overflow-hidden relative group shrink-0">
                         {formData.photo ? (
                            <img src={processPhotoUrl(formData.photo)} alt="Wholesaler" className="w-full h-full object-cover object-top" />
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
                        </div>
                        <div className="flex items-center justify-center md:justify-start gap-2 text-orange-600 dark:text-orange-400 font-medium text-lg">
                            <Briefcase size={18} />
                            {formData.companyName || 'No Company Listed'}
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
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Contact Name</label>
                                            <input className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-2 text-sm focus:border-blue-500 outline-none" 
                                                value={formData.name} onChange={e => handleChange('name', e.target.value)} onBlur={handleAutoSave} />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Mobile Number</label>
                                            <input className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-2 text-sm focus:border-blue-500 outline-none" 
                                                value={formData.phone} onChange={e => handleChange('phone', formatPhoneNumber(e.target.value))} onBlur={handleAutoSave} placeholder="(555) 555-5555" />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Email Address</label>
                                            <input className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-2 text-sm focus:border-blue-500 outline-none" 
                                                value={formData.email} onChange={e => handleChange('email', e.target.value)} onBlur={handleAutoSave} placeholder="wholesaler@example.com" />
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
                                            <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Company Name</label>
                                            <input className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-2 text-sm focus:border-blue-500 outline-none" 
                                                value={formData.companyName} onChange={e => handleChange('companyName', e.target.value)} onBlur={handleAutoSave} />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Type of Wholesaler</label>
                                            <select 
                                                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-2 text-sm focus:border-blue-500 outline-none"
                                                value={formData.wholesalerType || ''}
                                                onChange={e => handleChange('wholesalerType', e.target.value)}
                                                onBlur={handleAutoSave}
                                            >
                                                <option value="">Select Type...</option>
                                                <option value="Acquisitions">Acquisitions</option>
                                                <option value="Dispositions">Dispositions</option>
                                                <option value="Acq & Dispo">Acq & Dispo</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Relationship Status */}
                            <section>
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 pb-2 mb-4 flex items-center gap-2">
                                    <User size={16}/> Relationship Status
                                </h3>
                                <div className="flex flex-col md:flex-row gap-3">
                                    <StatusButton 
                                        label="New Lead" 
                                        active={formData.status === 'New'} 
                                        onClick={() => updateAndSave({ status: 'New' })}
                                        colorClass="bg-blue-600 text-white border-blue-600 hover:bg-blue-500"
                                    />
                                    <StatusButton 
                                        label="Vetted" 
                                        active={formData.status === 'Vetted'} 
                                        onClick={() => updateAndSave({ status: 'Vetted' })}
                                        colorClass="bg-green-600 text-white border-green-600 hover:bg-green-500"
                                    />
                                    <StatusButton 
                                        label="JV Partner" 
                                        active={formData.status === 'JV Partner'} 
                                        onClick={() => updateAndSave({ status: 'JV Partner' })}
                                        colorClass="bg-purple-600 text-white border-purple-600 hover:bg-purple-500"
                                    />
                                    <StatusButton 
                                        label="Blacklisted" 
                                        active={formData.status === 'Blacklisted'} 
                                        onClick={() => updateAndSave({ status: 'Blacklisted' })}
                                        colorClass="bg-red-600 text-white border-red-600 hover:bg-red-500"
                                    />
                                </div>
                            </section>

                        </div>

                        {/* RIGHT COLUMN */}
                        <div className="space-y-8">
                            
                            {/* Properties Available */}
                            <section>
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 pb-2 mb-4 flex items-center gap-2">
                                    <Home size={16}/> Properties Available
                                </h3>
                                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm min-h-[160px] flex flex-col">
                                    <div className="flex gap-2 mb-3 relative z-20">
                                        <div className="flex-1 relative">
                                            <input 
                                                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-2 text-sm focus:border-blue-500 outline-none"
                                                placeholder="Enter property address..."
                                                value={newPropertyAddress}
                                                onChange={handleAddressInputChange}
                                                onFocus={() => setShowSuggestions(true)}
                                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddProperty(); }}}
                                            />
                                            {showSuggestions && addressSuggestions.length > 0 && (
                                                <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-b-lg shadow-xl max-h-60 overflow-y-auto z-50">
                                                    {addressSuggestions.map((suggestion, idx) => (
                                                        <div 
                                                            key={idx} 
                                                            className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer border-b border-gray-100 dark:border-gray-800 last:border-0 text-xs text-gray-700 dark:text-gray-300"
                                                            onMouseDown={() => handleAddressSelect(suggestion)}
                                                        >
                                                            {suggestion.formatted}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <button 
                                            onClick={handleAddProperty}
                                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold text-xs shrink-0"
                                        >
                                            Add
                                        </button>
                                    </div>
                                    
                                    <div className="flex-1 flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1">
                                        {formData.properties && formData.properties.length > 0 ? (
                                            formData.properties.map((prop) => (
                                                <div key={prop.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/50 rounded p-2 text-sm group">
                                                    <div className="font-medium text-gray-800 dark:text-gray-200 flex-1 truncate mr-2">
                                                        {prop.address}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <select 
                                                            className={`text-[10px] font-bold uppercase rounded border px-2 py-1 outline-none cursor-pointer ${
                                                                prop.status === 'Available' 
                                                                ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' 
                                                                : 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                                                            }`}
                                                            value={prop.status}
                                                            onChange={(e) => handleUpdatePropertyStatus(prop.id, e.target.value as any)}
                                                        >
                                                            <option value="Available">Available</option>
                                                            <option value="No Longer Available">No Longer Available</option>
                                                        </select>
                                                        <button 
                                                            onClick={() => handleDeleteProperty(prop.id)}
                                                            className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <X size={14}/>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm italic border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                                                No properties listed
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>

                            {/* Properties Closed With AZRE */}
                            <section>
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 pb-2 mb-4 flex items-center gap-2">
                                    <Link size={16}/> Properties Closed With AZRE
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
                                                    <div key={dealId} className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded p-2 text-sm">
                                                        <button 
                                                            type="button"
                                                            onClick={() => onOpenDeal && onOpenDeal(deal)}
                                                            className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-medium hover:underline truncate"
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

                            {/* Follow-Up Assistant */}
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

                    {/* Activity and Notes Section */}
                    <section className="flex flex-col h-[400px]">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 pb-2 mb-4 flex items-center gap-2">
                            <MessageSquare size={16}/> Activity and Notes
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
                                {onMoveToBuyer && (
                                    <button 
                                        type="button" 
                                        onClick={onMoveToBuyer} 
                                        className="px-4 py-2 border border-blue-500/50 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-xs font-bold transition-all flex items-center gap-2"
                                    >
                                        <ArrowRightLeft size={14} /> Move To Buyer Database
                                    </button>
                                )}
                                {onMoveToAgent && (
                                    <button 
                                        type="button" 
                                        onClick={onMoveToAgent} 
                                        className="px-4 py-2 border border-purple-500/50 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg text-xs font-bold transition-all flex items-center gap-2"
                                    >
                                        <ArrowRightLeft size={14} /> Move To Agent Database
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
                             <button onClick={() => { if(onDelete) onDelete(wholesaler.id); onClose(); }} className="px-4 py-2 rounded bg-red-600 text-white text-xs font-bold hover:bg-red-500 shadow-md">Yes, Delete</button>
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
