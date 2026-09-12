const fs = require('fs');
let content = fs.readFileSync('./components/Deals/BuyerMatchModal.tsx', 'utf8');
content = content.replace('reasons.push("Criteria Match");', 'if (hasFinancials || hasSpecs) reasons.push("Criteria Match");');
fs.writeFileSync('./components/Deals/BuyerMatchModal.tsx', content);

content = fs.readFileSync('./components/Buyers/DealMatchModal.tsx', 'utf8');
content = content.replace('reasons.push("Criteria Match");', 'if (hasFinancials || hasSpecs) reasons.push("Criteria Match");');
fs.writeFileSync('./components/Buyers/DealMatchModal.tsx', content);
console.log("Patched Criteria Match!");
