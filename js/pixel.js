// /js/pixel.js
(function () {
  'use strict';

  var PIXEL_ID = '1051611783243364';

  // Load the Pixel base if needed
  if (!window.fbq) {
    !function(f,b,e,v,n,t,s){
      if (f.fbq) return;
      n=f.fbq=function(){ n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) };
      if (!f._fbq) f._fbq=n;
      n.push=n; n.loaded=!0; n.version='2.0'; n.queue=[];
      t=b.createElement(e); t.async=!0; t.src=v;
      s=b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t,s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  }

  function ready(fn){
    if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(fn, 0);
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function uuid() {
    try { return crypto.randomUUID(); }
    catch (_) { return Math.random().toString(36).slice(2) + Date.now(); }
  }

  function getCookie(name){
    var m = document.cookie.match('(?:^|;)\\s*' + name + '=([^;]*)');
    return m ? decodeURIComponent(m[1]) : undefined;
  }

  // Public surface: no patching, no logs
  window.pixel = {
    init: function () {
      try {
        fbq('init', PIXEL_ID);
        fbq('track', 'PageView'); // standard PageView
      } catch (_){}
    },
    track: function (eventName, params) {
      var eventID = uuid();
      params = params || {};
      try { fbq('track', eventName, params, { eventID: eventID }); } catch (_){}

      // Mirror to CAPI (correct route path: /api/meta/capi)
      var payload = {
        event: eventName,
        event_id: eventID,
        value: (typeof params.value === 'number') ? params.value : 0,
        currency: params.currency || 'USD',
        contents: params.contents || [],
        order_id: params.order_id,
        email: params.email,
        fbp: getCookie('_fbp'),
        fbc: getCookie('_fbc')
      };

      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        try { navigator.sendBeacon('/api/meta/capi', new Blob([body], { type:'application/json' })); }
        catch (_){ fetch('/api/meta/capi', { method:'POST', headers:{'Content-Type':'application/json'}, body: body, keepalive:true }); }
      } else {
        fetch('/api/meta/capi', { method:'POST', headers:{'Content-Type':'application/json'}, body: body, keepalive:true });
      }
      return eventID;
    }
  };

  ready(function(){ window.pixel.init(); });
})();
