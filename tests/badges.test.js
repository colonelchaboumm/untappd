'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../untappd-atlas/assets/core.js');
const E = require('../untappd-atlas/assets/export.js');
const content = require('../untappd-atlas/assets/content.js');
const row = (id, badges) => C.normalize({checkin_id: id, created_at: `2024-01-0${id}T22:00:00Z`, beer_name: 'Fixture', ...badges});
test('badge absence, explicit zero and partial identity lists are different', () => {
  const s = C.analyze([row(1, {}), row(2, {badges: {count: 0, items: []}}), row(3, {badges: {count: 3, items: [{badge_id: 9, badge_name: 'Explorer'}]}})]);
  assert.equal(s.badgesUnknown, 1); assert.equal(s.badgeAwards, 3); assert.equal(s.badges.length, 1); assert.equal(s.badgesComplete, false);
  assert.equal(row(1, {badges: ['A'], badges_partial: true}).badgesComplete, false);
  const unknown = C.analyze([row(1, {})]);
  assert.equal(E.sheetsFor(unknown)[0].rows.find(r => r[0] === 'Badges distincts observés')[1], null);
});
test('successive badge levels are one distinct badge and separate observed awards', () => {
  const s = C.analyze([row(1, {badges: ['Explorer (Level 2)']}), row(2, {badges: ['Explorer (Level 3)', 'Salut (Niveau 4)']})]);
  assert.equal(s.badges.length, 2); assert.equal(s.badgeAwards, 3);
  assert.equal(s.badges[0].label, 'Explorer'); assert.equal(s.badges[0].level, 3); assert.equal(s.badges[0].count, 2);
  assert.equal(C.analyze(s.rows, {from: '2024-01-02'}).badges[0].level, 3);
});
test('CSV badge lists and API badge objects retain names, levels and valid images', () => {
  const r = C.parse('checkin_id,created_at,beer_name,badges\n1,2024-01-01T00:00:00Z,Fixture,"A (Level 2)|B"\n', 'a.csv').items[0];
  assert.equal(r.badges.length, 2); assert.equal(r.badges[0].level, 2);
  const b = row(1, {badges: {items: [{badge_id: 5, badge_name: 'A', badge_level: 4, badge_image: {sm: 'https://assets.untappd.com/badges/a.png'}}]}}).badges[0];
  assert.equal(b.level, 4); assert.ok(b.image.endsWith('/a.png'));
  for (const bad of ['javascript:alert(1)', 'data:image/svg+xml,bad', 'https://evil.example/a.png', 'https://assets.untappd.com.evil.example/x', 'https://a:b@assets.untappd.com/x']) assert.equal(C.badgeImage(bad), '');
});
test('badges are exported to Excel and escaped in the gallery and PNG', async () => {
  const s = C.analyze([row(1, {badges: [{badge_name: '<img onerror=bad> & Badge', level: 2, image: 'https://evil.example/x'}]})]);
  const window = {UATCore: C, UATExport: E, UATContent: content};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../untappd-atlas/assets/dashboard.js'), 'utf8'), {window, document: {querySelectorAll: () => []}});
  const gallery = window.UATView.badgeTiles(s);
  assert.ok(gallery.includes('&lt;img onerror=bad&gt;')); assert.ok(!gallery.includes('src="https://evil'));
  const texts = Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(path.join(__dirname, '../untappd-atlas/assets/content.json'), 'utf8'))).map(([k,v]) => [k,v.default]));
  assert.ok(window.UATView.poster(s, {texts}).includes('&lt;img onerror=bad&gt;'));
  assert.equal(E.sheetsFor(s).find(sheet => sheet.name === 'Badges').rows[1][2], 2);
  const bytes = new Uint8Array(await E.xlsx(s).arrayBuffer()); assert.deepEqual([...bytes.slice(0,4)], [80,75,3,4]);
});
