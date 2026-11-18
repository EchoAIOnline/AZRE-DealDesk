import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useMap, useMapsLibrary, ControlPosition, MapControl, useAdvancedMarkerRef } from '@vis.gl/react-google-maps';
import { GOOGLE_MAPS_API_KEY } from '../../constants';
import { PageNavBar } from '../Shared/PageNavBar';
import { Deal, OffMarketProperty } from '../../types';
import { supabase } from '../../services/api';
import { formatCurrency } from '../../services/utils';
import { OffMarketPropertyModal } from './OffMarketPropertyModal';
import { ImportOffMarketPropertiesModal } from './ImportOffMarketPropertiesModal';
import {
    OffMarketPropertiesListModal,
    normalizeOffMarketLists,
} from './OffMarketPropertiesListModal';
import {
    Layout,
    Locate,
    Loader2,
    Navigation,
    AlertCircle,
    Search,
    MapPin,
    ChevronRight,
    ChevronLeft,
    RefreshCw,
    Home,
    BedDouble,
    Bath,
    Ruler,
    User,
    X,
    List,
    Trash2,
    Star,
    ListChecks,
    ListPlus,
    Phone,
    RotateCcw,
} from 'lucide-react';

interface DFDScouterMapProps {
    handleAddDeal: (overrides?: Partial<Deal>) => void;
    globalSearchQuery?: string;
}

