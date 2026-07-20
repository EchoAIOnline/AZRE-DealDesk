
import React, { useState, useEffect, useMemo } from 'react';
import { EmailManagerNav } from '../EmailManager/EmailManagerNav';
import { LOIBlastCampaignManager } from '../LOIBlastCampaignManager';
import { SubscriberListView } from '../EmailManager/SubscriberListView';
import { EditSubscriberModal } from '../EmailManager/EditSubscriberModal';
import { CreateListModal } from '../EmailManager/CreateListModal';
import { EmailTemplates } from '../EmailManager/EmailTemplates';
import { LayoutDashboard, Users, Mail, BarChart2, PlusCircle, History, Image as ImageIcon, FileCode, Plus, ChevronRight, Tag, ShieldCheck, UserCheck, Star, PhoneForwarded, Heart, Handshake, CheckSquare, Copy, Search, X, Trash2, AlertTriangle, ChevronDown, ChevronUp, Edit2, Split, UserPlus, Building, Briefcase, List } from 'lucide-react';
import { Buyer, Agent, Deal, Wholesaler, EmailList } from '../../types';
import { api, sendEmail, Recipient } from '../../services/api';
import { generateId, getLogTimestamp } from '../../services/utils';

interface CampaignsProps {
    buyers: Buyer[];
    agents: Agent[];
    wholesalers: Wholesaler[];
    deals: Deal[]; 
    campaigns?: any[]; // History of sent blasts
    emailLists?: EmailList[]; // Custom created lists
    onUpdateContact: (type: 'buyer' | 'agent', updatedContact: any) => Promise<void>;
    onCreateList?: (list: EmailList) => Promise<void>;
    onDeleteList?: (id: string) => Promise<void>;
}

