const fs = require('fs');

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Rename the dollar amounts back to their original names
    content = content.replace(/deal\.renovationARVAmount/g, 'deal.renovationARV');
    content = content.replace(/deal\.newConstructionARVAmount/g, 'deal.newConstructionARV');
    content = content.replace(/renovationARVAmount:/g, 'renovationARV:');
    content = content.replace(/newConstructionARVAmount:/g, 'newConstructionARV:');

    // Since renovationARV is now a number again, we need new names for the booleans used in the toggles.
    // I will use `useRenovationARV` and `useNewConstructionARV`.
    // Wait, let's fix the toggle updates:
    content = content.replace(/updateDealState\(\{ renovationARV: true, newConstructionARV: false \}\)/g, 'updateDealState({ useRenovationARV: true, useNewConstructionARV: false })');
    content = content.replace(/updateDealState\(\{ renovationARV: false, newConstructionARV: true \}\)/g, 'updateDealState({ useRenovationARV: false, useNewConstructionARV: true })');

    // Fix the conditionals
    content = content.replace(/deal\.newConstructionARV \?/g, 'deal.useNewConstructionARV ?');
    content = content.replace(/!deal\.newConstructionARV \?/g, '!deal.useNewConstructionARV ?');

    // But wait, what if I replaced newConstructionARV with useNewConstructionARV above where it was used as a boolean?
    // Let's just fix the whole file carefully.
    fs.writeFileSync(filePath, content);
}

replaceInFile('components/Deals/EditDealModal.tsx');
replaceInFile('components/Deals/EditWholesalerDealModal.tsx');
replaceInFile('types.ts');
replaceInFile('App.tsx');
console.log("Replaced");
