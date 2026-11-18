import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Plus,
  ListChecks,
  FolderPlus,
  Trash2,
  Check,
  Loader2,
  MapPin,
  Home,
  AlertCircle,
  ExternalLink,
  Search,
} from 'lucide-react';
import { OffMarketProperty } from '../../types';

export const normalizeOffMarketLists = (val: unknown): string[] => {
  if (!val) return [];
  if (Array.isArray(val)) {
    return Array.from(
      new Set(
        val
          .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
          .filter(Boolean)
      )
    );
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return normalizeOffMarketLists(parsed);
      }
    } catch {
      // Plain string fallback
    }
    return [trimmed];
  }
  return [];
};

interface OffMarketPropertiesListModalProps {
  properties: OffMarketProperty[];
  customLists: string[];
  onCreateList: (listName: string) => void;
  onDeleteList: (listName: string) => Promise<void>;
  onUpdatePropertyLists: (property: OffMarketProperty, nextLists: string[]) => Promise<void>;
  onSelectProperty: (property: OffMarketProperty) => void;
  targetProperty?: OffMarketProperty | null;
  onClearTargetProperty?: () => void;
  isOccluded?: boolean;
  onClose: () => void;
}

export const OffMarketPropertiesListModal: React.FC<OffMarketPropertiesListModalProps> = ({
  properties,
  customLists,
  onCreateList,
  onDeleteList,
  onUpdatePropertyLists,
  onSelectProperty,
  targetProperty = null,
  onClearTargetProperty,
  isOccluded = false,
  onClose,
}) => {
  const [newListName, setNewListName] = useState('');
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [listSearch, setListSearch] = useState('');
  const [savingListName, setSavingListName] = useState<string | null>(null);
  const [removingPropId, setRemovingPropId] = useState<number | null>(null);
  const [confirmDeleteList, setConfirmDeleteList] = useState<string | null>(null);
  const [deletingListName, setDeletingListName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Combine saved custom lists with any list names present in Supabase rows
  const allLists = useMemo(() => {
    const map = new Map<string, string>();
    customLists.forEach((name) => {
      const trimmed = name.trim();
      if (trimmed && !map.has(trimmed.toLowerCase())) {
        map.set(trimmed.toLowerCase(), trimmed);
      }
    });
    properties.forEach((p) => {
      normalizeOffMarketLists(p['Off Market List']).forEach((name) => {
        if (!map.has(name.toLowerCase())) {
          map.set(name.toLowerCase(), name);
        }
      });
    });
    return Array.from(map.values());
  }, [customLists, properties]);

  // Keep a valid selected list in "View Lists" mode
  useEffect(() => {
    if (!targetProperty) {
      if (allLists.length === 0) {
        setSelectedList(null);
      } else if (!selectedList || !allLists.includes(selectedList)) {
        setSelectedList(allLists[0]);
      }
    }
  }, [allLists, selectedList, targetProperty]);

  useEffect(() => {
    if (isOccluded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isOccluded]);

  const listCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allLists.forEach((l) => {
      counts[l] = 0;
    });
    properties.forEach((p) => {
      const pLists = normalizeOffMarketLists(p['Off Market List']);
      pLists.forEach((l) => {
        counts[l] = (counts[l] || 0) + 1;
      });
    });
    return counts;
  }, [allLists, properties]);

  const activeTargetProperty = useMemo(() => {
    if (!targetProperty) return null;
    return properties.find((p) => p.id === targetProperty.id) || targetProperty;
  }, [targetProperty, properties]);

  const targetPropertyLists = useMemo(
    () => (activeTargetProperty ? normalizeOffMarketLists(activeTargetProperty['Off Market List']) : []),
    [activeTargetProperty]
  );

  const selectedListProperties = useMemo(() => {
    if (!selectedList) return [];
    const q = listSearch.trim().toLowerCase();
    return properties.filter((p) => {
      const pLists = normalizeOffMarketLists(p['Off Market List']);
      if (!pLists.includes(selectedList)) return false;
      if (!q) return true;
      const haystack = [
        p['Address'],
        p['City'],
        p['State'],
        p['Zip'],
        p['Owner 1 First Name'],
        p['Owner 1 Last Name'],
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [properties, selectedList, listSearch]);

  const handleCreateListSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newListName.trim();
    if (!trimmed) return;
    setErrorMsg(null);

    const existingMatch = allLists.find((l) => l.toLowerCase() === trimmed.toLowerCase());
    const finalName = existingMatch || trimmed;

    if (!existingMatch) {
      onCreateList(finalName);
    }

    setNewListName('');

    if (activeTargetProperty) {
      if (!targetPropertyLists.includes(finalName)) {
        setSavingListName(finalName);
        try {
          await onUpdatePropertyLists(activeTargetProperty, [...targetPropertyLists, finalName]);
        } catch (err: any) {
          setErrorMsg(err?.message || 'Failed to add property to list.');
        } finally {
          setSavingListName(null);
        }
      }
    } else {
      setSelectedList(finalName);
    }
  };

  const handleToggleTargetList = async (listName: string) => {
    if (!activeTargetProperty) return;
    setErrorMsg(null);
    setSavingListName(listName);
    try {
      const exists = targetPropertyLists.includes(listName);
      const nextLists = exists
        ? targetPropertyLists.filter((l) => l !== listName)
        : [...targetPropertyLists, listName];
      await onUpdatePropertyLists(activeTargetProperty, nextLists);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update property list.');
    } finally {
      setSavingListName(null);
    }
  };

  const handleRemovePropertyFromSelectedList = async (prop: OffMarketProperty) => {
    if (!selectedList) return;
    setErrorMsg(null);
    setRemovingPropId(prop.id);
    try {
      const current = normalizeOffMarketLists(prop['Off Market List']);
      const nextLists = current.filter((l) => l !== selectedList);
      await onUpdatePropertyLists(prop, nextLists);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to remove property from list.');
    } finally {
      setRemovingPropId(null);
    }
  };

  const handleConfirmDeleteList = async (listName: string) => {
    setErrorMsg(null);
    setDeletingListName(listName);
    try {
      await onDeleteList(listName);
      setConfirmDeleteList(null);
      if (selectedList === listName) {
        setSelectedList(null);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to delete list.');
    } finally {
      setDeletingListName(null);
    }
  };

  // Focused "Add To List" mode for a specific property
  if (activeTargetProperty) {
    const cityStateZip = [
      activeTargetProperty['City'],
      activeTargetProperty['State'],
      activeTargetProperty['Zip'],
    ]
      .filter((v) => v !== null && v !== undefined && v !== '')
      .join(', ');

    return (
      <div
        className="fixed inset-0 z-[160] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
        onClick={onClose}
      >
        <div
          className="bg-white dark:bg-[#0B1220] border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-md h-[72vh] max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 bg-gray-50 dark:bg-[#172235] border-b border-gray-200 dark:border-gray-700 flex items-start justify-between gap-3 shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <ListChecks size={17} className="text-blue-500 shrink-0" />
                <h2 className="text-base font-bold text-gray-900 dark:text-white truncate">
                  Add To List
                </h2>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                {activeTargetProperty['Address'] || `Property #${activeTargetProperty.id}`}
                {cityStateZip ? ` • ${cityStateZip}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/70 dark:hover:bg-gray-700 transition-colors"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 flex-1 overflow-y-auto space-y-4">
            {errorMsg && (
              <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Create new list inline */}
            <form onSubmit={handleCreateListSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Create new custom list..."
                className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 outline-none"
              />
              <button
                type="submit"
                disabled={!newListName.trim() || savingListName !== null}
                className="px-3 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 disabled:opacity-50 transition-colors shrink-0"
              >
                <Plus size={14} />
                <span>Create &amp; Add</span>
              </button>
            </form>

            {/* Checklist of existing lists */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Select Lists ({allLists.length})
              </div>

              {allLists.length === 0 ? (
                <div className="text-center py-8 px-4 rounded-xl bg-gray-50 dark:bg-[#172235]/50 border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                  <FolderPlus size={24} className="mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-medium">No custom lists yet.</p>
                  <p className="text-[11px] mt-0.5 opacity-80">
                    Create your first list above to organize off-market properties.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {allLists.map((listName) => {
                    const isChecked = targetPropertyLists.includes(listName);
                    const isSavingThis = savingListName === listName;

                    return (
                      <button
                        key={listName}
                        type="button"
                        disabled={savingListName !== null}
                        onClick={() => handleToggleTargetList(listName)}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors disabled:opacity-60 ${
                          isChecked
                            ? 'bg-blue-50 dark:bg-blue-900/25 border-blue-300 dark:border-blue-700/80 text-blue-900 dark:text-blue-100'
                            : 'bg-gray-50 dark:bg-[#172235]/60 border-gray-200 dark:border-gray-700/70 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors ${
                              isChecked
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600'
                            }`}
                          >
                            {isSavingThis ? (
                              <Loader2 size={10} className="animate-spin" />
                            ) : isChecked ? (
                              <Check size={11} strokeWidth={3} />
                            ) : null}
                          </span>
                          <span className="text-xs font-semibold truncate">{listName}</span>
                        </div>
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-gray-200/80 dark:bg-gray-800 text-gray-600 dark:text-gray-400 shrink-0">
                          {listCounts[listName] || 0}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 bg-gray-50 dark:bg-[#172235] border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2 shrink-0">
            {onClearTargetProperty ? (
              <button
                type="button"
                onClick={onClearTargetProperty}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Manage All Lists
              </button>
            ) : (
              <div />
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Full "View Lists" Manager Mode
  return (
    <div
      className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#0B1220] border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-4xl h-[88vh] max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gray-50 dark:bg-[#172235] border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <ListChecks size={18} className="text-blue-500 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-gray-900 dark:text-white truncate">
                Off-Market Property Lists
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Create custom lists and manage properties grouped in each list
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/70 dark:hover:bg-gray-700 transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-5 mt-4 flex items-center gap-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 shrink-0">
            <AlertCircle size={14} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Two-pane Body */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Left Sidebar: Create & Select Lists */}
          <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0 bg-gray-50/60 dark:bg-[#0f192b]">
            <form
              onSubmit={handleCreateListSubmit}
              className="p-3.5 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2"
            >
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="New list name..."
                className="flex-1 min-w-0 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 outline-none"
              />
              <button
                type="submit"
                disabled={!newListName.trim()}
                className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1 disabled:opacity-50 transition-colors shrink-0"
                title="Create List"
              >
                <Plus size={14} />
                <span>Add</span>
              </button>
            </form>

            <div className="flex-1 overflow-y-auto p-2.5 space-y-1 max-h-48 md:max-h-none">
              {allLists.length === 0 ? (
                <div className="text-center py-8 px-3 text-gray-500 dark:text-gray-400">
                  <FolderPlus size={22} className="mx-auto mb-1.5 opacity-40" />
                  <p className="text-xs font-medium">No lists created yet</p>
                  <p className="text-[11px] mt-0.5 opacity-75">
                    Enter a name above to create a custom list.
                  </p>
                </div>
              ) : (
                allLists.map((listName) => {
                  const isActive = selectedList === listName;
                  const count = listCounts[listName] || 0;
                  const isConfirmingDelete = confirmDeleteList === listName;

                  return (
                    <div key={listName} className="space-y-1">
                      <div
                        onClick={() => setSelectedList(listName)}
                        className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-200/70 dark:hover:bg-gray-800/80'
                        }`}
                      >
                        <span className="text-xs font-semibold truncate">{listName}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[11px] font-mono px-1.5 py-0.5 rounded-full ${
                              isActive
                                ? 'bg-blue-500/80 text-white'
                                : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                            }`}
                          >
                            {count}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteList(isConfirmingDelete ? null : listName);
                            }}
                            className={`p-1 rounded transition-colors ${
                              isActive
                                ? 'text-blue-100 hover:text-white hover:bg-blue-500'
                                : 'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-70 group-hover:opacity-100'
                            }`}
                            title="Delete List"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {isConfirmingDelete && (
                        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/25 border border-red-200 dark:border-red-800/70">
                          <span className="text-[11px] font-semibold text-red-700 dark:text-red-300">
                            Delete list?
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={deletingListName === listName}
                              onClick={() => handleConfirmDeleteList(listName)}
                              className="px-2 py-0.5 text-[11px] font-bold rounded bg-red-600 hover:bg-red-500 text-white flex items-center gap-1 disabled:opacity-60"
                            >
                              {deletingListName === listName && (
                                <Loader2 size={10} className="animate-spin" />
                              )}
                              <span>Delete</span>
                            </button>
                            <button
                              type="button"
                              disabled={deletingListName === listName}
                              onClick={() => setConfirmDeleteList(null)}
                              className="px-1.5 py-0.5 text-[11px] text-gray-600 dark:text-gray-300 hover:bg-gray-200/70 dark:hover:bg-gray-700 rounded"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Pane: Properties in Selected List */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white dark:bg-[#0B1220]">
            {selectedList ? (
              <>
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                      {selectedList}
                    </h3>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shrink-0">
                      {listCounts[selectedList] || 0}{' '}
                      {(listCounts[selectedList] || 0) === 1 ? 'property' : 'properties'}
                    </span>
                  </div>
                  <div className="relative w-full sm:w-56">
                    <Search
                      size={13}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    />
                    <input
                      type="text"
                      value={listSearch}
                      onChange={(e) => setListSearch(e.target.value)}
                      placeholder="Filter list..."
                      className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg py-1 pl-7 pr-7 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 outline-none"
                    />
                    {listSearch && (
                      <button
                        type="button"
                        onClick={() => setListSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {selectedListProperties.length === 0 ? (
                    <div className="text-center py-14 px-4 text-gray-500 dark:text-gray-400">
                      <Home size={28} className="mx-auto mb-2 opacity-35" />
                      <p className="text-xs font-medium">
                        {listSearch
                          ? 'No properties in this list match your search.'
                          : 'No properties added to this list yet.'}
                      </p>
                      {!listSearch && (
                        <p className="text-[11px] mt-1 opacity-75">
                          Use the Add To List button on any property card or property modal to add properties here.
                        </p>
                      )}
                    </div>
                  ) : (
                    selectedListProperties.map((prop) => {
                      const cityStateZip = [prop['City'], prop['State'], prop['Zip']]
                        .filter((v) => v !== null && v !== undefined && v !== '')
                        .join(', ');
                      const ownerName = [prop['Owner 1 First Name'], prop['Owner 1 Last Name']]
                        .filter(Boolean)
                        .join(' ');

                      return (
                        <div
                          key={prop.id}
                          onClick={() => onSelectProperty(prop)}
                          className="cursor-pointer rounded-xl bg-gray-50 dark:bg-[#172235]/70 hover:bg-gray-100 dark:hover:bg-[#172235] border border-gray-200 dark:border-gray-700/70 p-3 flex items-center justify-between gap-3 transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <MapPin size={13} className="text-blue-500 shrink-0" />
                              <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                {prop['Address'] || `Property #${prop.id}`}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5 pl-4">
                              {cityStateZip || 'Location not set'}
                              {ownerName ? ` • ${ownerName}` : ''}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectProperty(prop);
                              }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                              title="Open Property Details"
                            >
                              <ExternalLink size={14} />
                            </button>
                            <button
                              type="button"
                              disabled={removingPropId === prop.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemovePropertyFromSelectedList(prop);
                              }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                              title={`Remove from "${selectedList}"`}
                            >
                              {removingPropId === prop.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <X size={14} />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500 dark:text-gray-400">
                <ListChecks size={32} className="mb-2 opacity-35" />
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Create or Select a List
                </p>
                <p className="text-xs mt-1 max-w-xs">
                  Create a customized list on the left to start organizing your off-market properties.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-gray-50 dark:bg-[#172235] border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2 shrink-0">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {allLists.length} {allLists.length === 1 ? 'custom list' : 'custom lists'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
