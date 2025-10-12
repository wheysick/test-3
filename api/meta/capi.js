// /api/meta/capi.js  (Node.js Runtime on Vercel)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const {
      event, event_id, value = 0, currency = 'USD',
      contents = [], order_id, email, fbp, fbc
    } = req.body || {};

    const PIXEL_ID = process.env.META_PIXEL_ID || '1051611783243364';
    const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
    if (!ACCESS_TOKEN) return res.status(500).json({ error: 'Missing META_ACCESS_TOKEN' });

    // Build user_data
    const crypto = await import('crypto');
    const sha256 = (s) =>
      crypto.createHash('sha256').update(String(s || '').trim().toLowerCase()).digest('hex');

    const user_data = {
      client_ip_address: (req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket?.remoteAddress || undefined,
      client_user_agent: req.headers['user-agent'] || undefined
    };
    if (email) user_data.em = sha256(email);
    if (fbp) user_data.fbp = fbp;
    if (fbc) user_data.fbc = fbc;

    const serverEvent = {
      event_name: event,
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      event_id,
      event_source_url: req.headers.referer || undefined,
      user_data,
      custom_data: { value, currency, contents, order_id }
    };

    const payload = { data: [serverEvent] };
    if (process.env.META_TEST_EVENT_CODE) payload.test_event_code = process.env.META_TEST_EVENT_CODE;

    const url = `https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });

    // Return body on error to help Events Manager diagnostics (but no console logging)
    if (!resp.ok) return res.status(resp.status).send(await resp.text());
    return res.status(204).end();
  } catch (err) {
    return res.status(500).json({ error: 'CAPI handler failed' });
  }
}
