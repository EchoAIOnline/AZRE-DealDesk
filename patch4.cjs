const fs = require('fs');
let code = fs.readFileSync('services/api.ts', 'utf8');

const regex = /let \{ data, error \} = await supabase\.from\(table\)\.upsert\(payload\)\.select\(\)\.single\(\);/g;
code = code.replace(regex, `
let { data, error } = await supabase.from(table).upsert(payload).select().single();
if (table === 'Deals') {
    console.log("Upsert response data:", data);
}
`);

fs.writeFileSync('services/api.ts', code);
