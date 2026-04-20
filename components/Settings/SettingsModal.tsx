
import React, { useState, useRef } from 'react';
import { X, CheckCircle, User, Home, Users, Layout, Save, LogOut, Upload, FileSpreadsheet, Download, Moon, Sun, Monitor, RefreshCw, Loader2, Database, Mail, Chrome, Image as ImageIcon, Wand2, Link } from 'lucide-react';
import { User as UserType } from '../../types';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { SettingsEmail } from './SettingsEmail';
import { DatabaseAdmin } from './DatabaseAdmin';
import { ChromePluginSettings } from './ChromePluginSettings';
import { serverFunctions, processPhotoUrl } from '../../services/utils';
import { api } from '../../services/api';

interface SettingsModalProps {
    onClose: () => void;
    user: UserType;
    onUpdateUser: (user: UserType) => void;
    onLogout: () => void;
    
    onOpenImportDeals: () => void;
    onOpenImportBuyers: () => void;
    onOpenImportAgents: () => void;
    
    theme: string;
    setTheme: (t: 'dark' | 'light' | 'system') => void;
    
    isSidebarCollapsed: boolean;
    setSidebarCollapsed: (c: boolean) => void;
    
    agentsCount: number;
    buyersCount: number;
    
    onSyncAgentPhotos?: () => void;
    isSyncingPhotos?: boolean;
    
