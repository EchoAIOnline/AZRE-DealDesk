const fs = require('fs');
let code = fs.readFileSync('components/Deals/EditDealModal.tsx', 'utf8');
code = code.replaceAll(`method: 'POST',`, `method: 'POST',\n                credentials: 'include',`);
fs.writeFileSync('components/Deals/EditDealModal.tsx', code);
