
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { X, Save, Building, User, Phone, Mail, MapPin, DollarSign, Home, FileText, Plus, Upload, CheckCircle, LayoutGrid, Loader2, ArrowRightLeft, Activity, Ban } from 'lucide-react';
import { Buyer, BuyBox, Deal, User as UserType } from '../../types';
import { formatPhoneNumber, getLogTimestamp, parseNumberFromCurrency, formatCurrency, calculateDaysRemaining, serverFunctions, processPhotoUrl, loadGoogleMapsScript } from '../../services/utils';
import { COUNTIES, SUB_MARKETS, ATLANTA_NEIGHBORHOODS, GOOGLE_MAPS_API_KEY } from '../../constants';
import { ModalFooter, NavigationArrows, UnsavedChangesModal } from '../Shared/ModalComponents';
import { useAutoSave, SavedNotification } from '../Shared/AutoSave';
import { DealMatchModal } from './DealMatchModal';
import { BuyerTargetMap } from './BuyerTargetMap';

interface EditBuyerModalProps {
    buyer: Buyer;
    onSave: (buyer: Buyer, shouldClose?: boolean) => void;
    onClose: () => void;
    currentUser?: UserType | null;
    onNavigate?: (direction: 'prev' | 'next') => void;
    hasNext?: boolean;
    hasPrevious?: boolean;
    deals?: Deal[];
    onOpenDeal?: (deal: Deal) => void;
    allBuyers?: Buyer[];
    onSwitchToBuyer?: (buyer: Buyer) => void;
    onMoveToAgent?: () => void;
    onMoveToWholesaler?: () => void;
    zIndex?: string;
}

