const fs = require('fs');
let code = fs.readFileSync('services/api.ts', 'utf8');

const regex = /\/\/\s*Fallback for documents if the column doesn't exist yet[\s\S]*?payload\.documents\.forEach[\s\S]*?\}\);[\s\S]*?\}/g;

code = code.replace(regex, '');

fs.writeFileSync('services/api.ts', code);
