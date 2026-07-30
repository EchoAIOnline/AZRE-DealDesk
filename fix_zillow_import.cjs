const fs = require('fs');
let code = fs.readFileSync('components/Deals/EditDealModal.tsx', 'utf8');

code = code.replace(/updates\.beds =/g, 'updates.bedrooms =');
code = code.replace(/updates\.baths =/g, 'updates.bathrooms =');
code = code.replace(/updates\.notes =/g, 'updates.listingDescription =');
code = code.replace(/deal\.notes \?/g, 'deal.listingDescription ?');
code = code.replace(/deal\.notes \+/g, 'deal.listingDescription +');

fs.writeFileSync('components/Deals/EditDealModal.tsx', code);
