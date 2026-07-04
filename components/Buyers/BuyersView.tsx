import React from 'react';
import { Users } from 'lucide-react';
import { Buyer, FilterConfig } from '../../types';
import { PageNavBar } from '../Shared/PageNavBar';
import { BuyerCard } from '../Buyers/BuyerCard';
import { BUYER_STATUS_TABS } from '../../constants';

interface BuyersViewProps {
    buyers: Buyer[];
    buyerSearch: string;
    setBuyerSearch: (val: string) => void;
    buyerStage: string;
    setBuyerStage: (val: string) => void;
    buyerSort: string;
    setBuyerSort: (val: string) => void;
    showFilterMenu: boolean;
    setShowFilterMenu: (val: boolean) => void;
    filterConfig: FilterConfig;
    setFilterConfig: (val: FilterConfig) => void;
    filteredBuyersBySearch: Buyer[];
    sortedBuyers: Buyer[];
    handleAddBuyer: () => void;
    setEditingBuyer: (buyer: Buyer) => void;
    setShowAddBuyerModal: (val: boolean) => void;
    handleDeleteBuyer: (id: string) => void;
    handleUpdateBuyer: (id: string, updates: Partial<Buyer>) => void;
}

export const BuyersView: React.FC<BuyersViewProps> = ({
    buyers, buyerSearch, setBuyerSearch, buyerStage, setBuyerStage,
    buyerSort, setBuyerSort, showFilterMenu, setShowFilterMenu, filterConfig,
    setFilterConfig, filteredBuyersBySearch, sortedBuyers, handleAddBuyer,
    setEditingBuyer, setShowAddBuyerModal, handleDeleteBuyer, handleUpdateBuyer
}) => {
    return (
        <div className="w-full">
            <PageNavBar 
                title="Buyer Database" 
                icon={<Users/>} 
                searchValue={buyerSearch} 
                onSearchChange={setBuyerSearch} 
                searchPlaceholder="Search buyers..." 
                tabs={BUYER_STATUS_TABS.map(tab => ({ 
                    ...tab, 
                    count: tab.id === 'All Buyers' ? filteredBuyersBySearch.length : filteredBuyersBySearch.filter(b => b.status && b.status.includes(tab.id)).length 
                }))} 
                activeTab={buyerStage} 
                onTabChange={setBuyerStage} 
                onToggleFilter={() => setShowFilterMenu(!showFilterMenu)} 
                isFilterOpen={showFilterMenu} 
                isFilterActive={filterConfig.type !== 'All'} 
                filterContent={
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Status</label>
                            <select className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2" onChange={e => { if(e.target.value) setFilterConfig({type: 'Buyer Status', value: e.target.value}); else setFilterConfig({type: 'All', value: ''}); }} value={filterConfig.type === 'Buyer Status' ? filterConfig.value : ''}>
                                <option value="">All Statuses</option>
                                <option value="VIP Buyer">VIP Buyer</option>
                                <option value="Repeat Buyer">Repeat Buyer</option>
                                <option value="Vetted Buyer">Vetted Buyer</option>
                                <option value="New Lead">New Lead</option>
                                <option value="Deactivated">Deactivated</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Target Location</label>
                            <input type="text" className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 focus:border-blue-500 outline-none" placeholder="Zip, City, or County..." value={filterConfig.type === 'Target Location' ? filterConfig.value : ''} onChange={e => { if (e.target.value) setFilterConfig({type: 'Target Location', value: e.target.value}); else setFilterConfig({type: 'All', value: ''}); }} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Sort By</label>
                            <select className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2" value={buyerSort} onChange={e => setBuyerSort(e.target.value)}>
                                <option value="Date Added - Newest">Date Added - Newest</option>
                                <option value="Date Added - Oldest">Date Added - Oldest</option>
                                <option value="A-Z">A to Z</option>
                                <option value="Z-A">Z to A</option>
                                <option value="Properties Bought">Properties Bought</option>
                            </select>
                        </div>
                        <div className="col-span-full flex justify-end">
                            <button onClick={() => { setFilterConfig({ type: 'All', value: '' }); setBuyerSort('Date Added - Newest'); }} className="text-sm text-red-500 hover:underline">Clear Filters</button>
                        </div>
                    </div>
                } 
                actionLabel="Add Buyer" 
                onAction={handleAddBuyer} 
            />
            <div className="max-w-full mx-auto p-4 md:p-8">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {sortedBuyers.length > 0 ? sortedBuyers.map(buyer => (
                        <BuyerCard 
                            key={buyer.id} 
                            buyer={buyer} 
                            onEdit={(b) => { setEditingBuyer(b); setShowAddBuyerModal(true); }} 
                            onDelete={handleDeleteBuyer} 
                            onUpdate={handleUpdateBuyer} 
                        />
                    )) : (
                        <div className="col-span-full text-center text-gray-500 py-10 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-100 dark:bg-gray-800/20">No buyers found matching your filters.</div>
                    )}
                </div>
            </div>
        </div>
    );
};
