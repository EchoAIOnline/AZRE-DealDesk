const fs = require('fs');
let code = fs.readFileSync('components/Deals/EditDealModal.tsx', 'utf8');
code = code.replace(
`                if (zData.error) {
                    setZillowError(zData.error);
                    setZillowLoading(false);
                    return;
                }`,
`                if (zData.error) {
                    setZillowError(zData.error);
                    setZillowLoading(false);
                    return;
                }
                
                if (zData.snapshot_id) {
                    setZillowError("The scrape is taking longer than expected and is queued. Please wait a minute and try again, or check BrightData dashboard.");
                    setZillowLoading(false);
                    return;
                }`
);
fs.writeFileSync('components/Deals/EditDealModal.tsx', code);