export const Campaigns: React.FC<CampaignsProps> = ({ 
    buyers, agents, wholesalers, deals, campaigns = [], emailLists = [], 
    onUpdateContact, onCreateList, onDeleteList 
}) => {
    const [currentTab, setCurrentTab] = useState('Dashboard');
    const [currentSubTab, setCurrentSubTab] = useState('All campaigns');
    
    // Initialize with props
    const [localCampaigns, setLocalCampaigns] = useState<any[]>(campaigns || []);
    const [editingCampaign, setEditingCampaign] = useState<any | null>(null);
    const [showCreateListModal, setShowCreateListModal] = useState(false);
    
    // Deletion State
    const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);
    const [listToDelete, setListToDelete] = useState<string | null>(null);
    
    // Track deleted IDs to prevent them from reappearing due to prop sync
    const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

    // List View State
    const [expandedListIds, setExpandedListIds] = useState<Set<string>>(new Set());
    
    // Synchronize local state when database props finish loading or change
    useEffect(() => {
        if (campaigns && Array.isArray(campaigns)) {
            setLocalCampaigns(prev => {
                const localMap = new Map<string, any>(prev.map(c => [c.id, c]));
                campaigns.forEach(c => {
                    // Update or Add if not deleted
                    if (c && c.id && !deletedIds.has(c.id)) {
                        localMap.set(c.id, c);
                    }
                });
                return Array.from(localMap.values()).sort((a: any, b: any) => {
                    const dateA = new Date(a.sentAt || a.created_at || a.last_updated || 0).getTime();
                    const dateB = new Date(b.sentAt || b.created_at || b.last_updated || 0).getTime();
                    if (isNaN(dateA)) return 1;
                    if (isNaN(dateB)) return -1;
                    return dateB - dateA;
                });
            });
        }
    }, [campaigns, deletedIds]);

    // Lists Navigation State
    const [viewingList, setViewingList] = useState<{ title: string, data: any[], type: 'buyer' | 'agent' } | null>(null);
    const [editingContact, setEditingContact] = useState<{data: any, type: 'buyer' | 'agent'} | null>(null);

    const activeCampaigns = useMemo(() => {
        return (localCampaigns || []).filter(c => c && !deletedIds.has(c.id) && c.type === 'loi_blast');
    }, [localCampaigns, deletedIds]);

    const totalSubscribers = (agents?.length || 0) + (wholesalers?.length || 0);
    const activeListsCount = 2 + (emailLists ? emailLists.filter(list => list.source === 'agent' || list.source === 'wholesaler').length : 0);

    // Calculate dynamic stats
    const totalSentCount = useMemo(() => 
        activeCampaigns.reduce((sum, campaign) => 
            (campaign && (campaign.status === 'Sent' || campaign.status === 'finished')) ? sum + (campaign.recipientCount || campaign.recipient_count || 0) : sum, 0
        ), [activeCampaigns]);
    const displaySentCount = totalSentCount > 0 ? totalSentCount.toLocaleString() : "0";

    const formatCampaignDate = (dateStr?: string) => {
        if (!dateStr) return 'Draft';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric', 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
    };

    // --- SEGMENT DEFINITIONS ---
    const buyerSegments = [
        { id: 'all_buyers', name: 'All Buyers', type: 'Main List', icon: <Users size={16} className="text-blue-400" />, filter: (b: Buyer) => true },
        { id: 'new_leads', name: 'New Leads', type: 'Segment', icon: <Tag size={14} className="text-yellow-500" />, filter: (b: Buyer) => b.status?.includes('New Lead'), indent: true },
        { id: 'vetted', name: 'Vetted Buyers', type: 'Segment', icon: <ShieldCheck size={14} className="text-blue-500" />, filter: (b: Buyer) => b.status?.includes('Vetted Buyer'), indent: true },
        { id: 'repeat', name: 'Repeat Buyers', type: 'Segment', icon: <UserCheck size={14} className="text-green-500" />, filter: (b: Buyer) => b.status?.includes('Repeat Buyer'), indent: true },
        { id: 'vip', name: 'VIP Buyers', type: 'Segment', icon: <Star size={14} className="text-purple-500" />, filter: (b: Buyer) => b.status?.includes('VIP Buyer'), indent: true },
    ];

    const agentSegments = [
        { id: 'all_agents', name: 'All Agents', type: 'Main List', icon: <Users size={16} className="text-purple-400" />, filter: (a: Agent) => true },
        { id: 'contacted', name: 'Agents Contacted Already', type: 'Segment', icon: <PhoneForwarded size={14} className="text-orange-500" />, filter: (a: Agent) => a.spokeWithAgent, indent: true },
        { id: 'investor_friendly', name: 'Investor Friendly', type: 'Segment', icon: <Heart size={14} className="text-pink-500" />, filter: (a: Agent) => a.investorFriendly, indent: true },
        { id: 'agreed_to_send', name: 'Agreed to Send Deals', type: 'Segment', icon: <Handshake size={14} className="text-indigo-500" />, filter: (a: Agent) => a.agreedToSend, indent: true },
        { id: 'closed_azre', name: 'Closed With AZRE', type: 'Segment', icon: <CheckSquare size={14} className="text-green-500" />, filter: (a: Agent) => a.hasClosedDeals || (a.closedDealIds && a.closedDealIds.length > 0), indent: true },
    ];

    const wholesalerSegments = [
        { id: 'all_wholesalers', name: 'All Wholesalers', type: 'Main List', icon: <Users size={16} className="text-orange-400" />, filter: (w: Wholesaler) => true },
        { id: 'new_leads', name: 'New Leads', type: 'Segment', icon: <Tag size={14} className="text-blue-500" />, filter: (w: Wholesaler) => w.status === 'New', indent: true },
        { id: 'vetted', name: 'Vetted', type: 'Segment', icon: <ShieldCheck size={14} className="text-green-500" />, filter: (w: Wholesaler) => w.status === 'Vetted', indent: true },
        { id: 'jv', name: 'JV Partners', type: 'Segment', icon: <Handshake size={14} className="text-purple-500" />, filter: (w: Wholesaler) => w.status === 'JV Partner', indent: true },
    ];

    const getSegmentFilter = (source: string, rule: string) => {
        if (source === 'buyer') {
            if (rule === 'new_lead') return (b: Buyer) => b.status?.includes('New Lead');
            if (rule === 'vetted') return (b: Buyer) => b.status?.includes('Vetted Buyer');
            if (rule === 'vip') return (b: Buyer) => b.status?.includes('VIP Buyer');
            if (rule === 'repeat') return (b: Buyer) => b.status?.includes('Repeat Buyer');
            return (b: Buyer) => true;
        } else {
            if (rule === 'contacted') return (a: Agent) => a.spokeWithAgent;
            if (rule === 'investor_friendly') return (a: Agent) => a.investorFriendly;
            if (rule === 'closed') return (a: Agent) => a.hasClosedDeals;
            return (a: Agent) => true;
        }
    };

    const databaseLists = [
        {
            id: 'agent_db',
            name: 'Agent Database',
            type: 'agent' as const,
            icon: <Briefcase size={24} />,
            colorClass: 'text-purple-500 bg-purple-500/10',
            data: agents,
            segments: agentSegments,
            description: 'Real estate agents and brokers',
            isSystem: true
        },
        {
            id: 'wholesaler_db',
            name: 'Wholesaler Database',
            type: 'wholesaler' as const,
            icon: <Building size={24} />,
            colorClass: 'text-orange-500 bg-orange-500/10',
            data: wholesalers,
            segments: wholesalerSegments,
            description: 'Wholesalers and partners',
            isSystem: true
        },
        // Map custom email lists
        ...emailLists
            .filter(list => list.source === 'agent' || list.source === 'wholesaler')
            .map(list => {
            const data = list.source === 'agent' ? agents : list.source === 'wholesaler' ? wholesalers : buyers;
            const filter = getSegmentFilter(list.source, list.segmentRule || 'all');
            const filteredData = data.filter(filter as any);
            
            return {
                id: list.id,
                name: list.name,
                type: list.source as 'buyer' | 'agent' | 'wholesaler',
                icon: <List size={24} />,
                colorClass: list.source === 'agent' ? 'text-indigo-500 bg-indigo-500/10' : 'text-orange-500 bg-orange-500/10',
                data: filteredData,
                segments: [{ 
                    id: 'all_subscribers', 
                    name: 'All Subscribers', 
                    type: 'Main List', 
                    icon: <Users size={16} className={list.source === 'buyer' ? "text-teal-400" : "text-indigo-400"} />, 
                    filter: (item: any) => true 
                }],
                description: `${list.type === 'segment' ? 'Dynamic Segment' : 'Custom List'} • Created ${new Date(list.createdAt).toLocaleDateString()}`,
                isSystem: false
            };
        })
    ];

    const toggleListExpand = (id: string) => {
        const newSet = new Set(expandedListIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedListIds(newSet);
    };

    const handleListClick = (title: string, data: any[], type: 'buyer' | 'agent') => {
        setViewingList({ title, data, type });
    };

    const handleSaveCampaign = async (campaignData: any) => {
        try {
            await api.saveCampaign(campaignData);
            setLocalCampaigns(prev => {
                const idx = prev.findIndex(c => c.id === campaignData.id);
                if (idx !== -1) {
                    const next = [...prev];
                    next[idx] = { ...next[idx], ...campaignData, last_updated: new Date().toISOString() };
                    return next;
                }
                return [{ ...campaignData, last_updated: new Date().toISOString() }, ...prev];
            });
        } catch (e) {
            console.error("Save campaign failed", e);
            throw e;
        }
    };

    const handleCampaignComplete = async (campaign: any) => {
        try {
            await api.save(campaign, 'Campaigns');
            // Update local state by matching ID to prevent duplicates
            setLocalCampaigns(prev => {
                const existingIndex = prev.findIndex(c => c.id === campaign.id);
                if (existingIndex >= 0) {
                    // Update existing record
                    const updated = [...prev];
                    updated[existingIndex] = campaign;
                    return updated;
                }
                // Prepend new record
                return [campaign, ...prev];
            });
            setCurrentSubTab('All campaigns');
        } catch (e) {
            console.error("Failed to save completed campaign", e);
            alert("Campaign sent but failed to save history record.");
        }
    };

    const handleSendTest = async (email: string, subject: string, body: string, templateId?: string) => {
        await sendEmail(email, subject, body);
    };

    const handleEditCampaign = (campaign: any) => {
        setEditingCampaign(campaign);
        setCurrentSubTab('Campaign Setup');
    };

    const handleDuplicateCampaign = async (campaign: any) => {
        const duplicated = {
            ...campaign,
            id: generateId(),
            name: `${campaign.name || 'Untitled'} (Copy)`,
            status: 'draft',
            sentAt: null,
            displaySentAt: null,
            last_updated: new Date().toISOString()
        };
        
        try {
            await handleSaveCampaign(duplicated);
            alert("Campaign duplicated successfully.");
        } catch (e) {
            alert("Duplication failed.");
        }
    };

    const confirmDeleteCampaign = async () => {
        if (!campaignToDelete) return;
        const id = campaignToDelete;
        setCampaignToDelete(null);

        // 1. Optimistic UI update - prevent it from showing immediately
        setDeletedIds(prev => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
        setLocalCampaigns(prev => prev.filter(c => c.id !== id));

        // 2. Perform DB deletion
        try {
            await api.delete(id, 'Campaigns');
        } catch (e) {
            console.error("Delete failed", e);
            alert("Failed to delete campaign from database.");
            // Revert optimistic deletion if needed
            setDeletedIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const confirmDeleteList = async () => {
        if (!listToDelete || !onDeleteList) return;
        const id = listToDelete;
        setListToDelete(null);
        try {
            await onDeleteList(id);
        } catch (e) {
            console.error("Failed to delete list", e);
            alert("Failed to delete list.");
        }
    };

    // Generic handler to add a contact to a list/segment
    const handleAddContactToSegment = (type: 'buyer' | 'agent' | 'wholesaler', segmentId: string) => {
        const newId = generateId();
        const baseContact = { id: newId, name: '', email: '', phone: '', createdAt: new Date().toISOString() };
        
        if (type === 'wholesaler') {
             alert("Please add wholesalers via the Wholesaler Database tab.");
             return;
        }

        setEditingContact({ data: baseContact, type: type as 'buyer' | 'agent' });
    };

    const renderContent = () => {
        if (currentTab === 'Dashboard') {
            return (
                <div className="p-8 space-y-6 animate-in fade-in duration-300">
                    <div className="flex flex-col">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">LOI Blast Campaigns</h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">System performance and delivery overview</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            { label: 'Total Sent', val: displaySentCount, color: 'text-blue-400' },
                            { label: 'Total Subscribers', val: totalSubscribers.toLocaleString(), color: 'text-green-400' },
                            { label: 'Active Lists', val: activeListsCount.toString(), color: 'text-purple-400' }
                        ].map((stat, i) => (
                            <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-xl">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">{stat.label}</p>
                                <p className={`text-3xl font-bold ${stat.color}`}>{stat.val}</p>
                            </div>
                        ))}
                    </div>

                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                            <h3 className="font-bold text-gray-900 dark:text-white">Recent Delivery History</h3>
                        </div>
                        <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                            <thead className="bg-gray-50 dark:bg-gray-900/80 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                                <tr>
                                    <th className="px-6 py-4">Campaign Name</th>
                                    <th className="px-6 py-4">Sent At</th>
                                    <th className="px-6 py-4">Recipients</th>
                                    <th className="px-6 py-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700/50">
                                {activeCampaigns.slice(0, 5).map((campaign, idx) => {
                                    const isSent = campaign.status === 'Sent' || campaign.status === 'finished';
                                    return (
                                        <tr key={campaign.id || idx} className="hover:bg-white/5 transition-colors cursor-pointer" onClick={() => handleEditCampaign(campaign)}>
                                            <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{campaign.name || 'Untitled Campaign'}</td>
                                            <td className="px-6 py-4 text-xs">{campaign.displaySentAt || formatCampaignDate(campaign.sentAt)}</td>
                                            <td className="px-6 py-4 font-mono text-xs">{campaign.recipientCount || campaign.recipient_count || 0}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                                                    isSent 
                                                    ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                                                    : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                                }`}>
                                                    {isSent ? 'Sent' : (campaign.status || 'Draft')}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {activeCampaigns.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-20 text-center text-gray-500 dark:text-gray-400 italic">No campaign history found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        }

        if (currentTab === 'Lists') {
            if (viewingList) {
                return (
                    <SubscriberListView 
                        title={viewingList.title} 
                        data={viewingList.data} 
                        onBack={() => setViewingList(null)} 
                        onEdit={(contact) => setEditingContact({ data: contact, type: viewingList.type })}
                    />
                );
            }

            return (
                <div className="p-8 space-y-10 animate-in fade-in duration-300">
                    <div className="flex justify-between items-end">
                        <div className="flex flex-col">
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Database Lists & Segments</h1>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Targeted audiences synced from your CRM records</p>
                        </div>
                        <button 
                            onClick={() => setShowCreateListModal(true)}
                            className="bg-blue-600 hover:bg-blue-50 text-gray-900 dark:text-white px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-lg active:scale-95"
                        >
                            <PlusCircle size={16} /> Create List
                        </button>
                    </div>

                    <div className="space-y-6">
                        {databaseLists.map((list) => {
                            const isExpanded = expandedListIds.has(list.id);
                            return (
                                <div key={list.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-lg transition-all hover:border-gray-300 dark:hover:border-gray-300 dark:border-gray-600">
                                    <div 
                                        className="p-6 flex flex-col md:flex-row items-center justify-between cursor-pointer gap-4"
                                        onClick={() => toggleListExpand(list.id)}
                                    >
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className={`p-4 rounded-xl ${list.colorClass}`}>
                                                {list.icon}
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{list.name}</h3>
                                                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                                    <span className="font-mono font-medium text-gray-900 dark:text-white">{list.data.length.toLocaleString()}</span> Subscribers
                                                    <span>•</span>
                                                    <span>{list.segments.length} Segments</span>
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{list.description}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-3">
                                            <button 
                                                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-colors border border-gray-300 dark:border-gray-600"
                                                onClick={(e) => { e.stopPropagation(); if (!list.isSystem) { alert('Custom list segmentation managed at creation.'); } else { setShowCreateListModal(true); } }}
                                            >
                                                <Split size={14} /> Segment
                                            </button>
                                            <button 
                                                className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                title="Edit List Settings"
                                                onClick={(e) => { e.stopPropagation(); alert('System list settings are managed automatically.'); }}
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button 
                                                className={`p-2 rounded-lg transition-colors ${list.isSystem ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' : 'text-gray-500 dark:text-gray-400 hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                                title={list.isSystem ? "System Lists Cannot Be Deleted" : "Delete List"}
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    if (list.isSystem) {
                                                        alert('Cannot delete core system databases.'); 
                                                    } else {
                                                        setListToDelete(list.id);
                                                    }
                                                }}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                            <div className={`p-2 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                                <ChevronDown size={20} className="text-gray-500 dark:text-gray-400" />
                                            </div>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 animate-in slide-in-from-top-2 duration-200">
                                            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                                                <thead className="bg-gray-50 dark:bg-gray-900/50 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                                                    <tr>
                                                        <th className="px-6 py-3">Segment Name</th>
                                                        <th className="px-6 py-3">Type</th>
                                                        <th className="px-6 py-3">Subscribers</th>
                                                        <th className="px-6 py-3 text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-700/50">
                                                    {list.segments.map((seg: any) => {
                                                        const filteredData = (list.data || []).filter(seg.filter);
                                                        return (
                                                            <tr key={seg.id} className="hover:bg-white/5 transition-colors group">
                                                                <td className={`px-6 py-3 flex items-center gap-3 ${seg.indent ? 'pl-10 text-gray-600 dark:text-gray-300' : 'font-bold text-gray-900 dark:text-white'}`}>
                                                                    {seg.icon} {seg.name}
                                                                </td>
                                                                <td className="px-6 py-3">
                                                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-tighter bg-white dark:bg-gray-800 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                                                                        {seg.type}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-3 font-mono text-xs">{filteredData.length.toLocaleString()}</td>
                                                                <td className="px-6 py-3 text-right">
                                                                    <div className="flex justify-end gap-2">
                                                                        {list.type !== 'wholesaler' && list.isSystem && (
                                                                            <button 
                                                                                className="text-gray-500 dark:text-gray-400 hover:text-green-400 p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                                                title="Add Contact to Segment"
                                                                                onClick={(e) => { 
                                                                                    e.stopPropagation(); 
                                                                                    handleAddContactToSegment(list.type as any, seg.id); 
                                                                                }}
                                                                            >
                                                                                <UserPlus size={14} />
                                                                            </button>
                                                                        )}
                                                                        <button 
                                                                            className="text-blue-500 hover:text-blue-300 text-xs font-bold px-3 py-1 rounded hover:bg-blue-500/10 transition-colors flex items-center gap-1"
                                                                            onClick={(e) => { 
                                                                                e.stopPropagation(); 
                                                                                if(list.type === 'wholesaler') return alert('Wholesaler view not fully supported in this modal yet.');
                                                                                handleListClick(seg.name, filteredData, list.type as 'buyer' | 'agent'); 
                                                                            }}
                                                                        >
                                                                            View <ChevronRight size={12} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }

        if (currentTab === 'Campaigns') {
            if (['Create new', 'Campaign Setup', 'Content'].includes(currentSubTab)) {
                return (
                    <LOIBlastCampaignManager 
                        buyers={buyers}
                        agents={agents}
                        deals={deals} 
                        wholesalers={wholesalers}
                        onSendTest={handleSendTest} 
                        onCampaignComplete={handleCampaignComplete}
                        onSaveDraft={handleSaveCampaign}
                        initialData={editingCampaign}
                        activeTab={currentSubTab === 'Content' ? 'content' : 'settings'}
                        onTabChange={(tab) => setCurrentSubTab(tab === 'content' ? 'Content' : 'Campaign Setup')}
                    />
                );
            }

            return (
                <div className="p-8 space-y-6 animate-in fade-in duration-300 h-full">
                    <div className="flex flex-col">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Campaign Operations</h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Create and manage your email campaigns</p>
                    </div>

                    <div className="space-y-4">
                        {activeCampaigns.map((c) => {
                            const isSent = c && (c.status === 'Sent' || c.status === 'finished');
                            if (!c) return null;
                            return (
                                <div 
                                    key={c.id} 
                                    onClick={() => handleEditCampaign(c)}
                                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-xl flex items-center justify-between group hover:border-blue-500/50 transition-all cursor-pointer"
                                >
                                    <div className="flex items-center gap-6">
                                        <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                                            <Mail size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{c.name || 'Untitled Campaign'}</h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">Subject: <span className="text-gray-600 dark:text-gray-300">{c.subject || '(No Subject)'}</span></p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-8">
                                        <div className="text-right">
                                            <div className="text-xl font-bold text-gray-900 dark:text-white">{c.recipientCount || c.recipient_count || 0}</div>
                                            <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-black tracking-widest">Recipients</div>
                                            <div className="text-[10px] text-blue-500 mt-1 font-bold">{c.displaySentAt || formatCampaignDate(c.sentAt)}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDuplicateCampaign(c); }}
                                                className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                                                title="Duplicate Campaign"
                                            >
                                                <Copy size={18} />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setCampaignToDelete(c.id); }}
                                                className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                                                title="Delete Campaign"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                            <div className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase ${
                                                isSent 
                                                ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                                                : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                            }`}>
                                                {isSent ? 'Sent' : (c.status || 'Draft')}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {activeCampaigns.length === 0 && (
                            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-12 flex flex-col items-center justify-center text-center shadow-xl">
                                <History size={48} className="text-gray-700 mb-4" />
                                <h2 className="text-gray-900 dark:text-white font-bold mb-1">No Recent Campaigns</h2>
                                <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs">Start a new campaign to begin reaching out to your database.</p>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        if (currentTab === 'Templates') {
            return <EmailTemplates />;
        }

        if (['Media', 'Analytics'].includes(currentTab)) {
            return (
                <div className="p-8 space-y-6 animate-in fade-in duration-300 h-full">
                    <div className="flex flex-col">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{currentTab}</h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">{currentTab} operations for AZRE DealDesk</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-20 flex flex-col items-center justify-center text-center italic text-gray-500 dark:text-gray-400 shadow-xl">
                        {currentTab} view placeholder
                    </div>
                </div>
            );
        }

        return (
            <div className="p-8 text-gray-500 dark:text-gray-400 italic">
                Invalid tab selected.
            </div>
        );
    };

    const isCampaignEditorMode = currentTab === 'Campaigns' && ['Create new', 'Campaign Setup', 'Content'].includes(currentSubTab);

    return (
        <div className="flex flex-col h-full w-full bg-gray-50 dark:bg-gray-900 overflow-hidden">
            <EmailManagerNav 
                activeTab={currentTab}
                activeSubTab={currentSubTab}
                isEditing={isCampaignEditorMode}
                onTabChange={(tab) => {
                    setCurrentTab(tab);
                    setViewingList(null); 
                    if (tab === 'Campaigns') {
                        setCurrentSubTab('All campaigns');
                        setEditingCampaign(null);
                    }
                }}
                onSubTabChange={(sub) => {
                    setCurrentSubTab(sub);
                    setViewingList(null);
                    if (sub === 'Create new') {
                        setEditingCampaign(null);
                        setCurrentSubTab('Campaign Setup');
                    }
                }}
            />
            
            <div className={`flex-1 ${isCampaignEditorMode ? 'overflow-hidden flex flex-col' : 'overflow-y-auto custom-scrollbar'}`}>
                {renderContent()}
            </div>

            {editingContact && (
                <EditSubscriberModal 
                    contact={editingContact.data}
                    type={editingContact.type}
                    onClose={() => setEditingContact(null)}
                    onSave={(updated) => onUpdateContact(editingContact.type, updated)}
                />
            )}

            {showCreateListModal && onCreateList && (
                <CreateListModal 
                    onClose={() => setShowCreateListModal(false)}
                    buyers={buyers}
                    agents={agents}
                    onSave={onCreateList}
                />
            )}

            {/* Custom Delete Confirmation Modal */}
            {campaignToDelete && (
                <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setCampaignToDelete(null)}>
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-500">
                                <AlertTriangle size={20} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Delete Campaign?</h3>
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                            This action cannot be undone. The campaign data will be permanently removed from your history.
                        </p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setCampaignToDelete(null)}
                                className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white py-2.5 rounded-lg font-bold text-sm transition-colors border border-gray-300 dark:border-gray-600"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmDeleteCampaign}
                                className="flex-1 bg-red-600 hover:bg-red-500 text-gray-900 dark:text-white py-2.5 rounded-lg font-bold text-sm transition-colors shadow-lg flex items-center justify-center gap-2"
                            >
                                <Trash2 size={16} /> Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {listToDelete && (
                <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setListToDelete(null)}>
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-500">
                                <AlertTriangle size={20} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Delete List?</h3>
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                            Are you sure you want to delete this custom list? This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setListToDelete(null)}
                                className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white py-2.5 rounded-lg font-bold text-sm transition-colors border border-gray-300 dark:border-gray-600"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmDeleteList}
                                className="flex-1 bg-red-600 hover:bg-red-500 text-gray-900 dark:text-white py-2.5 rounded-lg font-bold text-sm transition-colors shadow-lg flex items-center justify-center gap-2"
                            >
                                <Trash2 size={16} /> Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};