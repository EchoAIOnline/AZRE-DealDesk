const fs = require('fs');
let content = fs.readFileSync('components/Deals/EditDealModal.tsx', 'utf8');

// Replace \` at the end
content = content.replace(/_rb\/\\\`;/g, '_rb/`;');
content = content.replace(/\\\$\\\{/g, '${');
content = content.replace(/\\\$\{/g, '${');
fs.writeFileSync('components/Deals/EditDealModal.tsx', content);
console.log("Fixed string end");
