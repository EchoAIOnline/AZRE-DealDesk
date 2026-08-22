const fs = require('fs');
let content = fs.readFileSync('types.ts', 'utf8');

content = content.replace(/renovationARV\?: boolean;\n  renovationARVAmount\?: number;/g, 'useRenovationARV?: boolean;\n  renovationARV?: number;');
content = content.replace(/newConstructionARV\?: boolean;\n  newConstructionARVAmount\?: number;/g, 'useNewConstructionARV?: boolean;\n  newConstructionARV?: number;');
content = content.replace(/renovationARV\?: number;\s*renovationARV\?: number;/g, 'useRenovationARV?: boolean;\n  renovationARV?: number;');
content = content.replace(/newConstructionARV\?: number;\s*newConstructionARV\?: number;/g, 'useNewConstructionARV?: boolean;\n  newConstructionARV?: number;');
fs.writeFileSync('types.ts', content);
console.log("Fixed types");
