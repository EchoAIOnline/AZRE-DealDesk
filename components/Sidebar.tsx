
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout, Calendar, Users, Calculator, Mail, Menu, User as UserIcon, Settings, Briefcase, BookUser, Search, MessageSquare, FileText, TrendingUp, Megaphone } from 'lucide-react';
import { User as UserType } from '../types';

interface SidebarProps {
    isSidebarCollapsed: boolean;
    setSidebarCollapsed: (collapsed: boolean) => void;
    isMobileMenuOpen: boolean;
    setIsMobileMenuOpen: (open: boolean) => void;
    currentUser: UserType | null;
    onlineUsersCount: number;
    setShowOnlineUsersModal: (show: boolean) => void;
    setShowSettings: (show: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    isSidebarCollapsed,
    setSidebarCollapsed,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    currentUser,
    onlineUsersCount,
    setShowOnlineUsersModal,
    setShowSettings
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    
    // Utility to get consistent button styling
    const getBtnStyle = (path: string) => {
        // Handle root path mapping to dashboard
        const isActive = location.pathname === path || (path === '/dashboard' && location.pathname === '/');
        return `w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
            isActive 
            ? 'bg-blue-600/10 text-blue-500 font-bold border border-blue-500/20' 
            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white border border-transparent'
        } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`;
    };

    const handleNavigate = (path: string) => {
        navigate(path);
        setIsMobileMenuOpen(false);
    };

    const getSectionHeaderStyle = () => {
        return `px-4 py-2 mt-4 text-xs font-bold tracking-wider text-gray-400 dark:text-gray-500 uppercase ${isSidebarCollapsed ? 'text-center hidden' : 'block'}`;
    };

    return (
        <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col shadow-2xl z-50 transition-all duration-300 fixed inset-y-0 left-0 md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <button 
                onClick={() => setSidebarCollapsed(!isSidebarCollapsed)} 
                className={`absolute top-4 ${isSidebarCollapsed ? 'left-1/2 -translate-x-1/2' : 'right-4'} text-gray-400 hover:text-gray-900 dark:hover:text-white p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all z-30 hidden md:block`}
            >
                <Menu size={20} />
            </button>

            <div className={`border-b border-gray-200 dark:border-gray-700 flex flex-col items-center transition-all ${isSidebarCollapsed ? 'px-2 pt-16 pb-4' : 'p-6 pt-12'}`}>
                <div 
                    className={`${isSidebarCollapsed ? 'w-10 h-10' : 'w-20 h-20'} rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 p-1 mb-3 transition-all duration-300 cursor-pointer hover:scale-105`} 
                    onClick={() => setShowSettings(true)}
                >
                    <div className="w-full h-full rounded-full bg-white dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                        {currentUser && currentUser.photo ? (
                            <img src={currentUser.photo} alt="Profile" className="w-full h-full object-cover"/>
                        ) : (
                            <UserIcon size={isSidebarCollapsed ? 20 : 40} className="text-gray-400" />
                        )}
                    </div>
                </div>
                {!isSidebarCollapsed && (
                    <div className="text-center animate-in fade-in duration-300">
                        <h2 className="font-bold text-lg text-gray-900 dark:text-white whitespace-nowrap">{currentUser ? currentUser.name : 'User'}</h2>
                        <p className="text-xs text-blue-500 dark:text-blue-400 whitespace-nowrap mb-1">{currentUser ? currentUser.position : 'Position'}</p>
                        <button 
                            onClick={() => setShowOnlineUsersModal(true)} 
                            className="inline-flex items-center gap-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full text-[10px] font-bold border border-green-200 dark:border-green-800 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                            {onlineUsersCount} Online
                        </button>
                    </div>
                )}
            </div>

            <nav className="flex-1 p-2 space-y-1 overflow-y-auto overflow-x-hidden">
                <button 
                    onClick={() => handleNavigate('/dashboard')} 
                    className={getBtnStyle('/dashboard')}
                >
                    <Layout size={18} />
                    {!isSidebarCollapsed && <span className="text-sm whitespace-nowrap">Dashboard</span>}
                </button>

                <button 
                    onClick={() => handleNavigate('/pipeline')} 
                    className={getBtnStyle('/pipeline')}
                >
                    <Layout size={18} />
                    {!isSidebarCollapsed && <span className="text-sm whitespace-nowrap">Main Pipeline</span>}
                </button>

                <button 
                    onClick={() => handleNavigate('/jv-pipeline')} 
                    className={getBtnStyle('/jv-pipeline')}
                >
                    <Layout size={18} />
                    {!isSidebarCollapsed && <span className="text-sm whitespace-nowrap">JV Pipeline</span>}
                </button>

                <div className={getSectionHeaderStyle()}>Acquisitions</div>

