
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Home, PhoneOutgoing, DollarSign, User, Clock, ArrowRight, Save, X, Activity, Briefcase, Calendar, MapPin, FileText, TrendingUp, AlertTriangle, CheckCircle, Search, Phone, Mail, Send, Copy, Plus, ChevronLeft, ChevronRight, TrendingDown, Loader2, LayoutGrid, Image as ImageIcon, Link as LinkIcon, Users, Pencil, Trash2, ArrowRightLeft } from 'lucide-react';
import { api, sendBulkEmailGAS } from '../../services/api';
import { Deal, Wholesaler, Brokerage, Comparable, User as UserType, Buyer } from '../../types';
import { formatNumberWithCommas, parseNumberFromCurrency, formatPhoneNumber, getLogTimestamp, formatCurrency, calculateDaysRemaining, serverFunctions, processPhotoUrl, loadGoogleMapsScript } from '../../services/utils';
import { SenderEmail } from '../../types';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { mockOfferTemplates } from '../../services/mockData';
import { ModalFooter, NavigationArrows, UnsavedChangesModal } from '../Shared/ModalComponents';
import { useAutoSave, SavedNotification } from '../Shared/AutoSave';
import { BuyerMatchModal } from './BuyerMatchModal';
import { PropertyPhotoGallery } from './PropertyPhotoGallery';
import { 
    SUB_MARKETS, 
    COUNTIES, 
    ATLANTA_NEIGHBORHOODS, 
    GOOGLE_MAPS_API_KEY, 
    UNDER_CONTRACT_STATUSES, 
    POTENTIAL_STATUSES, 
    COUNTER_STATUSES, 
    DECLINED_STATUSES, 
    CLOSED_STATUSES 
} from '../../constants';

interface EditWholesalerDealModalProps {
    deal: Deal;
    setDeal: React.Dispatch<React.SetStateAction<Deal>>;
    onSave: (e?: React.FormEvent, shouldClose?: boolean, dealToSave?: Deal) => Promise<Deal | null>;
    onClose: (e: any) => void;
    onViewWholesaler: (nameOrId: string) => void;
    
    wholesalerSuggestions: Wholesaler[];
    brokerageSuggestions: Brokerage[];
    showWholesalerSuggestions: boolean;
    showBrokerageSuggestions: boolean;
    onWholesalerLookup: (val: string) => void;
    onBrokerageLookup: (val: string) => void;
    onSelectWholesaler: (agent: Wholesaler) => void;
    onSelectBrokerage: (brokerage: Brokerage) => void;
    
    wholesalers?: Wholesaler[];
    onUpdateWholesaler?: (agentId: string, updates: Partial<Wholesaler>) => void;
    onAddNewWholesaler?: (name?: string) => Promise<Wholesaler | void>;
    currentUser?: UserType | null;

    onNavigate: (direction: 'prev' | 'next') => void;
    hasNext: boolean;
    hasPrevious: boolean;
    
    onUpdate?: (id: string, updates: Partial<Deal>) => void;
    buyers: Buyer[];
    onViewBuyer?: (id: string) => void;
    
    zIndex?: string; 
    
    // Duplicate Detection Props
    allDeals?: Deal[];
    onSwitchToDeal?: (deal: Deal) => void;
}

