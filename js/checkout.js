// ===== checkout.js — v10.11.2 (colors via CSS, pixels wired, thank-you redirects) =====
(function(){
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const modal   = $('#checkoutModal'); if (!modal) return;
  const step1   = $('#coStep1');
  const step2   = $('#coStep2');
  const step3   = $('#coStep3');
  const submit  = $('#coSubmit');
  const submitWrap = $('#coSubmitWrap');
  const close   = $('#checkoutClose');
  const toStep2 = $('#coToStep2');
  const toStep3 = $('#coToStep3');
  const cardset = $('#coCardPane');
  const altPane = $('#coAltPane');

  // Always open checkout on any .open-checkout (capture beats others)
  document.addEventListener('click', function(e){
    const a = e.target.closest && e.target.closest('.open-checkout');
    if (!a) return;
    e.preventDefault();
    checkoutOpen();
    // Pixel: AddToCart
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
  step1 && step1.addEventListener('submit', (e)=>{ e.preventDefault(); setStep(2);
    // Pixel: InitiateCheckout
    fbqSafe('InitiateCheckout', pixelCartData({ num_items: qty }));
  }, true);

  // ===== pricing
  const PRICE = 90.00, TAX_RATE = 0.0874, ALT_DISC_RATE = 0.15;
  const qtyInput = $('#coQty');
  const elItems = $('#coItems'), elMerch = $('#coMerch'), elMethod = $('#coMethod');
  const elTax   = $('#coTax'),   elShip  = $('#coShip'),  elTotal  = $('#coTotal');
  let qty = 1, payMethod = 'card'; // card | paypal | venmo | cashapp | crypto

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

  // ===== payment method selection (parity with v10.6)
  const payButtons = {
    card:   $('#pmCard'), paypal: $('#pmPayPal'), venmo: $('#pmVenmo'),
    cashapp:$('#pmCashApp'), crypto: $('#pmCrypto')
  };
  function selectMethod(kind){
    payMethod = kind;
    Object.entries(payButtons).forEach(([k, el])=>{
      if (!el) return;
      if (k === 'card') {
        el.classList.toggle('is-selected', kind === 'card');
        el.setAttribute('aria-selected', String(kind === 'card'));
      } else {
        el.setAttribute('aria-selected', String(kind === k));
      }
    });
    updateTotals();
  }
  if (payButtons.card){   payButtons.card.addEventListener('click', ()=> selectMethod('card'));   payButtons.card.addEventListener('dblclick', ()=>{ selectMethod('card'); setStep(3); }); }
  if (payButtons.cashapp){payButtons.cashapp.addEventListener('click', ()=> selectMethod('cashapp'));payButtons.cashapp.addEventListener('dblclick', ()=>{ selectMethod('cashapp'); setStep(3); }); }
  if (payButtons.crypto){ payButtons.crypto.addEventListener('click', ()=> selectMethod('crypto')); payButtons.crypto.addEventListener('dblclick', ()=>{ selectMethod('crypto'); setStep(3); }); }
  updateTotals();

  // ===== step switching
  function currentStep(){ if (step3 && !step3.hidden) return 3; if (step2 && !step2.hidden) return 2; return 1; }
  function setStep(n){
    [step1, step2, step3].forEach((el,i)=>{ if (!el) return; const on=(i===n-1); el.hidden=!on; el.setAttribute('aria-hidden', String(!on)); });
    if (n===3){
      renderStep3UI();
      if (payMethod === 'card') { window.RecurlyUI?.mount(); } else { window.RecurlyUI?.unmount(); }
      fixClickBlockers();
    } else {
      window.RecurlyUI?.unmount();
    }
  }
  window.gotoStep2 = function(){ setStep(2); };
  window.gotoStep3 = function(){ setStep(3); };

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

  // ===== Step 3 UI (cashapp + crypto)
  function renderStep3UI(){
    if (!step3) return;
    const totals = computeTotals();
    const amount = totals.total.toFixed(2);
    modal?.setAttribute('data-alt-mode', (payMethod === 'card') ? '0' : '1');

    if (payMethod === 'card'){
      cardset && (cardset.hidden = false);
      if (altPane){ altPane.hidden = true; altPane.innerHTML = ''; }
      if (submitWrap) submitWrap.style.display = '';
      return;
    }
    cardset && (cardset.hidden = true);
    if (submitWrap) submitWrap.style.display = 'none';

    let title='', body='', primary='', url='#', help='', extraHTML='';

    if (payMethod === 'cashapp'){
      title = 'Pay with Cash App';
      const cashtag = 'selfhacking';
      const orderId = getOrderId();
      const noteLine = 'input your order number in the cashapp payment notes with nothing else';
      const cashUrl = `https://cash.app/$${cashtag}?amount=${encodeURIComponent(amount)}&note=${encodeURIComponent(orderId)}`;
      const isDesktop = window.matchMedia && window.matchMedia('(pointer:fine)').matches && !/android|iphone|ipad|ipod/i.test(navigator.userAgent||'');
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(cashUrl)}`;

      body  = `Send the exact total to <strong>$${cashtag}</strong>. Use note: <strong>${orderId}</strong>.`;
      primary = 'Open Cash App'; url = cashUrl;
      help = 'After you send the payment, tap “I Sent the Payment” so we can match it faster.';

      const qrBlock = isDesktop ? `<div class="alt-row" style="display:flex;justify-content:center;margin:12px 0;">
        <img id="cashQr" src="${qrUrl}" width="240" height="240" alt="Cash App QR for $${cashtag}"></div>` : '';

      const copyRow = `<div class="alt-row" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;justify-content:center;align-items:center;text-align:center;">
        <button type="button" class="alt-btn secondary copy-btn" data-copy="$${cashtag}">$ Copy Cashtag</button>
        <button type="button" class="alt-btn secondary copy-btn" data-copy="${amount}">📋 Copy Amount ${amount}</button>
        <button type="button" class="alt-btn secondary copy-btn" data-copy="${orderId}">🧾 Copy Order #</button>
      </div>
      <div class="alt-row" style="font-size:12px;opacity:.9;margin-top:4px;text-align:center;"><em>${noteLine}</em></div>`;

      extraHTML = qrBlock + copyRow + `<div class="alt-actions" style="margin-top:10px;gap:10px;display:flex;flex-wrap:wrap;justify-content:center;">
        ${isDesktop ? '' : '<button type="button" class="alt-btn" id="altPrimary">Open Cash App</button>'}
        <button type="button" class="alt-btn" id="markPaidBtn">I Sent the Payment</button>
        <button type="button" class="alt-btn secondary" id="altBack">Choose another method</button>
      </div>`;
    } else if (payMethod === 'crypto'){
      title = 'Pay with Crypto';
      body  = 'You\'ll be redirected to Coinbase Commerce to pay with BTC, ETH, USDC, and more.';
      primary = 'Continue to Coinbase'; url = '#';
      help = 'After the network confirms, we\'ll email you and ship.';
    }

    const h4Style = (payMethod === 'cashapp' || payMethod === 'crypto')
      ? ' style="display:flex;justify-content:center;align-items:center;text-align:center;width:100%;margin:0 auto;"' : '';
    const html = `
      <div class="alt-pane">
        <h4${h4Style}>${title}</h4>
        <div class="alt-row"><strong>Total:</strong> ${fmt(computeTotals().total)}</div>
        <div class="alt-row">${body}</div>
        ${payMethod === 'cashapp' ? '' : `
        <div class="alt-actions">
          <button type="button" class="alt-btn" id="altPrimary">${primary}</button>
          <button type="button" class="alt-btn secondary" id="altBack">Choose another method</button>
        </div>`}
        ${extraHTML}
        <div class="alt-row" style="opacity:.85;font-size:13px;margin-top:8px;">${help}</div>
      </div>`;
    altPane.innerHTML = html; altPane.hidden = false;

    const altPrimary = $('#altPrimary'); const altBack = $('#altBack');
    altBack?.addEventListener('click', ()=> setStep(2));

    if (altPrimary){
      altPrimary.addEventListener('click', async ()=>{
        if (payMethod === 'crypto'){
          try {
            altPrimary.disabled = true; altBack && (altBack.disabled = true);
            altPrimary.textContent = 'Creating charge…';
            const customer = getCustomerMeta();
            const t = computeTotals();
            const payload = { qty, email: customer.email || '', total: t.total,
              meta: { ...customer, sku:'tirz-vial', free_qty:qty, paid_qty:qty, order_id: getOrderId() } };
            // stash for thank-you
            sessionStorage.setItem('coLastTotal', String(t.total));
            sessionStorage.setItem('coLastQty', String(qty));
            sessionStorage.setItem('coLastOrderId', getOrderId());

            const resp = await fetch('/api/payments/coinbase/create-charge', {
              method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
            });
            const d = await resp.json().catch(()=>null);
            if (!resp.ok || !d?.hosted_url) throw new Error(d?.error || `Charge creation failed (HTTP ${resp.status})`);
            fbqSafe('AddPaymentInfo', pixelCartData({ payment_method: 'crypto' }));
            window.location.href = d.hosted_url;
          } catch (err) {
            alert(err?.message || 'Crypto checkout failed');
            altPrimary.disabled = false; altBack && (altBack.disabled = false);
            altPrimary.textContent = 'Continue to Coinbase';
          }
          return;
        }
        if (payMethod === 'cashapp'){
          // mobile: open cash app URL
          const cashtag='selfhacking', orderId=getOrderId(), t=computeTotals();
          sessionStorage.setItem('coLastTotal', String(t.total));
          sessionStorage.setItem('coLastQty', String(qty));
          sessionStorage.setItem('coLastOrderId', orderId);
          fbqSafe('AddPaymentInfo', pixelCartData({ payment_method: 'cashapp' }));
          const cashUrl = `https://cash.app/$${cashtag}?amount=${encodeURIComponent(t.total.toFixed(2))}&note=${encodeURIComponent(orderId)}`;
          window.open(cashUrl,'_blank','noopener');
        }
      });
    }

    if (payMethod === 'cashapp'){
      $$('.copy-btn', altPane).forEach(btn=>{
        btn.addEventListener('click', async ()=>{
          const val = btn.getAttribute('data-copy') || '';
          try{ await navigator.clipboard?.writeText(val); btn.textContent='✓ Copied'; btn.disabled=true; setTimeout(()=>{ btn.textContent=btn.textContent.includes('Amount')?('📋 Copy Amount '+amount):btn.textContent.includes('Cashtag')?'$ Copy Cashtag':'🧾 Copy Order #'; btn.disabled=false; },1200);}catch(_){ window.prompt('Copy to clipboard:', val); }
        });
      });
      const markBtn = $('#markPaidBtn');
      markBtn?.addEventListener('click', async ()=>{
        try{
          markBtn.disabled = true;
          const customer = getCustomerMeta(); const t = computeTotals(); const oid = getOrderId();
          sessionStorage.setItem('coLastTotal', String(t.total));
          sessionStorage.setItem('coLastQty', String(qty));
          sessionStorage.setItem('coLastOrderId', oid);
          const r = await fetch('/api/payments/cashapp/mark-paid', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ order_id: oid, method:'cashapp', cashtag:'$selfhacking', amount:t.total, qty, email: customer.email||'', meta: customer, ts: Date.now() })
          });
          if(!r.ok){ const err=await r.json().catch(()=>({})); throw new Error(err?.error || `HTTP ${r.status}`); }
          // redirect to thank-you (pending)
          window.location.href = `/thank-you.html?m=cashapp&status=pending&order=${encodeURIComponent(oid)}`;
        }catch(e){ alert(e?.message || 'Could not mark as paid'); markBtn.disabled=false; }
      });
    }
  }

  function fixClickBlockers(){
    try{
      const wrappers = step3?.querySelectorAll('label, .row, .co-row, .co-field') || [];
      wrappers.forEach(el => { el.style.pointerEvents = 'none'; });
      ['re-number','re-month','re-year','re-cvv','re-postal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.style.pointerEvents='auto'; el.style.position='relative'; el.style.zIndex='10'; }
      });
    }catch(e){}
  }

  // Submit (card only) -> after success redirect to thank-you (Purchase fired there)
  submit && submit.addEventListener('click', async (e)=>{
    e.preventDefault();
    try {
      if (payMethod !== 'card') return;
      if (!window.RecurlyUI) throw new Error('Payment form not ready');
      submit.disabled = true; submit.textContent = 'Processing…';

      const customer = getCustomerMeta();
      const token = await window.RecurlyUI.tokenize({});
      const resp = await fetch('/api/payments/recurly/charge', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ token: token.id || token, customer, items:[{ sku:'tirz-vial', qty, price: PRICE }] })
      });
      let data=null; try{ data=await resp.json(); }catch(_){}
      if(!resp.ok){ const reasons = Array.isArray(data?.errors) ? `\n• ${data.errors.join('\n• ')}` : ''; throw new Error((data?.error || `Payment failed (HTTP ${resp.status})`) + reasons); }

      // Stash values for thank-you
      const t = computeTotals(); const oid = getOrderId();
      sessionStorage.setItem('coLastTotal', String(t.total));
      sessionStorage.setItem('coLastQty', String(qty));
      sessionStorage.setItem('coLastOrderId', oid);

      window.location.href = `/thank-you.html?m=card&order=${encodeURIComponent(oid)}`;
    } catch (err) {
      alert(err?.message || 'Payment failed');
    } finally {
      submit.disabled = false; submit.textContent = 'Complete Order';
    }
  });

  // Stock countdown
  const STOCK_START=47, STOCK_END=1, STOCK_MS=5*60*1000;
  let stockTimer=null, stockT0=null; const STOCK_KEY='coStockT0_v1';
  function stockNow(){
    if (!stockT0) return STOCK_START;
    const now=Date.now(), t1=stockT0+STOCK_MS, clamped=Math.max(0, Math.min(STOCK_MS, t1-now));
    const ratio=clamped/STOCK_MS, span=STOCK_START-STOCK_END;
    const value = STOCK_END + Math.round(span * ratio);
    return Math.max(STOCK_END, Math.min(STOCK_START, value));
  }
  function renderStock(){ const v=stockNow(); const s2=$('#coStock'); const s3=$('#coStockLine3 .qty'); if (s2) s2.textContent=String(v); if (s3) s3.textContent=String(v); }
  function startStock(){ if (stockTimer) return; const saved=parseInt(sessionStorage.getItem(STOCK_KEY)||'',10);
    stockT0 = Number.isFinite(saved) ? saved : Date.now(); if (!Number.isFinite(saved)) sessionStorage.setItem(STOCK_KEY, String(stockT0));
    renderStock(); stockTimer=setInterval(()=>{ renderStock(); if (stockNow()<=STOCK_END){ clearInterval(stockTimer); stockTimer=null; }},1000); }
  function stopStock(){ if (stockTimer){ clearInterval(stockTimer); stockTimer=null; } }

  window.checkoutOpen = function(){ modal.classList.add('show'); modal.style.display='grid';
    document.documentElement.setAttribute('data-checkout-open','1'); document.body.style.overflow='hidden'; setStep(1); startStock(); };
  window.checkoutClose = function(){ modal.classList.remove('show'); modal.style.display='none';
    document.documentElement.removeAttribute('data-checkout-open'); document.body.style.overflow=''; stopStock(); };
  window.checkoutBack  = function(){ const s=currentStep(); setStep(s===3?2:1); };
  window._debugSetStep = setStep;

  // ===== save-on-change (Step 1)
  (function(){
    const fields = ['name','email','phone','address','city','state','zip'];
    function save(){ if(!step1) return; const data={}; fields.forEach(n=> data[n] = step1.querySelector(`[name="${n}"]`)?.value?.trim()||'');
      localStorage.setItem('coStep1', JSON.stringify(data)); }
    function load(){ try{ const d=JSON.parse(localStorage.getItem('coStep1')||'{}');
      Object.entries(d).forEach(([n,v])=>{ const el=step1?.querySelector(`[name="${n}"]`); if(el && !el.value) el.value=v||''; }); }catch{} }
    load(); step1?.addEventListener('input', save);
  })();

  // ===== lightweight tracking beacons
  function track(name, data){ try{
    navigator.sendBeacon?.('/_track', new Blob([JSON.stringify({name, ts:Date.now(), ...data})], {type:'application/json'}));
  } catch{} }
  document.getElementById('coToStep2')?.addEventListener('click', ()=>track('co_step2',{}));
  document.getElementById('coToStep3')?.addEventListener('click', ()=>{
    // Pixel: AddPaymentInfo at step-2 continue (we also do it in crypto/cashapp handlers)
    fbqSafe('AddPaymentInfo', pixelCartData({ payment_method: payMethod }));
    const t=computeTotals(); sessionStorage.setItem('coLastTotal', String(t.total));
    sessionStorage.setItem('coLastQty', String(qty)); sessionStorage.setItem('coLastOrderId', getOrderId());
    track('co_step3',{method: document.querySelector('[aria-selected="true"]')?.id||'card'});
  });
  document.getElementById('coSubmit')?.addEventListener('click', ()=>track('co_submit',{ method:'card' }));

  // ===== exit guard
  function isDirtyStep1(){ const names=['name','email','phone','address','city','state','zip'];
    return names.some(n => (step1?.querySelector(`[name="${n}"]`)?.value||'').trim().length>0); }
  const origClose = window.checkoutClose; window.checkoutClose = function(){ if (isDirtyStep1() && !confirm('Leave checkout? Your info will be saved.')) return; origClose(); };

  // ===== Pixel helpers
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
