const fs = require('fs');
const content = fs.readFileSync('components/Deals/EditDealModal.tsx', 'utf8');

const target = `                if (zData.mappedListingType) updates.listingType = zData.mappedListingType;
                if (zData.mappedDateListed) updates.dateListed = zData.mappedDateListed;`;

const replacement = `                if (zData.mappedListingType) updates.listingType = zData.mappedListingType;
                if (zData.mappedDateListed) updates.dateListed = zData.mappedDateListed;
                
                if (zData.mappedComps && Array.isArray(zData.mappedComps)) {
                    if (zData.mappedComps[0]) updates.renovationComparable1 = zData.mappedComps[0];
                    if (zData.mappedComps[1]) updates.renovationComparable2 = zData.mappedComps[1];
                    if (zData.mappedComps[2]) updates.renovationComparable3 = zData.mappedComps[2];
                }`;

if (content.includes(target)) {
    fs.writeFileSync('components/Deals/EditDealModal.tsx', content.replace(target, replacement));
    console.log("Patched EditDealModal.tsx successfully");
} else {
    console.log("Target not found");
}
