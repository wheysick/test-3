/* ===== pixel-hotfix.js — Append-only Pixel & CAPI layer v10.12a =====
   Drop-in: include AFTER your existing checkout.js
   <script src="/js/pixel-hotfix.js" defer></script>
*/
(function(){
  var PIXEL_ID = '1051611783243364';
  var DEBUG = true;

  var EV = { ATC:'AddToCart', IC:'InitiateCheckout', API:'AddPaymentInfo' };
  var SEL = {
    openCheckout:  '.open-checkout',
    step1Form:     '#coStep1 form, #coStep1',
    toStep2:       '#coToStep2, #coContinue, button[data-step="2"]',
    toStep3:       '#coToStep3, button[data-step="3"]',
    payWrap:       '#coPayWrap',
    step3Block:    '#coStep3'
  };

  function log(){ if(!DEBUG) return; var a=[].slice.call(arguments); a.unshift('[PIXEL]'); console.log.apply(console,a); }
  function now(){ return Date.now?Date.now():(+new Date()); }
  function uuidv4(){ try{ return crypto.randomUUID(); }catch(_){ return 'ev_'+Math.random().toString(36).slice(2)+'_'+now(); } }
  function safeJSON(o){ try{return JSON.stringify(o||{});}catch(e){return'{}';} }
  function oncePerSession(key){
    var k='px_once_'+key; if(sessionStorage.getItem(k)) return true;
    sessionStorage.setItem(k,'1'); return false;
  }
  function getQty(){
    var el=document.querySelector('#coQty,[name="quantity"],.qty-value,.qty__value');
    var v=el&&(el.value||el.textContent||'').trim(); var n=parseInt(v,10);
    return isNaN(n)?1:Math.max(1,n);
  }
  function getEmail(){
    var el=document.querySelector('#coStep1 [name="email"], [name="email"]');
    return el&&el.value?(el.value+'').trim():'';
  }
  function getValue(){
    var priceEl=document.querySelector('[data-unit-price], .unit-price, #coUnitPrice');
    var unit=45;
    if(priceEl){
      var pv=parseFloat(priceEl.getAttribute&&priceEl.getAttribute('data-unit-price')||priceEl.textContent||'');
      if(!isNaN(pv)&&pv>0) unit=pv;
    }
    return unit*getQty();
  }

  // Ensure Pixel
  (function ensurePixel(){
    if(window.fbq && window._fbq){ log('fbq present'); return; }
    !function(f,b,e,v,n,t,s){ if(f.fbq)return; n=f.fbq=function(){ n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments) };
      if(!f._fbq)f._fbq=n; n.push=n; n.loaded=!0; n.version='2.0';
      n.queue=[]; t=b.createElement(e); t.async=!0; t.src=v;
      s=b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t,s);
    }(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    try{ fbq('init', PIXEL_ID); fbq('track','PageView'); log('fbq init + PageView'); }catch(e){ log('fbq error',e); }
  })();

  function sendCapi(eventName,eventId,params){
    var payload={ event_name:eventName, event_id:eventId, event_time:Math.floor(now()/1000),
      event_source_url:location.href, params:params||{}, email:getEmail()||null };
    fetch('/api/meta/capi',{
      method:'POST', headers:{'Content-Type':'application/json'}, body:safeJSON(payload), keepalive:true
    }).then(function(r){ if(!r.ok) throw new Error('CAPI '+r.status); return r.text(); })
      .then(function(){ log('CAPI OK', eventName, eventId); })
      .catch(function(err){ log('CAPI skip/err', err&&err.message||err); });
  }

  function track(name, params, onceKey){
    try{
      var id=uuidv4(); params=params||{}; params.eventID=id;
      if(onceKey && oncePerSession(onceKey)){ log('skip (dedup):', onceKey); return; }
      fbq('track', name, params); log('fbq track', name, params);
      sendCapi(name, id, params);
    }catch(e){ log('track error', e); }
  }
  function fireATC(){ track(EV.ATC,{value:getValue(),currency:'USD',contents:[{id:'bundle',quantity:getQty()}],content_type:'product'},'ATC'); }
  function fireIC(){  track(EV.IC, {value:getValue(),currency:'USD',num_items:getQty()},'IC'); }
  function fireAPI(){ track(EV.API,{value:getValue(),currency:'USD',payment_method:'card_or_alt'},'API'); }

  document.addEventListener('click', function(e){
    var a=e.target.closest&&e.target.closest(SEL.openCheckout); if(a) fireATC();
    var go2=e.target.closest&&e.target.closest(SEL.toStep2);  if(go2) setTimeout(fireIC,0);
    var go3=e.target.closest&&e.target.closest(SEL.toStep3);  if(go3) setTimeout(fireAPI,0);
    var tile=e.target.closest&&e.target.closest(SEL.payWrap+' [data-pay], '+SEL.payWrap+' .pay-option, '+SEL.payWrap+' input[name=\"payMethod\"]');
    if(tile) setTimeout(fireAPI,0);
  }, true);

  // Visible step 3 observer
  var step3=null, obs;
  function watchStep3(){
    step3=document.querySelector(SEL.step3Block); if(!step3) return;
    if('IntersectionObserver' in window){
      obs=new IntersectionObserver(function(ents){
        ents.forEach(function(ent){ if(ent.isIntersecting) fireAPI(); });
      }, {threshold:0.2});
      obs.observe(step3);
    } else {
      var iv=setInterval(function(){
        if(!document.body.contains(step3)) return clearInterval(iv);
        var st=window.getComputedStyle(step3), vis=st&&st.display!=='none'&&st.visibility!=='hidden'&&step3.offsetParent!==null;
        if(vis) fireAPI();
      },600);
    }
  }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', watchStep3); } else { watchStep3(); }
  new MutationObserver(function(){ if(!step3 && document.querySelector(SEL.step3Block)) watchStep3(); })
    .observe(document.documentElement,{subtree:true, childList:true});

  // Guard against later fbq clobbering; harmless to re-init
  setInterval(function(){ try{ fbq('init', PIXEL_ID); }catch(_){ } }, 15000);

  // Manual testers
  window.__pxTest = { fireATC:fireATC, fireIC:fireIC, fireAPI:fireAPI };

  log('pixel-hotfix.js loaded v10.12a');
})();