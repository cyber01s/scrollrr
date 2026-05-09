import app from '../server';

export default (req: any, res: any) => {
  if (process.env.VERCEL) {
    console.log(`[API Proxy] Request for: ${req.url}`);
  }
  return app(req, res);
};
