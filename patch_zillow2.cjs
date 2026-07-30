const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `      const result = await response.json();
      
      if (!response.ok) {
         return res.status(response.status).json({ status: 'error', message: result.error || 'Failed to scrape Zillow via BrightData' });
      }`;

const replacement = `      let result;
      const textResponse = await response.text();
      try {
          result = JSON.parse(textResponse);
      } catch (err) {
          return res.status(response.status).json({ 
              status: 'error', 
              message: \`BrightData API Error: \${textResponse}\` 
          });
      }
      
      if (!response.ok) {
         return res.status(response.status).json({ status: 'error', message: result.error || result.message || 'Failed to scrape Zillow via BrightData' });
      }`;

code = code.replace(target, replacement);
fs.writeFileSync('server.ts', code);
