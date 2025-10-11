import crypto from 'crypto';

export const config = { api: { bodyParser: false } }; // raw body for signature

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const signature = req.headers['x-cc-webhook-signature'];
    const secret = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET || '';
    const chunks=[]; for await (const ch of req) chunks.push(ch);
    const raw = Buffer.concat(chunks);
    const h = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    if (!signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(h))) {
      return res.status(400).send('invalid signature');
    }
    const event = JSON.parse(raw.toString('utf8'));
    // TODO: on event.type === 'charge:confirmed' -> mark order paid/fulfillment ready
    res.status(200).json({ ok:true });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Server error' });
  }
}
