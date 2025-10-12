// /api/meta/capi.js
// Conversions API — browser+server dedupe (no logs, no patches)
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  // Do not cache responses from this endpoint
  res.setHeader('Cache-Control', 'no-store');

  try {
    // Parse JSON reliably (works whether or not a body parser ran)
    const body = await readJson(req);

    // Expected fields from the client
    const {
      // Required for meaningful event
      event,                 // e.g. 'InitiateCheckout', 'AddPaymentInfo', 'Purchase'
      event_id,              // the SAME ID you sent with the browser pixel (for dedupe)

      // Common commerce fields
      value = 0,
      currency = 'USD',
      contents = [],         // [{ id, quantity, item_price }]
      order_id = null,
      content_name,
      content_category,
      content_type,          // e.g. 'product'
      num_items,

      // Match-quality helpers (optional but recommended)
      email,                 // raw email; we hash to SHA-256
      phone,                 // raw phone; we normalize then hash
      fbp,                   // _fbp cookie value
      fbc,                   // _fbc cookie value

      // Overrides (optional)
      client_ip_address,     // if you want to provide explicitly
      client_user_agent,     // if you want to provide explicitly
      event_source_url,      // override Referer if needed

      // Testing
      test_event_code
    } = body || {};

    if (!event) {
      return res.status(422).json({ error: 'Missing "event" name' });
    }

    const PIXEL_ID = process.env.META_PIXEL_ID || '1051611783243364';
    const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
    if (!ACCESS_TOKEN) {
      return res.status(500).json({ error: 'Missing META_ACCESS_TOKEN environment variable' });
    }

    // Build user_data (hashed where required)
    const ip =
      (client_ip_address && String(client_ip_address)) ||
      (req.headers['x-forwarded-for'] && String(req.headers['x-forwarded-for']).split(',')[0].trim()) ||
      req.socket?.remoteAddress ||
      undefined;

    const ua = (client_user_agent && String(client_user_agent)) || req.headers['user-agent'] || undefined;

    const crypto = await import('crypto');
    const sha256 = (s) =>
      crypto.createHash('sha256').update(String(s || '').trim().toLowerCase()).digest('hex');

    const normPhone = (p) => String(p || '').replace(/[^\d+]/g, '');

    const user_data = {
      client_ip_address: ip,
      client_user_agent: ua
    };
    if (email) user_data.em = sha256(email);
    if (phone) user_data.ph = sha256(normPhone(phone));
    if (fbp) user_data.fbp = fbp;
    if (fbc) user_data.fbc = fbc;

    // Build custom_data
    const custom_data = {
      value,
      currency,
      contents,
      order_id,
      content_name,
      content_category,
      content_type,
      num_items
    };
    // Strip undefined to keep payload clean
    Object.keys(custom_data).forEach((k) => custom_data[k] === undefined && delete custom_data[k]);

    // Build the server event
    const serverEvent = {
      event_name: event,
      event_time: Math.floor(Date.now() / 1000),
      event_id, // may be undefined; dedupe works when present
      action_source: 'website',
      event_source_url: event_source_url || req.headers.referer || undefined,
      user_data,
      custom_data
    };

    const payload = { data: [serverEvent] };
    const code = test_event_code || process.env.META_TEST_EVENT_CODE;
    if (code) payload.test_event_code = code;

    const url = `https://graph.facebook.com/v18.0/${encodeURIComponent(
      PIXEL_ID
    )}/events?access_token=${encodeURIComponent(ACCESS_TOKEN)}`;

    const fb = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!fb.ok) {
      // Bubble up the exact FB error response to aid diagnostics
      const text = await fb.text().catch(() => '');
      return res.status(fb.status).send(text || 'CAPI error');
    }

    // All good — no body needed
    return res.status(204).end();
  } catch (err) {
    return res.status(500).json({ error: 'CAPI handler failed' });
  }
}

// Minimal JSON reader that works in Vercel Node functions
async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let s = '';
  for await (const chunk of req) s += chunk;
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
