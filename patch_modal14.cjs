const fs = require('fs');
let content = fs.readFileSync('components/Deals/EditDealModal.tsx', 'utf8');

const targetFunc = `                    if (deal.sqft) {
                        const targetSqft = Number(deal.sqft);
                        console.log("Filtering comps. Target sqft:", targetSqft);
                        console.log("Original comps count:", validComps.length);
                        validComps = validComps.filter((c: any) => {
                            const compSqft = Number(c.sqft);
                            console.log("Comp sqft:", compSqft, "Diff:", Math.abs(compSqft - targetSqft));
                            if (!compSqft) return false;
                            return Math.abs(compSqft - targetSqft) <= 300;
                        });
                        console.log("Valid comps count after filter:", validComps.length);
                    }`;

const replacement = `                    const targetSqft = Number(deal.sqft);
                    if (targetSqft > 0) {
                        console.log("Filtering comps. Target sqft:", targetSqft);
                        validComps = validComps.filter((c: any) => {
                            const compSqft = Number(c.sqft);
                            if (!compSqft) return false;
                            return Math.abs(compSqft - targetSqft) <= 300;
                        });
                        if (validComps.length === 0) {
                            setCompsError("No comps found within +/- 300 sqft of the subject property.");
                            setCompsLoading(false);
                            return;
                        }
                    } else {
                        console.log("Subject sqft is 0 or invalid. Skipping sqft filter.");
                    }`;

content = content.replace(targetFunc, replacement);
fs.writeFileSync('components/Deals/EditDealModal.tsx', content);
