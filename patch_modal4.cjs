const fs = require('fs');
const content = fs.readFileSync('components/Deals/EditDealModal.tsx', 'utf8');

const target = `                                <label className="text-xs text-gray-500 block mb-1 font-bold uppercase tracking-wider">New Construction Comps</label>`;

const replacement = `                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs text-gray-500 font-bold uppercase tracking-wider">New Construction Comps</label>
                                    <button
                                        type="button"
                                        onClick={() => setShowZillowImport(true)}
                                        className="text-[10px] font-semibold px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded flex items-center gap-1 hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors shadow-sm"
                                    >
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                        Pull After-Repaired Comps
                                    </button>
                                </div>`;

if (content.includes(target)) {
    fs.writeFileSync('components/Deals/EditDealModal.tsx', content.replace(target, replacement));
    console.log("Patched New Construction Comps successfully");
} else {
    console.log("Target not found");
}
