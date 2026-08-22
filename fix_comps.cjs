const fs = require('fs');

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Fix handlePullComps
    content = content.replace(
        /if \(validComps\[0\]\) updates\.renovationComparable1 = validComps\[0\];\s*if \(validComps\[1\]\) updates\.renovationComparable2 = validComps\[1\];\s*if \(validComps\[2\]\) updates\.renovationComparable3 = validComps\[2\];/,
        `if (validComps[0]) updates.renovationComparable1 = validComps[0];
                        if (validComps[1]) updates.renovationComparable2 = validComps[1];
                        if (validComps[2]) updates.renovationComparable3 = validComps[2];
                        
                        const arvs = validComps.slice(0, 3).map((c: any) => c.salePrice || 0).filter((p: number) => p > 0);
                        if (arvs.length > 0) {
                            updates.renovationARVAmount = Math.round(arvs.reduce((a: number, b: number) => a + b, 0) / arvs.length);
                        }`
    );

    content = content.replace(
        /if \(validComps\[0\]\) updates\.newConstructionComparable1 = validComps\[0\];\s*if \(validComps\[1\]\) updates\.newConstructionComparable2 = validComps\[1\];\s*if \(validComps\[2\]\) updates\.newConstructionComparable3 = validComps\[2\];/,
        `if (validComps[0]) updates.newConstructionComparable1 = validComps[0];
                        if (validComps[1]) updates.newConstructionComparable2 = validComps[1];
                        if (validComps[2]) updates.newConstructionComparable3 = validComps[2];
                        
                        const arvs = validComps.slice(0, 3).map((c: any) => c.salePrice || 0).filter((p: number) => p > 0);
                        if (arvs.length > 0) {
                            updates.newConstructionARVAmount = Math.round(arvs.reduce((a: number, b: number) => a + b, 0) / arvs.length);
                        }`
    );

    // Fix handlePullRenovationComps (Gemini)
    content = content.replace(
        /if \(validComps\[0\]\) {\s*updates\.renovationComparable1 = { \.\.\.deal\.renovationComparable1, address: validComps\[0\]\.address \|\| '', salePrice: validComps\[0\]\.salePrice \|\| 0, saleDate: validComps\[0\]\.saleDate \|\| '', sqft: validComps\[0\]\.sqft \|\| 0, softenerPercent: deal\.renovationComparable1\?\.softenerPercent \|\| 0 };\s*}\s*if \(validComps\[1\]\) {\s*updates\.renovationComparable2 = { \.\.\.deal\.renovationComparable2, address: validComps\[1\]\.address \|\| '', salePrice: validComps\[1\]\.salePrice \|\| 0, saleDate: validComps\[1\]\.saleDate \|\| '', sqft: validComps\[1\]\.sqft \|\| 0, softenerPercent: deal\.renovationComparable2\?\.softenerPercent \|\| 0 };\s*}\s*if \(validComps\[2\]\) {\s*updates\.renovationComparable3 = { \.\.\.deal\.renovationComparable3, address: validComps\[2\]\.address \|\| '', salePrice: validComps\[2\]\.salePrice \|\| 0, saleDate: validComps\[2\]\.saleDate \|\| '', sqft: validComps\[2\]\.sqft \|\| 0, softenerPercent: deal\.renovationComparable3\?\.softenerPercent \|\| 0 };\s*}/,
        `if (validComps[0]) {
                    updates.renovationComparable1 = { ...deal.renovationComparable1, address: validComps[0].address || '', salePrice: validComps[0].salePrice || 0, saleDate: validComps[0].saleDate || '', sqft: validComps[0].sqft || 0, softenerPercent: deal.renovationComparable1?.softenerPercent || 0 };
                }
                if (validComps[1]) {
                    updates.renovationComparable2 = { ...deal.renovationComparable2, address: validComps[1].address || '', salePrice: validComps[1].salePrice || 0, saleDate: validComps[1].saleDate || '', sqft: validComps[1].sqft || 0, softenerPercent: deal.renovationComparable2?.softenerPercent || 0 };
                }
                if (validComps[2]) {
                    updates.renovationComparable3 = { ...deal.renovationComparable3, address: validComps[2].address || '', salePrice: validComps[2].salePrice || 0, saleDate: validComps[2].saleDate || '', sqft: validComps[2].sqft || 0, softenerPercent: deal.renovationComparable3?.softenerPercent || 0 };
                }
                
                const arvs = validComps.slice(0, 3).map((c: any) => c.salePrice || 0).filter((p: number) => p > 0);
                if (arvs.length > 0) {
                    updates.renovationARVAmount = Math.round(arvs.reduce((a: number, b: number) => a + b, 0) / arvs.length);
                }`
    );

    fs.writeFileSync(filePath, content);
}

fixFile('components/Deals/EditDealModal.tsx');
fixFile('components/Deals/EditWholesalerDealModal.tsx');
console.log("Done");
