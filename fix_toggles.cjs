const fs = require('fs');

function replaceInFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');

    content = content.replace(/useRenovationARV/g, 'renovationARVToggle');
    content = content.replace(/useNewConstructionARV/g, 'newConstructionARVToggle');

    fs.writeFileSync(filePath, content);
    console.log("Updated", filePath);
}

replaceInFile('types.ts');
replaceInFile('App.tsx');
replaceInFile('components/Deals/EditDealModal.tsx');
replaceInFile('components/Deals/EditWholesalerDealModal.tsx');
