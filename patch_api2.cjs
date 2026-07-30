const fs = require('fs');
let code = fs.readFileSync('services/api.ts', 'utf8');

code = code.replace(`    delete: async (id: string, table: string) => {
        if (isDummyClient) {
             return false;
        }`, `    delete: async (id: string, table: string) => {
        if (isDummyClient) {
             return true;
        }`);

fs.writeFileSync('services/api.ts', code);
