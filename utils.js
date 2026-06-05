// utils.js
// Small shared helpers used across screens. Kept as globals for the current
// static-script app shape, while also namespaced for newer code.

(function () {
  function escapeHtml(v) {
    return String(v ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function numbers(arr) {
    return (arr || []).map(Number).filter(x => !isNaN(x));
  }

  function sum(arr) {
    return (arr || []).reduce((a, b) => a + (Number(b) || 0), 0);
  }

  function avg(arr) {
    const v = numbers(arr);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  }

  function fmt(v, dp = 1) {
    return (v === null || v === undefined || isNaN(v)) ? '-' : Number(v).toFixed(dp);
  }

  function pct(p, t) {
    return t ? ((p / t) * 100).toFixed(1) + '%' : '0%';
  }

  function stdDev(arr) {
    const v = numbers(arr);
    if (v.length < 2) return null;
    const a = avg(v);
    return Math.sqrt(v.reduce((s, x) => s + (x - a) ** 2, 0) / (v.length - 1));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function latestDateOf(row) {
    return row?.shot_time || row?.created_at || row?.session_date || row?.round_date || null;
  }

  const api = { escapeHtml, numbers, sum, avg, fmt, pct, stdDev, clamp, latestDateOf };
  window.TCUtils = api;

  // Backwards-compatible names for existing static scripts.
  Object.assign(window, { escapeHtml, sum, avg, fmt, pct, stdDev });
})();