export const DFDScouterMap: React.FC<DFDScouterMapProps> = ({ handleAddDeal }) => {
    const [search, setSearch] = useState('');
    const [triggerSearch, setTriggerSearch] = useState<string | null>(null);
    const [locateRequest, setLocateRequest] = useState<{ address: string; id: number } | null>(null);

    const [offMarketProperties, setOffMarketProperties] = useState<OffMarketProperty[]>([]);
    const [isLoadingProperties, setIsLoadingProperties] = useState(true);
    const [propertiesError, setPropertiesError] = useState<string | null>(null);
    const [isListOpen, setIsListOpen] = useState(true);
    const [propertyTab, setPropertyTab] = useState<'All Properties' | 'Interested' | 'Trash'>('All Properties');
    const [listSearch, setListSearch] = useState('');
    const [selectedProperty, setSelectedProperty] = useState<OffMarketProperty | null>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [restoringId, setRestoringId] = useState<number | null>(null);
    const [togglingInterestedId, setTogglingInterestedId] = useState<number | null>(null);
    const [isListsModalOpen, setIsListsModalOpen] = useState(false);
    const [listTargetProperty, setListTargetProperty] = useState<OffMarketProperty | null>(null);
    const [customLists, setCustomLists] = useState<string[]>(() => {
        try {
            const raw = localStorage.getItem('azre_off_market_custom_lists');
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string' && x.trim()) : [];
        } catch {
            return [];
        }
    });

    const fetchOffMarketProperties = useCallback(async () => {
        setIsLoadingProperties(true);
        setPropertiesError(null);
        try {
            const { data, error } = await supabase
                .from('OffMarketProperties')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }
            setOffMarketProperties((data as OffMarketProperty[]) || []);
        } catch (err: any) {
            console.error('Failed to fetch OffMarketProperties:', err);
            setPropertiesError(err?.message || 'Unable to load Off-Market Properties.');
        } finally {
            setIsLoadingProperties(false);
        }
    }, []);

    useEffect(() => {
        fetchOffMarketProperties();
    }, [fetchOffMarketProperties]);

    const isInterestedProperty = useCallback((p: OffMarketProperty) => {
        return p['Interested'] === true;
    }, []);

    const isTrashedProperty = useCallback((p: OffMarketProperty) => {
        return p['Trash'] === true;
    }, []);

    const searchFilteredProperties = useMemo(() => {
        const q = listSearch.trim().toLowerCase();
        if (!q) return offMarketProperties;
        return offMarketProperties.filter((p) => {
            const haystack = [
                p['Address'],
                p['City'],
                p['State'],
                p['Zip'],
                p['County'],
                p['Subdivision'],
                p['Status'],
                p['Property Type'],
                p['Owner 1 First Name'],
                p['Owner 1 Last Name'],
                p['Owner 2 First Name'],
                p['Owner 2 Last Name'],
            ]
                .filter((v) => v !== null && v !== undefined && v !== '')
                .join(' ')
                .toLowerCase();
            return haystack.includes(q);
        });
    }, [offMarketProperties, listSearch]);

    const activeSearchFilteredProperties = useMemo(
        () => searchFilteredProperties.filter((p) => !isTrashedProperty(p)),
        [searchFilteredProperties, isTrashedProperty]
    );

    const interestedPropertiesCount = useMemo(
        () => activeSearchFilteredProperties.filter(isInterestedProperty).length,
        [activeSearchFilteredProperties, isInterestedProperty]
    );

    const trashedPropertiesCount = useMemo(
        () => searchFilteredProperties.filter(isTrashedProperty).length,
        [searchFilteredProperties, isTrashedProperty]
    );

    const filteredProperties = useMemo(() => {
        if (propertyTab === 'Trash') {
            return searchFilteredProperties.filter(isTrashedProperty);
        }
        if (propertyTab === 'Interested') {
            return activeSearchFilteredProperties.filter(isInterestedProperty);
        }
        return activeSearchFilteredProperties;
    }, [
        searchFilteredProperties,
        activeSearchFilteredProperties,
        propertyTab,
        isInterestedProperty,
        isTrashedProperty,
    ]);

    const selectedIndex = useMemo(() => {
        if (!selectedProperty) return -1;
        return filteredProperties.findIndex((p) => p.id === selectedProperty.id);
    }, [filteredProperties, selectedProperty]);

    const handleSaveProperty = async (updated: OffMarketProperty) => {
        const { id, ...fieldsToUpdate } = updated;
        const { data, error } = await supabase
            .from('OffMarketProperties')
            .update(fieldsToUpdate)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new Error(error.message || 'Failed to update property in Supabase.');
        }

        const saved = (data as OffMarketProperty) || updated;
        setOffMarketProperties((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
        setSelectedProperty(saved);
    };

    const handleDeleteProperty = async (id: number) => {
        if (id === undefined || id === null) {
            throw new Error('Cannot delete property: missing record ID.');
        }
        const target = offMarketProperties.find((p) => p.id === id);
        const isAlreadyTrashed = target ? isTrashedProperty(target) : false;

        setDeletingId(id);
        setPropertiesError(null);
        try {
            if (!isAlreadyTrashed) {
                const { data, error } = await supabase
                    .from('OffMarketProperties')
                    .update({ Trash: true })
                    .eq('id', id)
                    .select()
                    .single();

                if (error) {
                    throw new Error(error.message || 'Failed to move property to Trash in Supabase.');
                }

                const saved = (data as OffMarketProperty) || (target ? { ...target, Trash: true } : null);
                if (saved) {
                    setOffMarketProperties((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
                }
                setSelectedProperty((prev) => (prev && prev.id === id ? null : prev));
                setConfirmDeleteId((prev) => (prev === id ? null : prev));
                return;
            }

            const { data, error } = await supabase
                .from('OffMarketProperties')
                .delete()
                .eq('id', id)
                .select('id');

            if (error) {
                throw new Error(error.message || 'Failed to delete property from Supabase.');
            }

            if (!data || data.length === 0) {
                throw new Error(
                    'Supabase did not delete this record (0 rows affected). Please ensure RLS is disabled or a DELETE policy is enabled on the OffMarketProperties table in Supabase.'
                );
            }

            setOffMarketProperties((prev) => prev.filter((p) => p.id !== id));
            setSelectedProperty((prev) => (prev && prev.id === id ? null : prev));
            setConfirmDeleteId((prev) => (prev === id ? null : prev));
        } finally {
            setDeletingId(null);
        }
    };

    const handleRestoreProperty = async (id: number) => {
        if (id === undefined || id === null) return;
        const target = offMarketProperties.find((p) => p.id === id);
        setRestoringId(id);
        setPropertiesError(null);
        try {
            const { data, error } = await supabase
                .from('OffMarketProperties')
                .update({ Trash: false })
                .eq('id', id)
                .select()
                .single();

            if (error) {
                throw new Error(error.message || 'Failed to restore property from Trash in Supabase.');
            }

            const saved = (data as OffMarketProperty) || (target ? { ...target, Trash: false } : null);
            if (saved) {
                setOffMarketProperties((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
            }
            setSelectedProperty((prev) => (prev && prev.id === id ? null : prev));
            setConfirmDeleteId((prev) => (prev === id ? null : prev));
        } finally {
            setRestoringId(null);
        }
    };

    const handleToggleInterested = async (prop: OffMarketProperty) => {
        const nextValue = !(prop['Interested'] === true);
        setTogglingInterestedId(prop.id);
        setPropertiesError(null);
        try {
            const { data, error } = await supabase
                .from('OffMarketProperties')
                .update({ Interested: nextValue })
                .eq('id', prop.id)
                .select()
                .single();

            if (error) {
                throw new Error(error.message || 'Failed to update Interested status in Supabase.');
            }

            const saved = (data as OffMarketProperty) || { ...prop, Interested: nextValue };
            setOffMarketProperties((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
            setSelectedProperty((prev) => (prev && prev.id === saved.id ? saved : prev));
        } finally {
            setTogglingInterestedId(null);
        }
    };

    const persistCustomLists = (next: string[]) => {
        setCustomLists(next);
        try {
            localStorage.setItem('azre_off_market_custom_lists', JSON.stringify(next));
        } catch {
            // ignore storage errors
        }
    };

    const handleCreateCustomList = (listName: string) => {
        const trimmed = listName.trim();
        if (!trimmed) return;
        if (customLists.some((l) => l.toLowerCase() === trimmed.toLowerCase())) return;
        persistCustomLists([...customLists, trimmed]);
    };

    const handleUpdatePropertyLists = async (prop: OffMarketProperty, nextLists: string[]) => {
        const cleaned = Array.from(new Set(nextLists.map((l) => l.trim()).filter(Boolean)));
        const dbValue = cleaned.length > 0 ? cleaned : null;

        const { data, error } = await supabase
            .from('OffMarketProperties')
            .update({ 'Off Market List': dbValue })
            .eq('id', prop.id)
            .select()
            .single();

        if (error) {
            throw new Error(error.message || 'Failed to update Off Market List in Supabase.');
        }

        const saved = (data as OffMarketProperty) || { ...prop, 'Off Market List': dbValue };
        setOffMarketProperties((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
        setSelectedProperty((prev) => (prev && prev.id === saved.id ? saved : prev));
        setListTargetProperty((prev) => (prev && prev.id === saved.id ? saved : prev));
    };

    const handleDeleteCustomList = async (listName: string) => {
        const affected = offMarketProperties.filter((p) =>
            normalizeOffMarketLists(p['Off Market List']).includes(listName)
        );

        for (const prop of affected) {
            const remaining = normalizeOffMarketLists(prop['Off Market List']).filter(
                (l) => l !== listName
            );
            await handleUpdatePropertyLists(prop, remaining);
        }

        persistCustomLists(customLists.filter((l) => l !== listName));
    };

    const handleOpenAddToList = (prop: OffMarketProperty) => {
        setListTargetProperty(prop);
    };

    const handleLocateProperty = (address: string) => {
        if (address.trim()) {
            setLocateRequest({ address: address.trim(), id: Date.now() });
        }
    };

    const handleSearchSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (search.trim()) {
            setTriggerSearch(search.trim());
        }
    };

    return (
        <div className="w-full h-full flex flex-col">
            <form onSubmit={handleSearchSubmit} className="w-full">
                <PageNavBar 
                    title="Off-Market Scouter" 
                    icon={<Layout/>}
                    searchValue={search}
                    onSearchChange={setSearch}
                    searchPlaceholder="Search address or city on map..."
                    actionLabel="Add Deal"
                    onAction={() => handleAddDeal()} 
                    secondaryActionLabel="Import Deals"
                    onSecondaryAction={() => setIsImportModalOpen(true)}
                />
            </form>
            <div className="flex-1 w-full relative flex overflow-hidden min-h-0">
                {/* Map Area */}
                <div className="flex-1 h-full relative min-w-0">
                    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} version="weekly">
                        <DFDMapContent 
                            handleAddDeal={handleAddDeal} 
                            searchQuery={triggerSearch}
                            onSearchHandled={() => setTriggerSearch(null)}
                            locateRequest={locateRequest}
                            onLocateHandled={() => setLocateRequest(null)}
                        />
                    </APIProvider>

                    {/* Expand Button when Right Panel is Collapsed */}
                    {!isListOpen && (
                        <button
                            type="button"
                            onClick={() => setIsListOpen(true)}
                            className="absolute top-4 right-4 z-20 bg-white dark:bg-[#172235] border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-white px-3 py-2 rounded-xl shadow-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center gap-2 text-xs font-bold"
                            title="Show Off-Market Properties"
                        >
                            <ChevronLeft size={16} className="text-blue-500" />
                            <List size={15} className="text-blue-500" />
                            <span>Properties</span>
                            <span className="px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-mono text-[11px]">
                                {offMarketProperties.filter((p) => p['Trash'] !== true).length}
                            </span>
                        </button>
                    )}
                </div>

                {/* Collapsible, Scrollable Right-Side Property List */}
                <aside
                    className={`h-full bg-white dark:bg-[#111a2b] border-l border-gray-200 dark:border-gray-700/80 flex flex-col shrink-0 transition-all duration-200 ease-in-out overflow-hidden ${
                        isListOpen ? 'w-80 sm:w-96 opacity-100' : 'w-0 border-l-0 opacity-0 pointer-events-none'
                    }`}
                >
                    {/* Panel Header */}
                    <div className="p-3.5 bg-gray-50 dark:bg-[#172235] border-b border-gray-200 dark:border-gray-700/80 flex flex-col gap-2.5 shrink-0">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <Home size={16} className="text-blue-500 shrink-0" />
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                    Off-Market Properties
                                </h3>
                                <span className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 shrink-0">
                                    {filteredProperties.length}
                                </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setListTargetProperty(null);
                                        setIsListsModalOpen(true);
                                    }}
                                    className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1 transition-colors"
                                    title="View Custom Lists"
                                >
                                    <ListChecks size={13} className="text-blue-500" />
                                    <span>View Lists</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={fetchOffMarketProperties}
                                    disabled={isLoadingProperties}
                                    className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/70 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                                    title="Refresh Properties"
                                >
                                    <RefreshCw size={14} className={isLoadingProperties ? 'animate-spin' : ''} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsListOpen(false)}
                                    className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/70 dark:hover:bg-gray-700 transition-colors"
                                    title="Collapse Property List"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Property View Toggle Tabs */}
                        <div className="flex overflow-x-auto gap-4 no-scrollbar border-b border-gray-200 dark:border-gray-700/70">
                            {(
                                [
                                    { id: 'All Properties', label: 'All Properties', count: activeSearchFilteredProperties.length },
                                    { id: 'Interested', label: 'Interested', count: interestedPropertiesCount },
                                    { id: 'Trash', label: 'Trash', count: trashedPropertiesCount },
                                ] as const
                            ).map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setPropertyTab(tab.id)}
                                    className={`whitespace-nowrap pb-2 text-xs font-bold transition-all border-b-2 px-1 -mb-px ${
                                        propertyTab === tab.id
                                            ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400'
                                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                                    }`}
                                >
                                    {tab.label}
                                    <span
                                        className={`ml-2 text-[11px] py-0.5 px-1.5 rounded-full ${
                                            propertyTab === tab.id
                                                ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                                                : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                                        }`}
                                    >
                                        {tab.count}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* List Search Input */}
                        <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            <input
                                type="text"
                                value={listSearch}
                                onChange={(e) => setListSearch(e.target.value)}
                                placeholder="Filter by address, city, zip, owner..."
                                className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg py-1.5 pl-8 pr-7 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 outline-none"
                            />
                            {listSearch && (
                                <button
                                    type="button"
                                    onClick={() => setListSearch('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Scrollable Property List Body */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                        {isLoadingProperties ? (
                            <div className="flex flex-col items-center justify-center py-14 text-gray-500 dark:text-gray-400 gap-2">
                                <Loader2 size={22} className="animate-spin text-blue-500" />
                                <span className="text-xs">Loading properties...</span>
                            </div>
                        ) : propertiesError ? (
                            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                                <div className="space-y-1.5">
                                    <p>{propertiesError}</p>
                                    <button
                                        type="button"
                                        onClick={fetchOffMarketProperties}
                                        className="font-semibold underline hover:no-underline"
                                    >
                                        Try again
                                    </button>
                                </div>
                            </div>
                        ) : filteredProperties.length === 0 ? (
                            <div className="text-center py-14 px-4 text-gray-500 dark:text-gray-400">
                                <Home size={28} className="mx-auto mb-2 opacity-35" />
                                <p className="text-xs font-medium">
                                    {listSearch
                                        ? 'No properties match your filter.'
                                        : propertyTab === 'Trash'
                                            ? 'Trash is empty.'
                                            : propertyTab === 'Interested'
                                                ? 'No interested properties found yet.'
                                                : 'No off-market properties found yet.'}
                                </p>
                            </div>
                        ) : (
                            filteredProperties.map((prop) => {
                                const cityStateZip = [prop['City'], prop['State'], prop['Zip']]
                                    .filter((v) => v !== null && v !== undefined && v !== '')
                                    .join(', ');
                                const fullAddr = [prop['Address'], cityStateZip]
                                    .filter(Boolean)
                                    .join(', ');
                                const ownerName = [prop['Owner 1 First Name'], prop['Owner 1 Last Name']]
                                    .filter(Boolean)
                                    .join(' ');
                                const hasOwnerPhone = [
                                    prop['Owner 1 Phone Number 1'],
                                    prop['Owner 1 Phone Number 2'],
                                    prop['Owner 1 Phone Number 3'],
                                    prop['Owner 2 Phone Number 1'],
                                    prop['Owner 2 Phone Number 2'],
                                    prop['Owner 2 Phone Number 3'],
                                    prop['Owner 3 Phone Number 1'],
                                    prop['Owner 3 Phone Number 2'],
                                    prop['Owner 3 Phone Number 3'],
                                    prop['Owner 4 Phone Number 1'],
                                    prop['Owner 4 Phone Number 2'],
                                    prop['Owner 4 Phone Number 3'],
                                ].some((phone) => phone !== null && phone !== undefined && String(phone).trim() !== '');
                                const estVal = Number(prop['Estimated Value']);
                                const estEq = Number(prop['Estimated Equity']);
                                const eqPct = prop['Estimated Equity Percent'];

                                return (
                                    <div
                                        key={prop.id}
                                        onClick={() => setSelectedProperty(prop)}
                                        className="interactive-card cursor-pointer rounded-xl bg-white dark:bg-[#172235] border border-gray-200 dark:border-gray-700/80 p-3 flex flex-col gap-2 transition-all"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                                    {prop['Address'] || `Property #${prop.id}`}
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                    {cityStateZip || (prop['County'] ? `${prop['County']} County` : 'Location not set')}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-0.5 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenAddToList(prop);
                                                    }}
                                                    className={`p-1.5 rounded-lg transition-colors ${
                                                        normalizeOffMarketLists(prop['Off Market List']).length > 0
                                                            ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                                                            : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                                                    }`}
                                                    title="Add To List"
                                                >
                                                    <ListPlus size={14} />
                                                </button>
                                                {fullAddr && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleLocateProperty(fullAddr);
                                                        }}
                                                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                                        title="Locate on Map"
                                                    >
                                                        <MapPin size={14} />
                                                    </button>
                                                )}
                                                {isTrashedProperty(prop) && (
                                                    <button
                                                        type="button"
                                                        disabled={restoringId === prop.id || deletingId === prop.id}
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            try {
                                                                await handleRestoreProperty(prop.id);
                                                            } catch (err: any) {
                                                                setPropertiesError(err?.message || 'Failed to restore property.');
                                                            }
                                                        }}
                                                        className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors disabled:opacity-50"
                                                        title="Restore from Trash"
                                                    >
                                                        {restoringId === prop.id ? (
                                                            <Loader2 size={14} className="animate-spin" />
                                                        ) : (
                                                            <RotateCcw size={14} />
                                                        )}
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setConfirmDeleteId(confirmDeleteId === prop.id ? null : prop.id);
                                                    }}
                                                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                                    title={isTrashedProperty(prop) ? 'Delete Permanently' : 'Move to Trash'}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {confirmDeleteId === prop.id && (
                                            <div
                                                onClick={(e) => e.stopPropagation()}
                                                className="flex items-center justify-between gap-2 bg-red-50 dark:bg-red-900/25 border border-red-200 dark:border-red-800/70 rounded-lg px-2.5 py-1.5"
                                            >
                                                <span className="text-[11px] font-semibold text-red-700 dark:text-red-300">
                                                    {isTrashedProperty(prop) ? 'Delete permanently?' : 'Move to Trash?'}
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        disabled={deletingId === prop.id}
                                                        onClick={async () => {
                                                            try {
                                                                await handleDeleteProperty(prop.id);
                                                            } catch (err: any) {
                                                                setPropertiesError(err?.message || 'Failed to delete property.');
                                                            }
                                                        }}
                                                        className="px-2 py-0.5 text-[11px] font-bold rounded bg-red-600 hover:bg-red-500 text-white flex items-center gap-1 disabled:opacity-60 transition-colors"
                                                    >
                                                        {deletingId === prop.id && <Loader2 size={11} className="animate-spin" />}
                                                        <span>{isTrashedProperty(prop) ? 'Delete' : 'Move to Trash'}</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={deletingId === prop.id}
                                                        onClick={() => setConfirmDeleteId(null)}
                                                        className="px-2 py-0.5 text-[11px] font-medium rounded text-gray-600 dark:text-gray-300 hover:bg-gray-200/70 dark:hover:bg-gray-700 transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {(prop['Status'] || prop['Property Type']) && (
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {prop['Status'] && (
                                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/70">
                                                        {prop['Status']}
                                                    </span>
                                                )}
                                                {prop['Property Type'] && (
                                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                                                        {prop['Property Type']}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {(prop['Bedrooms'] !== null && prop['Bedrooms'] !== undefined && prop['Bedrooms'] !== '' ||
                                            prop['Bathrooms'] !== null && prop['Bathrooms'] !== undefined && prop['Bathrooms'] !== '' ||
                                            prop['Living Square Feet'] !== null && prop['Living Square Feet'] !== undefined && prop['Living Square Feet'] !== '') && (
                                            <div className="flex items-center gap-3 text-[11px] text-gray-600 dark:text-gray-300">
                                                {prop['Bedrooms'] !== null && prop['Bedrooms'] !== undefined && prop['Bedrooms'] !== '' && (
                                                    <span className="flex items-center gap-1">
                                                        <BedDouble size={12} className="text-gray-400" />
                                                        {prop['Bedrooms']} bd
                                                    </span>
                                                )}
                                                {prop['Bathrooms'] !== null && prop['Bathrooms'] !== undefined && prop['Bathrooms'] !== '' && (
                                                    <span className="flex items-center gap-1">
                                                        <Bath size={12} className="text-gray-400" />
                                                        {prop['Bathrooms']} ba
                                                    </span>
                                                )}
                                                {prop['Living Square Feet'] !== null && prop['Living Square Feet'] !== undefined && prop['Living Square Feet'] !== '' && (
                                                    <span className="flex items-center gap-1">
                                                        <Ruler size={12} className="text-gray-400" />
                                                        {Number(prop['Living Square Feet']).toLocaleString()} sqft
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {((!Number.isNaN(estVal) && estVal > 0) || (!Number.isNaN(estEq) && estEq > 0)) && (
                                            <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-gray-100 dark:border-gray-800/80">
                                                <div>
                                                    <div className="text-[10px] text-gray-400 uppercase font-semibold">Est. Value</div>
                                                    <div className="text-xs font-bold text-gray-900 dark:text-white font-mono">
                                                        {!Number.isNaN(estVal) && estVal > 0 ? formatCurrency(estVal) : '—'}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-gray-400 uppercase font-semibold">Est. Equity</div>
                                                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                                        {!Number.isNaN(estEq) && estEq > 0 ? formatCurrency(estEq) : '—'}
                                                        {eqPct !== null && eqPct !== undefined && eqPct !== '' ? ` (${eqPct}%)` : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-gray-100 dark:border-gray-800/80">
                                            {ownerName || hasOwnerPhone ? (
                                                <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 min-w-0">
                                                    {ownerName && (
                                                        <>
                                                            <User size={12} className="shrink-0 text-gray-400" />
                                                            <span className="truncate">{ownerName}</span>
                                                        </>
                                                    )}
                                                    {hasOwnerPhone && (
                                                        <span
                                                            className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700/80 shrink-0"
                                                            title="Phone Number Found"
                                                        >
                                                            <Phone size={9} />
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <div />
                                            )}
                                            <button
                                                type="button"
                                                disabled={togglingInterestedId === prop.id}
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    try {
                                                        await handleToggleInterested(prop);
                                                    } catch (err: any) {
                                                        setPropertiesError(err?.message || 'Failed to update Interested status.');
                                                    }
                                                }}
                                                className={`px-2 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 shrink-0 transition-colors disabled:opacity-60 ${
                                                    prop['Interested'] === true
                                                        ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700/80 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                                                        : 'bg-gray-50 dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                }`}
                                                title={prop['Interested'] === true ? 'Remove from Interested' : 'Mark as Interested'}
                                            >
                                                {togglingInterestedId === prop.id ? (
                                                    <Loader2 size={11} className="animate-spin" />
                                                ) : (
                                                    <Star
                                                        size={11}
                                                        className={
                                                            prop['Interested'] === true
                                                                ? 'fill-amber-400 text-amber-500 dark:text-amber-400'
                                                                : 'text-gray-400'
                                                        }
                                                    />
                                                )}
                                                <span>Interested</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </aside>
            </div>

            {/* Off-Market Property Review / Edit Modal */}
            {selectedProperty && (
                <OffMarketPropertyModal
                    property={selectedProperty}
                    onClose={() => setSelectedProperty(null)}
                    onSave={handleSaveProperty}
                    onDelete={handleDeleteProperty}
                    onRestore={handleRestoreProperty}
                    onToggleInterested={handleToggleInterested}
                    onAddToList={handleOpenAddToList}
                    onLocateOnMap={handleLocateProperty}
                    onNavigate={(dir) => {
                        if (selectedIndex === -1) return;
                        const nextIdx = dir === 'next' ? selectedIndex + 1 : selectedIndex - 1;
                        if (nextIdx >= 0 && nextIdx < filteredProperties.length) {
                            setSelectedProperty(filteredProperties[nextIdx]);
                        }
                    }}
                    hasPrevious={selectedIndex > 0}
                    hasNext={selectedIndex !== -1 && selectedIndex < filteredProperties.length - 1}
                />
            )}

            {/* Off-Market Properties Custom Lists Manager Modal */}
            {isListsModalOpen && (
                <OffMarketPropertiesListModal
                    properties={offMarketProperties}
                    customLists={customLists}
                    onCreateList={handleCreateCustomList}
                    onDeleteList={handleDeleteCustomList}
                    onUpdatePropertyLists={handleUpdatePropertyLists}
                    onSelectProperty={(prop) => setSelectedProperty(prop)}
                    isOccluded={Boolean(selectedProperty || listTargetProperty)}
                    onClose={() => setIsListsModalOpen(false)}
                />
            )}

            {/* Add To List Picker Modal */}
            {listTargetProperty && (
                <OffMarketPropertiesListModal
                    properties={offMarketProperties}
                    customLists={customLists}
                    onCreateList={handleCreateCustomList}
                    onDeleteList={handleDeleteCustomList}
                    onUpdatePropertyLists={handleUpdatePropertyLists}
                    onSelectProperty={(prop) => setSelectedProperty(prop)}
                    targetProperty={listTargetProperty}
                    onClearTargetProperty={() => {
                        setListTargetProperty(null);
                        setSelectedProperty(null);
                        setIsListsModalOpen(true);
                    }}
                    onClose={() => setListTargetProperty(null)}
                />
            )}

            {/* Bulk CSV / Excel Importer Modal */}
            {isImportModalOpen && (
                <ImportOffMarketPropertiesModal
                    existingProperties={offMarketProperties}
                    onClose={() => setIsImportModalOpen(false)}
                    onImportComplete={(imported) => {
                        if (imported.length > 0) {
                            setOffMarketProperties((prev) => [...imported, ...prev]);
                            setIsListOpen(true);
                        } else {
                            fetchOffMarketProperties();
                        }
                    }}
                />
            )}
        </div>
    );
};

interface DFDMapContentProps {
    handleAddDeal: (overrides?: Partial<Deal>) => void;
    searchQuery: string | null;
    onSearchHandled: () => void;
    locateRequest: { address: string; id: number } | null;
    onLocateHandled: () => void;
}

const DFDMapContent = ({
    handleAddDeal,
    searchQuery,
    onSearchHandled,
    locateRequest,
    onLocateHandled,
}: DFDMapContentProps) => {
    const map = useMap();
    const geocodingLib = useMapsLibrary('geocoding');
    const [locatedPinRef, locatedPinMarker] = useAdvancedMarkerRef();
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number }>({ lat: 33.7490, lng: -84.3880 }); // Atlanta default
    const [clickedLocation, setClickedLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [selectedAddress, setSelectedAddress] = useState('');
    const [locatedPin, setLocatedPin] = useState<{ position: { lat: number; lng: number }; address: string } | null>(null);
    const [isLocatedPinInfoOpen, setIsLocatedPinInfoOpen] = useState(false);
    const [hasLocated, setHasLocated] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [locationMethod, setLocationMethod] = useState<'gps' | 'ip' | 'default' | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [showGpsHelp, setShowGpsHelp] = useState(false);
    const [showLocationPrompt, setShowLocationPrompt] = useState(() => {
        return localStorage.getItem('dfd_location_prompt_seen') !== 'true';
    });
    const [customZipInput, setCustomZipInput] = useState('');

    // Fallback handler when browser geolocation fails or is denied
    const fallbackToAtlanta = (reason?: string) => {
        const savedLoc = localStorage.getItem('dfd_home_location');
        let initialPos = { lat: 33.7490, lng: -84.3880 }; // Atlanta GA
        let locName = 'Atlanta, GA';
        if (savedLoc) {
            try {
                const parsed = JSON.parse(savedLoc);
                if (parsed.lat && parsed.lng) {
                    initialPos = { lat: parsed.lat, lng: parsed.lng };
                    if (parsed.name) locName = parsed.name;
                }
            } catch (e) {
                console.warn('Failed to parse saved location');
            }
        }
        setUserLocation(initialPos);
        setHasLocated(true);
        setLocationMethod('default');
        setStatusMessage(reason || `Centered on ${locName}`);
        if (map) {
            map.panTo(initialPos);
            map.setZoom(13);
        }
        setTimeout(() => setStatusMessage(null), 6000);
    };

    const locateUser = useCallback(() => {
        setIsLocating(true);
        setStatusMessage('Detecting current location...');

        if (!navigator.geolocation) {
            fallbackToAtlanta('Browser geolocation unavailable. Defaulted to Atlanta, GA');
            setIsLocating(false);
            return;
        }

        const handleSuccess = (position: GeolocationPosition) => {
            const pos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            setUserLocation(pos);
            setHasLocated(true);
            setLocationMethod('gps');
            setIsLocating(false);
            setStatusMessage('GPS Location detected!');
            setTimeout(() => setStatusMessage(null), 4000);

            if (map) {
                map.panTo(pos);
                map.setZoom(15);
            }
        };

        // Primary attempt: high accuracy with 10s timeout
        navigator.geolocation.getCurrentPosition(
            handleSuccess,
            (primaryError) => {
                console.warn('High accuracy geolocation attempt failed, trying low accuracy fallback:', primaryError);
                // Fallback attempt: low accuracy with 15s timeout and 1 minute cache
                navigator.geolocation.getCurrentPosition(
                    handleSuccess,
                    (fallbackError) => {
                        console.warn('Geolocation fallback failed:', fallbackError);
                        fallbackToAtlanta('GPS permission denied or unavailable. Centered on Atlanta, GA');
                        setIsLocating(false);
                    },
                    {
                        enableHighAccuracy: false,
                        timeout: 15000,
                        maximumAge: 60000
                    }
                );
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 30000
            }
        );
    }, [map]);

    // Handle search query from PageNavBar
    useEffect(() => {
        if (searchQuery && geocodingLib) {
            const geocoder = new geocodingLib.Geocoder();
            geocoder.geocode({ address: searchQuery }, (results, status) => {
                if (status === 'OK' && results && results[0]) {
                    const loc = results[0].geometry.location;
                    const latLng = { lat: loc.lat(), lng: loc.lng() };
                    if (map) {
                        map.panTo(latLng);
                        map.setZoom(16);
                    }
                    setClickedLocation(latLng);
                    setSelectedAddress(results[0].formatted_address);
                } else {
                    setStatusMessage(`No results found for "${searchQuery}"`);
                    setTimeout(() => setStatusMessage(null), 4000);
                }
                onSearchHandled();
            });
        }
    }, [searchQuery, geocodingLib, map, onSearchHandled]);

    // Handle "Locate on Map" button from Off-Market Properties list or modal
    useEffect(() => {
        if (locateRequest && geocodingLib) {
            const geocoder = new geocodingLib.Geocoder();
            geocoder.geocode({ address: locateRequest.address }, (results, status) => {
                if (status === 'OK' && results && results[0]) {
                    const loc = results[0].geometry.location;
                    const latLng = { lat: loc.lat(), lng: loc.lng() };
                    if (map) {
                        map.panTo(latLng);
                        map.setZoom(16);
                    }
                    setClickedLocation(null);
                    setSelectedAddress('');
                    setLocatedPin({
                        position: latLng,
                        address: results[0].formatted_address || locateRequest.address,
                    });
                    setIsLocatedPinInfoOpen(false);
                } else {
                    setStatusMessage(`No results found for "${locateRequest.address}"`);
                    setTimeout(() => setStatusMessage(null), 4000);
                }
                onLocateHandled();
            });
        }
    }, [locateRequest, geocodingLib, map, onLocateHandled]);

    useEffect(() => {
        const el = locatedPinMarker?.element;
        if (!el) return;
        const handleMouseEnter = () => setIsLocatedPinInfoOpen(true);
        el.addEventListener('mouseenter', handleMouseEnter);
        return () => {
            el.removeEventListener('mouseenter', handleMouseEnter);
        };
    }, [locatedPinMarker]);

    const handleMapClick = async (e: any) => {
        if (!e.detail || !e.detail.latLng) return;
        const latLng = e.detail.latLng;
        setIsLocatedPinInfoOpen(false);
        setClickedLocation(latLng);
        
        if (geocodingLib) {
            const geocoder = new geocodingLib.Geocoder();
            try {
                const response = await geocoder.geocode({ location: latLng });
                if (response.results && response.results[0]) {
                    setSelectedAddress(response.results[0].formatted_address);
                } else {
                    setSelectedAddress('Unknown Address');
                }
            } catch (error) {
                console.error("Geocoding failed", error);
                setSelectedAddress('Unknown Address');
            }
        }
    };

    const handleAddToPipeline = (type: 'mls' | 'off-market' | 'dfd', addressOverride?: string) => {
        handleAddDeal({ address: addressOverride ?? selectedAddress, pipelineType: type });
        setClickedLocation(null);
        setSelectedAddress('');
        setIsLocatedPinInfoOpen(false);
    };

    return (
        <>
            <Map
                defaultCenter={userLocation}
                defaultZoom={12}
                mapId="DFD_SCOUTER_MAP"
                onClick={handleMapClick}
                options={{ mapTypeControl: true, streetViewControl: true }}
                style={{ width: '100%', height: '100%' }}
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            >
                {hasLocated && (
                    <AdvancedMarker position={userLocation} title={locationMethod === 'gps' ? "Your GPS Location" : "Approximate Location"}>
                        <Pin 
                            background={locationMethod === 'gps' ? "#4285F4" : "#EA4335"} 
                            glyphColor="#fff" 
                            borderColor="#1967d2" 
                        />
                    </AdvancedMarker>
                )}

                {locatedPin && (
                    <AdvancedMarker
                        ref={locatedPinRef}
                        position={locatedPin.position}
                        title={locatedPin.address}
                        onClick={() => setIsLocatedPinInfoOpen(true)}
                    >
                        <Pin
                            background="#EA4335"
                            borderColor="#B31412"
                            glyphColor="#A50E0E"
                        />
                    </AdvancedMarker>
                )}

                {locatedPin && isLocatedPinInfoOpen && (
                    <InfoWindow
                        anchor={locatedPinMarker}
                        onCloseClick={() => setIsLocatedPinInfoOpen(false)}
                    >
                        <div className="p-4 bg-white dark:bg-gray-800 rounded shadow text-gray-900 dark:text-white max-w-sm">
                            <h3 className="font-bold text-lg mb-2">Selected Property</h3>
                            <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">{locatedPin.address}</p>
                            <div className="flex flex-col gap-2">
                                <button 
                                    onClick={() => handleAddToPipeline('off-market', locatedPin.address)}
                                    className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 transition"
                                >
                                    Add to Off-Market Pipeline
                                </button>
                                <button 
                                    onClick={() => handleAddToPipeline('mls', locatedPin.address)}
                                    className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700 transition"
                                >
                                    Add to MLS Pipeline
                                </button>
                            </div>
                        </div>
                    </InfoWindow>
                )}

                {clickedLocation && (
                    <InfoWindow position={clickedLocation} onCloseClick={() => setClickedLocation(null)}>
                        <div className="p-4 bg-white dark:bg-gray-800 rounded shadow text-gray-900 dark:text-white max-w-sm">
                            <h3 className="font-bold text-lg mb-2">Selected Property</h3>
                            <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">{selectedAddress}</p>
                            <div className="flex flex-col gap-2">
                                <button 
                                    onClick={() => handleAddToPipeline('off-market')}
                                    className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 transition"
                                >
                                    Add to Off-Market Pipeline
                                </button>
                                <button 
                                    onClick={() => handleAddToPipeline('mls')}
                                    className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700 transition"
                                >
                                    Add to MLS Pipeline
                                </button>
                            </div>
                        </div>
                    </InfoWindow>
                )}
            </Map>

            {/* Location Prompt Modal */}
            {showLocationPrompt && (
                <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 max-w-md w-full shadow-2xl relative animate-fadeIn">
                        <div className="flex justify-center mb-4">
                            <div className="bg-blue-100 dark:bg-blue-900/50 p-4 rounded-full text-blue-600 dark:text-blue-400">
                                <MapPin size={32} />
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 text-center">
                            Enable Location Services
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 text-center">
                            DealDesk needs your location to center the map on your local real estate market. 
                            By allowing GPS access, you can quickly find properties near you.
                        </p>
                        
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => {
                                    localStorage.setItem('dfd_location_prompt_seen', 'true');
                                    setShowLocationPrompt(false);
                                    locateUser();
                                }}
                                className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-500/30 flex justify-center items-center gap-2"
                            >
                                <Locate size={18} />
                                Allow Location Access
                            </button>
                            <button
                                onClick={() => {
                                    localStorage.setItem('dfd_location_prompt_seen', 'true');
                                    setShowLocationPrompt(false);
                                    fallbackToAtlanta('Set to default market');
                                }}
                                className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                            >
                                Skip for Now
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* GPS Instructions Modal */}
            {showGpsHelp && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 max-w-md w-full shadow-2xl relative animate-fadeIn">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                            <Navigation className="text-blue-500" size={20} />
                            Enabling GPS Location Permissions
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mb-4">
                            When hosted on Vercel or in an embedded browser/iframe, browser security requires explicit site location permission.
                        </p>
                        
                        <div className="space-y-3 text-xs text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-900/50 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700/80">
                            <div className="flex items-start gap-2.5">
                                <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px]">1</span>
                                <div>
                                    <strong>Click the Lock/Tune Icon:</strong> Next to the URL in your browser address bar (top left of screen).
                                </div>
                            </div>
                            <div className="flex items-start gap-2.5">
                                <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px]">2</span>
                                <div>
                                    <strong>Allow Location:</strong> Toggle <em>Location</em> or <em>Permissions</em> from <strong>Block</strong> to <strong>Allow</strong>.
                                </div>
                            </div>
                            <div className="flex items-start gap-2.5">
                                <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px]">3</span>
                                <div>
                                    <strong>Refresh the Page:</strong> Reload the app tab and click the blue <strong>Locate</strong> button again!
                                </div>
                            </div>
                        </div>

                        <div className="mt-5 flex gap-2 justify-end">
                            <button
                                onClick={() => setShowGpsHelp(false)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition"
                            >
                                Got It
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Status Toast Banner */}
            {statusMessage && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-gray-900/90 text-white text-xs px-4 py-2 rounded-full shadow-lg backdrop-blur flex items-center gap-2 border border-gray-700 animate-fadeIn">
                    {isLocating ? <Loader2 size={14} className="animate-spin text-blue-400" /> : <Navigation size={14} className="text-green-400" />}
                    <span>{statusMessage}</span>
                </div>
            )}
            
            {/* Custom Map Controls */}
            <MapControl position={ControlPosition.RIGHT_BOTTOM}>
                <div className="m-4 flex flex-col gap-2">
                    <button 
                        onClick={locateUser}
                        disabled={isLocating}
                        className={`p-3 rounded-full shadow-lg transition-all flex items-center justify-center ${
                            isLocating 
                                ? 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400 cursor-wait' 
                                : hasLocated 
                                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                                    : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                        }`}
                        title="Locate Current Location"
                    >
                        {isLocating ? (
                            <Loader2 size={20} className="animate-spin" />
                        ) : (
                            <Locate size={20} />
                        )}
                    </button>
                </div>
            </MapControl>
        </>
    );
};

