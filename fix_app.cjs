const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');

content = content.replace(/renovationARV: 0,\n          renovationARV: true,/g, 'renovationARV: 0,\n          useRenovationARV: true,');
content = content.replace(/newConstructionARV: 0,\n          newConstructionARV: false,/g, 'newConstructionARV: 0,\n          useNewConstructionARV: false,');

fs.writeFileSync('App.tsx', content);
console.log("Fixed App");
