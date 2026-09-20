import { Deal, Buyer } from '../types';
import { POTENTIAL_STATUSES, UNDER_CONTRACT_STATUSES } from '../constants';

export type MatchTier = 'Perfect Match' | 'Strong Match' | 'Possible Match';

export interface MatchResult {
  isMatch: boolean;
  score: number;
  tier?: MatchTier;
  matchedCriteria: string[];
  failedReasons: string[];
  level1Passed: boolean;
  level2Passed: boolean;
  level3Passed: boolean;
}

// Helper to parse location string into structured categories
const parseLocations = (locString: any) => {
    const zips: string[] = [];
    const counties: string[] = [];
    const cities: string[] = [];
    const neighborhoods: string[] = [];
    if (!locString) return { zips, counties, cities, neighborhoods };

    const str = String(locString).trim();
    if (!str) return { zips, counties, cities, neighborhoods };

    str.split(',').map(s => s.trim()).filter(Boolean).forEach(part => {
        const lower = part.toLowerCase();
        if (lower.startsWith('zip code:') || lower.startsWith('zip:')) {
            const z = part.replace(/zip( code)?:/i, '').trim();
            if (z) zips.push(z);
        } else if (lower.startsWith('county:')) {
            const c = lower.replace('county:', '').replace('county', '').trim();
            if (c) counties.push(c);
        } else if (lower.startsWith('city:')) {
            const c = lower.replace('city:', '').trim();
            if (c) cities.push(c);
        } else if (lower.startsWith('neighborhood:')) {
            const n = lower.replace('neighborhood:', '').trim();
            if (n) neighborhoods.push(n);
        } else if (/^\d{5}$/.test(part)) {
            zips.push(part);
        } else if (lower.includes('county')) {
            const c = lower.replace('county', '').trim();
            if (c) counties.push(c);
        } else {
            // Unprefixed entry - treat as potential city or neighborhood
            cities.push(lower);
            neighborhoods.push(lower);
        }
    });

    return { zips, counties, cities, neighborhoods };
};

const normalizeStrategy = (strat: any): string => {
    if (!strat || typeof strat !== 'string') return '';
    const s = strat.trim().toLowerCase();
    if (s === 'new build' || s === 'new construction') return 'new construction';
    if (s === 'renovation' || s === 'reno' || s === 'fix & flip' || s === 'flip') return 'renovation';
    if (s === 'rental' || s === 'buy & hold' || s === 'hold') return 'rental';
    if (s === 'multi-family' || s === 'multifamily') return 'multi-family';
    return s;
};

const formatStrategyName = (strat: string): string => {
    if (!strat) return '';
    if (strat === 'new construction') return 'New Construction';
    if (strat === 'multi-family') return 'Multi-Family';
    return strat.charAt(0).toUpperCase() + strat.slice(1);
};

