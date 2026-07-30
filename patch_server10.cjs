const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(/\\\$\{month\}/g, '${month}');
content = content.replace(/\\\$\{day\}/g, '${day}');
content = content.replace(/\\\$\{year\}/g, '${year}');

fs.writeFileSync('server.ts', content);
console.log("Fixed server.ts interpolation again");
