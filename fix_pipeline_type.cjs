const fs = require('fs');
let code = fs.readFileSync('services/api.ts', 'utf8');
code = code.replace(
    /processed\.pipelineType = tableName === 'JVDeals' \? 'jv' : 'main';/,
    '// processed.pipelineType = tableName === \'JVDeals\' ? \'jv\' : \'main\'; // DO NOT OVERWRITE pipelineType'
);
fs.writeFileSync('services/api.ts', code);
