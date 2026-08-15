import React, { useState } from 'react';
import { Layout, X, Mail, Loader2, CheckCircle } from 'lucide-react';
import { Deal, Agent, FilterConfig, Campaign } from '../../types';
import { PageNavBar } from '../Shared/PageNavBar';
import { DealCard } from '../Deals/DealCard';
import { POTENTIAL_STATUSES, UNDER_CONTRACT_STATUSES, CLOSED_STATUSES, DECLINED_STATUSES, COUNTER_STATUSES, OFFER_DECISIONS, SUB_MARKETS, DFD_PIPELINE_STATUSES } from '../../constants';
import { useAppStore } from '../../store/useAppStore';
import { api, sendBulkEmailGAS } from '../../services/api';
import { generateId, formatCurrency } from '../../services/utils';
import { mockOfferTemplates } from '../../services/mockData';

interface PipelineViewProps {
    title?: string;
    pipelineType?: 'mls' | 'off-market' | 'dfd';
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
    pipelineType = "mls",
    deals, agents, pipelineSearch, setPipelineSearch, pipelineStage, setPipelineStage,
    pipelineSort, setPipelineSort, showFilterMenu, setShowFilterMenu, filterConfig,
    setFilterConfig, agentFilterSearch, setAgentFilterSearch, showAgentFilterSuggestions,
    setShowAgentFilterSuggestions, handleAddDeal, updateDeal, setDealModalZIndex,
    setEditingDeal, filteredDeals, orderedDeals, handleDeleteDeal
}) => {
    const [selectedDealIds, setSelectedDealIds] = useState<string[]>([]);
    
    const [isBlastModalOpen, setIsBlastModalOpen] = useState(false);
    const [blastProgress, setBlastProgress] = useState(0);
    const [blastTotal, setBlastTotal] = useState(0);
    const [isBlastComplete, setIsBlastComplete] = useState(false);

    const { campaigns, setCampaigns, setAgents, currentUser } = useAppStore();

    const handleSelectDeal = (id: string, selected: boolean) => {
        if (selected) {
            setSelectedDealIds(prev => [...prev, id]);
        } else {
            setSelectedDealIds(prev => prev.filter(dealId => dealId !== id));
        }
    };

    const handleSendLOIToAll = async () => {
        if (selectedDealIds.length === 0) return;
        
        const total = selectedDealIds.length;
        setBlastTotal(total);
        setBlastProgress(0);
        setIsBlastComplete(false);
        setIsBlastModalOpen(true);
        
        const template = mockOfferTemplates[0]; // Default template
        const defaultSubject = "Offer for {{Property_Address}}";
        const fromEmail = currentUser?.email || "asharizakarrei@gmail.com";
        
        let sentCount = 0;
        let deliveredCount = 0;
        for (const dealId of selectedDealIds) {
            const deal = orderedDeals.find(d => d.id === dealId);
            if (!deal) {
                sentCount++;
                setBlastProgress(sentCount);
                continue;
            }

            const agent = deal.agentName ? agents.find(a => a.name === deal.agentName) : null;
            const targetEmail = agent?.email || deal.agentEmail;
            
            if (targetEmail) {
                const agentFirstName = agent ? agent.name.split(' ')[0] : (deal.agentName ? deal.agentName.split(' ')[0] : "Agent");
                const agentName = agent ? agent.name : (deal.agentName || "Agent");
                const offerPriceStr = deal.offerPrice ? formatCurrency(deal.offerPrice) : "[Offer Price]";
                const propAddress = deal.street || "[Property Address]";

                let body = template.emailBody || "";
                if (template.loiBody) {
                    body += `<br/><br/>---<br/><br/>${template.loiBody}`;
                }
                body = body.replace(/{{Agent_Name}}/g, agentName)
                           .replace(/{{Agent_First_Name}}/g, agentFirstName)
                           .replace(/{{Property_Address}}/g, propAddress)
                           .replace(/{{Offer_Amount}}/g, offerPriceStr)
                           .replace(/{{Your_Phone}}/g, "[Your Phone]")
                           .replace(/{{Your_Address}}/g, "[Your Address]")
                           .replace(/\n/g, '<br/>');
                           
                if (currentUser?.signature) {
                    body += `<br/><br/>${currentUser.signature}`;
                }

                let subject = defaultSubject.replace(/{{Property_Address}}/g, propAddress);

                try {
                    const response = await sendBulkEmailGAS([{ email: targetEmail, name: agentName }], subject, body, fromEmail);
                    if (response && (response.status === 'success' || response.status === 'partial_success')) {
                        deliveredCount++;
                        updateDeal(dealId, { contactStatus: 'Sent LOI Email', offerDecision: 'Made Written Offer On Property', loiSent: true, loiSentDate: new Date().toISOString() });
                        
                        if (agent) {
                            api.save({ ...agent, loiSent: true, loiSentDate: new Date().toISOString() }, 'Agents').then((savedAgent: any) => {
                                if(savedAgent) setAgents((prev: any) => prev.map((a: any) => a.id === agent.id ? savedAgent : a));
                            });
                        }
                    }
                } catch (e) {
                    console.error("Failed to send LOI for deal", dealId, e);
                }
            }

            sentCount++;
            setBlastProgress(sentCount);
        }
        
        setIsBlastComplete(true);
        
        // Log the Campaign
        const newCampaign: Campaign = {
            id: generateId(),
            name: `LOI Blast - ${new Date().toLocaleDateString()}`,
            type: 'loi_blast',
            status: 'finished',
            audienceSize: total,
            sent: total,
            delivered: deliveredCount,
            responses: 0,
            startDate: new Date().toISOString(),
            templateId: template.id
        };
        
        const savedCampaign = await api.save(newCampaign, 'Campaigns');
        if (savedCampaign) {
            setCampaigns(prev => [...prev, savedCampaign]);
        }
        
        setSelectedDealIds([]); // Reset selection
    };

    const tabs = pipelineType === 'dfd' ? [
        { id: 'All Deals', label: 'All Deals', count: (filteredDeals || []).length, activeColorClass: 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400' },
        { id: 'Available', label: 'Available', count: (filteredDeals || []).filter(d => d && d.offerDecision === 'Available').length, activeColorClass: 'text-green-600 dark:text-green-400 border-green-600 dark:border-green-400' },
        { id: 'No Longer Available', label: 'No Longer Available', count: (filteredDeals || []).filter(d => d && d.offerDecision === 'No Longer Available').length, activeColorClass: 'text-red-600 dark:text-red-400 border-red-600 dark:border-red-400' }
    ] : [
        { id: 'All Deals', label: 'All Deals', count: (filteredDeals || []).length, activeColorClass: 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400' }, 
        { id: 'Potential', label: 'Potential', count: (filteredDeals || []).filter(d => d && POTENTIAL_STATUSES.includes(d.offerDecision)).length, activeColorClass: 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400' }, 
        { id: 'Under Contract', label: 'Under Contract', count: (filteredDeals || []).filter(d => d && UNDER_CONTRACT_STATUSES.includes(d.offerDecision)).length, activeColorClass: 'text-green-600 dark:text-green-400 border-green-600 dark:border-green-400' }, 
        { id: 'Closed', label: 'Closed', count: (filteredDeals || []).filter(d => d && CLOSED_STATUSES.includes(d.offerDecision)).length, activeColorClass: 'text-purple-600 dark:text-purple-400 border-purple-600 dark:border-purple-400' }, 
        { id: 'Declined', label: 'Declined', count: (filteredDeals || []).filter(d => d && DECLINED_STATUSES.includes(d.offerDecision)).length, activeColorClass: 'text-red-600 dark:text-red-400 border-red-600 dark:border-red-400' }
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
                                {pipelineType === 'dfd' ? (
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
                            <label className="text-xs font-bold text-gray-500 uppercase">{pipelineType === 'dfd' ? 'Wholesaler Name' : 'Agent Name'}</label>
                            <div className="relative">
                                <input type="text" className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 focus:border-blue-500 outline-none" placeholder={`Search ${pipelineType === 'dfd' ? 'Wholesaler' : 'Agent'}...`} value={agentFilterSearch} onChange={(e) => { const val = e.target.value; setAgentFilterSearch(val); if (filterConfig.type === 'Agent Name') setFilterConfig({ type: 'All', value: '' }); setShowAgentFilterSuggestions(true); }} onFocus={() => setShowAgentFilterSuggestions(true)} onBlur={() => setTimeout(() => setShowAgentFilterSuggestions(false), 200)} />
                                {showAgentFilterSuggestions && agentFilterSearch && (
                                    <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-b-lg shadow-xl z-50 max-h-48 overflow-y-auto mt-1">
                                        {(agents || []).filter(a => a && String(a.name || '').toLowerCase().includes(String(agentFilterSearch || '').toLowerCase())).map(a => (
                                            <div key={a.id} className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer text-sm text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 last:border-0" onMouseDown={() => { setFilterConfig({ type: 'Agent Name', value: a.name }); setAgentFilterSearch(a.name); setShowAgentFilterSuggestions(false); }}>{a.name}</div>
                                        ))}
                                        {(agents || []).filter(a => a && String(a.name || '').toLowerCase().includes(String(agentFilterSearch || '').toLowerCase())).length === 0 && (<div className="p-2 text-xs text-gray-500 italic">No {pipelineType === 'dfd' ? 'wholesalers' : 'agents'} found</div>)}
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
                secondaryActionLabel={selectedDealIds.length > 0 ? "Send LOI to All" : undefined}
                onSecondaryAction={selectedDealIds.length > 0 ? handleSendLOIToAll : undefined}
            />
            <div className="px-4 md:px-8 pb-8 pt-4">
                {(() => { 
                    let statusesToShow: string[] = []; 
                    if (pipelineType === 'dfd') {
                        if (pipelineStage === 'All Deals') statusesToShow = DFD_PIPELINE_STATUSES;
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
                                            selected={selectedDealIds.includes(deal.id)}
                                            onSelect={handleSelectDeal}
                                        />
                                    ))}
                                </div>
                            </div>
                        ); 
                    }); 
                })()}
            </div>
            
            {/* LOI Blast Progress Modal */}
            {isBlastModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    LOI Blast Campaign
                                </h2>
                                {isBlastComplete && (
                                    <button 
                                        onClick={() => setIsBlastModalOpen(false)}
                                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                            
                            <div className="space-y-6 text-center py-4">
                                {!isBlastComplete ? (
                                    <>
                                        <div className="flex justify-center mb-4">
                                            <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin" />
                                        </div>
                                        <div>
                                            <p className="text-gray-900 dark:text-white font-medium text-lg">
                                                Sending Letters of Intent...
                                            </p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                Sending LOI {blastProgress} of {blastTotal}
                                            </p>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                            <div 
                                                className="bg-blue-600 dark:bg-blue-500 h-2.5 rounded-full transition-all duration-300 ease-out" 
                                                style={{ width: `${(blastProgress / blastTotal) * 100}%` }}
                                            ></div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex justify-center mb-4">
                                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                                                <CheckCircle className="w-8 h-8" />
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-gray-900 dark:text-white font-bold text-xl">
                                                Campaign Sent!
                                            </p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                                Successfully delivered {blastTotal} Letters of Intent. You can view the full report in the LOI Blast Campaigns tab.
                                            </p>
                                        </div>
                                        <div className="pt-4">
                                            <button 
                                                onClick={() => setIsBlastModalOpen(false)}
                                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
                                            >
                                                Done
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
