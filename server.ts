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
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.warn("AWS credentials missing. Email sending will fail.");
    }
    sesClient = new SESClient({
      region: sanitizeRegion(process.env.AWS_REGION || "us-east-2"),
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      }
    });
  }
  return sesClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON bodies
  app.use(express.json({ limit: "50mb" }));

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
