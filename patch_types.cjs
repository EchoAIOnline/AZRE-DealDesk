const fs = require('fs');
const content = fs.readFileSync('types.ts', 'utf8');

if (content.includes('agentBrokerage: string;') && !content.includes('agentBrokerPhone?: string;')) {
    fs.writeFileSync('types.ts', content.replace('agentBrokerage: string;', 'agentBrokerage: string;\n  agentBrokerPhone?: string;'));
    console.log("Patched types.ts");
} else {
    console.log("Not needed or already patched");
}
