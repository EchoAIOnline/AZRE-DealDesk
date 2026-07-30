const fs = require('fs');
let code = fs.readFileSync('components/Deals/EditDealModal.tsx', 'utf8');

const target = `            if (result.data && result.data.length > 0) {
                const zData = result.data[0];
                const updates: Partial<Deal> = {};`;

const replacement = `            if (result.data && result.data.length > 0) {
                const zData = result.data[0];
                
                if (zData.error) {
                    setZillowError(zData.error);
                    setZillowLoading(false);
                    return;
                }
                
                const updates: Partial<Deal> = {};`;

code = code.replace(target, replacement);
fs.writeFileSync('components/Deals/EditDealModal.tsx', code);
