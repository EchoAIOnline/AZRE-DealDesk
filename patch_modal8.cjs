const fs = require('fs');
let content = fs.readFileSync('components/Deals/EditDealModal.tsx', 'utf8');

const target = `                if (zData.mappedComps && Array.isArray(zData.mappedComps)) {
                    if (zData.mappedComps[0]) updates.renovationComparable1 = zData.mappedComps[0];
                    if (zData.mappedComps[1]) updates.renovationComparable2 = zData.mappedComps[1];
                    if (zData.mappedComps[2]) updates.renovationComparable3 = zData.mappedComps[2];
                    
                    // Also populate new construction comps with the same just in case
                    if (zData.mappedComps[0]) updates.newConstructionComparable1 = zData.mappedComps[0];
                    if (zData.mappedComps[1]) updates.newConstructionComparable2 = zData.mappedComps[1];
                    if (zData.mappedComps[2]) updates.newConstructionComparable3 = zData.mappedComps[2];
                }`;

const replacement = `                if (zData.mappedComps && Array.isArray(zData.mappedComps)) {
                    // Filter comps by square footage (+/- 300 sqft of subject property)
                    let validComps = zData.mappedComps;
                    if (deal.sqft) {
                        const targetSqft = Number(deal.sqft);
                        validComps = validComps.filter((c: any) => {
                            const compSqft = Number(c.sqft);
                            if (!compSqft) return true; // If comp has no sqft, maybe include it or skip it? Let's include or maybe it's better to exclude. Let's exclude if we have a target.
                            return Math.abs(compSqft - targetSqft) <= 300;
                        });
                    }

                    if (validComps[0]) updates.renovationComparable1 = validComps[0];
                    if (validComps[1]) updates.renovationComparable2 = validComps[1];
                    if (validComps[2]) updates.renovationComparable3 = validComps[2];
                }`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('components/Deals/EditDealModal.tsx', content);
    console.log("Patched EditDealModal.tsx successfully");
} else {
    console.log("Target not found");
}
