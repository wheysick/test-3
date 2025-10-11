/* pixel.js — v4.1 (single pixel + eventID + CAPI relay)
   - Loads Meta base, inits Pixel 1051611783243364
   - Forces all tracks to that pixel (trackSingle)
   - Fires ATC / IC / API on real state changes
   - fbqSafe(name, params) now:
       • adds eventID (name::session)
       • POSTs to /api/meta/capi.js with { event, event_id, value, currency, contents }
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
    if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(fn,0);
    else document.addEventListener('DOMContentLoaded', fn);
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

  // -------- unified fbqSafe (adds eventID + CAPI relay) --------
  function fbqSafe(eventName, params){
    try {
      if (!window.fbq) return;
      var name = String(eventName||'').replace(/\s+/g,'');
      var payload = Object.assign({ currency:'USD', content_type:'product' }, params||{});

      // stable-ish session id
      var sessKey = 'co_sess';
      var sess = sessionStorage.getItem(sessKey);
      if (!sess) { sess = Math.random().toString(36).slice(2) + Date.now(); sessionStorage.setItem(sessKey, sess); }
      var eventID = name + '::' + sess;

      // browser
      fbq('trackSingle', PIXEL_ID, name, Object.assign({ eventID: eventID }, payload));

      // CAPI relay to your server
      try {
        fetch('/api/meta/capi.js', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            event: name,
            event_id: eventID,
            value: (typeof payload.value === 'number') ? payload.value : 0,
            currency: payload.currency || 'USD',
            contents: payload.contents || []
          }),
          keepalive: true
        });
      } catch(_) {}
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

    // initial + observe root mutations that could reveal steps
    setTimeout(check, 60);
    try {
      var mo = new MutationObserver(check);
      mo.observe(document.body, { attributes:true, childList:true, subtree:true });
    } catch(_){}
  }

  // wrap when global functions become available (safety net)
  function wrapWhenAvailable(fnName, onCall){
    var tries=0;
    (function tryWrap(){
      var fn = window[fnName];
      if (typeof fn === 'function' && !fn.__px_wrapped) {
        var orig = fn;
        window[fnName] = function(){ try{ onCall(); }catch(_){ } return orig.apply(this, arguments); };
        window[fnName].__px_wrapped = true;
        return;
      }
      if (tries++ < 80) setTimeout(tryWrap, 100);
    })();
  }

  ready(function(){
    bindObservers();
    wrapWhenAvailable('checkoutOpen', fireATC);
    wrapWhenAvailable('gotoStep2',  fireIC);
    wrapWhenAvailable('gotoStep3',  fireAPI);
  });

  // -------- expose purchase helper (adds eventID + CAPI relay) --------
  window.checkoutTrack = window.checkoutTrack || {};
  window.checkoutTrack.purchase = async function(details){
    var value    = (details && typeof details.value === 'number') ? details.value : (numFromElText('#coTotal') || 0);
    var currency = (details && details.currency) || 'USD';
    var contents = (details && details.contents) || [{ id:'tirz-vial', quantity: 1, item_price: 90 }];
    var order_id = (details && details.orderId) || null;

    // stable session
    var sessKey = 'co_sess';
    var sess = sessionStorage.getItem(sessKey);
    if (!sess) { sess = Math.random().toString(36).slice(2) + Date.now(); sessionStorage.setItem(sessKey, sess); }
    var event_id = 'Purchase::' + sess;

    fbqSafe('Purchase', { value: value, currency: currency, contents: contents, order_id: order_id, event_id: event_id });

    try {
      await fetch('/api/meta/capi.js', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ event: 'Purchase', event_id, value, currency, contents, order_id }),
        keepalive:true
      });
    } catch(_) {}
    return event_id;
  };
})();
