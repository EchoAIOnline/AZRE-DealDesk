import React from 'react';
import { Users, X } from 'lucide-react';
import { Agent, FilterConfig, Brokerage } from '../../types';
import { generateId, getLogTimestamp } from '../../services/utils';
import { PageNavBar } from '../Shared/PageNavBar';
import { AgentCard } from '../Agents/AgentCard';
import { AGENT_STATUS_TABS } from '../../constants';

interface AgentsViewProps {
    agents: Agent[];
    brokerages: Brokerage[];
    agentSearch: string;
    setAgentSearch: (val: string) => void;
    agentStage: string;
    setAgentStage: (val: string) => void;
    agentSort: string;
    setAgentSort: (val: string) => void;
    showFilterMenu: boolean;
    setShowFilterMenu: (val: boolean) => void;
    filterConfig: FilterConfig;
    setFilterConfig: (val: FilterConfig) => void;
    filteredAgentsBySearch: Agent[];
    sortedAgents: Agent[];
    setAgentModalZIndex: (val: string) => void;
    setEditingAgent: (agent: Agent) => void;
    setViewingAgent: (agent: Agent) => void;
    setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
    api: any;
}

export const AgentsView: React.FC<AgentsViewProps> = ({
    agents, brokerages, agentSearch, setAgentSearch, agentStage, setAgentStage,
    agentSort, setAgentSort, showFilterMenu, setShowFilterMenu, filterConfig,
    setFilterConfig, filteredAgentsBySearch, sortedAgents,
    setAgentModalZIndex, setEditingAgent, setViewingAgent, setAgents, api
}) => {
    return (
        <div className="w-full">
            <PageNavBar 
                title="Agent Database" 
                icon={<Users/>} 
                searchValue={agentSearch} 
                onSearchChange={setAgentSearch} 
                searchPlaceholder="Search agents by name or brokerage..." 
                tabs={AGENT_STATUS_TABS.map(tab => ({ 
                    ...tab, 
                    count: tab.id === 'All Agents' ? filteredAgentsBySearch.length : 
                           tab.id === 'Contacted' ? filteredAgentsBySearch.filter(a => a.spokeWithAgent).length : 
                           tab.id === 'Investor Friendly' ? filteredAgentsBySearch.filter(a => a.investorFriendly).length : 
                           tab.id === 'Agreed to Send' ? filteredAgentsBySearch.filter(a => a.agreedToSend).length : 
                           tab.id === 'Closed Deals' ? filteredAgentsBySearch.filter(a => a.hasClosedDeals).length : 
                           tab.id === 'DO NOT CALL' ? filteredAgentsBySearch.filter(a => a.doNotCall).length : 0
                }))} 
                activeTab={agentStage} 
                onTabChange={setAgentStage} 
                sortOptions={[
                    { value: 'A-Z', label: 'A to Z' }, 
                    { value: 'Z-A', label: 'Z to A' }, 
                    { value: 'Brokerage', label: 'Brokerage' }, 
                    { value: 'Last Contacted', label: 'Last Contacted' }, 
                    { value: 'Next Follow-Up', label: 'Next Follow-Up' }
                ]} 
                sortValue={agentSort} 
                onSortChange={setAgentSort} 
                onToggleFilter={() => setShowFilterMenu(!showFilterMenu)} 
                isFilterOpen={showFilterMenu} 
                isFilterActive={filterConfig.type !== 'All'} 
                filterContent={
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Brokerage</label>
                            <select className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2" onChange={e => setFilterConfig({type: 'Brokerage', value: e.target.value})} value={filterConfig.type === 'Brokerage' ? filterConfig.value : ''}>
                                <option value="">All Brokerages</option>
                                {brokerages.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Relationship</label>
                            <select className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2" onChange={e => setFilterConfig({type: 'Relationship', value: e.target.value})} value={filterConfig.type === 'Relationship' ? filterConfig.value : ''}>
                                <option value="">All Agents</option>
                                <option value="Contacted">Contacted Already</option>
                                <option value="Investor Friendly">Investor Friendly</option>
                                <option value="Agreed to Send">Agreed to Send Deals</option>
                                <option value="Closed Deals">Closed With AZRE</option>
                                <option value="DO NOT CALL">DO NOT CALL</option>
                            </select>
                        </div>
                        <div className="col-span-full flex justify-end">
                            <button onClick={() => setFilterConfig({ type: 'All', value: '' })} className="text-sm text-red-500 hover:underline">Clear Filters</button>
                        </div>
                    </div>
                } 
                actionLabel="Add Agent" 
                onAction={() => {
                    setAgentModalZIndex('z-[160]');
                    setEditingAgent({
                        id: generateId(),
                        name: '',
                        phone: '',
                        email: '',
                        brokerage: '',
                        notes: [`${getLogTimestamp()}: Manually created`]
                    } as Agent);
                }} 
            />
            <div className="max-w-full mx-auto p-4 md:p-8">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {sortedAgents.length > 0 ? sortedAgents.map(agent => (
                        <AgentCard 
                            key={agent.id} 
                            agent={agent} 
                            onEdit={(a) => { setAgentModalZIndex('z-[140]'); setEditingAgent(a); }} 
                            onDelete={async (id) => {
                                const success = await api.delete(id,'Agents'); 
                                if(success) setAgents(prev=>prev.filter(a=>a.id!==id));
                            }} 
                            onView={(a) => { setAgentModalZIndex('z-[140]'); setViewingAgent(a); }} 
                        />
                    )) : (
                        <div className="col-span-full text-center text-gray-500 py-10 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-100 dark:bg-gray-800/20">No agents found matching your criteria.</div>
                    )}
                </div>
            </div>
        </div>
    );
};
