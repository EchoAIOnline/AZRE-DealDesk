import { GoogleGenAI, Type } from "@google/genai";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { SESClient, SendEmailCommand, SendRawEmailCommand } from "@aws-sdk/client-ses";

// Initialize SES client lazily
let sesClient: SESClient | null = null;

function sanitizeRegion(region: string): string {
  if (!region) return "us-east-2";
  const r = region.toLowerCase();
  if (r.includes('ohio')) return 'us-east-2';
  if (r.includes('virginia')) return 'us-east-1';
  if (r.includes('california')) return 'us-west-1';
  if (r.includes('oregon')) return 'us-west-2';
  const match = r.match(/([a-z]{2}-[a-z]+-\d+)/);
  if (match) return match[1];
  return region.trim();
}

function getSESClient(): SESClient {
  if (!sesClient) {
    const region = process.env.APP_AWS_REGION || process.env.AWS_REGION || "us-east-2";
    const config: any = {
      region: sanitizeRegion(region),
    };
    
    const accessKeyId = process.env.APP_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.APP_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
    
    if (accessKeyId && secretAccessKey) {
      config.credentials = {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      };
      // Only use session token if it's explicitly provided via APP_ env var to avoid picking up Vercel's token
      if (process.env.APP_AWS_SESSION_TOKEN) {
        config.credentials.sessionToken = process.env.APP_AWS_SESSION_TOKEN;
      } else if (process.env.AWS_SESSION_TOKEN && !process.env.APP_AWS_ACCESS_KEY_ID) {
        // If falling back to AWS_ACCESS_KEY_ID, also fallback to AWS_SESSION_TOKEN
        config.credentials.sessionToken = process.env.AWS_SESSION_TOKEN;
      }
    } else {
      console.warn("AWS credentials missing from environment variables. Relying on default AWS provider chain.");
    }
    
    sesClient = new SESClient(config);
  }
  return sesClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set Permissions-Policy header to allow Geolocation
  app.use((_req, res, next) => {
    res.setHeader("Permissions-Policy", "geolocation=(self)");
    next();
  });

  // Middleware to parse JSON bodies
  app.use(express.json({ limit: "50mb" }));

  // API route for Zillow Scraper (BrightData)
  app.post("/api/test-timeout", async (req, res) => {
    await new Promise(resolve => setTimeout(resolve, 65000));
    res.json({ status: 'success' });
  });

  app.post("/api/zillow-data", async (req, res) => {
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
      let endpoint = `https://api.brightdata.com/dca/trigger?collector=${collectorId}&sync=true`;
      let payload: any = [{ url }];
      
      if (isDataset) {
          endpoint = `https://api.brightdata.com/datasets/v3/scrape?dataset_id=${collectorId}&include_errors=true&discover_new=true`;
          payload = { input: [{ url }], limit_per_input: null };
      }

      // Trigger BrightData scraper synchronously
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      let result;
      const textResponse = await response.text();
      try {
          result = JSON.parse(textResponse);
      } catch (err) {
          return res.status(response.status).json({ 
              status: 'error', 
              message: `BrightData API Error: ${textResponse}` 
          });
      }
      
      if (!response.ok) {
         return res.status(response.status).json({ status: 'error', message: result.error || result.message || 'Failed to scrape Zillow via BrightData' });
      }

      let parsedData = Array.isArray(result) ? result : (result.data || [result]);
      
      parsedData = parsedData.map((item: any) => {
          if (item.address && typeof item.address === 'object') {
              const a = item.address;
              item.address = `${a.streetAddress || ''}, ${a.city || ''}, ${a.state || ''} ${a.zipcode || ''}`.replace(/^, /, '').trim();
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

          // Extract Comps
          if (Array.isArray(item.homeValuation) && item.homeValuation.length > 0) {
              try {
                  const hv = typeof item.homeValuation[0] === 'string' ? JSON.parse(item.homeValuation[0]) : item.homeValuation[0];
                  if (hv && hv.comparables && Array.isArray(hv.comparables.comps)) {
                      const comps = hv.comparables.comps;
                      const soldComps = comps.filter((c: any) => c.property && c.property.homeStatus === 'RECENTLY_SOLD');
                      soldComps.sort((a: any, b: any) => (b.property.dateSold || 0) - (a.property.dateSold || 0));
                      
                                            item.mappedComps = soldComps.map((c: any) => {
                          const p = c.property;
                          let dateStr = '';
                          if (p.dateSold) {
                              const d = new Date(p.dateSold);
                              // Format as MM/DD/YYYY
                              const month = String(d.getUTCMonth() + 1).padStart(2, '0');
                              const day = String(d.getUTCDate()).padStart(2, '0');
                              const year = d.getUTCFullYear();
                              dateStr = `${month}/${day}/${year}`;
                          }
                          return {
                              address: p.address ? `${p.address.streetAddress || ''}, ${p.address.city || ''}, ${p.address.state || ''} ${p.address.zipcode || ''}`.replace(/^, /, '').trim() : '',
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
      });

      res.json({ status: 'success', data: parsedData });
    } catch (e: any) {
      console.error("Error scraping Zillow:", e);
      res.status(500).json({ status: 'error', message: e.message || 'Unknown server error' });
    }
  });

  // API route for email
  app.post("/api/send-email", async (req, res) => {
    try {
      const { action, data } = req.body;
      
      if (action !== 'send_bulk_email' || !data) {
        return res.status(400).json({ status: 'error', message: 'Invalid payload' });
      }

      const { recipients, subject, body, fromAddress } = data;

      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ status: 'error', message: 'Missing recipients' });
      }

      const client = getSESClient();
      
      // Determine sender. Fallback to env var or a hardcoded string if neither is provided.
      const sender = fromAddress || process.env.AWS_SES_FROM_ADDRESS;
      if (!sender) {
         return res.status(400).json({ status: 'error', message: 'Sender (fromAddress) is required' });
      }

      // Send to each recipient. In a real bulk scenario, you might use SendBulkTemplatedEmail
      // but to keep it simple and compatible, we'll loop through recipients.
      const results = [];
      for (const recipient of recipients) {
        const toAddress = recipient.email;
        if (!toAddress) continue;
        
        try {
          const command = new SendEmailCommand({
            Source: sender,
            Destination: {
              ToAddresses: [toAddress],
            },
            Message: {
              Subject: { Data: subject },
              Body: {
                Html: { Data: body }, // Assume body is HTML
              },
            },
          });
          const response = await client.send(command);
          results.push({ email: toAddress, status: 'success', messageId: response.MessageId });
        } catch (err: any) {
          console.error(`Failed to send email to ${toAddress}:`, err);
          results.push({ email: toAddress, status: 'error', error: err.message });
        }
      }

      // If all failed, throw an error
      const allFailed = results.length > 0 && results.every(r => r.status === 'error');
      if (allFailed) {
         return res.status(500).json({ status: 'error', message: `Failed to send emails: ${results[0]?.error}` });
      }

      res.json({ status: 'success', results });
    } catch (e: any) {
      console.error("Error sending email via SES:", e);
      res.status(500).json({ status: 'error', message: e.message || 'Unknown server error' });
    }
  });

  
// --- Microsoft OAuth Setup ---
const MS_TENANT = 'common';
const MS_CLIENT_ID = process.env.MS_CLIENT_ID || '';
const MS_CLIENT_SECRET = process.env.MS_CLIENT_SECRET || '';

// In-memory store for tokens (for single-user demo purposes)
let msAccessToken: string | null = null;
let msRefreshToken: string | null = null;

app.get('/api/auth/microsoft/url', (req, res) => {
  const redirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/auth/callback`;
  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: 'offline_access Mail.Read',
  });
  const authUrl = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/authorize?${params.toString()}`;
  res.json({ url: authUrl });
});

app.get('/api/auth/microsoft/status', (req, res) => {
  res.json({ connected: !!msAccessToken });
});

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  const redirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/auth/callback`;

  try {
    if (code) {
      const tokenResponse = await fetch(`https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: MS_CLIENT_ID,
          client_secret: MS_CLIENT_SECRET,
          code: code as string,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }).toString(),
      });
      const tokenData = await tokenResponse.json();
      if (tokenData.access_token) {
        msAccessToken = tokenData.access_token;
        msRefreshToken = tokenData.refresh_token || null;
      }
    }
  } catch (err) {
    console.error('Error exchanging code:', err);
  }

  res.send(`
    <html>
      <body>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
            window.close();
          } else {
            window.location.href = '/';
          }
        </script>
        <p>Authentication complete. This window should close automatically.</p>
      </body>
    </html>
  `);
});

