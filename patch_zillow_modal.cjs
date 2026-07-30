const fs = require('fs');
let code = fs.readFileSync('components/Deals/EditDealModal.tsx', 'utf8');

const zillowModalJSX = `
          {showZillowImport && (
            <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Import from Zillow
                        </h3>
                        <button onClick={() => { setShowZillowImport(false); setZillowError(""); }} className="text-gray-400 hover:text-gray-900 dark:hover:text-white">
                            <X size={20} />
                        </button>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Paste a Zillow URL to automatically import property details and photos.
                    </p>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">Zillow Property URL</label>
                            <input 
                                type="url" 
                                value={zillowUrl}
                                onChange={(e) => setZillowUrl(e.target.value)}
                                placeholder="https://www.zillow.com/homedetails/..."
                                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        {zillowError && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-800">
                                {zillowError}
                            </div>
                        )}
                        <div className="flex justify-end gap-2 pt-2">
                            <button 
                                type="button"
                                onClick={() => { setShowZillowImport(false); setZillowError(""); }}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                type="button"
                                onClick={handleZillowImport}
                                disabled={zillowLoading || !zillowUrl}
                                className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2"
                            >
                                {zillowLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                {zillowLoading ? 'Importing...' : 'Import Data'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
          )}
`;

code = code.replace(
    /\{\s*showEmailModal\s*&&\s*\(/,
    zillowModalJSX + "\n          {showEmailModal && ("
);

fs.writeFileSync('components/Deals/EditDealModal.tsx', code);
