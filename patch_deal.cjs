const fs = require('fs');

let fileContent = fs.readFileSync('./components/Buyers/DealMatchModal.tsx', 'utf8');

// Find where `return deals.map(deal => {` begins
const searchStr = 'return deals.map(deal => {';
const insertStr = `
        // GUARD: If Buy Box is completely empty, return no matches.
        const hasLocations = bb.locations && bb.locations.trim() !== '';
        const hasStrategies = bb.propertyTypes && bb.propertyTypes.length > 0;
        const hasFinancials = bb.minPrice > 0 || bb.maxPrice > 0 || bb.minArv > 0 || bb.maxArv > 0 || bb.maxRenoBudget > 0;
        const hasSpecs = bb.minBedrooms > 0 || bb.minBathrooms > 0 || bb.minSqft > 0 || bb.maxSqft > 0 || bb.earliestYearBuilt > 0 || bb.latestYearBuilt > 0;
        
        if (!hasLocations && !hasStrategies && !hasFinancials && !hasSpecs) {
            return []; // Buyer has no criteria, match them with nothing.
        }

        return deals.map(deal => {
`;

if (fileContent.includes(searchStr)) {
    fileContent = fileContent.replace(searchStr, insertStr);
    fs.writeFileSync('./components/Buyers/DealMatchModal.tsx', fileContent);
    console.log("Patched DealMatchModal!");
} else {
    console.log("Could not find search string in DealMatchModal.");
}
