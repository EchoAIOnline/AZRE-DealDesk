const fs = require('fs');

const locationLogic = `            // --- 4. LOCATION LOGIC ---
            if (hasLocations) {
                let locationMatched = false;
                
                if (zips.length > 0 && dealZip && zips.includes(dealZip)) {
                    locationMatched = true;
                    reasons.push(\`Zip Match (\${dealZip})\`);
                }
                
                if (!locationMatched && counties.length > 0 && counties.some(c => dealCounty.includes(c))) {
                    locationMatched = true;
                    reasons.push("Location Match");
                }
                
                if (!locationMatched && cities.length > 0 && cities.includes(dealCity)) {
                    locationMatched = true;
                    reasons.push("Location Match");
                }
                
                if (!locationMatched && neighborhoods.length > 0) {
                    const isNbMatch = neighborhoods.some(n => {
                        const lowerN = n.toLowerCase().trim();
                        if (!lowerN) return false;
                        return (
                            (dealNeighborhood && (dealNeighborhood.includes(lowerN) || lowerN.includes(dealNeighborhood))) ||
                            (dealCity && (dealCity.includes(lowerN) || lowerN.includes(dealCity))) ||
                            (dealCounty && (dealCounty.includes(lowerN) || lowerN.includes(dealCounty))) ||
                            (dealZip && dealZip === lowerN)
                        );
                    });
                    if (isNbMatch) {
                        locationMatched = true;
                        reasons.push("Location Match");
                    }
                }

                if (!locationMatched) {
                    return { buyer, matchScore: 0, reasons: [] as string[] };
                }
            }`;

let content = fs.readFileSync('./components/Deals/BuyerMatchModal.tsx', 'utf8');
const startIdx = content.indexOf('// --- 4. LOCATION (Hierarchical Logic) ---');
const endIdx = content.indexOf('// Restore Score');

if (startIdx !== -1 && endIdx !== -1) {
    const blockToRemove = content.substring(startIdx, endIdx);
    content = content.replace(blockToRemove, locationLogic + '\n\n            ');
    fs.writeFileSync('./components/Deals/BuyerMatchModal.tsx', content);
    console.log("Successfully patched BuyerMatchModal location!");
} else {
    console.log("Could not find blocks in BuyerMatchModal");
}
