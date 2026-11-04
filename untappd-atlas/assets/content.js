(function (root) {
  'use strict';
  function format(template, values = {}) {
    return String(template ?? '').replace(/\{([a-z][a-z0-9_]*)\}/g, (match, key) => Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match);
  }
  function html(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])).replace(/\r?\n/g, '<br>');
  }
  function value(texts, key, fallback = '', values = {}) {
    return format(Object.prototype.hasOwnProperty.call(texts || {}, key) ? texts[key] : fallback, values);
  }
  const api = {format, html, value};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.UATContent = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
