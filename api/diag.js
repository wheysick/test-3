
// /api/diag.js — diagnostics: confirms env + module install
module.exports = (req, res) => {
  let hasRecurly = false; let recurlyErr = null;
  try { require.resolve('recurly'); hasRecurly = true; } catch(e){ recurlyErr = e && e.message; }
  const out = {
    node: process.versions && process.versions.node,
    hasRecurly,
    recurlyErr,
    env: {
      RECURLY_API_KEY: !!process.env.RECURLY_API_KEY,
      RECURLY_SITE_ID: process.env.RECURLY_SITE_ID || null
    }
  };
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(out));
};
