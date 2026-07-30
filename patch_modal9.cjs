const fs = require('fs');
let content = fs.readFileSync('components/Deals/EditDealModal.tsx', 'utf8');

const targetFunc = `    const handlePullComps = async () => {`;
const newFuncs = `    const handlePullComps = async (targetType: 'renovation' | 'newConstruction' = 'renovation') => {
        if (!deal.address) {
            setCompsError("No address available on deal to pull comps.");
            return;
        }
        setCompsLoading(true);
        setCompsError("");
        try {
            // Construct Zillow search URL from the address
            const formattedAddress = deal.address.replace(/,/g, '').replace(/ /g, '-');
            const searchUrl = \\\`https://www.zillow.com/homes/\\\${formattedAddress}_rb/\\\`;
            
            const response = await fetch('/api/scrape-zillow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: searchUrl })
            });
            const result = await response.json();
            
            if (!response.ok) {
                setCompsError(result.message || "Failed to pull comps");
                setCompsLoading(false);
                return;
            }

            if (result.status === 'success' && result.data && result.data.length > 0) {
                const zData = result.data[0];
                const updates: Partial<Deal> = {};
                
                if (zData.mappedComps && Array.isArray(zData.mappedComps)) {
                    // Filter comps by square footage (+/- 300 sqft of subject property)
                    let validComps = zData.mappedComps;
                    if (deal.sqft) {
                        const targetSqft = Number(deal.sqft);
                        validComps = validComps.filter((c: any) => {
                            const compSqft = Number(c.sqft);
                            if (!compSqft) return false;
                            return Math.abs(compSqft - targetSqft) <= 300;
                        });
                    }

                    if (targetType === 'renovation') {
                        if (validComps[0]) updates.renovationComparable1 = validComps[0];
                        if (validComps[1]) updates.renovationComparable2 = validComps[1];
                        if (validComps[2]) updates.renovationComparable3 = validComps[2];
                    } else if (targetType === 'newConstruction') {
                        if (validComps[0]) updates.newConstructionComparable1 = validComps[0];
                        if (validComps[1]) updates.newConstructionComparable2 = validComps[1];
                        if (validComps[2]) updates.newConstructionComparable3 = validComps[2];
                    }
                }

                setDeal(prev => ({ ...prev, ...updates }));
            } else {
                setCompsError("No comps data returned from Zillow scraper.");
            }
        } catch (err: any) {
            setCompsError(err.message || "An error occurred");
        } finally {
            setCompsLoading(false);
        }
    };

    const handlePullRenovationComps = () => handlePullComps('renovation');
    const handlePullNewConstructionComps = () => handlePullComps('newConstruction');
`;

// Replace the function body
const funcStart = content.indexOf('    const handlePullComps = async () => {');
const funcEnd = content.indexOf('    const handleZillowImport = async () => {');
if (funcStart !== -1 && funcEnd !== -1) {
    content = content.substring(0, funcStart) + newFuncs.replace(/\\\\\\`/g, '\`').replace(/\\\\\$/g, '$') + '\n' + content.substring(funcEnd);
}

// Replace buttons
const renoButtonStr = `onClick={handlePullComps}`;
const renoButtonRepl = `onClick={handlePullRenovationComps}`;
// We can just use replace since the first one is the Renovation Comps button
content = content.replace(renoButtonStr, renoButtonRepl);

// And the second one is the New Construction Comps button
const newConstButtonStr = `onClick={handlePullComps}`;
const newConstButtonRepl = `onClick={handlePullNewConstructionComps}`;
content = content.replace(newConstButtonStr, newConstButtonRepl);

// Also change the text of the New Construction button
const newConstTextStr = `<label className="text-xs text-gray-500 font-bold uppercase tracking-wider">New Construction Comps</label>
                                    <button
                                        type="button"
                                        onClick={handlePullNewConstructionComps}
                                        disabled={compsLoading}
                                        className="text-[10px] font-semibold px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded flex items-center gap-1 hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors shadow-sm disabled:opacity-50"
                                    >
                                        {compsLoading ? <Loader2 size={10} className="animate-spin" /> : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>}
                                        {compsLoading ? 'Pulling...' : 'Pull After-Repaired Comps'}`;
const newConstTextRepl = `<label className="text-xs text-gray-500 font-bold uppercase tracking-wider">New Construction Comps</label>
                                    <button
                                        type="button"
                                        onClick={handlePullNewConstructionComps}
                                        disabled={compsLoading}
                                        className="text-[10px] font-semibold px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded flex items-center gap-1 hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors shadow-sm disabled:opacity-50"
                                    >
                                        {compsLoading ? <Loader2 size={10} className="animate-spin" /> : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>}
                                        {compsLoading ? 'Pulling...' : 'Pull New Construction Comps'}`;
                                        
content = content.replace(newConstTextStr, newConstTextRepl);

fs.writeFileSync('components/Deals/EditDealModal.tsx', content);
console.log("Patched EditDealModal.tsx successfully (de-coupled buttons)");
