'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../untappd-atlas/assets/core.js');
const window = {UATCore: C, UATExport: require('../untappd-atlas/assets/export.js'), UATContent: require('../untappd-atlas/assets/content.js')};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../untappd-atlas/assets/dashboard.js'), 'utf8'), {window, document: {querySelectorAll: () => []}});
const V = window.UATView;
const texts = Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(path.join(__dirname, '../untappd-atlas/assets/content.json'), 'utf8'))).map(([k,v]) => [k,v.default]));
const rows = n => Array.from({length:n}, (_,i) => C.normalize({checkin_id:String(i+1), beer_name:'Bière '+i, created_at:'2024-01-01T12:00:00Z', rating_score:i%2 ? 4 : 0}));
const cans = svg => [...svg.matchAll(/class="uat-can" data-checkin-id="([^"]+)"/g)].map(m => m[1]);

test('pyramids preserve every evaluation at triangular boundaries and in remainders', () => {
  for (const n of [0,1,2,3,4,5,6,10,36,37,300,301,1510,5000]) {
    const s=C.analyze(rows(n));
    const layout=V.pyramidLayout(s);
    assert.equal(layout.reduce((sum,g)=>sum+g.piles.reduce((k,h)=>k+h*(h+1)/2,0),0),n);
    const actual=cans(V.pyramids(s,texts));
    assert.equal(actual.length,n); assert.equal(new Set(actual).size,n);
    assert.ok(!V.pyramids(s,texts).match(/NaN|Infinity/));
  }
});
test('year grouping follows the display timezone and filters, including unrated check-ins', () => {
  const a=C.normalize({checkin_id:'old',beer_name:'Old',created_at:'2023-12-31T23:30:00Z'});
  const b=C.normalize({checkin_id:'new',beer_name:'New',created_at:'2024-01-02T12:00:00Z',rating:4});
  const s=C.analyze([a,b],{timezone:'Europe/Paris',to:'2024-01-01'});
  assert.equal(V.pyramidLayout(s)[0].year,'2024');
  assert.deepEqual(cans(V.pyramidCards(s,texts)),['old']);
});
test('page and PNG have one can per imported row, with safe tooltips and unique SVG references', () => {
  const s=C.analyze(C.demo());
  const page=V.pyramidCards(s,texts), poster=V.poster(s,{texts});
  assert.equal(cans(page).length,s.total); assert.equal(cans(poster).length,s.total);
  const all=page+poster, ids=[...all.matchAll(/\bid="(uat-can-[^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length);
  for (const match of all.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(match[1]));
  assert.ok(!all.includes('uat-disc'));
  const malicious=C.analyze([C.normalize({checkin_id:'1',created_at:'2024-01-01',beer_name:'<script>alert(1)</script>',rating:4})]);
  const graphic=V.pyramids(malicious,texts);
  assert.ok(graphic.includes('&lt;script&gt;')); assert.ok(!graphic.includes('<script>'));
});
test('can defaults are grey and are exposed as palette controls', () => {
  const palette=JSON.parse(fs.readFileSync(path.join(__dirname,'../untappd-atlas/assets/palette.json'),'utf8'));
  for (const key of ['can-body','can-highlight','can-shadow','can-outline','can-lid','can-ground']) {
    assert.equal(palette[key].group,'cans');
    const rgb=palette[key].default.slice(1).match(/../g);
    assert.equal(rgb[0],rgb[1]); assert.equal(rgb[1],rgb[2]);
    assert.equal(palette[key].global,undefined);
  }
});

test('depth offsets overlap piles and keep every can inside the fitted scene', () => {
  for (const n of [1,2,5,37,295,1510,5000]) {
    const group=V.pyramidLayout(C.analyze(rows(n)))[0];
    const scene=V.pyramidGeometry(group), b=scene.bounds;
    assert.equal(scene.piles.flatMap(p=>p.cans).length,n);
    scene.piles.forEach((pile,i)=>{
      assert.ok(Math.abs(pile.baseline-pile.x*.10-i*22)<.0001);
      if (i) {
        const previous=scene.piles[i-1];
        assert.ok(pile.x<previous.x+previous.width,'foreground pile overlaps the preceding pile');
      }
      for (const can of pile.cans) {
        assert.ok(can.x>=b.left && can.x+31<=b.right);
        assert.ok(can.y>=b.top && can.y+42<=b.bottom);
      }
    });
  }
});

test('style paints remain stable across dates, style filters and source row order', () => {
  const input=Array.from({length:38},(_,i)=>C.normalize({checkin_id:String(i),beer_name:'Bière '+i,style:'Style '+String(i%13).padStart(2,'0'),created_at:i<19?'2023-01-01':'2024-01-01'}));
  const full=C.analyze(input), filtered=C.analyze(input,{from:'2024-01-01',style:'Style 12'});
  const colors=V.stylePalette(full), subset=V.stylePalette(filtered), reversed=V.stylePalette(C.analyze([...input].reverse()));
  assert.equal(JSON.stringify([...colors]),JSON.stringify([...reversed]));
  for (const [key,paint] of colors) assert.equal(JSON.stringify(paint),JSON.stringify(subset.get(key)));
  assert.equal(new Set([...colors.values()].map(p=>JSON.stringify(p))).size,13);
  const selected=colors.get('Style 12'); assert.ok(selected.mix);
  const graphic=V.pyramidCards(filtered,texts), legend=V.styleLegend(filtered), poster=V.poster(filtered,{texts});
  for (const output of [graphic,legend,poster]) {
    assert.ok(output.includes('fill="'+selected.base+'"'));
    assert.ok(output.includes('fill="'+selected.mix+'" opacity="'+selected.amount+'"'));
  }
  assert.equal(cans(graphic).length,filtered.total);
});

test('all styles have a legend, unknown styles stay neutral, and style captions are escaped', () => {
  const input=Array.from({length:15},(_,i)=>C.normalize({checkin_id:String(i),created_at:'2024-01-01',beer_name:'Bière',style:i===14?'\"><script>bad</script>':'Style '+i}));
  input.push(C.normalize({checkin_id:'unknown',created_at:'2024-01-01',beer_name:'Inconnue'}));
  const s=C.analyze(input), paints=V.stylePalette(s), legend=V.styleLegend(s);
  assert.equal(paints.get('Style inconnu').base,'var(--uat-can-body)');
  assert.equal((legend.match(/data-style=/g)||[]).length,s.styles.length);
  assert.ok(!legend.includes('<script>'));
  assert.ok(!V.pyramidCards(s,texts).includes('<script>'));
  assert.ok(legend.includes('&lt;script&gt;'));
});
