'use strict';
const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../untappd-atlas/assets/core.js');
const E = require('../untappd-atlas/assets/export.js');
const make = (id, date, rating = 4, extra = {}) => C.normalize({checkin_id: id, created_at: date, beer_name: 'Bière ' + id, brewery_name: 'Maison', beer_type: 'IPA', rating_score: rating, ...extra});

test('ISO weeks cross calendar years correctly', () => {
  assert.equal(C.weekKey('2021-01-01'), '2020-W53');
  assert.equal(C.weekKey('2021-01-04'), '2021-W01');
  assert.equal(C.weekKey('2024-12-30'), '2025-W01');
});
test('CSV supports quoted commas, line breaks, escaped quotes, BOM and semicolons', () => {
  const csv = '\uFEFFcheckin_id;created_at;beer_name;brewery_name;rating_score;comment;photo_url\r\n1;2024-12-31 23:30:00;"Bière; spéciale";"La ""Maison""";"3,75";"Texte\nmultiligne";\r\n';
  const p = C.parse(csv, 'export.csv');
  assert.equal(p.items[0].beer, 'Bière; spéciale');
  assert.equal(p.items[0].brewery, 'La "Maison"');
  assert.equal(p.items[0].shout, 'Texte\nmultiligne');
  assert.equal(p.items[0].rating, 3.75);
  assert.equal(p.items[0].photos, 0);
  assert.equal(p.items[0].date, '2024-12-31T23:30:00.000Z');
  assert.throws(() => C.csv('a,b\n"unfinished,4'), /guillemets/);
});
test('deduplicates IDs while preserving legitimate repeated beers and rows with no IDs', () => {
  const row = {checkin_id: '42', created_at: '2024-01-01T12:00:00Z', beer_name: 'A'};
  const p = C.parse(JSON.stringify([row, row, {...row, checkin_id: '43'}, {...row, checkin_id: ''}, {...row, checkin_id: ''}, {...row, created_at: 'invalid'}]), 'a.json');
  assert.equal(p.items.length, 4); assert.equal(p.duplicates, 1); assert.equal(p.invalid, 1); assert.equal(p.missingIds, 2);
});
test('unknown media and comments stay unknown rather than becoming zero', () => {
  const rows = [make('1', '2024-01-01T18:00:00Z', 0), make('2', '2024-01-02T18:00:00Z', 4, {media: {count: 0}, comments: {count: 0, items: []}}), make('3', '2024-01-03T18:00:00Z', 5, {media: {count: 2}, comments: {count: 3, items: [{user: {uid: 9, user_name: 'A'}, comment: 'Super'}, {user: {uid: 9, user_name: 'A'}, comment: 'Bis'}]}})];
  const s = C.analyze(rows, {timezone: 'UTC'});
  assert.equal(s.rated, 2); assert.equal(s.unrated, 1); assert.equal(s.average, 4.5); assert.equal(s.median, 4.5);
  assert.equal(s.withPhotos, 1); assert.equal(s.withoutPhotos, 1); assert.equal(s.photoUnknown, 1); assert.equal(s.photos, 2);
  assert.equal(s.comments, 3); assert.equal(s.commentsUnknown, 1); assert.equal(s.distinctCommenters, 1); assert.equal(s.commenters[0].count, 2); assert.equal(s.commentersComplete, false);
});
test('timezone and DST are applied before filtering and daily/weekly aggregation', () => {
  const a = make('1', '2024-12-31T23:30:00Z'), b = make('2', '2025-01-02T23:30:00Z');
  const s = C.analyze([a, b], {timezone: 'Europe/Paris', from: '2025-01-01', to: '2025-01-03'});
  assert.equal(s.total, 2); assert.equal(s.first.local.day, '2025-01-01'); assert.equal(s.first.local.hour, 0);
  assert.deepEqual(s.periods('day').map(r => r.count), [1, 0, 1]);
  assert.equal(s.periods('day')[1].average, null);
  assert.equal(s.periods('week')[0].key, '2025-W01');
  assert.equal(C.zoned('2024-03-31T01:30:00Z', 'Europe/Paris').hour, 3);
});
test('unique beers use IDs and brewery fallback names; zero IBU is retained', () => {
  const rows = [make('1', '2024-01-01T18:00:00Z', 3, {bid: 90, beer_ibu: 0}), make('2', '2024-01-02T18:00:00Z', 5, {bid: 90, brewery_name: 'Maison', beer_ibu: 20}), make('3', '2024-01-03T18:00:00Z', 4, {bid: 91, brewery_name: 'Autre'})];
  const s = C.analyze(rows, {timezone: 'UTC'});
  assert.equal(s.uniqueBeers, 2); assert.equal(s.uniqueBreweries, 2); assert.equal(s.averageIBU, 10);
  assert.equal(s.beers[0].count, 2); assert.equal(s.beers[0].average, 4);
  assert.equal(s.streak.count, 3);
});
test('style time series totals reconcile for every grain and empty selections export', () => {
  const items = C.demo(), s = C.analyze(items);
  for (const grain of ['day', 'week', 'month', 'year']) {
    assert.equal(s.periods(grain).reduce((n, p) => n + p.count, 0), s.total);
    assert.equal(s.stylePeriods(grain).reduce((n, p) => n + p.count, 0), s.total);
  }
  const empty = C.analyze(items, {from: '2030-01-01'});
  assert.equal(empty.total, 0); assert.equal(empty.average, null);
  assert.ok(E.sheetsFor(empty).length >= 20);
});
test('XLSX is a ZIP of OpenXML files; formula-looking strings remain text', async () => {
  const s = C.analyze([make('1', '2024-01-01T00:00:00Z', 4, {beer_name: '=HYPERLINK("http://example.com")', comment: '<script>&"\u0001'})]);
  const blob = E.xlsx(s, {profile: 'Colonelchaboum'}), bytes = new Uint8Array(await blob.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 4)], [80, 75, 3, 4]);
  const content = new TextDecoder().decode(bytes);
  assert.ok(content.includes('t="inlineStr"')); assert.ok(!content.includes('<f>')); assert.ok(content.includes('&lt;script&gt;&amp;&quot;'));
  const target = path.join(__dirname, '../test-artifacts');
  fs.mkdirSync(target, {recursive: true}); fs.writeFileSync(path.join(target, 'export-test.xlsx'), bytes);
});
