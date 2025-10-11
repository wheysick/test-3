// ===== /api/payments/recurly/charge.js — v2.5 (server-only hardening) =====
const { Client } = require('recurly');

function send(res, status, body){
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function safeJson(req){
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch(_){ return null; }
}

function splitNameLike(full){
  const s = String(full || '').trim();
  if (!s) return { first: '', last: '' };
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: parts[0] };
  return { first: parts.slice(0, -1).join(' '), last: parts.slice(-1).join(' ') };
}

function parseError(e){
  let payload = null;
  try { payload = (e && typeof e.body === 'string') ? JSON.parse(e.body) : (e && e.body) || null; } catch(_){}
  const message = (payload && payload.error && payload.error.message) || e?.message || 'Payment failed';
  const params = (payload && payload.error && payload.error.params) || [];
  const errors = Array.isArray(params) ? params.map(p => p?.param ? `${p.param}: ${p.message}` : p?.message).filter(Boolean) : [];
  return { status: e?.status || 422, message, errors, raw: payload || e };
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST'){
      res.setHeader('Allow', 'POST');
      return send(res, 405, { error: 'Method Not Allowed' });
    }

    const apiKey = process.env.RECURLY_API_KEY;
    if (!apiKey) return send(res, 500, { error: 'Server not configured: missing RECURLY_API_KEY env var' });

    const body = safeJson(req);
    if (!body) return send(res, 400, { error: 'Invalid JSON body' });

    // Accept token as string or object with id
    const token = body?.token?.id || body?.token;
    const customer = body?.customer || {};
    if (!token) return send(res, 400, { error: 'Missing card token' });

    // Derive names robustly: use explicit fields or split a full name
    let firstName = (customer.first_name || '').trim();
    let lastName  = (customer.last_name  || '').trim();

    if (!firstName || !lastName){
      const full = (customer.name || customer.full_name || customer.cardholder || '').trim();
      if (full){
        const s = splitNameLike(full);
        firstName = firstName || s.first;
        lastName  = lastName  || s.last;
      }
    }
    if (!firstName) firstName = 'Customer';
    if (!lastName)  lastName  = 'Customer';

    const email = (customer.email || '').trim() || undefined;

    // Build items gracefully:
    //  - Prefer body.items or customer.items arrays
    //  - Or accept qty + unit_amount (number) shape
    //  - Or default single SKU
    let items = [];
    if (Array.isArray(body.items) && body.items.length){
      items = body.items;
    } else if (Array.isArray(customer.items) && customer.items.length){
      items = customer.items;
    } else if (typeof body.qty !== 'undefined' && typeof body.unit_amount !== 'undefined'){
      items = [{ sku: 'tirz-vial', qty: Number(body.qty) || 1, price: Number(body.unit_amount) || 90 }];
    } else {
      items = [{ sku: 'tirz-vial', qty: 1, price: 90 }];
    }

    const lineItems = items.map(it => ({
      type: 'charge',
      currency: 'USD',
      unitAmount: Number(it.price),
      quantity: Math.max(1, Number(it.qty) || 1),
      description: it.sku || 'Item'
    }));

    const client = new Client(apiKey);
    const accountCode = `acct_${Date.now()}`;

    const purchaseReq = {
      currency: 'USD',
      account: {
        code: accountCode,
        firstName,
        lastName,
        email,
        billingInfo: { tokenId: token }
      },
      lineItems,
      collectionMethod: 'automatic'
    };

    // Validate + charge
    await client.previewPurchase(purchaseReq);
    const purchase = await client.createPurchase(purchaseReq);

    return send(res, 200, {
      ok: true,
      id: purchase?.uuid || null,
      invoiceNumber: purchase?.chargeInvoice?.number || null
    });
  } catch (e){
    const pe = parseError(e);
    return send(res, pe.status || 500, { error: pe.message, errors: pe.errors, raw: pe.raw });
  }
};
