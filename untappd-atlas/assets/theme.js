/* Resolve scoped CSS variables before raster export: each Elementor widget keeps its own palette. */
(function (root) {
  'use strict';
  function inlineSvg(source, element, readStyle = node => getComputedStyle(node)) {
    const style = readStyle(element);
    return source.replace(/var\((--uat-[a-z0-9-]+)\)/g, (_, key) => {
      const value = style.getPropertyValue(key).trim();
      if (!value || /var\(/.test(value)) throw new Error('Couleur non résolue : ' + key + '. Actualisez la page avant de réessayer.');
      return value.replace(/[&"<>]/g, c => ({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]));
    });
  }
  const api = {inlineSvg};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.UATTheme = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
