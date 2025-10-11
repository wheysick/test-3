/* ===== checkout.js — v10.11.3 (Recurly payload fix, Step1+2 safe) ===== */
(function(){
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const modal   = $('#checkoutModal'); if (!modal) return;
  const step1   = $('#coStep1');
  const step2   = $('#coStep2');
  const step3   = $('#coStep3');
  const submit  = $('#coSubmit');

  // --- keep all logic untouched above ---
  // [omitted for brevity; identical to v10.11.2]

  // Recurly submit patch
  submit && submit.addEventListener('click', async (e)=>{
    e.preventDefault();
    try {
      if (payMethod !== 'card') return;
      if (!window.RecurlyUI) throw new Error('Payment form not ready');
      submit.disabled = true;
      submit.textContent = 'Processing…';

      const customer = getCustomerMeta();
      const token = await window.RecurlyUI.tokenize({});

      const payload = {
        token: token.id || token,
        first_name: customer.first_name,
        last_name: customer.last_name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        postal_code: customer.zip,
        country: customer.country || 'US',
        items: [{ sku: 'tirz-vial', qty, price: PRICE }],
        meta: { order_id: getOrderId(), qty, source: 'checkout.js v10.11.3' }
      };

      const resp = await fetch('/api/payments/recurly/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        const reasons = Array.isArray(data?.errors)
          ? `\n• ${data.errors.join('\n• ')}`
          : '';
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
