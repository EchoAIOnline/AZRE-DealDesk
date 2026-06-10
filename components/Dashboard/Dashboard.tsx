import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Deal, Agent, Buyer, User as UserType, ActivityLog } from '../../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Filter, Plus, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Briefcase, FileText, DollarSign, CheckCircle, Clock, MoreHorizontal, Layout, Calendar, Mail, Search, Bell, Settings } from 'lucide-react';
import { formatCurrency, getLogTimestamp, processPhotoUrl, timeAgo } from '../../services/utils';
import { POTENTIAL_STATUSES, UNDER_CONTRACT_STATUSES, DECLINED_STATUSES, CLOSED_STATUSES } from '../../constants';
import { RecentDealCard } from './RecentDealCard';
import { activityLogService } from '../../services/activityLogService';
import { api } from '../../services/api';

interface DashboardProps {
    currentUser: UserType | null;
    deals: Deal[];
    agents: Agent[];
    buyers: Buyer[];
    onEdit: (deal: Deal) => void;
    onUpdate: (id: string, updates: Partial<Deal>) => void;
    onDelete: (id: string) => void;
    onMove: (id: string, decision: string) => void;
}

const DASHBOARD_BG_KEY = 'azre_dashboard_bg_images_v1';

export const Dashboard: React.FC<DashboardProps> = ({ currentUser, deals, agents, buyers, onEdit, onUpdate, onDelete, onMove }) => {
    const navigate = useNavigate();
    // Default Theme Images
    const DEFAULT_THEME_IMAGES = {
        totalDeals: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=800', // Skyscrapers/Business
        underContract: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&q=80&w=800', // Meeting/Signing
        potentialRevenue: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=800', // Finance/Accounting
        closedDeals: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=800' // Keys/Property
    };

    // KPI Calculations
    const kpis = useMemo(() => {
        const now = new Date();
        // Use 7-day trend comparison
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        const getDealsInPeriod = (start: Date, end: Date) => {
            return deals.filter(d => {
                // Use createdAt or fallback to now
                const date = new Date(d.createdAt || new Date());
                return date >= start && date < end;
            });
        };

        const currentPeriodDeals = getDealsInPeriod(oneWeekAgo, now);
        const previousPeriodDeals = getDealsInPeriod(twoWeeksAgo, oneWeekAgo);

        const calculateTrend = (current: number, previous: number) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return ((current - previous) / previous) * 100;
        };

        // Active Statuses
        const activeStatuses = [...POTENTIAL_STATUSES, ...UNDER_CONTRACT_STATUSES];

        // Total Deals (Active Pipeline)
        const totalDeals = deals.filter(d => activeStatuses.includes(d.offerDecision)).length;
        const currentTotal = currentPeriodDeals.filter(d => activeStatuses.includes(d.offerDecision)).length;
        const previousTotal = previousPeriodDeals.filter(d => activeStatuses.includes(d.offerDecision)).length;
        const totalTrend = calculateTrend(currentTotal, previousTotal);

        // Under Contract
        const underContract = deals.filter(d => UNDER_CONTRACT_STATUSES.includes(d.offerDecision)).length;
        const currentUC = currentPeriodDeals.filter(d => UNDER_CONTRACT_STATUSES.includes(d.offerDecision)).length;
        const previousUC = previousPeriodDeals.filter(d => UNDER_CONTRACT_STATUSES.includes(d.offerDecision)).length;
        const ucTrend = calculateTrend(currentUC, previousUC);

        // Closed Deals
        const closedDeals = deals.filter(d => CLOSED_STATUSES.includes(d.offerDecision)).length;
        const currentClosed = currentPeriodDeals.filter(d => CLOSED_STATUSES.includes(d.offerDecision)).length;
        const previousClosed = previousPeriodDeals.filter(d => CLOSED_STATUSES.includes(d.offerDecision)).length;
        const closedTrend = calculateTrend(currentClosed, previousClosed);

        // Potential Revenue (Sum of desiredWholesaleProfit for Active Deals)
        const potentialRevenue = deals
            .filter(d => activeStatuses.includes(d.offerDecision))
            .reduce((sum, d) => sum + (d.desiredWholesaleProfit || 0), 0);
        
        const currentRevenue = currentPeriodDeals
            .filter(d => activeStatuses.includes(d.offerDecision))
            .reduce((sum, d) => sum + (d.desiredWholesaleProfit || 0), 0);
        const previousRevenue = previousPeriodDeals
            .filter(d => activeStatuses.includes(d.offerDecision))
            .reduce((sum, d) => sum + (d.desiredWholesaleProfit || 0), 0);
        const revenueTrend = calculateTrend(currentRevenue, previousRevenue);

        return {
            totalDeals, totalTrend,
            underContract, ucTrend,
            closedDeals, closedTrend,
            potentialRevenue, revenueTrend
        };
    }, [deals]);

    // Sort deals by newest first for Recent Deals section
    const recentDeals = useMemo(() => {
        return [...deals]
            .filter(d => !d.pipelineType || d.pipelineType === 'main')
            .sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateB - dateA;
            });
    }, [deals]);

    // Chart Data Calculation (Last 14 Days Daily)
    const chartData = useMemo(() => {
        const days = 14;
        const data = [];
        const now = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(now.getDate() - i);
            date.setHours(0, 0, 0, 0);
            
            const nextDate = new Date(date);
            nextDate.setDate(date.getDate() + 1);

            // Format: "Oct 24"
            const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });

            const dealsInDay = deals.filter(d => {
                const dDate = new Date(d.createdAt || new Date());
                return dDate >= date && dDate < nextDate;
            });

            data.push({
                name: label,
                Potential: dealsInDay.filter(d => POTENTIAL_STATUSES.includes(d.offerDecision)).length,
                UnderContract: dealsInDay.filter(d => UNDER_CONTRACT_STATUSES.includes(d.offerDecision)).length,
                Closed: dealsInDay.filter(d => CLOSED_STATUSES.includes(d.offerDecision)).length,
                Declined: dealsInDay.filter(d => DECLINED_STATUSES.includes(d.offerDecision)).length
            });
        }
        return data;
    }, [deals]);

    // Real Upcoming Tasks from Agents & Buyers
    const upcomingTasks = useMemo(() => {
        const tasks: { id: string; title: string; date: Date; type: 'agent' | 'buyer'; timeDisplay: string }[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Process Agents
        agents.forEach(agent => {
            if (agent.nextFollowUpDate) {
                // Parse "YYYY-MM-DD"
                const [y, m, d] = agent.nextFollowUpDate.split('-').map(Number);
                const date = new Date(y, m - 1, d);
                if (date >= today) {
                    tasks.push({
                        id: agent.id,
                        title: `Follow up with ${agent.name}`,
                        date: date,
                        type: 'agent',
                        timeDisplay: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    });
                }
            }
        });

        // Process Buyers
        buyers.forEach(buyer => {
            if (buyer.nextFollowUpDate) {
                const [y, m, d] = buyer.nextFollowUpDate.split('-').map(Number);
                const date = new Date(y, m - 1, d);
                if (date >= today) {
                    tasks.push({
                        id: buyer.id,
                        title: `Follow up with buyer ${buyer.name}`,
                        date: date,
                        type: 'buyer',
                        timeDisplay: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    });
                }
            }
        });

        // Sort by Date Ascending
        return tasks.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 20);
    }, [agents, buyers]);

    // Real Activity Feed
    const [activities, setActivities] = useState<ActivityLog[]>([]);
    const [loiLogs, setLoiLogs] = useState<ActivityLog[]>([]);
    const [allUsers, setAllUsers] = useState<UserType[]>([]);
    const [selectedUserForLoi, setSelectedUserForLoi] = useState<string>(currentUser?.name || 'All');
    const [totalLoisTimeframe, setTotalLoisTimeframe] = useState<'week' | 'month' | 'year'>('week');
    const [userLoisTimeframe, setUserLoisTimeframe] = useState<'week' | 'month' | 'year'>('week');
    const [dealsAddedTimeframe, setDealsAddedTimeframe] = useState<'week' | 'month' | 'year'>('week');
    const [listingsRemovedTimeframe, setListingsRemovedTimeframe] = useState<'week' | 'month' | 'year'>('week');
    const [offersDeclinedTimeframe, setOffersDeclinedTimeframe] = useState<'week' | 'month' | 'year'>('week');
    const [dealCanceledTimeframe, setDealCanceledTimeframe] = useState<'week' | 'month' | 'year'>('week');

    const hasSetInitialUser = useRef(false);
    useEffect(() => {
        if (currentUser?.name && !hasSetInitialUser.current) {
            setSelectedUserForLoi(currentUser.name);
            hasSetInitialUser.current = true;
        }
    }, [currentUser]);

    useEffect(() => {
        const fetchActivities = async () => {
            const logs = await activityLogService.getRecentActivity(20);
            setActivities(logs);
            
            const loiLogsData = await activityLogService.getLogsByActionType('LOI_SENT');
            setLoiLogs(loiLogsData);

            try {
                const users = await api.load('Users') as UserType[];
                setAllUsers(users);
            } catch (e) {
                console.error("Failed to fetch users", e);
            }
        };
        fetchActivities();
        
        // Optional: Poll for updates every minute
        const interval = setInterval(fetchActivities, 60000);
        return () => clearInterval(interval);
    }, []);

    const getStartDateForTimeframe = (timeframe: 'week' | 'month' | 'year') => {
        const now = new Date();
        const startDate = new Date();
        if (timeframe === 'week') {
            const day = startDate.getDay();
            const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
            startDate.setDate(diff);
            startDate.setHours(0, 0, 0, 0);
        }
        if (timeframe === 'month') {
            startDate.setDate(1);
            startDate.setHours(0, 0, 0, 0);
        }
        if (timeframe === 'year') {
            startDate.setMonth(0, 1);
            startDate.setHours(0, 0, 0, 0);
        }
        return startDate;
    };

    const totalLoisSent = useMemo(() => {
        const startDate = getStartDateForTimeframe(totalLoisTimeframe);
        return deals.filter(d => {
            const hasLoi = d.loiSent || d.offerDecision === 'Made Written Offer On Property';
            if (!hasLoi) return false;
            
            let dateToUseStr = d.loiSentDate || d.createdAt;
            if (d.offerDecisionTracking && d.offerDecisionTracking.length > 0) {
                 const tracking = d.offerDecisionTracking.find(t => t.status === 'Made Written Offer On Property');
                 if (tracking) dateToUseStr = tracking.date;
            }
            const dateToUse = dateToUseStr ? new Date(dateToUseStr) : new Date();
            return dateToUse >= startDate;
        }).reduce((sum, d) => sum + Math.max(1, d.dispo?.loiSentAgents?.length || 1), 0);
    }, [deals, totalLoisTimeframe]);

    const loiSentByUser = useMemo(() => {
        const startDate = getStartDateForTimeframe(userLoisTimeframe);
        const counts: Record<string, number> = {};
        
        allUsers.forEach(u => {
            counts[u.name] = 0;
        });

        // Add any missing users from the deals just in case
        deals.forEach(d => {
            const hasLoi = d.loiSent || d.offerDecision === 'Made Written Offer On Property';
            if (!hasLoi) return;
            
            let dateToUseStr = d.loiSentDate || d.createdAt;
            let sentBy = d.loiSentBy || d.acquisitionManager || 'Unknown User';
            
            if (d.offerDecisionTracking && d.offerDecisionTracking.length > 0) {
                 const tracking = d.offerDecisionTracking.find(t => t.status === 'Made Written Offer On Property');
                 if (tracking) { 
                     dateToUseStr = tracking.date;
                     sentBy = tracking.user || sentBy;
                 }
            }
            const dateToUse = dateToUseStr ? new Date(dateToUseStr) : new Date();
            if (dateToUse >= startDate) {
                if (counts[sentBy] === undefined) counts[sentBy] = 0;
                counts[sentBy] += Math.max(1, d.dispo?.loiSentAgents?.length || 1);
            }
        });
        
        return counts;
    }, [deals, userLoisTimeframe, allUsers]);

    const dealsAddedCount = useMemo(() => {
        const startDate = getStartDateForTimeframe(dealsAddedTimeframe);
        return deals.filter(d => new Date(d.createdAt || new Date()) >= startDate).length;
    }, [deals, dealsAddedTimeframe]);

    const listingsRemovedCount = useMemo(() => {
        const startDate = getStartDateForTimeframe(listingsRemovedTimeframe);
        return deals.filter(d => d.offerDecision === 'Listing Removed - Now Off Market' && new Date(d.createdAt || new Date()) >= startDate).length;
    }, [deals, listingsRemovedTimeframe]);

    const offersDeclinedCount = useMemo(() => {
        const startDate = getStartDateForTimeframe(offersDeclinedTimeframe);
        return deals.filter(d => (d.offerDecision === 'Offer Declined' || d.offerDecision === 'Offer Declined and Sold') && new Date(d.createdAt || new Date()) >= startDate).length;
    }, [deals, offersDeclinedTimeframe]);

    const dealCanceledCount = useMemo(() => {
        const startDate = getStartDateForTimeframe(dealCanceledTimeframe);
        return deals.filter(d => d.offerDecision === 'Deal Canceled' && new Date(d.createdAt || new Date()) >= startDate).length;
    }, [deals, dealCanceledTimeframe]);

    const renderTrend = (trend: number) => {
        const isPositive = trend >= 0;
        const Icon = isPositive ? TrendingUp : TrendingDown;
        const colorClass = isPositive ? 'text-green-400' : 'text-red-400';
        return (
            <div className={`flex items-center gap-1 text-sm ${colorClass}`}>
                <Icon size={14} />
                <span>{isPositive ? '+' : ''}{trend.toFixed(1)}%</span>
                <span className="text-gray-500 text-xs ml-1">vs last 7 days</span>
            </div>
        );
    };

    return (
        <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-900 dark:text-white font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold">
                        Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">{(currentUser?.name || 'User').split(' ')[0]}</span>!
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Here's what's happening with your deals today.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors border border-gray-200 dark:border-gray-700">
                        <Filter size={16} />
                        Filter
                    </button>
                    <button onClick={() => navigate('/pipeline')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-900/20">
                        <Plus size={16} />
                        Add Deal
                    </button>
                </div>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Group: First 3 Cards */}
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Total Deals */}
                    <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 shadow-xl group hover:border-blue-500/50 transition-all">
                        <div className="absolute inset-0 z-0 opacity-20 transition-opacity group-hover:opacity-30">
                            <img src={DEFAULT_THEME_IMAGES.totalDeals} alt="bg" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-br from-white dark:from-gray-900 via-white dark:via-gray-900/80 to-transparent"></div>
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                                    <Briefcase size={20} />
                                </div>
                                <span className="text-gray-500 dark:text-gray-400 font-medium">Total Deals</span>
                            </div>
                            <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">{kpis.totalDeals}</div>
                            {renderTrend(kpis.totalTrend)}
                        </div>
                    </div>

                    {/* Under Contract */}
                    <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 shadow-xl group hover:border-emerald-500/50 transition-all">
                        <div className="absolute inset-0 z-0 opacity-20 transition-opacity group-hover:opacity-30">
                            <img src={DEFAULT_THEME_IMAGES.underContract} alt="bg" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-br from-white dark:from-gray-900 via-white dark:via-gray-900/80 to-transparent"></div>
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                                    <FileText size={20} />
                                </div>
                                <span className="text-gray-500 dark:text-gray-400 font-medium">Under Contract</span>
                            </div>
                            <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">{kpis.underContract}</div>
                            {renderTrend(kpis.ucTrend)}
                        </div>
                    </div>

                    {/* Potential Revenue */}
                    <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 shadow-xl group hover:border-amber-500/50 transition-all">
                        <div className="absolute inset-0 z-0 opacity-20 transition-opacity group-hover:opacity-30">
                            <img src={DEFAULT_THEME_IMAGES.potentialRevenue} alt="bg" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-br from-white dark:from-gray-900 via-white dark:via-gray-900/80 to-transparent"></div>
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                                    <DollarSign size={20} />
                                </div>
                                <span className="text-gray-500 dark:text-gray-400 font-medium">Potential Revenue</span>
                            </div>
                            <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">{formatCurrency(kpis.potentialRevenue)}</div>
                            {renderTrend(kpis.revenueTrend)}
                        </div>
                    </div>
                </div>

                {/* Right Group: Closed Deals */}
                <div className="lg:col-span-1">
                    <div className="relative h-full overflow-hidden rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 shadow-xl group hover:border-purple-500/50 transition-all">
                        <div className="absolute inset-0 z-0 opacity-20 transition-opacity group-hover:opacity-30">
                            <img src={DEFAULT_THEME_IMAGES.closedDeals} alt="bg" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-br from-white dark:from-gray-900 via-white dark:via-gray-900/80 to-transparent"></div>
                        </div>
                        <div className="relative z-10 h-full flex flex-col justify-center">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                                    <CheckCircle size={20} />
                                </div>
                                <span className="text-gray-500 dark:text-gray-400 font-medium">Closed Deals</span>
                            </div>
                            <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">{kpis.closedDeals}</div>
                            {renderTrend(kpis.closedTrend)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Middle Row: Charts & Tasks */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Deals Overview Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Deals Overview</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{kpis.totalDeals} Total Deals</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button className="px-3 py-1 text-xs font-medium bg-blue-600 text-gray-900 dark:text-white rounded-lg">Last 14 Days</button>
                        </div>
                    </div>
                    {/* Compact Height: 120px */}
                    <div className="h-[120px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                <XAxis dataKey="name" stroke="#9ca3af" tick={{fontSize: 10}} tickLine={false} axisLine={false} interval={1} />
                                <YAxis stroke="#9ca3af" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '0.5rem', fontSize: '12px' }}
                                    itemStyle={{ color: '#e5e7eb' }}
                                />
                                <Line type="monotone" dataKey="Potential" name="Potential" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{r: 4}} />
                                <Line type="monotone" dataKey="UnderContract" name="Under Contract" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{r: 4}} />
                                <Line type="monotone" dataKey="Closed" name="Closed" stroke="#a855f7" strokeWidth={2} dot={false} activeDot={{r: 4}} />
                                <Line type="monotone" dataKey="Declined" name="Declined" stroke="#a855f7" strokeWidth={2} dot={false} activeDot={{r: 4}} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    {/* Chart Legend */}
                    <div className="flex flex-wrap items-center gap-4 mt-4 text-xs font-medium">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            <span className="text-gray-600 dark:text-gray-300">Potential Deals</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            <span className="text-gray-600 dark:text-gray-300">Under Contract</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-teal-500"></div>
                            <span className="text-gray-600 dark:text-gray-300">Closed</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                            <span className="text-gray-600 dark:text-gray-300">Declined</span>
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                            <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                            <span className="text-gray-600 dark:text-gray-300">16</span>
                        </div>
                    </div>
                </div>

                {/* Upcoming Tasks */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-xl flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Upcoming Tasks</h3>
                        <button 
                            onClick={() => navigate('/calendar')}
                            className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300"
                        >
                            <Plus size={14} /> Add
                        </button>
                    </div>
                    {/* Compact Height: 120px */}
                    <div className="h-[120px] space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                        {upcomingTasks.length > 0 ? (
                            upcomingTasks.map(task => (
                                <div 
                                    key={`${task.type}-${task.id}`} 
                                    onClick={() => navigate('/calendar')}
                                    className="flex items-start gap-3 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors group cursor-pointer border border-transparent hover:border-gray-300 dark:hover:border-gray-600"
                                >
                                    <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                                        task.type === 'agent' ? 'bg-blue-500' : 'bg-purple-500'
                                    }`} />
                                    <div>
                                        <p className="text-xs font-medium text-gray-700 dark:text-gray-200 group-hover:text-gray-900 dark:text-white transition-colors line-clamp-1">{task.title}</p>
                                        <p className="text-[10px] text-gray-500">{task.timeDisplay}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500 text-xs italic">
                                <CheckCircle size={16} className="mb-1 opacity-50" />
                                No upcoming tasks
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* New KPI Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Total LOI's Sent */}
                <div className="bg-[#10B981] rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-white/90">Total LOI's Sent</h3>
                        <select 
                            className="bg-white/20 border-none text-xs rounded-lg px-2 py-1 text-white outline-none cursor-pointer"
                            value={totalLoisTimeframe}
                            onChange={(e) => setTotalLoisTimeframe(e.target.value as any)}
                        >
                            <option value="week" className="text-gray-900">This Week</option>
                            <option value="month" className="text-gray-900">This Month</option>
                            <option value="year" className="text-gray-900">This Year</option>
                        </select>
                    </div>
                    <div className="text-3xl font-bold text-white">{totalLoisSent}</div>
                </div>
                {/* LOI's Sent by User */}
                <div className="bg-[#A855F7] rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-white/90">LOI's Sent by User</h3>
                        <div className="flex flex-col gap-2 items-end">
                            <select 
                                className="bg-white/20 border-none text-xs rounded-lg px-2 py-1 text-white outline-none cursor-pointer"
                                value={selectedUserForLoi}
                                onChange={(e) => setSelectedUserForLoi(e.target.value)}
                            >
                                <option value="All" className="text-gray-900">All Users</option>
                                {Object.keys(loiSentByUser).map(user => (
                                    <option key={user} value={user} className="text-gray-900">{user}</option>
                                ))}
                            </select>
                            <select 
                                className="bg-white/20 border-none text-xs rounded-lg px-2 py-1 text-white outline-none cursor-pointer"
                                value={userLoisTimeframe}
                                onChange={(e) => setUserLoisTimeframe(e.target.value as any)}
                            >
                                <option value="week" className="text-gray-900">This Week</option>
                                <option value="month" className="text-gray-900">This Month</option>
                                <option value="year" className="text-gray-900">This Year</option>
                            </select>
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-white mt-auto">
                        {selectedUserForLoi === 'All' ? Object.values(loiSentByUser).reduce((a: number, b: number) => a + b, 0) : (loiSentByUser[selectedUserForLoi] || 0)}
                    </div>
                </div>
                {/* Deals Added */}
                <div className="bg-[#00D4FF] rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-white/90">Deals Added</h3>
                        <select 
                            className="bg-white/20 border-none text-xs rounded-lg px-2 py-1 text-white outline-none cursor-pointer"
                            value={dealsAddedTimeframe}
                            onChange={(e) => setDealsAddedTimeframe(e.target.value as any)}
                        >
                            <option value="week" className="text-gray-900">This Week</option>
                            <option value="month" className="text-gray-900">This Month</option>
                            <option value="year" className="text-gray-900">This Year</option>
                        </select>
                    </div>
                    <div className="text-3xl font-bold text-white">{dealsAddedCount}</div>
                </div>
                {/* Listings Removed */}
                <div className="bg-[#F59E0B] rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-white/90">Listings Removed</h3>
                        <select 
                            className="bg-white/20 border-none text-xs rounded-lg px-2 py-1 text-white outline-none cursor-pointer"
                            value={listingsRemovedTimeframe}
                            onChange={(e) => setListingsRemovedTimeframe(e.target.value as any)}
                        >
                            <option value="week" className="text-gray-900">This Week</option>
                            <option value="month" className="text-gray-900">This Month</option>
                            <option value="year" className="text-gray-900">This Year</option>
                        </select>
                    </div>
                    <div className="text-3xl font-bold text-white">{listingsRemovedCount}</div>
                </div>
                {/* Offers Declined */}
                <div className="bg-[#FB7185] rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-white/90">Offers Declined</h3>
                        <select 
                            className="bg-white/20 border-none text-xs rounded-lg px-2 py-1 text-white outline-none cursor-pointer"
                            value={offersDeclinedTimeframe}
                            onChange={(e) => setOffersDeclinedTimeframe(e.target.value as any)}
                        >
                            <option value="week" className="text-gray-900">This Week</option>
                            <option value="month" className="text-gray-900">This Month</option>
                            <option value="year" className="text-gray-900">This Year</option>
                        </select>
                    </div>
                    <div className="text-3xl font-bold text-white">{offersDeclinedCount}</div>
                </div>
                {/* Deal Canceled */}
                <div className="bg-[#EF4444] rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-white/90">Deal Canceled</h3>
                        <select 
                            className="bg-white/20 border-none text-xs rounded-lg px-2 py-1 text-white outline-none cursor-pointer"
                            value={dealCanceledTimeframe}
                            onChange={(e) => setDealCanceledTimeframe(e.target.value as any)}
                        >
                            <option value="week" className="text-gray-900">This Week</option>
                            <option value="month" className="text-gray-900">This Month</option>
                            <option value="year" className="text-gray-900">This Year</option>
                        </select>
                    </div>
                    <div className="text-3xl font-bold text-white">{dealCanceledCount}</div>
                </div>
            </div>

            {/* Bottom Row: Recent Deals & Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Deals */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recent Deals</h3>
                        <button onClick={() => navigate('/pipeline')} className="text-sm text-blue-400 hover:text-blue-300 hover:underline">View Pipeline</button>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                        {recentDeals.slice(0, 10).map(deal => (
                            <div key={deal.id} className="min-w-[260px] w-[260px] shrink-0">
                                <RecentDealCard 
                                    deal={deal} 
                                    onClick={onEdit}
                                />
                            </div>
                        ))}
                        {recentDeals.length === 0 && (
                            <div className="w-full py-12 text-center text-gray-500">
                                No recent deals found.
                            </div>
                        )}
                    </div>
                </div>

                {/* Activity Feed */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Activity Feed</h3>
                        <MoreHorizontal size={16} className="text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:text-white" />
                    </div>
                    <div className="space-y-6 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                        {activities.length > 0 ? (
                            activities.map((activity) => (
                                <div key={activity.id} className="relative pl-6 border-l border-gray-200 dark:border-gray-700 last:border-0 pb-6 last:pb-0">
                                    <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-gray-200 dark:bg-gray-600 border-2 border-white dark:border-gray-800 ring-2 ring-white dark:ring-gray-800 group-hover:bg-blue-500 transition-colors"></div>
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0 text-xs font-bold text-gray-600 dark:text-gray-300">
                                            {activity.user_name ? activity.user_name.split(' ').map(n => n[0]).join('') : 'U'}
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                                <span className="font-bold text-gray-900 dark:text-white">{activity.user_name}</span> {activity.description}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">{timeAgo(activity.created_at)}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-gray-500 py-8 text-sm">
                                No recent activity
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
