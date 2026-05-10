import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Plus, Home, Users, Layout, Settings, Loader2, MapPin, Filter, LogOut, CheckCircle, Calculator, User as UserIcon, X, XCircle, Pencil, Upload, RefreshCw, Save, Menu, Search, ChevronDown, User, Calendar, FileSpreadsheet, Download, Moon, Sun, Monitor, AlertCircle, Database, Briefcase } from 'lucide-react';
import { api, DEFAULT_DEALS, sendEmail, executeAdminSql, setOrganizationId, supabase } from './services/api';
import { activityLogService } from './services/activityLogService';
import { useAppStore } from './store/useAppStore';
import { LoginForm } from './components/Auth/LoginForm';
import { PipelineView } from './components/Pipeline/PipelineView';
import { DealCard } from './components/Deals/DealCard';
import { AgentCard } from './components/Agents/AgentCard';
import { AgentsView } from './components/Agents/AgentsView';
import { BuyerCard } from './components/Buyers/BuyerCard'; 
import { BuyersView } from './components/Buyers/BuyersView';
import { WholesalerCard } from './components/Wholesalers/WholesalerCard';
import { WholesalersView } from './components/Wholesalers/WholesalersView';
import { ContactsManager } from './components/Contacts/ContactsManager'; 
import { EditDealModal } from './components/Deals/EditDealModal';
import { EditWholesalerDealModal } from './components/Deals/EditWholesalerDealModal';
import { AgentProfileModal } from './components/Agents/AgentProfileModal';
import { EditBuyerModal } from './components/Buyers/EditBuyerModal'; 
import { EditWholesalerModal } from './components/Wholesalers/EditWholesalerModal';
import { ImportMapModal } from './components/Settings/ImportMapModal';
import { ImportBuyerMapModal } from './components/Settings/ImportBuyerMapModal';
import { ImportAgentMapModal } from './components/Settings/ImportAgentMapModal'; 
import { SettingsModal } from './components/Settings/SettingsModal'; 
import { CalendarView } from './components/Calendar/CalendarView';
import { PageNavBar } from './components/Shared/PageNavBar';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard/Dashboard';
import { EmailManager } from './components/EmailManager/EmailManager';
import { MarketScanner } from './components/MarketScanner/MarketScanner';
import { Campaigns } from './components/Campaigns/Campaigns';
import { Inbox } from './components/Inbox/Inbox';
import { LoiDesigner } from './components/LoiDesigner/LoiDesigner';
import { MarketOracle } from './components/MarketOracle/MarketOracle';
import { MessageCenter } from './components/MessageCenter/MessageCenter';
import { mockAcquisitionsMessages, mockDispositionsMessages } from './services/mockData';
import { generateId, getLogTimestamp, loadGoogleMapsScript, formatCurrency, formatPhoneNumber, parseNumberFromCurrency, fetchAgentPhotoFromGAMLS, fetchAgentDetailsFromGAMLS, captureStreetViewAsBase64 } from './services/utils';
import { User as UserType, Deal, Agent, Brokerage, FilterConfig, CalcData, Buyer, BuyBox, Wholesaler, Contact, EmailList } from './types';
import { POTENTIAL_STATUSES, UNDER_CONTRACT_STATUSES, DECLINED_STATUSES, CLOSED_STATUSES, GOOGLE_MAPS_API_KEY, GOOGLE_SCRIPT_URL, COUNTER_STATUSES, SUB_MARKETS, COUNTIES, BUYER_STATUS_TABS, AGENT_STATUS_TABS, WHOLESALER_STATUS_TABS, OFFER_DECISIONS, JV_PIPELINE_STATUSES } from './constants';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    currentUser, setCurrentUser,
    deals, setDeals,
    agents, setAgents,
    buyers, setBuyers,
    wholesalers, setWholesalers,
    contacts, setContacts,
    emailLists, setEmailLists,
    brokerages, setBrokerages,
    campaigns, setCampaigns
  } = useAppStore();

  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [onlineUsersCount, setOnlineUsersCount] = useState(0); 
  const [showOnlineUsersModal, setShowOnlineUsersModal] = useState(false);
  const [onlineUsersList, setOnlineUsersList] = useState<UserType[]>([]);

  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');

  // Dynamic Z-Index States for Stack Management
  const [dealModalZIndex, setDealModalZIndex] = useState('z-[120]');
  const [agentModalZIndex, setAgentModalZIndex] = useState('z-[140]');

  // Notification State
  const [moveNotification, setMoveNotification] = useState<{message: string, show: boolean}>({message: '', show: false});

  useEffect(() => {
    const savedTheme = localStorage.getItem('azre-theme') as 'dark' | 'light' | 'system';
    if (savedTheme) setTheme(savedTheme);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    const applyTheme = (t: 'dark' | 'light') => {
        if (t === 'dark') root.classList.add('dark');
        else root.classList.remove('dark');
    };
    if (theme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        applyTheme(systemTheme);
    } else {
        applyTheme(theme);
    }
    localStorage.setItem('azre-theme', theme);
  }, [theme]);

  useEffect(() => {
      const savedUser = localStorage.getItem('azre-current-user');
      if (savedUser) {
          try {
            const user = JSON.parse(savedUser);
            if (user.organization_id) setOrganizationId(user.organization_id);
            setCurrentUser(user);
            setIsAuthenticated(true);
          } catch (e) {
            console.error("Failed to parse saved user", e);
            localStorage.removeItem('azre-current-user');
          }
      }
      setIsAuthChecking(false);
  }, []);

  useEffect(() => {
      if (!isAuthenticated) return;
      const fetchOnlineUsers = async () => {
          try {
              const users = await api.load('Users') as UserType[];
              const online = users.filter(u => u.loginStatus === 'Logged In');
              setOnlineUsersList(online);
              setOnlineUsersCount(online.length);
          } catch (e) {
              console.error("Failed to fetch online users", e);
          }
      };
      fetchOnlineUsers();
      const interval = setInterval(fetchOnlineUsers, 3600000);
      return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleLogin = async (user: UserType) => {
      const updatedUser: UserType = { ...user, loginStatus: 'Logged In' };
      if (updatedUser.organization_id) setOrganizationId(updatedUser.organization_id);
      try {
          let saved = await api.save(updatedUser, 'Users');
          if (!saved) {
              saved = updatedUser;
          }
          if (saved) {
              setCurrentUser(saved);
              setIsAuthenticated(true);
              localStorage.setItem('azre-current-user', JSON.stringify(saved));
          }
      } catch (e) {
          console.error("Login save failed in App.tsx:", e);
          // Force login anyway to prevent infinite loading lock if save fails due to RLS or schema issues
          setCurrentUser(updatedUser);
          setIsAuthenticated(true);
          localStorage.setItem('azre-current-user', JSON.stringify(updatedUser));
      }
  };

  const handleLogout = async () => {
      if (currentUser) {
          const updatedUser = { ...currentUser, loginStatus: 'Logged Out' };
          await api.save(updatedUser, 'Users');
      }
      try {
          await supabase.auth.signOut();
      } catch (e) {
          console.error("Error signing out of Supabase:", e);
      }
      setIsAuthenticated(false);
      setCurrentUser(null);
      localStorage.removeItem('azre-current-user');
      window.location.reload(); // Force full reload to wipe all React memory/state
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    const TIMEOUT_DURATION = 2 * 60 * 60 * 1000; 
    let timeoutId: any;
    let lastActivity = Date.now();
    const performLogout = () => {
        alert("You have been automatically logged out due to inactivity.");
        handleLogout();
    };
    const resetTimer = () => {
        if (Date.now() - lastActivity < 1000) return;
        lastActivity = Date.now();
        clearTimeout(timeoutId);
        timeoutId = setTimeout(performLogout, TIMEOUT_DURATION);
    };
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    timeoutId = setTimeout(performLogout, TIMEOUT_DURATION);
    events.forEach(event => window.addEventListener(event, resetTimer));
    return () => {
        clearTimeout(timeoutId);
        events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [isAuthenticated]);

  const [pipelineStage, setPipelineStage] = useState<string>(() => {
      return localStorage.getItem('azre-pipeline-stage') || 'Potential';
  });
  useEffect(() => localStorage.setItem('azre-pipeline-stage', pipelineStage), [pipelineStage]);

  const [buyerStage, setBuyerStage] = useState<string>(() => {
      return localStorage.getItem('azre-buyer-stage') || 'All Buyers';
  });
  useEffect(() => localStorage.setItem('azre-buyer-stage', buyerStage), [buyerStage]);

  const [agentStage, setAgentStage] = useState<string>(() => {
      return localStorage.getItem('azre-agent-stage') || 'All Agents';
  });
  useEffect(() => localStorage.setItem('azre-agent-stage', agentStage), [agentStage]);

  const [wholesalerStage, setWholesalerStage] = useState<string>(() => {
      return localStorage.getItem('azre-wholesaler-stage') || 'All Wholesalers';
  });
  useEffect(() => localStorage.setItem('azre-wholesaler-stage', wholesalerStage), [wholesalerStage]);

  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [pipelineSearch, setPipelineSearch] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [buyerSearch, setBuyerSearch] = useState('');
  const [wholesalerSearch, setWholesalerSearch] = useState('');
  const [pipelineSort, setPipelineSort] = useState('Date Newest');
  const [agentSort, setAgentSort] = useState('A-Z');
  const [buyerSort, setBuyerSort] = useState('Date Added - Newest');
  const [wholesalerSort, setWholesalerSort] = useState('A-Z');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [filterConfig, setFilterConfig] = useState<FilterConfig>(() => {
      try {
          const saved = localStorage.getItem('azre-filter-config');
          return saved ? JSON.parse(saved) : { type: 'All', value: '' };
      } catch { return { type: 'All', value: '' }; }
  });
  const [agentFilterSearch, setAgentFilterSearch] = useState('');
  const [showAgentFilterSuggestions, setShowAgentFilterSuggestions] = useState(false);
  useEffect(() => localStorage.setItem('azre-filter-config', JSON.stringify(filterConfig)), [filterConfig]);
  useEffect(() => {
      if (filterConfig.type === 'Agent Name') setAgentFilterSearch(filterConfig.value);
      else if (filterConfig.type === 'All' && !filterConfig.value) setAgentFilterSearch('');
      else if (filterConfig.type !== 'Agent Name' && filterConfig.type !== 'All') setAgentFilterSearch('');
  }, [filterConfig]);
  const [showAddWholesalerModal, setShowAddWholesalerModal] = useState(false);
  
  const [showDuplicateNotification, setShowDuplicateNotification] = useState(false);
  const [showSettings, setShowSettings] = useState(false); 
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null); 
  const [viewingAgent, setViewingAgent] = useState<Agent | null>(null); 
  const [restorationAttempted, setRestorationAttempted] = useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBuyerFile, setImportBuyerFile] = useState<File | null>(null);
  const [importAgentFile, setImportAgentFile] = useState<File | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [agentSuggestions, setAgentSuggestions] = useState<Agent[]>([]);
  const [wholesalerSuggestions, setWholesalerSuggestions] = useState<Wholesaler[]>([]);
  const [brokerageSuggestions, setBrokerageSuggestions] = useState<Brokerage[]>([]);
  const [showAgentSuggestions, setShowAgentSuggestions] = useState(false);
  const [showWholesalerSuggestions, setShowWholesalerSuggestions] = useState(false);
  const [showBrokerageSuggestions, setShowBrokerageSuggestions] = useState(false);
  const [calcData, setCalcData] = useState<CalcData>({ arv: 250000, repairs: 30000, fee: 10000, isDoubleClose: false });
  const [mao, setMao] = useState(0);
  const [editingBuyer, setEditingBuyer] = useState<Buyer | null>(null);
  const [showAddBuyerModal, setShowAddBuyerModal] = useState(false);
  const [editingWholesaler, setEditingWholesaler] = useState<Wholesaler | null>(null);
  const [isSyncingPhotos, setIsSyncingPhotos] = useState(false);
  const [isSyncingDetails, setIsSyncingDetails] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (GOOGLE_MAPS_API_KEY) loadGoogleMapsScript(GOOGLE_MAPS_API_KEY);
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const deduplicateById = <T extends { id: string }>(items: T[]): T[] => {
            const map = new Map<string, T>();
            items.forEach(item => map.set(item.id, item));
            return Array.from(map.values());
        };

        const dealsData = await api.load('Deals');
        const jvDealsData = await api.load('JVDeals');
        const allDealsData = deduplicateById([...dealsData, ...jvDealsData]);
        const cleanDeals = allDealsData.map((d: any) => ({
            ...d,
            logs: Array.isArray(d.logs) ? d.logs : [],
            dealType: Array.isArray(d.dealType) ? d.dealType : [],
            offerDecision: d.offerDecision || (['Under Contract', 'Offer Accepted'].includes(d.status) ? 'Deal Under Contract' : 'No Offer Made Yet'),
            inspectionDate: d.inspectionDate ? String(d.inspectionDate).split('T')[0] : null,
            emdDate: d.emdDate ? String(d.emdDate).split('T')[0] : null,
            nextFollowUpDate: d.nextFollowUpDate ? String(d.nextFollowUpDate).split('T')[0] : null,
            lastContactDate: d.lastContactDate ? String(d.lastContactDate).split('T')[0] : null,
            dateListed: d.dateListed ? String(d.dateListed).split('T')[0] : null,
        }));
        setDeals(cleanDeals);
        
        const agentsData = await api.load('Agents');
        const cleanAgents = deduplicateById(agentsData).map((a: any) => ({
            ...a,
            subscriptionStatus: a.subscriptionStatus || 'Subscribed',
            notes: Array.isArray(a.notes) ? a.notes : [],
            nextFollowUpDate: a.nextFollowUpDate ? String(a.nextFollowUpDate).split('T')[0] : null,
            lastContactDate: a.lastContactDate ? String(a.lastContactDate).split('T')[0] : null,
        }));
        setAgents(cleanAgents);
        
        const wholesalersData = await api.load('Wholesalers');
        const cleanWholesalers = deduplicateById(wholesalersData).map((w: any) => ({
            ...w,
            subscriptionStatus: w.subscriptionStatus || 'Subscribed',
            notes: Array.isArray(w.notes) ? w.notes : [],
            properties: Array.isArray(w.properties) ? w.properties : [],
            nextFollowUpDate: w.nextFollowUpDate ? String(w.nextFollowUpDate).split('T')[0] : null,
            lastContactDate: w.lastContactDate ? String(w.lastContactDate).split('T')[0] : null,
        }));
        setWholesalers(cleanWholesalers);

        const contactsData = await api.load('Contacts');
        setContacts(deduplicateById(contactsData || []));

        const emailListsData = await api.load('EmailLists');
        setEmailLists(deduplicateById(emailListsData || []));

        const brokeragesData = await api.load('Brokerages');
        setBrokerages(deduplicateById(brokeragesData || []));

        const buyersData = await api.load('Buyers');
        if (buyersData && Array.isArray(buyersData) && buyersData.length > 0) {
            const cleanBuyers = deduplicateById(buyersData).map((b: any) => {
                let notes = Array.isArray(b.notes) ? b.notes : [];
                const buyerObj = {
                    ...b,
                    subscriptionStatus: b.subscriptionStatus || 'Subscribed',
                    buyBox: b.buyBox || { 
                        locations: '', minPrice: 0, maxPrice: 0, minArv: 0, maxArv: 0, maxRenoBudget: 0, 
                        earliestYearBuilt: 0, latestYearBuilt: 0, propertyTypes: [], 
                        minBedrooms: 0, minBathrooms: 0, notes: '' 
                    },
                    notes: notes,
                    nextFollowUpDate: b.nextFollowUpDate ? String(b.nextFollowUpDate).split('T')[0] : null,
                    lastContactDate: b.lastContactDate ? String(b.lastContactDate).split('T')[0] : null,
                };
                if (!buyerObj.buyBox.maxArv) buyerObj.buyBox.maxArv = 0;
                if (!buyerObj.buyBox.earliestYearBuilt) buyerObj.buyBox.earliestYearBuilt = 0;
                if (!buyerObj.buyBox.latestYearBuilt) buyerObj.buyBox.latestYearBuilt = 0;
                return buyerObj;
            });
            setBuyers(cleanBuyers);
        }
        const campaignsData = await api.load('Campaigns');
        setCampaigns(deduplicateById(campaignsData || []));
      } catch (e) {
        console.error("Fetch data error", e);
        alert("Failed to load data. Please check connection.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [isAuthenticated]);

  useEffect(() => {
      if (!isLoading && !restorationAttempted) {
          const savedDealId = localStorage.getItem('azre-open-deal-id');
          if (savedDealId && deals.length > 0) {
              const found = deals.find(d => d.id === savedDealId);
              if (found) setEditingDeal(found);
          }
          setRestorationAttempted(true);
      }
  }, [isLoading, deals, restorationAttempted]);

  useEffect(() => {
      if (restorationAttempted) {
          if (editingDeal) localStorage.setItem('azre-open-deal-id', editingDeal.id);
          else localStorage.removeItem('azre-open-deal-id');
      }
  }, [editingDeal, restorationAttempted]);

  const checkAndSaveBrokerage = async (name: string, phone: string, email: string) => {
      if (!name) return;
      const exists = brokerages.some(b => b.name.toLowerCase() === name.toLowerCase());
      if (exists === false) {
          const newBrokerage: Brokerage = { id: generateId(), name: name, phone: phone || '', email: email || '', createdAt: new Date().toISOString() };
          await api.save(newBrokerage, 'Brokerages');
          setBrokerages(prev => [...prev, newBrokerage]);
          
          activityLogService.logActivity(
              currentUser,
              'CREATE',
              'BROKERAGE',
              newBrokerage.id,
              `Created brokerage: ${newBrokerage.name}`,
              {},
              newBrokerage.name
          );
      }
  };

  const checkAndSaveAgent = async (deal: Partial<Deal>) => {
      if (!deal.agentName) return;
      const cleanName = deal.agentName.trim();
      if (!cleanName) return;
      checkAndSaveBrokerage(deal.agentBrokerage || '', '', '');
      const existingAgentIndex = agents.findIndex(a => a.name.toLowerCase() === cleanName.toLowerCase());
      const newNote = `${getLogTimestamp()}: Added from deal: ${deal.address}`;
      if (existingAgentIndex === -1) {
          const newAgent: Agent = { 
              id: generateId(), 
              name: cleanName, 
              phone: deal.agentPhone || '', 
              email: deal.agentEmail || '', 
              brokerage: deal.agentBrokerage || '', 
              notes: [newNote] 
          };
          const savedAgent = await api.save(newAgent, 'Agents'); 
          if(savedAgent) {
              setAgents(prev => {
                  if (prev.some(a => a.id === savedAgent.id)) return prev;
                  return [...prev, savedAgent];
              });
              
              activityLogService.logActivity(
                  currentUser,
                  'CREATE',
                  'AGENT',
                  savedAgent.id,
                  `Created agent: ${savedAgent.name} from deal ${deal.address}`,
                  {},
                  savedAgent.name
              );
              
              if (savedAgent.name) {
                  try {
                      const photoUrl = await fetchAgentPhotoFromGAMLS(savedAgent.name, savedAgent.phone);
                      if (photoUrl) {
                          const updatedAgentWithPhoto = { ...savedAgent, photo: photoUrl };
                          await api.save(updatedAgentWithPhoto, 'Agents');
                          setAgents(prev => prev.map(a => a.id === savedAgent.id ? updatedAgentWithPhoto : a));
                      }
                  } catch (e) {}
              }
          }
      } else {
          const existingAgent = agents[existingAgentIndex];
          const updatedAgent = { 
              ...existingAgent, 
              phone: deal.agentPhone || existingAgent.phone, 
              email: deal.agentEmail || existingAgent.email, 
              brokerage: deal.agentBrokerage || existingAgent.brokerage,
              notes: [newNote, ...(existingAgent.notes || [])]
          };
          const saved = await api.save(updatedAgent, 'Agents');
          if(saved) {
              setAgents(prev => prev.map(a => a.id === saved.id ? saved : a));
              
              activityLogService.logActivity(
                  currentUser,
                  'UPDATE',
                  'AGENT',
                  saved.id,
                  `Updated agent: ${saved.name} from deal ${deal.address}`,
                  {},
                  saved.name
              );
          }
      }
  };

  const handleUpdateAgent = async (agentId: string, updates: Partial<Agent>) => {
      const agent = agents.find(a => a.id === agentId);
      const merged = agent ? { ...agent, ...updates } : { id: agentId, ...updates } as Agent;
      const saved = await api.save(merged, 'Agents');
      if (saved) {
          if (agent) {
              setAgents(prev => prev.map(a => a.id === agentId ? saved : a));
          } else {
              setAgents(prev => {
                  if (prev.some(a => a.id === saved.id)) return prev;
                  return [...prev, saved];
              });
          }
          if (viewingAgent && viewingAgent.id === agentId) setViewingAgent(saved);
          if (editingAgent && editingAgent.id === agentId) setEditingAgent(saved);
          
          // Log Activity
          activityLogService.logActivity(
              currentUser, 
              agent ? 'UPDATE' : 'CREATE', 
              'AGENT', 
              saved.id, 
              agent ? `Updated agent: ${saved.name}` : `Created agent: ${saved.name}`, 
              updates,
              saved.name
          );
      }
  };

  const handleUpdateWholesaler = async (wholesalerId: string, updates: Partial<Wholesaler>) => {
      const wholesaler = wholesalers.find(w => w.id === wholesalerId);
      if (!wholesaler) return;
      const merged = { ...wholesaler, ...updates };
      const saved = await api.save(merged, 'Wholesalers');
      if (saved) {
          setWholesalers(prev => prev.map(w => w.id === wholesalerId ? saved : w));
          if (editingWholesaler && editingWholesaler.id === wholesalerId) setEditingWholesaler(saved);
          
          let actionType = 'UPDATE';
          let description = `Updated wholesaler: ${saved.name}`;
          
          if (updates.notes) {
              actionType = 'NOTE_ADDED';
              description = `Added a note to wholesaler ${saved.name}`;
          }
          
          activityLogService.logActivity(
              currentUser,
              actionType,
              'WHOLESALER',
              wholesalerId,
              description,
              updates,
              saved.name
          );
      }
  };

  const handleUpdateBuyer = async (buyerId: string, updates: Partial<Buyer>) => {
      const buyer = buyers.find(b => b.id === buyerId);
      if (!buyer) return;
      const merged = { ...buyer, ...updates };
      const saved = await api.save(merged, 'Buyers');
      if (saved) {
          setBuyers(prev => prev.map(b => b.id === buyerId ? saved : b));
          
          let actionType = 'UPDATE';
          let description = `Updated buyer: ${saved.name}`;
          
          if (updates.notes) {
              actionType = 'NOTE_ADDED';
              description = `Added a note to buyer ${saved.name}`;
          }
          
          activityLogService.logActivity(
              currentUser,
              actionType,
              'BUYER',
              buyerId,
              description,
              updates,
              saved.name
          );
      }
  };

  const handleUpdateContact = async (type: 'buyer' | 'agent', updatedContact: any) => {
      if (type === 'buyer') {
          await handleUpdateBuyer(updatedContact.id, updatedContact);
      } else {
          await handleUpdateAgent(updatedContact.id, updatedContact);
      }
  };

  const handleSaveBuyer = async (buyer: Buyer, shouldClose: boolean = true) => {
      const cleanEmail = buyer.email ? buyer.email.trim().toLowerCase() : '';
      const cleanName = buyer.name ? buyer.name.trim().toLowerCase() : '';
      const otherBuyers = buyers.filter(b => b.id !== buyer.id);
      const duplicate = otherBuyers.find(b => {
          const bEmail = b.email ? b.email.trim().toLowerCase() : '';
          const bName = b.name ? b.name.trim().toLowerCase() : '';
          if (cleanEmail && bEmail === cleanEmail) return true;
          if (cleanName && bName === cleanName) return true;
          return false;
      });
      if (duplicate) {
          if (shouldClose) alert(`Cannot save buyer: A record with this name or email already exists (${duplicate.name}).`);
          return; 
      }
      const saved = await api.save(buyer, 'Buyers');
      if (saved) {
          setBuyers(prev => {
              const exists = prev.find(b => b.id === saved.id);
              if (exists) return prev.map(b => b.id === saved.id ? saved : b);
              return [...prev, saved];
          });
          
          // Log Activity
          const isNew = !buyers.find(b => b.id === saved.id);
          activityLogService.logActivity(
              currentUser, 
              isNew ? 'CREATE' : 'UPDATE', 
              'BUYER', 
              saved.id, 
              `${isNew ? 'Added' : 'Updated'} buyer: ${saved.name}`,
              {},
              saved.name
          );

          if (shouldClose) { setEditingBuyer(null); setShowAddBuyerModal(false); }
          else { setEditingBuyer(saved); }
      } else {
        alert("Failed to save Buyer. Please try again.");
      }
  };

  const handleDeleteBuyer = async (id: string) => { 
      const buyerToDelete = buyers.find(b => b.id === id);
      const success = await api.delete(id, 'Buyers');
      if (success) {
          setBuyers(prev => prev.filter(b => b.id !== id)); 
          if (buyerToDelete) {
              activityLogService.logActivity(
                  currentUser,
                  'DELETE',
                  'BUYER',
                  id,
                  `Deleted buyer: ${buyerToDelete.name}`,
                  {},
                  buyerToDelete.name
              );
          }
      }
  };

  const handleAddBuyer = () => {
      const newBuyer: Buyer = { 
          id: generateId(), 
          dateAdded: new Date().toISOString(), 
          name: '', 
          companyName: '', 
          phone: '', 
          email: '', 
          status: 'New Lead', 
          subscriptionStatus: 'Subscribed',
          propertiesBought: 0, 
          buyBox: { locations: '', minPrice: 0, maxPrice: 0, minArv: 0, maxArv: 0, maxRenoBudget: 0, earliestYearBuilt: 0, latestYearBuilt: 0, propertyTypes: [], minBedrooms: 0, minBathrooms: 0, notes: '' }, 
          notes: [`${getLogTimestamp()}: Buyer created`], 
          about: '' 
      };
      setEditingBuyer(newBuyer);
      setShowAddBuyerModal(true);
  };

  const handleAddWholesaler = () => {
      const newWholesaler: Wholesaler = {
          id: generateId(), 
          createdAt: new Date().toISOString(),
          name: '',
          companyName: '',
          phone: '',
          email: '',
          status: 'New',
          notes: [`${getLogTimestamp()}: Wholesaler created`]
      };
      setEditingWholesaler(newWholesaler);
      setShowAddWholesalerModal(true);
  };

  const handleSaveWholesaler = async (wholesaler: Wholesaler, shouldClose: boolean = true) => {
      const cleanEmail = wholesaler.email ? wholesaler.email.trim().toLowerCase() : '';
      const cleanName = wholesaler.name ? wholesaler.name.trim().toLowerCase() : '';
      const otherWholesalers = wholesalers.filter(w => w.id !== wholesaler.id);
      const duplicate = otherWholesalers.find(w => {
          const wEmail = w.email ? w.email.trim().toLowerCase() : '';
          const wName = w.name ? w.name.trim().toLowerCase() : '';
          if (cleanEmail && wEmail === cleanEmail) return true;
          if (cleanName && wName === cleanName) return true;
          return false;
      });
      if (duplicate) {
          if (shouldClose) alert(`Cannot save: Duplicate record (${duplicate.name}).`);
          return;
      }
      const saved = await api.save(wholesaler, 'Wholesalers');
      if (saved) {
          setWholesalers(prev => {
              const exists = prev.find(w => w.id === saved.id);
              if (exists) return prev.map(w => w.id === saved.id ? saved : w);
              return [...prev, saved];
          });
          
          // Log Activity
          const isNew = !wholesalers.find(w => w.id === saved.id);
          activityLogService.logActivity(
              currentUser, 
              isNew ? 'CREATE' : 'UPDATE', 
              'WHOLESALER', 
              saved.id, 
              `${isNew ? 'Added' : 'Updated'} wholesaler: ${saved.name}`,
              {},
              saved.name
          );

          if (shouldClose) { 
              setEditingWholesaler(null); 
              setShowAddWholesalerModal(false); 
          } else {
              setEditingWholesaler(saved);
          }
      } else {
        alert("Failed to save Wholesaler. Please check connection.");
      }
  };

  const handleDeleteWholesaler = async (id: string) => { 
      const wholesalerToDelete = wholesalers.find(w => w.id === id);
      const success = await api.delete(id, 'Wholesalers');
      if(success) {
          setWholesalers(prev => prev.filter(w => w.id !== id)); 
          if (wholesalerToDelete) {
              activityLogService.logActivity(
                  currentUser,
                  'DELETE',
                  'WHOLESALER',
                  id,
                  `Deleted wholesaler: ${wholesalerToDelete.name}`,
                  {},
                  wholesalerToDelete.name
              );
          }
      }
  };

  const handleCreateEmailList = async (list: EmailList) => {
      const saved = await api.save(list, 'EmailLists');
      if(saved) {
          setEmailLists(prev => [...prev, saved]);
          activityLogService.logActivity(
              currentUser,
              'CREATE',
              'EMAIL_LIST',
              saved.id,
              `Created email list: ${saved.name}`,
              {},
              saved.name
          );
      }
  };

  const handleDeleteEmailList = async (id: string) => {
      const listToDelete = emailLists.find(l => l.id === id);
      const success = await api.delete(id, 'EmailLists');
      if(success) {
          setEmailLists(prev => prev.filter(l => l.id !== id));
          if (listToDelete) {
              activityLogService.logActivity(
                  currentUser,
                  'DELETE',
                  'EMAIL_LIST',
                  id,
                  `Deleted email list: ${listToDelete.name}`,
                  {},
                  listToDelete.name
              );
          }
      }
  };

  const handleMoveBuyerToAgent = async (buyer: Buyer) => {
      const newAgent: Agent = {
          id: generateId(),
          name: buyer.name || 'Unknown',
          phone: buyer.phone || '',
          email: buyer.email || '',
          brokerage: buyer.companyName || '',
          notes: [`${getLogTimestamp()}: Moved from Buyers. Previous Status: ${buyer.status}`, ...(buyer.notes || [])],
          photo: buyer.photo
      };
      const saved = await api.save(newAgent, 'Agents');
      if (saved) {
          setAgents(prev => {
              if (prev.some(a => a.id === saved.id)) return prev;
              return [...prev, saved];
          });
          await handleDeleteBuyer(buyer.id);
          
          activityLogService.logActivity(
              currentUser,
              'CREATE',
              'AGENT',
              saved.id,
              `Moved buyer ${buyer.name} to agents`,
              {},
              saved.name
          );
          
          setEditingBuyer(null);
          setShowAddBuyerModal(false);
          navigate('/agents');
          setEditingAgent(saved);
          setAgentModalZIndex('z-[160]');
          setMoveNotification({message: 'Contact Moved To Agent Database', show: true});
          setTimeout(() => setMoveNotification({message: '', show: false}), 3000);
      }
  };

  const handleMoveBuyerToWholesaler = async (buyer: Buyer) => {
      const newWholesaler: Wholesaler = {
          id: generateId(),
          name: buyer.name || 'Unknown',
          companyName: buyer.companyName || '',
          phone: buyer.phone || '',
          email: buyer.email || '',
          status: 'New',
          notes: [`${getLogTimestamp()}: Moved from Buyers. Previous Status: ${buyer.status}`, ...(buyer.notes || [])],
          photo: buyer.photo,
          createdAt: new Date().toISOString()
      };
      const saved = await api.save(newWholesaler, 'Wholesalers');
      if (saved) {
          setWholesalers(prev => {
              if (prev.some(w => w.id === saved.id)) return prev;
              return [...prev, saved];
          });
          await handleDeleteBuyer(buyer.id);
          
          activityLogService.logActivity(
              currentUser,
              'CREATE',
              'WHOLESALER',
              saved.id,
              `Moved buyer ${buyer.name} to wholesalers`,
              {},
              saved.name
          );
          
          setEditingBuyer(null);
          setShowAddBuyerModal(false);
          navigate('/wholesalers');
          setEditingWholesaler(saved);
          setShowAddWholesalerModal(true);
          setMoveNotification({message: 'Contact Moved To Wholesaler Database', show: true});
          setTimeout(() => setMoveNotification({message: '', show: false}), 3000);
      }
  };

  const handleMoveAgentToBuyer = async (agent: Agent) => {
      const newBuyer: Buyer = {
          id: generateId(),
          name: agent.name || 'Unknown',
          companyName: agent.brokerage || '',
          phone: agent.phone || '',
          email: agent.email || '',
          status: 'New Lead',
          subscriptionStatus: 'Subscribed',
          propertiesBought: 0,
          notes: [`${getLogTimestamp()}: Moved from Agents.`, ...(agent.notes || [])],
          photo: agent.photo,
          dateAdded: new Date().toISOString(),
          buyBox: { locations: '', minPrice: 0, maxPrice: 0, minArv: 0, maxArv: 0, maxRenoBudget: 0, earliestYearBuilt: 0, latestYearBuilt: 0, propertyTypes: [], minBedrooms: 0, minBathrooms: 0, notes: '' }
      };
      const saved = await api.save(newBuyer, 'Buyers');
      if (saved) {
          setBuyers(prev => {
              if (prev.some(b => b.id === saved.id)) return prev;
              return [...prev, saved];
          });
          setAgents(prev => prev.filter(a => a.id !== agent.id));
          await api.delete(agent.id, 'Agents');
          
          activityLogService.logActivity(
              currentUser,
              'CREATE',
              'BUYER',
              saved.id,
              `Moved agent ${agent.name} to buyers`,
              {},
              saved.name
          );
          
          setViewingAgent(null);
          setEditingAgent(null);
          navigate('/buyers');
          setEditingBuyer(saved);
          setShowAddBuyerModal(true);
          setMoveNotification({message: 'Contact Moved To Buyer Database', show: true});
          setTimeout(() => setMoveNotification({message: '', show: false}), 3000);
      }
  };

  const handleMoveAgentToWholesaler = async (agent: Agent) => {
      const newWholesaler: Wholesaler = {
          id: generateId(),
          name: agent.name || 'Unknown',
          companyName: agent.brokerage || '',
          phone: agent.phone || '',
          email: agent.email || '',
          status: 'New',
          notes: [`${getLogTimestamp()}: Moved from Agents.`, ...(agent.notes || [])],
          photo: agent.photo,
          createdAt: new Date().toISOString()
      };
      const saved = await api.save(newWholesaler, 'Wholesalers');
      if (saved) {
          setWholesalers(prev => {
              if (prev.some(w => w.id === saved.id)) return prev;
              return [...prev, saved];
          });
          setAgents(prev => prev.filter(a => a.id !== agent.id));
          await api.delete(agent.id, 'Agents');
          
          activityLogService.logActivity(
              currentUser,
              'CREATE',
              'WHOLESALER',
              saved.id,
              `Moved agent ${agent.name} to wholesalers`,
              {},
              saved.name
          );
          
          setViewingAgent(null);
          setEditingAgent(null);
          navigate('/wholesalers');
          setEditingWholesaler(saved);
          setShowAddWholesalerModal(true);
          setMoveNotification({message: 'Contact Moved To Wholesaler Database', show: true});
          setTimeout(() => setMoveNotification({message: '', show: false}), 3000);
      }
  };

  const handleMoveWholesalerToBuyer = async (wholesaler: Wholesaler) => {
      const newBuyer: Buyer = {
          id: generateId(),
          name: wholesaler.name || 'Unknown',
          companyName: wholesaler.companyName || '',
          phone: wholesaler.phone || '',
          email: wholesaler.email || '',
          status: 'New Lead',
          subscriptionStatus: 'Subscribed',
          propertiesBought: 0,
          notes: [`${getLogTimestamp()}: Moved from Wholesalers. Previous Status: ${wholesaler.status}`, ...(wholesaler.notes || [])],
          photo: wholesaler.photo,
          dateAdded: new Date().toISOString(),
          buyBox: { locations: '', minPrice: 0, maxPrice: 0, minArv: 0, maxArv: 0, maxRenoBudget: 0, earliestYearBuilt: 0, latestYearBuilt: 0, propertyTypes: [], minBedrooms: 0, minBathrooms: 0, notes: '' }
      };
      const saved = await api.save(newBuyer, 'Buyers');
      if(saved) {
          setBuyers(prev => {
              if (prev.some(b => b.id === saved.id)) return prev;
              return [...prev, saved];
          });
          await handleDeleteWholesaler(wholesaler.id);
          
          activityLogService.logActivity(
              currentUser,
              'CREATE',
              'BUYER',
              saved.id,
              `Moved wholesaler ${wholesaler.name} to buyers`,
              {},
              saved.name
          );
          
          setEditingWholesaler(null);
          setShowAddWholesalerModal(false);
          navigate('/buyers');
          setEditingBuyer(saved);
          setShowAddBuyerModal(true);
          setMoveNotification({message: 'Contact Moved To Buyer Database', show: true});
          setTimeout(() => setMoveNotification({message: '', show: false}), 3000);
      }
  };

  const handleMoveWholesalerToAgent = async (wholesaler: Wholesaler) => {
      const newAgent: Agent = {
          id: generateId(),
          name: wholesaler.name || 'Unknown',
          phone: wholesaler.phone || '',
          email: wholesaler.email || '',
          brokerage: wholesaler.companyName || '',
          notes: [`${getLogTimestamp()}: Moved from Wholesalers. Previous Status: ${wholesaler.status}`, ...(wholesaler.notes || [])],
          photo: wholesaler.photo
      };
      const saved = await api.save(newAgent, 'Agents');
      if(saved) {
          setAgents(prev => [...prev, saved]);
          await handleDeleteWholesaler(wholesaler.id);
          
          activityLogService.logActivity(
              currentUser,
              'CREATE',
              'AGENT',
              saved.id,
              `Moved wholesaler ${wholesaler.name} to agents`,
              {},
              saved.name
          );
          
          setEditingWholesaler(null);
          setShowAddWholesalerModal(false);
          navigate('/agents');
          setEditingAgent(saved);
          setAgentModalZIndex('z-[160]');
          setMoveNotification({message: 'Contact Moved To Agent Database', show: true});
          setTimeout(() => setMoveNotification({message: '', show: false}), 3000);
      }
  };

  const handleViewAgentProfile = (agentNameOrId: string) => {
      if (!agentNameOrId) return;
      let agent = agents.find(a => a.id === agentNameOrId);
      if (!agent) agent = agents.find(a => a.name.toLowerCase() === agentNameOrId.toLowerCase());
      if (agent) {
          setAgentModalZIndex('z-[160]');
          setViewingAgent(agent);
      } else {
          if(confirm(`Agent "${agentNameOrId}" not found in database. Create profile?`)) {
               const newAgent: Agent = { id: generateId(), name: agentNameOrId, phone: '', email: '', brokerage: '', notes: [`${getLogTimestamp()}: Profile created manually`] };
               setAgentModalZIndex('z-[160]');
               setEditingAgent(newAgent); 
          }
      }
  };

  const handleAgentLookup = (val: string) => { const query = val.toLowerCase(); const filtered = agents.filter(a => a.name.toLowerCase().includes(query)); setAgentSuggestions(filtered); setShowAgentSuggestions(true); };
  const handleWholesalerLookup = (val: string) => { const query = val.toLowerCase(); const filtered = wholesalers.filter(a => a.name.toLowerCase().includes(query)); setWholesalerSuggestions(filtered); setShowWholesalerSuggestions(true); };
  const handleBrokerageLookup = (val: string) => { const query = val.toLowerCase(); const filtered = brokerages.filter(b => b.name.toLowerCase().includes(query)); setBrokerageSuggestions(filtered); setShowBrokerageSuggestions(true); };
  const selectAgent = (agent: Agent) => { if (editingDeal) setEditingDeal({ ...editingDeal, agentName: agent.name, agentPhone: agent.phone, agentEmail: agent.email, agentBrokerage: agent.brokerage }); setShowAgentSuggestions(false); };
  const selectWholesaler = (wholesaler: Wholesaler) => { if (editingDeal) setEditingDeal({ ...editingDeal, agentName: wholesaler.name, agentPhone: wholesaler.phone, agentEmail: wholesaler.email, agentBrokerage: wholesaler.companyName }); setShowWholesalerSuggestions(false); };
  const selectBrokerage = (brokerage: Brokerage) => { if (editingDeal) setEditingDeal({ ...editingDeal, agentBrokerage: brokerage.name }); setShowBrokerageSuggestions(false); };
  
  const updateDeal = useCallback(async (id: string, updates: Partial<Deal>) => {
    let currentItem = deals.find(d => d.id === id);
    if (!currentItem) return;
    
    // Automatically track offerDecision changes
    if (updates.offerDecision && updates.offerDecision !== currentItem.offerDecision) {
        const newTrackingEntry = {
            status: updates.offerDecision,
            date: new Date().toISOString(),
            user: currentUser?.name || 'Unknown'
        };
        updates.offerDecisionTracking = [...(currentItem.offerDecisionTracking || []), newTrackingEntry];
    }
    
    const tableName = currentItem.pipelineType === 'jv' ? 'JVDeals' : 'Deals';
    const saved = await api.save({ ...currentItem, ...updates }, tableName);
    if (saved) {
        setDeals(prev => prev.map(d => d.id === id ? saved : d));
        setEditingDeal(prev => prev && prev.id === id ? saved : prev);
        if (saved.agentName) checkAndSaveAgent(saved);
        
        // Determine action type based on updates
        let actionType = 'UPDATE';
        let description = `Updated deal: ${saved.address}`;
        
        const currentLoiAgents = currentItem.dispo?.loiSentAgents?.length || 0;
        const newLoiAgents = updates.dispo?.loiSentAgents?.length || 0;

        if (updates.loiSentDate && updates.loiSentDate !== currentItem.loiSentDate) {
            actionType = 'LOI_SENT';
            description = `Sent LOI for ${saved.address}`;
        } else if (updates.logs && currentItem.logs && updates.logs.length > currentItem.logs.length) {
            actionType = 'NOTE_ADDED';
            description = `Added a note to ${saved.address}`;
        } else if (updates.offerDecision && updates.offerDecision !== currentItem.offerDecision) {
            actionType = 'STATUS_CHANGE';
            description = `Changed pipeline status to ${updates.offerDecision} on ${saved.address}`;
        } else if (updates.contactStatus && updates.contactStatus !== currentItem.contactStatus) {
            actionType = 'STATUS_CHANGE';
            description = `Changed contact status to ${updates.contactStatus} on ${saved.address}`;
        }

        // Log Activity
        activityLogService.logActivity(
            currentUser, 
            actionType, 
            'DEAL', 
            saved.id, 
            description, 
            updates,
            saved.address
        );
    }
  }, [deals, agents]);

  const sortedBuyers = React.useMemo(() => {
      let filtered = [...buyers];
      const activeSearch = globalSearchQuery.trim() || buyerSearch.trim();
      if (activeSearch) { 
          const query = activeSearch.toLowerCase(); 
          const cleanQuery = query.replace(/\D/g, '');
          filtered = filtered.filter(b => (b.name && b.name.toLowerCase().includes(query)) || (b.companyName && b.companyName.toLowerCase().includes(query)) || (b.email && b.email.toLowerCase().includes(query)) || (b.phone && (b.phone.includes(query) || (cleanQuery.length > 0 && b.phone.replace(/\D/g, '').includes(cleanQuery))))); 
      }
      if (buyerStage !== 'All Buyers') {
          filtered = filtered.filter(b => b.status && b.status.includes(buyerStage));
      }
      if (filterConfig.type === 'Buyer Status' && filterConfig.value) filtered = filtered.filter(b => b.status && b.status.includes(filterConfig.value));
      if (filterConfig.type === 'Target Location' && filterConfig.value) {
          const query = filterConfig.value.toLowerCase();
          filtered = filtered.filter(b => b.buyBox?.locations?.toLowerCase().includes(query));
      }
      return filtered.sort((a, b) => {
          if (buyerSort === 'A-Z') return (a.name || a.companyName || '').localeCompare(b.name || b.companyName || '');
          if (buyerSort === 'Z-A') return (b.name || b.companyName || '').localeCompare(a.name || a.companyName || '');
          if (buyerSort === 'Properties Bought') return (b.propertiesBought || 0) - (a.propertiesBought || 0);
          const getDate = (item: any) => {
              if (item.dateAdded) return new Date(item.dateAdded).getTime();
              if (item.createdAt) return new Date(item.createdAt).getTime();
              return 0;
          };
          if (buyerSort === 'Date Added - Newest') return getDate(b) - getDate(a);
          if (buyerSort === 'Date Added - Oldest') return getDate(a) - getDate(b);
          return 0;
      });
  }, [buyers, globalSearchQuery, buyerSearch, filterConfig, buyerSort, buyerStage]);

  const filteredBuyersBySearch = React.useMemo(() => {
      let filtered = [...buyers];
      const activeSearch = globalSearchQuery.trim() || buyerSearch.trim();
      if (activeSearch) { 
          const query = activeSearch.toLowerCase(); 
          const cleanQuery = query.replace(/\D/g, '');
          filtered = filtered.filter(b => (b.name && b.name.toLowerCase().includes(query)) || (b.companyName && b.companyName.toLowerCase().includes(query)) || (b.email && b.email.toLowerCase().includes(query)) || (b.phone && (b.phone.includes(query) || (cleanQuery.length > 0 && b.phone.replace(/\D/g, '').includes(cleanQuery))))); 
      }
      return filtered;
  }, [buyers, globalSearchQuery, buyerSearch]);

  
  const handleUpdateUserProfile = async (userUpdates: UserType) => { 
      const merged = { ...currentUser, ...userUpdates } as UserType; 
      const saved = await api.save(merged, 'Users');
      if(saved) {
          setCurrentUser(saved); 
          localStorage.setItem('azre-current-user', JSON.stringify(saved)); 
          
          if (saved.organization_id && saved.organization_id !== currentUser?.organization_id) {
               setOrganizationId(saved.organization_id);
               alert('Organization changed. The application will now reload to apply new settings.');
               window.location.reload();
          }
      }
  };
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) setImportFile(e.target.files[0]); e.target.value = ''; };
  const handleBuyerFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) setImportBuyerFile(e.target.files[0]); e.target.value = ''; };
  const handleAgentFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) setImportAgentFile(e.target.files[0]); e.target.value = ''; };
  
  const handleSyncAgentPhotos = async () => {
    setIsSyncingPhotos(true);
    try {
        let count = 0;
        for (const agent of agents) {
            if (!agent.photo && agent.name) {
                try {
                    const url = await fetchAgentPhotoFromGAMLS(agent.name, agent.phone);
                    if (url) { 
                        agent.photo = url; 
                        await api.save(agent, 'Agents'); 
                        count++; 
                    }
                    await new Promise(r => setTimeout(r, 200));
                } catch(e) {}
            }
        }
        if (count > 0) { setAgents([...agents]); alert(`Synced ${count} photos`); } else alert('No new photos found');
    } catch(e) {}
    setIsSyncingPhotos(false);
  };
  
  const handleSyncAgentDetails = async () => {
      setIsSyncingDetails(true);
      try {
          let count = 0;
          for (const agent of agents) {
              if (agent.name) {
                  try {
                      const details = await fetchAgentDetailsFromGAMLS(agent.name);
                      if (details) {
                          let updated = false;
                          if (details.email && !agent.email) { agent.email = details.email; updated = true; }
                          if (details.phone && !agent.phone) { agent.phone = formatPhoneNumber(details.phone); updated = true; }
                          if (details.brokerage && !agent.brokerage) { agent.brokerage = details.brokerage; updated = true; }
                          if (details.photoUrl && !agent.photo) { agent.photo = details.photoUrl; updated = true; }
                          if (updated) { await api.save(agent, 'Agents'); count++; }
                      }
                  } catch(e) {}
              }
          }
          if (count > 0) { setAgents([...agents]); alert(`Synced details for ${count} agents`); } else alert('No new details found');
      } catch(e) {}
      setIsSyncingDetails(false);
  };

  const handleSaveEdit = useCallback(async (e?: React.FormEvent, shouldClose: boolean = true, dealToSave?: Deal) => {
    if (e) e.preventDefault();
    const dataToSave = dealToSave || editingDeal;
    if (!dataToSave) return null;
    const updatedDeal: Deal = { 
        ...dataToSave, 
        listPrice: parseNumberFromCurrency(dataToSave.listPrice), 
        offerPrice: parseNumberFromCurrency(dataToSave.offerPrice), 
        originalAskingPrice: parseNumberFromCurrency(dataToSave.originalAskingPrice), 
        reducedAskingPrice: parseNumberFromCurrency(dataToSave.reducedAskingPrice), 
        negotiatedAskingPrice: parseNumberFromCurrency(dataToSave.negotiatedAskingPrice), 
        desiredWholesaleProfit: parseNumberFromCurrency(dataToSave.desiredWholesaleProfit) 
    };
    
    // Find original deal for diffing
    const originalDeal = deals.find(d => d.id === updatedDeal.id);
    
    // Automatically track offerDecision changes
    if (originalDeal && updatedDeal.offerDecision !== originalDeal.offerDecision) {
        const newTrackingEntry = {
            status: updatedDeal.offerDecision,
            date: new Date().toISOString(),
            user: currentUser?.name || 'Unknown'
        };
        updatedDeal.offerDecisionTracking = [...(originalDeal.offerDecisionTracking || []), newTrackingEntry];
    }
    
    // RESTORED: Fields are now saved to DB correctly based on user feedback
    try {
        const tableName = updatedDeal.pipelineType === 'jv' ? 'JVDeals' : 'Deals';
        const saved = await api.save(updatedDeal, tableName);
        if (saved) {
            setDeals(prev => {
                const exists = prev.some(d => d.id === updatedDeal.id);
                if (exists) return prev.map(d => d.id === updatedDeal.id ? saved : d);
                return [saved, ...prev];
            });
            checkAndSaveAgent(saved);
            localStorage.setItem('azre-editing-deal-id', saved.id);
            
            // State Diffing for Activity Logs
            if (originalDeal) {
                const changedFields: Record<string, any> = {};
                
                // Generic diffing for all fields
                const ignoreKeys = ['id', 'createdAt'];
                Object.keys(updatedDeal).forEach(key => {
                    if (!ignoreKeys.includes(key)) {
                        const oldVal = (originalDeal as any)[key];
                        const newVal = (updatedDeal as any)[key];
                        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                            changedFields[key] = { from: oldVal, to: newVal };
                        }
                    }
                });

                if (Object.keys(changedFields).length > 0) {
                    let actionType = 'UPDATE';
                    let description = `Updated deal: ${saved.address}`;

                    // Check for specific critical changes to override generic UPDATE
                    if (changedFields['offerDecision']) {
                        actionType = 'STATUS_CHANGE';
                        description = `Changed pipeline status to ${updatedDeal.offerDecision} on ${saved.address}`;
                    } else if (changedFields['contactStatus']) {
                        actionType = 'STATUS_CHANGE';
                        description = `Changed contact status to ${updatedDeal.contactStatus} on ${saved.address}`;
                    } else if (changedFields['logs'] && updatedDeal.logs && originalDeal.logs && updatedDeal.logs.length > originalDeal.logs.length) {
                        actionType = 'NOTE_ADDED';
                        description = `Added a note to ${saved.address}`;
                    }

                    activityLogService.logActivity(
                        currentUser, 
                        actionType, 
                        'DEAL', 
                        saved.id, 
                        description, 
                        changedFields,
                        saved.address
                    );
                }
            }

            if (shouldClose) { 
                setEditingDeal(null); 
                localStorage.removeItem('azre-editing-deal-id'); 
                setDealModalZIndex('z-[120]');
            } else {
                setEditingDeal(prev => {
                    if (!prev) return saved;
                    // Preserve local state keystrokes! Only update DB-generated fields
                    if (prev.id === saved.id || !prev.id) {
                        return { ...prev, id: saved.id, createdAt: saved.createdAt || prev.createdAt };
                    }
                    return saved;
                });
            }
            return saved;
        } else {
            alert("Database Error: Could not save the deal.");
        }
    } catch (err) {
        alert("An error occurred while saving.");
    }
    return null;
  }, [editingDeal, deals]);

  const handleCloseEditModal = async () => { 
    if (editingDeal) {
        if (!editingDeal.address || editingDeal.address.trim() === '') {
            setDeals(prev => prev.filter(d => d.id !== editingDeal.id));
            const tableName = editingDeal.pipelineType === 'jv' ? 'JVDeals' : 'Deals';
            await api.delete(editingDeal.id, tableName);
            
            activityLogService.logActivity(
                currentUser,
                'DELETE',
                'DEAL',
                editingDeal.id,
                `Deleted draft property`,
                {},
                'Draft Property'
            );
        }
    }
    setEditingDeal(null); 
    localStorage.removeItem('azre-editing-deal-id'); 
    setDealModalZIndex('z-[120]'); 
  };
  
  const handleDeleteDeal = async (id: string) => {
      const dealToDelete = deals.find(d => d.id === id);
      if (!dealToDelete) return;
      const tableName = dealToDelete.pipelineType === 'jv' ? 'JVDeals' : 'Deals';
      const success = await api.delete(id, tableName);
      if (success) {
          setDeals(prev => prev.filter(d => d.id !== id));
          if (dealToDelete) {
              activityLogService.logActivity(
                  currentUser,
                  'DELETE',
                  'DEAL',
                  id,
                  `Deleted property: ${dealToDelete.address}`,
                  {},
                  dealToDelete.address
              );
          }
      }
  };

  const handleAddDeal = async () => {
      const isJv = location.pathname === '/jv-pipeline';
      const newDealInit: Deal = {
          id: generateId(), 
          pipelineType: isJv ? 'jv' : 'main',
          createdAt: new Date().toISOString(),
          address: '',
          mls: '',
          listPrice: 0,
          offerPrice: 0,
          agentName: '',
          agentPhone: '',
          agentEmail: '',
          agentBrokerage: '',
          acquisitionManager: currentUser?.name || '',
          status: 'Analyzing',
          offerDecision: isJv ? 'Available' : 'No Offer Made Yet',
          subMarket: '',
          dealType: [],
          interestLevel: '',
          logs: [`${getLogTimestamp()}: Deal created`],
          inspectionDate: null,
          emdDate: null,
          nextFollowUpDate: null,
          lastContactDate: null,
          dispo: { photos: false, blast: false },
          listingDescription: '',
          originalAskingPrice: 0,
          reducedAskingPrice: 0,
          negotiatedAskingPrice: 0,
          desiredWholesaleProfit: 0,
          priceReductionAlert: '',
          forSaleBy: isJv ? 'Wholesaler' : 'Agent',
          contactStatus: isJv ? 'Have Not Spoken With Wholesaler' : 'Agent Not Contacted Yet',
          agentContacted: 'No', 
          propertyType: 'Single Family Residential',
          yearBuilt: undefined,
          bedrooms: 0,
          bathrooms: 0,
          sqft: 0,
          lotSqft: 0,
          county: '',
          zoning: '',
          lockBoxCode: '',
          dateListed: null,
          arv: 0,
          renovationEstimate: 0,
          comparable1: { address: '', saleDate: '', salePrice: 0 },
          comparable2: { address: '', saleDate: '', salePrice: 0 },
          comparable3: { address: '', saleDate: '', salePrice: 0 },
          photos: [],
          offerDecisionTracking: [{
              status: isJv ? 'Available' : 'No Offer Made Yet',
              date: new Date().toISOString(),
              user: currentUser?.name || 'Unknown'
          }]
      };
      try {
        const tableName = isJv ? 'JVDeals' : 'Deals';
        const savedRecord = await api.save(newDealInit, tableName);
        if (savedRecord) {
            setDeals(prev => {
                if (prev.some(d => d.id === savedRecord.id)) return prev;
                return [savedRecord, ...prev];
            });
            setEditingDeal(savedRecord);
            setDealModalZIndex('z-[120]');
            
            // Log Activity
            activityLogService.logActivity(
                currentUser, 
                'CREATE', 
                'DEAL', 
                savedRecord.id, 
                `Added property: ${savedRecord.address || 'New Property'}`, 
                {},
                savedRecord.address || 'New Property'
            );
        } else {
            alert("Failed to save deal. Check console for details.");
        }
      } catch (e: any) {
          alert("Network Error: Could not initialize new deal. " + e.message);
      }
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
        const currentIndex = orderedDeals.findIndex(d => d.id === editingDeal?.id);
        if (currentIndex === -1) return;
        let newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex >= 0 && newIndex < orderedDeals.length) {
            const nextDeal = orderedDeals[newIndex];
            setEditingDeal({ ...nextDeal });
            localStorage.setItem('azre-editing-deal-id', nextDeal.id);
        }
  };
  const handleAgentNavigate = (direction: 'prev' | 'next') => {
        const currentList = sortedAgents;
        const currentId = viewingAgent?.id || editingAgent?.id;
        const currentIndex = currentList.findIndex(a => a.id === currentId);
        if (currentIndex === -1) return;
        let newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex >= 0 && newIndex < currentList.length) {
            const nextAgent = currentList[newIndex];
            if (viewingAgent) setViewingAgent(nextAgent);
            if (editingAgent) setEditingAgent(nextAgent);
        }
  };
  const handleBuyerNavigate = (direction: 'prev' | 'next') => {
        const currentList = sortedBuyers;
        const currentId = editingBuyer?.id;
        const currentIndex = currentList.findIndex(b => b.id === currentId);
        if (currentIndex === -1) return;
        let newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex >= 0 && newIndex < currentList.length) setEditingBuyer(currentList[newIndex]);
  };
  const handleWholesalerNavigate = (direction: 'prev' | 'next') => {
        const currentList = sortedWholesalers;
        const currentId = editingWholesaler?.id;
        const currentIndex = currentList.findIndex(w => w.id === currentId);
        if (currentIndex === -1) return;
        let newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex >= 0 && newIndex < currentList.length) setEditingWholesaler(currentList[newIndex]);
  };

  const handleSwitchToDeal = async (targetDeal: Deal) => {
    if (!editingDeal) return;
    const draftId = editingDeal.id;
    const tableName = editingDeal.pipelineType === 'jv' ? 'JVDeals' : 'Deals';
    setDeals(prev => prev.filter(d => d.id !== draftId));
    setEditingDeal(targetDeal);
    localStorage.setItem('azre-editing-deal-id', targetDeal.id);
    await api.delete(draftId, tableName);
    
    activityLogService.logActivity(
        currentUser,
        'DELETE',
        'DEAL',
        draftId,
        `Deleted draft property`,
        {},
        'Draft Property'
    );
  };

  const getFilteredDeals = () => {
    let filtered = [...deals]; 
    if (location.pathname === '/jv-pipeline') {
        filtered = filtered.filter(d => d.pipelineType === 'jv');
    } else if (location.pathname === '/pipeline') {
        filtered = filtered.filter(d => d.pipelineType === 'main' || !d.pipelineType);
    }
    const activeSearch = globalSearchQuery.trim() || pipelineSearch.trim();
    if (activeSearch) {
        const query = activeSearch.toLowerCase().trim();
        filtered = filtered.filter(d => ( (d.address && String(d.address).toLowerCase().includes(query)) || (d.mls && String(d.mls).toLowerCase().includes(query)) || (d.agentName && String(d.agentName).toLowerCase().includes(query)) ));
    }
    if (filterConfig.type !== 'All') {
        filtered = filtered.filter(d => {
            if (!d) return false;
            switch (filterConfig.type) {
                case 'Acquisition Manager': return d.acquisitionManager === filterConfig.value; 
                case 'Show Counter Offers Only': return d.offerDecision === 'Seller Counter-Offered'; 
                case 'Sub-Market': return d.subMarket === filterConfig.value;
                case 'Deal Type': return Array.isArray(d.dealType) && d.dealType.includes(filterConfig.value);
                case 'Listing Type': return d.listingType === filterConfig.value;
                case 'Contact Status': return d.contactStatus === filterConfig.value;
                case 'Offer Decision': return d.offerDecision === filterConfig.value;
                case 'Agent Name': return d.agentName === filterConfig.value;
                default: return true;
            }
        });
    }
    return filtered.sort((a, b) => {
        if (pipelineSort === 'Price High-Low') return (b.listPrice || 0) - (a.listPrice || 0);
        if (pipelineSort === 'Price Low-High') return (a.listPrice || 0) - (b.listPrice || 0);
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
    });
  };
  const filteredDeals = getFilteredDeals();
  const getOrderedDeals = () => {
    if (location.pathname !== '/pipeline' && location.pathname !== '/jv-pipeline') return filteredDeals;
    let statusesToShow: string[] = [];
    if (location.pathname === '/jv-pipeline') {
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
    return filteredDeals.filter(d => statusesToShow.includes(d.offerDecision));
  };
  const orderedDeals = getOrderedDeals();
  const getSortedAgents = () => {
      let filtered = [...agents];
      const activeSearch = globalSearchQuery.trim() || agentSearch.trim();
      if (activeSearch) { 
          const query = activeSearch.toLowerCase(); 
          const cleanQuery = query.replace(/\D/g, '');
          filtered = filtered.filter(a => String(a.name).toLowerCase().includes(query) || (a.brokerage && String(a.brokerage).toLowerCase().includes(query)) || (a.phone && (a.phone.includes(query) || (cleanQuery.length > 0 && a.phone.replace(/\D/g, '').includes(cleanQuery))))); 
      }
      if (agentStage !== 'All Agents') {
          switch (agentStage) {
              case 'Contacted': filtered = filtered.filter(a => a.hasBeenContacted); break;
              case 'Investor Friendly': filtered = filtered.filter(a => a.handlesInvestments); break;
              case 'Agreed to Send': filtered = filtered.filter(a => a.agreedToSend); break;
              case 'Closed Deals': filtered = filtered.filter(a => a.hasClosedDeals); break;
          }
      }
      if (filterConfig.type === 'Brokerage' && filterConfig.value) filtered = filtered.filter(a => a.brokerage === filterConfig.value);
      if (filterConfig.type === 'Relationship' && filterConfig.value) {
          switch (filterConfig.value as any) {
              case 'Contacted': filtered = filtered.filter(a => a.hasBeenContacted); break;
              case 'Investor Friendly': filtered = filtered.filter(a => a.handlesInvestments); break;
              case 'Agreed to Send': filtered = filtered.filter(a => a.agreedToSend); break;
              case 'Closed Deals': filtered = filtered.filter(a => a.hasClosedDeals); break;
          }
      }
      filtered.sort((a, b) => {
          const nameA = String(a.name || '').toLowerCase();
          const nameB = String(b.name || '').toLowerCase();
          if (agentSort === 'A-Z') return nameA.localeCompare(nameB);
          if (agentSort === 'Z-A') return nameB.localeCompare(nameA);
          if (agentSort === 'Brokerage') { const brokA = String(a.brokerage || '').toLowerCase(); const brokB = String(b.brokerage || '').toLowerCase(); return brokA.localeCompare(brokB) || nameA.localeCompare(nameB); }
          if (agentSort === 'Last Contacted') { const tA = a.lastContactDate ? new Date(a.lastContactDate).getTime() : 0; const tB = b.lastContactDate ? new Date(b.lastContactDate).getTime() : 0; return tB - tA || nameA.localeCompare(nameB); }
          if (agentSort === 'Next Follow-Up') { const tA = a.nextFollowUpDate ? new Date(a.nextFollowUpDate).getTime() : Number.MAX_SAFE_INTEGER; const tB = b.nextFollowUpDate ? new Date(b.nextFollowUpDate).getTime() : Number.MAX_SAFE_INTEGER; return tA - tB || nameA.localeCompare(nameB); }
          return 0;
      });
      return filtered;
  };
  const sortedAgents = getSortedAgents();

  const filteredAgentsBySearch = React.useMemo(() => {
    let filtered = [...agents];
    const activeSearch = globalSearchQuery.trim() || agentSearch.trim();
    if (activeSearch) { 
        const query = activeSearch.toLowerCase(); 
        const cleanQuery = query.replace(/\D/g, '');
        filtered = filtered.filter(a => String(a.name).toLowerCase().includes(query) || (a.brokerage && String(a.brokerage).toLowerCase().includes(query)) || (a.phone && (a.phone.includes(query) || (cleanQuery.length > 0 && a.phone.replace(/\D/g, '').includes(cleanQuery))))); 
    }
    return filtered;
  }, [agents, globalSearchQuery, agentSearch]);

  const sortedWholesalers = React.useMemo(() => {
      let filtered = [...wholesalers];
      const activeSearch = globalSearchQuery.trim() || wholesalerSearch.trim();
      if (activeSearch) { 
          const query = activeSearch.toLowerCase(); 
          const cleanQuery = query.replace(/\D/g, '');
          filtered = filtered.filter(w => (w.name && w.name.toLowerCase().includes(query)) || (w.companyName && w.companyName.toLowerCase().includes(query)) || (w.email && w.email.toLowerCase().includes(query)) || (w.phone && (w.phone.includes(query) || (cleanQuery.length > 0 && w.phone.replace(/\D/g, '').includes(cleanQuery))))); 
      }
      if (wholesalerStage !== 'All Wholesalers') {
          filtered = filtered.filter(w => w.status === wholesalerStage);
      }
      if (filterConfig.type === 'Wholesaler Type' && filterConfig.value) {
          filtered = filtered.filter(w => w.wholesalerType === filterConfig.value);
      }
      return filtered.sort((a, b) => {
          if (wholesalerSort === 'A-Z') return (a.name || '').localeCompare(b.name || '');
          if (wholesalerSort === 'Z-A') return (b.name || '').localeCompare(a.name || '');
          if (wholesalerSort === 'Last Contacted') { const tA = a.lastContactDate ? new Date(a.lastContactDate).getTime() : 0; const tB = b.lastContactDate ? new Date(b.lastContactDate).getTime() : 0; return tB - tA; }
          if (wholesalerSort === 'Next Follow-Up') { const tA = a.nextFollowUpDate ? new Date(a.nextFollowUpDate).getTime() : Number.MAX_SAFE_INTEGER; const tB = b.nextFollowUpDate ? new Date(b.nextFollowUpDate).getTime() : Number.MAX_SAFE_INTEGER; return tA - tB; }
          return 0;
      });
  }, [wholesalers, globalSearchQuery, wholesalerSearch, wholesalerSort, wholesalerStage, filterConfig]);

  const filteredWholesalersBySearch = React.useMemo(() => {
      let filtered = [...wholesalers];
      const activeSearch = globalSearchQuery.trim() || wholesalerSearch.trim();
      if (activeSearch) { 
          const query = activeSearch.toLowerCase(); 
          const cleanQuery = query.replace(/\D/g, '');
          filtered = filtered.filter(w => (w.name && w.name.toLowerCase().includes(query)) || (w.companyName && w.companyName.toLowerCase().includes(query)) || (w.email && w.email.toLowerCase().includes(query)) || (w.phone && (w.phone.includes(query) || (cleanQuery.length > 0 && w.phone.replace(/\D/g, '').includes(cleanQuery))))); 
      }
      return filtered;
  }, [wholesalers, globalSearchQuery, wholesalerSearch]);

  const editingDealIndex = orderedDeals.findIndex(d => d.id === editingDeal?.id);

  if (isAuthChecking) return (<div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div>);
  if (!isAuthenticated) return <LoginForm onLogin={handleLogin} />;

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans overflow-hidden">
      {showDuplicateNotification && (<div className="fixed top-4 right-4 z-[100] bg-red-600/90 text-white px-6 py-4 rounded-xl shadow-2xl backdrop-blur-md animate-in slide-in-from-right-10 fade-in duration-300 flex items-center gap-4 border border-white/20"><div className="bg-white/20 p-2 rounded-full"><AlertCircle size={24} className="text-white" /></div><div><div className="font-black text-lg">Duplicate Property</div><div className="text-sm text-red-100 font-medium">Opening existing record...</div></div></div>)}
      
      {moveNotification.show && (
          <div className="fixed top-4 right-4 z-[200] bg-green-600/90 text-white px-6 py-4 rounded-xl shadow-2xl backdrop-blur-md animate-in slide-in-from-right-10 fade-in duration-300 flex items-center gap-4 border border-white/20">
              <div className="bg-white/20 p-2 rounded-full"><CheckCircle size={24} className="text-white" /></div>
              <div><div className="font-black text-lg">Success</div><div className="text-sm text-green-100 font-medium">{moveNotification.message}</div></div>
          </div>
      )}

      <Sidebar 
          isSidebarCollapsed={isSidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          currentUser={currentUser}
          onlineUsersCount={onlineUsersCount}
          setShowOnlineUsersModal={setShowOnlineUsersModal}
          setShowSettings={setShowSettings}
      />
      
      {isMobileMenuOpen && (<div className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />)}
      
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 md:p-4 shadow-lg flex justify-between items-center z-10 shrink-0 gap-4">
              <div className="flex items-center gap-3 md:gap-4">
                  <div className="md:hidden"><button onClick={() => setIsMobileMenuOpen(true)} className="bg-blue-600 p-2.5 rounded-lg hover:bg-blue-500 transition-colors shadow-sm"><Menu size={24} className="text-white" /></button></div>
                  <h1 className="text-lg md:text-xl font-bold tracking-tight shrink-0 text-gray-900 dark:text-white flex items-center gap-1"><span className="md:inline hidden">AZRE</span><span className="md:hidden">AZRE</span><span className="text-blue-500">DealDesk</span></h1>
              </div>
              <div className="flex-1 max-w-xl mx-auto relative hidden md:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input type="text" placeholder="Global Search..." className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg py-2 pl-10 pr-4 text-sm text-gray-900 dark:text-white focus:border-blue-500 outline-none transition-all placeholder-gray-500" value={globalSearchQuery} onChange={(e) => setGlobalSearchQuery(e.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                  {isSyncing && <div className="flex items-center gap-2 text-xs text-blue-400 animate-pulse"><RefreshCw size={14} className="animate-spin"/> Syncing DB...</div>}
                  <button onClick={handleAddDeal} className="bg-blue-600 hover:bg-blue-50 text-white p-3 rounded-full shadow-lg shrink-0 transition-transform active:scale-95"><Plus size={24} /></button>
              </div>
          </div>
          
          <main className="flex-1 overflow-y-auto relative bg-gray-50 dark:bg-gray-900">
             <Routes>
               <Route path="/" element={
                 <Dashboard 
                    currentUser={currentUser}
                    deals={deals}
                    agents={agents}
                    buyers={buyers}
                    onEdit={(d) => { setDealModalZIndex('z-[120]'); setEditingDeal(d); }}
                    onUpdate={updateDeal}
                    onDelete={handleDeleteDeal}
                    onMove={(id, dec) => updateDeal(id, {offerDecision: dec})}
                 />
               } />
               <Route path="/pipeline" element={
                 <PipelineView
                    title="Main Pipeline"
                    pipelineType="main"
                    deals={deals}
                    agents={agents}
                    pipelineSearch={pipelineSearch}
                    setPipelineSearch={setPipelineSearch}
                    pipelineStage={pipelineStage}
                    setPipelineStage={setPipelineStage}
                    pipelineSort={pipelineSort}
                    setPipelineSort={setPipelineSort}
                    showFilterMenu={showFilterMenu}
                    setShowFilterMenu={setShowFilterMenu}
                    filterConfig={filterConfig}
                    setFilterConfig={setFilterConfig}
                    agentFilterSearch={agentFilterSearch}
                    setAgentFilterSearch={setAgentFilterSearch}
                    showAgentFilterSuggestions={showAgentFilterSuggestions}
                    setShowAgentFilterSuggestions={setShowAgentFilterSuggestions}
                    handleAddDeal={handleAddDeal}
                    updateDeal={updateDeal}
                    setDealModalZIndex={setDealModalZIndex}
                    setEditingDeal={setEditingDeal}
                    filteredDeals={filteredDeals}
                    orderedDeals={orderedDeals}
                    handleDeleteDeal={handleDeleteDeal}
                 />
               } />
               <Route path="/jv-pipeline" element={
                 <PipelineView
                    title="JV Pipeline"
                    pipelineType="jv"
                    deals={deals}
                    agents={wholesalers as any}
                    pipelineSearch={pipelineSearch}
                    setPipelineSearch={setPipelineSearch}
                    pipelineStage={pipelineStage}
                    setPipelineStage={setPipelineStage}
                    pipelineSort={pipelineSort}
                    setPipelineSort={setPipelineSort}
                    showFilterMenu={showFilterMenu}
                    setShowFilterMenu={setShowFilterMenu}
                    filterConfig={filterConfig}
                    setFilterConfig={setFilterConfig}
                    agentFilterSearch={agentFilterSearch}
                    setAgentFilterSearch={setAgentFilterSearch}
                    showAgentFilterSuggestions={showAgentFilterSuggestions}
                    setShowAgentFilterSuggestions={setShowAgentFilterSuggestions}
                    handleAddDeal={handleAddDeal}
                    updateDeal={updateDeal}
                    setDealModalZIndex={setDealModalZIndex}
                    setEditingDeal={setEditingDeal}
                    filteredDeals={filteredDeals}
                    orderedDeals={orderedDeals}
                    handleDeleteDeal={handleDeleteDeal}
                 />
               } />
               <Route path="/email" element={
                 <div className="w-full h-full">
                     <EmailManager 
                       buyers={buyers} 
                       agents={agents} 
                       deals={deals}
                       campaigns={campaigns}
                       wholesalers={wholesalers}
                       emailLists={emailLists}
                       onCreateList={handleCreateEmailList}
                       onDeleteList={handleDeleteEmailList}
                       onUpdateContact={handleUpdateContact}
                     />
                 </div>
               } />
               <Route path="/market-scanner" element={
                 <div className="w-full h-full">
                     <MarketScanner />
                 </div>
               } />
               <Route path="/campaigns" element={
                 <div className="w-full h-full">
                     <Campaigns 
                       buyers={buyers} 
                       agents={agents} 
                       deals={deals}
                       campaigns={campaigns}
                       wholesalers={wholesalers}
                       emailLists={emailLists}
                       onCreateList={handleCreateEmailList}
                       onDeleteList={handleDeleteEmailList}
                       onUpdateContact={handleUpdateContact}
                     />
                 </div>
               } />
               <Route path="/message-sender" element={
                 <div className="w-full h-full">
                     <MessageCenter />
                 </div>
               } />
               <Route path="/acquisitions-inbox" element={
                 <div className="w-full h-full">
                     <Inbox title="Acquisitions Inbox" initialMessages={mockAcquisitionsMessages} />
                 </div>
               } />
               <Route path="/dispositions-inbox" element={
                 <div className="w-full h-full">
                     <Inbox title="Dispositions Inbox" initialMessages={mockDispositionsMessages} />
                 </div>
               } />
               <Route path="/offer-builder" element={
                 <div className="w-full h-full">
                     <LoiDesigner />
                 </div>
               } />
               <Route path="/market-analyzer" element={
                 <div className="w-full h-full">
                     <MarketOracle />
                 </div>
               } />
               <Route path="/agents" element={
                 <AgentsView 
                    agents={agents}
                    brokerages={brokerages}
                    agentSearch={agentSearch}
                    setAgentSearch={setAgentSearch}
                    agentStage={agentStage}
                    setAgentStage={setAgentStage}
                    agentSort={agentSort}
                    setAgentSort={setAgentSort}
                    showFilterMenu={showFilterMenu}
                    setShowFilterMenu={setShowFilterMenu}
                    filterConfig={filterConfig}
                    setFilterConfig={setFilterConfig}
                    filteredAgentsBySearch={filteredAgentsBySearch}
                    sortedAgents={sortedAgents}
                    setAgentModalZIndex={setAgentModalZIndex}
                    setEditingAgent={setEditingAgent}
                    setViewingAgent={setViewingAgent}
                    setAgents={setAgents}
                    api={api}
                 />
               } />
               <Route path="/wholesalers" element={
                 <WholesalersView 
                    wholesalers={wholesalers}
                    wholesalerSearch={wholesalerSearch}
                    setWholesalerSearch={setWholesalerSearch}
                    wholesalerStage={wholesalerStage}
                    setWholesalerStage={setWholesalerStage}
                    wholesalerSort={wholesalerSort}
                    setWholesalerSort={setWholesalerSort}
                    showFilterMenu={showFilterMenu}
                    setShowFilterMenu={setShowFilterMenu}
                    filterConfig={filterConfig}
                    setFilterConfig={setFilterConfig}
                    filteredWholesalersBySearch={filteredWholesalersBySearch}
                    sortedWholesalers={sortedWholesalers}
                    handleAddWholesaler={handleAddWholesaler}
                    setEditingWholesaler={setEditingWholesaler}
                    setShowAddWholesalerModal={setShowAddWholesalerModal}
                    handleDeleteWholesaler={handleDeleteWholesaler}
                 />
               } />
               <Route path="/contacts" element={
                 <div className="w-full h-full">
                     <ContactsManager contacts={contacts} setContacts={setContacts} />
                 </div>
               } />
               <Route path="/buyers" element={
                 <BuyersView 
                    buyers={buyers}
                    buyerSearch={buyerSearch}
                    setBuyerSearch={setBuyerSearch}
                    buyerStage={buyerStage}
                    setBuyerStage={setBuyerStage}
                    buyerSort={buyerSort}
                    setBuyerSort={setBuyerSort}
                    showFilterMenu={showFilterMenu}
                    setShowFilterMenu={setShowFilterMenu}
                    filterConfig={filterConfig}
                    setFilterConfig={setFilterConfig}
                    filteredBuyersBySearch={filteredBuyersBySearch}
                    sortedBuyers={sortedBuyers}
                    handleAddBuyer={handleAddBuyer}
                    setEditingBuyer={setEditingBuyer}
                    setShowAddBuyerModal={setShowAddBuyerModal}
                    handleDeleteBuyer={handleDeleteBuyer}
                    handleUpdateBuyer={handleUpdateBuyer}
                 />
               } />
               <Route path="/calculator" element={<div className="max-w-3xl mx-auto p-4 md:p-8"><h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-purple-600 dark:text-purple-400"><Calculator/> Deal Analyzer</h2><div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 space-y-4"><div className="grid grid-cols-2 gap-4"><div><label className="text-xs uppercase font-bold text-gray-500">ARV</label><input type="number" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-3" value={calcData.arv} onChange={e => setCalcData({...calcData, arv: Number(e.target.value)})} /></div><div><label className="text-xs uppercase font-bold text-gray-500">Repairs</label><input type="number" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-3" value={calcData.repairs} onChange={e => setCalcData({...calcData, repairs: Number(e.target.value)})} /></div><div><label className="text-xs uppercase font-bold text-gray-500">Wholesale Fee</label><input type="number" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-3" value={calcData.fee} onChange={e => setCalcData({...calcData, fee: Number(e.target.value)})} /></div><div className="flex items-center"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={calcData.isDoubleClose} onChange={e => setCalcData({...calcData, isDoubleClose: e.target.checked})} className="w-5 h-5 rounded" /><span className="text-sm font-bold dark:text-white">Double Close?</span></label></div></div><div className="pt-4 border-t border-gray-200 dark:border-gray-700 mt-4"><div className="text-center"><div className="text-sm text-gray-500 uppercase font-bold">Max Allowable Offer (MAO)</div><div className="text-4xl font-bold text-green-600 dark:text-green-400">{formatCurrency(mao)}</div><div className="text-xs text-gray-400 mt-1">70% Rule - Repairs - Fee {calcData.isDoubleClose ? '- Costs' : ''}</div></div></div></div></div>} />
               <Route path="/calendar" element={<div className="w-full h-full"><CalendarView agents={agents} buyers={buyers} onUpdateAgent={handleUpdateAgent} onUpdateBuyer={(id, updates) => handleUpdateBuyer(String(id), updates)} onViewAgent={(agent) => setViewingAgent(agent)} onViewBuyer={(buyer) => { setEditingBuyer(buyer); setShowAddBuyerModal(true); }} /></div>} />
               <Route path="*" element={<Navigate to="/" replace />} />
             </Routes>
        </main>
      </div>

      {importFile && (<ImportMapModal file={importFile} onClose={() => setImportFile(null)} onImport={async (d) => { const saved = await api.saveBatch(d,'Deals'); if(saved) { setDeals(prev=>{ const newIds = new Set(saved.map((s:any)=>s.id)); const old = prev.filter(p=>!newIds.has(p.id)); return [...old, ...saved]; }); activityLogService.logActivity(currentUser, 'CREATE', 'DEAL', 'batch', `Imported ${saved.length} properties`, {}, 'Batch Import'); } }} />)}
      {importBuyerFile && (<ImportBuyerMapModal file={importBuyerFile} onClose={() => setImportBuyerFile(null)} onImport={async (importedBuyers, overwrite) => {
          const saved = await api.saveBatch(importedBuyers, 'Buyers');
          if(saved) {
              setBuyers(prevBuyers => {
                  const newIds = new Set(saved.map((s:any) => s.id));
                  const oldBuyers = prevBuyers.filter(b => !newIds.has(b.id));
                  return [...oldBuyers, ...saved];
              });
              activityLogService.logActivity(currentUser, 'CREATE', 'BUYER', 'batch', `Imported ${saved.length} buyers`, {}, 'Batch Import');
          }
          setImportBuyerFile(null);
      }} />)}
      {importAgentFile && (<ImportAgentMapModal file={importAgentFile} onClose={() => setImportAgentFile(null)} onImport={async (a) => { const saved = await api.saveBatch(a,'Agents'); if(saved) { setAgents(prev=>{ const newIds = new Set(saved.map((s:any)=>s.id)); const old = prev.filter(p=>!newIds.has(p.id)); return [...old, ...saved]; }); activityLogService.logActivity(currentUser, 'CREATE', 'AGENT', 'batch', `Imported ${saved.length} agents`, {}, 'Batch Import'); } }} />)}
      

      {showAddWholesalerModal && editingWholesaler && (<EditWholesalerModal wholesaler={editingWholesaler} onClose={() => { setShowAddWholesalerModal(false); setEditingWholesaler(null); }} onSave={handleSaveWholesaler} onDelete={handleDeleteWholesaler} currentUser={currentUser} deals={deals} onOpenDeal={(d) => { setEditingWholesaler(null); setShowAddWholesalerModal(false); setDealModalZIndex('z-[160]'); setEditingDeal(d); }} onNavigate={handleWholesalerNavigate} hasNext={sortedWholesalers.indexOf(editingWholesaler) < sortedWholesalers.length - 1} hasPrevious={sortedWholesalers.indexOf(editingWholesaler) > 0} onMoveToAgent={() => handleMoveWholesalerToAgent(editingWholesaler)} onMoveToBuyer={() => handleMoveWholesalerToBuyer(editingWholesaler)} />)}
      {/* FIXED: currentUser prop added to ensure activity log name correctly renders */}
      {showAddBuyerModal && editingBuyer && (<EditBuyerModal buyer={editingBuyer} onClose={() => { setShowAddBuyerModal(false); setEditingBuyer(null); }} onSave={handleSaveBuyer} currentUser={currentUser} deals={deals} onOpenDeal={(d) => { setEditingBuyer(null); setShowAddBuyerModal(false); setDealModalZIndex('z-[160]'); setEditingDeal(d); }} onNavigate={handleBuyerNavigate} hasNext={sortedBuyers.indexOf(editingBuyer) < sortedBuyers.length - 1} hasPrevious={sortedBuyers.indexOf(editingBuyer) > 0} allBuyers={buyers} onSwitchToBuyer={(b) => setEditingBuyer(b)} onMoveToAgent={() => handleMoveBuyerToAgent(editingBuyer)} onMoveToWholesaler={() => handleMoveBuyerToWholesaler(editingBuyer)} zIndex="z-[140]" />)}
      {showSettings && currentUser && (<SettingsModal onClose={() => setShowSettings(false)} user={currentUser} onUpdateUser={handleUpdateUserProfile} onLogout={handleLogout} onOpenImportDeals={() => { setShowSettings(false); document.getElementById('import-deals')?.click(); }} onOpenImportBuyers={() => { setShowSettings(false); document.getElementById('import-buyers')?.click(); }} onOpenImportAgents={() => { setShowSettings(false); document.getElementById('import-agents')?.click(); }} theme={theme} setTheme={setTheme} isSidebarCollapsed={isSidebarCollapsed} setSidebarCollapsed={setSidebarCollapsed} agentsCount={agents.length} buyersCount={buyers.length} onSyncAgentPhotos={handleSyncAgentPhotos} isSyncingPhotos={isSyncingPhotos} onSyncAgentDetails={handleSyncAgentDetails} isSyncingDetails={isSyncingDetails} />)}
      
      <input type="file" id="import-deals" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
      <input type="file" id="import-buyers" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleBuyerFileUpload} />
      <input type="file" id="import-agents" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleAgentFileUpload} />

      {viewingAgent && (<AgentProfileModal agent={viewingAgent} onClose={() => setViewingAgent(null)} onUpdateAgent={handleUpdateAgent} currentUser={currentUser} deals={deals} onOpenDeal={(d) => { setDealModalZIndex('z-[160]'); setEditingDeal(d); }} zIndex={agentModalZIndex} onNavigate={handleAgentNavigate} hasNext={sortedAgents.indexOf(viewingAgent) < sortedAgents.length - 1} hasPrevious={sortedAgents.indexOf(viewingAgent) > 0} onMoveToBuyer={() => handleMoveAgentToBuyer(viewingAgent)} onMoveToWholesaler={() => handleMoveAgentToWholesaler(viewingAgent)} />)}
      {editingAgent && (<AgentProfileModal agent={editingAgent} onClose={() => setEditingAgent(null)} onUpdateAgent={handleUpdateAgent} currentUser={currentUser} deals={deals} onOpenDeal={(d) => { setDealModalZIndex('z-[160]'); setEditingDeal(d); }} onDelete={async (id) => { const agentToDelete = agents.find(a => a.id === id); const s = await api.delete(id, 'Agents'); if(s) { setAgents(prev => prev.filter(a => a.id !== id)); setEditingAgent(null); if (agentToDelete) { activityLogService.logActivity(currentUser, 'DELETE', 'AGENT', id, `Deleted agent: ${agentToDelete.name}`, {}, agentToDelete.name); } }}} zIndex={agentModalZIndex} onNavigate={handleAgentNavigate} hasNext={sortedAgents.indexOf(editingAgent) < sortedAgents.length - 1} hasPrevious={sortedAgents.indexOf(editingAgent) > 0} onMoveToBuyer={() => handleMoveAgentToBuyer(editingAgent)} onMoveToWholesaler={() => handleMoveAgentToWholesaler(editingAgent)} />)}
      {editingDeal && editingDeal.pipelineType === 'jv' ? (
        <EditWholesalerDealModal
            deal={editingDeal}
            setDeal={setEditingDeal}
            onSave={handleSaveEdit}
            onClose={handleCloseEditModal}
            onViewWholesaler={(id) => {
                const w = wholesalers.find(w => w.id === id);
                if (w) { setEditingWholesaler(w); setShowAddWholesalerModal(true); }
            }}
            wholesalerSuggestions={wholesalerSuggestions}
            brokerageSuggestions={brokerageSuggestions}
            showWholesalerSuggestions={showWholesalerSuggestions}
            showBrokerageSuggestions={showBrokerageSuggestions}
            onWholesalerLookup={handleWholesalerLookup}
            onBrokerageLookup={handleBrokerageLookup}
            onSelectWholesaler={selectWholesaler}
            onSelectBrokerage={selectBrokerage}
            wholesalers={wholesalers}
            onUpdateWholesaler={handleUpdateWholesaler}
            onAddNewWholesaler={async (name) => {
                const newWholesaler: Wholesaler = { id: generateId(), name: name || '', phone: '', email: '', companyName: '', status: 'New', notes: [`${getLogTimestamp()}: Created from Deal Modal`] };
                const saved = await api.save(newWholesaler, 'Wholesalers');
                if(saved) {
                    setWholesalers(prev => {
                        if (prev.some(w => w.id === saved.id)) return prev;
                        return [...prev, saved];
                    });
                    setEditingWholesaler(saved);
                    setShowAddWholesalerModal(true);
                    return saved;
                }
            }}
            currentUser={currentUser}
            onNavigate={handleNavigate}
            hasNext={editingDealIndex !== -1 && editingDealIndex < orderedDeals.length - 1}
            hasPrevious={editingDealIndex !== -1 && editingDealIndex > 0}
            buyers={buyers}
            onViewBuyer={(id) => {
                const b = buyers.find(buyer => buyer.id === id);
                if(b) { setEditingBuyer(b); setShowAddBuyerModal(true); }
            }}
            zIndex={dealModalZIndex}
            allDeals={deals}
            onSwitchToDeal={handleSwitchToDeal}
        />
      ) : editingDeal ? (
        <EditDealModal 
            deal={editingDeal} 
            setDeal={setEditingDeal} 
            onSave={handleSaveEdit} 
            onClose={handleCloseEditModal} 
            onViewAgent={handleViewAgentProfile} 
            agentSuggestions={agentSuggestions} 
            brokerageSuggestions={brokerageSuggestions} 
            showAgentSuggestions={showAgentSuggestions} 
            showBrokerageSuggestions={showBrokerageSuggestions} 
            onAgentLookup={handleAgentLookup} 
            onBrokerageLookup={handleBrokerageLookup} 
            onSelectAgent={selectAgent} 
            onSelectBrokerage={selectBrokerage} 
            agents={agents} 
            onUpdateAgent={handleUpdateAgent} 
            onAddNewAgent={async (name) => { 
                const newAgent: Agent = { id: generateId(), name: name || '', phone: '', email: '', brokerage: '', notes: [`${getLogTimestamp()}: Created from Deal Modal`] }; 
                const saved = await api.save(newAgent, 'Agents'); 
                if(saved) { 
                    setAgents(prev => {
                        if (prev.some(a => a.id === saved.id)) return prev;
                        return [...prev, saved];
                    }); 
                    setEditingAgent(saved); 
                    setAgentModalZIndex('z-[160]'); 
                } 
            }} 
            currentUser={currentUser} 
            onNavigate={handleNavigate} 
            hasNext={editingDealIndex !== -1 && editingDealIndex < orderedDeals.length - 1} 
            hasPrevious={editingDealIndex !== -1 && editingDealIndex > 0} 
            buyers={buyers} 
            onViewBuyer={(id) => { 
                const b = buyers.find(buyer => buyer.id === id); 
                if(b) { setEditingBuyer(b); setShowAddBuyerModal(true); } 
            }} 
            zIndex={dealModalZIndex} 
            allDeals={deals}
            onSwitchToDeal={handleSwitchToDeal}
        />
      ) : null}
      
      {showOnlineUsersModal && (
          <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowOnlineUsersModal(false)}>
              <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-sm border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-between items-center">
                      <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div> Online Users ({onlineUsersCount})</h3>
                      <button onClick={() => setShowOnlineUsersModal(false)}><X size={18} className="text-gray-500 hover:text-gray-900 dark:hover:text-white"/></button>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto p-2">
                      {onlineUsersList.map(user => (
                          <div key={user.id} className="flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden shrink-0">
                                  {user.photo ? <img src={user.photo} className="w-full h-full object-cover"/> : <User size={16} className="text-gray-400 m-auto mt-2"/>}
                              </div>
                              <div>
                                  <div className="text-sm font-bold text-gray-900 dark:text-white">{user.name}</div>
                                  <div className="text-xs text-blue-500 dark:text-blue-400">{user.position}</div>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}