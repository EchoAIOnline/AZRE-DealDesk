const fs = require('fs');

let fileContent = fs.readFileSync('./components/Deals/BuyerMatchModal.tsx', 'utf8');

const searchStr = 'return buyers.map(buyer => {';
const insertStr = `
        return buyers.map(buyer => {
            const bb = buyer.buyBox;
            if (!bb) return { buyer, matchScore: 0, reasons: [] as string[] };
            
            // GUARD: If Buy Box is completely empty, don't match.
            const hasLocations = bb.locations && bb.locations.trim() !== '';
            const hasStrategies = bb.propertyTypes && bb.propertyTypes.length > 0;
            const hasFinancials = (bb.minPrice && bb.minPrice > 0) || (bb.maxPrice && bb.maxPrice > 0) || (bb.minArv && bb.minArv > 0) || (bb.maxArv && bb.maxArv > 0) || (bb.maxRenoBudget && bb.maxRenoBudget > 0);
            const hasSpecs = (bb.minBedrooms && bb.minBedrooms > 0) || (bb.minBathrooms && bb.minBathrooms > 0) || (bb.minSqft && bb.minSqft > 0) || (bb.maxSqft && bb.maxSqft > 0) || (bb.earliestYearBuilt && bb.earliestYearBuilt > 0) || (bb.latestYearBuilt && bb.latestYearBuilt > 0);
            
            if (!hasLocations && !hasStrategies && !hasFinancials && !hasSpecs) {
                return { buyer, matchScore: 0, reasons: [] as string[] };
            }
`;

if (fileContent.includes(searchStr)) {
    // Need to also remove the existing `const bb = buyer.buyBox;` and `if (!bb)...` that is right after the return buyers.map...
    
    fileContent = fileContent.replace(/return buyers\.map\(buyer => \{\s*const bb = buyer\.buyBox;\s*const reasons: string\[\] = \[\];\s*let matchScore = 1;\s*if \(!bb\) return \{ buyer, matchScore: 0, reasons: \[\] as string\[\] \};/, `
        return buyers.map(buyer => {
            const bb = buyer.buyBox;
            const reasons: string[] = [];
            let matchScore = 1;
            
            if (!bb) return { buyer, matchScore: 0, reasons: [] as string[] };
            
            // GUARD: If Buy Box is completely empty, don't match.
            const hasLocations = bb.locations && bb.locations.trim() !== '';
            const hasStrategies = bb.propertyTypes && bb.propertyTypes.length > 0;
            const hasFinancials = (bb.minPrice && bb.minPrice > 0) || (bb.maxPrice && bb.maxPrice > 0) || (bb.minArv && bb.minArv > 0) || (bb.maxArv && bb.maxArv > 0) || (bb.maxRenoBudget && bb.maxRenoBudget > 0);
            const hasSpecs = (bb.minBedrooms && bb.minBedrooms > 0) || (bb.minBathrooms && bb.minBathrooms > 0) || (bb.minSqft && bb.minSqft > 0) || (bb.maxSqft && bb.maxSqft > 0) || (bb.earliestYearBuilt && bb.earliestYearBuilt > 0) || (bb.latestYearBuilt && bb.latestYearBuilt > 0);
            
            if (!hasLocations && !hasStrategies && !hasFinancials && !hasSpecs) {
                return { buyer, matchScore: 0, reasons: [] as string[] };
            }
    `);
    fs.writeFileSync('./components/Deals/BuyerMatchModal.tsx', fileContent);
    console.log("Patched BuyerMatchModal!");
} else {
    console.log("Could not find search string in BuyerMatchModal.");
}
