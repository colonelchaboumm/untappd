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

test('each year has one supported pyramid and preserves every evaluation at triangular boundaries', () => {
  for (const n of [0,1,2,3,4,5,6,10,36,37,300,301,1510,5000]) {
    const s=C.analyze(rows(n));
    const layout=V.pyramidLayout(s);
    assert.equal(layout.length,n ? 1 : 0);
    if (n) {
      assert.equal(layout[0].piles.length,1);
      assert.equal(V.pyramidGeometry(layout[0]).piles[0].cans.length,n);
    }
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
  for (const match of all.matchAll(/(?:href="#|url\(#)([^"\)]+)/g)) assert.ok(ids.includes(match[1]),match[1]);
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

const near = (actual, expected, message) => assert.ok(Math.abs(actual-expected)<1e-7, message+`: ${actual} versus ${expected}`);
const projected = (matrix,x,y) => ({x:matrix[0]*x+matrix[2]*y+matrix[4],y:matrix[1]*x+matrix[3]*y+matrix[5]});
const inside = (point,bounds,message) => {
  const epsilon=1e-7;
  assert.ok(point.x>=bounds.left-epsilon && point.x<=bounds.right+epsilon,message+' (x)');
  assert.ok(point.y>=bounds.top-epsilon && point.y<=bounds.bottom+epsilon,message+' (y)');
};

test('projected feet rest on the midpoint of two supporting lids at every level', () => {
  for (const n of [1,2,3,5,6,10,37,295,1510,5000]) {
    const scene=V.pyramidGeometry(V.pyramidLayout(C.analyze(rows(n)))[0]);
    assert.equal(scene.piles.flatMap(p=>p.cans).length,n);
    for (const pile of scene.piles) {
      assert.ok(Number.isFinite(pile.scale) && pile.scale>0);
      assert.ok(Number.isFinite(pile.slope));
      const supports=new Map(pile.cans.map(can=>[can.level+':'+can.col,can]));
      for (const can of pile.cans) {
        const origin=pile.project(can.localX,can.localY);
        near(can.x,origin.x,'can x follows the pile projection');
        near(can.y,origin.y,'can y follows the pile projection');
        if (!can.level) continue;
        const left=supports.get((can.level-1)+':'+can.col);
        const right=supports.get((can.level-1)+':'+(can.col+1));
        assert.ok(left && right,'an upper can has two lower supports');
        const foot=pile.project(can.localX+12,can.localY+34.4);
        const leftLid=pile.project(left.localX+12,left.localY+6.1);
        const rightLid=pile.project(right.localX+12,right.localY+6.1);
        near(foot.x,(leftLid.x+rightLid.x)/2,'foot is centred between the supporting lids');
        near(foot.y,(leftLid.y+rightLid.y)/2,'foot rests at the supporting lid height');
      }
    }
  }
});

test('rendered matrices fit cans and shadows, paint nearer piles last and keep floor shadows on level zero', () => {
  for (const n of [1,2,3,6,37,295]) {
    const s=C.analyze(rows(n)),group=V.pyramidLayout(s)[0],scene=V.pyramidGeometry(group);
    const graphic=V.pyramidYear(group,texts,V.stylePalette(s));
    const pileTags=[...graphic.matchAll(/<g class="uat-can-pile" data-depth="([^"]+)" transform="matrix\(([^"]+)\)">/g)];
    assert.equal(pileTags.length,scene.piles.length);
    let previousDepth=-Infinity,total=0;
    pileTags.forEach((tag,i)=>{
      const pile=scene.piles[i],depth=Number(tag[1]),matrix=tag[2].split(/[,\s]+/).map(Number);
      assert.ok(depth>previousDepth,'foreground piles are painted after background piles');
      previousDepth=depth;
      assert.equal(matrix.length,6);assert.ok(matrix.every(Number.isFinite));
      const fragment=graphic.slice(tag.index,pileTags[i+1]?.index ?? graphic.length);
      const painted=[...fragment.matchAll(/<g class="uat-can" ([^>]+)>([\s\S]*?)<\/g>/g)];
      assert.equal(painted.length,pile.cans.length);
      const byId=new Map(pile.cans.map(can=>[can.row.id,can]));
      let previousLevel=-1;
      for (const match of painted) {
        const id=match[1].match(/data-checkin-id="([^"]+)"/)[1];
        const level=Number(match[1].match(/data-level="([^"]+)"/)[1]);
        const local=match[1].match(/transform="translate\(([^"]+)\)"/)[1].split(/[,\s]+/).map(Number);
        const can=byId.get(id);assert.ok(can,'rendered can belongs to the source pile');
        assert.equal(level,can.level);
        assert.ok(level>=previousLevel,'supporting cans are painted before the cans resting on them');
        previousLevel=level;
        near(local[0],can.localX,'rendered local x follows the layout');
        near(local[1],can.localY,'rendered local y follows the layout');
        const origin=projected(matrix,...local);
        near(origin.x,can.x,'rendered matrix projects the can to its scene x');
        near(origin.y,can.y,'rendered matrix projects the can to its scene y');
        // Independent envelope of the shared can artwork, including its rim.
        for (const dx of [0,24]) for (const dy of [2,37]) inside(projected(matrix,local[0]+dx,local[1]+dy),scene.bounds,'can silhouette stays in fitted bounds');
        const floorShadows=[...match[2].matchAll(/<ellipse class="uat-can-floor-shadow" ([^>]+)\/>/g)];
        assert.equal(floorShadows.length,level===0?1:0,'only cans standing on the ground have a floor shadow');
        assert.ok(match[2].includes('class="uat-can-contact"'),'every can retains a contact shadow');
        assert.ok(match[2].indexOf('class="uat-can-contact"')<match[2].indexOf('<use '),'contact shadow is behind the can body');
        for (const shadow of floorShadows) {
          const attribute=name=>Number(shadow[1].match(new RegExp(name+'="([^"]+)"'))[1]);
          const cx=local[0]+attribute('cx'),cy=local[1]+attribute('cy'),rx=attribute('rx'),ry=attribute('ry');
          const centre=projected(matrix,cx,cy);
          const extentX=Math.hypot(matrix[0]*rx,matrix[2]*ry),extentY=Math.hypot(matrix[1]*rx,matrix[3]*ry);
          inside({x:centre.x-extentX,y:centre.y-extentY},scene.bounds,'projected floor shadow minimum stays in bounds');
          inside({x:centre.x+extentX,y:centre.y+extentY},scene.bounds,'projected floor shadow maximum stays in bounds');
        }
        total++;
      }
    });
    assert.equal(total,n);
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

test('all years share one SVG, advance from the oldest to the newest and keep their exact check-ins', () => {
  const input = [1,2,37,295,500].flatMap((count,index) => Array.from({length:count},(_,i) => C.normalize({checkin_id:`${index}-${i}`,beer_name:'Bière',created_at:`${2020+index}-06-01T12:00:00Z`})));
  const stats=C.analyze(input), scene=V.pyramidScene(stats), page=V.pyramidCards(stats,texts);
  assert.equal((page.match(/<svg\b/g)||[]).length,1,'the years are drawn on one common canvas');
  assert.deepEqual(Array.from(scene.layers,layer=>layer.group.year),['2020','2021','2022','2023','2024']);
  assert.deepEqual([...page.matchAll(/class="uat-year-pyramid" data-year="([^"]+)"/g)].map(m=>m[1]),['2020','2021','2022','2023','2024']);
  assert.equal(cans(page).length,input.length);
  assert.equal(new Set(cans(page)).size,input.length);
  const front=scene.layers[scene.layers.length-1];
  assert.equal(front.centerX,0,'the latest year is centred in the foreground');
  assert.equal(front.scale,1,'the foreground establishes the reference size');
  assert.equal(front.side,0);
  const receding=Array.from(scene.layers).reverse();
  for (let i=1;i<receding.length;i++) {
    const current=receding[i],nearer=receding[i-1];
    assert.ok(current.scale<nearer.scale,'every older year gets smaller in perspective');
    assert.ok(current.floor<nearer.floor,'every older year recedes toward the horizon');
    assert.equal(Math.sign(current.centerX),i%2 ? -1 : 1,'depth planes alternate around the central pyramid');
    if (i>1) assert.ok(Math.abs(current.centerX)<Math.abs(nearer.centerX),'distant planes converge toward one vanishing point');
  }
  scene.layers.forEach((layer,i)=>{
    assert.equal(layer.geometry.piles.length,1,'one pyramid represents exactly one year');
    assert.equal(layer.geometry.piles[0].cans.length,[1,2,37,295,500][i]);
    if (i) {
      assert.ok(layer.floor>scene.layers[i-1].floor,'newer years stand closer to the viewer');
      assert.ok(layer.scale>scene.layers[i-1].scale,'nearer cans are larger');
      assert.equal(layer.side,layer.distance % 2 ? -1 : layer.distance ? 1 : 0,'older years alternate left and right');
    }
    const b=layer.geometry.bounds;
    for (const px of [b.left,b.right]) for (const py of [b.top,b.bottom]) inside({x:layer.x+px*layer.scale,y:layer.y+py*layer.scale},scene.bounds,'annual pyramid remains in the common scene');
    assert.ok(page.includes(`class="uat-year-label" data-year="${layer.group.year}"`));
  });
});

test('a long history and an empty selection keep a valid common scene and PNG', () => {
  const input=Array.from({length:24},(_,i)=>C.normalize({checkin_id:`year-${i}`,beer_name:'Bière',created_at:`${2000+i}-01-01T12:00:00Z`}));
  for (const rows of [[],input]) {
    const stats=C.analyze(rows), graphic=V.pyramids(stats,texts), poster=V.poster(stats,{texts});
    assert.equal(cans(graphic).length,rows.length);
    assert.equal(cans(poster).length,rows.length);
    assert.ok(!/NaN|Infinity/.test(graphic+poster));
    assert.equal((graphic.match(/class="uat-year-pyramid"/g)||[]).length,rows.length);
  }
});
