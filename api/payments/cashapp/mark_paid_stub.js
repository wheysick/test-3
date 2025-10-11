export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const body = await readJson(req);
    const { order_id, amount, cashtag, email, qty, meta } = body || {};
    if (!order_id || !amount) return res.status(400).json({ error: 'Missing order_id or amount' });
    // TODO: persist to DB / notify ops (Slack/Email) for manual verify
    console.log('[cashapp:mark-paid]', { order_id, amount, cashtag, email, qty, meta });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Server error' });
  }
}
async function readJson(req){ if (req.body && typeof req.body==='object') return req.body;
  let s=''; for await (const c of req) s+=c; return s?JSON.parse(s):{}; }
