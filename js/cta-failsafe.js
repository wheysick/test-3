/* === cta-failsafe.js — guarantees CTA opens the checkout modal === */
(function(){
  const CTA_SEL = ".floating-cta,.open-checkout,[data-cta],[data-open-checkout],a[href*='#offer'],a[href*='#checkout'],.masthead-cta";
  function rawOpen(){
    const modal = document.getElementById('checkoutModal');
    if (!modal) return;
    modal.classList.add('show','co-fullscreen');
    document.documentElement.setAttribute('data-checkout-open','1');
    document.body.style.overflow='hidden';
  }
  function rawClose(){
    const modal = document.getElementById('checkoutModal');
    if (!modal) return;
    modal.classList.remove('show','co-fullscreen');
    document.documentElement.removeAttribute('data-checkout-open');
    document.body.style.overflow='';
  }
  if (!window.checkoutOpen)  window.checkoutOpen  = function(){ (window.__co_openModal||rawOpen)(); };
  if (!window.checkoutClose) window.checkoutClose = function(){ (window.__co_closeModal||rawClose)(); };
  function bind(root){
    root.querySelectorAll(CTA_SEL).forEach(el=>{
      if (el.__ctaBound) return;
      const h = function(ev){ ev.preventDefault(); ev.stopPropagation(); window.checkoutOpen(); };
      el.addEventListener('click', h, { capture:true });
      el.addEventListener('pointerup', h, { capture:true });
      el.addEventListener('touchend', h, { capture:true, passive:false });
      el.__ctaBound = true;
    });
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ bind(document); });
  } else {
    bind(document);
  }
  new MutationObserver(function(){ bind(document); })
    .observe(document.documentElement, { subtree:true, childList:true });
})();