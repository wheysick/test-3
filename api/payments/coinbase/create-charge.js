export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const body = await readJson(req);
    const { qty = 1, email = '', meta = {} } = body || {};

    const origin =
      process.env.PUBLIC_BASE_URL ||
      req.headers.origin ||
      (req.headers['x-forwarded-proto'] && req.headers.host
        ? `${req.headers['x-forwarded-proto']}://${req.headers.host}`
        : (req.headers.host ? `https://${req.headers.host}` : 'https://example.com'));

    if (!process.env.COINBASE_COMMERCE_API_KEY) {
      return res.status(500).json({ error: 'Missing COINBASE_COMMERCE_API_KEY' });
    }

    // Recompute amount server-side
    const PRICE = 90, TAX_RATE = 0.0874, ALT_DISC = 0.15;
    const merch = qty * PRICE;
    const disc = +(merch * ALT_DISC).toFixed(2);
    const taxable = Math.max(0, merch - disc);
    const tax = +(taxable * TAX_RATE).toFixed(2);
    const total = (taxable + tax).toFixed(2);

    const payload = {
      name: 'Tirzepatide Bundle',
      description: `${qty} paid + ${qty} free`,
      pricing_type: 'fixed_price',
      local_price: { amount: total, currency: 'USD' },
      metadata: { ...meta, email, qty },
      redirect_url: `${origin}/thank-you.html?m=crypto`,
      cancel_url: `${origin}/checkout?m=crypto`
    };

    const r = await fetch('https://api.commerce.coinbase.com/charges', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CC-Api-Key': process.env.COINBASE_COMMERCE_API_KEY,
        'X-CC-Version': '2018-03-22'
      },
      body: JSON.stringify(payload)
    });
    const d = await r.json().catch(()=>null);
    if (!r.ok || !d?.data?.hosted_url) {
      return res.status(r.status || 500).json({ error: d?.error?.message || 'Failed to create charge' });
    }
    res.status(200).json({ hosted_url: d.data.hosted_url, charge_code: d.data.code });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Server error' });
  }
}

async function readJson(req){ if (req.body && typeof req.body==='object') return req.body;
  let s=''; for await (const c of req) s+=c; return s?JSON.parse(s):{}; }
