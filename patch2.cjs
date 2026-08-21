const fs = require('fs');
let serverCode = fs.readFileSync('server.ts', 'utf8');
serverCode = serverCode.replace('app.post("/api/scrape-zillow"', 'app.post("/api/zillow-data"');
fs.writeFileSync('server.ts', serverCode);

let clientCode = fs.readFileSync('components/Deals/EditDealModal.tsx', 'utf8');
clientCode = clientCode.replaceAll('/api/scrape-zillow', '/api/zillow-data');
fs.writeFileSync('components/Deals/EditDealModal.tsx', clientCode);
