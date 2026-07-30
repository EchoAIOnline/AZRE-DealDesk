const fs = require('fs');
let code = fs.readFileSync('components/Deals/EditDealModal.tsx', 'utf8');

const target1 = `    const [showBuyerMatch, setShowBuyerMatch] = useState(false);`;
const replace1 = `    const [showBuyerMatch, setShowBuyerMatch] = useState(false);
    const [showZillowImport, setShowZillowImport] = useState(false);
    const [zillowUrl, setZillowUrl] = useState("");
    const [zillowLoading, setZillowLoading] = useState(false);
    const [zillowError, setZillowError] = useState("");

    const handleZillowImport = async () => {
        if (!zillowUrl) {
            setZillowError("Please enter a Zillow URL");
            return;
        }
        setZillowLoading(true);
        setZillowError("");
        try {
            const response = await fetch('/api/scrape-zillow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: zillowUrl })
            });
            const result = await response.json();
            
            if (!response.ok) {
                setZillowError(result.message || "Failed to import from Zillow");
                setZillowLoading(false);
                return;
            }

            if (result.data && result.data.length > 0) {
                const zData = result.data[0];
                const updates: Partial<Deal> = {};
                
                // Parse Zillow data into Deal fields (adjust mapping as needed based on BrightData's actual schema)
                if (zData.address) updates.address = zData.address;
                if (zData.price) updates.listPrice = parseInt(zData.price.toString().replace(/[^0-9]/g, ''));
                if (zData.bedrooms) updates.beds = parseInt(zData.bedrooms);
                if (zData.bathrooms) updates.baths = parseInt(zData.bathrooms);
                if (zData.livingArea) updates.sqft = parseInt(zData.livingArea);
                if (zData.yearBuilt) updates.yearBuilt = parseInt(zData.yearBuilt);
                if (zData.description) updates.notes = (deal.notes ? deal.notes + '\\n\\n' : '') + 'Zillow Description: ' + zData.description;
                
                setDeal(prev => ({ ...prev, ...updates }));
                setShowZillowImport(false);
                setZillowUrl("");
            } else {
                setZillowError("No data returned from Zillow scraper.");
            }
        } catch (err: any) {
            setZillowError(err.message || "An error occurred");
        }
        setZillowLoading(false);
    };`;

const target2 = `<h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><Home size={14}/> Property Information</h3>`;
const replace2 = `<h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><Home size={14}/> Property Information</h3>
                            <button
                                type="button"
                                onClick={() => setShowZillowImport(true)}
                                className="text-[11px] font-semibold px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded flex items-center gap-1.5 hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors ml-auto shadow-sm"
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                Import from Zillow
                            </button>`;

const target3 = `{showBuyerMatch && (
                <BuyerMatchModal`;
const replace3 = `{showZillowImport && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[130] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-[#111318] w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden flex flex-col relative" onClick={(e) => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-[#14171D]">
                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3273F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                Import from Zillow via BrightData
                            </h3>
                            <button onClick={() => { setShowZillowImport(false); setZillowError(""); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Zillow Listing URL</label>
                                <input 
                                    type="text" 
                                    value={zillowUrl}
                                    onChange={(e) => setZillowUrl(e.target.value)}
                                    placeholder="https://www.zillow.com/homedetails/..."
                                    className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm text-gray-900 dark:text-white focus:border-[#3273F6] outline-none"
                                />
                            </div>
                            
                            {zillowError && (
                                <div className="p-3 bg-red-50 dark:bg-[#3A141A]/50 border border-red-200 dark:border-[#FF453A]/30 rounded-lg flex items-start gap-2">
                                    <AlertTriangle size={14} className="text-red-600 dark:text-[#FF453A] shrink-0 mt-0.5" />
                                    <p className="text-xs text-red-700 dark:text-[#FF453A] leading-relaxed whitespace-pre-wrap">{zillowError}</p>
                                </div>
                            )}

                            <p className="text-xs text-gray-500 dark:text-gray-500 leading-relaxed">
                                Note: This requires a pre-configured Zillow Data Collector in your BrightData dashboard. The <strong>BRIGHTDATA_COLLECTOR_ID</strong> must be set in your environment variables.
                            </p>
                        </div>
                        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2 bg-gray-50/50 dark:bg-[#111318]/50">
                            <button 
                                onClick={() => { setShowZillowImport(false); setZillowError(""); }}
                                className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleZillowImport}
                                disabled={zillowLoading || !zillowUrl}
                                className="px-4 py-2 text-sm font-semibold text-white bg-[#3273F6] rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
                            >
                                {zillowLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                                {zillowLoading ? 'Importing...' : 'Import Data'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showBuyerMatch && (
                <BuyerMatchModal`;

code = code.replace(target1, replace1).replace(target2, replace2).replace(target3, replace3);
fs.writeFileSync('components/Deals/EditDealModal.tsx', code);
