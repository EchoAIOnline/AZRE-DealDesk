const fs = require('fs');
const content = fs.readFileSync('components/Deals/EditDealModal.tsx', 'utf8');

const target = `                if (zData.description) updates.listingDescription = (deal.listingDescription ? deal.listingDescription + '\\n\\n' : '') + 'Zillow Description: ' + zData.description;`;

const replacement = `                if (zData.description) updates.listingDescription = (deal.listingDescription ? deal.listingDescription + '\\n\\n' : '') + 'Zillow Description: ' + zData.description;

                if (zData.mappedPhotos && Array.isArray(zData.mappedPhotos)) {
                    updates.photos = [...(deal.photos || []), ...zData.mappedPhotos];
                }
                if (zData.mappedAgentName) updates.agentName = zData.mappedAgentName;
                if (zData.mappedAgentPhone) updates.agentPhone = zData.mappedAgentPhone;
                if (zData.mappedAgentBrokerage) updates.agentBrokerage = zData.mappedAgentBrokerage;
                if (zData.mappedAgentBrokerPhone) updates.agentBrokerPhone = zData.mappedAgentBrokerPhone;
                
                if (zData.mappedMlsNumber) updates.mls = zData.mappedMlsNumber;
                if (zData.mappedListingType) updates.listingType = zData.mappedListingType;
                if (zData.mappedDateListed) updates.dateListed = zData.mappedDateListed;`;

if (content.includes(target)) {
    fs.writeFileSync('components/Deals/EditDealModal.tsx', content.replace(target, replacement));
    console.log("Patched EditDealModal.tsx");
} else {
    console.log("Target not found");
}
