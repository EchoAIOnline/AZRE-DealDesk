const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const newZillowLogic = `
  app.post("/api/scrape-zillow", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ status: 'error', message: 'URL is required' });
      }

      const apiKey = process.env.BRIGHTDATA_API_KEY || "008b1060-0915-4386-b2d1-b84270cbd5b9";
      const collectorId = process.env.BRIGHTDATA_COLLECTOR_ID;

      if (!collectorId) {
        return res.status(400).json({ 
            status: 'error', 
            message: 'To use this feature, please create a Zillow Web Scraper in BrightData, and add your Collector ID to the BRIGHTDATA_COLLECTOR_ID environment variable in .env' 
        });
      }

      const isDataset = collectorId.startsWith('gd_');
      let endpoint = \`https://api.brightdata.com/dca/trigger?collector=\${collectorId}&sync=true\`;
      let payload = [{ url }];
      
      if (isDataset) {
          endpoint = \`https://api.brightdata.com/datasets/v3/scrape?dataset_id=\${collectorId}&include_errors=true\`;
      }

      // Trigger BrightData scraper synchronously
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': \`Bearer \${apiKey}\`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(isDataset ? { input: payload, limit_per_input: null } : payload)
      });

      const result = await response.json();
      
      if (!response.ok) {
         return res.status(response.status).json({ status: 'error', message: result.error || 'Failed to scrape Zillow via BrightData' });
      }

      let parsedData = Array.isArray(result) ? result : (result.data || [result]);
      
      parsedData = parsedData.map((item: any) => {
          if (item.address && typeof item.address === 'object') {
              const a = item.address;
              item.address = \`\${a.streetAddress || ''}, \${a.city || ''}, \${a.state || ''} \${a.zipcode || ''}\`.replace(/^, /, '').trim();
          }
          return item;
      });

      res.json({ status: 'success', data: parsedData });
    } catch (e: any) {
      console.error("Error scraping Zillow:", e);
      res.status(500).json({ status: 'error', message: e.message || 'Unknown server error' });
    }
  });
`;

code = code.replace(/app\.post\("\/api\/scrape-zillow"[\s\S]*?(?=app\.post\("\/api\/send-email"\))/, newZillowLogic + "  ");

fs.writeFileSync('server.ts', code);
