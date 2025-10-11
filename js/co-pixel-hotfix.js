/* ===== co-pixel-hotfix.js — Additive Pixel+CAPI Layer (v1) =====
   Safe, append-only:
   - Loads FB base if missing
   - Inits Pixel 1051611783243364 (once)
   - Overrides fbqSafe to trackSingle -> 1051611783243364
   - CAPI relay to /api/meta/capi.js with hashed email/phone + _fbp/_fbc
   - Per-session de-dupe; no changes to your checkout UX
*/
(function(){
  'use strict';

  var PIX = '1051611783243364';
  var STORE = 'co_evt_seen_hotfix_v1';
  var SESS  = (function(){ var k='co_sess_hotfix_v1', v=sessionStorage.getItem(k); if(!v){ v=Math.random().toString(36).slice(2)+Date.now(); sessionStorage.setItem(k,v);} return v; })();

  function readCookie(name){ var m=document.cookie.match('(^|;)\\s*'+name+'\\s*=\\s*([^;]+)'); return m?m.pop():''; }
  function getFBP(){ return readCookie('_fbp'); }
  function getFBC(){ var c=readCookie('_fbc'); if(c) return c; var p=new URLSearchParams(location.search); var id=p.get('fbclid'); return id?('fb.1.'+Date.now()+'.'+id):''; }
  function getVal(sel){ var el=document.querySelector(sel); return el?String(el.value||'').trim():''; }

  function seen(e){ try{ var m=JSON.parse(sessionStorage.getItem(STORE)||'{}'); return !!m[e]; }catch(_){ return false; } }
  function mark(e){ try{ var m=JSON.parse(sessionStorage.getItem(STORE)||'{}'); m[e]=1; sessionStorage.setItem(STORE, JSON.stringify(m)); }catch(_){ } }

  function sha256Hex(str){
    try { var enc=new TextEncoder().encode(str); return crypto.subtle.digest('SHA-256', enc).then(function(buf){ return Array.from(new Uint8Array(buf), function(b){ return b.toString(16).padStart(2,'0'); }).join(''); }); }
    catch(e){ return Promise.resolve(''); }
  }

  function ensureBaseLoaded(){
    return new Promise(function(res){
      try { if (window.fbq && window.fbq.callMethod) return res();
        if (!document.querySelector('script[src*="fbevents.js"]')){ var s=document.createElement('script'); s.async=true; s.src='https://connect.facebook.net/en_US/fbevents.js'; s.onload=res; s.onerror=res; document.head.appendChild(s); }
        else { var ready = function(){ if(window.fbq && window.fbq.callMethod) res(); else setTimeout(ready,50); }; ready(); }
      } catch(_){ res(); }
    });
  }

  function lazyInit(){
    try { var has = !!(fbq.getState && (fbq.getState().pixels||[]).length);
      if (!has) fbq('init', PIX);
    } catch(_){}
  }

  function capiPost(eventName, eventId, params){
    return Promise.resolve().then(function(){ return Promise.all([
      sha256Hex((getVal('[name="email"],#email')||'').toLowerCase()),
      sha256Hex((getVal('[name="phone"],#phone')||'').replace(/[^0-9+]/g,''))
    ]); }).then(function(h){
      var user_data={}; if(h[0]) user_data.em=h[0]; if(h[1]) user_data.ph=h[1];
      var _fbp=getFBP(); if(_fbp) user_data.fbp=_fbp; var _fbc=getFBC(); if(_fbc) user_data.fbc=_fbc;
      var payload = {
        event_name: eventName,
        event_id: eventId,
        event_time: Math.floor(Date.now()/1000),
        action_source: 'website',
        event_source_url: location.href,
        user_data: user_data,
        custom_data: Object.assign({ currency:'USD', content_type:'product' }, params||{})
      };
      return fetch('/api/meta/capi.js', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload), keepalive:true }).catch(function(){});
    });
  }

  function wrapFbqSafe(){
    var orig = window.fbqSafe;
    window.fbqSafe = function(event, params, opts){
      // 1) Browser pixel
      try { lazyInit(); if (window.fbq) fbq('trackSingle', PIX, event, params||{}, opts||{}); } catch(_){}
      // 2) CAPI relay (deduped)
      var key = String(event||''); if (!seen(key)){ mark(key); var eid = key + '::' + SESS; capiPost(key, eid, params||{}); }
      // 3) Call original if needed
      try { return orig && orig.apply(this, arguments); } catch(_){}
    };
  }

  ensureBaseLoaded().then(function(){
    try { fbq('init', PIX); fbq('consent','grant'); fbq('track','PageView'); } catch(_){}
    wrapFbqSafe();
    // If site calls fbq directly, keep passthrough (no-op change)
    var _fbq = window.fbq;
    window.fbq = function(){ try { return _fbq.apply(this, arguments); } catch(_){}};
    console.log('[co-pixel-hotfix] ready →', (fbq.getState && (fbq.getState().pixels||[]).map(function(p){return p.id; })) || []);
  });
})();