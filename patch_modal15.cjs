const fs = require('fs');
let content = fs.readFileSync('components/Deals/EditDealModal.tsx', 'utf8');

const targetFunc1 = `                setDeal(prev => ({ ...prev, ...updates }));
            } else {
                setCompsError("No comps data returned from Zillow scraper.");`;

const replacement1 = `                setDeal(prev => ({ ...prev, ...updates }));
                setHasUnsavedChanges(true);
            } else {
                setCompsError("No comps data returned from Zillow scraper.");`;

const targetFunc2 = `                setDeal(prev => ({ ...prev, ...updates }));
                setShowZillowImport(false);`;

const replacement2 = `                setDeal(prev => ({ ...prev, ...updates }));
                setHasUnsavedChanges(true);
                setShowZillowImport(false);`;


content = content.replace(targetFunc1, replacement1);
content = content.replace(targetFunc2, replacement2);
fs.writeFileSync('components/Deals/EditDealModal.tsx', content);
