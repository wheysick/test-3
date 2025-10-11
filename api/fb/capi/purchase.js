// /api/meta/capi.js
// ===== Conversions API — v1.0 (browser+server dedupe) =====
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const body = await readJson(req);
    const {
      event = 'Purchase',
      event_id,
      value = 0,
      currency = 'USD',
      contents = [],
      order_id = null
    } = body || {};

    const PIXEL_ID = process.env.META_PIXEL_ID || '1051611783243364';
    const ACCESS_TOKEN = process.env.META_CAPI_TOKEN;
    const TEST_CODE = process.env.META_TEST_CODE || null;

    if (!ACCESS_TOKEN) return res.status(500).json({ error: 'Missing META_CAPI_TOKEN' });

    const endpoint = `https://graph.facebook.com/v20.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;

    const ip  = (req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket?.remoteAddress || '';
    const ua  = req.headers['user-agent'] || '';
    const url = (req.headers['referer'] || req.headers['origin'] || '') || '';

    const payload = {
      data: [{
        event_name: event,
        event_time: Math.floor(Date.now()/1000),
        event_source_url: url,
        action_source: 'website',
        event_id,
        user_data: {
          client_ip_address: ip,
          client_user_agent: ua
        },
        custom_data: {
          value: Number(value || 0),
          currency,
          contents,
          order_id,
          content_type: 'product'
        }
      }],
      // Include test_event_code only in Test Events mode
      ...(TEST_CODE ? { test_event_code: TEST_CODE } : {})
    };

    const fb = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });

    const resp = await fb.json().catch(()=>null);
    if (!fb.ok) return res.status(fb.status).json(resp || { error: 'CAPI error' });

    res.status(200).json({ ok:true, event_id, fb: resp });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Server error' });
  }
}

async function readJson(req){
  if (req.body && typeof req.body === 'object') return req.body;
  let s=''; for await (const c of req) s+=c;
  return s ? JSON.parse(s) : {};
}
