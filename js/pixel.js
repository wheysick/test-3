/* pixel.js — v4.0 FINAL
   - Loads Meta Pixel (1051611783243364) and routes ALL tracks to it
   - Ignores any other fbq('init', ...) calls
   - Fires ecommerce events on REAL state changes (no brittle selectors):
       • AddToCart        => checkout modal opens
       • InitiateCheckout => Step 2 becomes visible
       • AddPaymentInfo   => Step 3 becomes visible
   - Idempotent & duplicate-safe
*/
(function () {
  'use strict';

  var PIXEL_ID = '1051611783243364';

  // -------- load Meta base if missing --------
  if (!window.fbq) {
    !function(f,b,e,v,n,t,s){ if(f.fbq) return;
      n=f.fbq=function(){ n.callMethod ? n.callMethod.apply(n,arguments) : n.queue.push(arguments) };
      if(!f._fbq) f._fbq=n; n.push=n; n.loaded=!0; n.version='2.0'; n.queue=[];
      t=b.createElement(e); t.async=!0; t.src=v; s=b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t,s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  }

  // -------- patch fbq so all tracks go ONLY to our pixel + soft dedupe --------
  (function patchFbq(){
    if (!window.fbq) return setTimeout(patchFbq, 20);
    var orig = window.fbq;
    if (orig.__px_singlePatched) return;

    var recent = Object.create(null);
    function isDup(name, params){
      var key = name + '|' + JSON.stringify(params||{});
      var now = Date.now();
      for (var k in recent) if (now - recent[k] > 1500) delete recent[k];
      if (recent[key]) return true;
      recent[key] = now; return false;
    }

    function fbqPatched(){
      var args = Array.prototype.slice.call(arguments);
      var cmd  = args[0];

      // swallow any init not to our pixel
      if (cmd === 'init' && args[1] !== PIXEL_ID) return;

      // coerce all tracks to our pixel + dedupe
      if (cmd === 'track' || cmd === 'trackCustom') {
        var name   = String(args[1]||'');
        var params = args[2] || {};
        if (isDup(name, params)) return;
        return orig('trackSingle', PIXEL_ID, name, params);
      }
      return orig.apply(this, args);
    }
    for (var k in orig) try { fbqPatched[k] = orig[k]; } catch(_){}
    fbqPatched.__px_singlePatched = true;
    window.fbq = fbqPatched;
  })();

  // -------- init + PageView (to our pixel only) --------
  (function initWhenReady(){
    if (!window.fbq) return setTimeout(initWhenReady, 20);
    if (!window.__META_PIXEL_INITED__) {
      window.__META_PIXEL_INITED__ = true;
      fbq('init', PIXEL_ID);
      fbq('trackSingle', PIXEL_ID, 'PageView');
    }
  })();

  // -------- helpers --------
  function ready(fn){
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once:true });
    } else { fn(); }
  }
  function isShown(el){
    if (!el) return false;
    if (el.hidden) return false;
    var cs = window.getComputedStyle ? getComputedStyle(el) : null;
    if (cs && (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0')) return false;
    if (el.offsetParent === null && (!cs || cs.position !== 'fixed')) return false;
    var r = el.getBoundingClientRect();
    return (r.width > 0 && r.height > 0);
  }
  function numFromElText(sel){
    var el = document.querySelector(sel);
    if (!el) return undefined;
    var m = (el.textContent||'').match(/[\d.,]+/);
    if (!m) return undefined;
    var n = Number(m[0].replace(/,/g,''));
    return isFinite(n) ? n : undefined;
  }
  function fbqSafe(eventName, params){
    try {
      if (!window.fbq) return;
      var name = String(eventName||'').replace(/\s+/g,'');
      var payload = Object.assign({ currency:'USD', content_type:'product' }, params||{});
      fbq('trackSingle', PIXEL_ID, name, payload);
    } catch(e){}
  }

  // -------- state-based firing with strict once-gates --------
  var fired = { ATC:false, IC:false, API:false };
  function fireATC(){  if (!fired.ATC) { fired.ATC = true; fbqSafe('AddToCart', { value: 90 }); } }
  function fireIC(){   if (!fired.IC)  { fired.IC  = true; fbqSafe('InitiateCheckout'); } }
  function fireAPI(){
    if (!fired.API) {
      fired.API = true;
      var total = numFromElText('#coTotal');
      total != null ? fbqSafe('AddPaymentInfo', { value: total }) : fbqSafe('AddPaymentInfo');
    }
  }

  function bindObservers(){
    var modal = document.getElementById('checkoutModal');
    var s1 = document.getElementById('coStep1');
    var s2 = document.getElementById('coStep2');
    var s3 = document.getElementById('coStep3');

    function check(){
      // Modal open => AddToCart
      if (modal && isShown(modal)) fireATC();
      // Step 2 shown => InitiateCheckout
      if (s2 && isShown(s2)) fireIC();
      // Step 3 shown => AddPaymentInfo
      if (s3 && isShown(s3)) fireAPI();
    }

    // initial and delayed checks
    setTimeout(check, 60);
    setTimeout(check, 200);

    // observe any attribute/class/style changes that reveal steps/modal
    try {
      var mo = new MutationObserver(check);
      mo.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['hidden','aria-hidden','class','style']
      });
    } catch(_){}

    // ultra-robust: detect modal open caused by *any* click
    document.addEventListener('click', function(){
      var wasATC = fired.ATC;
      setTimeout(function(){
        if (!wasATC && modal && isShown(modal)) fireATC();
      }, 60);
    }, true);
  }

  // also hook your globals if present (no behavior change, just signal)
  function wrapWhenAvailable(name, onCall){
    var tries = 0;
    (function tryWrap(){
      var fn = window[name];
      if (typeof fn === 'function' && !fn.__px_wrapped__) {
        var orig = fn;
        var wrapped = function(){
          try { onCall(); } catch(_){}
          return orig.apply(this, arguments);
        };
        wrapped.__px_wrapped__ = true;
        try { Object.defineProperty(wrapped, 'name', { value: name }); } catch(_){}
        window[name] = wrapped; return;
      }
      if (tries++ < 80) setTimeout(tryWrap, 100);
    })();
  }

  ready(function(){
    bindObservers();
    wrapWhenAvailable('checkoutOpen', fireATC);
    wrapWhenAvailable('gotoStep2',    fireIC);
    wrapWhenAvailable('gotoStep3',    fireAPI);
  });

  // -------- optional: Purchase browser+server helper (unchanged for you) --------
  window.firePurchase = async function(opts){
    opts = opts || {};
    var value    = Number(opts.value || 0);
    var currency = opts.currency || 'USD';
    var contents = opts.contents || [];
    var order_id = opts.order_id || null;
    var event_id = opts.event_id || (self.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
    var params   = { value, currency, contents, content_type:'product', order_id, event_id };

    fbqSafe('Purchase', params);
    try {
      await fetch('/api/meta/capi', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ event:'Purchase', value, currency, contents, order_id, event_id })
      });
    } catch(_) {}
    return event_id;
  };
})();
