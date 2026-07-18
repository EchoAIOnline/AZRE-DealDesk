const fs = require('fs');
let code = fs.readFileSync('services/api.ts', 'utf8');

const replacement = `
                if (payload.buyersWhoPassed && typeof payload.buyersWhoPassed === 'object') {
                    payload.buyersWhoPassed = JSON.stringify(payload.buyersWhoPassed);
                }
                
                // Fallback for documents if the column doesn't exist yet
                if (payload.documents && Array.isArray(payload.documents)) {
                    payload.logs = payload.logs || [];
                    payload.logs = payload.logs.filter((log) => typeof log !== 'string' || !log.startsWith('[SYS_DOC]'));
                    payload.documents.forEach((doc) => {
                        payload.logs.push(\`[SYS_DOC]\${JSON.stringify(doc)}\`);
                    });
                }
                
                // motivationSignals and documents are natively JSONB, do not map to strings
`;

code = code.replace(`
                if (payload.buyersWhoPassed && typeof payload.buyersWhoPassed === 'object') {
                    payload.buyersWhoPassed = JSON.stringify(payload.buyersWhoPassed);
                }
                
                // motivationSignals and documents are natively JSONB, do not map to strings
`.trim(), replacement.trim());

fs.writeFileSync('services/api.ts', code);