const WholesalerSlot: React.FC<{
    slotIndex: number;
    agentId?: string;
    agentName?: string;
    agent?: Wholesaler; 
    allWholesalers: Wholesaler[];
    onSelect: (agent: Wholesaler) => void;
    onClear: () => void;
    onViewProfile: (agent: Wholesaler) => void;
    onUpdate?: (agentId: string, updates: Partial<Wholesaler>) => void;
    customNameValue?: string;
    onCustomNameChange?: (val: string) => void;
    onGenerateEmail?: (agent: Wholesaler) => void;
    onAddNewWholesaler?: (name?: string) => Promise<Wholesaler | void>;
    onBlur?: () => void;
}> = ({ slotIndex, agent, allWholesalers, onSelect, onClear, onViewProfile, onUpdate, customNameValue, onCustomNameChange, onGenerateEmail, onAddNewWholesaler, onBlur }) => {
    
    const [searchTerm, setSearchTerm] = useState("");
    const [showDropdown, setShowDropdown] = useState(false);
    
    useEffect(() => {
        if (slotIndex === 1 && !agent && customNameValue) {
            setSearchTerm(customNameValue);
        }
    }, [slotIndex, agent, customNameValue]);

    const filteredWholesalers = searchTerm.length > 0 
        ? allWholesalers.filter(a => a && (a.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
        : [];

    const handleSearchChange = (val: string) => {
        setSearchTerm(val);
        setShowDropdown(true);
        if (onCustomNameChange) onCustomNameChange(val);
    };
    
    const getInitials = (name: string) => name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase();

    if (agent) {
        return (
            <div 
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 relative group hover:border-blue-500/50 transition-colors cursor-pointer"
                onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('button') || target.closest('input') || target.closest('a')) {
                        return;
                    }
                    onViewProfile(agent);
                }}
            >
                <button type="button" onClick={onClear} className="absolute top-2 right-2 text-gray-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"><X size={16} /></button>
                
                <div className="flex gap-4 items-start">
                    <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0 overflow-hidden border-2 border-white dark:border-gray-600 shadow-sm mt-1">
                        {agent.photo ? (
                            <img src={agent.photo} alt={agent.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500">
                                <User size={32} fill="currentColor" className="opacity-50"/>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-center space-y-3">
                        <div className="flex justify-between items-start">
                            <div className="group/link flex-1 min-w-0">
                                <div className="font-bold text-gray-900 dark:text-white text-xl truncate group-hover/link:text-blue-500 dark:group-hover/link:text-blue-400 transition-colors">{agent.name}</div>
                                <div className="text-base text-purple-600 dark:text-purple-400 font-medium truncate">{agent.companyName || 'No Company'}</div>
                            </div>
                        </div>

                        <div className="space-y-2 text-base text-gray-600 dark:text-gray-300">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <Phone size={16} className="text-gray-400 dark:text-gray-500 shrink-0"/> 
                                <span className={`truncate ${!agent.phone ? 'italic text-gray-500 dark:text-gray-600' : ''}`}>{agent.phone ? formatPhoneNumber(agent.phone) : 'Not Set...'}</span>
                            </div>
                            <div className="flex items-center gap-2 overflow-hidden">
                                <Mail size={16} className="text-gray-400 dark:text-gray-500 shrink-0"/> 
                                <span className={`truncate ${!agent.email ? 'italic text-gray-500 dark:text-gray-600' : ''}`}>{agent.email || 'Not Set...'}</span>
                            </div>
                        </div>
                        
                        {onGenerateEmail && (
                            <div className="pt-2">
                                <button 
                                    type="button" 
                                    onClick={() => onGenerateEmail(agent)}
                                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-2 rounded flex items-center gap-2 transition-colors font-bold shadow-sm w-full md:w-auto justify-center"
                                >
                                    <Send size={12} /> Send LOI
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="w-40 shrink-0 border-l border-gray-200 dark:border-gray-700 pl-4 flex flex-col justify-center gap-4 hidden sm:flex">
                        <div>
                            <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Last Contact</label>
                            <input 
                                type="date" 
                                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-xs focus:border-blue-500 outline-none date-input-icon cursor-pointer"
                                value={agent.lastContactDate || ''} 
                                onChange={(e) => onUpdate && onUpdate(agent.id, {lastContactDate: e.target.value})} 
                            />
                        </div>
                        <div>
                            <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Next Follow-Up</label>
                            <input 
                                type="date" 
                                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-xs focus:border-blue-500 outline-none date-input-icon cursor-pointer"
                                value={agent.nextFollowUpDate || ''} 
                                onChange={(e) => onUpdate && onUpdate(agent.id, {nextFollowUpDate: e.target.value})} 
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative">
            <div className="relative">
                <Search className="absolute left-3 top-3.5 text-gray-400" size={16} />
                <input 
                    type="text" 
                    placeholder="Type Wholesaler's Name..." 
                    className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-3 pl-10 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none"
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => {
                        setTimeout(() => setShowDropdown(false), 200);
                        if (onBlur) onBlur();
                    }}
                />
            </div>
            {showDropdown && searchTerm.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-b-lg mt-1 z-20 max-h-40 overflow-y-auto shadow-xl">
                    {filteredWholesalers.length > 0 ? filteredWholesalers.map(a => (
                        <div 
                            key={a.id} 
                            className="p-3 hover:bg-blue-50 dark:hover:bg-blue-900 cursor-pointer text-sm text-gray-600 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 last:border-0 flex items-center justify-between group"
                            onMouseDown={() => {
                                onSelect(a);
                                setSearchTerm("");
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0 overflow-hidden">
                                    {a.photo ? <img src={a.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">{getInitials(a.name)}</div>}
                                </div>
                                <div>
                                    <div className="font-bold text-gray-900 dark:text-white">{a.name}</div>
                                    <div className="text-xs">{a.companyName}</div>
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="p-3 text-sm text-gray-500 italic border-b border-gray-200 dark:border-gray-700">No wholesalers found</div>
                    )}
                    
                    {onAddNewWholesaler && (
                         <button 
                            type="button"
                            className="w-full text-left p-3 hover:bg-blue-50 dark:hover:bg-blue-900/50 cursor-pointer text-sm text-blue-500 dark:text-blue-400 font-bold flex items-center gap-2 sticky bottom-0 bg-white dark:bg-gray-800"
                            onMouseDown={async (e) => {
                                e.preventDefault();
                                if (onAddNewWholesaler) {
                                    const newW = await onAddNewWholesaler(searchTerm);
                                    if (newW) {
                                        onSelect(newW);
                                    }
                                }
                                setShowDropdown(false);
                            }}
                        >
                            <Plus size={14} /> Add New Wholesaler {searchTerm}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};


export const EditWholesalerDealModal: React.FC<EditWholesalerDealModalProps> = ({ 
    deal, setDeal, onSave, onClose, onViewWholesaler, 
    wholesalerSuggestions, brokerageSuggestions, showWholesalerSuggestions, showBrokerageSuggestions,
    onWholesalerLookup, onBrokerageLookup, onSelectWholesaler, onSelectBrokerage,
    wholesalers = [], onUpdateWholesaler, onAddNewWholesaler, currentUser,
    onNavigate, hasNext, hasPrevious, onUpdate, buyers, onViewBuyer,
    zIndex = 'z-[120]', 
    allDeals = [], onSwitchToDeal
}) => {
    const initialDealJson = useRef(JSON.stringify(deal));
    const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState<'prev' | 'next' | null>(null);
    const [warningSelectedOption, setWarningSelectedOption] = useState<'yes' | 'no'>('yes');
    
    const [activeGalleryIndex, setActiveGalleryIndex] = useState<number | null>(null);

    const [showBuyerMatch, setShowBuyerMatch] = useState(false);
    
    const [neighborhoodQuery, setNeighborhoodQuery] = useState("");
    const [showNeighborhoodDropdown, setShowNeighborhoodDropdown] = useState(false);
    
    // Log editing state
    const [editingLogIndex, setEditingLogIndex] = useState<number | null>(null);
    const [editLogValue, setEditLogValue] = useState("");

    // Duplicate Detection & Google Autocomplete State
    const [addressMatches, setAddressMatches] = useState<Deal[]>([]);
    const [showAddressMatches, setShowAddressMatches] = useState(false);
    const [googleSuggestions, setGoogleSuggestions] = useState<any[]>([]);
    const [showGoogleSuggestions, setShowGoogleSuggestions] = useState(false);
    const [mapsLoaded, setMapsLoaded] = useState(false);
    
    // Services Ref
    const autocompleteService = useRef<any>(null);

    // --- SELF-HEALING DATA LOGIC FOR BANNER & LIGHTBOX ---
    const safePhotos = useMemo(() => {
        const p = deal.photos as any; 
        if (!p) return [];
        if (Array.isArray(p)) return p; 
        
        if (typeof p === 'string') {
            try {
                if (p.trim().startsWith('[')) return JSON.parse(p);
                return (p as string).split(',').map(s => s.trim().replace(/['"\[\]]/g, ''));
            } catch (e) {
                return [];
            }
        }
        return [];
    }, [deal.photos]);

    // --- GOOGLE MAPS LOADING LOGIC ---
    useEffect(() => {
        if ((window as any).google?.maps?.places) {
            setMapsLoaded(true);
            return;
        }

        if (GOOGLE_MAPS_API_KEY) {
            loadGoogleMapsScript(GOOGLE_MAPS_API_KEY);
            const interval = setInterval(() => {
                if ((window as any).google?.maps?.places) {
                    setMapsLoaded(true);
                    clearInterval(interval);
                }
            }, 500);
            return () => clearInterval(interval);
        }
    }, []);
    
    // Initialize Autocomplete Service Once Maps is Ready
    useEffect(() => {
        if (mapsLoaded && (window as any).google?.maps?.places && !autocompleteService.current) {
            autocompleteService.current = new (window as any).google.maps.places.AutocompleteService();
        }
    }, [mapsLoaded]);

    // --- 1. REF to track latest deal state ---
    const dealRef = useRef(deal);
    useEffect(() => { 
        if (deal.id === dealRef.current.id) {
            // Merge logic could go here, but for now strict sync on ID match
        } else {
            dealRef.current = deal; 
        }
        dealRef.current = deal;
    }, [deal]);

    // --- 2. CALLBACK to save using the ref (prevents stale closure) ---
    const saveCurrentDeal = useCallback(async () => {
        if (!dealRef.current.address || dealRef.current.address.trim() === '') {
            return;
        }
        try {
            const savedDeal = await onSave(undefined, false, dealRef.current);
            if (savedDeal && savedDeal.id) {
                if (dealRef.current.id !== savedDeal.id) {
                    console.log("ID Updated from server:", savedDeal.id);
                    dealRef.current.id = savedDeal.id;
                    setDeal(prev => ({ ...prev, id: savedDeal.id }));
                }
            }
            initialDealJson.current = JSON.stringify(dealRef.current);
        } catch (e) {
            console.error("Save error in modal:", e);
            throw e; 
        }
    }, [onSave]);

    // --- 3. AUTO-SAVE HOOK ---
    const { triggerSave, showSavedNotification, setShowSavedNotification, isSaving } = useAutoSave({
        onSave: saveCurrentDeal
    });

    // --- 4. BLUR HANDLER with 0ms Delay & Sync ---
    const handleAutoSave = () => {
        setTimeout(() => {
            triggerSave();
        }, 0); 
    };

    // --- 5. SYNCHRONOUS STATE UPDATE HELPER ---
    const updateDealState = (updates: Partial<Deal>) => {
        const newData = { ...deal, ...updates };
        dealRef.current = newData; 
        setDeal(newData); 
    };
    
    // --- 6. SEARCH AS YOU TYPE (Duplicates & Google Autocomplete) ---
    const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        updateDealState({ address: val });
        
        // 1. Check for Internal Duplicates
        if (val.trim().length > 4 && allDeals) {
            const normalizedInput = val.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            const matches = allDeals.filter(d => {
                if (d.id === deal.id) return false; 
                const normalizedExisting = (d.address || "").toLowerCase().replace(/[^a-z0-9]/g, '');
                return normalizedExisting.includes(normalizedInput) || (d.address && d.address.toLowerCase().includes(val.toLowerCase()));
            });
            setAddressMatches(matches);
            setShowAddressMatches(matches.length > 0);
        } else {
            setShowAddressMatches(false);
            setAddressMatches([]);
        }

        // 2. Fetch Google Suggestions using Cached Service
        if (val.length > 2 && autocompleteService.current) {
            // Using 'geocode' instead of 'address' for better fuzzy matching and including country restriction
            const request = { 
                input: val, 
                types: ['geocode'],
                componentRestrictions: { country: 'us' }
            };
            
            autocompleteService.current.getPlacePredictions(request, (predictions: any[], status: any) => {
                if (status === (window as any).google.maps.places.PlacesServiceStatus.OK && predictions) {
                    setGoogleSuggestions(predictions);
                    setShowGoogleSuggestions(true);
                } else {
                    setGoogleSuggestions([]);
                    setShowGoogleSuggestions(false);
                }
            });
        } else {
            setGoogleSuggestions([]);
            setShowGoogleSuggestions(false);
        }
    };

    const handleGoogleSelect = (prediction: any) => {
        const address = prediction.description;
        updateDealState({ address });
        setGoogleSuggestions([]);
        setShowGoogleSuggestions(false);
        
        // Trigger a duplicate check on the full selected address
        if (allDeals) {
             const normalizedInput = address.toLowerCase().replace(/[^a-z0-9]/g, '');
             const matches = allDeals.filter(d => {
                if (d.id === deal.id) return false; 
                const normalizedExisting = (d.address || "").toLowerCase().replace(/[^a-z0-9]/g, '');
                return normalizedExisting === normalizedInput;
            });
            setAddressMatches(matches);
            setShowAddressMatches(matches.length > 0);
        }
        
        triggerSave();
    };

    useEffect(() => {
        initialDealJson.current = JSON.stringify(deal);
        setPendingNavigation(null);
        setNeighborhoodQuery(deal.neighborhood || "");
        setEditingLogIndex(null);
        setEditLogValue("");
        setShowAddressMatches(false);
        setAddressMatches([]);
        setGoogleSuggestions([]);
        setShowGoogleSuggestions(false);
    }, [deal.id]);

    useEffect(() => {
        if (!showNeighborhoodDropdown) {
            setNeighborhoodQuery(deal.neighborhood || "");
        }
    }, [deal.neighborhood]);

    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailContent, setEmailContent] = useState("");
    const [emailSubject, setEmailSubject] = useState("");
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [emailStatus, setEmailStatus] = useState<{ type: 'error' | 'success', message: string } | null>(null);
    const [availableEmails, setAvailableEmails] = useState<SenderEmail[]>([]);
    const [selectedFromEmail, setSelectedFromEmail] = useState("");
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
    const [selectedAgentEmail, setSelectedAgentEmail] = useState<string | null>(null);

    useEffect(() => {
        const fetchEmails = async () => {
            try {
                const emails = await api.load('sender_emails') as SenderEmail[];
                setAvailableEmails(emails);
                if (emails.length > 0) {
                    const defaultEmail = emails.find(e => e.is_default)?.email || emails[0].email;
                    setSelectedFromEmail(defaultEmail);
                }
            } catch (e) {
                console.error("Failed to load sender emails:", e);
            }
        };
        fetchEmails();
    }, []);

    const wholesaler1 = wholesalers.find(a => a && (a.name || '').toLowerCase() === (deal.agentName || '').toLowerCase());
    const wholesaler2 = wholesalers.find(a => a.id === deal.secondAgentId);
    
    const daysToInsp = calculateDaysRemaining(deal.inspectionDate);
    const daysToEMD = calculateDaysRemaining(deal.emdDate);

    const getUrgencyColor = (days: number | null) => {
        if (days === null) return 'text-gray-400';
        if (days < 0) return 'text-red-600 font-bold';
        if (days <= 3) return 'text-red-500 dark:text-red-400 font-bold';
        return 'text-green-600 dark:text-green-400 font-bold';
    };

    // ... (Wholesaler handling methods remain unchanged) ...
    const handleSelectWholesaler1 = (agent: Wholesaler) => {
        updateDealState({
            agentName: agent.name,
            agentPhone: agent.phone,
            agentEmail: agent.email,
            agentBrokerage: agent.companyName || ''
        });
        triggerSave();
    };

    const handleClearWholesaler1 = () => {
        updateDealState({
            agentName: '',
            agentPhone: '',
            agentEmail: '',
            agentBrokerage: ''
        });
        triggerSave();
    };

    const handleSelectWholesaler2 = (agent: Wholesaler) => {
        updateDealState({ secondAgentId: agent.id });
        triggerSave();
    };

    const handleGenerateEmail = (agent: Wholesaler) => {
        const agentFirstName = agent.name.split(' ')[0];
        
        const offerPriceVal = deal.offerPrice || 0;
        const offerPriceStr = deal.offerPrice ? formatCurrency(offerPriceVal) : "[Offer Price]";
        
        const emdVal = offerPriceVal * 0.01;
        const emdStr = deal.offerPrice ? formatCurrency(emdVal) : "[1% of Offer Price]";
        
        const subject = `Cash Offer! - ${deal.address}`;
        let body = `<div>Hi ${agentFirstName},</div><div><br></div><div>Thanks so much for taking the time to list this property and provide all of the pictures and details. We’ve reviewed everything and would like to formally submit an offer based on our numbers below.</div><div><br></div><div>Our offer is based on careful underwriting, recent comps, and expected renovation costs. We’re not here to waste anyone’s time with lowball tactics — this is a serious, as-is cash offer with clean terms.</div><div><br></div><div><strong>Address:</strong> ${deal.address}</div><div><strong>Offer Amount:</strong> ${offerPriceStr}</div><div><strong>Earnest Money Deposit:</strong> 1% (${emdStr})</div><div><strong>Due Diligence Period:</strong> 10 days</div><div><strong>Closing Timeline:</strong> 30 days or sooner</div><div><strong>Closing Attorney:</strong> Lueder, Larkin and Hunter - Douglasville</div><div><strong>Contingencies:</strong> None – we’re buying as-is</div><div><strong>Buyer:</strong> Ashari Zakar Real Estate, LLC (AZRE)</div><div><br></div><div>You can <a href="http://terms.asharizakargroup.com/">click here</a> to view our full Purchase Terms Sheet</div><div><br></div><div>I’d love the opportunity to do a quick walkthrough with our contractor to confirm the renovation budget. Once we have that, we’re ready to move fast and get this across the line.</div><div><br></div><div>Let me know if this is in range for the seller. Either way, thanks again for the opportunity, and I hope we can work together on this one (and more down the line).</div>`;

        if (currentUser?.signature) {
            body += `<br/><br/>${currentUser.signature}`;
        }

        setEmailSubject(subject);
        setEmailContent(body);
        setSelectedAgentEmail(agent.email || null);
        setShowEmailModal(true);
        setSelectedTemplateId("");
    };

    const handleTemplateSelect = (templateId: string) => {
        setSelectedTemplateId(templateId);
        const template = mockOfferTemplates.find(t => t.id === templateId);
        if (template) {
            const agent = wholesaler1 || wholesaler2;
            const agentName = agent ? agent.name : "[Wholesaler Name]";
            const agentFirstName = agent ? agent.name.split(' ')[0] : "[Wholesaler First Name]";
            const offerPriceVal = deal.offerPrice || 0;
            const offerPriceStr = deal.offerPrice ? formatCurrency(offerPriceVal) : "[Offer Price]";
            
            let body = template.emailBody || "";
            if (template.loiBody) {
                body += `<br/><br/>---<br/><br/>${template.loiBody}`;
            }

            body = body.replace(/\{\{Agent_Name\}\}/g, agentName)
                       .replace(/\{\{Agent_First_Name\}\}/g, agentFirstName)
                       .replace(/\{\{Property_Address\}\}/g, deal.address || "[Property Address]")
                       .replace(/\{\{Offer_Amount\}\}/g, offerPriceStr)
                       .replace(/\{\{Your_Phone\}\}/g, "(636) 486-6088")
                       .replace(/\{\{Your_Address\}\}/g, "Ashari Zakar Real Estate, LLC");

            body = body.replace(/\n/g, '<br/>');

            if (currentUser?.signature) {
                body += `<br/><br/>${currentUser.signature}`;
            }

            setEmailContent(body);
        }
    };

    const handleSendLOI = async () => {
        const targetEmail = selectedAgentEmail || deal.agentEmail;
        if (!targetEmail) {
            setEmailStatus({ type: 'error', message: "This wholesaler does not have an email address set." });
            return;
        }
        setIsSendingEmail(true);
        setEmailStatus(null);
        try {
            let htmlBody = emailContent;
            const response = await sendBulkEmailGAS([{ email: targetEmail, name: "Wholesaler" }], emailSubject, htmlBody, selectedFromEmail);
            if (response && response.status === 'success') {
                setEmailStatus({ type: 'success', message: "LOI sent successfully!" });
                setTimeout(() => setShowEmailModal(false), 2000);
            } else {
                let errorMsg = response?.error || response?.message || "Unknown error";
                if (response?.errors && response.errors.length > 0) {
                    errorMsg = response.errors[0].error;
                }
                let displayMsg = errorMsg;
                if (errorMsg.includes("AWS Credentials missing")) {
                    displayMsg = "AWS Credentials missing. Please configure AWS SES in the Settings -> Email section.";
                } else if (errorMsg.includes("Email address is not verified")) {
                    displayMsg = `The sender email (${selectedFromEmail}) is not verified in AWS SES.`;
                }
                setEmailStatus({ type: 'error', message: "Failed to send LOI. " + displayMsg });
            }
        } catch (e: any) {
            setEmailStatus({ type: 'error', message: "Error sending LOI: " + e.message });
        } finally {
            setIsSendingEmail(false);
        }
    };

    const getSoftenerArv = (comp?: Comparable) => {
        if (!comp || !comp.salePrice) return 0;
        const price = comp.salePrice;
        const percent = comp.softenerPercent || 0;
        return price - (price * (percent / 100));
    };

    const updateComp = (key: 'renovationComparable1' | 'renovationComparable2' | 'renovationComparable3' | 'newConstructionComparable1' | 'newConstructionComparable2' | 'newConstructionComparable3', field: keyof Comparable, value: any) => {
        const currentComp = deal[key] || { address: '', saleDate: '', salePrice: 0 };
        const updatedComp = { ...currentComp, [field]: value };
        
        const isNewConstruction = key.includes('newConstruction');
        let newArv = isNewConstruction ? deal.newConstructionARV : deal.renovationARV;

        if (field === 'salePrice' || field === 'softenerPercent') {
            const getCompValue = (compKey: string) => key === compKey ? updatedComp : deal[compKey as keyof Deal];
            
            const comp1 = getCompValue(isNewConstruction ? 'newConstructionComparable1' : 'renovationComparable1') as Comparable | undefined;
            const comp2 = getCompValue(isNewConstruction ? 'newConstructionComparable2' : 'renovationComparable2') as Comparable | undefined;
            const comp3 = getCompValue(isNewConstruction ? 'newConstructionComparable3' : 'renovationComparable3') as Comparable | undefined;

            const arv1 = getSoftenerArv(comp1);
            const arv2 = getSoftenerArv(comp2);
            const arv3 = getSoftenerArv(comp3);

            const arvs = [arv1, arv2, arv3].filter(p => p > 0);
            
            if (arvs.length > 0) {
                const sum = arvs.reduce((a, b) => a + b, 0);
                newArv = Math.round(sum / arvs.length);
            }
        }

        if (isNewConstruction) {
            updateDealState({ [key]: updatedComp, newConstructionARV: newArv });
        } else {
            updateDealState({ [key]: updatedComp, renovationARV: newArv });
        }
    };

    const safeOfferAmount = Math.round((deal.renovationARV || 0) * 0.40);
    const sureCashOfferAmount = Math.round((deal.listPrice || 0) - 70000);

    const priceDrop = (deal.originalAskingPrice || 0) - (deal.listPrice || 0);
    const priceDropPercent = (deal.originalAskingPrice || 0) > 0 && (deal.listPrice || 0) > 0
        ? (priceDrop / deal.originalAskingPrice) * 100 
        : 0;

    const calculateDaysOnMarket = (dateStr: string | null | undefined) => {
        if (!dateStr) return null;
        const parts = dateStr.split('-');
        if (parts.length !== 3) return null;
        const startMidnight = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const now = new Date();
        const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const diff = nowMidnight.getTime() - startMidnight.getTime();
        return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
    };
    const daysOnMarket = calculateDaysOnMarket(deal.dateListed);

    useEffect(() => {
        if (!deal.address) return;
        const lowerAddr = deal.address.toLowerCase();
        let updates: Partial<Deal> = {};
        let hasChanges = false;

        if (!deal.subMarket) {
            const match = SUB_MARKETS.find(m => lowerAddr.includes(m.toLowerCase()));
            if (match) {
                updates.subMarket = match;
                hasChanges = true;
            }
        }

        if (!deal.county) {
            const match = COUNTIES.find(c => {
                const nameOnly = c.toLowerCase().replace(' county', '');
                return lowerAddr.includes(nameOnly);
            });
            if (match) {
                updates.county = match;
                hasChanges = true;
            }
        }
        
        if (hasChanges) {
            updateDealState(updates);
        }
    }, [deal.address]); 

    const [tempLogValue, setTempLogValue] = useState("");

    const handleCloseClick = () => {
        const currentJson = JSON.stringify(deal);
        if (currentJson !== initialDealJson.current) {
            setWarningSelectedOption('yes'); 
            setShowUnsavedWarning(true);
        } else {
            onClose(undefined);
        }
    };

    const handleNavigationClick = (direction: 'prev' | 'next') => {
        const currentJson = JSON.stringify(deal);
        if (currentJson !== initialDealJson.current) {
            setPendingNavigation(direction);
            setWarningSelectedOption('yes'); 
            setShowUnsavedWarning(true);
        } else {
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
                         if (pendingNavigation) {
                             onNavigate(pendingNavigation);
                         } else {
                             onClose(undefined);
                         }
                         setShowUnsavedWarning(false);
                     } else {
                         setShowUnsavedWarning(false);
                         if (pendingNavigation) {
                             onNavigate(pendingNavigation);
                         } else {
                             onClose(undefined);
                         }
                     }
                 }
                 return;
            }

            if (activeGalleryIndex !== null) {
                if (e.key === 'Escape') setActiveGalleryIndex(null);
                else if (e.key === 'ArrowLeft') setActiveGalleryIndex(prev => (prev! > 0 ? prev! - 1 : lightboxImages.length - 1));
                else if (e.key === 'ArrowRight') setActiveGalleryIndex(prev => (prev! < lightboxImages.length - 1 ? prev! + 1 : 0));
                return;
            }

            const target = e.target as HTMLElement;
            const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
            
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
    }, [hasPrevious, hasNext, deal, showUnsavedWarning, warningSelectedOption, pendingNavigation, triggerSave, onNavigate, onClose, handleNavigationClick, activeGalleryIndex]); 

    const filteredNeighborhoods = ATLANTA_NEIGHBORHOODS.filter(n => 
        n.toLowerCase().includes(neighborhoodQuery.toLowerCase())
    );

    const handleAddLog = () => {
        if (!tempLogValue.trim()) return;
        const userName = currentUser?.name || 'User';
        const newLog = `${getLogTimestamp()} - ${userName}: ${tempLogValue.trim()}`;
        const newLogs = [newLog, ...(deal.logs || [])];
        
        dealRef.current = { ...deal, logs: newLogs };
        setDeal(dealRef.current);
        
        if (onUpdate) {
            onUpdate(deal.id, { logs: newLogs });
        } else {
            triggerSave();
        }
        
        setTempLogValue('');
        setShowSavedNotification(true);
        setTimeout(() => setShowSavedNotification(false), 1000);
    };

    const handleSaveLogEdit = (index: number) => {
        if (!editLogValue.trim()) return;
        const newLogs = [...(deal.logs || [])];
        newLogs[index] = editLogValue;
        
        dealRef.current = { ...deal, logs: newLogs };
        setDeal(dealRef.current);
        
        if (onUpdate) {
            onUpdate(deal.id, { logs: newLogs });
        } else {
            triggerSave();
        }
        
        setEditingLogIndex(null);
        setShowSavedNotification(true);
        setTimeout(() => setShowSavedNotification(false), 1000);
    };

    const handleDeleteLog = (index: number) => {
        if (window.confirm("Delete this note?")) {
            const currentLogs = dealRef.current.logs || [];
            const newLogs = [...currentLogs];
            newLogs.splice(index, 1);
            
            dealRef.current = { ...dealRef.current, logs: newLogs };
            setDeal(dealRef.current);
            
            if (onUpdate) {
                onUpdate(deal.id, { logs: newLogs });
            } else {
                triggerSave();
            }
            
            setShowSavedNotification(true);
            setTimeout(() => setShowSavedNotification(false), 1000);
        }
    };

    const toggleDealType = (type: string) => {
        const currentTypes = deal.dealType || [];
        const exists = currentTypes.includes(type);
        const newTypes = exists ? currentTypes.filter(t => t !== type) : [...currentTypes, type];
        updateDealState({ dealType: newTypes });
        if (onUpdate) onUpdate(deal.id, { dealType: newTypes });
        triggerSave();
    };

    const currentDealTypes = deal.dealType || [];

    const lightboxImages = useMemo(() => {
        const imgs = [];
        const uploads = (safePhotos || []).map(p => processPhotoUrl(p));
        imgs.push(...uploads);
        if (GOOGLE_MAPS_API_KEY && deal.address && deal.address.length > 5 && !deal.excludeStreetView) {
            imgs.push(`https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${encodeURIComponent(deal.address)}&fov=70&key=${GOOGLE_MAPS_API_KEY}`);
        }
        return imgs;
    }, [deal.address, safePhotos, deal.excludeStreetView]);

    return (
        <div className={`fixed inset-0 bg-black/80 flex justify-center overflow-hidden backdrop-blur-sm ${zIndex}`} onClick={handleCloseClick}>
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
                titlePrev="Previous Property"
                titleNext="Next Property"
          />

          <div className="bg-white dark:bg-gray-900 w-full max-w-6xl border-x border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden flex flex-col h-full relative" onClick={(e) => e.stopPropagation()}>
              
              <SavedNotification show={showSavedNotification} />
              {isSaving && <div className="absolute top-20 right-8 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-xl z-[90] flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Saving...</div>}

              <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900 relative">
                 <button type="button" onClick={handleCloseClick} className="absolute top-4 right-4 z-50 bg-gray-200/50 dark:bg-black/40 hover:bg-red-500 text-gray-900 dark:text-white p-2 rounded-full transition-colors backdrop-blur-md"><X size={20}/></button>
                 
                 <form onSubmit={(e) => { e.preventDefault(); triggerSave(); }} className="p-6 space-y-8">
                    
                    <div className="space-y-4">
                        <PropertyPhotoGallery 
                            deal={deal} 
                            setDeal={setDeal} 
                            onUpdate={onUpdate} 
                            triggerSave={triggerSave}
                            setShowSavedNotification={setShowSavedNotification}
                            activeGalleryIndex={activeGalleryIndex}
                            setActiveGalleryIndex={setActiveGalleryIndex}
                        />
                        
                        <div className="flex items-end justify-between w-full pt-2">
                            <div className="flex-1 truncate pr-4">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white truncate">{deal.address}</h2>
                                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300 mt-2">
                                   <span className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-blue-600 dark:text-blue-400 border border-gray-200 dark:border-gray-700 text-xs">MLS: {deal.mls}</span>
                                   <span className={`px-2 py-0.5 rounded font-bold text-xs ${UNDER_CONTRACT_STATUSES.includes(deal.offerDecision) ? 'bg-green-100 dark:bg-green-900/80 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800' : 'bg-yellow-100 dark:bg-yellow-900/80 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800'}`}>{deal.offerDecision}</span>
                                </div>
                            </div>
                            <button 
                                type="button" 
                                onClick={() => setShowBuyerMatch(true)}
                                className="bg-green-600 hover:bg-green-500 text-white font-bold py-1.5 px-3 rounded-lg shadow-md transition-colors flex items-center gap-2 text-xs shrink-0 mb-1"
                            >
                                <Users size={14} /> Buyer Match
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><Home size={14}/> Property Information</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="relative z-[100]">
                                <label className="text-xs text-gray-500 block mb-1">Full Address</label>
                                <input 
                                    required 
                                    autoComplete="off"
                                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none" 
                                    value={deal.address || ''} 
                                    onChange={handleAddressChange} 
                                    onBlur={handleAutoSave} 
                                />
                                {((showAddressMatches && addressMatches.length > 0) || (showGoogleSuggestions && googleSuggestions.length > 0)) && (
                                    <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-b-lg mt-1 shadow-xl max-h-60 overflow-y-auto z-[100]">
                                        
                                        {/* Duplicate Deals Section */}
                                        {showAddressMatches && addressMatches.length > 0 && (
                                            <div className="border-b border-gray-200 dark:border-gray-700">
                                                <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 text-[10px] font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-widest border-b border-yellow-100 dark:border-yellow-800/30 flex items-center gap-2 sticky top-0 backdrop-blur-sm">
                                                    <AlertTriangle size={12} /> Existing Deals Found
                                                </div>
                                                {addressMatches.map(match => (
                                                    <div 
                                                        key={match.id}
                                                        onMouseDown={() => onSwitchToDeal && onSwitchToDeal(match)}
                                                        className="p-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer border-b border-gray-100 dark:border-gray-800 last:border-0 group"
                                                    >
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">{match.address}</span>
                                                            <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{formatCurrency(match.listPrice)}</span>
                                                        </div>
                                                        <div className="mt-1 flex items-center gap-2">
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase border ${UNDER_CONTRACT_STATUSES.includes(match.offerDecision) ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' : 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'}`}>
                                                                {match.offerDecision}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                                                <ArrowRightLeft size={10} /> Switch to Deal
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Google Suggestions Section */}
                                        {showGoogleSuggestions && googleSuggestions.length > 0 && (
                                            <div>
                                                {showAddressMatches && addressMatches.length > 0 && (
                                                     <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest border-y border-blue-100 dark:border-blue-800/30 flex items-center gap-2 sticky top-0 backdrop-blur-sm">
                                                        <MapPin size={12} /> Address Suggestions
                                                    </div>
                                                )}
                                                {googleSuggestions.map(p => (
                                                    <div 
                                                        key={p.place_id}
                                                        onMouseDown={() => handleGoogleSelect(p)}
                                                        className="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                                                    >
                                                        <div className="text-sm text-gray-700 dark:text-gray-200 font-medium">
                                                            {p.description}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            
                            <div className="grid md:grid-cols-3 gap-4">
                                <div><label className="text-xs text-gray-500 block mb-1">Sub-Market</label><select className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-sm" value={deal.subMarket || ''} onChange={e => { updateDealState({subMarket: e.target.value}); if(onUpdate) onUpdate(deal.id, {subMarket: e.target.value}); triggerSave(); }}><option value="">Select...</option>{SUB_MARKETS.map(city => <option key={city} value={city}>{city}</option>)}</select></div>
                                
                                <div className="relative">
                                    <label className="text-xs text-gray-500 block mb-1">Neighborhood</label>
                                    <div className="relative">
                                        <input 
                                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none"
                                            value={neighborhoodQuery}
                                            onChange={(e) => { setNeighborhoodQuery(e.target.value); setShowNeighborhoodDropdown(true); }}
                                            onFocus={() => setShowNeighborhoodDropdown(true)}
                                            onBlur={() => {
                                                if (deal.neighborhood !== neighborhoodQuery) {
                                                    updateDealState({neighborhood: neighborhoodQuery});
                                                    if(onUpdate) onUpdate(deal.id, {neighborhood: neighborhoodQuery});
                                                }
                                                setTimeout(() => setShowNeighborhoodDropdown(false), 200);
                                                handleAutoSave(); 
                                            }}
                                            placeholder="Search Neighborhood..."
                                        />
                                        {showNeighborhoodDropdown && (
                                            <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-b-lg mt-1 max-h-48 overflow-y-auto z-20 shadow-xl">
                                                {filteredNeighborhoods.map((n, idx) => (
                                                    <div 
                                                        key={idx}
                                                        className="px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/50 cursor-pointer text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                                                        onMouseDown={() => {
                                                            setNeighborhoodQuery(n);
                                                            updateDealState({neighborhood: n});
                                                            if(onUpdate) onUpdate(deal.id, {neighborhood: n});
                                                            setShowNeighborhoodDropdown(false);
                                                            triggerSave(); 
                                                        }}
                                                    >
                                                        {n}
                                                    </div>
                                                ))}
                                                {neighborhoodQuery.trim() && (
                                                    <div className="p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                                                        <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Other Neighborhoods</div>
                                                        <button 
                                                            type="button"
                                                            className="w-full text-left text-sm text-blue-600 dark:text-blue-400 font-bold hover:underline"
                                                            onMouseDown={() => {
                                                                const newNb = neighborhoodQuery.trim();
                                                                if (newNb && !ATLANTA_NEIGHBORHOODS.includes(newNb)) {
                                                                    ATLANTA_NEIGHBORHOODS.push(newNb);
                                                                    ATLANTA_NEIGHBORHOODS.sort();
                                                                }
                                                                updateDealState({neighborhood: newNb});
                                                                if(onUpdate) onUpdate(deal.id, {neighborhood: newNb});
                                                                setShowNeighborhoodDropdown(false);
                                                                triggerSave(); 
                                                            }}
                                                        >
                                                            + Add "{neighborhoodQuery}"
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div><label className="text-xs text-gray-500 block mb-1">Listing Type</label><select className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-sm" value={deal.listingType || ''} onChange={e => { updateDealState({listingType: e.target.value}); if(onUpdate) onUpdate(deal.id, {listingType: e.target.value}); triggerSave(); }}><option value="">Select...</option><option value="Listed On MLS">Listed On MLS</option><option value="Off-Market">Off-Market</option></select></div>
                            </div>

                            <div className="grid md:grid-cols-4 gap-4">
                                <div><label className="text-xs text-gray-500 block mb-1">For Sale By</label><select className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-sm" value={deal.forSaleBy || ''} onChange={e => { updateDealState({forSaleBy: e.target.value}); if(onUpdate) onUpdate(deal.id, {forSaleBy: e.target.value}); triggerSave(); }}><option value="">Select...</option><option value="Wholesaler">Wholesaler</option><option value="Owner">Owner</option></select></div>
                                <div><label className="text-xs text-gray-500 block mb-1">MLS Number</label><input className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-sm font-mono" value={deal.mls || ''} onChange={e => updateDealState({mls: e.target.value})} onBlur={handleAutoSave} /></div>
                                <div><label className="text-xs text-gray-500 block mb-1">Property Type</label><select className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-sm" value={deal.propertyType || ''} onChange={e => { updateDealState({propertyType: e.target.value}); if(onUpdate) onUpdate(deal.id, {propertyType: e.target.value}); triggerSave(); }}><option value="">Select...</option><option value="Single Family Residential">Single Family Residential</option><option value="Multi-Family Residential">Multi-Family Residential</option><option value="Commercial">Commercial</option><option value="Land">Land</option></select></div>
                                <div><label className="text-xs text-gray-500 block mb-1">Year Built</label><input type="number" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-sm" value={deal.yearBuilt || ''} onChange={e => updateDealState({yearBuilt: Number(e.target.value)})} onBlur={handleAutoSave} /></div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div><label className="text-xs text-gray-500 block mb-1">Bedrooms</label><input type="number" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-sm" value={deal.bedrooms || ''} onChange={e => updateDealState({bedrooms: Number(e.target.value)})} onBlur={handleAutoSave} /></div>
                                <div><label className="text-xs text-gray-500 block mb-1">Bathrooms</label><input type="number" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-sm" value={deal.bathrooms || ''} onChange={e => updateDealState({bathrooms: Number(e.target.value)})} onBlur={handleAutoSave} /></div>
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Property Sqft</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-sm" 
                                        value={formatNumberWithCommas(deal.sqft) || ''} 
                                        onChange={e => updateDealState({sqft: parseNumberFromCurrency(e.target.value)})} 
                                        onBlur={handleAutoSave}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Lot Sqft</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-sm" 
                                        value={formatNumberWithCommas(deal.lotSqft) || ''} 
                                        onChange={e => updateDealState({lotSqft: parseNumberFromCurrency(e.target.value)})} 
                                        onBlur={handleAutoSave}
                                        placeholder="e.g. 8,000" 
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div><label className="text-xs text-gray-500 block mb-1">Date Listed</label><input type="date" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-sm date-input-icon" value={deal.dateListed || ''} onChange={e => { updateDealState({dateListed: e.target.value}); if(onUpdate) onUpdate(deal.id, {dateListed: e.target.value}); triggerSave(); }} /></div>
                                <div><label className="text-xs text-gray-500 block mb-1">Zoning</label><input className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-sm" value={deal.zoning || ''} onChange={e => updateDealState({zoning: e.target.value})} onBlur={handleAutoSave} placeholder="e.g. R-1" /></div>
                                <div><label className="text-xs text-gray-500 block mb-1">County</label><select className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-sm" value={deal.county || ''} onChange={e => { updateDealState({county: e.target.value}); if(onUpdate) onUpdate(deal.id, {county: e.target.value}); triggerSave(); }}><option value="">Select...</option>{COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                                <div><label className="text-xs text-gray-500 block mb-1">Lock Box Code</label><input className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-sm" value={deal.lockBoxCode || ''} onChange={e => updateDealState({lockBoxCode: e.target.value})} onBlur={handleAutoSave} placeholder="1234" /></div>
                            </div>
                            <div><label className="text-xs text-gray-500 block mb-1 font-bold uppercase">Deal Description</label><textarea className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-3 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none h-48 resize-none" value={deal.listingDescription || ''} onChange={e => updateDealState({listingDescription: e.target.value})} onBlur={handleAutoSave} placeholder="Paste full property description here..." /></div>
                       </div>
                   </div>

                   {/* Rest of the sections remain unchanged */}
                   <div className="grid md:grid-cols-2 gap-8">
                       {/* Wholesaler Contact & Workflow Grid ... */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><User size={14}/> Wholesaler Contact</h3>
                                {wholesaler1 && <button type="button" onClick={() => onViewWholesaler(wholesaler1.id)} className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-1">Profile <ArrowRight size={10} className="-rotate-45"/></button>}
                            </div>
                            <div className="space-y-3">
                                <WholesalerSlot slotIndex={1} agent={wholesaler1} allWholesalers={wholesalers} onSelect={handleSelectWholesaler1} onClear={handleClearWholesaler1} onViewProfile={(agent) => onViewWholesaler(agent.id)} onUpdate={onUpdateWholesaler} customNameValue={deal.agentName} onCustomNameChange={(val) => updateDealState({agentName: val})} onGenerateEmail={handleGenerateEmail} onAddNewWholesaler={onAddNewWholesaler} onBlur={handleAutoSave} />
                                <WholesalerSlot slotIndex={2} agent={wholesaler2} allWholesalers={wholesalers} onSelect={handleSelectWholesaler2} onClear={() => { updateDealState({secondAgentId: undefined}); triggerSave(); }} onViewProfile={(agent) => onViewWholesaler(agent.id)} onUpdate={onUpdateWholesaler} onGenerateEmail={handleGenerateEmail} onAddNewWholesaler={onAddNewWholesaler} onBlur={handleAutoSave} />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700 pb-2 mb-4 flex items-center gap-2"><h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><Activity size={14}/> Workflow & Strategy</h3></div>
                            <div className="space-y-4">
                                <div><label className="text-[10px] text-gray-500 block mb-1 uppercase font-bold">Pipeline Status</label><select className="w-full bg-gray-50 dark:bg-gray-800 border border-blue-500/30 rounded p-2 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none font-medium" value={deal.offerDecision || ''} onChange={e => { 
    const newStatus = e.target.value;
    const updates: any = { offerDecision: newStatus };
    const now = new Date().toISOString();
    if (UNDER_CONTRACT_STATUSES.includes(newStatus) && !UNDER_CONTRACT_STATUSES.includes(deal.offerDecision)) updates.underContractDate = now;
    if (CLOSED_STATUSES.includes(newStatus) && !CLOSED_STATUSES.includes(deal.offerDecision)) updates.closedDate = now;
    if (DECLINED_STATUSES.includes(newStatus) && !DECLINED_STATUSES.includes(deal.offerDecision)) updates.declinedDate = now;
    updateDealState(updates); 
    if(onUpdate) onUpdate(deal.id, updates);
    triggerSave(); 
}}><option disabled>-- Pipeline Status --</option><option value="Available">Available</option><option value="No Longer Available">No Longer Available</option></select></div>
                                <div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] text-gray-500 block mb-1 uppercase font-bold">Contact Status</label><select className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-xs" value={deal.contactStatus || ''} onChange={e => { updateDealState({contactStatus: e.target.value}); if(onUpdate) onUpdate(deal.id, {contactStatus: e.target.value}); triggerSave(); }}><option value="Have Not Spoken With Wholesaler">Have Not Spoken With Wholesaler</option><option value="Spoke With Wholesaler">Spoke With Wholesaler</option></select></div><div><label className="text-[10px] text-gray-500 block mb-1 uppercase font-bold">Acq. Manager</label><select className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-xs" value={deal.acquisitionManager || ""} onChange={e => { updateDealState({acquisitionManager: e.target.value}); if(onUpdate) onUpdate(deal.id, {acquisitionManager: e.target.value}); triggerSave(); }}><option value="" disabled>Unassigned</option><option value="Ashari Zakar">Ashari Zakar</option><option value="Angelica Henderson">Angelica Henderson</option><option value="Grias Ramos">Grias Ramos</option></select></div></div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-200 dark:border-gray-800/50">
                                    <div>
                                        <label className="text-[10px] text-gray-500 block mb-1 uppercase font-bold">Deal Strategy (Multi-Select)</label>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {['Renovation', 'Rental', 'New Construction', 'Wholesale'].map(type => (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    onClick={() => toggleDealType(type)}
                                                    className={`px-2 py-1.5 rounded border text-[10px] font-bold transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1 ${
                                                        currentDealTypes.includes(type)
                                                            ? 'bg-blue-600 text-white border-blue-600'
                                                            : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-300 dark:border-gray-700'
                                                    }`}
                                                >
                                                    {type}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div><label className="text-[10px] text-gray-500 block mb-1 uppercase font-bold">Interest Level</label><select className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-sm" value={deal.interestLevel || ''} onChange={e => { updateDealState({interestLevel: e.target.value}); if(onUpdate) onUpdate(deal.id, {interestLevel: e.target.value}); triggerSave(); }}><option value="">Interest...</option><option value="High">High</option><option value="Mild">Mild</option><option value="Not Interested">Not Interested</option></select></div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] text-gray-500 block mb-1 uppercase font-bold">Inspection Ends</label>
                                        <input type="date" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-xs" value={deal.inspectionDate || ''} onChange={(e) => { updateDealState({ inspectionDate: e.target.value }); if(onUpdate) onUpdate(deal.id, {inspectionDate: e.target.value}); triggerSave(); }} />
                                        <div className="mt-2 p-3 rounded border border-blue-500/50 bg-blue-50/50 dark:bg-blue-900/20 flex flex-col items-center justify-center">
                                            <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Time Remaining</span>
                                            <span className={`text-lg font-bold ${getUrgencyColor(daysToInsp)}`}>
                                                {daysToInsp !== null ? `${daysToInsp} Days` : 'Not Set'}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-500 block mb-1 uppercase font-bold">EMD Due</label>
                                        <input type="date" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-xs" value={deal.emdDate || ''} onChange={(e) => { updateDealState({ emdDate: e.target.value }); if(onUpdate) onUpdate(deal.id, {emdDate: e.target.value}); triggerSave(); }} />
                                        <div className="mt-2 p-3 rounded border border-blue-500/50 bg-blue-50/50 dark:bg-blue-900/20 flex flex-col items-center justify-center">
                                            <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Time Remaining</span>
                                            <span className={`text-lg font-bold ${getUrgencyColor(daysToEMD)}`}>
                                                {daysToEMD !== null ? `${daysToEMD} Days` : 'Not Set'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                   </div>

                   {/* Financials Section */}
                   <div className="space-y-4">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-800"><DollarSign size={14}/> Financials</h3>
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700/50">
                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1">Current Asking Price</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-3 text-gray-400 text-lg font-light">$</span>
                                            <input type="text" className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-3 pl-8 text-gray-900 dark:text-white text-xl font-bold" value={formatNumberWithCommas(deal.listPrice) || ''} onChange={e => {
                                                const val = parseNumberFromCurrency(e.target.value);
                                                const original = deal.originalAskingPrice || 0;
                                                const current = deal.listPrice || 0;
                                                let updates: Partial<Deal> = { listPrice: val };
                                                
                                                if (original > 0 && val < original) {
                                                    if (deal.priceReductionAlert === 'Asking Price Has Been Reduced' && val < current) {
                                                        updates.priceReductionAlert = 'Price Reduced Multiple Times';
                                                    } 
                                                    else if (deal.priceReductionAlert !== 'Price Reduced Multiple Times') {
                                                        updates.priceReductionAlert = 'Asking Price Has Been Reduced';
                                                    }
                                                }
                                                updateDealState(updates);
                                            }} onBlur={handleAutoSave} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1">Original Asking Price</label>
                                            <div className="relative">
                                                <span className="absolute left-2 top-2 text-gray-400">$</span>
                                                <input type="text" className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-2 pl-6 text-gray-900 dark:text-white text-sm" value={formatNumberWithCommas(deal.originalAskingPrice) || ''} onChange={e => {
                                                        const val = parseNumberFromCurrency(e.target.value);
                                                        let updates: Partial<Deal> = { originalAskingPrice: val };
                                                        updateDealState(updates);
                                                    }} onBlur={handleAutoSave} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1">Price Alert</label>
                                            <select className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-sm" value={deal.priceReductionAlert || ''} onChange={e => { updateDealState({priceReductionAlert: e.target.value}); if(onUpdate) onUpdate(deal.id, {priceReductionAlert: e.target.value}); triggerSave(); }}><option value="">None</option><option value="Asking Price Has Been Reduced">Asking Price Has Been Reduced</option><option value="Price Reduced Multiple Times">Price Reduced Multiple Times</option></select>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-8 mt-2">
                                        {priceDropPercent > 0 && (<div className="animate-in fade-in slide-in-from-top-2"><div className="text-3xl font-black text-red-600 dark:text-red-500 flex items-center gap-2"><TrendingDown size={32} />{priceDropPercent.toFixed(1)}% <span className="text-lg font-medium text-gray-500 dark:text-gray-400 self-end mb-1">Reduction</span></div></div>)}
                                        {daysOnMarket !== null && (<div className="animate-in fade-in slide-in-from-top-2"><div className="text-3xl font-black text-gray-700 dark:text-gray-200 flex items-center gap-2"><Clock size={32} className="text-gray-400 dark:text-gray-500" />{daysOnMarket} <span className="text-lg font-medium text-gray-500 dark:text-gray-400 self-end mb-1">Days on Market</span></div></div>)}
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div><label className="text-xs text-green-600 dark:text-green-500 block mb-1 font-bold">My Cash Offer</label><div className="relative"><span className="absolute left-3 top-3 text-green-600 dark:text-green-500 text-lg font-bold">$</span><input type="text" className="w-full bg-white dark:bg-gray-900 border border-green-200 dark:border-green-800/50 rounded p-3 pl-8 text-green-600 dark:text-green-400 text-xl font-bold" value={formatNumberWithCommas(deal.offerPrice) || ''} onChange={e => updateDealState({offerPrice: parseNumberFromCurrency(e.target.value)})} onBlur={handleAutoSave} placeholder="Enter Amount" /></div></div>
                                    <div className="grid grid-cols-2 gap-4"><div><label className="text-xs text-green-600 dark:text-green-500 block mb-1 font-bold">Accepted Asking Price</label><div className="relative"><span className="absolute left-2 top-2 text-green-600 dark:text-green-500">$</span><input type="text" className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-2 pl-6 text-green-600 dark:text-green-400 text-sm font-bold" value={formatNumberWithCommas(deal.negotiatedAskingPrice) || ''} onChange={e => updateDealState({negotiatedAskingPrice: parseNumberFromCurrency(e.target.value)})} onBlur={handleAutoSave} /></div></div><div><label className="text-xs text-blue-600 dark:text-blue-400 block mb-1 font-bold">Estimated Wholesale Profit</label><div className="relative"><span className="absolute left-2 top-2 text-blue-600 dark:text-blue-500 font-bold">$</span><input type="text" className="w-full bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-900/50 rounded p-2 pl-6 text-blue-600 dark:text-blue-400 font-bold text-sm" value={formatNumberWithCommas(deal.desiredWholesaleProfit) || ''} onChange={e => updateDealState({desiredWholesaleProfit: parseNumberFromCurrency(e.target.value)})} onBlur={handleAutoSave} /></div></div></div>
                                    <div className="grid grid-cols-2 gap-4"><div><label className="text-xs text-gray-500 block mb-1">Safe Offer Amount</label><div className="relative"><span className="absolute left-2 top-2 text-gray-400">$</span><input disabled type="text" className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 pl-6 text-gray-700 dark:text-gray-300 text-sm" value={formatNumberWithCommas(safeOfferAmount)} /></div></div><div><label className="text-xs text-gray-500 block mb-1">SureCash Offer (List - $70k)</label><div className="relative"><span className="absolute left-2 top-2 text-gray-400">$</span><input disabled type="text" className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 pl-6 text-gray-700 dark:text-gray-300 text-sm" value={formatNumberWithCommas(sureCashOfferAmount > 0 ? sureCashOfferAmount : 0)} /></div></div></div>
                                </div>
                            </div>
                            <div className="h-px bg-gray-200 dark:bg-gray-700/50 w-full my-6"></div>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800"><h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><TrendingUp size={12}/> Valuation & Comparables</h4></div>
                                <div className="grid grid-cols-2 gap-4 mb-4"><div><label className="text-xs text-gray-500 block mb-1 font-bold">Renovation ARV</label><div className="relative"><span className="absolute left-4 top-4 text-green-600 dark:text-green-500 text-xl font-bold">$</span><input type="text" className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-4 pl-10 text-green-600 dark:text-green-400 placeholder-green-600 dark:placeholder-green-400 text-2xl font-bold focus:border-green-500 outline-none transition-colors" value={formatNumberWithCommas(deal.renovationARV) || ''} onChange={e => updateDealState({renovationARV: parseNumberFromCurrency(e.target.value)})} onBlur={handleAutoSave} placeholder="0" /></div></div><div><label className="text-xs text-gray-500 block mb-1 font-bold">Renovation Estimate</label><div className="relative"><span className="absolute left-4 top-4 text-gray-400 dark:text-gray-500 text-xl font-bold">$</span><input type="text" className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-4 pl-10 text-gray-900 dark:text-white placeholder-gray-900 dark:placeholder-white text-2xl font-bold focus:border-blue-500 outline-none transition-colors" value={formatNumberWithCommas(deal.renovationEstimate) || ''} onChange={e => updateDealState({renovationEstimate: parseNumberFromCurrency(e.target.value)})} onBlur={handleAutoSave} placeholder="0" /></div></div></div>
                                <div className="grid grid-cols-2 gap-4 mb-4"><div><label className="text-xs text-gray-500 block mb-1 font-bold">New Construction ARV</label><div className="relative"><span className="absolute left-4 top-4 text-green-600 dark:text-green-500 text-xl font-bold">$</span><input type="text" className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-4 pl-10 text-green-600 dark:text-green-400 placeholder-green-600 dark:placeholder-green-400 text-2xl font-bold focus:border-green-500 outline-none transition-colors" value={formatNumberWithCommas(deal.newConstructionARV) || ''} onChange={e => updateDealState({newConstructionARV: parseNumberFromCurrency(e.target.value)})} onBlur={handleAutoSave} placeholder="0" /></div></div><div><label className="text-xs text-gray-500 block mb-1 font-bold">New Construction Estimate</label><div className="relative"><span className="absolute left-4 top-4 text-gray-400 dark:text-gray-500 text-xl font-bold">$</span><input type="text" className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-4 pl-10 text-gray-900 dark:text-white placeholder-gray-900 dark:placeholder-white text-2xl font-bold focus:border-blue-500 outline-none transition-colors" value={formatNumberWithCommas(deal.newConstructionEstimate) || ''} onChange={e => updateDealState({newConstructionEstimate: parseNumberFromCurrency(e.target.value)})} onBlur={handleAutoSave} placeholder="0" /></div></div></div>
                                <label className="text-xs text-gray-500 block mb-1 font-bold uppercase tracking-wider">Renovation Comps</label>
                                <div className="space-y-3 bg-gray-50 dark:bg-gray-900/50 p-3 rounded border border-gray-200 dark:border-gray-800">
                                    <div className="grid grid-cols-12 gap-2 text-[10px] text-gray-500 uppercase font-bold">
                                            <div className="col-span-1 flex items-center">#</div>
                                            <div className="col-span-3">Address</div>
                                            <div className="col-span-1">Sqft</div>
                                            <div className="col-span-2">Sale Date</div>
                                            <div className="col-span-2">Price</div>
                                            <div className="col-span-1">Softener %</div>
                                            <div className="col-span-2">Softener ARV</div>
                                    </div>
                                    {[1, 2, 3].map((num) => { 
                                        const compKey = `renovationComparable${num}` as 'renovationComparable1' | 'renovationComparable2' | 'renovationComparable3'; 
                                        const comp = deal[compKey] || { address: '', saleDate: '', salePrice: 0, sqft: 0, softenerPercent: 0 }; 
                                        const softenerArv = Math.round(getSoftenerArv(comp));
                                        return (
                                            <div key={num} className="grid grid-cols-12 gap-2 items-center">
                                                <div className="col-span-1 text-xs text-gray-500 font-bold">Comp {num}</div>
                                                <div className="col-span-3">
                                                    <input className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-1.5 text-gray-900 dark:text-white text-xs" placeholder="Address" value={comp.address || ''} onChange={(e) => updateComp(compKey, 'address', e.target.value)} onBlur={handleAutoSave} />
                                                </div>
                                                <div className="col-span-1">
                                                    <input 
                                                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-1.5 text-gray-900 dark:text-white text-xs" 
                                                        placeholder="Sqft" 
                                                        value={formatNumberWithCommas(comp.sqft) || ''} 
                                                        onChange={(e) => updateComp(compKey, 'sqft', parseNumberFromCurrency(e.target.value))} 
                                                        onBlur={handleAutoSave} 
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <input className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-1.5 text-gray-900 dark:text-white text-xs" placeholder="Date" value={comp.saleDate || ''} onChange={(e) => updateComp(compKey, 'saleDate', e.target.value)} onBlur={handleAutoSave} />
                                                </div>
                                                <div className="col-span-2 relative">
                                                    <span className="absolute left-2 top-1.5 text-gray-400 text-xs">$</span>
                                                    <input className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-1.5 pl-5 text-gray-900 dark:text-white text-xs" placeholder="Price" value={comp.salePrice ? formatNumberWithCommas(comp.salePrice) : ''} onChange={(e) => updateComp(compKey, 'salePrice', parseNumberFromCurrency(e.target.value))} onBlur={handleAutoSave} />
                                                </div>
                                                <div className="col-span-1 relative">
                                                    <input className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-1.5 pr-4 text-gray-900 dark:text-white text-xs" placeholder="%" value={comp.softenerPercent || ''} onChange={(e) => updateComp(compKey, 'softenerPercent', parseNumberFromCurrency(e.target.value))} onBlur={handleAutoSave} />
                                                    <span className="absolute right-2 top-1.5 text-gray-400 text-xs">%</span>
                                                </div>
                                                <div className="col-span-2 relative">
                                                    <span className="absolute left-2 top-1.5 text-gray-400 text-xs">$</span>
                                                    <input disabled className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-1.5 pl-5 text-gray-700 dark:text-gray-300 text-xs" placeholder="ARV" value={softenerArv ? formatNumberWithCommas(softenerArv) : ''} />
                                                </div>
                                            </div>
                                        ); 
                                    })}
                                </div>
                            </div>
                        </div>
                   </div>

                   {/* Activity Log Section */}
                   <div className="space-y-4">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-800"><FileText size={14}/> Activity Log</h3>
                        <div className="bg-gray-50 dark:bg-black/20 rounded border border-gray-200 dark:border-gray-800 p-4 h-48 overflow-y-auto space-y-2">
                            {deal.logs && deal.logs.length > 0 ? (deal.logs.map((log, idx) => { 
                                const logText = typeof log === 'string' ? log : JSON.stringify(log); 
                                return (
                                    <div key={idx} className="flex flex-col gap-2 border-b border-gray-100 dark:border-gray-800/50 pb-2 last:border-0 last:pb-0 group relative">
                                        {editingLogIndex === idx ? (
                                            <div className="flex flex-col gap-2 w-full">
                                                <textarea
                                                    className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-sm focus:border-blue-500 outline-none resize-none"
                                                    value={editLogValue}
                                                    onChange={(e) => setEditLogValue(e.target.value)}
                                                    rows={3}
                                                    autoFocus
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <button 
                                                        type="button"
                                                        onClick={() => setEditingLogIndex(null)}
                                                        className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleSaveLogEdit(idx)}
                                                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
                                                    >
                                                        Save
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex justify-between items-start gap-3">
                                                <div className="flex-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{logText}</div>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        type="button" 
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setEditingLogIndex(idx);
                                                            setEditLogValue(logText);
                                                        }} 
                                                        className="text-gray-400 hover:text-blue-500 p-1"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button 
                                                        type="button" 
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            handleDeleteLog(idx);
                                                        }} 
                                                        className="text-gray-400 hover:text-red-500 p-1"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ); 
                            })) : (<div className="text-gray-400 dark:text-gray-500 italic text-sm text-center py-4">No logs yet. Add a note below.</div>)}
                        </div>
                        <div className="flex gap-2">
                            <input 
                                placeholder="Type a new note..." 
                                className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-3 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none" 
                                value={tempLogValue} 
                                onChange={(e) => setTempLogValue(e.target.value)} 
                                onBlur={() => { if(tempLogValue.trim()) handleAddLog(); }}
                                onKeyDown={(e) => { 
                                    if (e.key === 'Enter') { 
                                        e.preventDefault(); 
                                        handleAddLog();
                                    } 
                                }} 
                            />
                            <button type="button" onClick={handleAddLog} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded font-medium text-sm transition-colors">Add Note</button>
                        </div>
                   </div>

                 </form>
              </div>
              
              <ModalFooter 
                onClose={handleCloseClick} 
                onSave={() => triggerSave()}
                saveLabel="Save"
                closeLabel="Close"
                showSaveButton={false}
              />
          </div>
          
          {/* Unsaved Changes Warning Modal using Shared Component */}
          {showUnsavedWarning && (
            <UnsavedChangesModal 
                selectedOption={warningSelectedOption}
                onDiscard={() => {
                    setShowUnsavedWarning(false);
                    if (pendingNavigation) {
                        onNavigate(pendingNavigation);
                        setPendingNavigation(null);
                    } else {
                        onClose(undefined);
                    }
                }}
                onSave={() => {
                    triggerSave();
                    if (pendingNavigation) {
                        onNavigate(pendingNavigation);
                        setPendingNavigation(null);
                    } else {
                        onClose(undefined);
                    }
                    setShowUnsavedWarning(false);
                }}
            />
          )}

          {showEmailModal && (
            <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl max-w-5xl w-full flex flex-col h-[95vh] max-h-[95vh]" onClick={(e) => e.stopPropagation()}>
                    <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Send LOI</h3>
                        <button onClick={() => setShowEmailModal(false)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white"><X size={20}/></button>
                    </div>
                    <div className="p-6 flex-1 overflow-y-auto space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">From Email</label>
                                <select 
                                    className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-sm"
                                    value={selectedFromEmail}
                                    onChange={(e) => setSelectedFromEmail(e.target.value)}
                                >
                                    {availableEmails.map(emailObj => (
                                        <option key={emailObj.id} value={emailObj.email}>{emailObj.email}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Template</label>
                                <select 
                                    className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-sm"
                                    value={selectedTemplateId}
                                    onChange={(e) => handleTemplateSelect(e.target.value)}
                                >
                                    <option value="">-- Custom Email --</option>
                                    {mockOfferTemplates.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Subject Line</label>
                            <input 
                                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-sm"
                                value={emailSubject}
                                onChange={(e) => setEmailSubject(e.target.value)}
                            />
                        </div>
                        <div className="flex-1 flex flex-col">
                            <label className="text-xs text-gray-500 block mb-1 uppercase font-bold">Email Body</label>
                            <div className="w-full flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded overflow-hidden flex flex-col">
                                <ReactQuill
                                    theme="snow"
                                    value={emailContent}
                                    onChange={setEmailContent}
                                    className="h-[550px] mb-10"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-3">
                        {emailStatus && (
                            <div className={`p-3 rounded-lg text-sm font-medium flex items-start gap-2 ${emailStatus.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
                                {emailStatus.type === 'error' ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : <CheckCircle size={16} className="mt-0.5 shrink-0" />}
                                <span>{emailStatus.message}</span>
                            </div>
                        )}
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowEmailModal(false)} className="px-4 py-2 rounded text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm">Close</button>
                            <button 
                                onClick={handleSendLOI} 
                                disabled={isSendingEmail}
                                className="bg-blue-600 hover:bg-blue-50 text-white px-6 py-2 rounded font-bold flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSendingEmail ? <Loader2 size={16} className="animate-spin" /> : <Send size={16}/>} 
                                {isSendingEmail ? 'Sending...' : 'Send LOI'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {showBuyerMatch && (
            <BuyerMatchModal 
                deal={deal} 
                buyers={buyers} 
                onClose={() => setShowBuyerMatch(false)}
                onViewBuyer={(id) => {
                    if (onViewBuyer) onViewBuyer(id);
                }}
            />
        )}

        {activeGalleryIndex !== null && lightboxImages[activeGalleryIndex] && (
            <div className="fixed inset-0 z-[130] bg-black/95 flex items-center justify-center p-4 backdrop-blur-md" onClick={(e) => {
                e.stopPropagation();
                setActiveGalleryIndex(null);
            }}>
                <button className="absolute top-4 right-4 text-white/70 hover:text-white p-2 bg-white/10 rounded-full transition-colors z-[140]" onClick={(e) => {
                    e.stopPropagation();
                    setActiveGalleryIndex(null);
                }}>
                    <X size={32} />
                </button>
                
                <button 
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all hidden md:flex z-[140]"
                    onClick={(e) => {
                        e.stopPropagation();
                        setActiveGalleryIndex(prev => {
                            if (prev === null) return null;
                            return prev > 0 ? prev - 1 : lightboxImages.length - 1;
                        });
                    }}
                >
                    <ChevronLeft size={32} />
                </button>
                
                <button 
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all hidden md:flex z-[140]"
                    onClick={(e) => {
                        e.stopPropagation();
                        setActiveGalleryIndex(prev => {
                            if (prev === null) return null;
                            return prev < lightboxImages.length - 1 ? prev + 1 : 0;
                        });
                    }}
                >
                    <ChevronRight size={32} />
                </button>

                <div className="relative max-w-7xl w-full h-full flex flex-col items-center justify-center pointer-events-none">
                    <img 
                        src={lightboxImages[activeGalleryIndex]}
                        alt="Full View"
                        className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl pointer-events-auto"
                        referrerPolicy="no-referrer"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <div className="mt-4 text-white/80 font-medium text-sm pointer-events-auto bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">
                        {activeGalleryIndex + 1} / {lightboxImages.length}
                    </div>
                </div>
            </div>
        )}
        </div>
    );
}
