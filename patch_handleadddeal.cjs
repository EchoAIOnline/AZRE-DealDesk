const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');
code = code.replace(`  const handleAddDeal = async (overrides?: Partial<Deal>) => {`, `  const handleAddDeal = async (overrides?: Partial<Deal>) => { console.log('handleAddDeal called');`);
code = code.replace(`      try {
        const tableName = isJv ? 'JVDeals' : 'Deals';`, `      try {
        const tableName = isJv ? 'JVDeals' : 'Deals'; console.log('Adding deal:', newDealInit);`);
code = code.replace(`        if (savedRecord) {`, `        if (savedRecord) { console.log('Deal saved:', savedRecord);`);
code = code.replace(`      } catch (error) {
        console.error("Error creating deal:", error);`, `      } catch (error) {
        console.error("Error creating deal:", error);`);
fs.writeFileSync('App.tsx', code);
