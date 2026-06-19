import React, { useMemo } from 'react';
import { X, LayoutGrid, MapPin, DollarSign, CheckCircle, Home, ArrowRight, Target, Briefcase } from 'lucide-react';
import { Deal, Buyer } from '../../types';
import { formatCurrency, formatPhoneNumber } from '../../services/utils';
import { POTENTIAL_STATUSES, UNDER_CONTRACT_STATUSES, GOOGLE_MAPS_API_KEY } from '../../constants';

interface DealMatchModalProps {
    buyer: Buyer;
    deals: Deal[];
    onClose: () => void;
    onOpenDeal: (deal: Deal) => void;
}

export const DealMatchModal: React.FC<DealMatchModalProps> = ({ buyer, deals, onClose, onOpenDeal }) => {
    // Helper to fix Drive URLs for display
    const processPhotoUrl = (url: string) => {
        if (!url) return '';
        try {
            if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
                let id = '';
                const idMatch = url.match(/id=([^&]+)/);
                if (idMatch) id = idMatch[1];
                else {
                    const dMatch = url.match(/\/d\/([^/?]+)/);
                    if (dMatch) id = dMatch[1];
                }

                if (id) {
                    return `https://lh3.googleusercontent.com/d/${id}`;
                }
            }
        } catch (e) {
            console.warn("Could not process drive URL", e);
        }
        return url;
    };

    // Helper to parse location string into structured data
    const parseLocations = (locString: string) => {
        const zips: string[] = [];
        const counties: string[] = [];
        const cities: string[] = [];
        const neighborhoods: string[] = [];

        if (!locString) return { zips, counties, cities, neighborhoods };

        locString.split(',').map(s => s.trim()).forEach(part => {
            const lower = part.toLowerCase();
            // Check for explicit prefixes or patterns
            if (lower.startsWith('zip code:')) zips.push(part.replace(/zip code:/i, '').trim());
            else if (lower.startsWith('county:')) counties.push(lower.replace('county:', '').trim().replace(' county', ''));
            else if (lower.startsWith('city:')) cities.push(lower.replace('city:', '').trim());
            else if (lower.startsWith('neighborhood:')) neighborhoods.push(lower.replace('neighborhood:', '').trim());
            // Heuristic checks
            else if (/^\d{5}$/.test(part)) zips.push(part);
            else if (part.includes('county')) counties.push(lower.replace('county', '').trim());
            else if (part) neighborhoods.push(lower);
        });
        return { zips, counties, cities, neighborhoods };
    };

    const matches = useMemo(() => {
        const bb = buyer.buyBox;
        if (!bb) return [];

        const matchingStages = [...POTENTIAL_STATUSES, ...UNDER_CONTRACT_STATUSES];
        const { zips, counties, cities, neighborhoods } = parseLocations(bb.locations || "");

        // 1. STRATEGY PRE-CALC
        const buyerStrategies = (bb.propertyTypes || []).map(t => {
            let low = t.toLowerCase();
            return low === 'new construction' ? 'new build' : low;
        }).filter(Boolean);

        return deals.map(deal => {
            const reasons: string[] = []; // Explicitly typed to allow push

            // --- 1. GUARD: Pipeline Stage ---
            if (!matchingStages.includes(deal.offerDecision)) return { deal, isMatch: false, reasons: [] as string[] };

            // Deal Props
            const dealPrice = deal.listPrice || 0;
            const dealArv = deal.renovationARV || 0;
            const dealReno = deal.renovationEstimate || 0;
            const dealSqft = deal.sqft || 0;
            const dealYear = deal.yearBuilt || 0;
            
            // --- 2. STRATEGY MATCH (Strict) ---
            const dealStrategies = (deal.dealType || []).map(s => {
                let low = s.toLowerCase();
                return low === 'new construction' ? 'new build' : low;
            }).filter(Boolean);

            if (buyerStrategies.length > 0) {
                if (dealStrategies.length === 0) return { deal, isMatch: false, reasons: [] as string[] };
                const hasOverlap = dealStrategies.some(s => buyerStrategies.includes(s));
                if (!hasOverlap) return { deal, isMatch: false, reasons: [] as string[] };
                reasons.push("Strategy Match");
            }

            // --- 3. FINANCIALS (Strict) ---
            if (bb.minPrice && dealPrice < bb.minPrice) return { deal, isMatch: false, reasons: [] as string[] };
            if (bb.maxPrice && dealPrice > bb.maxPrice) return { deal, isMatch: false, reasons: [] as string[] };
            if (bb.minArv && dealArv < bb.minArv) return { deal, isMatch: false, reasons: [] as string[] };
            if (bb.maxArv && bb.maxArv > 0 && dealArv > bb.maxArv) return { deal, isMatch: false, reasons: [] as string[] };
            if (bb.maxRenoBudget && dealReno > bb.maxRenoBudget) return { deal, isMatch: false, reasons: [] as string[] };

            // --- 4. SPECS (Strict) ---
            if (bb.minBedrooms && (deal.bedrooms || 0) < bb.minBedrooms) return { deal, isMatch: false, reasons: [] as string[] };
            if (bb.minBathrooms && (deal.bathrooms || 0) < bb.minBathrooms) return { deal, isMatch: false, reasons: [] as string[] };
            if (bb.minSqft && dealSqft < bb.minSqft) return { deal, isMatch: false, reasons: [] as string[] };
            if (bb.maxSqft && bb.maxSqft > 0 && dealSqft > bb.maxSqft) return { deal, isMatch: false, reasons: [] as string[] };
            if (bb.earliestYearBuilt && dealYear < bb.earliestYearBuilt) return { deal, isMatch: false, reasons: [] as string[] };
            if (bb.latestYearBuilt && bb.latestYearBuilt > 0 && dealYear > bb.latestYearBuilt) return { deal, isMatch: false, reasons: [] as string[] };

            reasons.push("Criteria Match");

            // --- 5. LOCATION (Hierarchical Logic) ---
            const dealZip = deal.address.match(/\d{5}/)?.[0] || "";
            const dealCounty = (deal.county || "").toLowerCase().replace(' county', '').trim();
            const dealCity = (deal.subMarket || "").toLowerCase().trim();
            const dealNeighborhood = (deal.neighborhood || "").toLowerCase().trim();

            // Priority 1: Zip Gatekeeper
            // If buyer has Zips defined, ONLY match those zips. Ignore County matches.
            if (zips.length > 0) {
                if (!dealZip || !zips.includes(dealZip)) return { deal, isMatch: false, reasons: [] as string[] };
                reasons.push(`Zip Match (${dealZip})`);
            } else {
                // Priority 3: County Fallback (Only if no Zips are defined)
                let geoMatch = false;
                if (counties.length > 0) {
                    const ctyMatch = counties.some(c => dealCounty.includes(c));
                    if (ctyMatch) geoMatch = true;
                } 
                if (cities.length > 0) {
                    const cityMatch = cities.includes(dealCity);
                    if (cityMatch) geoMatch = true;
                }
                
                // If buyer has no location preferences at all, assume open? 
                // For strict matching, usually we require at least one location match if any locations are set.
                // If bb.locations is empty, we pass (Open Buy Box).
                if (!bb.locations || bb.locations.trim() === '') geoMatch = true;
                
                // If locations exist but none matched:
                if ((counties.length > 0 || cities.length > 0) && !geoMatch) return { deal, isMatch: false, reasons: [] as string[] };
                
                if (geoMatch && (counties.length > 0 || cities.length > 0)) reasons.push("Location Match");
            }

            // Priority 2: Neighborhood Context (Expanded for City/County tags)
            // Only enforce neighborhood match if the buyer HAS neighborhood prefs AND the deal HAS a neighborhood.
            if (neighborhoods.length > 0 && dealNeighborhood) {
                // We check if ANY of the buyer's text tags match the Property's Neighborhood OR City OR County.
                // This allows a buyer with tag "Atlanta" to still match a "Grant Park" property inside Atlanta.
                const isNbMatch = neighborhoods.some(n => {
                    const lowerN = n.toLowerCase().trim();
                    if (!lowerN) return false;
                    return (
                        (dealNeighborhood && (dealNeighborhood.includes(lowerN) || lowerN.includes(dealNeighborhood))) ||
                        (dealCity && (dealCity.includes(lowerN) || lowerN.includes(dealCity))) ||
                        (dealCounty && (dealCounty.includes(lowerN) || lowerN.includes(dealCounty)))
                    );
                });

                if (!isNbMatch) return { deal, isMatch: false, reasons: [] as string[] };
                reasons.push(`Neighborhood Match`);
            }

            return { deal, isMatch: true, reasons };
        })
        .filter(m => m.isMatch);
    }, [buyer, deals]);

    return (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                
                {/* Header */}
                <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg shrink-0">
                            <LayoutGrid className="text-blue-600 dark:text-blue-400" size={24} />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate">Strict Deal Match</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Found {matches.length} valid deals matching <span className="font-bold text-blue-600 dark:text-blue-400">{buyer.name || buyer.companyName}</span>'s exact criteria</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-white p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0">
                        <X size={20}/>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {matches.length > 0 ? (
                        matches.map(({ deal, reasons }, idx) => {
                            const userPhoto = deal.photos && deal.photos.length > 0 && deal.photos[0].length > 10 ? deal.photos[0] : null;
                            const streetViewUrl = GOOGLE_MAPS_API_KEY 
                                ? `https://maps.googleapis.com/maps/api/streetview?size=300x300&location=${encodeURIComponent(deal.address)}&fov=70&key=${GOOGLE_MAPS_API_KEY}`
                                : null;
                            const displayImageUrl = userPhoto ? processPhotoUrl(userPhoto) : streetViewUrl;

                            const buyerSalesPrice = (deal.offerPrice || 0) + (deal.desiredWholesaleProfit || 0);

                            return (
                                <div 
                                    key={deal.id} 
                                    onClick={() => onOpenDeal(deal)}
                                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm hover:border-blue-500/50 hover:shadow-md transition-all group cursor-pointer"
                                >
                                    <div className="flex justify-between items-start mb-3 gap-3">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0 overflow-hidden border border-gray-200 dark:border-gray-600">
                                                {displayImageUrl ? (
                                                    <img 
                                                        src={displayImageUrl} 
                                                        className="w-full h-full object-cover" 
                                                        referrerPolicy="no-referrer"
                                                        onError={(e) => {
                                                            const target = e.target as HTMLImageElement;
                                                            target.onerror = null;
                                                            if (userPhoto && target.src !== userPhoto) {
                                                                target.src = userPhoto;
                                                            } else if (streetViewUrl && target.src !== streetViewUrl) {
                                                                target.src = streetViewUrl;
                                                            } else {
                                                                target.style.display = 'none';
                                                            }
                                                        }}
                                                    />
                                                ) : (
                                                    <Home size={20} className="text-gray-400" />
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h4 className="font-bold text-gray-900 dark:text-white text-base group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate" title={deal.address}>{deal.address}</h4>
                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1 rounded">MLS: {deal.mls}</span>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${UNDER_CONTRACT_STATUSES.includes(deal.offerDecision) ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                                                        {deal.offerDecision}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                                            <span className="px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-900">
                                                VERIFIED MATCH
                                            </span>
                                            <div className="text-sm font-bold text-gray-900 dark:text-white">
                                                {formatCurrency(buyerSalesPrice)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {reasons.map((r, i) => (
                                            <span key={i} className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-2 py-1 rounded text-[10px] font-bold text-gray-600 dark:text-gray-300 flex items-center gap-1">
                                                <CheckCircle size={10} className="text-green-500"/> {r}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700/50">
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 min-w-0 flex-1 mr-2">
                                            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                <Target size={12} /> {deal.bedrooms || 0} Bed / {deal.bathrooms || 0} Bath
                                            </div>
                                            {deal.dealType && deal.dealType.length > 0 && (
                                                <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                                    <Briefcase size={12} className="shrink-0" /> <span className="truncate">{deal.dealType.join(', ')}</span>
                                                </div>
                                            )}
                                        </div>
                                        <button 
                                            className="text-blue-600 dark:text-blue-400 text-xs font-bold hover:underline flex items-center gap-1 shrink-0"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onOpenDeal(deal);
                                            }}
                                        >
                                            Open Deal <ArrowRight size={12}/>
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center py-12 text-center opacity-60">
                            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-full mb-4">
                                <LayoutGrid size={48} className="text-gray-300 dark:text-gray-600" />
                            </div>
                            <h4 className="text-lg font-bold text-gray-700 dark:text-white mb-1">No Verified Matches</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                                No active deals strictly match <strong>ALL</strong> of this buyer's specific criteria (Location, Strategy, Budget, Specs).
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 flex justify-end shrink-0">
                    <button 
                        onClick={onClose}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2 rounded-lg font-bold text-sm shadow-lg transition-all active:scale-95"
                    >
                        Close Results
                    </button>
                </div>
            </div>
        </div>
    );
};