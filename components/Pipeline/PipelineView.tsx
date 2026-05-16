import React from 'react';
import { Layout, X } from 'lucide-react';
import { Deal, Agent, FilterConfig } from '../../types';
import { PageNavBar } from '../Shared/PageNavBar';
import { DealCard } from '../Deals/DealCard';
import { POTENTIAL_STATUSES, UNDER_CONTRACT_STATUSES, CLOSED_STATUSES, DECLINED_STATUSES, COUNTER_STATUSES, OFFER_DECISIONS, SUB_MARKETS, JV_PIPELINE_STATUSES } from '../../constants';

interface PipelineViewProps {
    title?: string;
    pipelineType?: 'main' | 'jv';
    deals: Deal[];
    agents: Agent[];
    pipelineSearch: string;
    setPipelineSearch: (val: string) => void;
    pipelineStage: string;
    setPipelineStage: (val: string) => void;
    pipelineSort: string;
    setPipelineSort: (val: string) => void;
    showFilterMenu: boolean;
    setShowFilterMenu: (val: boolean) => void;
    filterConfig: FilterConfig;
    setFilterConfig: (val: FilterConfig) => void;
    agentFilterSearch: string;
    setAgentFilterSearch: (val: string) => void;
    showAgentFilterSuggestions: boolean;
    setShowAgentFilterSuggestions: (val: boolean) => void;
    handleAddDeal: () => void;
    updateDeal: (id: string, updates: Partial<Deal>) => void;
    setDealModalZIndex: (val: string) => void;
    setEditingDeal: (deal: Deal) => void;
    filteredDeals: Deal[];
    orderedDeals: Deal[];
    handleDeleteDeal: (id: string) => void;
}

