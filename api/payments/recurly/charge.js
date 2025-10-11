// ===== /api/payments/recurly/charge.js — v2.3 FINAL (token-only billingInfo) =====
const { Client } = require('recurly');

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function parseError(e) {
  let payload = null;
  try {
    payload =
      e && e.body && typeof e.body === 'string'
        ? JSON.parse(e.body)
        : (e && e.body) || null;
  } catch {}

  const message =
    (payload && payload.error && payload.error.message) ||
    e?.message ||
    'Payment failed';
  const params = (payload && payload.error && payload.error.params) || [];
  const errors = Array.isArray(params)
    ? params
        .map((p) =>
          p?.param ? `${p.param}: ${p.message}` : p?.message
        )
        .filter(Boolean)
    : [];
  return { status: e?.status || 422, message, errors, raw: payload || e };
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return json(res, 405, { error: 'Method Not Allowed' });
    }

    const apiKey = process.env.RECURLY_API_KEY;
    if (!apiKey) {
      return json(res, 500, {
        error: 'Server not configured: missing RECURLY_API_KEY env var',
      });
    }

    let body = {};
    try {
      body =
        typeof req.body === 'string'
          ? JSON.parse(req.body)
          : req.body || {};
    } catch {
      return json(res, 400, { error: 'Invalid JSON body' });
    }

    const token = body?.token?.id || body?.token;
    const customer = body?.customer || {};
    if (!token) return json(res, 400, { error: 'Missing card token' });

    const client = new Client(apiKey);
    const accountCode = `acct_${Date.now()}`;

    const items =
      Array.isArray(customer.items) && customer.items.length
        ? customer.items
        : [{ sku: 'tirz-vial', qty: 1, price: 90 }];

    const lineItems = items.map((it) => ({
      type: 'charge',
      currency: 'USD',
      unitAmount: Number(it.price),
      quantity: Number(it.qty) || 1,
      description: it.sku || 'Item',
    }));

    // ✅ Minimal, token-only billing info (no extra address fields)
    const purchaseReq = {
      currency: 'USD',
      account: {
        code: accountCode,
        firstName: customer.first_name || 'Customer',
        lastName:  customer.last_name  || 'Customer',
        email:     customer.email,
        billingInfo: { tokenId: token }
      },
      lineItems,
      collectionMethod: 'automatic'
    };

    // Validate then charge
    await client.previewPurchase(purchaseReq);
    const purchase = await client.createPurchase(purchaseReq);

    return json(res, 200, {
      ok: true,
      id: purchase?.uuid || null,
      invoiceNumber: purchase?.chargeInvoice?.number || null,
    });
  } catch (e) {
    const pe = parseError(e);
    return json(res, pe.status || 500, {
      error: pe.message,
      errors: pe.errors,
      raw: pe.raw,
    });
  }
};

// Replace with your real Recurly server-side charge; this stub simply returns OK for flow testing.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { token, customer, items } = await readJson(req);
    if (!token) return res.status(400).json({ error: 'Missing token' });
    // TODO: call your processor / Recurly API with 'token' and 'customer'
    console.log('[recurly:charge]', { token, customer, items });
    res.status(200).json({ ok:true, id:'stub_txn_123' });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Server error' });
  }
}
async function readJson(req){ if (req.body && typeof req.body==='object') return req.body;
  let s=''; for await (const c of req) s+=c; return s?JSON.parse(s):{}; }

