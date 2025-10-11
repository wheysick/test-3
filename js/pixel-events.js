/* pixel-events.js — v2.0 FINAL
   Fires:
     • AddToCart when checkout opens
     • InitiateCheckout when Step 2 shows
     • AddPaymentInfo when Step 3 shows
   Strategy:
     • Wrap real flow functions (checkoutOpen / gotoStep2 / gotoStep3)
     • Fallback: listen to common CTA clicks
     • Fallback: watch DOM for Step 2/3 visibility changes
   Safety:
     • Idempotent; won’t rebind if included twice
     • “Once” gates prevent double fires
     • Never touches your checkout logic (calls originals unchanged)
*/
(function(){
  'use strict';
  if (window.__PIXEL_EVENTS_V20__) return;
  window.__PIXEL_EVENTS_V20__ = true;

  var $ = (s,r=document)=>r.querySelector(s);

  // ---- once-gates so we never double-fire ----
  var gates = Object.create(null);
  function once(key, ms){
    var now = Date.now(), win = ms || 3_000;
    if (gates[key] && (now - gates[key] < win)) return false;
    gates[key] = now; return true;
  }

  // ---- helpers ----
  function readTotal(){
    var el = $('#coTotal');
    if (!el) return undefined;
    var t = (el.textContent||'').replace(/[^0-9.]/g,'');
    var n = Number(t);
    return Number.isFinite(n) ? n : undefined;
  }

  function fireAddToCart(){
    if (!once('ATC', 1500)) return;
    if (typeof fbqSafe === 'function') fbqSafe('AddToCart', { value: 90, currency:'USD', content_type:'product' });
  }
  function fireInitiateCheckout(){
    if (!once('IC', 3000)) return;
    if (typeof fbqSafe === 'function') fbqSafe('InitiateCheckout');
  }
  function fireAddPaymentInfo(){
    if (!once('API', 3000)) return;
    var total = readTotal();
    if (typeof fbqSafe === 'function') {
      total != null ? fbqSafe('AddPaymentInfo', { value: total })
                    : fbqSafe('AddPaymentInfo');
    }
  }

  // ---- wrap helpers (call original unchanged, then fire) ----
  function wrapWhenAvailable(name, cb){
    var tries = 0;
    (function tryWrap(){
      var fn = window[name];
      if (typeof fn === 'function' && !fn.__px_wrapped__) {
        var orig = fn;
        var wrapped = function(){
          try { cb(); } catch(_){}
          return orig.apply(this, arguments);
        };
        wrapped.__px_wrapped__ = true;
        try { Object.defineProperty(wrapped, 'name', {value: name}); } catch(_){}
        window[name] = wrapped;
        return;
      }
      // If not there yet, poll briefly (e.g., defined by another script later)
      if (tries++ < 60) setTimeout(tryWrap, 100);
    })();
  }

  // Hook core flow calls
  wrapWhenAvailable('checkoutOpen', fireAddToCart);     // modal opens
  wrapWhenAvailable('gotoStep2',    fireInitiateCheckout);
  wrapWhenAvailable('gotoStep3',    fireAddPaymentInfo);

  // ---- fallback: CTA click listener (doesn't depend on exact classnames) ----
  document.addEventListener('click', function(e){
    var t = e.target && e.target.closest && e.target.closest(
      '.open-checkout, [data-open-checkout], .masthead-cta, .floating-cta, a[href*="#checkout"], button[name="claim"], button[data-cta="checkout"]'
    );
    if (t) fireAddToCart();
  }, true);

  // ---- fallback: observe Step 2 / Step 3 becoming visible ----
  var step2 = $('#coStep2'), step3 = $('#coStep3');
  function isVisible(el){
    if (!el) return false;
    if (el.hidden) return false;
    var ah = el.getAttribute('aria-hidden');
    if (ah === 'true') return false;
    // If using CSS show/hide via classes, also check size
    var r = el.getBoundingClientRect();
    return (r.width > 0 && r.height > 0);
  }
  function checkSteps(){
    if (isVisible(step2)) fireInitiateCheckout();
    if (isVisible(step3)) fireAddPaymentInfo();
  }
  // run once now (in case Step 1 is skipped or pre-rendered)
  setTimeout(checkSteps, 50);

  // observe changes that would reveal steps
  try{
    var mo = new MutationObserver(function(muts){
      for (var i=0;i<muts.length;i++){
        var m = muts[i];
        if (m.type === 'attributes' || m.type === 'childList') {
          checkSteps();
        }
      }
    });
    mo.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['hidden','aria-hidden','class','style']
    });
  }catch(_){}
})();
