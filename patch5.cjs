const fs = require('fs');
let code = fs.readFileSync('services/api.ts', 'utf8');

code = code.replace(
    /missingColumns\.push\(missingColumn\);\n\s*delete payload\[missingColumn\];/g,
    `
    if (missingColumn === 'documents') {
        console.error("FATAL: Supabase is complaining about missing 'documents' column. Schema cache needs reload.");
        break; // Do not strip documents, let it fail so user knows
    }
    missingColumns.push(missingColumn);
    delete payload[missingColumn];
    `
);

fs.writeFileSync('services/api.ts', code);