    onSyncAgentDetails?: () => void;
    isSyncingDetails?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
    onClose, user, onUpdateUser, onLogout, 
    onOpenImportDeals, onOpenImportBuyers, onOpenImportAgents,
    theme, setTheme, isSidebarCollapsed, setSidebarCollapsed,
    agentsCount, buyersCount, onSyncAgentPhotos, isSyncingPhotos,
    onSyncAgentDetails, isSyncingDetails
}) => {
    const [activeTab, setActiveTab] = useState('users');
    const [editedUser, setEditedUser] = useState<any>({ ...user, confirmPassword: user.password || '' });
    const [isGeneratingBackgrounds, setIsGeneratingBackgrounds] = useState(false);
    const [generationStatus, setGenerationStatus] = useState('');
    
    // Supabase Settings State
    const [supabaseSaveStatus, setSupabaseSaveStatus] = useState('');
    
    // Global Integration State
    const [integrationId, setIntegrationId] = useState<string | null>(null);
    const [mlsApiKey, setMlsApiKey] = useState('');
    const [twilioSid, setTwilioSid] = useState('');
    const [twilioToken, setTwilioToken] = useState('');
    const [twilioPhoneNumber, setTwilioPhoneNumber] = useState('');
    const [isLoadingIntegrations, setIsLoadingIntegrations] = useState(false);
    const [mlsSaveStatus, setMlsSaveStatus] = useState('');
    const [twilioSaveStatus, setTwilioSaveStatus] = useState('');

    React.useEffect(() => {
        if (activeTab === 'integrations') {
            const loadIntegrations = async () => {
                setIsLoadingIntegrations(true);
                try {
                    const data = await api.load('Integrations');
                    if (data && data.length > 0) {
                        const orgInt = data.find((i: any) => i.organization && user.organization && i.organization.toLowerCase() === user.organization.toLowerCase());
                        const ints = orgInt || data[0];
                        setIntegrationId(ints.id);
                        if (ints.supabaseUrl) { /* ignored, legacy custom override */ }
                        if (ints.supabaseKey) { /* ignored, legacy custom override */ }
                        setMlsApiKey(ints.mlsApiKey || '');
                        setTwilioSid(ints.twilioAccountSid || '');
                        setTwilioToken(ints.twilioAuthToken || '');
                        setTwilioPhoneNumber(ints.twilioPhoneNumber || '');
                    }
                } catch (e) {
                    console.error("Failed to load integrations", e);
                } finally {
                    setIsLoadingIntegrations(false);
                }
            };
            loadIntegrations();
        }
    }, [activeTab, user.organization]);

    const handleSaveMls = async () => {
        try {
            if (integrationId) {
                await api.save({ id: integrationId, mlsApiKey }, 'Integrations');
            } else {
                const newId = crypto.randomUUID();
                await api.save({ id: newId, mlsApiKey, organization: user.organization }, 'Integrations');
                setIntegrationId(newId);
            }
            setMlsSaveStatus('Saved MLS API Key');
            setTimeout(() => setMlsSaveStatus(''), 3000);
        } catch (e) {
            console.error("Failed to save MLS config", e);
        }
    };

    const handleSaveTwilio = async () => {
        try {
            if (integrationId) {
                await api.save({ 
                    id: integrationId, 
                    twilioAccountSid: twilioSid, 
                    twilioAuthToken: twilioToken,
                    twilioPhoneNumber: twilioPhoneNumber
                }, 'Integrations');
            } else {
                const newId = crypto.randomUUID();
                await api.save({ 
                    id: newId, 
                    twilioAccountSid: twilioSid, 
                    twilioAuthToken: twilioToken,
                    twilioPhoneNumber: twilioPhoneNumber,
                    organization: user.organization
                }, 'Integrations');
                setIntegrationId(newId);
            }
            setTwilioSaveStatus('Saved Twilio Config');
            setTimeout(() => setTwilioSaveStatus(''), 3000);
        } catch (e) {
            console.error("Failed to save Twilio config", e);
        }
    };

    const handleUseDefaultBackgrounds = () => {
        const defaultImages = {
            totalDeals: "https://images.unsplash.com/photo-1639322537228-f710d846310a?auto=format&fit=crop&w=800&q=80", 
            underContract: "https://images.unsplash.com/photo-1639322537504-6427a16b0a28?auto=format&fit=crop&w=800&q=80", 
            potentialRevenue: "https://images.unsplash.com/photo-1639322537231-2f206e06af84?auto=format&fit=crop&w=800&q=80", 
            closedDeals: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80" 
        };
        
        localStorage.setItem('azre_dashboard_bg_images_v1', JSON.stringify(defaultImages));
        setGenerationStatus('Default theme applied! Refreshing...');
        setTimeout(() => window.location.reload(), 1000);
    };

    const handleGenerateBackgrounds = async () => {
        alert("Google API usage is disabled for this feature.");
        return;
    };

    const handleSaveUserProfile = () => {
        if (editedUser.password !== editedUser.confirmPassword) {
            alert("Passwords do not match!");
            return;
        }
        const { confirmPassword, ...userToSaveData } = editedUser;
        onUpdateUser(userToSaveData);
        onClose();
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setEditedUser((prev: any) => ({ ...prev, photo: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-4xl h-[650px] border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden flex" onClick={e => e.stopPropagation()}>
                
                {/* Sidebar */}
                <div className="w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-2 shrink-0">
                    <h3 className="text-xs font-bold text-gray-500 uppercase px-2 mb-2 tracking-wider">Settings</h3>
                    
                    <button onClick={() => setActiveTab('users')} className={`text-sm text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'}`}>
                        <User size={16} /> User Profile
                    </button>
                    
                    <button onClick={() => setActiveTab('deals')} className={`text-sm text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'deals' ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'}`}>
                        <Home size={16} /> Deals & Import
                    </button>
                    
                    <button onClick={() => setActiveTab('buyers')} className={`text-sm text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'buyers' ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'}`}>
                        <Users size={16} /> Buyers
                    </button>
                    
                    <button onClick={() => setActiveTab('agents')} className={`text-sm text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'agents' ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'}`}>
                        <Users size={16} /> Agents
                    </button>

                    <button onClick={() => setActiveTab('integrations')} className={`text-sm text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'integrations' ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'}`}>
                        <Link size={16} /> Integrations
                    </button>

                    <button onClick={() => setActiveTab('email')} className={`text-sm text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'email' ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'}`}>
                        <Mail size={16} /> Email Settings
                    </button>

                    <button onClick={() => setActiveTab('database')} className={`text-sm text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'database' ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'}`}>
                        <Database size={16} /> Database Admin
                    </button>
                    
                    <button onClick={() => setActiveTab('chrome')} className={`text-sm text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'chrome' ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'}`}>
                        <Chrome size={16} /> Chrome Plugin
                    </button>
                    
                    <div className="h-px bg-gray-200 dark:bg-gray-700 my-1"></div>
                    
                    <button onClick={() => setActiveTab('appearance')} className={`text-sm text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'appearance' ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'}`}>
                        <Layout size={16} /> Appearance
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 min-w-0">
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shrink-0">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            {activeTab === 'users' && 'User Profile'}
                            {activeTab === 'deals' && 'Deals & Import'}
                            {activeTab === 'buyers' && 'Buyers Management'}
                            {activeTab === 'agents' && 'Agents Management'}
                            {activeTab === 'integrations' && 'Integrations & APIs'}
                            {activeTab === 'email' && 'Email Settings'}
                            {activeTab === 'database' && 'Database Administration'}
                            {activeTab === 'chrome' && 'Chrome Extension'}
                            {activeTab === 'appearance' && 'App Appearance'}
                        </h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                            <X size={24}/>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        {activeTab === 'users' && (
                            <div className="space-y-8 max-w-2xl">
                                <div className="flex items-center gap-6">
                                    <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 border-4 border-gray-200 dark:border-gray-700 overflow-hidden relative group shrink-0 shadow-inner">
                                        {editedUser.photo ? (
                                            <img src={editedUser.photo} className="w-full h-full object-cover"/>
                                        ) : (
                                            <User size={32} className="text-gray-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"/>
                                        )}
                                        <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                            <Upload size={20} className="text-white"/>
                                            <input type="file" className="hidden" accept="image/*" onChange={handlePhotoChange} />
                                        </label>
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{editedUser.name}</h3>
                                        <p className="text-gray-500 dark:text-gray-400">{editedUser.email}</p>
                                        <p className="text-blue-600 dark:text-blue-400 text-sm font-medium mt-1">{editedUser.position}</p>
                                    </div>
                                </div>

                                <div className="space-y-5">
                                    <div>
                                        <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1.5 block">Full Name</label>
                                        <input className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-3 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none transition-colors" value={editedUser.name || ''} onChange={e => setEditedUser({...editedUser, name: e.target.value})} />
                                    </div>
                                    
                                    <div>
                                        <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1.5 block">Email</label>
                                        <input className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-3 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none transition-colors" value={editedUser.email || ''} onChange={e => setEditedUser({...editedUser, email: e.target.value})} />
                                    </div>
                                    
                                    <div>
                                        <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1.5 block">Company Position</label>
                                        <input className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-3 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none transition-colors" value={editedUser.position || ''} onChange={e => setEditedUser({...editedUser, position: e.target.value})} />
                                    </div>
                                    
                                    <div>
                                        <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1.5 block">Organization</label>
                                        <input className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-3 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none transition-colors" value={editedUser.organization || ''} onChange={e => setEditedUser({...editedUser, organization: e.target.value})} placeholder="e.g. AZRE" />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1.5 block">New Password</label>
                                            <input type="password" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-3 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none transition-colors" placeholder="•••••••••••" value={editedUser.password || ''} onChange={e => setEditedUser({...editedUser, password: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1.5 block">Confirm Password</label>
                                            <input type="password" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-3 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none transition-colors" placeholder="•••••••••••" value={editedUser.confirmPassword || ''} onChange={e => setEditedUser({...editedUser, confirmPassword: e.target.value})} />
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1.5 block">Email Signature</label>
                                        <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700">
                                            <ReactQuill
                                                theme="snow"
                                                value={editedUser.signature || ''}
                                                onChange={newContent => setEditedUser({...editedUser, signature: newContent})}
                                                className="h-[200px] mb-10"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 flex gap-4">
                                    <button onClick={handleSaveUserProfile} className="bg-green-600 hover:bg-green-500 text-white px-6 py-2.5 rounded-lg font-bold shadow-lg transition-all flex items-center gap-2">
                                        <Save size={18}/> Save Changes
                                    </button>
                                    <button onClick={onLogout} className="px-6 py-2.5 border border-red-200 dark:border-red-900/50 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium transition-all flex items-center gap-2">
                                        <LogOut size={18}/> Sign Out
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'deals' && (
                            <div className="space-y-8">
                                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                                    <div className="flex items-start gap-4">
                                        <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg">
                                            <FileSpreadsheet size={24} className="text-blue-500 dark:text-blue-400" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Import Deals</h3>
                                            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                                                Upload a CSV or Excel file to bulk import deals into your pipeline. Our Smart Mapping tool will help you match your columns.
                                            </p>
                                            <button 
                                                onClick={onOpenImportDeals}
                                                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold transition-colors shadow-lg"
                                            >
                                                <Upload size={18} /> Select File
                                            </button>
                                            <p className="text-xs text-gray-500 mt-2">Supported formats: .xlsx, .xls, .csv</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                                    <div className="flex items-start gap-4">
                                        <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-lg">
                                            <Download size={24} className="text-purple-500 dark:text-purple-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Export Pipeline</h3>
                                            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                                                Download your entire deal pipeline as a CSV file for backup or analysis.
                                            </p>
                                            <button className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2">
                                                <Download size={18} /> Export CSV
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'buyers' && (
                            <div className="space-y-6">
                                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white text-lg">Manage Buyers</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">You have {buyersCount} active buyers in your database.</p>
                                    </div>
                                    <button className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2">
                                        <Download size={18} /> Export List
                                    </button>
                                </div>

                                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                                    <div className="flex items-start gap-4">
                                        <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-lg">
                                            <FileSpreadsheet size={24} className="text-purple-600 dark:text-purple-500" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Import Buyers</h3>
                                            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                                                Upload a CSV or Excel file to bulk import buyers. We'll check for duplicates.
                                            </p>
                                            <button 
                                                onClick={onOpenImportBuyers}
                                                className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-bold transition-colors shadow-lg"
                                            >
                                                <Upload size={18} /> Select File
                                            </button>
                                            <p className="text-xs text-gray-500 mt-2">Supported formats: .xlsx, .xls, .csv</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'agents' && (
                            <div className="space-y-6">
                                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white text-lg">Manage Agents</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">You have {agentsCount} agents in your database.</p>
                                    </div>
                                    <div className="flex gap-2">
                                        {onSyncAgentDetails && (
                                            <button 
                                                type="button"
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSyncAgentDetails(); }}
                                                disabled={isSyncingDetails}
                                                className="bg-blue-600 hover:bg-blue-50 disabled:bg-blue-400 text-white border border-blue-500 px-3 py-1 text-xs h-8 rounded-md font-bold transition-colors flex items-center gap-2 shadow-sm"
                                            >
                                                {isSyncingDetails ? <Loader2 size={12} className="animate-spin"/> : <Database size={12} />}
                                                {isSyncingDetails ? 'Updating...' : 'Update Agent Info'}
                                            </button>
                                        )}
                                        {onSyncAgentPhotos && (
                                            <button 
                                                type="button"
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSyncAgentPhotos(); }}
                                                disabled={isSyncingPhotos}
                                                className="bg-white dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500 text-gray-700 dark:text-white border border-gray-300 dark:border-gray-500 px-3 py-1 text-xs h-8 rounded-md font-bold transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                                            >
                                                {isSyncingPhotos ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12} />}
                                                {isSyncingPhotos ? 'Syncing...' : 'Sync Photos'}
                                            </button>
                                        )}
                                        <button className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-3 py-1 text-xs h-8 rounded-md font-bold transition-colors flex items-center gap-2">
                                            <Download size={12} /> Export List
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                                    <div className="flex items-start gap-4">
                                        <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg">
                                            <FileSpreadsheet size={24} className="text-blue-600 dark:text-blue-500" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Import Agents</h3>
                                            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                                                Upload a CSV or Excel file to bulk import agents with Smart Mapping.
                                            </p>
                                            <button 
                                                onClick={onOpenImportAgents}
                                                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold transition-colors shadow-lg"
                                            >
                                                <Upload size={18} /> Select File
                                            </button>
                                            <p className="text-xs text-gray-500 mt-2">Supported formats: .xlsx, .xls, .csv</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'integrations' && (
                            <div className="space-y-6">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">Integrations & APIs</h3>
                                

                                
                                {/* Nationwide MLS Integration */}
                                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-white text-lg">Nationwide MLS API</h4>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">Configure access for the Market Scanner and Market Analyzer.</p>
                                        </div>
                                        {mlsApiKey ? (
                                            <span className="px-2 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-bold rounded flex items-center gap-1"><CheckCircle size={12} /> Connected</span>
                                        ) : (
                                            <span className="px-2 py-1 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 text-xs font-bold rounded">Not Connected</span>
                                        )}
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">API Key</label>
                                            <input 
                                                type="password" 
                                                placeholder="Enter your MLS API Key" 
                                                value={mlsApiKey}
                                                onChange={(e) => setMlsApiKey(e.target.value)}
                                                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-2 text-sm focus:border-blue-500 outline-none" 
                                            />
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <button onClick={handleSaveMls} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 transition">Save MLS Config</button>
                                            {mlsSaveStatus && <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{mlsSaveStatus}</span>}
                                        </div>
                                    </div>
                                </div>

                                {/* Twilio Integration */}
                                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-white text-lg">Twilio SMS</h4>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">Configure Twilio for SMS campaigns and unified inbox.</p>
                                        </div>
                                        {twilioSid && twilioToken ? (
                                             <span className="px-2 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-bold rounded flex items-center gap-1"><CheckCircle size={12} /> Connected</span>
                                        ) : (
                                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded">A2P 10DLC Pending</span>
                                        )}
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Account SID</label>
                                            <input 
                                                type="text" 
                                                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" 
                                                value={twilioSid}
                                                onChange={(e) => setTwilioSid(e.target.value)}
                                                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-2 text-sm focus:border-blue-500 outline-none" 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Auth Token</label>
                                            <input 
                                                type="password" 
                                                placeholder="••••••••••••••••••••••••••••••••" 
                                                value={twilioToken}
                                                onChange={(e) => setTwilioToken(e.target.value)}
                                                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-2 text-sm focus:border-blue-500 outline-none" 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Twilio Phone Number</label>
                                            <input 
                                                type="text" 
                                                placeholder="+1 (555) 123-4567" 
                                                value={twilioPhoneNumber}
                                                onChange={(e) => setTwilioPhoneNumber(e.target.value)}
                                                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-2 text-sm focus:border-blue-500 outline-none" 
                                            />
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <button onClick={handleSaveTwilio} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 transition">Save Twilio Config</button>
                                            {twilioSaveStatus && <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{twilioSaveStatus}</span>}
                                        </div>
                                    </div>
                                </div>

                                {/* Email Provider Selection */}
                                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm">
                                    <h4 className="font-bold text-gray-900 dark:text-white text-lg mb-1">Bulk Email Provider</h4>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Select and configure your provider for mass email campaigns.</p>
                                    
                                    <div className="flex gap-4 mb-6">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="emailProvider" defaultChecked className="text-blue-600 focus:ring-blue-500" />
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Amazon SES (Current)</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="emailProvider" className="text-blue-600 focus:ring-blue-500" />
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">SendGrid</span>
                                        </label>
                                    </div>

                                    {/* SendGrid Config */}
                                    <div className="space-y-4 border-t border-gray-100 dark:border-gray-700 pt-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">SendGrid API Key</label>
                                            <input type="password" placeholder="SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-2 text-sm focus:border-blue-500 outline-none" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Sender Email</label>
                                                <input type="email" placeholder="offers@yourdomain.com" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-2 text-sm focus:border-blue-500 outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Sender Name</label>
                                                <input type="text" placeholder="Your Company Name" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-2 text-sm focus:border-blue-500 outline-none" />
                                            </div>
                                        </div>
                                        <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 transition">Save Email Config</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'email' && <SettingsEmail />}

                        {activeTab === 'database' && <DatabaseAdmin />}

                        {activeTab === 'chrome' && <ChromePluginSettings />}

                        {activeTab === 'appearance' && (
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 pb-2">Theme</h3>
                                    <div className="grid grid-cols-3 gap-4">
                                        <button onClick={() => setTheme('dark')} className={`rounded-lg p-4 flex flex-col items-center gap-2 transition-all ${theme === 'dark' ? 'bg-gray-800 border-2 border-blue-500 text-white shadow-lg' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                                            <Moon size={24} className={theme === 'dark' ? 'text-blue-400' : ''}/> Dark
                                        </button>
                                        <button onClick={() => setTheme('light')} className={`rounded-lg p-4 flex flex-col items-center gap-2 transition-all ${theme === 'light' ? 'bg-white border-2 border-blue-500 text-gray-900 shadow-lg' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                                            <Sun size={24} className={theme === 'light' ? 'text-blue-500' : ''}/> Light
                                        </button>
                                        <button onClick={() => setTheme('system')} className={`rounded-lg p-4 flex flex-col items-center gap-2 transition-all ${theme === 'system' ? 'bg-gray-100 dark:bg-gray-700 border-2 border-blue-500 text-gray-900 dark:text-white shadow-lg' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                                            <Monitor size={24} className={theme === 'system' ? 'text-blue-500' : ''}/> System
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-4 pt-4">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 pb-2">Interface</h3>
                                    <div className="flex items-center justify-between py-2">
                                        <div>
                                            <div className="text-gray-900 dark:text-white font-medium">Compact Sidebar</div>
                                            <div className="text-xs text-gray-500">Reduce sidebar width to save space</div>
                                        </div>
                                        <button onClick={() => setSidebarCollapsed(!isSidebarCollapsed)} className={`w-12 h-6 rounded-full transition-colors relative ${isSidebarCollapsed ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}>
                                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${isSidebarCollapsed ? 'left-7' : 'left-1'}`}></div>
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider pb-2">Dashboard Backgrounds</h3>
                                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                                        <div className="flex items-start gap-4">
                                            <div className="bg-indigo-100 dark:bg-indigo-900/30 p-3 rounded-lg">
                                                <ImageIcon size={24} className="text-indigo-600 dark:text-indigo-400" />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">AI Background Generation</h3>
                                                <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                                                    Generate unique 3D backgrounds for your dashboard cards using AI. 
                                                    Images will be generated, uploaded to your Google Drive, and linked automatically.
                                                </p>
                                                <div className="flex gap-3">
                                                    <button 
                                                        onClick={handleGenerateBackgrounds}
                                                        disabled={isGeneratingBackgrounds}
                                                        className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-bold transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {isGeneratingBackgrounds ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
                                                        {isGeneratingBackgrounds ? 'Generating...' : 'Generate & Save to Drive'}
                                                    </button>
                                                    <button 
                                                        onClick={handleUseDefaultBackgrounds}
                                                        disabled={isGeneratingBackgrounds}
                                                        className="inline-flex items-center gap-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-4 py-2 rounded-lg font-bold transition-colors shadow-sm"
                                                    >
                                                        <ImageIcon size={18} />
                                                        Use Default Theme
                                                    </button>
                                                </div>
                                                {generationStatus && (
                                                    <p className={`text-xs mt-3 font-medium ${generationStatus.includes('Error') || generationStatus.includes('Quota') ? 'text-red-500' : 'text-indigo-500 animate-pulse'}`}>
                                                        {generationStatus}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
