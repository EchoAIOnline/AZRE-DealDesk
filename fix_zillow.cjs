const fs = require('fs');

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    content = content.replace(
        /if \(zData\.mappedComps && Array\.isArray\(zData\.mappedComps\)\) {\s*if \(zData\.mappedComps\[0\]\) updates\.renovationComparable1 = zData\.mappedComps\[0\];\s*if \(zData\.mappedComps\[1\]\) updates\.renovationComparable2 = zData\.mappedComps\[1\];\s*if \(zData\.mappedComps\[2\]\) updates\.renovationComparable3 = zData\.mappedComps\[2\];\s*}/,
        `if (zData.mappedComps && Array.isArray(zData.mappedComps)) {
                    if (zData.mappedComps[0]) updates.renovationComparable1 = zData.mappedComps[0];
                    if (zData.mappedComps[1]) updates.renovationComparable2 = zData.mappedComps[1];
                    if (zData.mappedComps[2]) updates.renovationComparable3 = zData.mappedComps[2];
                    
                    const arvs = zData.mappedComps.slice(0, 3).map((c: any) => c.salePrice || 0).filter((p: number) => p > 0);
                    if (arvs.length > 0) {
                        updates.renovationARVAmount = Math.round(arvs.reduce((a: number, b: number) => a + b, 0) / arvs.length);
                    }
                }`
    );

    fs.writeFileSync(filePath, content);
}

fixFile('components/Deals/EditDealModal.tsx');
fixFile('components/Deals/EditWholesalerDealModal.tsx');
console.log("Done");
