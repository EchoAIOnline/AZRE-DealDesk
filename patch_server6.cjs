const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf8');

const target = `                      item.mappedComps = soldComps.slice(0, 3).map((c: any) => {
                          const p = c.property;
                          let dateStr = '';
                          if (p.dateSold) {
                              const d = new Date(p.dateSold);
                              // Format as YYYY-MM-DD
                              dateStr = d.toISOString().split('T')[0];
                          }
                          return {
                              address: p.address ? \\\`\\\${\\p.address.streetAddress || ''}, \\\${\\p.address.city || ''}, \\\${\\p.address.state || ''} \\\${\\p.address.zipcode || ''}\\\`.replace(/^, /, '').trim() : '',
                              salePrice: p.lastSoldPrice || p.price || 0,
                              saleDate: dateStr,
                              sqft: p.livingAreaValue || p.livingArea || 0
                          };
                      });`;

const replacement = `                      item.mappedComps = soldComps.map((c: any) => {
                          const p = c.property;
                          let dateStr = '';
                          if (p.dateSold) {
                              const d = new Date(p.dateSold);
                              // Format as MM/DD/YYYY
                              const month = String(d.getUTCMonth() + 1).padStart(2, '0');
                              const day = String(d.getUTCDate()).padStart(2, '0');
                              const year = d.getUTCFullYear();
                              dateStr = \\\`\\\${month}/\\\${day}/\\\${year}\\\`;
                          }
                          return {
                              address: p.address ? \\\`\\\${\\p.address.streetAddress || ''}, \\\${\\p.address.city || ''}, \\\${\\p.address.state || ''} \\\${\\p.address.zipcode || ''}\\\`.replace(/^, /, '').trim() : '',
                              salePrice: p.lastSoldPrice || p.price || 0,
                              saleDate: dateStr,
                              sqft: p.livingAreaValue || p.livingArea || 0
                          };
                      });`;

if (content.indexOf("item.mappedComps = soldComps.slice(0, 3).map((c: any) => {") !== -1) {
    // using split and join to replace to avoid regex string escape issues
    let startIdx = content.indexOf("item.mappedComps = soldComps.slice(0, 3).map((c: any) => {");
    let endIdx = content.indexOf("});", startIdx) + 3;
    let textToReplace = content.substring(startIdx, endIdx);
    
    fs.writeFileSync('server.ts', content.replace(textToReplace, replacement.replace(/\\\\\\`/g, '\`').replace(/\\\\\$/g, '$').replace(/\\\\p/g, 'p')));
    console.log("Patched server.ts successfully");
} else {
    console.log("Target not found");
}
