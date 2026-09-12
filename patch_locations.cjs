const fs = require('fs');

const locationLogic = (isDealMatch) => `            // --- 5. LOCATION LOGIC ---
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
                    return ${isDealMatch ? '{ deal, isMatch: false, reasons: [] as string[] };' : '{ buyer, matchScore: 0, reasons: [] as string[] };'}
                }
            }`;

function patchFile(filePath, isDealMatch) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Find where the old Location block starts
    const startIdx = content.indexOf('// --- 5. LOCATION (Hierarchical Logic) ---');
    if (startIdx === -1) {
        console.log("Could not find start block in " + filePath);
        return;
    }
    
    let endIdx;
    if (isDealMatch) {
        endIdx = content.indexOf('return { deal, isMatch: true, reasons };');
    } else {
        endIdx = content.indexOf('// Restore Score');
    }
    
    if (endIdx === -1) {
        console.log("Could not find end block in " + filePath);
        return;
    }
    
    const blockToRemove = content.substring(startIdx, endIdx);
    content = content.replace(blockToRemove, locationLogic(isDealMatch) + '\n\n            ');
    
    fs.writeFileSync(filePath, content);
    console.log("Successfully patched " + filePath);
}

patchFile('./components/Buyers/DealMatchModal.tsx', true);
patchFile('./components/Deals/BuyerMatchModal.tsx', false);
