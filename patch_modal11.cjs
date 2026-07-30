const fs = require('fs');
let content = fs.readFileSync('components/Deals/EditDealModal.tsx', 'utf8');

// Replace \`https... with `https...
content = content.replace(/\\\`https/g, '\`https');

fs.writeFileSync('components/Deals/EditDealModal.tsx', content);
console.log("Fixed backticks literal in EditDealModal.tsx");
