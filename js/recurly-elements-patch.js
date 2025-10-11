
/* ===== recurly-elements-patch.js v21 — single-instance Elements, clean tokenization, clear errors =====
   Drop this file after recurly.js and before checkout3.js *or* paste the functions into checkout3.js.
   Required containers in Step 3 markup:
     <div id="re-number"></div>
     <div id="re-month"></div>
     <div id="re-year"></div>
     <div id="re-cvv"></div>
     <div id="re-postal"></div>
*/

(function () {
  if (!window.recurly) {
    console.warn('[Recurly] library not found. Ensure <script src="https://js.recurly.com/v4/recurly.js"></script> is included.');
    return;
  }

  // ---- Singleton Elements ----
  let elements = null;
  let fields = {};
  function mountRecurlyElements() {
    if (elements) return elements; // already mounted
    elements = window.recurly.Elements();

    const style = {
      fontSize: '16px',
      fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
      color: '#eaecef',
      placeholder: { color: 'rgba(234,236,239,.55)' }
    };

    fields.number = elements.CardNumberElement({ style });
    fields.month  = elements.CardMonthElement({ style });
    fields.year   = elements.CardYearElement({ style });
    fields.cvv    = elements.CardCvvElement({ style });
    fields.postal = elements.CardPostalCodeElement({ style });

    // Attach to containers (must exist in DOM)
    const qs = (s) => document.querySelector(s);
    const mounts = [
      ['#re-number',  fields.number],
      ['#re-month',   fields.month],
      ['#re-year',    fields.year],
      ['#re-cvv',     fields.cvv],
      ['#re-postal',  fields.postal]
    ];
    mounts.forEach(([sel, el]) => {
      const host = qs(sel);
      if (!host) console.warn('[Recurly] missing mount point:', sel);
      else el.attach(host);
    });

    return elements;
  }

  function unmountRecurlyElements() {
    if (!elements) return;
    try {
      Object.values(fields).forEach(el => el && el.detach && el.detach());
      elements.destroy();
    } catch {}
    elements = null;
    fields = {};
  }

  // Expose helpers for checkout3.js
  window.__recurlyMount = mountRecurlyElements;
  window.__recurlyUnmount = unmountRecurlyElements;

  // Promise wrapper around recurly.token for nicer async/await
  window.__recurlyTokenize = function(orderMeta = {}){
    return new Promise((resolve, reject) => {
      if (!elements) return reject(new Error('Recurly Elements not mounted'));
      // elements contain postal code field; no need to pass billing_info unless you want to include name/email
      window.recurly.token(elements, orderMeta, (err, token) => {
        if (err) {
          console.warn('[Recurly token error]', err);
          // err.fields is a map e.g., { number: ["is invalid"], month: ["is invalid"], ... }
          const details = err.fields ?
            Object.entries(err.fields).map(([k,v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n')
            : '';
          err.message = details ? `${err.message}\n\n${details}` : err.message;
          reject(err);
        } else {
          resolve(token);
        }
      });
    });
  };
})();
