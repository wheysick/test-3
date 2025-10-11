/* ===== script.js v6.4 — per-hour countdown + announcer arrows-only ===== */
(function(){
  const yEl = document.getElementById('year'); if (yEl) yEl.textContent = new Date().getFullYear();
  const dateEl = document.getElementById('todayDate'); if (dateEl) dateEl.textContent = new Date().toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'});

  // Countdown to next hour (resets every hour)
  function tick(){
    const now = new Date();
    const next = new Date(now);
    next.setHours(now.getHours()+1,0,0,0);
    let ms = Math.max(0, next - now);
    const h = String(Math.floor(ms/3.6e6)).padStart(2,'0');
    const m = String(Math.floor(ms%3.6e6/6e4)).padStart(2,'0');
    const s = String(Math.floor(ms%6e4/1e3)).padStart(2,'0');
    const t = `${h}:${m}:${s}`;
    document.querySelectorAll('#countdown,[data-countdown]').forEach(n=>n.textContent=t);
    requestAnimationFrame(tick);
  }
  tick();

  // Mobile announcement rotator with plain arrows
  const ann = document.querySelector('.announcer');
  if (ann){
    const msgEl = ann.querySelector('.announce-msg');
    const prev = ann.querySelector('.ann-prev');
    const next = ann.querySelector('.ann-next');
    const messages = [
      `Free bottle offer ends in <strong data-countdown>00:00:00</strong>`,
      `Complimentary shipping cutoff: <strong>Midnight</strong>`
    ];
    let idx = 0, timer;
    const render = () => { msgEl.innerHTML = messages[idx]; };
    const start = () => { clearInterval(timer); timer = setInterval(()=>{ idx = (idx+1)%messages.length; render(); }, 5000); };
    render(); start();
    prev?.addEventListener('click', ()=>{ idx = (idx-1+messages.length)%messages.length; render(); start(); });
    next?.addEventListener('click', ()=>{ idx = (idx+1)%messages.length; render(); start(); });
  }

  // COA flip
  const productImg = document.getElementById('productImg');
  const coaLink = document.getElementById('coaLink');
  const productSrc = productImg?.getAttribute('data-src') || productImg?.src || '';
  const coaSvg = `data:image/svg+xml;utf8,`+encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='900' height='600'><rect fill='#11161c' width='100%' height='100%'/><text x='50%' y='45%' fill='#E9ECF2' font-family='Inter,Arial' font-size='28' text-anchor='middle'>Certificate of Analysis</text><text x='50%' y='55%' fill='#9aa3af' font-family='Inter,Arial' font-size='16' text-anchor='middle'>Placeholder</text></svg>`);
  let showCoa = false;
  if (coaLink && productImg){
    productImg.style.transition = 'transform 260ms ease';
    productImg.style.transformOrigin = '50% 50%';
    coaLink.addEventListener('click', (e)=>{
      e.preventDefault();
      productImg.style.transform = 'rotateY(90deg)';
      setTimeout(()=>{
        showCoa = !showCoa;
        productImg.src = showCoa ? coaSvg : productSrc;
        productImg.style.transform = 'rotateY(0deg)';
      }, 260);
    });
  }
})();
