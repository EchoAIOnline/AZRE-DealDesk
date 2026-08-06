import React, { useRef, useEffect } from 'react';
import { Search, Plus, Filter, X, ChevronDown } from 'lucide-react';

interface Tab {
  id: string;
  label: string;
  count?: number;
  colorClass?: string;
  activeColorClass?: string;
}

interface SortOption {
  value: string;
  label: string;
}

interface FilterOption {
  key: string;
  label: string;
  options: string[];
}

interface PageNavBarProps {
  title: string;
  icon?: React.ReactNode;
  
  // Search
  searchValue: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder?: string;

  // Tabs (Optional)
  tabs?: Tab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;

  // Sort
  sortOptions?: SortOption[];
  sortValue?: string;
  onSortChange?: (val: string) => void;

  // Filter
  onToggleFilter?: () => void;
  isFilterOpen?: boolean;
  isFilterActive?: boolean;
  filterContent?: React.ReactNode; // Content for the filter panel

  // Actions
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export const PageNavBar: React.FC<PageNavBarProps> = ({
  title,
  icon,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  tabs,
  activeTab,
  onTabChange,
  sortOptions,
  sortValue,
  onSortChange,
  onToggleFilter,
  isFilterOpen,
  isFilterActive,
  filterContent,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction
}) => {
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isFilterOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // If the click is outside the panel AND not on the toggle button that opens it
      if (
        filterPanelRef.current && 
        !filterPanelRef.current.contains(target) &&
        filterButtonRef.current && 
        !filterButtonRef.current.contains(target)
      ) {
        onToggleFilter?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterOpen, onToggleFilter]);

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex flex-col sticky top-0 z-30 shadow-sm transition-colors duration-200">
      <div className="p-4 md:px-8 flex flex-col gap-4">
        
        {/* Top Row: Title, Search, Controls */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          
          {/* Left Side: Title & Search */}
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8 flex-1 w-full xl:w-auto">
            <div className="flex items-center gap-2 shrink-0">
              {icon && <div className="text-purple-600 dark:text-purple-400">{icon}</div>}
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                {title}
              </h2>
            </div>

            {/* Search Bar */}
            <div className="relative flex-1 max-w-md w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                    type="text" 
                    placeholder={searchPlaceholder}
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg py-2 pl-9 pr-4 text-sm text-gray-900 dark:text-white focus:border-blue-500 outline-none transition-all placeholder-gray-500 shadow-sm"
                    value={searchValue}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
            </div>
          </div>
          
          {/* Right Side: Controls (Sort, Filter, Action) */}
          <div className="flex flex-row gap-3 w-full xl:w-auto items-center justify-end">
              <div className="flex gap-2 overflow-x-auto w-full sm:w-auto justify-end">
                  {/* Sort Dropdown */}
                  {sortOptions && (
                      <div className="relative shrink-0">
                          <select 
                              className="appearance-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 pl-4 pr-9 py-2 rounded-lg font-medium text-sm shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer h-full"
                              value={sortValue}
                              onChange={(e) => onSortChange && onSortChange(e.target.value)}
                          >
                              {sortOptions.map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                          </select>
                          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"/>
                      </div>
                  )}

                  {/* Filter Toggle */}
                  {onToggleFilter && (
                       <button 
                          ref={filterButtonRef}
                          onClick={onToggleFilter}
                          className={`px-3 py-2 rounded-lg border flex items-center gap-2 text-sm font-medium transition-all shadow-sm shrink-0 ${
                              isFilterOpen || isFilterActive
                              ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-600 dark:text-blue-400' 
                              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                      >
                          <Filter size={16} /> <span className="hidden sm:inline">Filter</span>
                      </button>
                  )}

                  {/* Action Buttons */}
                  {(actionLabel || secondaryActionLabel) && (
                      <div className="flex flex-row items-center gap-2">
                          {actionLabel && onAction && (
                              <button 
                                  onClick={onAction} 
                                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 shadow-md transition-all shrink-0 text-sm whitespace-nowrap"
                              >
                                  <Plus size={16} /> {actionLabel}
                              </button>
                          )}
                          {secondaryActionLabel && onSecondaryAction && (
                              <button 
                                  onClick={onSecondaryAction} 
                                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 shadow-md transition-all shrink-0 text-sm whitespace-nowrap"
                              >
                                  {secondaryActionLabel}
                              </button>
                          )}
                      </div>
                  )}
              </div>
          </div>
        </div>

        {/* Tabs (Navigation options) - Rendered here for desktop, scrollable */}
        {tabs && tabs.length > 0 && (
           <div className="flex overflow-x-auto pb-1 gap-1 md:gap-4 no-scrollbar">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange && onTabChange(tab.id)}
                  className={`whitespace-nowrap pb-2 text-sm font-bold transition-all border-b-2 px-1 ${
                    activeTab === tab.id 
                      ? (tab.activeColorClass || 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400') 
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className={`ml-2 text-xs py-0.5 px-1.5 rounded-full ${
                      activeTab === tab.id 
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
           </div>
        )}
      </div>

      {/* Filter Panel */}
      {isFilterOpen && filterContent && (
          <div ref={filterPanelRef} className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4 animate-in slide-in-from-top-2">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><Filter size={14}/> Active Filters</h3>
                 <button onClick={onToggleFilter} className="text-gray-400 hover:text-gray-900 dark:hover:text-white"><X size={16}/></button>
              </div>
              {filterContent}
          </div>
      )}
    </div>
  );
};