const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');
content = content.replace(/\\\$\{\\p/g, '${p');
fs.writeFileSync('server.ts', content);
console.log("Fixed server.ts syntax");