export const PipelineView: React.FC<PipelineViewProps> = ({
    title = "Pipeline",
    pipelineType = "main",
    deals, agents, pipelineSearch, setPipelineSearch, pipelineStage, setPipelineStage,
    pipelineSort, setPipelineSort, showFilterMenu, setShowFilterMenu, filterConfig,
    setFilterConfig, agentFilterSearch, setAgentFilterSearch, showAgentFilterSuggestions,
    setShowAgentFilterSuggestions, handleAddDeal, updateDeal, setDealModalZIndex,
    setEditingDeal, filteredDeals, orderedDeals, handleDeleteDeal
}) => {
    const tabs = pipelineType === 'jv' ? [
        { id: 'All Deals', label: 'All Deals', count: filteredDeals.length, activeColorClass: 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400' },
        { id: 'Available', label: 'Available', count: filteredDeals.filter(d => d.offerDecision === 'Available').length, activeColorClass: 'text-green-600 dark:text-green-400 border-green-600 dark:border-green-400' },
        { id: 'No Longer Available', label: 'No Longer Available', count: filteredDeals.filter(d => d.offerDecision === 'No Longer Available').length, activeColorClass: 'text-red-600 dark:text-red-400 border-red-600 dark:border-red-400' }
    ] : [
        { id: 'All Deals', label: 'All Deals', count: filteredDeals.length, activeColorClass: 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400' }, 
        { id: 'Potential', label: 'Potential', count: filteredDeals.filter(d => POTENTIAL_STATUSES.includes(d.offerDecision)).length, activeColorClass: 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400' }, 
        { id: 'Under Contract', label: 'Under Contract', count: filteredDeals.filter(d => UNDER_CONTRACT_STATUSES.includes(d.offerDecision)).length, activeColorClass: 'text-green-600 dark:text-green-400 border-green-600 dark:border-green-400' }, 
        { id: 'Closed', label: 'Closed', count: filteredDeals.filter(d => CLOSED_STATUSES.includes(d.offerDecision)).length, activeColorClass: 'text-purple-600 dark:text-purple-400 border-purple-600 dark:border-purple-400' }, 
        { id: 'Declined', label: 'Declined', count: filteredDeals.filter(d => DECLINED_STATUSES.includes(d.offerDecision)).length, activeColorClass: 'text-red-600 dark:text-red-400 border-red-600 dark:border-red-400' }
    ];

    return (
        <div className="w-full">
            <PageNavBar 
                title={title} 
                icon={<Layout/>} 
                searchValue={pipelineSearch} 
                onSearchChange={setPipelineSearch} 
                searchPlaceholder="Search active deals..." 
                tabs={tabs} 
                activeTab={pipelineStage} 
                onTabChange={setPipelineStage} 
                sortOptions={[
                    { value: 'Date Newest', label: 'Date Newest' }, 
                    { value: 'Date Oldest', label: 'Date Oldest' }, 
                    { value: 'Price High-Low', label: 'Price High-Low' }, 
                    { value: 'Price Low-High', label: 'Price Low-High' }
                ]} 
                sortValue={pipelineSort} 
                onSortChange={setPipelineSort} 
                onToggleFilter={() => setShowFilterMenu(!showFilterMenu)} 
                isFilterOpen={showFilterMenu} 
                isFilterActive={filterConfig.type !== 'All'} 
                filterContent={
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Acq Manager</label>
                            <select className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2" value={filterConfig.type === 'Acquisition Manager' ? filterConfig.value : ''} onChange={e => { if (e.target.value) setFilterConfig({type: 'Acquisition Manager', value: e.target.value}); else setFilterConfig({type: 'All', value: ''}); setAgentFilterSearch(''); }}>
                                <option value="">All Managers</option>
                                <option value="Ashari Zakar">Ashari Zakar</option>
                                <option value="Angelica Henderson">Angelica Henderson</option>
                                <option value="Grias Ramos">Grias Ramos</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Deal Strategy</label>
                            <select className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2" value={filterConfig.type === 'Deal Type' ? filterConfig.value : ''} onChange={e => { if (e.target.value) setFilterConfig({type: 'Deal Type', value: e.target.value}); else setFilterConfig({type: 'All', value: ''}); setAgentFilterSearch(''); }}>
                                <option value="">All Types</option>
                                <option value="Renovation">Renovation</option>
                                <option value="Rental">Rental</option>
                                <option value="Wholesale">Wholesale</option>
                                <option value="New Construction">New Construction</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Listing Type</label>
                            <select className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2" value={filterConfig.type === 'Listing Type' ? filterConfig.value : ''} onChange={e => { if (e.target.value) setFilterConfig({type: 'Listing Type', value: e.target.value}); else setFilterConfig({type: 'All', value: ''}); setAgentFilterSearch(''); }}>
                                <option value="">All Types</option>
                                <option value="Listed On MLS">Listed On MLS</option>
                                <option value="Off-Market">Off-Market</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Contact Status</label>
                            <select className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2" value={filterConfig.type === 'Contact Status' ? filterConfig.value : ''} onChange={e => { if (e.target.value) setFilterConfig({type: 'Contact Status', value: e.target.value}); else setFilterConfig({type: 'All', value: ''}); setAgentFilterSearch(''); }}>
                                <option value="">All Statuses</option>
                                {pipelineType === 'jv' ? (
                                    <>
                                        <option value="Have Not Spoken With Wholesaler">Have Not Spoken With Wholesaler</option>
                                        <option value="Spoke With Wholesaler">Spoke With Wholesaler</option>
                                    </>
                                ) : (
                                    <>
                                        <option value="Agent Not Contacted Yet">Agent Not Contacted Yet</option>
                                        <option value="Sent LOI Email">Sent LOI Email</option>
                                        <option value="Sent Initial Text Message">Sent Initial Text Message</option>
                                        <option value="First Call, No Answer">First Call, No Answer</option>
                                        <option value="Spoke With Agent">Spoke With Agent</option>
                                        <option value="Waiting To Hear Back">Waiting To Hear Back</option>
                                        <option value="Offer Declined">Offer Declined</option>
                                        <option value="Offer Accepted">Offer Accepted</option>
                                    </>
                                )}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Sub-Market</label>
                            <select className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2" value={filterConfig.type === 'Sub-Market' ? filterConfig.value : ''} onChange={e => { if (e.target.value) setFilterConfig({type: 'Sub-Market', value: e.target.value}); else setFilterConfig({type: 'All', value: ''}); setAgentFilterSearch(''); }}>
                                <option value="">All Markets</option>
                                {SUB_MARKETS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1 relative z-20">
                            <label className="text-xs font-bold text-gray-500 uppercase">{pipelineType === 'jv' ? 'Wholesaler Name' : 'Agent Name'}</label>
                            <div className="relative">
                                <input type="text" className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 focus:border-blue-500 outline-none" placeholder={`Search ${pipelineType === 'jv' ? 'Wholesaler' : 'Agent'}...`} value={agentFilterSearch} onChange={(e) => { const val = e.target.value; setAgentFilterSearch(val); if (filterConfig.type === 'Agent Name') setFilterConfig({ type: 'All', value: '' }); setShowAgentFilterSuggestions(true); }} onFocus={() => setShowAgentFilterSuggestions(true)} onBlur={() => setTimeout(() => setShowAgentFilterSuggestions(false), 200)} />
                                {showAgentFilterSuggestions && agentFilterSearch && (
                                    <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-b-lg shadow-xl z-50 max-h-48 overflow-y-auto mt-1">
                                        {agents.filter(a => a.name.toLowerCase().includes(agentFilterSearch.toLowerCase())).map(a => (
                                            <div key={a.id} className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer text-sm text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 last:border-0" onMouseDown={() => { setFilterConfig({ type: 'Agent Name', value: a.name }); setAgentFilterSearch(a.name); setShowAgentFilterSuggestions(false); }}>{a.name}</div>
                                        ))}
                                        {agents.filter(a => a.name.toLowerCase().includes(agentFilterSearch.toLowerCase())).length === 0 && (<div className="p-2 text-xs text-gray-500 italic">No {pipelineType === 'jv' ? 'wholesalers' : 'agents'} found</div>)}
                                    </div>
                                )}
                                {filterConfig.type === 'Agent Name' && (<button onClick={() => { setFilterConfig({ type: 'All', value: '' }); setAgentFilterSearch(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"><X size={14} /></button>)}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Special</label>
                            <button onClick={() => { setFilterConfig({type: 'Show Counter Offers Only', value: 'true'}); setAgentFilterSearch(''); }} className={`w-full text-sm border rounded p-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 ${filterConfig.type === 'Show Counter Offers Only' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-600 dark:text-blue-400' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}>Show Counter Offers</button>
                        </div>
                        <div className="col-span-full flex justify-end">
                            <button onClick={() => { setFilterConfig({ type: 'All', value: '' }); setAgentFilterSearch(''); }} className="text-sm text-red-500 hover:underline">Clear Filters</button>
                        </div>
                    </div>
                } 
                actionLabel="Add Deal" 
                onAction={handleAddDeal} 
            />
            <div className="px-4 md:px-8 pb-8 pt-4">
                {(() => { 
                    let statusesToShow: string[] = []; 
                    if (pipelineType === 'jv') {
                        if (pipelineStage === 'All Deals') statusesToShow = JV_PIPELINE_STATUSES;
                        else if (pipelineStage === 'Available') statusesToShow = ['Available'];
                        else if (pipelineStage === 'No Longer Available') statusesToShow = ['No Longer Available'];
                    } else {
                        if (filterConfig.type === 'Show Counter Offers Only') statusesToShow = COUNTER_STATUSES; 
                        else if (pipelineStage === 'All Deals') statusesToShow = OFFER_DECISIONS; 
                        else { 
                            switch(pipelineStage) { 
                                case 'Potential': statusesToShow = POTENTIAL_STATUSES; break; 
                                case 'Under Contract': statusesToShow = UNDER_CONTRACT_STATUSES; break; 
                                case 'Closed': statusesToShow = CLOSED_STATUSES; break; 
                                case 'Declined': statusesToShow = DECLINED_STATUSES; break; 
                            } 
                        } 
                    }
                    const stageDeals = orderedDeals; 
                    if (stageDeals.length === 0) return (<div className="text-center py-20 text-gray-500"><p>No deals found in this stage matching your criteria.</p></div>); 
                    return statusesToShow.map(status => { 
                        const dealsInGroup = stageDeals.filter(d => d.offerDecision === status); 
                        if (dealsInGroup.length === 0) return null; 
                        return (
                            <div key={status} className="mb-10 scroll-mt-24">
                                <div className="flex items-center gap-4 mb-4">
                                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{status}</h3>
                                    <div className="h-px bg-gray-300 dark:bg-gray-800 flex-1"></div>
                                    <span className="text-xs font-mono text-gray-500 bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded-full">{dealsInGroup.length}</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
                                    {dealsInGroup.map(deal => (
                                        <DealCard 
                                            key={deal.id} 
                                            deal={deal} 
                                            agents={agents} 
                                            onMove={(id, dec) => updateDeal(id, {offerDecision: dec})} 
                                            onUpdate={updateDeal} 
                                            onDelete={handleDeleteDeal} 
                                            onEdit={(d) => { setDealModalZIndex('z-[120]'); setEditingDeal(d); }}
                                        />
                                    ))}
                                </div>
                            </div>
                        ); 
                    }); 
                })()}
            </div>
        </div>
    );
};
