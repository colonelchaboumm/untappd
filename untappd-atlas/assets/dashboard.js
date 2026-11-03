(function () {
  'use strict';
  const C = window.UATCore, E = window.UATExport, esc = E.xml;
  const colors = Array.from({length: 10}, (_, i) => `var(--uat-series-${i + 1})`);
  let canCounter = 0;
  const fmt = (n, digits = 0) => n == null ? '—' : Number(n).toLocaleString('fr-FR', {maximumFractionDigits: digits, minimumFractionDigits: digits});
  const short = (s, n = 28) => String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s);
  const dayLabel = day => day ? new Date(day + 'T12:00:00Z').toLocaleDateString('fr-FR', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}) : '—';
  const text = (x, y, value, size = 12, fill = 'var(--uat-muted)', weight = 400, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" ${extra}>${esc(value)}</text>`;
  const svg = (width, height, content, title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(title)}" font-family="Arial, sans-serif"><title>${esc(title)}</title>${content}</svg>`;
  function stylePalette(s) {
    const counts = new Map();
    for (const row of s.rows || []) counts.set(row.style, (counts.get(row.style) || 0) + 1);
    const catalog = s.styleCatalog || [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([key]) => key);
    let index = 0;
    return new Map(catalog.map(key => {
      if (key === 'Style inconnu') return [key, {base: 'var(--uat-can-body)', mix: null, amount: 0}];
      const i = index++, cycle = Math.floor(i / colors.length), variant = Math.floor((cycle - 1) / 9);
      return [key, {base: colors[i % colors.length], mix: cycle ? colors[(i + 1 + (cycle - 1) % 9) % colors.length] : null, amount: cycle ? .28 + .44 * variant / (variant + 2) : 0}];
    }));
  }
  function paintShape(tag, attributes, paint) {
    return `<${tag} ${attributes} fill="${paint.base}"/>` + (paint.mix ? `<${tag} ${attributes} fill="${paint.mix}" opacity="${paint.amount}"/>` : '');
  }
  function styleSwatch(paint, width = 12, height = 12) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="none" aria-hidden="true">${paintShape('rect', `width="${width}" height="${height}" rx="${Math.min(3, height / 2)}"`, paint)}</svg>`;
  }
  function styleLegend(s) {
    const paints = stylePalette(s);
    return s.styles.map(row => `<span data-style="${esc(row.key)}">${styleSwatch(paints.get(row.key))}${esc(row.label)} <b>${fmt(row.count)}</b></span>`).join('');
  }
  function pyramidLayout(s) {
    const years = new Map();
    for (const row of s.rows) {
      const year = row.local.year;
      if (!years.has(year)) years.set(year, {year, rows: [], piles: []});
      years.get(year).rows.push(row);
    }
    return [...years.values()].sort((a, b) => a.year.localeCompare(b.year)).map(group => {
      let left = group.rows.length;
      while (left > 0) {
        let height = Math.floor((Math.sqrt(8 * left + 1) - 1) / 2);
        while (height * (height + 1) / 2 > left) height--;
        group.piles.push(height); left -= height * (height + 1) / 2;
      }
      return group;
    });
  }
  function pyramidGeometry(group) {
    // One ground plane for the whole stack: lid and foot share this projection.
    // The foot centre (34.4) rests on the supporting lids (6.1), hence 28.3.
    const pitch = 22, rise = 28.3, slope = .12, piles = [];
    let index = 0;
    group.piles.forEach((height, depth) => {
      const scale = 1 + Math.min(depth, 3) * .07;
      const localWidth = (height - 1) * pitch + 24, width = localWidth * scale;
      const previous = piles[depth - 1];
      const x = previous ? previous.x + previous.width - Math.min(width * .65, pitch * previous.scale * 2) : 0;
      const baseline = previous ? previous.floor + 27 * scale - localWidth * slope * scale / 2 : 0;
      const project = (px, py) => ({x: x + px * scale, y: baseline + (py + px * slope) * scale});
      const cans = [];
      for (let level = 0; level < height; level++) {
        for (let col = 0; col < height - level; col++) {
          const localX = (col + level / 2) * pitch, localY = -34.4 - level * rise;
          cans.push({row: group.rows[index++], level, col, localX, localY, ...project(localX, localY)});
        }
      }
      piles.push({height, depth, x, baseline, width, localWidth, scale, slope, rise, pitch, floor: baseline + localWidth * slope * scale / 2, cans, project});
    });
    // Include the shared floor shadow, sheared silhouettes and contact shadows.
    const bounds = {left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity};
    const include = p => { bounds.left = Math.min(bounds.left, p.x); bounds.top = Math.min(bounds.top, p.y); bounds.right = Math.max(bounds.right, p.x); bounds.bottom = Math.max(bounds.bottom, p.y); };
    for (const pile of piles) {
      for (const can of pile.cans) {
        const bottom = can.level ? 37 : 43, right = can.level ? 24 : 36;
        for (const dx of [0, right]) for (const dy of [2, bottom]) include(pile.project(can.localX + dx, can.localY + dy));
      }
      const shadowHeight = Math.max(5, pile.localWidth * .025);
      for (const px of [-8, pile.localWidth + 24]) for (const py of [2 - shadowHeight, 2 + shadowHeight]) include(pile.project(px, py));
    }
    if (!piles.length) Object.assign(bounds, {left: 0, top: 0, right: 1, bottom: 1});
    return {piles, bounds, width: bounds.right - bounds.left, height: bounds.bottom - bounds.top};
  }
  function pyramidYear(group, texts = {}, paints = stylePalette({rows: group.rows})) {
    const uid = 'uat-can-' + (++canCounter), W = 500, H = 480;
    const styles = [...new Set(group.rows.map(row => row.style))], shapeIds = new Map(styles.map((key, i) => [key, `${uid}-shape-${i}`]));
    // Shared vector symbols retain the same style paint in the page and PNG.
    let body = `<defs>
      <linearGradient id="${uid}-metal"><stop stop-color="var(--uat-can-shadow)"/><stop offset=".23" stop-color="var(--uat-can-highlight)"/><stop offset=".48" stop-color="var(--uat-can-lid)"/><stop offset=".82" stop-color="var(--uat-can-body)"/><stop offset="1" stop-color="var(--uat-can-shadow)"/></linearGradient>
      <linearGradient id="${uid}-shade"><stop stop-color="var(--uat-can-shadow)" stop-opacity=".82"/><stop offset=".17" stop-color="var(--uat-can-shadow)" stop-opacity=".08"/><stop offset=".42" stop-color="var(--uat-can-shadow)" stop-opacity="0"/><stop offset=".73" stop-color="var(--uat-can-shadow)" stop-opacity=".05"/><stop offset=".91" stop-color="var(--uat-can-shadow)" stop-opacity=".38"/><stop offset="1" stop-color="var(--uat-can-shadow)" stop-opacity=".86"/></linearGradient>
      <linearGradient id="${uid}-gleam"><stop stop-color="var(--uat-can-highlight)" stop-opacity="0"/><stop offset=".19" stop-color="var(--uat-can-highlight)" stop-opacity=".12"/><stop offset=".25" stop-color="var(--uat-can-highlight)" stop-opacity=".8"/><stop offset=".30" stop-color="var(--uat-can-highlight)" stop-opacity=".23"/><stop offset=".49" stop-color="var(--uat-can-highlight)" stop-opacity=".03"/><stop offset=".77" stop-color="var(--uat-can-highlight)" stop-opacity="0"/><stop offset=".9" stop-color="var(--uat-can-highlight)" stop-opacity=".16"/><stop offset="1" stop-color="var(--uat-can-highlight)" stop-opacity="0"/></linearGradient>
      <linearGradient id="${uid}-lid" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="var(--uat-can-highlight)"/><stop offset=".55" stop-color="var(--uat-can-lid)"/><stop offset="1" stop-color="var(--uat-can-shadow)"/></linearGradient>
      <linearGradient id="${uid}-rim" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--uat-can-shadow)"/><stop offset=".5" stop-color="var(--uat-can-highlight)"/><stop offset="1" stop-color="var(--uat-can-shadow)"/></linearGradient>
      <radialGradient id="${uid}-ground"><stop stop-color="var(--uat-can-ground)" stop-opacity=".45"/><stop offset=".48" stop-color="var(--uat-can-ground)" stop-opacity=".18"/><stop offset="1" stop-color="var(--uat-can-ground)" stop-opacity="0"/></radialGradient>
      <radialGradient id="${uid}-contact"><stop stop-color="var(--uat-can-outline)" stop-opacity=".66"/><stop offset="1" stop-color="var(--uat-can-outline)" stop-opacity="0"/></radialGradient>
      <radialGradient id="${uid}-backdrop" cx=".28" cy=".24" r=".88"><stop stop-color="var(--uat-can-highlight)" stop-opacity=".7"/><stop offset="1" stop-color="var(--uat-bg)" stop-opacity=".18"/></radialGradient>
      <radialGradient id="${uid}-stage"><stop stop-color="var(--uat-can-ground)" stop-opacity=".14"/><stop offset=".6" stop-color="var(--uat-can-ground)" stop-opacity=".06"/><stop offset="1" stop-color="var(--uat-can-ground)" stop-opacity="0"/></radialGradient>`;
    const labelPath = 'd="M2.6 10.9Q12 14.1 21.4 10.9V29.7Q21.4 33.7 12 33.7Q2.6 33.7 2.6 29.7Z"';
    for (const key of styles) {
      const paint = paints.get(key);
      body += `<g id="${shapeIds.get(key)}">
        <path d="M4.3 6.8Q4.3 5 12 5Q19.7 5 19.7 6.8L20.3 9Q22 10.5 22 13V29.8Q22 36 12 36Q2 36 2 29.8V13Q2 10.5 3.7 9Z" fill="url(#${uid}-metal)" stroke="var(--uat-can-outline)" stroke-width=".45"/>
        ${paintShape('path', labelPath, paint)}
        <path ${labelPath} fill="url(#${uid}-shade)"/>
        <path d="M3 14Q12 18 21 14M3 28.6Q12 32.5 21 28.6" fill="none" stroke="var(--uat-can-highlight)" stroke-width=".4" opacity=".5"/>
        <g fill="none" stroke="var(--uat-can-highlight)" stroke-width=".45" stroke-linecap="round" stroke-linejoin="round" opacity=".6">
          <path d="M12 19Q8.2 20 9.1 23Q10 25 12 26.4Q14 25 14.9 23Q15.8 20 12 19ZM12 19V26.4M9.1 21.3 12 23.3 14.9 21.3M9.5 23.6 12 25 14.5 23.6"/>
        </g>
        <path ${labelPath} fill="url(#${uid}-gleam)"/>
        <path d="M3.2 31.8Q12 35.4 20.8 31.8V32.8Q19.9 35.6 12 35.6Q4.1 35.6 3.2 32.8Z" fill="url(#${uid}-rim)"/>
        <path d="M3.5 33.8Q12 37.1 20.5 33.8" fill="none" stroke="var(--uat-can-outline)" stroke-width=".55" opacity=".75"/>
        <path d="M4 33.6Q12 36.4 20 33.6" fill="none" stroke="var(--uat-can-highlight)" stroke-width=".5" opacity=".9"/>
        <path d="M4.3 9Q12 12.5 19.7 9" fill="none" stroke="var(--uat-can-highlight)" stroke-width=".5"/>
        <ellipse cx="12" cy="6.1" rx="8.3" ry="3.4" fill="url(#${uid}-lid)" stroke="var(--uat-can-outline)" stroke-width=".65"/>
        <ellipse cx="12" cy="5.95" rx="7.1" ry="2.5" fill="none" stroke="var(--uat-can-highlight)" stroke-width=".65"/>
        <ellipse cx="12" cy="6" rx="5.8" ry="1.8" fill="none" stroke="var(--uat-can-shadow)" stroke-width=".35"/>
        <ellipse cx="15.1" cy="6.2" rx="2" ry="1" fill="var(--uat-can-shadow)"/>
        <path d="M8.9 4.5Q10.5 3.7 12.1 4.5L12.6 6Q11.3 7.1 9.5 6.5Z" fill="var(--uat-can-lid)" stroke="var(--uat-can-outline)" stroke-width=".45"/>
        <ellipse cx="10.8" cy="5.2" rx=".9" ry=".5" fill="var(--uat-can-shadow)"/>
      </g>`;
    }
    body += '</defs>';
    const geometry = pyramidGeometry(group), b = geometry.bounds;
    const scale = Math.min(3.4, 436 / geometry.width, 326 / geometry.height);
    body += text(30, 48, group.year, 29, 'var(--uat-heading)', 800);
    const unit = group.rows.length === 1 ? texts.pyramid_one_label || 'canette' : texts.pyramid_many_label || 'canettes';
    body += text(470, 46, short(`${fmt(group.rows.length)} ${unit}`, 30), 19, 'var(--uat-muted)', 600, 'text-anchor="end"');
    const floors = geometry.piles.map(pile => pile.floor);
    const floorMin = Math.min(...floors), floorMax = Math.max(...floors);
    const floorY = 409 + ((floorMin + floorMax) / 2 - b.bottom) * scale;
    body += `<ellipse cx="250" cy="${floorY}" rx="204" ry="${Math.max(17, (floorMax - floorMin) / 2 * scale + 18)}" fill="url(#${uid}-stage)"/>`;
    body += `<g transform="translate(${((W - geometry.width * scale) / 2 - b.left * scale).toFixed(3)} ${(409 - b.bottom * scale).toFixed(3)}) scale(${scale.toFixed(5)})">`;
    // Paint a complete stack at a time, from the farthest to the nearest plane.
    for (const pile of geometry.piles) {
      const matrix = `matrix(${pile.scale} ${pile.slope * pile.scale} 0 ${pile.scale} ${pile.x} ${pile.baseline})`;
      body += `<g class="uat-can-pile" data-depth="${pile.depth}" transform="${matrix}">`;
      body += `<ellipse cx="${pile.localWidth / 2 + 8}" cy="2" rx="${pile.localWidth / 2 + 16}" ry="${Math.max(5, pile.localWidth * .025)}" fill="url(#${uid}-ground)"/>`;
      for (const can of pile.cans) {
        const row = can.row;
        const title = `${row.beer} · ${row.style} · ${dayLabel(row.local.day)} ${String(row.local.hour).padStart(2, '0')}:${String(row.local.minute).padStart(2, '0')} · ${row.rating == null ? 'Non notée' : fmt(row.rating, 2) + ' / 5'}`;
        body += `<g class="uat-can" data-checkin-id="${esc(row.id)}" data-style="${esc(row.style)}" data-level="${can.level}" transform="translate(${can.localX} ${can.localY})"><title>${esc(title)}</title>`;
        if (!can.level) body += `<ellipse class="uat-can-floor-shadow" cx="20" cy="37" rx="16" ry="5" fill="url(#${uid}-ground)"/>`;
        // A tight contact shadow on the two supporting lids, never a floor halo in mid-air.
        body += `<ellipse class="uat-can-contact" cx="12" cy="34.7" rx="10.5" ry="2.1" fill="url(#${uid}-contact)"/><use href="#${shapeIds.get(row.style)}"/></g>`;
      }
      body += '</g>';
    }
    body += '</g>' + text(30, 443, short(texts.styles_title || 'Mes styles', 32), 12, 'var(--uat-muted)', 500) + text(470, 443, `${fmt(group.piles.length)} ${group.piles.length === 1 ? 'pyramide' : 'pyramides'}`, 12, 'var(--uat-muted)', 500, 'text-anchor="end"');
    const counts = new Map(); group.rows.forEach(row => counts.set(row.style, (counts.get(row.style) || 0) + 1));
    let bandX = 30;
    body += `<defs><clipPath id="${uid}-band"><rect x="30" y="455" width="440" height="5" rx="2.5"/></clipPath></defs><g clip-path="url(#${uid}-band)">`;
    for (const [key, paint] of paints) {
      const count = counts.get(key) || 0; if (!count) continue;
      const width = count / group.rows.length * 440;
      body += `<g>${paintShape('rect', `x="${bandX}" y="455" width="${width}" height="5"`, paint)}<title>${esc(key)} : ${fmt(count)} check-ins</title></g>`;
      bandX += width;
    }
    body += '</g>';
    body = `<rect x="1" y="1" width="498" height="478" rx="22" fill="var(--uat-surface)" stroke="var(--uat-border)" stroke-opacity=".48"/><rect x="2" y="2" width="496" height="476" rx="21" fill="url(#${uid}-backdrop)"/>` + body;
    return svg(W, H, body, `${group.year} : ${group.rows.length} évaluations, une canette par évaluation, couleur selon le style, réparties en ${group.piles.length} pyramides en relief.`);
  }
  function pyramidCards(s, texts = {}) {
    const groups = pyramidLayout(s), paints = stylePalette(s);
    if (!groups.length) return `<p class="uat-empty">${esc(texts.pyramids_empty || 'Aucune évaluation pour cette période.')}</p>`;
    return groups.map(group => `<div class="uat-pyramid-year">${pyramidYear(group, texts, paints)}</div>`).join('');
  }
  function pyramids(s, texts = {}) {
    const groups = pyramidLayout(s), paints = stylePalette(s), width = 1024, height = groups.length ? Math.ceil(groups.length / 2) * 504 - 24 : 240;
    if (!groups.length) return svg(width, height, text(width / 2, 120, texts.pyramids_empty || 'Aucune évaluation pour cette période.', 22, 'var(--uat-muted)', 400, 'text-anchor="middle"'), 'Aucune évaluation importée.');
    const body = groups.map((group, i) => {
      const row = Math.floor(i / 2), onRow = Math.min(2, groups.length - row * 2), x = (2 - onRow) * 262 + i % 2 * 524;
      return pyramidYear(group, texts, paints).replace('<svg ', `<svg x="${x}" y="${row * 504}" `);
    }).join('');
    return svg(width, height, body, `${s.total} canettes colorées par style : une par évaluation importée, en pyramides regroupées par année.`);
  }

  function heat(s) {
    const width = 430, height = 205, left = 36, top = 26, cellW = 15.6, cellH = 18, max = Math.max(1, ...s.heat.flat());
    let body = '';
    s.heat.forEach((row, day) => {
      body += text(0, top + day * cellH + 12, ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'][day], 11);
      row.forEach((n, h) => { body += `<rect x="${left + h * cellW}" y="${top + day * cellH}" width="12.8" height="14.5" rx="2.5" fill="${n ? 'var(--uat-accent)' : 'var(--uat-heat-empty)'}" opacity="${n ? .18 + .82 * n / max : 1}"><title>${n} check-ins, ${['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][day]}, ${h} h</title></rect>`; });
    });
    [0, 6, 12, 18, 23].forEach(h => { body += text(left + h * cellW, 175, `${h} h`, 10, 'var(--uat-subtle)'); });
    body += text(36, 12, 'moins', 9, 'var(--uat-subtle)');
    for (let i = 0; i < 6; i++) body += `<rect x="${75 + i * 13}" y="3" width="10" height="10" rx="2" fill="var(--uat-accent)" opacity="${.15 + i * .17}"/>`;
    body += text(160, 12, 'plus', 9, 'var(--uat-subtle)');
    return svg(width, height, body, 'Nombre de check-ins par jour de la semaine et heure.');
  }
  function ratings(s) {
    const W = 430, H = 205, max = Math.max(1, ...s.distribution.map(r => r.count)); let body = '';
    [0, .5, 1].forEach(p => { const y = 165 - 135 * p; body += `<path d="M28 ${y}H420" stroke="var(--uat-chart-grid)" stroke-dasharray="3 4"/>` + text(0, y + 4, fmt(Math.round(max * p)), 9); });
    s.distribution.forEach((r, i) => {
      const x = 32 + i * 18.3, h = r.count / max * 135;
      body += `<rect x="${x}" y="${165 - h}" width="13" height="${h}" rx="3" fill="${r.rating >= 4 ? 'var(--uat-accent)' : 'var(--uat-chart-neutral)'}"><title>${r.rating} / 5 : ${r.count} check-ins</title></rect>`;
      if (i % 4 === 0) body += text(x + 6, 185, r.rating, 10, 'var(--uat-subtle)', 400, 'text-anchor="middle"');
    });
    return svg(W, H, body, `Distribution des ${s.rated} notes. Moyenne : ${fmt(s.average, 2)} sur 5.`);
  }
  function timeline(s, grain, average = false) {
    const raw = s.periods(grain), cap = 130, bucket = Math.ceil(raw.length / cap) || 1, rows = [];
    for (let i = 0; i < raw.length; i += bucket) {
      const slice = raw.slice(i, i + bucket), rated = slice.reduce((n, r) => n + r.rated, 0);
      rows.push({key: slice[0].key, end: slice[slice.length - 1].key, count: slice.reduce((n, r) => n + r.count, 0), average: rated ? slice.reduce((n, r) => n + r.sum, 0) / rated : null});
    }
    const max = average ? 5 : Math.max(1, ...rows.map(r => r.count)), left = 27, base = 165, width = 390 / Math.max(1, rows.length); let body = '';
    [0, .5, 1].forEach(p => { const y = base - p * 135; body += `<path d="M27 ${y}H420" stroke="var(--uat-chart-grid)" stroke-dasharray="3 4"/>` + text(0, y + 4, fmt(max * p, average ? 1 : 0), 9); });
    let line = '', previous = false;
    rows.forEach((r, i) => {
      const x = left + (i + .5) * width, value = average ? r.average : r.count;
      if (average) { if (value == null) { previous = false; return; } const y = base - value / max * 135; line += `${previous ? 'L' : 'M'}${x} ${y}`; previous = true; body += `<circle cx="${x}" cy="${y}" r="2.3" fill="var(--uat-accent)"><title>${esc(r.key)} : ${fmt(value, 2)} / 5</title></circle>`; }
      else body += `<rect x="${left + i * width + 1}" y="${base - value / max * 135}" width="${Math.max(.6, width - 2)}" height="${value / max * 135}" rx="${Math.min(3, width / 4)}" fill="var(--uat-accent)"><title>${esc(r.key)}${r.end !== r.key ? ' → ' + esc(r.end) : ''} : ${r.count} check-ins</title></rect>`;
    });
    if (average) body += `<path d="${line}" stroke="var(--uat-accent)" stroke-width="2.4" fill="none"/>`;
    if (rows.length) [0, Math.floor((rows.length - 1) / 2), rows.length - 1].filter((v, i, a) => a.indexOf(v) === i).forEach((i, index, all) => { body += text(left + (i + .5) * width, 187, rows[i].key, 9, 'var(--uat-subtle)', 400, `text-anchor="${index === 0 ? 'start' : index === all.length - 1 ? 'end' : 'middle'}"`); });
    if (bucket > 1) body += text(27, 202, `Regroupement visuel : ${bucket} périodes / point. Détail dans Excel.`, 8, 'var(--uat-subtle)');
    return svg(430, 210, body, average ? 'Évolution de la note moyenne, périodes sans note laissées vides.' : 'Évolution du nombre de check-ins, périodes vides incluses.');
  }
  function styleTimeline(s, grain) {
    const paints = stylePalette(s), periods = s.periods(grain), bucket = Math.ceil(periods.length / 100) || 1, top = s.styles.slice(0, 5), indices = new Map(top.map((r, i) => [r.key, i]));
    const map = new Map(s.stylePeriods(grain).map(r => [r.key, r.count])), rows = [];
    for (let i = 0; i < periods.length; i += bucket) {
      const slice = periods.slice(i, i + bucket), counts = Array(6).fill(0);
      slice.forEach(p => s.styles.forEach(st => counts[indices.has(st.key) ? indices.get(st.key) : 5] += map.get(`${p.key}\t${st.key}`) || 0));
      rows.push({key: slice[0].key, counts});
    }
    const max = Math.max(1, ...rows.map(r => r.counts.reduce((a, b) => a + b, 0))), width = 390 / Math.max(1, rows.length); let body = '';
    [0, .5, 1].forEach(p => { const y = 165 - p * 135; body += `<path d="M27 ${y}H420" stroke="var(--uat-chart-grid)" stroke-dasharray="3 4"/>` + text(0, y + 4, fmt(max * p), 9); });
    rows.forEach((r, i) => { let y = 165; r.counts.forEach((n, j) => { const h = n / max * 135; y -= h; body += `<g>${paintShape('rect', `x="${27 + i * width + 1}" y="${y}" width="${Math.max(.6, width - 2)}" height="${h}"`, j < 5 && top[j] ? paints.get(top[j].key) : {base: 'var(--uat-other)'})}<title>${esc(r.key)} · ${esc(top[j]?.label || 'Autres styles')} : ${n}</title></g>`; }); });
    if (rows.length) { body += text(27, 187, rows[0].key, 9) + text(420, 187, rows[rows.length - 1].key, 9, 'var(--uat-muted)', 400, 'text-anchor="end"'); }
    if (bucket > 1) body += text(27, 202, `Regroupement visuel : ${bucket} périodes / colonne.`, 8);
    return svg(430, 210, body, 'Styles par période, cinq principaux styles et autres.');
  }
  function ranking(rows, maxRows = 7, color = 'var(--uat-accent)') {
    if (!rows.length) return '<p class="uat-empty">Aucune donnée disponible.</p>';
    const max = Math.max(1, rows[0].count);
    return rows.slice(0, maxRows).map((r, i) => {
      const fill = typeof color === 'function' ? styleSwatch(color(r), 100, 4) : '';
      const background = typeof color === 'function' ? '' : `background:${Array.isArray(color) ? color[i % color.length] : color};`;
      return `<div class="uat-rank"><span>${String(i + 1).padStart(2, '0')}</span><div><strong title="${esc(r.label)}">${esc(r.label)}</strong><div class="uat-track"><i style="width:${r.count / max * 100}%;${background}">${fill}</i></div></div><b>${fmt(r.count)}</b></div>`;
    }).join('');
  }
  function badgeTiles(s) {
    if (!s.badges.length) return '<p class="uat-empty">Aucun badge identifié dans les données importées. Un champ absent ne signifie pas que vous n’avez aucun badge.</p>';
    return s.badges.slice(0, 100).map(b => `<article class="uat-badge">${C.badgeImage(b.image) ? `<img src="${esc(C.badgeImage(b.image))}" alt="" loading="lazy" referrerpolicy="no-referrer" width="64" height="64">` : '<span class="uat-badge-icon" aria-hidden="true">🏅</span>'}<div><strong>${esc(b.label)}</strong><p>${b.level == null ? 'Niveau non renseigné' : `Niveau ${fmt(b.level)} observé`} · ${fmt(b.count)} obtention(s) observée(s)</p></div></article>`).join('') + (s.badges.length > 100 ? '<p class="uat-subtle">100 premiers badges affichés ; liste complète dans Excel.</p>' : '');
  }
  function poster(s, meta) {
    const t = key => window.UATContent.format(meta.texts[key] || '', meta.variables || {});
    const paints = stylePalette(s), legendExtra = Math.max(0, Math.ceil(s.styles.length / 3) - 2) * 34;
    const pyramidGraphic = pyramids(s, meta.texts);
    const pyramidBox = pyramidGraphic.match(/viewBox="0 0 (\d+) (\d+)"/);
    const pyramidHeight = Number(pyramidBox[2]) * 1640 / Number(pyramidBox[1]);
    const summaryY = 480 + pyramidHeight + 30, shift = summaryY + 160 - 1660;
    const W = 1800, H = Math.ceil(3660 + shift + legendExtra); let out = `<rect width="${W}" height="${H}" fill="var(--uat-bg)"/>`;
    const panel = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="25" fill="var(--uat-surface)"/>`;
    const embed = (chart, x, y, w) => chart.replace('<svg ', `<svg x="${x}" y="${y}" `).replace(/width="\d+" height="\d+"/, `width="${w}" height="${w * Number(chart.match(/viewBox="0 0 \d+ (\d+)"/)[1]) / Number(chart.match(/viewBox="0 0 (\d+)/)[1])}"`);
    out += text(80, 70, short(t('brand') + ' / ' + t('tagline'), 140), 15, 'var(--uat-ink)', 700);
    out += text(80, 150, short(t(meta.demo ? 'poster_demo_title' : 'poster_title'), 48), 60, 'var(--uat-heading)', 800);
    out += text(80, 193, `${s.first ? dayLabel(s.first.local.day) : '—'} — ${s.last ? dayLabel(s.last.local.day) : '—'} · ${s.timezone} · ${meta.style || 'Tous les styles'}`, 18);
    if (meta.demo) out += text(80, 225, 'DONNÉES FICTIVES — AUCUN RÉSULTAT PERSONNEL', 16, 'var(--uat-demo-text)', 700);
    [[s.total, t('kpi_checkins')], [s.uniqueBeers, t('kpi_beers')], [s.uniqueBreweries, t('kpi_breweries')], [fmt(s.average, 2), t('kpi_average')]].forEach(([n, label], i) => { out += text(80 + i * 420, 329, typeof n === 'number' ? fmt(n) : n, 76, 'var(--uat-ink)', 800) + text(80 + i * 420, 365, short(label, 34), 21); });
    out += text(80, 415, short(t('ring_description'), 150), 19);
    out += text(80, 460, short(t('pyramids_title'), 70), 26, 'var(--uat-heading)', 800);
    out += embed(pyramidGraphic, 80, 480, 1640);
    [[t('first_label'), s.first?.beer || '—', dayLabel(s.first?.local.day)], [t('biggest_label'), `${fmt(s.biggestDay?.count || 0)} check-ins`, dayLabel(s.biggestDay?.key)], [t('last_label'), s.last?.beer || '—', dayLabel(s.last?.local.day)], ['Jours actifs', fmt(s.activeDays), 'Sur les données importées']].forEach(([label, value, sub], i) => {
      const x = 80 + i * 420;
      out += text(x, summaryY, short(label, 30), 14, 'var(--uat-muted)', 600) + text(x, summaryY + 39, short(value, 23), 25, 'var(--uat-ink)', 800) + text(x, summaryY + 68, sub, 16);
    });
    out += `<g transform="translate(0 ${shift})">`;
    s.styles.forEach((st, i) => { const x = 110 + (i % 3) * 555, y = 1660 + Math.floor(i / 3) * 34; out += paintShape('circle', `cx="${x}" cy="${y - 5}" r="6"`, paints.get(st.key)) + text(x + 15, y, `${short(st.label, 45)} · ${fmt(st.count)}`, 15); });
    out += `</g><g transform="translate(0 ${shift + legendExtra})">`;
    const chartPanels = [[t('heat_title'), t('heat_subtitle'), heat(s)], [t('styles_time_title'), t('styles_time_subtitle'), styleTimeline(s, meta.grain || 'month')], [t('ratings_title'), t('ratings_subtitle'), ratings(s)], [t('activity_title'), t('activity_subtitle'), timeline(s, meta.grain || 'month')], [t('average_title'), t('average_subtitle'), timeline(s, meta.grain || 'month', true)]];
    chartPanels.forEach(([title, sub, chart], i) => { const x = 80 + i % 3 * 555, y = 1750 + Math.floor(i / 3) * 345; out += panel(x, y, 530, 320) + text(x + 25, y + 43, short(title, 36), 23, 'var(--uat-heading)', 800) + text(x + 25, y + 72, short(sub, 65), 14) + embed(chart, x + 25, y + 100, 480); });
    out += panel(1190, 2095, 530, 320) + text(1215, 2138, t('social_title'), 23, 'var(--uat-heading)', 800);
    [[s.withPhotos, 'avec photo'], [s.withoutPhotos, 'sans photo (connu)'], [s.withShout, 'textes personnels'], [s.commentsUnknown === s.total ? '—' : s.comments, 'commentaires connus'], [s.distinctCommenters, 'auteurs observés'], [s.toastsUnknown === s.total ? '—' : s.toasts, 'toasts connus']].forEach(([n, label], i) => { const x = 1215 + i % 2 * 245, y = 2205 + Math.floor(i / 2) * 64; out += text(x, y, typeof n === 'number' ? fmt(n) : n, 27, 'var(--uat-ink)', 800) + text(x, y + 20, label, 12); });
    [[t('styles_title'), s.styles], [t('breweries_title'), s.breweries], [t('beers_title'), s.beers]].forEach(([title, rows], i) => { const x = 80 + i * 555, y = 2440; out += panel(x, y, 530, 405) + text(x + 25, y + 44, short(title, 32), 25, 'var(--uat-heading)', 800); rows.slice(0, 7).forEach((r, j) => { const yy = y + 88 + j * 41; out += text(x + 25, yy, `${String(j + 1).padStart(2, '0')}  ${short(r.label, 34)}`, 16, 'var(--uat-ink)') + text(x + 502, yy, fmt(r.count), 16, 'var(--uat-ink)', 700, 'text-anchor="end"') + paintShape('rect', `x="${x + 52}" y="${yy + 9}" width="${Math.max(1, r.count / rows[0].count * 410)}" height="4" rx="2"`, i === 0 ? paints.get(r.key) : {base: colors[i]}); }); });
    out += text(80, 2910, t('yearly_title'), 30, 'var(--uat-heading)', 800);
    const winners = s.yearlyWinners.slice(-12), yearWidth = 1640 / Math.max(1, winners.length);
    winners.forEach((r, i) => { const x = 80 + i * yearWidth; out += text(x, 2953, r.year, 22, 'var(--uat-ink)', 800) + paintShape('rect', `x="${x}" y="2973" width="${yearWidth - 18}" height="14" rx="5"`, paints.get(r.style)) + text(x, 3019, short(r.style, Math.max(10, Math.floor(yearWidth / 8))), 13) + text(x, 3044, `${fmt(r.count)} check-ins`, 12); });
    out += text(80, 3110, 'COUVERTURE DES DONNÉES', 14, 'var(--uat-heading)', 700);
    [meta.status || 'Analyse du fichier fourni.', `${s.photoUnknown} check-ins sans information photo ; ${s.commentsUnknown} sans total de commentaires ; ${s.toastsUnknown} sans total de toasts.`, s.commentersComplete ? 'Auteurs des commentaires : liste complète dans les données importées.' : 'Auteurs des commentaires : minimum observé. Les listes fournies peuvent être partielles.', 'Les champs absents ne sont pas assimilés à zéro. Statistiques limitées aux données importées et aux filtres.', 'Identités sans ID regroupées par nom. Notes à zéro considérées non notées. Dates sans fuseau interprétées en UTC.', 'Le fichier Excel contient les tableaux détaillés, les périodes, les classements et les check-ins.'].forEach((line, i) => { out += text(80, 3147 + i * 29, short(line, 150), 15); });
    out += panel(80, 3320, 1640, 190) + text(105, 3355, short(t('badges_title'), 70), 24, 'var(--uat-heading)', 800);
    out += text(105, 3380, s.badgesUnknown === s.total ? 'Badges non renseignés dans les données importées.' : `${fmt(s.badges.length)} badges distincts observés · ${fmt(s.badgeAwards)} obtentions connues · ${fmt(s.badgesUnknown)} check-ins non renseignés`, 15);
    s.badges.slice(0, 6).forEach((b, i) => { out += text(105 + i % 3 * 535, 3425 + Math.floor(i / 3) * 35, short(b.label, 35) + (b.level == null ? '' : ` · niv. ${b.level}`), 16, 'var(--uat-ink)'); });
    out += `<path d="M80 3580H1720" stroke="var(--uat-border)"/>` + text(80, 3613, short(t('footer_left'), 140), 13) + text(1720, 3613, short(t('brand'), 36), 13, 'var(--uat-ink)', 700, 'text-anchor="end"');
    out += '</g>';
    return svg(W, H, out, 'Rapport Untappd Atlas — pyramides de canettes');
  }

  window.UATView = {stylePalette, styleSwatch, styleLegend, pyramids, pyramidLayout, pyramidGeometry, pyramidYear, pyramidCards, heat, ratings, timeline, styleTimeline, poster, badgeTiles};
  function boot(scope = document) {
    if (scope.matches?.('.uat-app')) mount(scope);
    scope.querySelectorAll('.uat-app').forEach(mount);
  }
  boot();
  function editorHook() { window.elementorFrontend?.hooks.addAction('frontend/element_ready/untappd-atlas.default', scope => boot(scope[0] || scope)); }
  if (window.elementorFrontend?.hooks) editorHook();
  else if (window.jQuery) window.jQuery(window).on('elementor/frontend/init.uat', editorHook);
  function mount(app) {
    if (app.dataset.uatMounted) return;
    app.dataset.uatMounted = '1';
    const config = JSON.parse(app.dataset.config || '{}');
    const texts = config.texts || {};
    let context = {};
    const t = key => window.UATContent.format(texts[key] || '', context);
    const safe = window.UATContent.html;
    const h = key => safe(t(key));
    let items = [], rawMap = new Map(), source = '', profile = '', isDemo = false, state = null, running = false, generation = 0, pending = false, currentStats = null;
    let token = ''; const storageKey = 'untappd-atlas-session:' + config.api;
    try { token = sessionStorage.getItem(storageKey) || ''; } catch (_) { /* Private mode may disable storage; the current tab still works. */ }
    let zone = config.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    try { C.zoned(new Date().toISOString(), zone); } catch (_) { zone = 'UTC'; }
    const zones = [...new Set([zone, Intl.DateTimeFormat().resolvedOptions().timeZone, 'Europe/Paris', 'Europe/Brussels', 'Europe/London', 'America/Montreal', 'America/New_York', 'UTC'].filter(Boolean))];
    app.innerHTML = `<header class="uat-topline"><div class="uat-brand"><i class="uat-logo" aria-hidden="true"></i> ${h('brand')}</div><small>${h('tagline')}</small><span>${h('top_note')}</span></header>
      <section class="uat-intro"><h2>${h('hero_title')}</h2><p>${h('hero_subtitle')}</p></section>
      <section class="uat-import" aria-label="Importer mes données"><form class="uat-import-top"><label class="uat-field uat-profile-field"><span>${h('profile_label')}</span><input name="profile" type="text" placeholder="${esc(t('profile_placeholder'))}" autocomplete="off" maxlength="200" required aria-label="Lien ou pseudo du profil Untappd"></label><button type="submit">${h('import_button')}</button><button type="button" data-action="oauth" class="uat-secondary" ${config.configured ? '' : 'hidden'}>${h('connect_button')}</button></form>
      <div class="uat-import-bottom"><label ${config.configured ? '' : 'hidden'}><input type="checkbox" data-enrich> Approfondir les commentaires et les toasts <span title="Un appel API supplémentaire par check-in. Les identités peuvent rester partielles.">ⓘ</span></label><div class="uat-import-actions"><label class="uat-file">${h('file_button')}<input type="file" accept=".csv,.json,text/csv,application/json" aria-label="Importer un fichier CSV ou JSON"></label><button type="button" class="uat-text-button" data-action="demo">${h('demo_button')}</button></div></div>
      <p class="uat-import-help">${config.configured ? 'L’import par lien utilise l’API Untappd configurée sur ce site. La connexion permet d’autoriser l’accès à votre compte.' : 'Sans clé : lecture des pages publiques uniquement. Untappd peut masquer l’historique ancien et les badges. Aucune connexion à votre compte n’est effectuée.'} Les fichiers sont analysés dans votre navigateur. Les imports par profil sont conservés 24 h et peuvent être effacés ici.</p></section>
      <div class="uat-message" role="status" aria-live="polite" hidden></div><section class="uat-progress" hidden><div><p data-progress-text></p><small data-progress-sub></small></div><div class="uat-progress-actions"><button class="uat-secondary" data-action="pause" type="button">Pause</button><button data-action="resume" type="button">Reprendre</button><button class="uat-secondary" data-action="erase" type="button">Effacer</button></div></section>
      <section class="uat-report" hidden><div class="uat-demo-notice" hidden><strong>DÉMONSTRATION</strong><span>Données entièrement fictives. Elles ne correspondent pas au profil Colonelchaboum.</span></div>
      <div class="uat-report-head"><div><p class="uat-kicker" data-source></p><h2 class="uat-profile-name" data-title></h2></div><div class="uat-export-buttons"><button type="button" class="uat-text-button" data-action="clear">Effacer mes données</button><button type="button" class="uat-secondary" data-action="png">${h('export_png')}</button><button type="button" data-action="xlsx">${h('export_excel')}</button></div></div>
      <div class="uat-filters"><label class="uat-field"><span>Du</span><input type="date" name="from"></label><label class="uat-field"><span>Au</span><input type="date" name="to"></label><label class="uat-field uat-style-field"><span>Style de bière</span><select name="style"><option value="">Tous les styles</option></select></label><label class="uat-field"><span>Périodes</span><select name="grain"><option value="day">Jour</option><option value="week">Semaine</option><option value="month" selected>Mois</option><option value="year">Année</option></select></label><label class="uat-field"><span>Fuseau horaire</span><select name="timezone">${zones.map(z => `<option value="${esc(z)}">${esc(z)}</option>`).join('')}</select></label><button type="button" class="uat-text-button" data-action="reset">Tout afficher</button></div>
      <div class="uat-results"></div></section><div class="uat-onboard"><strong>${h('onboard_title')}</strong><p>${h('onboard_subtitle')}</p></div>
      <footer class="uat-footer"><span>${h('footer_left')}</span><span>${h('footer_right')}</span></footer>`;
    const $ = q => app.querySelector(q);
    const field = name => $(`[name="${name}"]`);
    const action = name => $(`[data-action="${name}"]`);
    const busy = value => { pending = value; $('.uat-import-top button[type=submit]').disabled = value; action('oauth').disabled = value; action('demo').disabled = value; $('.uat-file input').disabled = value; };
    const notify = (message, kind = 'info') => { const el = $('.uat-message'); el.hidden = !message; el.textContent = message; el.dataset.kind = kind; };
    function options() { return {from: field('from').value, to: field('to').value, style: field('style').value, timezone: field('timezone').value}; }
    function statusLabel() {
      if (isDemo) return 'Démonstration — données fictives.';
      if (state?.source === 'public' && source === 'api') return `Lecture publique : ${fmt(state.count)} check-ins importés${state.profile?.expected != null ? ` sur ${fmt(state.profile.expected)} annoncés par le profil` : ''}. ${state.phase === 'done' ? 'Lecture des pages accessibles terminée.' : 'Lecture des informations de bière en cours.'} ${state.public_complete ? '' : 'HISTORIQUE PARTIEL. '}Aucun accès aux données réservées à la connexion Untappd.`;
      if (source === 'file') return 'Analyse du fichier fourni ; la complétude de l’historique dépend de cet export.';
      if (!state || state.phase === 'idle') return 'Import non démarré.';
      if (state.phase === 'done') return `Pagination API terminée : ${fmt(state.count)} check-ins importés.${state.profile?.expected && state.count !== state.profile.expected ? ` Le profil annonce ${fmt(state.profile.expected)} check-ins : écart à vérifier.` : ''}`;
      return `Historique partiel : ${fmt(state.count)} check-ins importés. ${state.phase === 'details' ? `Enrichissement des échanges : ${fmt(state.details_done)} / ${fmt(state.count)}.` : 'Import en cours ou en pause.'}`;
    }
    function progress() {
      $('.uat-progress').hidden = !state || source !== 'api';
      if (!state) return;
      $('[data-progress-text]').textContent = statusLabel();
      $('[data-progress-sub]').textContent = state.retry_at > Date.now() / 1000 ? `Quota atteint. Reprise possible à ${new Date(state.retry_at * 1000).toLocaleString('fr-FR')}.` : 'La progression est conservée dans cette session pendant 24 heures.';
      action('pause').hidden = !running; action('resume').hidden = running || state.phase === 'done' || state.phase === 'idle';
    }
    async function api(path, data, method = 'POST') {
      const res = await fetch(config.api + path, {method, credentials: 'same-origin', headers: {'Content-Type': 'application/json', ...(token ? {'X-UAT-Session': token} : {})}, ...(method === 'GET' ? {} : {body: JSON.stringify(data || {})})});
      let payload; try { payload = await res.json(); } catch (_) { throw new Error('Le serveur n’a pas renvoyé de JSON. Vérifiez les permaliens WordPress et le pare-feu du site.'); }
      if (!res.ok) { if (res.status === 401) { token = ''; try { sessionStorage.removeItem(storageKey); } catch (_) {} } const error = new Error(payload.message || 'La requête a échoué.'); error.code = payload.code; error.retryAt = payload.data?.retry_at; error.status = res.status; throw error; }
      return payload;
    }
    async function session() {
      if (token) return;
      const res = await api('session'); token = res.session;
      try { sessionStorage.setItem(storageKey, token); } catch (_) { /* Current tab only. */ }
    }
    function merge(rawItems) { rawItems.forEach(r => { const n = C.normalize(r, rawMap.size); if (n) rawMap.set(n.id, n); }); items = [...rawMap.values()]; }
    function refreshStyles() {
      const prior = field('style').value;
      field('style').innerHTML = '<option value="">Tous les styles</option>' + [...new Set(items.map(r => r.style))].sort().map(st => `<option value="${esc(st)}">${esc(st)}</option>`).join('');
      field('style').value = prior;
    }
    function setData(data, nextSource, nextProfile, demo = false) {
      items = data; source = nextSource; profile = nextProfile; isDemo = demo;
      field('from').value = ''; field('to').value = ''; field('style').value = '';
      refreshStyles(); render(); progress();
    }
    function render() {
      $('.uat-report').hidden = !items.length; $('.uat-onboard').hidden = !!items.length;
      $('.uat-demo-notice').hidden = !isDemo;
      if (!items.length) { currentStats = null; return; }
      const opts = options();
      if (opts.from && opts.to && opts.from > opts.to) { notify('La date de début doit précéder la date de fin.', 'error'); return; }
      const s = currentStats = C.analyze(items, opts), grain = field('grain').value, paints = stylePalette(s);
      const years = s.first ? Number(s.last.local.year) - Number(s.first.local.year) + 1 : 0;
      context = {profile, years, years_label: fmt(years) + (years === 1 ? ' année' : ' années'), count: fmt(s.total), rated: fmt(s.rated), median: fmt(s.median, 2), styles: fmt(s.styles.length), breweries: fmt(s.uniqueBreweries), beers: fmt(s.uniqueBeers), venues: fmt(s.venues.length), badges: fmt(s.badges.length), badge_awards: fmt(s.badgeAwards), timezone: s.timezone};
      $('[data-source]').textContent = isDemo ? 'EXEMPLE FICTIF / 2021 — 2025' : (source === 'file' ? 'HISTORIQUE IMPORTÉ / ' : (state?.source === 'public' ? 'PROFIL PUBLIC / ' : 'PROFIL UNTAPPD / ')) + profile;
      $('[data-title]').textContent = t(s.first ? 'report_title' : 'report_empty_title');
      const metric = (n, label, small = '') => `<div class="uat-kpi"><strong>${n}</strong><span>${safe(label)}</span>${small ? `<small>${small}</small>` : ''}</div>`;
      const mini = (n, label, small = '') => `<div class="uat-mini"><strong>${n}</strong><span>${safe(label)}</span>${small ? `<small>${small}</small>` : ''}</div>`;
      const card = (title, sub, content, cls = '') => `<article class="uat-card ${cls}"><h3>${safe(title)}</h3><p>${safe(sub)}</p>${content}</article>`;
      const callout = (number, label, value, sub) => `<div class="uat-callout"><h3><span class="uat-number">${number}</span>${safe(label)}</h3><strong>${esc(value)}</strong><p>${esc(sub)}</p></div>`;
      const yearlyCards = s.yearlyWinners.map(r => `<div class="uat-year"><strong>${r.year}</strong><i>${styleSwatch(paints.get(r.style), 100, 12)}</i><span>${esc(r.style)}</span><small>${fmt(r.count)} check-ins</small></div>`).join('');
      const allUnknown = (total, unknown, value) => unknown === total && total > 0 ? '—' : fmt(value);
      const badgeKnown = s.badgesUnknown < s.total;
      const badgeSection = `<div class="uat-section-head"><h3>${h('badges_title')}</h3><p>${h('badges_subtitle')}</p></div><div class="uat-mini-grid">${mini(badgeKnown ? fmt(s.badges.length) : '—', t('badges_unique_label'), 'Minimum observé')}${mini(badgeKnown ? (s.badgesComplete ? '' : '≥ ') + fmt(s.badgeAwards) : '—', t('badges_awards_label'), 'Niveaux successifs inclus si fournis')}${mini(fmt(s.badgesUnknown), t('badges_unknown_label'), 'Absence de champ : inconnu, jamais zéro')}${mini(state?.source === 'public' && source === 'api' ? fmt(state.profile?.expected_badges) : '—', t('badges_total_label'), 'Total du profil, hors filtres ; catalogue parfois masqué')}</div><div class="uat-badge-grid">${badgeTiles(s)}</div>`;
      const coverage = `<section class="uat-coverage"><h3>Ce que racontent ces données</h3><p>${esc(statusLabel())}</p><p>${fmt(s.photoUnknown)} check-ins sans information photo · ${fmt(s.commentsUnknown)} sans total de commentaires · ${fmt(s.toastsUnknown)} sans total de toasts.</p><p>${state?.source === 'public' && source === 'api' ? `Badges annoncés par le profil : ${state.profile?.expected_badges == null ? 'inconnus' : fmt(state.profile.expected_badges)}. Le catalogue complet exige une connexion Untappd ; seules les obtentions visibles sont listées ici.` : 'Les badges sont limités aux champs fournis dans le fichier ou les réponses importées.'}</p><p>${s.commentersComplete ? 'Les auteurs de tous les commentaires des check-ins sélectionnés sont identifiés.' : 'Les auteurs distincts représentent un minimum observé : Untappd ou le fichier peut ne fournir qu’une partie des identités.'}</p><p>Les champs absents restent inconnus. Les notes à zéro sont considérées non notées. Sans identifiant, les bières et brasseries sont regroupées par nom ; des homonymes peuvent se confondre. Les dates sans fuseau sont interprétées en UTC.</p></section>`;
      $('.uat-results').innerHTML = `<div class="uat-kpis">${metric(fmt(s.total), t('kpi_checkins'), `${fmt(s.rated)} notés · ${fmt(s.unrated)} non notés`)}${metric(fmt(s.uniqueBeers), t('kpi_beers'), fmt(s.ratedUniqueBeers) + ' avec une note')}${metric(fmt(s.uniqueBreweries), t('kpi_breweries'), fmt(s.ratedUniqueBreweries) + ' avec une note')}${metric(fmt(s.average, 2), t('kpi_average'), 'Sur les check-ins notés')}</div>
        <p class="uat-ring-description">${h('ring_description')} ${s.first ? `${dayLabel(s.first.local.day)} — ${dayLabel(s.last.local.day)}.` : ''}</p>
        <div class="uat-section-head"><h3>${h('pyramids_title')}</h3></div><div class="uat-pyramids">${pyramidCards(s, texts)}</div>
        <div class="uat-pyramid-callouts">${callout(1, t('first_label'), s.first?.beer || '—', dayLabel(s.first?.local.day))}${callout('↗', t('favorite_label'), s.styles[0]?.label || '—', `${fmt(s.styles[0]?.count || 0)} check-ins`)}${callout(2, t('biggest_label'), `${fmt(s.biggestDay?.count || 0)} check-ins`, dayLabel(s.biggestDay?.key))}${callout(3, t('last_label'), s.last?.beer || '—', dayLabel(s.last?.local.day))}</div>
        <div class="uat-legend uat-style-legend">${styleLegend(s)}</div>
        <div class="uat-section-head"><h3>${h('rhythm_title')}</h3><p>${h('rhythm_subtitle')}</p></div><div class="uat-card-grid">${card(t('heat_title'), t('heat_subtitle'), `<div class="uat-chart">${heat(s)}</div>`)}${card(t('styles_time_title'), t('styles_time_subtitle'), `<div class="uat-chart">${styleTimeline(s, grain)}</div>`)}${card(t('ratings_title'), t('ratings_subtitle'), `<div class="uat-chart">${ratings(s)}</div><p class="uat-chart-note">Notes regroupées au quart de point le plus proche.</p>`)}${card(t('activity_title'), t('activity_subtitle'), `<div class="uat-chart">${timeline(s, grain)}</div>`)}${card(t('average_title'), t('average_subtitle'), `<div class="uat-chart">${timeline(s, grain, true)}</div>`)}${card(t('venues_title'), t('venues_subtitle'), ranking(s.venues, 6, 'var(--uat-series-2)'))}</div>
        <div class="uat-section-head"><h3>${h('favorites_title')}</h3><p>${h('favorites_subtitle')}</p></div><div class="uat-card-grid">${card(t('styles_title'), t('styles_subtitle'), ranking(s.styles, 8, row => paints.get(row.key)))}${card(t('breweries_title'), t('breweries_subtitle'), ranking(s.breweries, 8, 'var(--uat-series-2)'))}${card(t('beers_title'), t('beers_subtitle'), ranking(s.beers, 8, 'var(--uat-series-3)'))}</div>
        ${badgeSection}<div class="uat-section-head"><h3>${h('social_title')}</h3><p>${h('social_subtitle')}</p></div><div class="uat-mini-grid">${mini(fmt(s.withPhotos), 'check-ins avec photo', `${fmt(s.photos)} photos connues`)}${mini(fmt(s.withoutPhotos), 'check-ins sans photo', `${fmt(s.photoUnknown)} non renseignés`)}${mini(fmt(s.withShout), 'textes personnels', 'Votre texte attaché au check-in')}${mini(allUnknown(s.total, s.commentsUnknown, s.comments), 'commentaires connus', `${fmt(s.commentsUnknown)} check-ins non renseignés`)}${mini(fmt(s.distinctCommenters), 'auteurs distincts observés', s.commentersComplete ? 'Liste complète dans les données' : 'Minimum observé')}${mini(allUnknown(s.total, s.toastsUnknown, s.toasts), 'toasts connus', `${fmt(s.toastsUnknown)} check-ins non renseignés`)}${mini(fmt(s.activeDays), 'jours avec un check-in', `${fmt(s.perActiveDay, 2)} check-ins / jour actif`)}${mini(fmt(s.perCalendarDay, 2), 'check-ins / jour calendaire', `${fmt(s.calendarDays)} jours entre les bornes`)}${mini(fmt(s.averageABV, 2) + ' %', 'degré alcoolique moyen', 'Sur les valeurs connues')}${mini(fmt(s.averageIBU, 1), 'IBU moyen', 'Sur les valeurs connues, zéro inclus')}${mini(fmt(s.countries.length), 'pays des lieux visités', 'Selon les lieux renseignés')}${mini(fmt(s.breweryCountries.length), 'pays des brasseries', 'Selon les brasseries renseignées')}</div>
        <div class="uat-section-head"><h3>${h('details_title')}</h3></div><div class="uat-card-grid">${card(t('commenters_title'), t('commenters_subtitle'), ranking(s.commenters, 7, 'var(--uat-accent)'))}${card(t('countries_title'), t('countries_subtitle'), ranking(s.countries, 7, 'var(--uat-series-5)'))}${card(t('servings_title'), t('servings_subtitle'), ranking(s.servings, 7, 'var(--uat-series-4)'))}</div>
        <div class="uat-section-head"><h3>${h('yearly_title')}</h3></div><div class="uat-year-grid">${yearlyCards || '<p class="uat-empty">Aucune donnée.</p>'}</div>${coverage}
        <details class="uat-details"><summary>${h('periods_title')}</summary><div class="uat-table-wrap"><table><thead><tr><th>Période</th><th>Check-ins</th><th>Bières uniques</th><th>Notés</th><th>Moyenne / 5</th><th>Avec photo</th><th>Commentaires connus</th></tr></thead><tbody>${s.periods(grain).map(r => `<tr><td>${esc(r.key)}</td><td>${fmt(r.count)}</td><td>${fmt(r.beers)}</td><td>${fmt(r.rated)}</td><td>${fmt(r.average, 2)}</td><td>${r.photosKnown < r.count ? '≥ ' : ''}${fmt(r.photos)}</td><td>${r.commentsKnown < r.count ? '≥ ' : ''}${fmt(r.comments)}</td></tr>`).join('')}</tbody></table></div></details>
        <details class="uat-details"><summary>${h('history_title')}</summary><p class="uat-subtle">${h('history_subtitle')}</p><div class="uat-table-wrap"><table><thead><tr><th>Date locale</th><th>Bière</th><th>Brasserie</th><th>Style</th><th>Note / 5</th><th>Photos</th><th>Commentaires</th></tr></thead><tbody>${s.rows.slice(0, 500).map(r => `<tr><td>${esc(r.local.day)} ${r.local.hour}:${String(r.local.minute).padStart(2, '0')}</td><td>${esc(r.beer)}</td><td>${esc(r.brewery)}</td><td>${esc(r.style)}</td><td>${fmt(r.rating, 2)}</td><td>${fmt(r.photos)}</td><td>${fmt(r.commentsCount)}</td></tr>`).join('')}</tbody></table></div></details>`;
      progress();
    }
    async function loop() {
      if (running || pending || !state || !['feed', 'details', 'public_beers'].includes(state.phase)) return;
      running = true; const version = ++generation; busy(true); progress();
      try {
        while (running && version === generation && ['feed', 'details', 'public_beers'].includes(state.phase)) {
          if (state.retry_at > Date.now() / 1000) { notify(`Quota API atteint. Reprise possible à ${new Date(state.retry_at * 1000).toLocaleString('fr-FR')}.`); break; }
          const res = await api('step');
          state = res.state; merge(res.items || []); refreshStyles(); render(); progress();
          if (!running || version !== generation || state.phase === 'done') break;
          await new Promise(resolve => setTimeout(resolve, state.source === 'public' ? 1100 : 450));
        }
        if (state.phase === 'done') notify(state.source === 'public' ? statusLabel() : 'Import terminé. Vos statistiques et exports sont prêts.', state.source === 'public' && !state.public_complete ? 'info' : 'success');
      } catch (error) {
        if (error.retryAt) state.retry_at = error.retryAt;
        notify(error.message, 'error');
      } finally { running = false; busy(false); progress(); }
    }
    $('.uat-import-top').addEventListener('submit', async event => {
      event.preventDefault(); if (pending) return;
      busy(true); notify('Vérification du profil auprès d’Untappd…');
      try {
        await session(); const res = await api('start', {profile: field('profile').value.trim(), source: config.configured ? 'api' : 'public', enrich: $('[data-enrich]').checked});
        rawMap = new Map(); state = res.state;
        merge(res.items || []); setData(items, 'api', state.profile.username); notify(state.source === 'public' ? statusLabel() : 'Import de votre historique…');
        busy(false); await loop();
      } catch (error) { if (error.status === 401) { token = ''; try { sessionStorage.removeItem(storageKey); } catch (_) {} } notify(error.message, 'error'); busy(false); }
    });
    $('.uat-file input').addEventListener('change', async event => {
      const file = event.target.files[0]; if (!file || pending) return;
      if (file.size > 50 * 1024 * 1024) { notify('Le fichier dépasse 50 Mo. Réduisez-le ou utilisez l’import API.', 'error'); return; }
      busy(true); notify('Analyse du fichier dans votre navigateur…');
      try {
        const result = C.parse(await file.text(), file.name);
        setData(result.items, 'file', file.name);
        notify(`${fmt(result.items.length)} check-ins importés. ${result.duplicates} doublons par identifiant écartés. ${result.invalid} lignes ignorées (date ou nom de bière absent/invalide).${result.missingIds ? ` ${result.missingIds} lignes sans ID : conservées sans déduplication.` : ''}`, result.invalid ? 'info' : 'success');
      } catch (error) { notify(error.message, 'error'); } finally { busy(false); event.target.value = ''; }
    });
    action('demo').addEventListener('click', () => { if (pending) return; notify(''); setData(C.demo(), 'demo', 'Démonstration', true); });
    action('pause').addEventListener('click', () => { running = false; notify('Pause demandée. La requête en cours sera enregistrée avant l’arrêt.'); progress(); });
    action('resume').addEventListener('click', () => { notify(''); loop(); });
    action('reset').addEventListener('click', () => { field('from').value = ''; field('to').value = ''; field('style').value = ''; notify(''); render(); });
    $('.uat-filters').addEventListener('change', () => { notify(''); render(); });
    async function eraseData() {
      if (pending) { running = false; notify('La requête en cours doit se terminer. Cliquez ensuite sur Effacer.'); return; }
      busy(true);
      try { if (token) await api('erase'); token = ''; try { sessionStorage.removeItem(storageKey); } catch (_) {} state = null; rawMap = new Map(); setData([], '', ''); notify('Les données et le jeton de cette session ont été effacés.', 'success'); }
      catch (error) { notify(error.message, 'error'); } finally { busy(false); }
    }
    action('erase').addEventListener('click', eraseData);
    action('clear').addEventListener('click', eraseData);
    action('oauth').addEventListener('click', async () => {
      if (pending) return; busy(true);
      try { await session(); const clean = new URL(location.href); clean.hash = ''; const res = await api('oauth', {return: clean.href}); location.assign(res.url); }
      catch (error) { notify(error.message, 'error'); busy(false); }
    });
    function meta() { return {texts, variables: {...context}, profile, profileBadgesTotal: state?.source === 'public' && source === 'api' ? state.profile?.expected_badges : null, demo: isDemo, source: source === 'file' ? 'Export de fichier Untappd' : (state?.source === 'public' ? 'Pages publiques Untappd (limitées)' : 'API Untappd'), status: statusLabel(), ...options(), grain: field('grain').value}; }
    for (const type of ['xlsx', 'png']) action(type).addEventListener('click', async () => {
      if (!currentStats) return;
      const button = action(type); button.disabled = true;
      try {
        if (options().from && options().to && options().from > options().to) throw new Error('Corrigez les dates avant d’exporter.');
        notify(type === 'png' ? 'Création de votre affiche PNG…' : 'Création du classeur Excel…');
        await new Promise(resolve => setTimeout(resolve, 20));
        const blob = type === 'xlsx' ? E.xlsx(currentStats, meta()) : await E.png(window.UATTheme.inlineSvg(poster(currentStats, meta()), app));
        E.download(blob, `untappd-atlas${isDemo ? '-DEMO' : ''}-${new Date().toISOString().slice(0, 10)}.${type}`); notify('Votre export est prêt.', 'success');
      } catch (error) { notify(error.message, 'error'); } finally { button.disabled = false; }
    });
    // Exposed rendering helper is useful for standalone previews and export verification.
    window.UATView = {stylePalette, styleSwatch, styleLegend, pyramids, pyramidLayout, pyramidGeometry, pyramidYear, pyramidCards, heat, ratings, timeline, styleTimeline, poster, badgeTiles};
    if (config.preview) { token = ''; setData(C.demo(), 'demo', 'Démonstration', true); }
    if (token) (async () => {
      busy(true);
      try {
        const res = await api('status', null, 'GET'); state = res.state; merge(res.items || []);
        const connected = location.hash === '#uat-connected';
        if (connected || location.hash === '#uat-denied') history.replaceState(null, '', location.pathname + location.search);
        if (connected && state.connected_username) field('profile').value = state.connected_username;
        if (items.length) setData(items, 'api', state.profile?.username || 'Profil Untappd');
        else progress();
        if (connected) notify('Connexion Untappd autorisée. Cliquez sur Créer mes statistiques pour démarrer.', 'success');
        else if (state.phase !== 'idle' && state.phase !== 'done') notify('Votre import précédent est disponible. Cliquez sur Reprendre pour continuer.');
      } catch (error) { if (error.status === 401) { token = ''; try { sessionStorage.removeItem(storageKey); } catch (_) {} } else notify(error.message, 'error'); }
      finally { busy(false); }
    })();
  }
})();
