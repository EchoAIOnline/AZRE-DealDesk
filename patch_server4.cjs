const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf8');

const target = `      parsedData = parsedData.map((item: any) => {
          if (item.address && typeof item.address === 'object') {
              const a = item.address;
              item.address = \`\${a.streetAddress || ''}, \${a.city || ''}, \${a.state || ''} \${a.zipcode || ''}\`.replace(/^, /, '').trim();
          }
          return item;
      });`;

const replacement = `      parsedData = parsedData.map((item: any) => {
          if (item.address && typeof item.address === 'object') {
              const a = item.address;
              item.address = \`\${a.streetAddress || ''}, \${a.city || ''}, \${a.state || ''} \${a.zipcode || ''}\`.replace(/^, /, '').trim();
          }

          // Extract photos
          if (Array.isArray(item.photos)) {
              item.mappedPhotos = item.photos.map((p: any) => {
                  if (p.mixedSources && p.mixedSources.jpeg && p.mixedSources.jpeg.length > 0) {
                      return p.mixedSources.jpeg[p.mixedSources.jpeg.length - 1].url;
                  }
                  return null;
              }).filter((url: any) => url);
          }

          // Extract Agent info
          const attr = item.attributionInfo || {};
          const provided = item.listing_provided_by || {};
          item.mappedAgentName = attr.agentName || provided.name || null;
          item.mappedAgentPhone = attr.agentPhoneNumber || provided.phone || null;
          item.mappedAgentBrokerage = attr.brokerName || provided.brokerage || null;
          item.mappedAgentBrokerPhone = attr.brokerPhoneNumber || provided.brokerPhoneNumber || null;

          // MLS & Listing Type
          item.mappedMlsNumber = attr.mlsId || item.mls_id || null;
          if (item.mappedMlsNumber) {
              item.mappedListingType = 'Listed On MLS';
          } else {
              item.mappedListingType = 'Off-Market';
          }

          // Days on Zillow -> Date Listed
          if (typeof item.daysOnZillow === 'number') {
              const dateListed = new Date();
              dateListed.setDate(dateListed.getDate() - item.daysOnZillow);
              item.mappedDateListed = dateListed.toISOString().split('T')[0];
          }

          return item;
      });`;

if (content.includes(target)) {
    fs.writeFileSync('server.ts', content.replace(target, replacement));
    console.log("Patched server.ts successfully");
} else {
    console.log("Target not found");
}
