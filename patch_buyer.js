const fs = require('fs');

let fileContent = fs.readFileSync('./components/Deals/BuyerMatchModal.tsx', 'utf8');

const parseLocationsCode = `    // Helper to parse location string into structured data
    const parseLocations = (locString: string) => {
        const zips: string[] = [];
        const counties: string[] = [];
        const cities: string[] = [];
        const neighborhoods: string[] = [];
        if (!locString) return { zips, counties, cities, neighborhoods };

        locString.split(',').map(s => s.trim()).forEach(part => {
            const lower = part.toLowerCase();
            if (lower.startsWith('zip code:')) zips.push(part.replace(/zip code:/i, '').trim());
            else if (lower.startsWith('county:')) counties.push(lower.replace('county:', '').trim().replace(' county', ''));
            else if (lower.startsWith('city:')) cities.push(lower.replace('city:', '').trim());
            else if (lower.startsWith('neighborhood:')) neighborhoods.push(lower.replace('neighborhood:', '').trim());
            else if (/^\\d{5}$/.test(part)) zips.push(part);
            else if (part.includes('county')) counties.push(lower.replace('county', '').trim());
            else if (part) neighborhoods.push(lower);
        });

        return { zips, counties, cities, neighborhoods };
    };`;


const matchLogic = `    const matches = useMemo(() => {
        const dealZip = deal.address.match(/\\d{5}/)?.[0] || "";
        const dealCounty = (deal.county || "").toLowerCase().replace(' county', '').trim();
        const dealCity = (deal.subMarket || "").toLowerCase().trim();
        const dealNeighborhood = (deal.neighborhood || "").toLowerCase().trim();
        
        const dealPrice = deal.listPrice || 0;
        const dealArv = deal.renovationARV || 0;
        const dealReno = deal.renovationEstimate || 0;
        const dealSqft = deal.sqft || 0;
        const dealYear = deal.yearBuilt || 0;
        
        const dealStrategies = (deal.dealType || []).map(s => {
            let low = s.toLowerCase();
            return low === 'new construction' ? 'new build' : low;
        }).filter(Boolean);

        return buyers.map(buyer => {
            const bb = buyer.buyBox;
            const reasons: string[] = [];
            let matchScore = 1;
            if (!bb) return { buyer, matchScore: 0, reasons: [] as string[] };
            
            const { zips, counties, cities, neighborhoods } = parseLocations(bb.locations || "");

            // --- 1. STRATEGY MATCH (Strict) ---
            const buyerStrategies = (bb.propertyTypes || []).map(t => {
                let low = t.toLowerCase();
                return low === 'new construction' ? 'new build' : low;
            }).filter(Boolean);

            if (buyerStrategies.length > 0) {
                if (dealStrategies.length === 0) return { buyer, matchScore: 0, reasons: [] as string[] };
                const hasOverlap = dealStrategies.some(s => buyerStrategies.includes(s));
                if (!hasOverlap) return { buyer, matchScore: 0, reasons: [] as string[] };
                reasons.push("Strategy Match");
            }

            // --- 2. FINANCIALS (Strict) ---
            if (bb.minPrice && dealPrice < bb.minPrice) return { buyer, matchScore: 0, reasons: [] as string[] };
            if (bb.maxPrice && dealPrice > bb.maxPrice) return { buyer, matchScore: 0, reasons: [] as string[] };
            if (bb.minArv && dealArv < bb.minArv) return { buyer, matchScore: 0, reasons: [] as string[] };
            if (bb.maxArv && bb.maxArv > 0 && dealArv > bb.maxArv) return { buyer, matchScore: 0, reasons: [] as string[] };
            if (bb.maxRenoBudget && dealReno > bb.maxRenoBudget) return { buyer, matchScore: 0, reasons: [] as string[] };

            // --- 3. SPECS (Strict) ---
            if (bb.minBedrooms && (deal.bedrooms || 0) < bb.minBedrooms) return { buyer, matchScore: 0, reasons: [] as string[] };
            if (bb.minBathrooms && (deal.bathrooms || 0) < bb.minBathrooms) return { buyer, matchScore: 0, reasons: [] as string[] };
            if (bb.minSqft && dealSqft < bb.minSqft) return { buyer, matchScore: 0, reasons: [] as string[] };
            if (bb.maxSqft && bb.maxSqft > 0 && dealSqft > bb.maxSqft) return { buyer, matchScore: 0, reasons: [] as string[] };
            if (bb.earliestYearBuilt && dealYear < bb.earliestYearBuilt) return { buyer, matchScore: 0, reasons: [] as string[] };
            if (bb.latestYearBuilt && bb.latestYearBuilt > 0 && dealYear > bb.latestYearBuilt) return { buyer, matchScore: 0, reasons: [] as string[] };
            reasons.push("Criteria Match");

            // --- 4. LOCATION (Hierarchical Logic) ---
            if (zips.length > 0) {
                if (!dealZip || !zips.includes(dealZip)) return { buyer, matchScore: 0, reasons: [] as string[] };
                reasons.push(\`Zip Match (\${dealZip})\`);
            } else {
                let geoMatch = false;
                if (counties.length > 0) {
                    const ctyMatch = counties.some(c => dealCounty.includes(c));
                    if (ctyMatch) geoMatch = true;
                } 
                if (cities.length > 0) {
                    const cityMatch = cities.includes(dealCity);
                    if (cityMatch) geoMatch = true;
                }
                
                if (!bb.locations || bb.locations.trim() === '') geoMatch = true;
                if ((counties.length > 0 || cities.length > 0) && !geoMatch) return { buyer, matchScore: 0, reasons: [] as string[] };
                if (geoMatch && (counties.length > 0 || cities.length > 0)) reasons.push("Location Match");
            }

            return { buyer, matchScore, reasons };
        })
        .filter(m => m.matchScore > 0) 
        .sort((a, b) => b.matchScore - a.matchScore);
    }, [deal, buyers]);`;

// Regex replace from "const matches = useMemo(" to "}, [deal, buyers]);"
const regex = /const matches = useMemo\(\(\) => \{[\s\S]*?\}, \[deal, buyers\]\);/;
fileContent = fileContent.replace(regex, matchLogic);

// Insert parseLocations right before "const matches = useMemo("
fileContent = fileContent.replace("const matches = useMemo(", parseLocationsCode + "\n\n    const matches = useMemo(");

fs.writeFileSync('./components/Deals/BuyerMatchModal.tsx', fileContent);
