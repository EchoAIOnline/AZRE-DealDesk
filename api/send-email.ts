import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

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
    const config: any = {
      region: sanitizeRegion(process.env.AWS_REGION || "us-east-2"),
    };
    
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      config.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
      if (process.env.AWS_SESSION_TOKEN) {
        config.credentials.sessionToken = process.env.AWS_SESSION_TOKEN;
      }
    } else {
      console.warn("AWS credentials missing from environment variables. Relying on default AWS provider chain.");
    }
    
    sesClient = new SESClient(config);
  }
  return sesClient;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }

  try {
    const { action, data } = req.body || {};
      
    if (action !== 'send_bulk_email' || !data) {
      return res.status(400).json({ status: 'error', message: 'Invalid payload' });
    }

    const { recipients, subject, body, fromAddress } = data;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Missing recipients' });
    }

    const client = getSESClient();
      
    const sender = fromAddress || process.env.AWS_SES_FROM_ADDRESS;
    if (!sender) {
       return res.status(400).json({ status: 'error', message: 'Sender (fromAddress) is required' });
    }

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
              Html: { Data: body },
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

    const allFailed = results.length > 0 && results.every(r => r.status === 'error');
    if (allFailed) {
       return res.status(500).json({ status: 'error', message: `Failed to send emails: ${results[0]?.error}` });
    }

    res.json({ status: 'success', results });
  } catch (e: any) {
    console.error("Error sending email via SES:", e);
    res.status(500).json({ status: 'error', message: e.message || 'Unknown server error' });
  }
}
