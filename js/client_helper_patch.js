// Minimal client helper to show detailed errors (drop into existing checkout3.js where fetch is performed)
async function postJson(url, body){
  const resp = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  let data = null;
  try { data = await resp.json(); } catch {}
  if (!resp.ok) {
    const msg = (data?.error || 'Payment failed.') + (data?.errors?.length ? '\n\n' + data.errors.join('\n') : '');
    throw new Error(msg);
  }
  return data;
}
