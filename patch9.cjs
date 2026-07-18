const fs = require('fs');
let code = fs.readFileSync('components/Deals/EditDealModal.tsx', 'utf8');

code = code.replace(
    'if (!window.confirm("Delete this document?")) return;',
    '// window.confirm removed for iframe compatibility'
);

fs.writeFileSync('components/Deals/EditDealModal.tsx', code);
