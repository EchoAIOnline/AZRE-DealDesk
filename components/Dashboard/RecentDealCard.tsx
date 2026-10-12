import React from 'react';
import { User, ChevronDown, Clock, MapPin } from 'lucide-react';
import { Deal } from '../../types';
import { formatCurrency, processPhotoUrl, calculateDaysRemaining } from '../../services/utils';

import { GOOGLE_MAPS_API_KEY, POTENTIAL_STATUSES, UNDER_CONTRACT_STATUSES, DECLINED_STATUSES, CANCELED_STATUSES, CLOSED_STATUSES } from '../../constants';

interface RecentDealCardProps {
    deal: Deal;
    onClick: (deal: Deal) => void;
}

export const RecentDealCard: React.FC<RecentDealCardProps> = ({ deal, onClick }) => {
    // Process photo URL or fallback to Street View
    const userPhotoRaw = deal.photos && deal.photos.length > 0 && deal.photos[0].length > 10 ? deal.photos[0] : null;
    const userPhoto = userPhotoRaw ? processPhotoUrl(userPhotoRaw) : null;
    const streetViewUrl = (GOOGLE_MAPS_API_KEY && deal.address && !deal.excludeStreetView)
        ? `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${encodeURIComponent(deal.address)}&fov=70&key=${GOOGLE_MAPS_API_KEY}`
        : null;
    const photoUrl = userPhoto || streetViewUrl;
    
    // Calculate "Updated X ago" - using logs or createdAt as proxy
    const getLastUpdated = () => {
        if (deal.logs && deal.logs.length > 0) {
            const lastLog = deal.logs[0];
            // Extract date from log string "Oct 24 10:00 AM: ..."
            const datePart = lastLog.split(': ')[0];
            // Simple logic to just show the log date string or "Recently"
            return `Updated ${datePart}`;
        }
        return 'Updated recently';
    };

    const getStatusColor = (status: string) => {
        if (UNDER_CONTRACT_STATUSES.includes(status)) return 'bg-green-600 text-white';
        if (CLOSED_STATUSES.includes(status)) return 'bg-purple-600 text-white';
        if (DECLINED_STATUSES.includes(status)) return 'bg-red-600 text-white';
        if (CANCELED_STATUSES.includes(status) || status === 'Canceled') return 'bg-orange-600 text-white';
        return 'bg-yellow-500 text-white';
    };

    return (
        <div 
            onClick={() => onClick(deal)}
            className="bg-white dark:bg-[#172235] dark:bg-gradient-to-b dark:from-[#1d2b42] dark:to-[#172235] rounded-xl overflow-hidden border interactive-card cursor-pointer group flex flex-col h-full relative"
        >
            {/* Image Section */}
            <div className="h-28 w-full relative bg-gray-100 dark:bg-gray-800">
                {photoUrl ? (
                    <img 
                        src={photoUrl} 
                        alt={deal.address} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            if (streetViewUrl && target.src !== streetViewUrl) {
                                target.src = streetViewUrl;
                            } else if (target.src !== 'https://placehold.co/600x400/1f2937/9ca3af?text=No+Image') {
                                target.src = 'https://placehold.co/600x400/1f2937/9ca3af?text=No+Image';
                            }
                        }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 bg-gray-100 dark:bg-gray-800">
                        <span className="text-xs uppercase tracking-wider">No Image</span>
                    </div>
                )}
                {!userPhoto && streetViewUrl && (
                    <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-[9px] font-medium text-white/90 flex items-center gap-1 pointer-events-none z-10">
                        <MapPin size={9} /> Street View
                    </div>
                )}
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-[#172235] via-transparent to-transparent opacity-85 pointer-events-none"></div>
                
                {/* Status Badge */}
                <div className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm backdrop-blur-sm ${getStatusColor(deal.offerDecision)}`}>
                    {deal.offerDecision || 'New'}
                </div>
            </div>

            {/* Content Section */}
            <div className="p-3 flex-1 flex flex-col">
                {/* Address Header */}
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className="text-gray-900 dark:text-white font-bold text-sm leading-snug group-hover:text-blue-400 transition-colors line-clamp-1">
                            {deal.address}
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
                            {deal.agentName || 'No Agent'}
                        </p>
                    </div>
                    <ChevronDown size={16} className="text-gray-600 group-hover:text-gray-500 dark:text-gray-400" />
                </div>

                {/* Meta Row */}
                <div className="flex items-center gap-3 mb-2">
                    <span className="text-blue-400 text-[11px] font-medium">
                        MLS: <span className="text-blue-300">{deal.mls || 'N/A'}</span>
                    </span>
                    <div className="h-3 w-px bg-gray-300 dark:bg-gray-700"></div>
                    <div className="flex items-center gap-1 text-gray-500 text-[11px]">
                        <User size={10} />
                        <span className="truncate max-w-[100px]">{deal.acquisitionManager || 'Unassigned'}</span>
                    </div>
                </div>

                {/* Price Grid */}
                <div className="grid grid-cols-2 gap-4 mb-2 mt-auto">
                    <div>
                        <p className="text-gray-500 text-[10px] uppercase font-semibold tracking-wide">List Price</p>
                        <p className="text-gray-900 dark:text-white font-bold text-sm">{formatCurrency(deal.listPrice)}</p>
                    </div>
                    <div>
                        <p className="text-gray-500 text-[10px] uppercase font-semibold tracking-wide">My Offer</p>
                        <p className="text-emerald-400 font-bold text-sm">{formatCurrency(deal.offerPrice)}</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700/50 flex items-center gap-1.5">
                    <Clock size={10} className="text-gray-500" />
                    <p className="text-gray-500 text-[10px] font-medium">
                        {getLastUpdated()}
                    </p>
                </div>
            </div>
        </div>
    );
};
