const fs = require('fs');

let content = fs.readFileSync('./components/Buyers/DealMatchModal.tsx', 'utf8');

const searchStr = '// --- 5. LOCATION LOGIC ---';
const insertStr = `            const dealZip = deal.address.match(/\\d{5}/)?.[0] || "";
            const dealCounty = (deal.county || "").toLowerCase().replace(' county', '').trim();
            const dealCity = (deal.subMarket || "").toLowerCase().trim();
            const dealNeighborhood = (deal.neighborhood || "").toLowerCase().trim();
            
            // --- 5. LOCATION LOGIC ---`;

content = content.replace(searchStr, insertStr);

fs.writeFileSync('./components/Buyers/DealMatchModal.tsx', content);
console.log("Fixed DealMatchModal definitions!");
