import { Deal, Buyer } from '../types';
import { POTENTIAL_STATUSES, UNDER_CONTRACT_STATUSES } from '../constants';

export interface MatchResult {
  isMatch: boolean;
  score: number;
  matchedCriteria: string[];
  failedReasons: string[];
}

// Helper to parse location string into structured data
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
        else if (/^\d{5}$/.test(part)) zips.push(part);
        else if (part.includes('county')) counties.push(lower.replace('county', '').trim());
        else if (part) neighborhoods.push(lower);
    });

    return { zips, counties, cities, neighborhoods };
};

export const MatchingEngine = {
    evaluateMatch(buyer: Buyer, deal: Deal): MatchResult {
        const bb = buyer.buyBox;
        if (!bb) {
            return { isMatch: false, score: 0, matchedCriteria: [], failedReasons: ["No Buy Box Criteria"] };
        }

        const matchingStages = [...POTENTIAL_STATUSES, ...UNDER_CONTRACT_STATUSES];

        // 1. GUARD: Pipeline Stage Filter
        if (!matchingStages.includes(deal.offerDecision)) {
             return { isMatch: false, score: 0, matchedCriteria: [], failedReasons: ["Deal not in active pipeline stage"] };
        }

        // --- Extracted Attributes ---
        const { zips, counties, cities, neighborhoods } = parseLocations(bb.locations || "");
        
        const buyerStrategies = (bb.propertyTypes || []).map(t => {
            let low = t.toLowerCase();
            return low === 'new construction' ? 'new build' : low;
        }).filter(Boolean);

        const dealStrategies = (deal.dealType || []).map(s => {
            let low = s.toLowerCase();
            return low === 'new construction' ? 'new build' : low;
        }).filter(Boolean);

        const dealPrice = deal.listPrice || 0;
        const dealArv = deal.renovationARV || 0;
        const dealReno = deal.renovationEstimate || 0;
        const dealSqft = deal.sqft || 0;
        const dealYear = deal.yearBuilt || 0;
        
        const dealZip = deal.address.match(/\d{5}/)?.[0] || "";
        const dealCounty = (deal.county || "").toLowerCase().replace(' county', '').trim();
        const dealCity = (deal.subMarket || "").toLowerCase().trim();
        const dealNeighborhood = (deal.neighborhood || "").toLowerCase().trim();

        // Check if buy box is empty
        const hasLocations = bb.locations && bb.locations.trim() !== '';
        const hasStrategies = bb.propertyTypes && bb.propertyTypes.length > 0;
        const hasFinancials = (bb.minPrice && bb.minPrice > 0) || (bb.maxPrice && bb.maxPrice > 0) || (bb.minArv && bb.minArv > 0) || (bb.maxArv && bb.maxArv > 0) || (bb.maxRenoBudget && bb.maxRenoBudget > 0);
        const hasSpecs = (bb.minBedrooms && bb.minBedrooms > 0) || (bb.minBathrooms && bb.minBathrooms > 0) || (bb.minSqft && bb.minSqft > 0) || (bb.maxSqft && bb.maxSqft > 0) || (bb.earliestYearBuilt && bb.earliestYearBuilt > 0) || (bb.latestYearBuilt && bb.latestYearBuilt > 0);
        
        // 2. GUARD: If Buy Box is completely empty, reject match.
        if (!hasLocations && !hasStrategies && !hasFinancials && !hasSpecs) {
            return { isMatch: false, score: 0, matchedCriteria: [], failedReasons: ["Empty Buy Box"] };
        }

        const matchedCriteria: string[] = [];
        const failedReasons: string[] = [];

        // 3. LOCATION LOGIC (Strict City/Zip Code)
        if (hasLocations) {
            let locationMatched = false;
            
            if (zips.length > 0 && dealZip && zips.includes(dealZip)) {
                locationMatched = true;
                matchedCriteria.push(`Zip Match (${dealZip})`);
            }
            
            if (!locationMatched && cities.length > 0 && cities.includes(dealCity)) {
                locationMatched = true;
                matchedCriteria.push("Location Match (City)");
            }
            
            if (!locationMatched && counties.length > 0 && counties.some(c => dealCounty.includes(c))) {
                locationMatched = true;
                matchedCriteria.push("Location Match (County)");
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
                    matchedCriteria.push("Location Match (Neighborhood)");
                }
            }

            if (!locationMatched) {
                return { isMatch: false, score: 0, matchedCriteria: [], failedReasons: ["Location Mismatch"] };
            }
        }

        // 4. STRATEGY MATCH (Strict)
        if (buyerStrategies.length > 0) {
            if (dealStrategies.length === 0) {
                return { isMatch: false, score: 0, matchedCriteria: [], failedReasons: ["No Deal Strategy"] };
            }
            const hasOverlap = dealStrategies.some(s => buyerStrategies.includes(s));
            if (!hasOverlap) {
                return { isMatch: false, score: 0, matchedCriteria: [], failedReasons: ["Strategy Mismatch"] };
            }
            matchedCriteria.push("Strategy Match");
        }

        // 5. FINANCIALS (Strict)
        if (bb.minPrice && dealPrice < bb.minPrice) return { isMatch: false, score: 0, matchedCriteria: [], failedReasons: ["Price below minimum"] };
        if (bb.maxPrice && dealPrice > bb.maxPrice) return { isMatch: false, score: 0, matchedCriteria: [], failedReasons: ["Price above maximum"] };
        if (bb.minArv && dealArv < bb.minArv) return { isMatch: false, score: 0, matchedCriteria: [], failedReasons: ["ARV below minimum"] };
        if (bb.maxArv && bb.maxArv > 0 && dealArv > bb.maxArv) return { isMatch: false, score: 0, matchedCriteria: [], failedReasons: ["ARV above maximum"] };
        if (bb.maxRenoBudget && dealReno > bb.maxRenoBudget) return { isMatch: false, score: 0, matchedCriteria: [], failedReasons: ["Reno budget above maximum"] };

        if (hasFinancials) {
             matchedCriteria.push("Financials Match");
        }

        // 6. SPECS (Strict)
        if (bb.minBedrooms && (deal.bedrooms || 0) < bb.minBedrooms) return { isMatch: false, score: 0, matchedCriteria: [], failedReasons: ["Too few bedrooms"] };
        if (bb.minBathrooms && (deal.bathrooms || 0) < bb.minBathrooms) return { isMatch: false, score: 0, matchedCriteria: [], failedReasons: ["Too few bathrooms"] };
        if (bb.minSqft && dealSqft < bb.minSqft) return { isMatch: false, score: 0, matchedCriteria: [], failedReasons: ["SqFt below minimum"] };
        if (bb.maxSqft && bb.maxSqft > 0 && dealSqft > bb.maxSqft) return { isMatch: false, score: 0, matchedCriteria: [], failedReasons: ["SqFt above maximum"] };
        if (bb.earliestYearBuilt && dealYear < bb.earliestYearBuilt) return { isMatch: false, score: 0, matchedCriteria: [], failedReasons: ["Built too early"] };
        if (bb.latestYearBuilt && bb.latestYearBuilt > 0 && dealYear > bb.latestYearBuilt) return { isMatch: false, score: 0, matchedCriteria: [], failedReasons: ["Built too late"] };

        if (hasSpecs) {
             matchedCriteria.push("Specs Match");
        }

        // Calculate score
        let score = 0;
        if (matchedCriteria.some(r => r.includes("Match"))) score += 2; // Baseline
        if (matchedCriteria.includes("Strategy Match")) score += 2;
        if (matchedCriteria.includes("Financials Match")) score += 2;
        if (matchedCriteria.includes("Specs Match")) score += 1;
        if (matchedCriteria.some(r => r.includes("Zip Match") || r.includes("Location Match"))) score += 3;

        return { isMatch: true, score, matchedCriteria, failedReasons: [] };
    },

    findDealsForBuyer(buyer: Buyer, deals: Deal[]): { deal: Deal; match: MatchResult }[] {
        return deals
            .map(deal => ({ deal, match: this.evaluateMatch(buyer, deal) }))
            .filter(result => result.match.isMatch);
    },

    findBuyersForDeal(deal: Deal, buyers: Buyer[]): { buyer: Buyer; match: MatchResult }[] {
        return buyers
            .map(buyer => ({ buyer, match: this.evaluateMatch(buyer, deal) }))
            .filter(result => result.match.isMatch);
    }
};
