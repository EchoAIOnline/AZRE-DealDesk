const fs = require('fs');
const content = fs.readFileSync('components/Deals/EditDealModal.tsx', 'utf8');

const target1 = `    const [compsLoading, setCompsLoading] = useState(false);`;
const replacement1 = `    const [compsLoading, setCompsLoading] = useState(false);
    const [compsError, setCompsError] = useState("");`;

const target2 = `        setZillowError("No address available on deal to pull comps.");`;
const replacement2 = `        setCompsError("No address available on deal to pull comps.");`;

const target3 = `        setZillowError("");`;
const replacement3 = `        setCompsError("");`;

const target4 = `                setZillowError(result.message || "Failed to pull comps");`;
const replacement4 = `                setCompsError(result.message || "Failed to pull comps");`;

const target5 = `                setZillowError("No comps data returned from Zillow scraper.");`;
const replacement5 = `                setCompsError("No comps data returned from Zillow scraper.");`;

const target6 = `            setZillowError(err.message || "An error occurred");`;
const replacement6 = `            setCompsError(err.message || "An error occurred");`;

const target7 = `                                <div className="grid grid-cols-2 gap-4 mb-4">`;
const replacement7 = `                                {compsError && (
                                    <div className="p-3 mb-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs rounded border border-red-200 dark:border-red-800">
                                        {compsError}
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-4 mb-4">`;

if (content.includes(target1) && content.includes(target7)) {
    let replaced = content.replace(target1, replacement1)
                          .replace(target7, replacement7);
    
    // Only replace the ones inside handlePullComps
    const funcStart = replaced.indexOf('const handlePullComps');
    const funcEnd = replaced.indexOf('const handleZillowImport');
    
    let funcBody = replaced.substring(funcStart, funcEnd);
    funcBody = funcBody.replace(/setZillowError/g, 'setCompsError');
    
    replaced = replaced.substring(0, funcStart) + funcBody + replaced.substring(funcEnd);

    fs.writeFileSync('components/Deals/EditDealModal.tsx', replaced);
    console.log("Patched EditDealModal.tsx successfully for compsError");
} else {
    console.log("Target not found");
}