// Fetch emails from Graph API
app.get('/api/emails/acquisitions', async (req, res) => {
  if (!msAccessToken) {
    return res.status(401).json({ error: 'Not connected to Microsoft' });
  }
  try {
    // Fetch top 50 emails
    const response = await fetch('https://graph.microsoft.com/v1.0/me/messages?$top=50&$select=id,subject,bodyPreview,receivedDateTime,from', {
      headers: {
        'Authorization': `Bearer ${msAccessToken}`
      }
    });
    
    if (response.status === 401) {
      msAccessToken = null; // Token expired
      return res.status(401).json({ error: 'Token expired' });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Error fetching emails:', err);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

    // Gemini Comps endpoint
  app.post("/api/gemini/comps", async (req, res) => {
    try {
      const { address, sqft, beds, baths } = req.body;
      if (!address) {
        return res.status(400).json({ status: 'error', message: 'Address is required' });
      }

      const apiKey = process.env.GEMINI_API_KEY_2;
      if (!apiKey) {
        return res.status(500).json({ status: 'error', message: 'GEMINI_API_KEY is not configured on the server.' });
      }

      const ai = new GoogleGenAI({ apiKey });

      const prompt = `Address: ${address}
Square Footage: ${sqft || 'Unknown'}
Bedrooms: ${beds || 'Unknown'}
Bathrooms: ${baths || 'Unknown'}

Find 3 closed, on-market retail MLS sales, After Repaired Comparable sales within 2026 that match this property’s Square footage within 300 sqft larger or smaller, bedrooms and bathroom that is no more then 1 mile away from the subject property. Give me the comps that are in the highest price ranges. Can this be acheaved?`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                address: { type: Type.STRING },
                sqft: { type: Type.INTEGER },
                saleDate: { type: Type.STRING, description: "Format as MM/DD/YYYY" },
                salePrice: { type: Type.NUMBER }
              },
              required: ["address", "sqft", "saleDate", "salePrice"]
            }
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("No text generated");
      const comps = JSON.parse(text);

      res.json({ status: 'success', data: comps });
    } catch (err: any) {
      console.error("Error from Gemini API:", err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
// Trigger Vercel deployment: Tue Aug 25 01:12:41 AM UTC 2026
