const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(/\\\`\\\$\\\{month\\\}\\/g, '`${month}/');
content = content.replace(/dateStr = \\\`\\\$\\\{month\\\}\\/g, 'dateStr = `${month}/');

// Just replace everything
content = content.replace(/\\\`/g, '`');
content = content.replace(/\\\\\$/g, '$');

fs.writeFileSync('server.ts', content);
console.log("Fixed server.ts string literal syntax");
