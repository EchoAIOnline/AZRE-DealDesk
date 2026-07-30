const fs = require('fs');
const content = fs.readFileSync('components/Deals/EditDealModal.tsx', 'utf8');

const target1 = `    const handleZillowImport = async () => {`;
const replacement1 = `    const [compsLoading, setCompsLoading] = useState(false);

    const handlePullComps = async () => {
        if (!deal.address) {
            setZillowError("No address available on deal to pull comps.");
            return;
        }
        setCompsLoading(true);
        setZillowError("");
        try {
            // Construct Zillow search URL from the address
            const formattedAddress = deal.address.replace(/,/g, '').replace(/ /g, '-');
            const searchUrl = \`https://www.zillow.com/homes/\${formattedAddress}_rb/\`;
            
            const response = await fetch('/api/scrape-zillow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: searchUrl })
            });
            const result = await response.json();
            
            if (!response.ok) {
                setZillowError(result.message || "Failed to pull comps");
                setCompsLoading(false);
                return;
            }

            if (result.status === 'success' && result.data && result.data.length > 0) {
                const zData = result.data[0];
                const updates: Partial<Deal> = {};
                
                if (zData.mappedComps && Array.isArray(zData.mappedComps)) {
                    if (zData.mappedComps[0]) updates.renovationComparable1 = zData.mappedComps[0];
                    if (zData.mappedComps[1]) updates.renovationComparable2 = zData.mappedComps[1];
                    if (zData.mappedComps[2]) updates.renovationComparable3 = zData.mappedComps[2];
                    
                    // Also populate new construction comps with the same just in case
                    if (zData.mappedComps[0]) updates.newConstructionComparable1 = zData.mappedComps[0];
                    if (zData.mappedComps[1]) updates.newConstructionComparable2 = zData.mappedComps[1];
                    if (zData.mappedComps[2]) updates.newConstructionComparable3 = zData.mappedComps[2];
                }

                setDeal(prev => ({ ...prev, ...updates }));
            } else {
                setZillowError("No comps data returned from Zillow scraper.");
            }
        } catch (err: any) {
            setZillowError(err.message || "An error occurred");
        } finally {
            setCompsLoading(false);
        }
    };

    const handleZillowImport = async () => {`;

const target2 = `                                    <button
                                        type="button"
                                        onClick={() => setShowZillowImport(true)}
                                        className="text-[10px] font-semibold px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded flex items-center gap-1 hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors shadow-sm"
                                    >
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                        Pull After-Repaired Comps
                                    </button>`;
const replacement2 = `                                    <button
                                        type="button"
                                        onClick={handlePullComps}
                                        disabled={compsLoading}
                                        className="text-[10px] font-semibold px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded flex items-center gap-1 hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors shadow-sm disabled:opacity-50"
                                    >
                                        {compsLoading ? <Loader2 size={10} className="animate-spin" /> : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>}
                                        {compsLoading ? 'Pulling...' : 'Pull After-Repaired Comps'}
                                    </button>`;

if (content.includes(target1) && content.includes(target2)) {
    // Replace all instances of target2
    const replaced = content.replace(target1, replacement1).split(target2).join(replacement2);
    fs.writeFileSync('components/Deals/EditDealModal.tsx', replaced);
    console.log("Patched EditDealModal.tsx successfully");
} else {
    console.log("Target not found");
}
