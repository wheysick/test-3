// ===== checkout.js — v10.11.7 (compat payload: root + customer + billing_info + name) =====
(function(){
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const modal   = $('#checkoutModal'); if (!modal) return;
  const step1   = $('#coStep1');
  const step2   = $('#coStep2');
  const step3   = $('#coStep3');
  const submit  = $('#coSubmit');
  let   payMethod = 'card';

  // --- field helpers (support both Full Name and split fields) ---
  function qv(name){ return step1?.querySelector(`[name="${name}"]`)?.value?.trim() || ''; }
  function resolveFirst(){
    const fn = qv('first_name') || qv('firstname') || qv('given_name');
    if (fn) return fn;
    const full = qv('name'); if (!full) return '';
    const i = full.trim().lastIndexOf(' ');
    return i>0 ? full.slice(0,i).trim() : full.trim();
  }
  function resolveLast(){
    const ln = qv('last_name') || qv('lastname') || qv('family_name');
    if (ln) return ln;
    const full = qv('name'); if (!full) return '';
    const parts = full.trim().split(/\s+/);
    return parts.length>1 ? parts.pop() : '';
  }
  function getCustomerMeta(){
    const first_name = resolveFirst();
    const last_name  = resolveLast();
    return {
      first_name,
      last_name,
      full_name: [first_name, last_name].filter(Boolean).join(' '),
      email:      qv('email'),
      phone:      qv('phone'),
      address:    qv('address'),
      city:       qv('city'),
      state:      qv('state'),
      zip:        qv('zip'),
      country:    'US'
    };
  }

  const PRICE = 90.00, TAX_RATE = 0.0874, ALT_DISC_RATE = 0.15;
  let qty = 1;
  function computeTotals(){
    const merch = qty * PRICE;
    const disc  = (payMethod === 'card') ? 0 : +(merch * ALT_DISC_RATE).toFixed(2);
    const taxable = Math.max(0, merch - disc);
    const tax   = +(taxable * TAX_RATE).toFixed(2);
    const total = +(taxable + tax).toFixed(2);
    return { merch, disc, tax, total, taxable };
  }
  function getOrderId(){
    let id = sessionStorage.getItem('coOrderId');
    if (!id){
      const seed = qv('email') || (navigator.userAgent||'guest');
      let s=0; for (let i=0;i<seed.length;i++) s = (s*31 + seed.charCodeAt(i))>>>0;
      const uk = s.toString(36).toUpperCase().slice(0,5);
      id = 'T' + uk + '-' + Date.now().toString(36).toUpperCase().slice(-6);
      sessionStorage.setItem('coOrderId', id);
    }
    return id;
  }

  // ===== Recurly submit (broadly compatible payload) =====
  submit && submit.addEventListener('click', async (e)=>{
    e.preventDefault();
    try {
      if (payMethod !== 'card') return;
      if (!window.RecurlyUI) throw new Error('Payment form not ready');
      submit.disabled = true;
      submit.textContent = 'Processing…';

      const c = getCustomerMeta();
      if (!c.first_name || !c.last_name){
        alert('Please provide your first and last name.');
        return;
      }

      const token = await window.RecurlyUI.tokenize({});

      const customerRoot = {
        first_name: c.first_name,
        last_name:  c.last_name,
        email:      c.email,
        phone:      c.phone,
        address:    c.address,
        city:       c.city,
        state:      c.state,
        postal_code:c.zip,
        country:    c.country
      };

      const payload = {
        token: token.id || token,

        // (1) top-level keys
        ...customerRoot,
        name: c.full_name,              // some validators look for a single "name"
        full_name: c.full_name,         // and/or this alias

        // (2) billing aliases
        billing_first_name: c.first_name,
        billing_last_name:  c.last_name,
        billing_address:    c.address,
        billing_city:       c.city,
        billing_state:      c.state,
        billing_postal_code:c.zip,
        billing_country:    c.country,

        // (3) nested objects commonly used by Recurly-like services
        customer: { ...customerRoot, name: c.full_name },
        billing_info: {
          first_name: c.first_name,
          last_name:  c.last_name,
          address1:   c.address,
          city:       c.city,
          region:     c.state,
          postal_code:c.zip,
          country:    c.country
        },

        items: [{ sku: 'tirz-vial', qty, price: PRICE }],
        meta: { order_id: getOrderId(), qty, source: 'checkout.js v10.11.7' }
      };

      try { console.log('[checkout] Recurly charge payload:', payload); } catch(_){}

      const resp = await fetch('/api/payments/recurly/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json().catch(()=>null);
      if (!resp.ok) {
        const reasons = Array.isArray(data?.errors) ? ('\n• ' + data.errors.join('\n• ')) : '';
        throw new Error((data?.error || `Payment failed (HTTP ${resp.status})`) + reasons);
      }

      const t = computeTotals();
      const oid = getOrderId();
      sessionStorage.setItem('coLastTotal', String(t.total));
      sessionStorage.setItem('coLastQty', String(qty));
      sessionStorage.setItem('coLastOrderId', oid);
      window.location.href = `/thank-you.html?m=card&order=${encodeURIComponent(oid)}`;
    } catch (err) {
      alert(err?.message || 'Payment failed');
    } finally {
      submit.disabled = false;
      submit.textContent = 'Complete Order';
    }
  });

})();
