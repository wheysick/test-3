// ===== checkout.js — v10.11.2 (Pixel step-state patch) =====
(function(){
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const modal   = $('#checkoutModal'); if (!modal) return;
  const step1   = $('#coStep1');
  const step2   = $('#coStep2');
  const step3   = $('#coStep3');
  const submit  = $('#coSubmit');

  // --- fire once per modal open
  let __px = { atc:false, ic:false, api:false };

  // ===== pixel-safe helpers
  function fbqSafe(event, params, opts){ 
    try { if (window.fbq) window.fbq('track', event, params||{}, opts||{}); }catch(e){} 
  }
  function pixelCartData(overrides){
    const PRICE = 90.00;
    const t = overrides?.total || PRICE;
    return Object.assign({
      value: t, currency: 'USD',
      contents: [{ id: 'tirz-vial', quantity: 1, item_price: PRICE }],
      content_type: 'product'
    }, overrides || {});
  }

  // ===== step switching (patched for pixel firing)
  function setStep(n){
    [step1, step2, step3].forEach((el,i)=>{ 
      if (!el) return; 
      const on=(i===n-1); 
      el.hidden=!on; 
      el.setAttribute('aria-hidden', String(!on)); 
    });

    // pixel events when steps show
    if (n===2 && !__px.ic) {
      __px.ic = true;
      fbqSafe('InitiateCheckout', pixelCartData({ num_items: 1 }));
    }
    if (n===3 && !__px.api) {
      __px.api = true;
      fbqSafe('AddPaymentInfo', pixelCartData({ payment_method: 'card' }));
    }
  }

  // ===== modal open
  window.checkoutOpen = function(){
    modal.classList.add('show');
    modal.style.display='grid';
    document.documentElement.setAttribute('data-checkout-open','1');
    document.body.style.overflow='hidden';
    setStep(1);
    if (!__px.atc) { 
      __px.atc = true; 
      fbqSafe('AddToCart', pixelCartData({ value: 90 })); 
    }
  };

  // ===== modal close (reset flags)
  window.checkoutClose = function(){
    modal.classList.remove('show');
    modal.style.display='none';
    document.documentElement.removeAttribute('data-checkout-open');
    document.body.style.overflow='';
    __px = { atc:false, ic:false, api:false };
  };

})();
