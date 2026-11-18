import React, { useState, useEffect } from 'react';
import {
  Wrench,
  TrendingUp,
  FileText,
  Calendar,
  Calculator,
  FileCode2,
  X,
} from 'lucide-react';
import { PageNavBar } from '../Shared/PageNavBar';
import { MarketOracle } from '../MarketOracle/MarketOracle';
import { LoiDesigner } from '../LoiDesigner/LoiDesigner';
import { CalendarView } from '../Calendar/CalendarView';
import { DealAnalyzer } from '../DealAnalyzer/DealAnalyzer';
import { HarListBuilder } from './HarListBuilder';
import { Agent, Buyer } from '../../types';

export type AzreToolId =
  | 'market-oracle'
  | 'loi-designer'
  | 'calendar'
  | 'deal-analyzer'
  | 'har-list-builder';

interface AzreToolsViewProps {
  initialTool?: AzreToolId | null;
  agents: Agent[];
  buyers: Buyer[];
  onUpdateAgent: (agentId: string, updates: Partial<Agent>) => void;
  onUpdateBuyer: (id: string | number, updates: Partial<Buyer>) => void;
  onViewAgent: (agent: Agent) => void;
  onViewBuyer: (buyer: Buyer) => void;
  onAddDealFromAnalyzer: (address: string, offerPrice: number) => void;
}

interface ToolDefinition {
  id: AzreToolId;
  name: string;
  subtitle: string;
  icon: React.ReactNode;
  headerIcon: React.ReactNode;
  iconBg: string;
  iconBorder: string;
  iconText: string;
  accentGlow: string;
}

const TOOLS: ToolDefinition[] = [
  {
    id: 'market-oracle',
    name: 'Market Oracle',
    subtitle: 'Market trends & top cities',
    icon: <TrendingUp size={34} strokeWidth={1.9} />,
    headerIcon: <TrendingUp size={18} />,
    iconBg: 'bg-gradient-to-br from-blue-500 to-indigo-600',
    iconBorder: 'border-blue-400/40',
    iconText: 'text-white',
    accentGlow: 'group-hover:shadow-blue-500/30',
  },
  {
    id: 'loi-designer',
    name: 'LOI Designer',
    subtitle: 'Build & customize LOIs',
    icon: <FileText size={34} strokeWidth={1.9} />,
    headerIcon: <FileText size={18} />,
    iconBg: 'bg-gradient-to-br from-violet-500 to-purple-600',
    iconBorder: 'border-violet-400/40',
    iconText: 'text-white',
    accentGlow: 'group-hover:shadow-violet-500/30',
  },
  {
    id: 'calendar',
    name: 'Calendar',
    subtitle: 'Schedules & follow-ups',
    icon: <Calendar size={34} strokeWidth={1.9} />,
    headerIcon: <Calendar size={18} />,
    iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-600',
    iconBorder: 'border-emerald-400/40',
    iconText: 'text-white',
    accentGlow: 'group-hover:shadow-emerald-500/30',
  },
  {
    id: 'deal-analyzer',
    name: 'Deal Analyzer',
    subtitle: 'Underwrite & calculate offers',
    icon: <Calculator size={34} strokeWidth={1.9} />,
    headerIcon: <Calculator size={18} />,
    iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600',
    iconBorder: 'border-amber-400/40',
    iconText: 'text-white',
    accentGlow: 'group-hover:shadow-amber-500/30',
  },
  {
    id: 'har-list-builder',
    name: 'HAR List Builder',
    subtitle: 'Extract .har records to CSV',
    icon: <FileCode2 size={34} strokeWidth={1.9} />,
    headerIcon: <FileCode2 size={18} />,
    iconBg: 'bg-gradient-to-br from-cyan-500 to-sky-600',
    iconBorder: 'border-cyan-400/40',
    iconText: 'text-white',
    accentGlow: 'group-hover:shadow-cyan-500/30',
  },
];

export const AzreToolsView: React.FC<AzreToolsViewProps> = ({
  initialTool = null,
  agents,
  buyers,
  onUpdateAgent,
  onUpdateBuyer,
  onViewAgent,
  onViewBuyer,
  onAddDealFromAnalyzer,
}) => {
  const [activeTool, setActiveTool] = useState<AzreToolId | null>(initialTool);
  const [toolSearch, setToolSearch] = useState('');

  useEffect(() => {
    setActiveTool(initialTool);
  }, [initialTool]);

  useEffect(() => {
    if (!activeTool) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveTool(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool]);

  const activeToolDef = TOOLS.find((t) => t.id === activeTool) ?? null;
  const visibleTools = TOOLS.filter((t) => {
    const q = toolSearch.trim().toLowerCase();
    if (!q) return true;
    return t.name.toLowerCase().includes(q) || t.subtitle.toLowerCase().includes(q);
  });

  return (
    <div className="w-full h-full flex flex-col bg-gray-50 dark:bg-[#0B1220]">
      <PageNavBar
        title="AZRE Tools"
        icon={<Wrench />}
        searchValue={toolSearch}
        onSearchChange={setToolSearch}
        searchPlaceholder="Search tools..."
      />

      {/* Desktop-Style Icon Workspace */}
      <div className="flex-1 overflow-y-auto p-6 sm:p-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 sm:gap-8 max-w-6xl">
          {visibleTools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => setActiveTool(tool.id)}
              title={tool.subtitle}
              className="group flex flex-col items-center gap-3 p-4 rounded-2xl hover:bg-gray-200/60 dark:hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-150 select-none"
            >
              <div
                className={`w-20 h-20 rounded-2xl ${tool.iconBg} ${tool.iconText} border ${tool.iconBorder} shadow-lg ${tool.accentGlow} flex items-center justify-center transform transition-all duration-200 group-hover:-translate-y-1 group-hover:scale-105 group-active:scale-95`}
              >
                {tool.icon}
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {tool.name}
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                  {tool.subtitle}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Tool Popup Modal */}
      {activeTool && activeToolDef && (
        <div
          className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-5"
          onClick={() => setActiveTool(null)}
        >
          <div
            className="w-full max-w-[95vw] h-[92vh] bg-white dark:bg-[#0B1220] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Title Bar */}
            <div className="px-5 py-3 bg-gray-50 dark:bg-[#172235] border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-8 h-8 rounded-lg ${activeToolDef.iconBg} ${activeToolDef.iconText} flex items-center justify-center shrink-0 shadow-sm`}
                >
                  {activeToolDef.headerIcon}
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">
                    {activeToolDef.name}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTool(null)}
                className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/70 dark:hover:bg-gray-700 transition-colors"
                title={`Close ${activeToolDef.name}`}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Tool Content */}
            <div className="flex-1 min-h-0 overflow-auto relative">
              {activeTool === 'market-oracle' && <MarketOracle />}
              {activeTool === 'loi-designer' && <LoiDesigner />}
              {activeTool === 'calendar' && (
                <div className="w-full h-full">
                  <CalendarView
                    agents={agents}
                    buyers={buyers}
                    onUpdateAgent={onUpdateAgent}
                    onUpdateBuyer={onUpdateBuyer}
                    onViewAgent={onViewAgent}
                    onViewBuyer={onViewBuyer}
                  />
                </div>
              )}
              {activeTool === 'deal-analyzer' && (
                <DealAnalyzer onAddDeal={onAddDealFromAnalyzer} />
              )}
              {activeTool === 'har-list-builder' && <HarListBuilder />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