export const EditBuyerModal: React.FC<EditBuyerModalProps> = ({ 
    buyer, onSave, onClose,
    currentUser,
    onNavigate, hasNext = false, hasPrevious = false,
    deals = [], onOpenDeal,
    allBuyers = [], onSwitchToBuyer,
    onMoveToAgent, onMoveToWholesaler,
    zIndex = 'z-[140]'
}) => {
    const [formData, setFormData] = useState<Buyer>({ ...buyer });
    const [newNote, setNewNote] = useState("");
    const [tempPhone, setTempPhone] = useState("");
    const [showDealMatcher, setShowDealMatcher] = useState(false);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    
    // Save Logic States
    const initialBuyerJson = useRef(JSON.stringify(buyer));
    const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
    const [warningSelectedOption, setWarningSelectedOption] = useState<'yes' | 'no'>('yes');
    const [pendingNavigation, setPendingNavigation] = useState<'prev' | 'next' | null>(null);

    // Widget State
    const [widgetType, setWidgetType] = useState("Zip Code");
    const [widgetValue, setWidgetValue] = useState("");
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Existing Buyer Lookup State
    const [nameSuggestions, setNameSuggestions] = useState<Buyer[]>([]);
    const [showNameSuggestions, setShowNameSuggestions] = useState(false);
    
    // Map State
    // Removed JS API refs and effects to use iframe instead
    
    const isNewEntry = useMemo(() => {
        return allBuyers && allBuyers.length > 0 ? !allBuyers.some(b => b.id === buyer.id) : true;
    }, [buyer.id, allBuyers]);
    
    useEffect(() => {
        setFormData({ ...buyer });
        initialBuyerJson.current = JSON.stringify(buyer);
        setPendingNavigation(null);
        setSuggestions([]);
        setShowSuggestions(false);
        setWidgetValue("");
        setIsUploadingPhoto(false);
        setShowNameSuggestions(false);
    }, [buyer.id]);

    const { triggerSave, showSavedNotification, setShowSavedNotification, handleAutoSave } = useAutoSave({
        onSave: async () => {
            await Promise.resolve(onSave(formData, false));
            initialBuyerJson.current = JSON.stringify(formData);
        }
    });

    const updateAndSave = (updates: Partial<Buyer>) => {
        const newData = { ...formData, ...updates };
        setFormData(newData);
        onSave(newData, false);
        initialBuyerJson.current = JSON.stringify(newData);
        setShowSavedNotification(true);
        setTimeout(() => setShowSavedNotification(false), 1000);
    };

    const getLastContactText = () => {
        if (!formData.lastContactDate) return 'Not Set';
        const days = calculateDaysRemaining(formData.lastContactDate);
        if (days === null) return 'Not Set';
        if (days > 0) return `In ${days} Days`; 
        if (days === 0) return 'Today';
        return `${Math.abs(days)} Days Ago`;
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
        if (days < 0) return 'text-red-600 dark:text-red-400';
        if (days === 0) return 'text-orange-600 dark:text-orange-400';
        if (days <= 3) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-green-600 dark:text-green-400';
    };

    const daysUntilFollowUp = formData.nextFollowUpDate ? calculateDaysRemaining(formData.nextFollowUpDate) : null;

    const updateBuyBox = (field: keyof BuyBox, value: any) => {
        setFormData(prev => ({
            ...prev,
            buyBox: {
                ...prev.buyBox,
                [field]: value
            }
        }));
    };

    const updateBuyBoxAndSave = (field: keyof BuyBox, value: any) => {
        const newBuyBox = { ...formData.buyBox, [field]: value };
        updateAndSave({ buyBox: newBuyBox });
    };

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const buyerName = formData.name || formData.companyName || 'Unknown Buyer';
            setIsUploadingPhoto(true);
            try {
                const response = await serverFunctions.uploadBuyerImage(file, buyerName);
                if (response && response.url) {
                    updateAndSave({ photo: response.url });
                } else if (response && response.error) {
                    alert("Upload failed: " + response.error);
                }
            } catch (err) {
                console.error("Buyer photo upload failed", err);
                alert("Error uploading photo to Drive.");
            } finally {
                setIsUploadingPhoto(false);
            }
        }
    };

    const handleAddNote = () => {
        if (!newNote.trim()) return;
        const userName = currentUser?.name || 'User';
        const timestamp = getLogTimestamp();
        const timestampedNote = `${timestamp} - ${userName}: ${newNote.trim()}`;
        const updatedNotes = [timestampedNote, ...(formData.notes || [])];
        updateAndSave({ notes: updatedNotes });
        setNewNote("");
    };

    const handleCloseClick = () => {
        const currentJson = JSON.stringify(formData);
        if (currentJson !== initialBuyerJson.current) {
            setWarningSelectedOption('yes');
            setShowUnsavedWarning(true);
        } else {
            onClose();
        }
    };

    const handleNavigationClick = (direction: 'prev' | 'next') => {
        const currentJson = JSON.stringify(formData);
        if (currentJson !== initialBuyerJson.current) {
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
                         triggerSave();
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
    }, [formData, showUnsavedWarning, warningSelectedOption, triggerSave, onClose, pendingNavigation, hasNext, hasPrevious, onNavigate]);

    const togglePropertyType = (type: string) => {
        const currentTypes = formData.buyBox.propertyTypes || [];
        const exists = currentTypes.includes(type);
        let newTypes;
        if (exists) {
            newTypes = currentTypes.filter(t => t !== type);
        } else {
            newTypes = [...currentTypes, type];
        }
        updateBuyBoxAndSave('propertyTypes', newTypes);
    };
    
    const toggleStatus = (value: string) => {
        const currentStatuses = formData.status ? formData.status.split(',').map(s => s.trim()).filter(s => s) : [];
        const exists = currentStatuses.includes(value);
        let newStatuses;
        if (exists) {
            newStatuses = currentStatuses.filter(s => s !== value);
        } else {
            newStatuses = [...currentStatuses, value];
        }
        updateAndSave({ status: newStatuses.join(', ') });
    };

    const currentStatuses = formData.status ? formData.status.split(',').map(s => s.trim()).filter(s => s) : [];

    const parseWidget = (text: string) => {
        const parts = text.split(':');
        if (parts.length > 1) {
            return { type: parts[0].trim(), value: parts.slice(1).join(':').trim() };
        }
        return { type: 'Location', value: text };
    };

    const getWidgetColor = (type: string) => {
        switch(type) {
            case 'Zip Code': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
            case 'City': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
            case 'State': return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
            case 'County': return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800';
            case 'Neighborhood': return 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800';
            default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600';
        }
    };

    const handleWidgetTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setWidgetType(e.target.value);
        setWidgetValue("");
        setSuggestions([]);
        setShowSuggestions(false);
    };

    const handleWidgetInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setWidgetValue(val);
        
        if (!val.trim()) {
             setSuggestions([]);
             setShowSuggestions(false);
             return;
        }

        let source: string[] = [];
        if (widgetType === 'City') source = SUB_MARKETS;
        else if (widgetType === 'County') source = COUNTIES;
        else if (widgetType === 'Neighborhood') source = ATLANTA_NEIGHBORHOODS;
        
        if (source.length > 0) {
            const filtered = source.filter(item => item.toLowerCase().includes(val.toLowerCase()));
            setSuggestions(filtered);
            setShowSuggestions(filtered.length > 0);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const selectSuggestion = (val: string) => {
        setWidgetValue(val);
        setShowSuggestions(false);
        inputRef.current?.focus();
    };

    const WIDGET_ORDER: Record<string, number> = {
        'Zip Code': 1,
        'City': 2,
        'State': 3,
        'County': 4,
        'Neighborhood': 5
    };

    const sortLocationsArray = (locs: string[]) => {
        return [...locs].sort((a, b) => {
            const typeA = parseWidget(a).type;
            const typeB = parseWidget(b).type;
            const orderA = WIDGET_ORDER[typeA] || 99;
            const orderB = WIDGET_ORDER[typeB] || 99;
            if (orderA !== orderB) return orderA - orderB;
            const valA = parseWidget(a).value.toLowerCase();
            const valB = parseWidget(b).value.toLowerCase();
            return valA.localeCompare(valB);
        });
    };

    const addWidget = () => {
        if (!widgetValue) return;
        const currentLocs = formData.buyBox?.locations ? formData.buyBox.locations.split(',').map(s => s.trim()).filter(s => s) : [];
        const newEntry = `${widgetType}: ${widgetValue}`;
        
        if (!currentLocs.includes(newEntry)) {
            const newLocsArray = [...currentLocs, newEntry];
            const sortedLocs = sortLocationsArray(newLocsArray);
            updateBuyBoxAndSave('locations', sortedLocs.join(', '));
        }
        setWidgetValue('');
        setShowSuggestions(false);
    };

    const removeWidget = (valToRemove: string) => {
        const currentLocs = formData.buyBox?.locations ? formData.buyBox.locations.split(',').map(s => s.trim()).filter(s => s) : [];
        const newLocs = currentLocs.filter(loc => loc !== valToRemove).join(', ');
        updateBuyBoxAndSave('locations', newLocs);
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setFormData({ ...formData, name: val });
        
        if (isNewEntry && allBuyers && onSwitchToBuyer && val.trim().length > 1) {
            const matches = allBuyers.filter(b => 
                (b.name && b.name.toLowerCase().includes(val.toLowerCase())) || 
                (b.companyName && b.companyName.toLowerCase().includes(val.toLowerCase()))
            );
            setNameSuggestions(matches);
            setShowNameSuggestions(matches.length > 0);
        } else {
            setShowNameSuggestions(false);
        }
    };

    const handleLastContactChange = (newDate: string) => {
        if (!newDate) {
            updateAndSave({ lastContactDate: newDate });
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const [y, m, d] = newDate.split('-').map(Number);
        const selectedDate = new Date(y, m - 1, d);
        selectedDate.setHours(0, 0, 0, 0);

        const diffTime = today.getTime() - selectedDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let contactMessage = "";
        if (diffDays === 0) {
            contactMessage = "I contacted this buyer today.";
        } else if (diffDays > 0) {
            contactMessage = `I contacted this buyer ${diffDays} day${diffDays === 1 ? '' : 's'} ago.`;
        } else {
            contactMessage = `Planned contact for ${newDate}.`;
        }

        const userName = currentUser?.name || 'User';
        const timestamp = getLogTimestamp();
        const autoNote = `${timestamp} - ${userName}: ${contactMessage}`;

        const currentNotes = formData.notes || [];
        if (currentNotes.length > 0 && currentNotes[0] === autoNote) {
             updateAndSave({ lastContactDate: newDate });
             return;
        }

        const updatedNotes = [autoNote, ...currentNotes];
        
        updateAndSave({ 
            lastContactDate: newDate,
            notes: updatedNotes 
        });
    };

    const handleDeactivate = () => {
        if (window.confirm("Are you sure you want to deactivate this buyer? They will be moved to the Deactivated list.")) {
            // Replace all statuses with 'Deactivated'
            const newData = { ...formData, status: 'Deactivated' };
            setFormData(newData); // Optimistic
            onSave(newData, false); // Save
            onClose(); // Close
        }
    };

    return (
        <div className={`fixed inset-0 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm ${zIndex}`} onClick={handleCloseClick}>
            
            <NavigationArrows 
                onPrev={() => handleNavigationClick('prev')}
                onNext={() => handleNavigationClick('next')}
                hasPrev={hasPrevious}
                hasNext={hasNext}
                titlePrev="Previous Buyer"
                titleNext="Next Buyer"
            />

            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-6xl border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] relative" onClick={e => e.stopPropagation()}>
                
                <SavedNotification show={showSavedNotification} />

                <button onClick={handleCloseClick} className="absolute top-4 right-4 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full transition-colors backdrop-blur-md z-50"><X size={20}/></button>

                {deals && deals.length > 0 && (
                    <button 
                        type="button" 
                        onClick={() => setShowDealMatcher(true)}
                        className="absolute top-4 right-16 bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all flex items-center justify-center backdrop-blur-md border border-white/20 active:scale-95 z-50
                                   py-1.5 px-4 rounded-lg gap-2 text-xs shadow-md"
                    >
                        <LayoutGrid size={16} /> 
                        <span>Deal Matcher</span>
                    </button>
                )}

                <div className="flex-1 overflow-y-auto">
                    {/* Header */}
                    <div className="h-32 bg-gray-100 dark:bg-gray-800 relative shrink-0 z-20">
                        <div className="absolute inset-0 overflow-hidden">
                            {formData.photo ? (
                                <img src={processPhotoUrl(formData.photo)} className="w-full h-full object-cover opacity-50 blur-sm scale-110" alt="Background" />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-r from-blue-900 to-gray-900 opacity-50"></div>
                            )}
                        </div>

                        <div className="absolute -bottom-12 left-8 flex items-end gap-4 z-30">
                            <div className="w-24 h-24 rounded-xl bg-white dark:bg-gray-800 border-4 border-white dark:border-gray-900 shadow-lg overflow-hidden relative group shrink-0">
                                {formData.photo ? (
                                    <img src={processPhotoUrl(formData.photo)} className="w-full h-full object-cover" alt="Logo" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-400">
                                        <Building size={32} />
                                    </div>
                                )}

                                {isUploadingPhoto && (
                                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-20">
                                        <div className="relative">
                                            <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-blue-500 animate-spin"></div>
                                            <Loader2 className="absolute inset-0 m-auto text-blue-500 animate-pulse" size={24} />
                                        </div>
                                        <span className="text-[10px] font-black text-white uppercase tracking-widest mt-2">Uploading</span>
                                    </div>
                                )}

                                <label className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity cursor-pointer ${isUploadingPhoto ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'}`}>
                                    <Upload size={20} className="text-white"/>
                                    <input type="file" className="hidden" accept="image/*" onChange={handlePhotoChange} disabled={isUploadingPhoto} />
                                </label>
                            </div>
                            <div className="mb-12 text-white drop-shadow-md pb-2">
                                <h2 className="text-2xl font-bold">{formData.name || 'New Buyer'}</h2>
                                {formData.companyName && <div className="text-lg font-medium opacity-90">{formData.companyName}</div>}
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {currentStatuses.length > 0 ? currentStatuses.map(s => {
                                         let colorClass = 'bg-gray-500/80 border-gray-400';
                                         if (s === 'New Lead') colorClass = 'bg-yellow-500 border-yellow-400';
                                         else if (s === 'Vetted Buyer') colorClass = 'bg-blue-600 border-blue-500';
                                         else if (s === 'Repeat Buyer') colorClass = 'bg-green-600 border-green-500';
                                         else if (s === 'VIP Buyer') colorClass = 'bg-purple-600 border-purple-500';
                                         else if (s === 'Deactivated') colorClass = 'bg-red-600 border-red-500';
                                         
                                         return (
                                            <span key={s} className={`px-2 py-0.5 rounded text-[10px] font-bold shadow-sm border ${colorClass} text-white`}>
                                                {s}
                                            </span>
                                         );
                                    }) : (
                                         <p className="text-white/80 text-sm font-medium">No Status</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 pt-16">
                        <form onSubmit={(e) => { e.preventDefault(); triggerSave(); }} className="space-y-8">
                        
                        {/* Sections remain unchanged for brevity, focusing on footer structure */}
                        <section className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 pb-2 flex items-center gap-2">
                                    <Building size={14}/> Buyer Details
                                </h3>
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Contact Person</label>
                                    <div className="relative">
                                        <input 
                                            required 
                                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none" 
                                            value={formData.name} 
                                            onChange={handleNameChange} 
                                            onBlur={(e) => {
                                                setTimeout(() => setShowNameSuggestions(false), 200);
                                                handleAutoSave();
                                            }} 
                                            placeholder="Full Name" 
                                        />
                                        {showNameSuggestions && nameSuggestions.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-b-lg mt-1 z-50 shadow-xl max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                                                <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 text-[10px] font-bold text-yellow-600 dark:text-yellow-400 uppercase border-b border-yellow-100 dark:border-yellow-900/30">Existing Buyers Found</div>
                                                {nameSuggestions.map(match => (
                                                    <div 
                                                        key={match.id} 
                                                        className="p-3 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-800 last:border-0"
                                                        onMouseDown={() => {
                                                            if (onSwitchToBuyer) onSwitchToBuyer(match);
                                                        }}
                                                    >
                                                        <div className="font-bold text-sm text-gray-900 dark:text-white">{match.name}</div>
                                                        <div className="text-xs text-gray-500 dark:text-gray-400">{match.companyName}</div>
                                                        <div className="text-[10px] text-blue-500 mt-1 flex items-center gap-1"><ArrowRightLeft size={10} /> Switch to this buyer</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Company Name</label>
                                    <input className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none" 
                                        value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} onBlur={handleAutoSave} placeholder="Company LLC" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Phone Numbers</label>
                                        <div className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-sm focus:within:border-blue-500 transition-colors min-h-[120px] flex flex-col gap-2 relative">
                                            <div className="flex flex-wrap gap-2 content-start flex-1">
                                                {formData.phone ? formData.phone.split(',').map(p => p.trim()).filter(p => p).map((p, idx) => (
                                                    <span key={idx} className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 rounded text-xs font-bold border border-blue-200 dark:border-blue-800 flex items-center gap-1 h-fit">
                                                        {p}
                                                        <button type="button" onClick={() => {
                                                            const current = formData.phone.split(',').map(s=>s.trim()).filter(s=>s);
                                                            const newP = current.filter((_, i) => i !== idx).join(', ');
                                                            updateAndSave({ phone: newP });
                                                        }} className="hover:text-red-500 ml-1 flex items-center justify-center"><X size={12}/></button>
                                                    </span>
                                                )) : <span className="text-gray-400 italic text-xs p-1">No phone numbers added.</span>}
                                            </div>
                                            <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700/50">
                                                <input 
                                                    className="flex-1 bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400 text-xs"
                                                    placeholder="Enter phone..."
                                                    value={tempPhone}
                                                    onChange={e => setTempPhone(formatPhoneNumber(e.target.value))}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            if (tempPhone) {
                                                                const current = formData.phone ? formData.phone.split(',').map(s=>s.trim()).filter(s=>s) : [];
                                                                if (!current.includes(tempPhone)) {
                                                                    updateAndSave({ phone: [...current, tempPhone].join(', ') });
                                                                }
                                                                setTempPhone('');
                                                            }
                                                        }
                                                    }}
                                                />
                                                <button 
                                                    type="button" 
                                                    onClick={() => {
                                                        if (tempPhone) {
                                                            const current = formData.phone ? formData.phone.split(',').map(s=>s.trim()).filter(s=>s) : [];
                                                            if (!current.includes(tempPhone)) {
                                                                updateAndSave({ phone: [...current, tempPhone].join(', ') });
                                                            }
                                                            setTempPhone('');
                                                        }
                                                    }}
                                                    disabled={!tempPhone}
                                                    className="text-blue-600 hover:text-blue-500 disabled:text-gray-400 text-xs font-bold"
                                                >
                                                    Add
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-4">
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Email</label>
                                            <input className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none" 
                                                value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} onBlur={handleAutoSave} placeholder="email@example.com" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Subscription Status</label>
                                            <select
                                                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-sm focus:border-blue-500 outline-none"
                                                value={formData.subscriptionStatus || 'Subscribed'}
                                                onChange={e => updateAndSave({ subscriptionStatus: e.target.value as any })}
                                            >
                                                <option value="Subscribed">Subscribed</option>
                                                <option value="Unsubscribed">Unsubscribed</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 pb-2 flex items-center gap-2">
                                    <CheckCircle size={14}/> Status & Stats
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Buyer Status</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {['New Lead', 'Vetted Buyer', 'Repeat Buyer', 'VIP Buyer'].map(status => (
                                                <button
                                                    key={status}
                                                    type="button"
                                                    onClick={() => toggleStatus(status)}
                                                    className={`px-2 py-1.5 rounded-md text-xs font-bold border transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1 ${
                                                        currentStatuses.includes(status)
                                                            ? status === 'New Lead' ? 'bg-yellow-500 text-white border-yellow-500 hover:bg-yellow-600'
                                                            : status === 'Vetted Buyer' ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                                                            : status === 'Repeat Buyer' ? 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                                                            : 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700'
                                                            : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                                    }`}
                                                >
                                                    {status}
                                                    {currentStatuses.includes(status) && <span className="opacity-80">✓</span>}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Properties Bought</label>
                                        <input type="number" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none" 
                                            value={formData.propertiesBought} onChange={e => setFormData({...formData, propertiesBought: Number(e.target.value)})} onBlur={handleAutoSave} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Last Contact</label>
                                        <input type="date" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none" 
                                            value={formData.lastContactDate || ''} onChange={e => handleLastContactChange(e.target.value)} onBlur={handleAutoSave} />
                                        <div className="mt-2 p-3 rounded border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/50 flex flex-col items-center justify-center text-center">
                                            <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Time Since Contact</span>
                                            <span className="text-sm font-bold text-gray-700 dark:text-300">
                                            {getLastContactText()}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Next Follow-Up</label>
                                        <input type="date" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none" 
                                            value={formData.nextFollowUpDate || ''} onChange={e => setFormData({...formData, nextFollowUpDate: e.target.value})} onBlur={handleAutoSave} />
                                        <div className={`mt-2 p-3 rounded border flex flex-col items-center justify-center text-center ${
                                            daysUntilFollowUp !== null && daysUntilFollowUp < 0 
                                            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
                                            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                                        }`}>
                                            <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Until Follow-Up</span>
                                            <span className={`text-sm font-bold ${getFollowUpColor()}`}>
                                            {getFollowUpText()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="bg-blue-50 dark:bg-gray-800/50 rounded-xl p-6 border border-blue-100 dark:border-gray-700/50">
                            <h3 className="text-sm font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <MapPin size={16}/> Buy Box Criteria
                            </h3>
                            <div className="grid md:grid-cols-2 gap-8">
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Target Locations / Criteria</label>
                                    <div className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-3 text-sm focus-within:border-blue-500 transition-colors min-h-[525px] flex flex-col gap-3 relative">
                                        <div className="flex flex-wrap gap-2 flex-1 content-start overflow-y-auto max-h-[460px] scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                                            {formData.buyBox?.locations ? (
                                                sortLocationsArray(formData.buyBox.locations.split(',').map(s => s.trim()).filter(s => s)).map((loc, idx) => {
                                                    const { type, value } = parseWidget(loc);
                                                    return (
                                                        <span key={idx} className={`px-2 py-1 rounded text-xs font-bold border flex items-center gap-1 shrink-0 ${getWidgetColor(type)}`}>
                                                            {value}
                                                            <button type="button" onClick={() => removeWidget(loc)} className="hover:text-red-500 ml-1"><X size={12}/></button>
                                                        </span>
                                                    );
                                                })
                                            ) : (
                                                <span className="text-gray-400 italic text-xs p-1">No locations added...</span>
                                            )}
                                        </div>
                                        <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 relative z-20">
                                            <select 
                                                className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1.5 text-xs text-gray-900 dark:text-white outline-none focus:border-blue-500 w-1/3"
                                                value={widgetType}
                                                onChange={handleWidgetTypeChange}
                                            >
                                                <option value="Zip Code">Zip Code</option>
                                                <option value="City">City</option>
                                                <option value="State">State</option>
                                                <option value="County">Counties</option>
                                                <option value="Neighborhood">Neighborhoods</option>
                                            </select>
                                            <div className="flex-1 relative">
                                                <input 
                                                    ref={inputRef}
                                                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1.5 text-xs text-gray-900 dark:text-white outline-none focus:border-blue-500"
                                                    placeholder={`Enter ${widgetType}...`}
                                                    value={widgetValue}
                                                    onChange={handleWidgetInputChange}
                                                    onFocus={() => { if(widgetValue) handleWidgetInputChange({target: {value: widgetValue}} as any)}}
                                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            addWidget();
                                                        }
                                                    }}
                                                />
                                                {showSuggestions && (
                                                    <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto z-50 mb-1">
                                                        {suggestions.map((s, idx) => (
                                                            <div 
                                                                key={idx} 
                                                                onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }} 
                                                                className="px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/50 cursor-pointer text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                                                            >
                                                                {s}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={addWidget}
                                                disabled={!widgetValue}
                                                className="bg-blue-600 hover:bg-blue-50 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 content-start">
                                    <div className="col-span-full mb-2">
                                        <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Investment Strategy</label>
                                        <div className="flex gap-3">
                                            {['Renovation', 'New Build', 'Rental'].map(type => (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    onClick={() => togglePropertyType(type)}
                                                    className={`flex-1 py-3 rounded-lg text-sm font-bold border transition-all shadow-sm active:scale-95 flex items-center justify-center ${
                                                        (formData.buyBox.propertyTypes || []).includes(type)
                                                            ? type === 'Renovation' ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                                                            : type === 'New Build' ? 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                                                            : 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700'
                                                            : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                                    }`}
                                                >
                                                    {type}
                                                    {(formData.buyBox.propertyTypes || []).includes(type) && <span className="ml-1.5 opacity-80">✓</span>}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Min Price</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-3 text-gray-400 text-xs">$</span>
                                            <input className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-3 pl-6 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none" 
                                                value={formData.buyBox?.minPrice ? formatCurrency(formData.buyBox.minPrice).replace('$','') : ''} 
                                                onChange={e => updateBuyBox('minPrice', parseNumberFromCurrency(e.target.value))} onBlur={handleAutoSave} placeholder="0" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Max Price</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-3 text-gray-400 text-xs">$</span>
                                            <input className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-3 pl-6 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none" 
                                                value={formData.buyBox?.maxPrice ? formatCurrency(formData.buyBox.maxPrice).replace('$','') : ''} 
                                                onChange={e => updateBuyBox('maxPrice', parseNumberFromCurrency(e.target.value))} onBlur={handleAutoSave} placeholder="No Limit" />
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Earliest Year Built</label>
                                        <input type="number" className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-3 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none" 
                                            value={formData.buyBox?.earliestYearBuilt || ''} onChange={e => updateBuyBox('earliestYearBuilt', Number(e.target.value))} onBlur={handleAutoSave} placeholder="1900" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Latest Year Built</label>
                                        <input type="number" className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-3 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none" 
                                            value={formData.buyBox?.latestYearBuilt || ''} onChange={e => updateBuyBox('latestYearBuilt', Number(e.target.value))} onBlur={handleAutoSave} placeholder="2025" />
                                    </div>

                                    <div className="col-span-full">
                                        <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Max Renovation Budget</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-3 text-gray-400 text-xs">$</span>
                                            <input className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-3 pl-6 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none" 
                                                value={formData.buyBox?.maxRenoBudget ? formatCurrency(formData.buyBox.maxRenoBudget).replace('$','') : ''} 
                                                onChange={e => updateBuyBox('maxRenoBudget', parseNumberFromCurrency(e.target.value))} onBlur={handleAutoSave} placeholder="No Limit" />
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Minimum ARV</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-3 text-gray-400 text-xs">$</span>
                                            <input className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-3 pl-6 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none" 
                                                value={formData.buyBox?.minArv ? formatCurrency(formData.buyBox.minArv).replace('$','') : ''} 
                                                onChange={e => updateBuyBox('minArv', parseNumberFromCurrency(e.target.value))} onBlur={handleAutoSave} placeholder="0" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Maximum ARV</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-3 text-gray-400 text-xs">$</span>
                                            <input className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-3 pl-6 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none" 
                                                value={formData.buyBox?.maxArv ? formatCurrency(formData.buyBox.maxArv).replace('$','') : ''} 
                                                onChange={e => updateBuyBox('maxArv', parseNumberFromCurrency(e.target.value))} onBlur={handleAutoSave} placeholder="No Limit" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Min Beds</label>
                                        <input type="number" className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-3 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none" 
                                            value={formData.buyBox?.minBedrooms || ''} onChange={e => updateBuyBox('minBedrooms', Number(e.target.value))} onBlur={handleAutoSave} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Min Baths</label>
                                        <input type="number" className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-3 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none" 
                                            value={formData.buyBox?.minBathrooms || ''} onChange={e => updateBuyBox('minBathrooms', Number(e.target.value))} onBlur={handleAutoSave} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Min Sqft</label>
                                        <input type="number" className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-3 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none" 
                                            value={formData.buyBox?.minSqft || ''} onChange={e => updateBuyBox('minSqft', Number(e.target.value))} onBlur={handleAutoSave} placeholder="e.g. 1000" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Max Sqft</label>
                                        <input type="number" className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-3 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none" 
                                            value={formData.buyBox?.maxSqft || ''} onChange={e => updateBuyBox('maxSqft', Number(e.target.value))} onBlur={handleAutoSave} placeholder="e.g. 3000" />
                                    </div>
                                </div>
                            </div>
                            
                            {/* Map Section */}
                            <div className="mt-6">
                                <label className="text-xs text-gray-500 block mb-2 uppercase font-bold flex items-center gap-2">
                                    <MapPin size={12} /> Target Area Map
                                </label>
                                <div className="h-[500px] w-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-inner relative bg-gray-100 dark:bg-gray-900">
                                    <BuyerTargetMap locations={formData.buyBox?.locations ? formData.buyBox.locations.split(',').map(s => s.trim()).filter(s => s) : []} />
                                </div>
                            </div>
                        </section>

                         <section className="space-y-4">
                             <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 pb-2 flex items-center gap-2">
                                <User size={14}/> About The Investor
                            </h3>
                             <textarea 
                                className="w-full bg-gray-50 dark:bg-black/20 rounded border border-gray-200 dark:border-gray-700 p-4 h-64 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none resize-none shadow-inner"
                                placeholder="Enter background details..."
                                value={formData.about || ''}
                                onChange={e => setFormData({...formData, about: e.target.value})}
                                onBlur={handleAutoSave}
                            />
                         </section>

                         <section className="space-y-4">
                             <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 pb-2 flex items-center gap-2">
                                <FileText size={14}/> Activity Log
                            </h3>
                             <div className="bg-gray-50 dark:bg-black/20 rounded border border-gray-200 dark:border-gray-700 p-4 h-48 overflow-y-auto space-y-3 shadow-inner">
                                {formData.notes && formData.notes.length > 0 ? (
                                    formData.notes.map((log, idx) => (
                                        <div key={idx} className="flex gap-3 group border-b border-gray-100 dark:border-gray-800/50 pb-2 last:border-0 last:pb-0">
                                            <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400 shrink-0"></div>
                                            <div className="flex-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                                                {log}
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={() => updateAndSave({notes: formData.notes.filter((_, i) => i !== idx)})} 
                                                className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-gray-400 dark:text-gray-500 italic text-sm text-center py-4">No activity recorded.</div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <input 
                                    placeholder="Type a new note..." 
                                    className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-3 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none" 
                                    value={newNote} 
                                    onChange={(e) => setNewNote(e.target.value)} 
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddNote(); }}} 
                                />
                                <button type="button" onClick={handleAddNote} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded font-medium text-sm transition-colors flex items-center gap-2">
                                    <Plus size={16}/> Add Note
                                </button>
                            </div>
                         </section>

                         <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
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

                    </form>
                </div>
            </div>

                <ModalFooter 
                    onClose={handleCloseClick} 
                    onSave={() => triggerSave()}
                    saveLabel="Save Buyer"
                    showSaveButton={false}
                >
                    <button 
                        type="button" 
                        onClick={handleDeactivate} 
                        className="bg-gray-100 hover:bg-red-50 dark:bg-gray-800 dark:hover:bg-red-900/20 text-gray-700 hover:text-red-600 dark:text-gray-300 dark:hover:text-red-400 px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-2 border border-gray-300 dark:border-gray-600 hover:border-red-300 dark:hover:border-red-700"
                    >
                        <Ban size={16} /> Deactivate Buyer
                    </button>
                </ModalFooter>

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
                            triggerSave();
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

            {showDealMatcher && (
                <DealMatchModal 
                    buyer={formData} 
                    deals={deals} 
                    onClose={() => setShowDealMatcher(false)}
                    onOpenDeal={(deal) => {
                        if (onOpenDeal) onOpenDeal(deal);
                    }}
                />
            )}
        </div>
    );
};
