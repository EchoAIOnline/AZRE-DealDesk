const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf8');

const target = `          // Days on Zillow -> Date Listed
          if (typeof item.daysOnZillow === 'number') {
              const dateListed = new Date();
              dateListed.setDate(dateListed.getDate() - item.daysOnZillow);
              item.mappedDateListed = dateListed.toISOString().split('T')[0];
          }

          return item;
      });`;

const replacement = `          // Days on Zillow -> Date Listed
          if (typeof item.daysOnZillow === 'number') {
              const dateListed = new Date();
              dateListed.setDate(dateListed.getDate() - item.daysOnZillow);
              item.mappedDateListed = dateListed.toISOString().split('T')[0];
          }

          // Extract Comps
          if (Array.isArray(item.homeValuation) && item.homeValuation.length > 0) {
              try {
                  const hv = typeof item.homeValuation[0] === 'string' ? JSON.parse(item.homeValuation[0]) : item.homeValuation[0];
                  if (hv && hv.comparables && Array.isArray(hv.comparables.comps)) {
                      const comps = hv.comparables.comps;
                      const soldComps = comps.filter((c: any) => c.property && c.property.homeStatus === 'RECENTLY_SOLD');
                      soldComps.sort((a: any, b: any) => (b.property.dateSold || 0) - (a.property.dateSold || 0));
                      
                      item.mappedComps = soldComps.slice(0, 3).map((c: any) => {
                          const p = c.property;
                          let dateStr = '';
                          if (p.dateSold) {
                              const d = new Date(p.dateSold);
                              // Format as YYYY-MM-DD
                              dateStr = d.toISOString().split('T')[0];
                          }
                          return {
                              address: p.address ? \`\${p.address.streetAddress || ''}, \${p.address.city || ''}, \${p.address.state || ''} \${p.address.zipcode || ''}\`.replace(/^, /, '').trim() : '',
                              salePrice: p.lastSoldPrice || p.price || 0,
                              saleDate: dateStr,
                              sqft: p.livingAreaValue || p.livingArea || 0
                          };
                      });
                  }
              } catch (err) {
                  console.error('Error parsing homeValuation:', err);
              }
          }

          return item;
      });`;

if (content.includes(target)) {
    fs.writeFileSync('server.ts', content.replace(target, replacement));
    console.log("Patched server.ts successfully");
} else {
    console.log("Target not found");
}
