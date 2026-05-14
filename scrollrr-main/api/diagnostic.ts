import { IncomingMessage } from 'http';

interface VercelRequest extends IncomingMessage {
  query?: Record<string, string | string[]>;
  body?: any;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (data: any) => void;
  setHeader: (key: string, value: string) => VercelResponse;
  end: () => void;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Diagnostic info
  const diagnostics = {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    credentials: {
      hasImpactAccountSid: !!process.env.IMPACT_ACCOUNT_SID,
      hasImpactAuthToken: !!process.env.IMPACT_AUTH_TOKEN,
      hasImpactProgramId: !!process.env.IMPACT_PROGRAM_ID,
      impactAccountSidLength: (process.env.IMPACT_ACCOUNT_SID || '').length,
      impactAuthTokenLength: (process.env.IMPACT_AUTH_TOKEN || '').length,
      impactProgramIdLength: (process.env.IMPACT_PROGRAM_ID || '').length,
    },
    status: {
      credentialsComplete: !!(
        process.env.IMPACT_ACCOUNT_SID &&
        process.env.IMPACT_AUTH_TOKEN &&
        process.env.IMPACT_PROGRAM_ID
      ),
      message: process.env.IMPACT_ACCOUNT_SID && process.env.IMPACT_AUTH_TOKEN && process.env.IMPACT_PROGRAM_ID
        ? '✅ All credentials configured'
        : '❌ Missing Impact.com credentials - set IMPACT_ACCOUNT_SID, IMPACT_AUTH_TOKEN, IMPACT_PROGRAM_ID in Vercel Environment Variables'
    }
  };

  return res.status(200).json(diagnostics);
}
