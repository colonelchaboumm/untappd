'use strict';
const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const T = require('../untappd-atlas/assets/theme.js');
const base = path.join(__dirname, '../untappd-atlas/assets');
const palette = JSON.parse(fs.readFileSync(path.join(base, 'palette.json'), 'utf8'));

test('every dashboard color has a declared, editable palette token', () => {
  const css = fs.readFileSync(path.join(base, 'dashboard.css'), 'utf8');
  const js = fs.readFileSync(path.join(base, 'dashboard.js'), 'utf8');
  for (const match of (css + js).matchAll(/var\(--uat-([a-z0-9-]+)\)/g)) assert.ok(palette[match[1]], 'Missing token: ' + match[1]);
  assert.ok(Object.keys(palette).length >= 40);
  assert.equal(css.match(/#[a-f\d]{3,8}\b/gi), null, 'CSS must not bypass the palette');
  assert.equal(js.match(/#[a-f\d]{3,8}\b/gi), null, 'SVG and ranking colors must not bypass the palette');
  assert.equal(palette.heading.global, 'primary'); assert.equal(palette.accent.global, 'accent');
});
test('PNG SVG freezes the computed palette of the exporting widget, including alpha', () => {
  const svg = '<svg><rect fill="var(--uat-bg)"/><path stroke="var(--uat-series-2)"/><stop stop-color="var(--uat-shadow)"/></svg>';
  const read = node => ({getPropertyValue: key => node[key] || ''});
  const first = T.inlineSvg(svg, {'--uat-bg':'#001122','--uat-series-2':'rgb(10, 20, 30)','--uat-shadow':'rgba(0, 0, 0, 0.2)'}, read);
  const second = T.inlineSvg(svg, {'--uat-bg':'#ffffff','--uat-series-2':'#ff00aa','--uat-shadow':'transparent'}, read);
  assert.ok(first.includes('fill="#001122"')); assert.ok(first.includes('rgba(0, 0, 0, 0.2)'));
  assert.ok(second.includes('stroke="#ff00aa"')); assert.ok(!first.includes('var(')); assert.ok(!second.includes('var('));
});
test('export rejects an unresolved token instead of producing a wrong-colored report', () => {
  assert.throws(() => T.inlineSvg('<svg fill="var(--uat-bg)"/>', {}, () => ({getPropertyValue: () => ''})), /non résolue/);
});
