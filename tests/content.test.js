'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const content = require('../untappd-atlas/assets/content.js');
const fields = JSON.parse(fs.readFileSync(path.join(__dirname, '../untappd-atlas/assets/content.json'), 'utf8'));

test('all editable text keys used by the dashboard are declared and have defaults', () => {
  const source = fs.readFileSync(path.join(__dirname, '../untappd-atlas/assets/dashboard.js'), 'utf8');
  for (const match of source.matchAll(/(?:t|h)\('([a-z_]+)'\)/g)) assert.ok(fields[match[1]], match[1]);
  assert.ok(Object.keys(fields).length >= 60);
  for (const field of Object.values(fields)) assert.ok(typeof field.default === 'string' && field.default.length > 0);
});
test('custom report captions interpolate only named values without evaluating code', () => {
  assert.equal(content.format('{profile} : {count} découvertes en {years} ans', {profile: 'Alice', count: '1 234', years: 4}), 'Alice : 1 234 découvertes en 4 ans');
  assert.equal(content.format('{unknown} ${alert(1)} {count}', {count: 5}), '{unknown} ${alert(1)} 5');
  const inherited = Object.create({profile: 'wrong'}); inherited.count = 0;
  assert.equal(content.format('{profile} {count}', inherited), '{profile} 0');
});

test('explicitly hidden captions stay empty while missing captions retain their fallback', () => {
  assert.equal(content.value({note: ''}, 'note', 'Default note'), '');
  assert.equal(content.value({}, 'note', 'Default note'), 'Default note');
  assert.equal(content.value({note: '{count} photos'}, 'note', '', {count: 0}), '0 photos');
  assert.equal(content.value(Object.create({note: 'wrong'}), 'note', 'Fallback'), 'Fallback');
});
test('custom text is escaped before entering HTML and intentional line breaks survive', () => {
  const raw = content.format('{profile}\n<img src=x onerror="alert(1)"> & texte', {profile: '<script>bad()</script>'});
  const html = content.html(raw);
  assert.ok(!html.includes('<script>') && !html.includes('<img'));
  assert.ok(html.includes('&lt;img') && html.includes('<br>') && html.includes('&amp; texte'));
});
test('PNG renderer uses custom titles, subtitles and current statistics without HTML execution', () => {
  const vm = require('node:vm');
  const C = require('../untappd-atlas/assets/core.js');
  const E = require('../untappd-atlas/assets/export.js');
  const window = {UATCore: C, UATExport: E, UATContent: content};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../untappd-atlas/assets/dashboard.js'), 'utf8'), {window, document: {querySelectorAll: () => []}});
  const s = C.analyze(C.demo());
  const texts = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.default]));
  Object.assign(texts, {poster_title: 'Les découvertes de {profile}', heat_title: 'Mes horaires <personnels>', heat_subtitle: '{count} découvertes', styles_title: 'Mes familles & styles'});
  const svg = window.UATView.poster(s, {texts, variables: {profile:'Alice', count:String(s.total), rated:s.rated, median:s.median, styles:s.styles.length, breweries:s.uniqueBreweries, beers:s.uniqueBeers, venues:s.venues.length, timezone:s.timezone}});
  assert.ok(svg.includes('Les découvertes de Alice'));
  assert.ok(svg.includes('Mes horaires &lt;personnels&gt;'));
  assert.ok(svg.includes(s.total + ' découvertes'));
  assert.ok(svg.includes('Mes familles &amp; styles'));
  assert.ok(!svg.includes('Quand je découvre'));
});

test('badge titles and levels are configurable and hideable without changing the imported records', () => {
  const vm = require('node:vm'), C = require('../untappd-atlas/assets/core.js');
  const window = {UATCore: C, UATExport: require('../untappd-atlas/assets/export.js'), UATContent: content};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../untappd-atlas/assets/dashboard.js'), 'utf8'), {window, document: {querySelectorAll: () => []}});
  const s = C.analyze([C.normalize({checkin_id: '1', created_at: '2024-01-01', beer_name: 'Test', badges: ['Explorer (Level 4)']})]);
  const custom = window.UATView.badgeTiles(s, {badge_title: 'Badge : {badge}', badge_level: 'Palier <{level}>'});
  assert.ok(custom.includes('Badge : Explorer') && custom.includes('Palier &lt;4&gt;'));
  assert.ok(!custom.includes('Niveau 4'));
  assert.ok(!window.UATView.badgeTiles(s, {badge_title: '', badge_level: ''}).includes('<p>'));
  assert.equal(s.badges[0].level, 4);
  assert.ok(window.UATView.badgeTiles(s).includes('Niveau 4'), 'another widget retains its default caption');
});

test('PNG descriptions use live counts, custom metric labels and explicit hiding', () => {
  const vm = require('node:vm'), C = require('../untappd-atlas/assets/core.js');
  const window = {UATCore: C, UATExport: require('../untappd-atlas/assets/export.js'), UATContent: content};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../untappd-atlas/assets/dashboard.js'), 'utf8'), {window, document: {querySelectorAll: () => []}});
  const s = C.analyze(C.demo()), texts = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.default]));
  Object.assign(texts, {photos_label: 'Mes images', poster_missing_description: 'Photos absentes : {photo_unknown}', poster_coverage_title: '', poster_absence_description: '', brand: '', tagline: ''});
  const svg = window.UATView.poster(s, {texts});
  assert.ok(svg.includes('Mes images') && svg.includes('Photos absentes : ' + s.photoUnknown));
  assert.ok(!svg.includes('COUVERTURE DES DONNÉES') && !svg.includes('Les champs absents ne sont pas assimilés'));
  assert.ok(!svg.includes('UNTAPPD ATLAS') && !svg.includes('Votre histoire, canette après canette.'));
  assert.ok(!svg.includes('{photo_unknown}'));
});
