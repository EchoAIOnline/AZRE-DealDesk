const fs = require('fs');

let fileContent = fs.readFileSync('./components/Deals/BuyerMatchModal.tsx', 'utf8');

fileContent = fileContent.replace('return { buyer, matchScore, reasons };', 'return { buyer, matchScore: reasons.length, reasons };');

fs.writeFileSync('./components/Deals/BuyerMatchModal.tsx', fileContent);
console.log("Patched score successfully!");
