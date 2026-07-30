const fs = require('fs');
let code = fs.readFileSync('services/api.ts', 'utf8');

code = code.replace(`    save: async (item: any, table: string) => {
        if (isDummyClient) {
             return null;
        }`, `    save: async (item: any, table: string) => {
        if (isDummyClient) {
             return item;
        }`);

code = code.replace(`    saveBatch: async (items: any[], table: string) => {
        if (isDummyClient) {
             return null;
        }`, `    saveBatch: async (items: any[], table: string) => {
        if (isDummyClient) {
             return items;
        }`);

fs.writeFileSync('services/api.ts', code);
