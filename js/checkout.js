// ===== checkout.js — v10.11.4 (full build + Recurly payload fix) =====
(function(){
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const modal   = $('#checkoutModal'); if (!modal) return;
  const step1   = $('#coStep1');
  const step2   = $('#coStep2');
  const step3   = $('#coStep3');
  const submit  = $('#coSubmit');
  const close   = $('#checkoutClose');
  const toStep2 = $('#coToStep2');
  const toStep3 = $('#coToStep3');
  const cardset = $('#coCardPane');
  const altPane = $('#coAltPane');

  // ===== modal open/close
  document.addEventListener('click', function(e){
    const a = e.target.closest && e.target.closest('.open-checkout');
    if (!a) return;
    e.preventDefault();
    checkoutOpen();
    fbqSafe('AddToCart', pixelCartData({ value: (qty||1) * (PRICE||90) }));
  }, true);

  if (close) close.addEventListener('click', (e)=>{ e.preventDefault(); checkoutClose(); });
  document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape' && modal.classList.contains('show')) checkoutClose(); }, true);
  modal.addEventListener('click', (e)=>{ if (e.target === modal) checkoutClose(); });

  modal.addEventListener('click', function(e){
    const g2 = e.target.closest && e.target.closest('#coToStep2, [data-goto-step="2"]');
    if (g2){ e.preventDefault(); setStep(2); return; }
    const g3 = e.target.closest && e.target.closest('#coToStep3, [data-goto-step="3"]');
    if (g3){ e.preventDefault(); setStep(3); return; }
  }, true);

  modal.addEventListener('submit', (e)=>{ if (modal.contains(e.target)) e.preventDefault(); }, true);
  step1 && step1.addEventListener('submit', (e)=>{
    e.preventDefault();
    setStep(2);
    fbqSafe('InitiateCheckout', pixelCartData({ num_items: qty }));
  }, true);

  // ===== pricing
  const PRICE = 90.00, TAX_RATE = 0.0874, ALT_DISC_RATE = 0.15;
  const qtyInput = $('#coQty');
  const elItems = $('#coItems'), elMerch = $('#coMerch'), elMethod = $('#coMethod');
  const elTax   = $('#coTax'),   elShip  = $('#coShip'),  elTotal  = $('#coTotal');
  let qty = 1, payMethod = 'card';

  const fmt = n => '$' + Number(n).toFixed(2);
  function setQty(n){ qty = Math.min(99, Math.max(1, n|0)); if(qtyInput) qtyInput.value = String(qty); updateTotals(); }
  function computeTotals(){
    const merch = qty * PRICE;
    const disc  = (payMethod === 'card') ? 0 : +(merch * ALT_DISC_RATE).toFixed(2);
    const taxable = Math.max(0, merch - disc);
    const tax   = +(taxable * TAX_RATE).toFixed(2);
    const total = +(taxable + tax).toFixed(2);
    return { merch, disc, tax, total, taxable };
  }
  function updateTotals(){
    const { merch, disc, tax, total } = computeTotals();
    elItems && (elItems.textContent = `${qty*2} bottles (${qty} paid + ${qty} free)`);
    elMerch && (elMerch.textContent = fmt(merch));
    elMethod && (elMethod.textContent = disc ? ('−' + fmt(disc)) : fmt(0));
    elTax   && (elTax.textContent   = fmt(tax));
    elShip  && (elShip.textContent  = 'FREE');
    elTotal && (elTotal.textContent = fmt(total));
  }
  qtyInput && qtyInput.addEventListener('input', ()=>{ const v=parseInt(qtyInput.value.replace(/[^0-9]/g,''),10); setQty(isNaN(v)?1:v); });
  $$('.qty-inc').forEach(b => b.addEventListener('click', ()=> setQty(qty+1)));
  $$('.qty-dec').forEach(b => b.addEventListener('click', ()=> setQty(qty-1)));

  // ===== step switching
  function currentStep(){ if (step3 && !step3.hidden) return 3; if (step2 && !step2.hidden) return 2; return 1; }
  function setStep(n){
    [step1, step2, step3].forEach((el,i)=>{ if (!el) return; const on=(i===n-1); el.hidden=!on; el.setAttribute('aria-hidden', String(!on)); });
    if (n===3){
      if (payMethod === 'card') { window.RecurlyUI?.mount(); } else { window.RecurlyUI?.unmount(); }
    } else {
      window.RecurlyUI?.unmount();
    }
  }
  window.gotoStep2 = function(){ setStep(2); };
  window.gotoStep3 = function(){ setStep(3); };

  // ===== customer data
  function getStep1Val(n){ return step1?.querySelector(`[name="${n}"]`)?.value?.trim() || ''; }
  function getCustomerMeta(){
    const full = getStep1Val('name'); let first = full, last='';
    if (full && full.includes(' ')){ const i=full.lastIndexOf(' '); first=full.slice(0,i); last=full.slice(i+1); }
    return { first_name:first||'', last_name:last||'', email:getStep1Val('email'), phone:getStep1Val('phone'),
             address:getStep1Val('address'), city:getStep1Val('city'), state:getStep1Val('state'), zip:getStep1Val('zip'), country:'US' };
  }
  function getOrderId(){
    let id = sessionStorage.getItem('coOrderId');
    if (!id){
      const email = getStep1Val('email') || (navigator.userAgent||'guest');
      let s=0; for (let i=0;i<email.length;i++) s = (s*31 + email.charCodeAt(i))>>>0;
      const uk = s.toString(36).toUpperCase().slice(0,5);
      id = 'T' + uk + '-' + Date.now().toString(36).toUpperCase().slice(-6);
      sessionStorage.setItem('coOrderId', id);
    }
    return id;
  }

  // ===== Recurly submit (fixed payload)
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
        meta: { order_id: getOrderId(), qty, source: 'checkout.js v10.11.4' }
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

  // ===== pixels/helpers
  function fbqSafe(event, params, opts){ try{ if (window.fbq) window.fbq('track', event, params||{}, opts||{}); }catch{} }
  function pixelCartData(overrides){
    const t = computeTotals?.() || { total: 0 }; const base = {
      value: t.total, currency:'USD',
      contents:[{ id:'tirz-vial', quantity: qty, item_price: PRICE }],
      content_type:'product'
    };
    return Object.assign(base, overrides||{});
  }
})();