                <button 
                    onClick={() => handleNavigate('/market-scanner')} 
                    className={getBtnStyle('/market-scanner')}
                >
                    <Search size={18} />
                    {!isSidebarCollapsed && <span className="text-sm whitespace-nowrap">Market Scanner</span>}
                </button>

                <button 
                    onClick={() => handleNavigate('/campaigns')} 
                    className={getBtnStyle('/campaigns')}
                >
                    <Megaphone size={18} />
                    {!isSidebarCollapsed && <span className="text-sm whitespace-nowrap">LOI Blast Campaigns</span>}
                </button>

                <div className={getSectionHeaderStyle()}>Dispositions</div>

                <button 
                    onClick={() => handleNavigate('/email')}
                    className={getBtnStyle('/email')}
                >
                    <Mail size={18} />
                    {!isSidebarCollapsed && <span className="text-sm whitespace-nowrap tracking-tight">Buyer Blast Campaigns</span>}
                </button>

                <div className={getSectionHeaderStyle()}>Communications</div>

                <button 
                    onClick={() => handleNavigate('/message-sender')} 
                    className={getBtnStyle('/message-sender')}
                >
                    <MessageSquare size={18} />
                    {!isSidebarCollapsed && <span className="text-sm whitespace-nowrap">Communication Center</span>}
                </button>

                <button 
                    onClick={() => handleNavigate('/acquisitions-inbox')} 
                    className={getBtnStyle('/acquisitions-inbox')}
                >
                    <MessageSquare size={18} />
                    {!isSidebarCollapsed && <span className="text-sm whitespace-nowrap">Acquisitions Inbox</span>}
                </button>

                <button 
                    onClick={() => handleNavigate('/dispositions-inbox')} 
                    className={getBtnStyle('/dispositions-inbox')}
                >
                    <MessageSquare size={18} />
                    {!isSidebarCollapsed && <span className="text-sm whitespace-nowrap">Dispositions Inbox</span>}
                </button>

                <div className={getSectionHeaderStyle()}>Contacts</div>

                <button 
                    onClick={() => handleNavigate('/agents')} 
                    className={getBtnStyle('/agents')}
                >
                    <Users size={18} />
                    {!isSidebarCollapsed && <span className="text-sm whitespace-nowrap">Agent Database</span>}
                </button>

                <button 
                    onClick={() => handleNavigate('/buyers')} 
                    className={getBtnStyle('/buyers')}
                >
                    <Users size={18} />
                    {!isSidebarCollapsed && <span className="text-sm whitespace-nowrap">Buyer Database</span>}
                </button>

                <button 
                    onClick={() => handleNavigate('/wholesalers')} 
                    className={getBtnStyle('/wholesalers')}
                >
                    <Briefcase size={18} />
                    {!isSidebarCollapsed && <span className="text-sm whitespace-nowrap">Wholesaler Database</span>}
                </button>

                <button 
                    onClick={() => handleNavigate('/contacts')} 
                    className={getBtnStyle('/contacts')}
                >
                    <BookUser size={18} />
                    {!isSidebarCollapsed && <span className="text-sm whitespace-nowrap">Contacts Manager</span>}
                </button>

                <div className={getSectionHeaderStyle()}>Tools</div>

                <button 
                    onClick={() => handleNavigate('/market-analyzer')} 
                    className={getBtnStyle('/market-analyzer')}
                >
                    <TrendingUp size={18} />
                    {!isSidebarCollapsed && <span className="text-sm whitespace-nowrap">Market Oracle</span>}
                </button>

                <button 
                    onClick={() => handleNavigate('/offer-builder')} 
                    className={getBtnStyle('/offer-builder')}
                >
                    <FileText size={18} />
                    {!isSidebarCollapsed && <span className="text-sm whitespace-nowrap">LOI Designer</span>}
                </button>

                <button 
                    onClick={() => handleNavigate('/calendar')} 
                    className={getBtnStyle('/calendar')}
                >
                    <Calendar size={18} />
                    {!isSidebarCollapsed && <span className="text-sm whitespace-nowrap">Calendar</span>}
                </button>

                <button 
                    onClick={() => handleNavigate('/calculator')} 
                    className={getBtnStyle('/calculator')}
                >
                    <Calculator size={18} />
                    {!isSidebarCollapsed && <span className="text-sm whitespace-nowrap">Deal Analyzer</span>}
                </button>
            </nav>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <button 
                    onClick={() => { setShowSettings(true); setIsMobileMenuOpen(false); }} 
                    className={`w-full flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded transition ${isSidebarCollapsed ? 'justify-center' : ''}`} 
                    title="Settings"
                >
                    <Settings size={16} />
                    {!isSidebarCollapsed && <span>Settings</span>}
                </button>
            </div>
        </aside>
    );
};
