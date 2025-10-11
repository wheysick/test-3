/* ===== recurly-wire.js v9.1 — robust singleton mount, dedupe, submit (name-safe) ===== */
(function(){
  const $  = (s, ctx=document) => ctx.querySelector(s);
  const $$ = (s, ctx=document) => Array.from(ctx.querySelectorAll(s));

  function hasContainers(){
    return $('#recurly-number') && $('#recurly-month') && $('#recurly-year') && $('#recurly-cvv') && $('#recurly-postal');
  }
  function isMounted(){
    const n = $('#recurly-number'); return !!(n && n.querySelector('iframe'));
  }
  function dedupe(){
    const wrap = $('#coPayWrap'); if (!wrap) return;
    // Remove legacy/plain inputs
    wrap.querySelectorAll(
      'input[name="card"], input[name="cardnumber"], input[name="exp"], input[name="month"], input[name="year"], input[name="exp-month"], input[name="exp-year"], input[name="cvc"], input[name="cczip"]'
    ).forEach(inp => (inp.closest('fieldset,.co-field,.form-group,.row') || inp).remove());
    // Remove any old #re-* containers
    wrap.querySelectorAll('#re-number, #re-month, #re-year, #re-cvv, #re-postal')
      .forEach(el => { const blk = el.closest('fieldset') || el.parentElement; (blk || el).remove(); });
    // If multiple #recurly-number exist, keep newest
    const nums = $$('#coPayWrap #recurly-number');
    if (nums.length > 1){
      for (let i=0; i<nums.length-1; i++){ const fs = nums[i].closest('fieldset'); if (fs) fs.remove(); else nums[i].remove(); }
    }
  }

  // Minimal singleton helper
  if (!window.RecurlyUI){
    window.RecurlyUI = (function(){
      let elements=null, fields={};
      function mount(){
        if (!window.recurly) return null;
        if (elements && isMounted()) return elements;
        elements = window.recurly.Elements();
        const style = { fontSize:'16px', color:'#E9ECF2', placeholder:{ color:'rgba(234,236,239,.55)' } };
        fields.number = elements.CardNumberElement({ style });
        fields.month  = elements.CardMonthElement({ style });
        fields.year   = elements.CardYearElement({ style });
        fields.cvv    = elements.CardCvvElement({ style });
        fields.postal = elements.CardPostalCodeElement({ style });
        fields.number.attach('#recurly-number');
        fields.month.attach('#recurly-month');
        fields.year.attach('#recurly-year');
        fields.cvv.attach('#recurly-cvv');
        fields.postal.attach('#recurly-postal');
        return elements;
      }
      function tokenize(meta){
        return new Promise((resolve, reject)=>{
          if (!isMounted()) return reject(new Error('Payment form not ready'));
          window.recurly.token(elements, meta||{}, (err, token)=>{
            if (err){
              const details = err.fields ? Object.entries(err.fields).map(([k,v]) => `${k}: ${Array.isArray(v)?v.join(', '):v}`).join('; ') : '';
              if (details) err.message = `${err.message} — ${details}`;
              reject(err);
            } else resolve(token);
          });
        });
      }
      return { mount, tokenize };
    })();
  }

  // Mount loop: wait for step 3 + recurly.js + actual iframes
  let tries = 0, timer = null;
  function mountLoop(){
    clearTimeout(timer); tries++;
    if (!hasContainers()){ timer = setTimeout(mountLoop, 150); return; }
    dedupe();
    if (!window.recurly){ timer = setTimeout(mountLoop, 150); return; }
    window.RecurlyUI.mount();
    if (!isMounted()){
      if (tries < 40) { timer = setTimeout(mountLoop, 150); return; } // ~6s max
      console.warn('[Recurly] mount timeout');
    }
  }
  function step3Visible(){
    const s3 = $('#coStep3');
    return s3 && (s3.hidden === false || getComputedStyle(s3).display !== 'none');
  }
  function startWhenVisible(){ if (step3Visible()){ tries = 0; mountLoop(); } }

  document.addEventListener('DOMContentLoaded', startWhenVisible);
  window.addEventListener('load', startWhenVisible);
  new MutationObserver(startWhenVisible)
    .observe(document.getElementById('checkoutModal') || document.documentElement, { subtree:true, childList:true });

  // Submit handler
  document.addEventListener('click', async (ev)=>{
    const btn = ev.target.closest('#coSubmit');
    if (!btn) return;
    ev.preventDefault();

    // Build meta from Step 1 — supports single "Full Name" or split fields
    const step1 = document.getElementById('coStep1');
    const get = n => step1 ? (step1.querySelector(`[name='${n}']`)?.value || '').trim() : '';
    let first = (get('first_name') || '').trim();
    let last  = (get('last_name')  || '').trim();

    if (!first || !last){
      const full = get('name') || get('full_name') || get('cardholder') || '';
      if (full){
        const i = full.lastIndexOf(' ');
        if (i > 0){ first = first || full.slice(0, i).trim(); last = last || full.slice(i+1).trim(); }
        else { first = first || full; last = last || full; } // single word → duplicate
      }
    }
    if (!first) first = 'Customer';
    if (!last)  last  = 'Customer';

    const meta = { first_name:first, last_name:last, email:get('email'), phone:get('phone') };

    try{
      btn.disabled = true;
      if (!isMounted()){ tries = 0; mountLoop(); throw new Error('Payment form not ready'); }

      const token = await window.RecurlyUI.tokenize(meta);
      const qty  = Number(document.querySelector('#coQty')?.value || 1) || 1;
      const unit = Number(document.body.dataset.price || 90) || 90;

      const res = await fetch('/api/payments/recurly/charge', {
        method:'POST', headers:{'Content-Type':'application/json'},
        // server-side will handle qty/unit_amount shape
        body: JSON.stringify({ token: token?.id, qty, unit_amount: unit })
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out?.error || out?.message || 'Charge failed');

      document.getElementById('checkoutSuccess')?.removeAttribute('hidden');
      document.getElementById('coStep3')?.setAttribute('hidden','hidden');
    } catch(e){
      alert(e.message || 'Payment failed');
    } finally {
      btn.disabled = false;
    }
  });
})();
