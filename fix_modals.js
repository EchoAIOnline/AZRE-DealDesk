const fs = require('fs');
const path = require('path');

const modals = [
    'components/Settings/ImportMapModal.tsx',
    'components/Settings/ImportBuyerMapModal.tsx',
    'components/Settings/ImportWholesalerMapModal.tsx'
];

for (const modal of modals) {
    let code = fs.readFileSync(modal, 'utf8');
    if (!code.includes("import { api }")) {
        code = code.replace("import { generateId", "import { api } from '../../services/api';\nimport { generateId");
    }
    
    if (!code.includes("importProgress")) {
        code = code.replace("const [importing, setImporting] = useState(false);", "const [importing, setImporting] = useState(false);\n    const [importProgress, setImportProgress] = useState<{current: number, total: number} | null>(null);");
    }
    
    fs.writeFileSync(modal, code);
}
console.log("Imports and states added");
