import React, { useMemo } from 'react';
import { X, Users, MapPin, DollarSign, CheckCircle, Phone, Mail, Building, ArrowRight, Target } from 'lucide-react';
import { Deal, Buyer } from '../../types';
import { formatCurrency, formatPhoneNumber, processPhotoUrl } from '../../services/utils';
import { MatchingEngine } from '../../services/matchingLogic';

interface BuyerMatchModalProps {
    deal: Deal;
    buyers: Buyer[];
    onClose: () => void;
    onViewBuyer: (id: string) => void; 
}

export const BuyerMatchModal: React.FC<BuyerMatchModalProps> = ({ deal, buyers, onClose, onViewBuyer }) => {
    const matches = useMemo(() => {
        return MatchingEngine.findBuyersForDeal(deal, buyers)
            .map(result => ({
                buyer: result.buyer,
                matchScore: result.match.score,
                reasons: result.match.matchedCriteria
            }))
            .sort((a, b) => b.matchScore - a.matchScore);
    }, [deal, buyers]);

    return (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                
                {/* Modal Header */}
                <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-3">
                        <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg">
                            <Users className="text-green-600 dark:text-green-400" size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Buyer Match Results</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Found {matches.length} matching buyers for <span className="font-bold">{deal.address}</span></p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-white p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <X size={20}/>
                    </button>
                </div>

                {/* Buyer List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {matches.length > 0 ? (
                        matches.map(({ buyer, matchScore, reasons }) => (
                            <div 
                                key={buyer.id} 
                                onClick={() => onViewBuyer(buyer.id)}
                                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm hover:border-green-500/50 hover:shadow-md transition-all group cursor-pointer"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0 overflow-hidden border border-gray-200 dark:border-gray-600">
                                            {buyer.photo ? (
                                                <img 
                                                    src={processPhotoUrl(buyer.photo)} 
                                                    className="w-full h-full object-cover" 
                                                    referrerPolicy="no-referrer"
                                                />
                                            ) : (
                                                <Building size={20} className="text-gray-400" />
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">{buyer.name}</h4>
                                            <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">{buyer.companyName}</div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${matchScore >= 6 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                            {matchScore >= 6 ? 'Strong Match' : 'Possible Match'}
                                        </span>
                                        <span className="text-[10px] text-gray-400 font-medium">{buyer.propertiesBought || 0} Previous Deals</span>
                                    </div>
                                </div>

                                {/* Reasons Tags */}
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {reasons.map((r, i) => (
                                        <span key={i} className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-2 py-1 rounded text-[10px] font-bold text-gray-600 dark:text-gray-300 flex items-center gap-1">
                                            <CheckCircle size={10} className="text-green-500"/> {r}
                                        </span>
                                    ))}
                                </div>

                                {/* Buy Box Preview */}
                                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800">
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                        <Target size={10} /> Buy Box Criteria
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-300">
                                        <div className="flex items-start gap-1.5">
                                            <MapPin size={12} className="mt-0.5 text-gray-400"/>
                                            <span className="line-clamp-2" title={buyer.buyBox?.locations}>{buyer.buyBox?.locations || "No Locations"}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <DollarSign size={12} className="text-gray-400"/>
                                            <span>{formatCurrency(buyer.buyBox?.minPrice)} - {buyer.buyBox?.maxPrice ? formatCurrency(buyer.buyBox?.maxPrice) : 'No Limit'}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Target size={12} className="text-gray-400"/>
                                            <span>Max Reno: {buyer.buyBox?.maxRenoBudget ? formatCurrency(buyer.buyBox.maxRenoBudget) : 'No Limit'}</span>
                                        </div>
                                        {buyer.buyBox?.propertyTypes && buyer.buyBox.propertyTypes.length > 0 && (
                                            <div className="col-span-2 flex items-center gap-1.5 mt-1 pt-2 border-t border-gray-200 dark:border-gray-700">
                                                <Building size={12} className="text-gray-400"/>
                                                <span className="font-medium text-blue-600 dark:text-blue-400">{buyer.buyBox.propertyTypes.join(', ')}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Action Bar */}
                                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700/50">
                                    <div className="flex gap-4">
                                        {buyer.phone && (
                                            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                                                <Phone size={12} /> {formatPhoneNumber(buyer.phone.split(',')[0])}
                                            </div>
                                        )}
                                        {buyer.email && (
                                            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                                                <Mail size={12} /> <span className="truncate max-w-[150px]">{buyer.email}</span>
                                            </div>
                                        )}
                                    </div>
                                    <button 
                                        className="text-blue-600 dark:text-blue-400 text-xs font-bold hover:underline flex items-center gap-1"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onViewBuyer(buyer.id);
                                        }}
                                    >
                                        Open Profile <ArrowRight size={12}/>
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center py-12 text-center opacity-60">
                            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-full mb-4">
                                <Users size={48} className="text-gray-300 dark:text-gray-600" />
                            </div>
                            <h4 className="text-lg font-bold text-gray-700 dark:text-white mb-1">No Strict Matches Found</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                                No buyers found that match <strong>BOTH</strong> this property's Location and Investment Strategy.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 flex justify-end">
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