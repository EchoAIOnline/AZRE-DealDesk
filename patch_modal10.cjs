const fs = require('fs');
let content = fs.readFileSync('components/Deals/EditDealModal.tsx', 'utf8');

// Replace \\` with \`
content = content.replace(/\\\\`/g, '`');
// Also check for any remaining backslash-dollars that shouldn't be there
content = content.replace(/\\\\\$/g, '$');

fs.writeFileSync('components/Deals/EditDealModal.tsx', content);
console.log("Fixed backticks in EditDealModal.tsx");
