// /api/webhooks/coinbase.js
const crypto = require('crypto');

function text(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain');
  res.end(body);
}

// Helper: get raw body (works in Vercel Node functions)
// If you're on Next.js API routes, set: export const config = { api: { bodyParser: false } }
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    try {
      let data = [];
      req.on('data', c => data.push(c));
      req.on('end', () => resolve(Buffer.concat(data)));
      req.on('error', reject);
    } catch (e) { reject(e); }
  });
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return text(res, 405, 'Method Not Allowed');
    }
    const secret = process.env.COINBASE_WEBHOOK_SECRET;
    if (!secret) return text(res, 500, 'Missing COINBASE_WEBHOOK_SECRET');

    const signature = req.headers['x-cc-webhook-signature'];
    const raw = await getRawBody(req);

    const digest = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    if (digest !== signature) return text(res, 400, 'Invalid signature');

    const evt = JSON.parse(raw.toString('utf8'));
    const type = evt?.type || '';
    const data = evt?.data || {};

    // TODO: look up your order by data.id or data.metadata
    // const order = await db.findByChargeId(data.id)

    if (type === 'charge:pending') {
      // Payment detected but not confirmed
      // await db.update(orderId, { status: 'pending' });
    } else if (type === 'charge:confirmed' || type === 'charge:resolved') {
      // Funds confirmed — fulfill!
      // await db.update(orderId, { status: 'paid' });
      // queue email + shipping
    } else if (type === 'charge:failed') {
      // await db.update(orderId, { status: 'failed' });
    }

    return text(res, 200, 'ok');
  } catch (e) {
    return text(res, 500, e?.message || 'error');
  }
};

// If using Next.js API routes, also export:
// export const config = { api: { bodyParser: false } };
