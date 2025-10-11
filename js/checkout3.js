/* ===== checkout3.js — v7.2 (Recurly Elements + validated purchase) ===== */
(function(){
  'use strict';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

let modal = document.getElementById('checkoutModal');
if (!modal) {
  document.addEventListener('DOMContentLoaded', () => {
    modal = document.getElementById('checkoutModal');
  });
}

  const step1   = document.getElementById('coStep1');
  const step2   = document.getElementById('coStep2');
  const step3   = document.getElementById('coStep3');
  const toStep3 = document.getElementById('coToStep3');
  const payWrap = document.getElementById('coPayWrap');
  const submit  = document.getElementById('coSubmit');
  const submitBtn = submit; // prevents "submitBtn is not defined" errors in your console

  // Back link pinned top-left
  let backLink = document.getElementById('coBackLink');
  if (!backLink){
    backLink = document.createElement('button');
    backLink.id = 'coBackLink';
    backLink.className = 'co-backlink';
    backLink.type = 'button';
    backLink.textContent = '← Back';
    $('.modal-content.checkout-card')?.insertAdjacentElement('afterbegin', backLink);
  }

  const fmt = (n)=>`$${n.toFixed(2)}`;
  const show = (el)=>{ if(el){ el.hidden=false; el.setAttribute('aria-hidden','false'); } };
  const hide = (el)=>{ if(el){ el.hidden=true;  el.setAttribute('aria-hidden','true'); } };

  // Pricing
  const MSRP=90, SALE=90, TAX=0.0875, SHIPPING=0;
  let qty=1, method=null, discount=0;

  // Persist step1 values for server purchase
  let customer = {};
  function getStep1Values(){
    if (!step1) return {};
    const get = (n) => step1.querySelector(`[name='${n}']`)?.value?.trim() || '';
    const full = get('name');
    let first = full, last = '';
    if (full.includes(' ')){ const ix=full.lastIndexOf(' '); first=full.slice(0,ix); last=full.slice(ix+1); }
    return {
      first_name: first, last_name: last,
      email: get('email'),
      phone: get('phone'),
      address: get('address'),
      city: get('city'), state: get('state'), zip: get('zip')
    };
  }

  function totals(){
    const free=qty, merch=qty*SALE, disc=merch*(discount/100);
    const taxable=Math.max(0, merch-disc), tax=taxable*TAX, total=taxable+tax+SHIPPING;
    const set=(id,v)=>{ const n=document.getElementById(id); if(n) n.textContent=v; };
    set('coItemsLine', `${qty+free} bottles (${qty} paid + ${free} free)`);
    set('coMerch', fmt(merch));
    set('coDisc', disc>0?`-${fmt(disc)}`:'$0.00');
    set('coTax', fmt(tax));
    set('coTotal', fmt(total));
    const q = document.getElementById('coQty'); if (q) q.value = String(qty);
  }

  function setStep(n){
    const s1=n===1, s2=n===2, s3=n===3;
    if (s1){ show(step1); hide(step2); hide(step3); backLink.style.display='none'; }
    if (s2){ hide(step1); show(step2); hide(step3); backLink.style.display='inline-flex'; stock.start(); }
    if (s3){ hide(step1); hide(step2); show(step3); backLink.style.display='inline-flex'; stock.start(); }
  }

  /* ---------- Open / close ---------- */
  const CTA_SEL = ".floating-cta,[data-cta],[data-open-checkout],.open-checkout,.cta,a[href='#offer'],a[href*='#offer'],a[href*='#checkout'],.masthead-cta";
  let openGuard=0;
  function openModal(e){
    window.__co_openModal = () => openModal();
    const now=Date.now(); if (now-openGuard<250) return; openGuard=now;
    e?.preventDefault?.(); e?.stopPropagation?.();
    modal.classList.add('show','co-fullscreen');
    document.documentElement.setAttribute('data-checkout-open','1');
    document.body.style.overflow='hidden';
    qty=1; method=null; discount=0; totals(); setStep(1);
    methodErr && hide(methodErr);
    stock.reset(); stock.start();
  }
  function closeModal(e){
    window.__co_closeModal = () => closeModal();
    e?.preventDefault?.(); e?.stopPropagation?.();
    modal.classList.remove('show','co-fullscreen');
    document.documentElement.removeAttribute('data-checkout-open');
    document.body.style.overflow='';
  }
  ['click','pointerup','touchend'].forEach(evt=>document.addEventListener(evt,(e)=>{
    const t=e.target.closest(CTA_SEL); if(t) openModal(e);
  },{capture:true,passive:false}));
  new MutationObserver(()=>{
    document.querySelectorAll(CTA_SEL).forEach(el=>{
      if(el.__bound) return;
      const h=(ev)=>{ ev.preventDefault(); ev.stopPropagation(); openModal(ev); };
      el.addEventListener('click',h,{capture:true});
      el.addEventListener('pointerup',h,{capture:true});
      el.addEventListener('touchend',h,{capture:true,passive:false});
      el.__bound=true;
    });
  }).observe(document.documentElement,{subtree:true,childList:true});

  backLink.addEventListener('click',(e)=>{
    e.preventDefault();
    if (!step2.hidden) { setStep(1); return; }
    if (!step3.hidden) { setStep(2); return; }
  });
  closeX?.addEventListener('click', closeModal);
  modal.addEventListener('click',(e)=>{ if(e.target===modal) closeModal(e); });
  document.addEventListener('keydown',(e)=>{ if(e.key==='Escape'&&modal.classList.contains('show')) closeModal(e); });

  // Step 1
  step1?.addEventListener('submit',(e)=>{
    e.preventDefault();
    const req=['name','email','address'].map(n=>step1.querySelector(`[name='${n}']`));
    const ok=req.every(i=>i && i.value.trim());
    req.forEach(i=>i&&(i.style.borderColor=i.value.trim()?'':'#ff5a6e'));
    if(!ok) return;
    customer = getStep1Values();
    setStep(2); totals();
  });

  // Step 2
  let lastTapTime=0, lastMethod=null;
  step2?.addEventListener('click',(e)=>{
    if(e.target.closest('.qty-inc')){ qty=Math.min(99,qty+1); totals(); return; }
    if(e.target.closest('.qty-dec')){ qty=Math.max(1,qty-1); totals(); return; }
    const strip = step2.querySelector('.co-xpay-strip');
    if(e.target.closest('.xpay-nav.prev')){ strip?.scrollBy({left:-240,behavior:'smooth'}); return; }
    if(e.target.closest('.xpay-nav.next')){ strip?.scrollBy({left: 240,behavior:'smooth'}); return; }
    const btn = e.target.closest('.co-xpay, .co-xpay-primary'); if(!btn) return;
    step2.querySelectorAll('.co-xpay,.co-xpay-primary').forEach(b=>b.removeAttribute('aria-selected'));
    btn.setAttribute('aria-selected','true');
    method = btn.dataset.method || 'card';
    discount = parseFloat(btn.dataset.discount || '0') || 0;
    totals();
    methodErr && hide(methodErr);
    const now=Date.now();
    if (lastMethod===method && (now-lastTapTime)<350){ renderPay(method); setStep(3); return; }
    lastMethod=method; lastTapTime=now;
  });
  step2?.addEventListener('input',(e)=>{
    if (e.target.id!=='coQty') return;
    const v=e.target.value.replace(/[^0-9]/g,'');
    qty=Math.max(1,Math.min(99,parseInt(v||'1',10)));
    e.target.value=String(qty); totals();
  });
  toStep3?.addEventListener('click',(e)=>{
    e.preventDefault();
    if(!method){ methodErr && (methodErr.textContent='Must select payment method', show(methodErr)); return; }
    renderPay(method); setStep(3);
  });

  /* ---------- Step 3 renderer (Recurly Elements) ---------- */
  let currentPayRendered=null;
  let recurlyConfigured=false;
  let elements=null;                    // recurly.Elements()
  let cardEls={};                       // { number, month, year, cvv }

  function renderPay(m){
    m=m||'card';
    if (currentPayRendered===m && payWrap.children.length) return;
    currentPayRendered=m;

    const wallets = `
      <div class="co-or">OR</div>
      <div class="co-alt-wallets">
        <button class="co-wallet apple" type="button" aria-label="Apple Pay"><img src="assets/applepay.svg" width="24" height="24" alt=""/><span>Apple&nbsp;Pay</span></button>
        <button class="co-wallet gpay"  type="button" aria-label="Google Pay"><img src="assets/gpay.svg" width="24" height="24" alt=""/><span>Google&nbsp;Pay</span></button>
      </div>`;

    const recurlyCard = `
      <form id="recurlyForm" onsubmit="return false">
        <fieldset class="cardset">
          <legend>Card details</legend>
          <label>Card number
            <div class="recurly-hosted-field" id="recurly-number"></div>
          </label>
          <div class="co-row" style="margin-top:10px">
            <label>Expiry <div class="recurly-hosted-field" id="recurly-month"></div></label>
            <label>Year   <div class="recurly-hosted-field" id="recurly-year"></div></label>
            <label>CVC    <div class="recurly-hosted-field" id="recurly-cvv"></div></label>
          </div>
          <label style="margin-top:10px">ZIP
            <input id="coPostal" inputmode="numeric" maxlength="10" placeholder="Zip / Postal" value="${customer?.zip||''}">
          </label>
        </fieldset>
      </form>`;

    while (payWrap.firstChild) payWrap.removeChild(payWrap.firstChild);

    if (m==='card'){ payWrap.insertAdjacentHTML('beforeend', recurlyCard + wallets); whenRecurlyReady(initRecurlyElements); }
    else if (m==='venmo'){ payWrap.insertAdjacentHTML('beforeend', `<div class="altpay" style="text-align:center"><h4>Venmo</h4><p>Send to @YourHandle — 15% off applied</p></div>`); }
    else if (m==='cashapp'){ payWrap.insertAdjacentHTML('beforeend', `<div class="altpay" style="text-align:center"><h4>Cash App</h4><p>Send to $YourCashtag — 15% off applied</p></div>`); }
    else if (m==='paypal'){ payWrap.insertAdjacentHTML('beforeend', `<div class="altpay" style="text-align:center"><h4>PayPal</h4><p>Redirect to PayPal — 15% off applied</p></div>`); }
    else if (m==='crypto'){ payWrap.insertAdjacentHTML('beforeend', `<div class="altpay" style="text-align:center"><h4>Crypto</h4><p>BTC/ETH/USDC — 15% off applied; address next</p></div>`); }
    else { payWrap.insertAdjacentHTML('beforeend', recurlyCard + wallets); whenRecurlyReady(initRecurlyElements); }
  }

  function whenRecurlyReady(cb){
    if (window.recurly && typeof window.recurly.configure==='function'){ cb(); return; }
    let tries=0; const id=setInterval(()=>{
      if (window.recurly && typeof window.recurly.configure==='function'){ clearInterval(id); cb(); }
      else if (++tries>60){ clearInterval(id); console.warn('[Recurly] script not ready'); }
    },250);
  }

  function initRecurlyElements(){
    if (!window.recurly) return;
    try{
      if (!recurlyConfigured){
        const pk = document.querySelector('meta[name="recurly-public-key"]')?.content || window.RECURLY_PUBLIC_KEY;
        if(!pk){ console.warn('[Recurly] public key missing'); return; }
        console.log('[Recurly] configuring with public key', pk);
        window.recurly.configure(pk);
        recurlyConfigured=true;
      }
      // Destroy old elements if any
      if (elements && elements.destroy) try { elements.destroy(); } catch(e){}
      elements = window.recurly.Elements();

      // Create and attach each field
      cardEls.number = elements.CardNumberElement({ style: { all: { fontSize:'16px', color:'#E9ECF2' }}});
      cardEls.month  = elements.CardMonthElement({  style: { all: { fontSize:'16px', color:'#E9ECF2' }}});
      cardEls.year   = elements.CardYearElement({   style: { all: { fontSize:'16px', color:'#E9ECF2' }}});
      cardEls.cvv    = elements.CardCvvElement({    style: { all: { fontSize:'16px', color:'#E9ECF2' }}});

      cardEls.number.attach('#recurly-number');
      cardEls.month.attach('#recurly-month');
      cardEls.year.attach('#recurly-year');
      cardEls.cvv.attach('#recurly-cvv');
    }catch(e){ console.warn('Recurly init error', e); }
  }

  // ensureHostedReady — wait until Elements injected iframes
  async function ensureHostedReady(timeout=7000){
    const start=Date.now();
    if (!elements) initRecurlyElements();
    const hasIframes = () => payWrap.querySelectorAll('.recurly-hosted-field iframe').length >= 3;
    while (!elements || !hasIframes()){
      if (Date.now()-start > timeout) throw new Error('Payment form is still loading — please try again.');
      await new Promise(r=>setTimeout(r,150));
    }
  }

  function getRecurlyToken(){
    return new Promise((resolve,reject)=>{
      try{
        if (!elements) return reject(new Error('Payment form not ready'));
        const postal = document.getElementById('coPostal')?.value || '';
        window.recurly.token(elements, { billing_info: { postal_code: postal }}, (err, token)=>{
          if (err){
            const msg = err?.message || 'Card info invalid';
            return reject(new Error(msg));
          }
          resolve(token);
        });
      }catch(e){ reject(e); }
    });
  }

  // Submit
  submit?.addEventListener('click', async (e)=>{
    e.preventDefault();
    const order = buildOrder();
    order.customer = customer; // include customer details for server
    try{
      if (method === 'card'){
        submit.disabled = true; submit.textContent = 'Processing…';
        await ensureHostedReady();
        const token = await getRecurlyToken();
        const resp = await fetch('/api/payments/recurly/charge', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ token: token.id || token, order })
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error || 'Payment failed.');
        submit.disabled = false; submit.textContent = 'Complete Order';
        alert('Payment authorized. (Sandbox response)');
        return;
      }
      if (method === 'crypto'){
        const res = await fetch('/api/payments/coinbase/create-charge', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ order })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Crypto init failed');
        if (data?.hosted_url) { window.location.href = data.hosted_url; return; }
        throw new Error('Coinbase charge not created');
      }
      alert('This payment method requires server-side connector setup.');
    }catch(err){
      console.error(err);
      submit.disabled = false; submit.textContent = 'Complete Order';
      alert(err.message || 'Payment failed.');
    }
  });

  function buildOrder(){
    const free=qty, merch=qty*SALE, disc=merch*(discount/100);
    const taxable=Math.max(0, merch-disc), tax=taxable*TAX, total=taxable+tax+SHIPPING;
    return { qty, free, merch, discountPct:discount, tax, total, method };
  }

  /* ---------- Deterministic stock counter (47→1 in ~5min) ---------- */
  const stock = (function(){
    const START=47, MIN=1, DURATION=5*60*1000;
    let startTs=0, interval=0;
    function ensureStart(reset=false){ if (reset || !startTs) startTs = Date.now(); }
    function value(){ const f=Math.min(1,Math.max(0,(Date.now()-startTs)/DURATION)); return Math.max(MIN, START - Math.round((START-MIN)*f)); }
    function paint(){
      const v=value();
      ['coStockLine2','coStockLine3'].forEach(id=>{ const n=document.getElementById(id); if(n) n.innerHTML=`<span class="qty">${v}</span> left in stock`; });
    }
    return { reset(){ clearInterval(interval); ensureStart(true); paint(); },
             start(){ clearInterval(interval); ensureStart(false); paint(); interval=setInterval(paint,1000); } };
  })();

  totals();
})();

submitBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  try {
    // 1) tokenize client-side
    const token = await window.__recurlyTokenize({}); // will raise detailed field errors if invalid

    // 2) send to server to charge
    const order = {
      total: Number(window.__orderTotal || 90),   // your computed total
      qty:   Number(window.__orderQty   || 1),    // your qty
      customer: { email: document.querySelector('#coStep1 [name="email"]')?.value || '' }
    };
    const res  = await fetch('/api/payments/recurly/charge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, order })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Charge failed');

    // 3) success UI
    console.log('[Recurly OK]', data);
    // show success state here
  } catch (err) {
    console.error('[Payment error]', err);
    alert(err.message || 'Payment failed');  // replace with inline error if you like
  } finally {
    submitBtn.disabled = false;
  }
});