export const MatchingEngine = {
    evaluateMatch(buyer: Buyer, deal: Deal): MatchResult {
        if (!buyer || !deal) {
            return {
                isMatch: false,
                score: 0,
                matchedCriteria: [],
                failedReasons: ["Missing buyer or deal data"],
                level1Passed: false,
                level2Passed: false,
                level3Passed: false
            };
        }

        const bb = buyer.buyBox;
        if (!bb) {
            return { 
                isMatch: false, 
                score: 0, 
                matchedCriteria: [], 
                failedReasons: ["No Buy Box Criteria"], 
                level1Passed: false, 
                level2Passed: false, 
                level3Passed: false 
            };
        }

        // Active pipeline stages check (including Available for Wholesaler/DFD deals)
        const matchingStages = [...POTENTIAL_STATUSES, ...UNDER_CONTRACT_STATUSES, 'Available'];
        if (deal.offerDecision && !matchingStages.includes(deal.offerDecision)) {
             return { 
                 isMatch: false, 
                 score: 0, 
                 matchedCriteria: [], 
                 failedReasons: ["Deal not in active pipeline stage"], 
                 level1Passed: false, 
                 level2Passed: false, 
                 level3Passed: false 
             };
        }

        const matchedCriteria: string[] = [];
        const failedReasons: string[] = [];

        // ==========================================
        // LEVEL ONE: LOCATION MATCHING
        // ==========================================
        // Requirement: If location field is empty, Option B: Match no deals (require at least 1 target location)
        const rawLocations = bb.locations ? String(bb.locations).trim() : '';
        if (!rawLocations) {
            return {
                isMatch: false,
                score: 0,
                matchedCriteria: [],
                failedReasons: ["No target location specified in Buy Box"],
                level1Passed: false,
                level2Passed: false,
                level3Passed: false
            };
        }

        const { zips, counties, cities, neighborhoods } = parseLocations(rawLocations);
        if (zips.length === 0 && counties.length === 0 && cities.length === 0 && neighborhoods.length === 0) {
            return {
                isMatch: false,
                score: 0,
                matchedCriteria: [],
                failedReasons: ["No valid target location specified in Buy Box"],
                level1Passed: false,
                level2Passed: false,
                level3Passed: false
            };
        }

        const dealAddressSafe = (deal.address || "");
        const dealZip = dealAddressSafe.match(/\b\d{5}\b/)?.[0] || "";
        const dealCounty = (deal.county || "").toLowerCase().replace('county', '').trim();
        const dealCity = (deal.subMarket || "").toLowerCase().trim();
        const dealNeighborhood = (deal.neighborhood || "").toLowerCase().trim();
        const dealAddressLower = dealAddressSafe.toLowerCase();

        let zipMatch = false;
        let cityMatch = false;
        let countyMatch = false;
        let neighborhoodMatch = false;

        // Zip Code Match
        if (zips.length > 0 && dealZip && zips.includes(dealZip)) {
            zipMatch = true;
            matchedCriteria.push(`Zip Match (${dealZip})`);
        }

        // City Match
        if (cities.length > 0) {
            const matchedCity = cities.find(c => (dealCity && (dealCity === c || dealCity.includes(c) || c.includes(dealCity))) || dealAddressLower.includes(c));
            if (matchedCity) {
                cityMatch = true;
                matchedCriteria.push(`City Match (${deal.subMarket || matchedCity})`);
            }
        }

        // County Match
        if (counties.length > 0 && dealCounty) {
            const matchedCounty = counties.find(c => dealCounty.includes(c) || c.includes(dealCounty));
            if (matchedCounty) {
                countyMatch = true;
                matchedCriteria.push(`County Match (${deal.county || matchedCounty})`);
            }
        }

        // Neighborhood Match
        if (neighborhoods.length > 0) {
            const matchedNb = neighborhoods.find(n => (dealNeighborhood && (dealNeighborhood.includes(n) || n.includes(dealNeighborhood))) || dealAddressLower.includes(n));
            if (matchedNb) {
                neighborhoodMatch = true;
                matchedCriteria.push(`Neighborhood Match (${deal.neighborhood || matchedNb})`);
            }
        }

        // Level One Verdict (Scenario A: Conditional Refinement Rule)
        // - If buyer has specified target Zip Code(s), a match REQUIRES matching at least one of their target Zip Codes.
        //   (e.g., if a buyer targets City: Phoenix with Zip: 85018, a deal in 85033 Phoenix is excluded).
        // - If buyer specified City, County, or Neighborhood WITHOUT any Zip Codes, they buy anywhere in that area.
        let level1Passed = false;

        if (zips.length > 0) {
            if (zipMatch) {
                level1Passed = true;
            } else {
                level1Passed = false;
                if (cityMatch || countyMatch || neighborhoodMatch) {
                    failedReasons.push(`Zip Code Mismatch: Deal is in zip ${dealZip || 'N/A'}, but buyer's buy box strictly targets zip(s): ${zips.join(', ')}`);
                } else {
                    failedReasons.push("Location Mismatch");
                }
            }
        } else {
            level1Passed = cityMatch || countyMatch || neighborhoodMatch;
            if (!level1Passed) {
                failedReasons.push("Location Mismatch");
            }
        }

        if (!level1Passed) {
            return {
                isMatch: false,
                score: 0,
                matchedCriteria: [],
                failedReasons: failedReasons.length > 0 ? failedReasons : ["Location Mismatch"],
                level1Passed: false,
                level2Passed: false,
                level3Passed: false
            };
        }

        // ==========================================
        // LEVEL TWO: STRATEGY MATCHING
        // ==========================================
        const rawBuyerProp = Array.isArray(bb.propertyTypes) ? bb.propertyTypes : (typeof bb.propertyTypes === 'string' ? (bb.propertyTypes as string).split(',') : []);
        const buyerStrategies = rawBuyerProp.map(normalizeStrategy).filter(Boolean);

        const rawDealType = Array.isArray(deal.dealType) ? deal.dealType : (typeof deal.dealType === 'string' ? (deal.dealType as string).split(',') : []);
        const dealStrategies = rawDealType.map(normalizeStrategy).filter(Boolean);

        let level2Passed = false;
        let strategyOverlaps: string[] = [];

        // Strategy Unset rule:
        // If buyer has no strategy selected but has location set, match by location.
        // If deal has no strategy selected, match by location only.
        if (buyerStrategies.length === 0 || dealStrategies.length === 0) {
            level2Passed = true;
            matchedCriteria.push("Strategy Match (Open / Any Strategy)");
        } else {
            strategyOverlaps = buyerStrategies.filter(s => dealStrategies.includes(s));
            if (strategyOverlaps.length > 0) {
                level2Passed = true;
                matchedCriteria.push(`Strategy Match (${strategyOverlaps.map(formatStrategyName).join(', ')})`);
            } else {
                level2Passed = false;
                failedReasons.push(`Strategy Mismatch: Buyer wants [${buyerStrategies.map(formatStrategyName).join(', ')}] vs Deal is [${dealStrategies.map(formatStrategyName).join(', ')}]`);
            }
        }

        // If both sides explicitly declared strategies and had zero overlap, reject candidate
        if (!level2Passed) {
            return {
                isMatch: false,
                score: 25,
                matchedCriteria,
                failedReasons,
                level1Passed: true,
                level2Passed: false,
                level3Passed: false
            };
        }

        // ==========================================
        // LEVEL THREE: FINANCIALS, SPECS & EXEMPTION
        // ==========================================
        let pricePassed = true;
        let arvPassed = true;
        let specsPassed = true;

        // 1. Purchase Price Check against deal.offerPrice (fallback to listPrice if offerPrice not set)
        const effectivePrice = (deal.offerPrice && deal.offerPrice > 0) ? deal.offerPrice : (deal.listPrice || 0);
        if (bb.minPrice && bb.minPrice > 0 && effectivePrice > 0 && effectivePrice < bb.minPrice) {
            pricePassed = false;
            failedReasons.push(`Offer price below minimum ($${effectivePrice.toLocaleString()} < $${bb.minPrice.toLocaleString()})`);
        }
        if (bb.maxPrice && bb.maxPrice > 0 && effectivePrice > 0 && effectivePrice > bb.maxPrice) {
            pricePassed = false;
            failedReasons.push(`Offer price above maximum ($${effectivePrice.toLocaleString()} > $${bb.maxPrice.toLocaleString()})`);
        }
        if ((bb.minPrice || bb.maxPrice) && pricePassed && effectivePrice > 0) {
            matchedCriteria.push(`Offer Price Match ($${effectivePrice.toLocaleString()})`);
        }

        // 2. ARV Cross-Check
        // Strategy-driven ARV resolution:
        // - If New Build/New Construction was matched, check newConstructionARV
        // - If Renovation/Rental was matched, check renovationARV
        // - Modal toggle overrides (deal.newConstructionARVToggle vs deal.renovationARVToggle)
        const isNewConstructionMatch = strategyOverlaps.includes('new construction') || dealStrategies.includes('new construction');
        let dealArvToEvaluate = 0;

        if (isNewConstructionMatch && deal.newConstructionARV && deal.newConstructionARV > 0) {
            dealArvToEvaluate = deal.newConstructionARV;
        } else if (deal.newConstructionARVToggle && deal.newConstructionARV && deal.newConstructionARV > 0) {
            dealArvToEvaluate = deal.newConstructionARV;
        } else if (deal.renovationARV && deal.renovationARV > 0) {
            dealArvToEvaluate = deal.renovationARV;
        } else if (deal.newConstructionARV && deal.newConstructionARV > 0) {
            dealArvToEvaluate = deal.newConstructionARV;
        }

        const hasMinArv = bb.minArv && bb.minArv > 0;
        const hasMaxArv = bb.maxArv && bb.maxArv > 0;

        if (hasMinArv || hasMaxArv) {
            if (dealArvToEvaluate > 0) {
                if (hasMinArv && dealArvToEvaluate < bb.minArv!) {
                    arvPassed = false;
                    failedReasons.push(`ARV below minimum ($${dealArvToEvaluate.toLocaleString()} < $${bb.minArv!.toLocaleString()})`);
                }
                if (hasMaxArv && dealArvToEvaluate > bb.maxArv!) {
                    arvPassed = false;
                    failedReasons.push(`ARV above maximum ($${dealArvToEvaluate.toLocaleString()} > $${bb.maxArv!.toLocaleString()})`);
                }
                if (arvPassed) {
                    matchedCriteria.push(`ARV Match ($${dealArvToEvaluate.toLocaleString()})`);
                }
            }
        }

        // 3. Beds, Baths & SqFt + New Build Exemption
        // "New Build Exemption: For deals tagged strictly as 'New Construction' where lot acquisition or teardown is intended,
        // consider bypassing existing structure beds/baths/sqft checks unless the buyer explicitly tracks lot size."
        if (isNewConstructionMatch) {
            specsPassed = true;
            matchedCriteria.push("New Build Exemption (Lot / Teardown Specs Bypassed)");
        } else {
            // Beds check
            if (bb.minBedrooms && bb.minBedrooms > 0) {
                if ((deal.bedrooms || 0) < bb.minBedrooms) {
                    specsPassed = false;
                    failedReasons.push(`Bedrooms below minimum (${deal.bedrooms || 0} < ${bb.minBedrooms})`);
                } else {
                    matchedCriteria.push(`Beds Match (${deal.bedrooms || 0}+)`);
                }
            }
            // Baths check
            if (bb.minBathrooms && bb.minBathrooms > 0) {
                if ((deal.bathrooms || 0) < bb.minBathrooms) {
                    specsPassed = false;
                    failedReasons.push(`Bathrooms below minimum (${deal.bathrooms || 0} < ${bb.minBathrooms})`);
                } else {
                    matchedCriteria.push(`Baths Match (${deal.bathrooms || 0}+)`);
                }
            }
            // SqFt checks
            if (bb.minSqft && bb.minSqft > 0) {
                if ((deal.sqft || 0) < bb.minSqft) {
                    specsPassed = false;
                    failedReasons.push(`SqFt below minimum (${deal.sqft || 0} < ${bb.minSqft})`);
                } else {
                    matchedCriteria.push(`Min SqFt Match (${deal.sqft || 0}+)`);
                }
            }
            if (bb.maxSqft && bb.maxSqft > 0) {
                if ((deal.sqft || 0) > bb.maxSqft) {
                    specsPassed = false;
                    failedReasons.push(`SqFt above maximum (${deal.sqft || 0} > ${bb.maxSqft})`);
                } else {
                    matchedCriteria.push(`Max SqFt Match (${deal.sqft || 0})`);
                }
            }
        }

        const level3Passed = pricePassed && arvPassed && specsPassed;

        // ==========================================
        // GRADED / SCORED MATCH CALCULATIONS
        // ==========================================
        let score = 60;
        let tier: MatchTier = 'Possible Match';

        if (level3Passed) {
            if (strategyOverlaps.length > 0) {
                score = 100;
                tier = 'Perfect Match';
            } else {
                score = 90;
                tier = 'Strong Match';
            }
        } else {
            // Check if only minor Level 3 criteria failed
            const failedCount = (pricePassed ? 0 : 1) + (arvPassed ? 0 : 1) + (specsPassed ? 0 : 1);
            if (failedCount === 1) {
                score = 80;
                tier = 'Strong Match';
            } else {
                score = 65;
                tier = 'Possible Match';
            }
        }

        return {
            isMatch: true,
            score,
            tier,
            matchedCriteria,
            failedReasons,
            level1Passed: true,
            level2Passed: true,
            level3Passed
        };
    },

    findDealsForBuyer(buyer: Buyer, deals: Deal[]): { deal: Deal; match: MatchResult }[] {
        if (!buyer || !deals || !Array.isArray(deals)) return [];
        return deals
            .filter(deal => !!deal)
            .map(deal => ({ deal, match: this.evaluateMatch(buyer, deal) }))
            .filter(result => result.match && result.match.isMatch)
            .sort((a, b) => b.match.score - a.match.score);
    },

    findBuyersForDeal(deal: Deal, buyers: Buyer[]): { buyer: Buyer; match: MatchResult }[] {
        if (!deal || !buyers || !Array.isArray(buyers)) return [];
        return buyers
            .filter(buyer => !!buyer)
            .map(buyer => ({ buyer, match: this.evaluateMatch(buyer, deal) }))
            .filter(result => result.match && result.match.isMatch)
            .sort((a, b) => b.match.score - a.match.score);
    }
};
