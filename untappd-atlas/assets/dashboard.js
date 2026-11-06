(function () {
  'use strict';
  const C = window.UATCore, E = window.UATExport, esc = E.xml;
  const colors = Array.from({length: 10}, (_, i) => `var(--uat-series-${i + 1})`);
  const metricIcons = {
    checkins: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="m8.5 12 2.5 2.5 4.5-5M8.5 18h7"/>',
    beers: '<path d="M4 8h12v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM16 10h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2M8 12v5m4-5v5M4 8V7a2 2 0 0 1 3-1.7 3 3 0 0 1 5.5-1A2.5 2.5 0 0 1 16 7v1"/>',
    breweries: '<path d="M3 21V11l5 3V9l5 4V4h4l2 10h2v7zM7 17.5h1m3.5 0h1m3.5 0h1"/>',
    average: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>'
  };
  function metricIcon(name, size = 36) {
    return `<svg class="uat-kpi-icon" width="${size}" height="${size}" viewBox="0 0 36 36" aria-hidden="true" focusable="false">`
      + '<rect width="36" height="36" rx="9" fill="var(--uat-accent)" fill-opacity=".14"/>'
      + `<g transform="translate(3 3) scale(1.25)" fill="none" stroke="var(--uat-accent)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${metricIcons[name]}</g></svg>`;
  }
  let canCounter = 0;
  // Embedded from assets/can-logo.png so the SVG and PNG exports need no external image request.
  const canLogo = 'data:image/png;base64,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';
  const fmt = (n, digits = 0) => n == null ? '—' : Number(n).toLocaleString('fr-FR', {maximumFractionDigits: digits, minimumFractionDigits: digits});
  async function readResponse(res) {
    const failed = message => Object.assign(new Error(message), {status: res.status});
    const fallback = res.status >= 500
      ? `Le serveur WordPress a interrompu l’import (HTTP ${res.status}). Consultez le journal PHP de l’hébergement pour trouver l’erreur critique.`
      : `Réponse WordPress illisible (HTTP ${res.status}). Vérifiez l’accès à l’API REST, les permaliens et le pare-feu du site.`;
    let payload;
    try { payload = await res.json(); } catch (_) { throw failed(fallback); }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw failed(fallback);
    if (!res.ok) throw Object.assign(failed(typeof payload.message === 'string' ? payload.message : fallback), {code: payload.code, retryAt: payload.data?.retry_at});
    return payload;
  }
  window.UATTransport = {readResponse};
  const short = (s, n = 28) => String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s);
  const dayLabel = day => day ? new Date(day + 'T12:00:00Z').toLocaleDateString('fr-FR', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}) : '—';
  const caption = (texts, key, fallback, values = {}) => window.UATContent.value(texts, key, fallback, values);
  function statVariables(s) {
    const years = s.first ? Number(s.last.local.year) - Number(s.first.local.year) + 1 : 0;
    return {years, years_label: fmt(years) + (years === 1 ? ' année' : ' années'), count: fmt(s.total), rated: fmt(s.rated), unrated: fmt(s.unrated), rated_beers: fmt(s.ratedUniqueBeers), rated_breweries: fmt(s.ratedUniqueBreweries), median: fmt(s.median, 2), styles: fmt(s.styles.length), breweries: fmt(s.uniqueBreweries), beers: fmt(s.uniqueBeers), venues: fmt(s.venues.length), badges: fmt(s.badges.length), badge_awards: fmt(s.badgeAwards), badges_unknown: fmt(s.badgesUnknown), photos: fmt(s.photos), photo_unknown: fmt(s.photoUnknown), comments_unknown: fmt(s.commentsUnknown), toasts_unknown: fmt(s.toastsUnknown), per_active_day: fmt(s.perActiveDay, 2), calendar_days: fmt(s.calendarDays), timezone: s.timezone, first_date: dayLabel(s.first?.local.day), last_date: dayLabel(s.last?.local.day), biggest_date: dayLabel(s.biggestDay?.key)};
  }
  const text = (x, y, value, size = 12, fill = 'var(--uat-muted)', weight = 400, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" ${extra}>${esc(value)}</text>`;
  const svg = (width, height, content, title, interactive = true) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(title)}" font-family="Arial, sans-serif"${interactive ? '' : ' pointer-events="none"'}>${interactive ? `<title>${esc(title)}</title>` : ''}${content}</svg>`;
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
      // A single annual pyramid; the remaining cans extend its supported edge.
      group.piles = [Math.floor((Math.sqrt(8 * group.rows.length + 1) - 1) / 2)];
      return group;
    });
  }
  function pyramidGeometry(group) {
    // 3D stepped conical pyramid: each tier forms a forward-curving arc where outer cans step up and back.
    const pitch = 19.2, rise = 41.6, slope = 0, piles = [];
    let index = 0;
    group.piles.forEach((height, depth) => {
      const scale = 1 + Math.min(depth, 3) * .07;
      const extra = group.rows.length - height * (height + 1) / 2;
      const localWidth = (height - 1 + (extra ? 1 : 0)) * pitch + 24, width = localWidth * scale;
      const previous = piles[depth - 1];
      const x = previous ? previous.x + previous.width - Math.min(width * .65, pitch * previous.scale * 2) : 0;
      const baseline = previous ? previous.floor + 27 * scale - localWidth * slope * scale / 2 : 0;
      const project = (px, py) => ({x: x + px * scale, y: baseline + (py + px * slope) * scale});
      const cans = [];
      for (let level = 0; level < height; level++) {
        const columns = height - level + (level < extra ? 1 : 0);
        const mid = (columns - 1) / 2;
        for (let col = 0; col < columns; col++) {
          const dist = Math.abs(col - mid), sign = col < mid ? -1 : col > mid ? 1 : 0;
          const arcDy = -Math.pow(Math.max(0, dist - .35), 1.35) * 4.8;
          const arcDx = -sign * Math.pow(Math.max(0, dist - 1), 1.25) * 1.2;
          const localX = (col + level / 2) * pitch + arcDx, localY = -48.4 - level * rise + arcDy;
          const depthZ = level === height - 1 && height > 1 ? (height - 2) - .15 : level + Math.pow(Math.max(0, dist - .3), 1.35) * .72;
          cans.push({row: group.rows[index++], level, col, dist, depthZ, localX, localY, ...project(localX, localY)});
        }
      }
      cans.sort((a, b) => b.depthZ - a.depthZ || a.level - b.level || b.dist - a.dist);
      piles.push({height, depth, x, baseline, width, localWidth, scale, slope, rise, pitch, floor: baseline + localWidth * slope * scale / 2, cans, project});
    });
    // Include the sketchy ground puddle shadow, conical tiers and contact shadows.
    const bounds = {left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity};
    const include = p => { bounds.left = Math.min(bounds.left, p.x); bounds.top = Math.min(bounds.top, p.y); bounds.right = Math.max(bounds.right, p.x); bounds.bottom = Math.max(bounds.bottom, p.y); };
    for (const pile of piles) {
      for (const can of pile.cans) {
        const bottom = can.level ? 52 : 58, right = can.level ? 24 : 34;
        for (const dx of [0, right]) for (const dy of [1, bottom]) include(pile.project(can.localX + dx, can.localY + dy));
      }
      for (const px of [-4, pile.localWidth + 4]) for (const py of [0, 4]) include(pile.project(px, py));
    }
    if (!piles.length) Object.assign(bounds, {left: 0, top: 0, right: 1, bottom: 1});
    return {piles, bounds, width: bounds.right - bounds.left, height: bounds.bottom - bounds.top};
  }
  function pyramidArtwork(group, paints) {
    const uid = 'uat-can-' + (++canCounter);
    const styles = [...new Set(group.rows.map(row => row.style))], shapeIds = new Map(styles.map((key, i) => [key, `${uid}-shape-${i}`]));
    // Hand-drawn comic-style 44 cl cans with inked contours, jagged gloss highlight, cross-hatching and silver collar.
    let body = `<defs>
      <radialGradient id="${uid}-ground"><stop stop-color="var(--uat-can-ground)" stop-opacity=".35"/><stop offset=".55" stop-color="var(--uat-can-ground)" stop-opacity=".14"/><stop offset="1" stop-color="var(--uat-can-ground)" stop-opacity="0"/></radialGradient>
      <radialGradient id="${uid}-contact"><stop stop-color="var(--uat-can-outline)" stop-opacity=".65"/><stop offset=".7" stop-color="var(--uat-can-outline)" stop-opacity=".22"/><stop offset="1" stop-color="var(--uat-can-outline)" stop-opacity="0"/></radialGradient>
      <mask id="${uid}-logo-mask" maskUnits="userSpaceOnUse" x="5.8" y="19.5" width="12.4" height="12.4" style="mask-type:alpha"><image href="${canLogo}" x="5.8" y="19.5" width="12.4" height="12.4" preserveAspectRatio="xMidYMid meet"/></mask>`;
    const shellPath = 'd="M3.5 6.8L2.1 9.8Q1.9 10.5 1.9 11.4V44.6Q1.9 46.8 4.1 48.0Q12 51.7 19.9 48.0Q22.1 46.8 22.1 44.6V11.4Q22.1 10.5 21.9 9.8L20.5 6.8Z"';
    const labelPath = 'd="M1.9 10.4Q12 13.5 22.1 10.4V44.6Q22.1 46.6 19.9 47.7Q12 51.3 4.1 47.7Q1.9 46.6 1.9 44.6Z"';
    for (const key of styles) {
      const paint = paints.get(key);
      body += `<g id="${shapeIds.get(key)}" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3.5 46.7Q12 50.7 20.5 46.7L19.4 48.8Q12 52.3 4.6 48.8Z" fill="var(--uat-can-lid)" stroke="var(--uat-can-outline)" stroke-width=".85"/>
        <path d="M4.2 47.5Q12 51.1 19.8 47.5" fill="none" stroke="var(--uat-can-outline)" stroke-width=".55"/>
        <path ${shellPath} fill="var(--uat-can-lid)"/>
        ${paintShape('path', labelPath, paint)}
        <path d="M15.2 11.5Q19.0 11.3 22.1 10.4V44.6Q22.1 46.6 19.9 47.7Q17.0 49.1 13.8 49.4Q15.8 44.2 16.0 28.0Q16.1 16.5 15.2 11.5Z" fill="var(--uat-can-outline)" fill-opacity=".22"/>
        <path d="M18.5 11.1L22.1 10.4V44.6Q22.1 46.6 19.9 47.7L18.0 48.4Z" fill="var(--uat-can-outline)" fill-opacity=".2"/>
        <path d="M1.9 42.6Q12 47.2 22.1 42.6V44.6Q22.1 46.6 19.9 47.7Q12 51.3 4.1 47.7Q1.9 46.6 1.9 44.6Z" fill="var(--uat-can-outline)" fill-opacity=".2"/>
        <path d="M4.6 11.2Q8.2 12.2 12.2 12.3L11.4 23.2L13.6 21.8L10.4 32.4L12.4 31.6L10.2 47.0Q6.6 46.3 4.6 44.8Z" fill="var(--uat-can-highlight)" fill-opacity=".72"/>
        <path d="M5.3 11.5Q7.8 12.2 10.4 12.3L9.8 21.6L11.5 20.6L9.0 30.2L10.4 29.7L8.7 46.0Q6.3 45.3 5.3 44.2Z" fill="var(--uat-can-highlight)" fill-opacity=".55"/>
        <path d="M2.8 11.2L3.7 11.5V43.8L2.8 43.2Z" fill="var(--uat-can-highlight)" fill-opacity=".55"/>
        <polygon points="7.4,37.5 8.5,37.8 8.3,41.2 7.2,40.8" fill="var(--uat-can-highlight)" fill-opacity=".65"/>
        <polygon points="15.0,36.8 16.0,36.4 15.8,39.5 14.8,39.8" fill="var(--uat-can-highlight)" fill-opacity=".45"/>
        <path d="M3.5 6.8L2.1 9.8Q1.9 10.2 1.9 10.5Q12 13.5 22.1 10.5Q22.1 10.2 21.9 9.8L20.5 6.8Z" fill="var(--uat-can-lid)"/>
        <path d="M3.8 7.2L2.6 9.7Q7.2 11.4 12.4 11.6L13.0 7.8Z" fill="var(--uat-can-highlight)" fill-opacity=".8"/>
        <path d="M1.9 10.4Q12 13.5 22.1 10.4" fill="none" stroke="var(--uat-can-outline)" stroke-width=".85"/>
        <path d="M2.2 11.3Q12 14.3 21.8 11.3" fill="none" stroke="var(--uat-can-outline)" stroke-opacity=".58" stroke-width=".45" stroke-dasharray=".7 1.1"/>
        <path d="M2.8 9.5Q12 12.4 21.2 9.5" fill="none" stroke="var(--uat-can-outline)" stroke-opacity=".38" stroke-width=".4" stroke-dasharray=".5 1.1"/>
        <ellipse cx="12" cy="25.7" rx="6.2" ry="6.0" fill="var(--uat-can-highlight)" fill-opacity=".32"/>
        <rect class="uat-can-logo" x="5.8" y="19.5" width="12.4" height="12.4" fill="var(--uat-can-logo)" mask="url(#${uid}-logo-mask)"/>
        <text x="12" y="42.8" text-anchor="middle" font-size="2.8" font-weight="900" letter-spacing=".28" fill="var(--uat-can-outline)" fill-opacity=".82">44CL</text>
        <path d="M4.6 25.0V42.0M4.6 14.0V21.0M6.6 33.0V45.0M14.6 25.5V45.2M18.2 13.5V43.8M20.2 17.5V42.2" fill="none" stroke="var(--uat-can-outline)" stroke-opacity=".45" stroke-width=".48"/>
        <path d="M12.2 25.2L16.8 22.5M9.4 34.8L13.8 32.0M5.0 35.5L8.4 36.2" fill="none" stroke="var(--uat-can-outline)" stroke-opacity=".38" stroke-width=".45"/>
        <path d="M14.2 48.4L18.4 45.2M15.8 48.2L20.0 44.8M17.5 47.6L21.2 44.4M12.6 48.6L15.8 46.4M3.0 45.0L6.8 47.7M4.6 46.8L8.4 48.5" fill="none" stroke="var(--uat-can-outline)" stroke-opacity=".68" stroke-width=".52"/>
        <path class="uat-can-illustrated-shell" ${shellPath} fill="none" stroke="var(--uat-can-outline)" stroke-width=".98"/>
        <path d="M3.5 6.0a8.5 2.7 0 0 0 17 0v1.0a8.5 2.7 0 0 1-17 0Z" fill="var(--uat-can-lid)" stroke="var(--uat-can-outline)" stroke-width=".82"/>
        <ellipse cx="12" cy="5.9" rx="8.5" ry="2.7" fill="var(--uat-can-highlight)" stroke="var(--uat-can-outline)" stroke-width=".88"/>
        <ellipse cx="12" cy="6.0" rx="7.2" ry="2.05" fill="var(--uat-can-lid)" stroke="var(--uat-can-outline)" stroke-width=".68"/>
        <path d="M5.4 5.7A6.8 1.8 0 0 1 18.6 5.7A6.8 1.5 0 0 0 5.4 5.7Z" fill="var(--uat-can-outline)" fill-opacity=".38"/>
        <path d="M6.2 6.8Q12 8.2 17.8 6.8" fill="none" stroke="var(--uat-can-highlight)" stroke-width=".68"/>
        <ellipse cx="12.2" cy="6.1" rx="3.1" ry="1.05" fill="var(--uat-can-lid)" stroke="var(--uat-can-outline)" stroke-width=".62"/>
        <ellipse cx="11.2" cy="6.1" rx="1.2" ry=".48" fill="var(--uat-can-shadow)" stroke="var(--uat-can-outline)" stroke-width=".45"/>
        <circle cx="13.3" cy="6.1" r=".45" fill="var(--uat-can-highlight)" stroke="var(--uat-can-outline)" stroke-width=".45"/>
      </g>`;
    }
    body += '</defs>';
    const geometry = pyramidGeometry(group);
    for (const pile of geometry.piles) {
      const matrix = `matrix(${pile.scale} ${pile.slope * pile.scale} 0 ${pile.scale} ${pile.x} ${pile.baseline})`;
      body += `<g class="uat-can-pile" data-depth="${pile.depth}" transform="${matrix}">`;
      for (const can of pile.cans) {
        const row = can.row;
        body += `<g class="uat-can" data-checkin-id="${esc(row.id)}" data-style="${esc(row.style)}" data-level="${can.level}" transform="translate(${can.localX} ${can.localY})">`;
        if (can.level) body += `<ellipse class="uat-can-contact" cx="12" cy="49.2" rx="10.2" ry="2.5" fill="url(#${uid}-contact)"/>`;
        body += `<use href="#${shapeIds.get(row.style)}"/></g>`;
      }
      body += '</g>';
    }
    return body;
  }
  function pyramidScene(s) {
    const groups = pyramidLayout(s), layers = [];
    const geometries = groups.map(pyramidGeometry);
    const spread = Math.max(170, ...geometries.map(geometry => geometry.width * .5));
    const distanceToHorizon = Math.max(210, ...geometries.map(geometry => geometry.height * 1.15));
    groups.forEach((group, depth) => {
      const geometry = geometries[depth], distance = groups.length - depth - 1;
      // Project toward one central vanishing point, alternating on either side.
      const scale = 1 / (1 + distance * .52), side = distance ? (distance % 2 ? -1 : 1) : 0;
      const centerX = side * spread * scale;
      const x = centerX - (geometry.bounds.left + geometry.bounds.right) / 2 * scale;
      const floor = -distanceToHorizon * (1 - scale);
      const y = floor - geometry.piles[0].floor * scale;
      layers.push({group, geometry, depth, distance, side, centerX, scale, x, y, floor});
    });
    const bounds = layers.reduce((b, layer) => ({
      left: Math.min(b.left, layer.x + layer.geometry.bounds.left * layer.scale),
      top: Math.min(b.top, layer.y + layer.geometry.bounds.top * layer.scale),
      right: Math.max(b.right, layer.x + layer.geometry.bounds.right * layer.scale),
      bottom: Math.max(b.bottom, layer.y + layer.geometry.bounds.bottom * layer.scale)
    }), {left: 0, top: 0, right: 1, bottom: 1});
    return {layers, bounds, width: bounds.right - bounds.left, height: bounds.bottom - bounds.top};
  }
  function renderPyramidScene(scene, texts, paints) {
    const W = 1100, uid = 'uat-can-' + (++canCounter);
    if (!scene.layers.length) return svg(W, 240, `<rect class="uat-pyramid-panel" x="1" y="1" width="${W - 2}" height="238" rx="24" fill="var(--uat-pyramid-bg)" stroke="var(--uat-pyramid-border)"/>` + text(W / 2, 120, texts.pyramids_empty ?? 'Aucune évaluation pour cette période.', 22, 'var(--uat-pyramid-muted)', 400, 'text-anchor="middle"'), 'Aucune évaluation importée.', false);
    const b = scene.bounds, scale = Math.min(1.8, (W - 380) / (2 * Math.max(Math.abs(b.left), Math.abs(b.right))), 820 / scene.height);
    const x = W / 2, y = 52 - b.top * scale;
    const lastLabel = {left: 0, right: 0};
    const labels = scene.layers.map(layer => {
      const bounds = layer.geometry.bounds;
      const anchorX = x + (layer.centerX + layer.side * layer.geometry.width * layer.scale / 2) * scale;
      const anchorY = y + (layer.y + bounds.bottom * layer.scale) * scale;
      const column = layer.side < 0 ? 'left' : 'right';
      const labelY = layer.side ? Math.max(anchorY + 5, lastLabel[column] + 80) : anchorY + 44;
      if (layer.side) lastLabel[column] = labelY;
      return {layer, anchorX, anchorY, labelY, labelX: layer.side < 0 ? 44 : layer.side > 0 ? W - 44 : x + layer.centerX * scale};
    });
    const H = Math.max(520, Math.ceil(scene.height * scale + 180), ...labels.map(label => Math.ceil(label.labelY + 72)));
    let body = `<defs><radialGradient id="${uid}-backdrop" cx=".3" cy=".2" r=".9"><stop stop-color="var(--uat-can-highlight)" stop-opacity="0"/><stop offset="1" stop-color="var(--uat-can-highlight)" stop-opacity="0"/></radialGradient><radialGradient id="${uid}-floor"><stop stop-color="var(--uat-can-ground)" stop-opacity=".14"/><stop offset="1" stop-color="var(--uat-can-ground)" stop-opacity="0"/></radialGradient></defs>`;
    body += `<rect class="uat-pyramid-panel" x="1" y="1" width="${W - 2}" height="${H - 2}" rx="24" fill="var(--uat-pyramid-bg)" stroke="var(--uat-pyramid-border)"/><rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="23" fill="url(#${uid}-backdrop)"/>`;
    body += `<g transform="translate(${x} ${y}) scale(${scale})">`;

    for (const layer of scene.layers) {
      body += `<g class="uat-year-pyramid" data-year="${esc(layer.group.year)}" data-depth="${layer.depth}" transform="translate(${layer.x} ${layer.y}) scale(${layer.scale})">${pyramidArtwork(layer.group, paints)}</g>`;
    }
    body += '</g>';
    for (const label of labels) {
      const {layer, labelX, labelY, anchorX, anchorY} = label, group = layer.group;
      const unit = group.rows.length === 1 ? texts.pyramid_one_label ?? 'canette' : texts.pyramid_many_label ?? 'canettes';
      const textAnchor = layer.side < 0 ? 'start' : layer.side > 0 ? 'end' : 'middle';
      const bandStart = layer.side < 0 ? labelX : layer.side > 0 ? labelX - 116 : labelX - 58;
      body += `<g class="uat-year-label" data-year="${esc(group.year)}">`;
      if (layer.side) {
        const elbowX = layer.side < 0 ? 180 : W - 180, endX = layer.side < 0 ? labelX + 108 : labelX - 108;
        body += `<path d="M${anchorX} ${anchorY}L${elbowX} ${labelY - 8}H${endX}" fill="none" stroke="var(--uat-pyramid-muted)" stroke-opacity=".5" stroke-width="1"/><circle cx="${anchorX}" cy="${anchorY}" r="2.2" fill="var(--uat-pyramid-muted)"/>`;
      }
      body += text(labelX, labelY, group.year, layer.side ? 24 : 30, 'var(--uat-pyramid-text)', 800, `text-anchor="${textAnchor}"`) + text(labelX, labelY + 23, short(`${fmt(group.rows.length)} ${unit}`, 28), 14, 'var(--uat-pyramid-muted)', 500, `text-anchor="${textAnchor}"`);
      const counts = new Map(); group.rows.forEach(row => counts.set(row.style, (counts.get(row.style) || 0) + 1));
      let bandX = bandStart;
      for (const [key, paint] of paints) {
        const count = counts.get(key) || 0; if (!count) continue;
        const width = count / group.rows.length * 116;
        body += `<g>${paintShape('rect', `x="${bandX}" y="${labelY + 34}" width="${width}" height="4"`, paint)}</g>`;
        bandX += width;
      }
      body += '</g>';
    }
    return svg(W, H, body, `${scene.layers.reduce((n, layer) => n + layer.group.rows.length, 0)} canettes, une pyramide par année. Année la plus récente au centre du premier plan ; années précédentes de plus en plus loin, à gauche puis à droite en alternance. Certaines canettes peuvent être masquées par la perspective.`, false);
  }
  function pyramidYear(group, texts = {}, paints = stylePalette({rows: group.rows})) {
    return renderPyramidScene(pyramidScene({rows: group.rows}), texts, paints);
  }
  function pyramidCards(s, texts = {}) {
    if (!s.rows.length) return `<p class="uat-empty">${esc(texts.pyramids_empty ?? 'Aucune évaluation pour cette période.')}</p>`;
    const minWidth = 760;
    return `<div class="uat-pyramid-viewport" tabindex="0" role="region" aria-label="Pyramides annuelles, défilement horizontal" style="--uat-pyramid-width:${minWidth}px">${pyramids(s, texts)}</div>`;
  }
  function pyramids(s, texts = {}) {
    return renderPyramidScene(pyramidScene(s), texts, stylePalette(s));
  }

  function heat(s, texts = {}) {
    const width = 430, height = 205, left = 36, top = 26, cellW = 15.6, cellH = 18, max = Math.max(1, ...s.heat.flat());
    let body = '';
    s.heat.forEach((row, day) => {
      body += text(0, top + day * cellH + 12, ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'][day], 11);
      row.forEach((n, h) => { body += `<rect x="${left + h * cellW}" y="${top + day * cellH}" width="12.8" height="14.5" rx="2.5" fill="${n ? 'var(--uat-accent)' : 'var(--uat-heat-empty)'}" opacity="${n ? .18 + .82 * n / max : 1}"><title>${n} check-ins, ${['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][day]}, ${h} h</title></rect>`; });
    });
    [0, 6, 12, 18, 23].forEach(h => { body += text(left + h * cellW, 175, `${h} h`, 10, 'var(--uat-subtle)'); });
    body += text(36, 12, caption(texts, 'heat_less', 'moins'), 9, 'var(--uat-subtle)');
    for (let i = 0; i < 6; i++) body += `<rect x="${75 + i * 13}" y="3" width="10" height="10" rx="2" fill="var(--uat-accent)" opacity="${.15 + i * .17}"/>`;
    body += text(160, 12, caption(texts, 'heat_more', 'plus'), 9, 'var(--uat-subtle)');
    return svg(width, height, body, caption(texts, 'heat_title', 'Nombre de check-ins par jour de la semaine et heure.'));
  }
  function ratings(s, texts = {}) {
    const W = 430, H = 205, max = Math.max(1, ...s.distribution.map(r => r.count)); let body = '';
    [0, .5, 1].forEach(p => { const y = 165 - 135 * p; body += `<path d="M28 ${y}H420" stroke="var(--uat-chart-grid)" stroke-dasharray="3 4"/>` + text(0, y + 4, fmt(Math.round(max * p)), 9); });
    s.distribution.forEach((r, i) => {
      const x = 32 + i * 18.3, h = r.count / max * 135;
      body += `<rect x="${x}" y="${165 - h}" width="13" height="${h}" rx="3" fill="${r.rating >= 4 ? 'var(--uat-accent)' : 'var(--uat-chart-neutral)'}"><title>${r.rating} / 5 : ${r.count} check-ins</title></rect>`;
      if (i % 4 === 0) body += text(x + 6, 185, r.rating, 10, 'var(--uat-subtle)', 400, 'text-anchor="middle"');
    });
    return svg(W, H, body, caption(texts, 'ratings_title', `Distribution des ${s.rated} notes. Moyenne : ${fmt(s.average, 2)} sur 5.`));
  }
  function timeline(s, grain, average = false, texts = {}) {
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
    if (bucket > 1) body += text(27, 202, caption(texts, 'timeline_bucket_note', 'Regroupement visuel : {bucket} périodes / point. Détail dans Excel.', {bucket}), 8, 'var(--uat-subtle)');
    return svg(430, 210, body, caption(texts, average ? 'average_title' : 'activity_title', average ? 'Évolution de la note moyenne, périodes sans note laissées vides.' : 'Évolution du nombre de check-ins, périodes vides incluses.'));
  }
  function styleTimeline(s, grain, texts = {}) {
    const paints = stylePalette(s), periods = s.periods(grain), bucket = Math.ceil(periods.length / 100) || 1, top = s.styles.slice(0, 5), indices = new Map(top.map((r, i) => [r.key, i]));
    const map = new Map(s.stylePeriods(grain).map(r => [r.key, r.count])), rows = [];
    for (let i = 0; i < periods.length; i += bucket) {
      const slice = periods.slice(i, i + bucket), counts = Array(6).fill(0);
      slice.forEach(p => s.styles.forEach(st => counts[indices.has(st.key) ? indices.get(st.key) : 5] += map.get(`${p.key}\t${st.key}`) || 0));
      rows.push({key: slice[0].key, counts});
    }
    const max = Math.max(1, ...rows.map(r => r.counts.reduce((a, b) => a + b, 0))), width = 390 / Math.max(1, rows.length); let body = '';
    [0, .5, 1].forEach(p => { const y = 165 - p * 135; body += `<path d="M27 ${y}H420" stroke="var(--uat-chart-grid)" stroke-dasharray="3 4"/>` + text(0, y + 4, fmt(max * p), 9); });
    rows.forEach((r, i) => { let y = 165; r.counts.forEach((n, j) => { const h = n / max * 135; y -= h; body += `<g>${paintShape('rect', `x="${27 + i * width + 1}" y="${y}" width="${Math.max(.6, width - 2)}" height="${h}"`, j < 5 && top[j] ? paints.get(top[j].key) : {base: 'var(--uat-other)'})}<title>${esc(r.key)} · ${esc(top[j]?.label || caption(texts, 'other_styles_label', 'Autres styles'))} : ${n}</title></g>`; }); });
    if (rows.length) { body += text(27, 187, rows[0].key, 9) + text(420, 187, rows[rows.length - 1].key, 9, 'var(--uat-muted)', 400, 'text-anchor="end"'); }
    if (bucket > 1) body += text(27, 202, caption(texts, 'styles_bucket_note', 'Regroupement visuel : {bucket} périodes / colonne.', {bucket}), 8);
    return svg(430, 210, body, caption(texts, 'styles_time_title', 'Styles par période, cinq principaux styles et autres.'));
  }
  function ranking(rows, maxRows = 7, color = 'var(--uat-accent)', texts = {}) {
    if (!rows.length) { const empty = caption(texts, 'ranking_empty', 'Aucune donnée disponible.'); return empty ? `<p class="uat-empty">${esc(empty)}</p>` : ''; }
    const max = Math.max(1, rows[0].count);
    return rows.slice(0, maxRows).map((r, i) => {
      const fill = typeof color === 'function' ? styleSwatch(color(r), 100, 4) : '';
      const background = typeof color === 'function' ? '' : `background:${Array.isArray(color) ? color[i % color.length] : color};`;
      return `<div class="uat-rank"><span>${String(i + 1).padStart(2, '0')}</span><div><strong title="${esc(r.label)}">${esc(r.label)}</strong><div class="uat-track"><i style="width:${r.count / max * 100}%;${background}">${fill}</i></div></div><b>${fmt(r.count)}</b></div>`;
    }).join('');
  }
  function yearlyStyleCards(s, paints, describe) {
    return s.yearlyWinners.map(row => `<div class="uat-year"><strong>${row.year}</strong><i>${styleSwatch(paints.get(row.style), 100, 12)}</i><span>${esc(row.style)}</span><small>${window.UATContent.html(describe(row.count))}</small></div>`).join('');
  }
  function badgeTiles(s, texts = {}) {
    if (!s.badges.length) { const empty = caption(texts, 'badges_empty', 'Aucun badge identifié dans les données importées. Un champ absent ne signifie pas que vous n’avez aucun badge.'); return empty ? `<p class="uat-empty">${esc(empty)}</p>` : ''; }
    const note = caption(texts, 'badges_limit_note', '100 premiers badges affichés ; liste complète dans Excel.');
    return s.badges.slice(0, 100).map(b => {
      const title = caption(texts, 'badge_title', '{badge}', {badge: b.label});
      const level = b.level == null ? caption(texts, 'badge_level_unknown', 'Niveau non renseigné') : caption(texts, 'badge_level', 'Niveau {level}', {level: fmt(b.level)});
      return `<article class="uat-badge">${C.badgeImage(b.image) ? `<img src="${esc(C.badgeImage(b.image))}" alt="${esc(title ? '' : b.label)}" loading="lazy" referrerpolicy="no-referrer" width="64" height="64">` : '<span class="uat-badge-icon" aria-hidden="true">🏅</span>'}<div>${title ? `<strong>${esc(title)}</strong>` : ''}${level ? `<p>${esc(level)}</p>` : ''}</div></article>`;
    }).join('') + (s.badges.length > 100 && note ? `<p class="uat-subtle">${esc(note)}</p>` : '');
  }
  function poster(s, meta) {
    const variables = {...statVariables(s), ...meta.variables, style: meta.style || meta.texts.filter_all_styles || 'Tous les styles', status: meta.status || 'Analyse du fichier fourni.'};
    const t = (key, extra = {}) => window.UATContent.value(meta.texts, key, '', {...variables, ...extra});
    const paints = stylePalette(s), legendExtra = Math.max(0, Math.ceil(s.styles.length / 3) - 2) * 34;
    const pyramidGraphic = pyramids(s, meta.texts);
    const pyramidBox = pyramidGraphic.match(/viewBox="0 0 (\d+) (\d+)"/);
    const pyramidHeight = Number(pyramidBox[2]) * 1640 / Number(pyramidBox[1]);
    const summaryY = 480 + pyramidHeight + 30, shift = summaryY + 160 - 1660;
    const W = 1800, H = Math.ceil(3660 + shift + legendExtra); let out = `<rect width="${W}" height="${H}" fill="var(--uat-bg)"/>`;
    const panel = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="25" fill="var(--uat-surface)"/>`;
    const embed = (chart, x, y, w) => chart.replace('<svg ', `<svg x="${x}" y="${y}" `).replace(/width="\d+" height="\d+"/, `width="${w}" height="${w * Number(chart.match(/viewBox="0 0 \d+ (\d+)"/)[1]) / Number(chart.match(/viewBox="0 0 (\d+)/)[1])}"`);
    out += text(80, 70, short([t('brand'), t('tagline')].filter(Boolean).join(' / '), 140), 15, 'var(--uat-ink)', 700);
    out += text(80, 150, short(t(meta.demo ? 'poster_demo_title' : 'poster_title'), 48), 60, 'var(--uat-heading)', 800);
    out += text(80, 193, t('poster_period_description'), 18);
    if (meta.demo) out += text(80, 225, 'DONNÉES FICTIVES — AUCUN RÉSULTAT PERSONNEL', 16, 'var(--uat-demo-text)', 700);
    const metrics = [
      ['checkins', fmt(s.total), t('kpi_checkins')],
      ['beers', fmt(s.uniqueBeers), t('kpi_beers')],
      ['breweries', fmt(s.uniqueBreweries), t('kpi_breweries')],
      ['average', fmt(s.average, 2), t('kpi_average')]
    ];
    metrics.forEach(([icon, value, label], i) => {
      const x = 80 + i * 420;
      out += `<g transform="translate(${x} 263)">${metricIcon(icon, 76)}</g>`;
      out += text(x + 92, 329, value, 76, 'var(--uat-ink)', 800) + text(x, 365, short(label, 34), 21);
    });
    out += text(80, 460, short(t('pyramids_title'), 70), 26, 'var(--uat-heading)', 800);
    out += embed(pyramidGraphic, 80, 480, 1640);
    [[t('first_label'), s.first?.beer || '—', t('first_description')], [t('biggest_label'), t('checkins_count', {count: fmt(s.biggestDay?.count || 0)}), t('biggest_description')], [t('last_label'), s.last?.beer || '—', t('last_description')], [t('poster_active_days_title'), fmt(s.activeDays), t('poster_active_days_description')]].forEach(([label, value, sub], i) => {
      const x = 80 + i * 420;
      out += text(x, summaryY, short(label, 30), 14, 'var(--uat-muted)', 600) + text(x, summaryY + 39, short(value, 23), 25, 'var(--uat-ink)', 800) + text(x, summaryY + 68, sub, 16);
    });
    out += `<g transform="translate(0 ${shift})">`;
    s.styles.forEach((st, i) => { const x = 110 + (i % 3) * 555, y = 1660 + Math.floor(i / 3) * 34; out += paintShape('circle', `cx="${x}" cy="${y - 5}" r="6"`, paints.get(st.key)) + text(x + 15, y, `${short(st.label, 45)} · ${fmt(st.count)}`, 15); });
    out += `</g><g transform="translate(0 ${shift + legendExtra})">`;
    const chartPanels = [[t('heat_title'), t('heat_subtitle'), heat(s, meta.texts)], [t('styles_time_title'), t('styles_time_subtitle'), styleTimeline(s, meta.grain || 'month', meta.texts)], [t('ratings_title'), t('ratings_subtitle'), ratings(s, meta.texts)], [t('activity_title'), t('activity_subtitle'), timeline(s, meta.grain || 'month', false, meta.texts)], [t('average_title'), t('average_subtitle'), timeline(s, meta.grain || 'month', true, meta.texts)]];
    chartPanels.forEach(([title, sub, chart], i) => { const x = 80 + i % 3 * 555, y = 1750 + Math.floor(i / 3) * 345; out += panel(x, y, 530, 320) + text(x + 25, y + 43, short(title, 36), 23, 'var(--uat-heading)', 800) + text(x + 25, y + 72, short(sub, 65), 14) + embed(chart, x + 25, y + 100, 480); });
    out += panel(1190, 2095, 530, 320) + text(1215, 2138, t('social_title'), 23, 'var(--uat-heading)', 800);
    [[s.withPhotos, t('photos_label')], [s.withoutPhotos, t('without_photos_label')], [s.withShout, t('shouts_label')], [s.commentsUnknown === s.total ? '—' : s.comments, t('comments_label')], [s.distinctCommenters, t('commenters_label')], [s.toastsUnknown === s.total ? '—' : s.toasts, t('toasts_label')]].forEach(([n, label], i) => { const x = 1215 + i % 2 * 245, y = 2205 + Math.floor(i / 2) * 64; out += text(x, y, typeof n === 'number' ? fmt(n) : n, 27, 'var(--uat-ink)', 800) + text(x, y + 20, label, 12); });
    [[t('styles_title'), s.styles], [t('breweries_title'), s.breweries], [t('beers_title'), s.beers]].forEach(([title, rows], i) => { const x = 80 + i * 555, y = 2440; out += panel(x, y, 530, 405) + text(x + 25, y + 44, short(title, 32), 25, 'var(--uat-heading)', 800); rows.slice(0, 7).forEach((r, j) => { const yy = y + 88 + j * 41; out += text(x + 25, yy, `${String(j + 1).padStart(2, '0')}  ${short(r.label, 34)}`, 16, 'var(--uat-ink)') + text(x + 502, yy, fmt(r.count), 16, 'var(--uat-ink)', 700, 'text-anchor="end"') + paintShape('rect', `x="${x + 52}" y="${yy + 9}" width="${Math.max(1, r.count / rows[0].count * 410)}" height="4" rx="2"`, i === 0 ? paints.get(r.key) : {base: colors[i]}); }); });
    out += text(80, 2910, t('yearly_title'), 30, 'var(--uat-heading)', 800);
    const winners = s.yearlyWinners.slice(-12), yearWidth = 1640 / Math.max(1, winners.length);
    winners.forEach((r, i) => { const x = 80 + i * yearWidth; out += text(x, 2953, r.year, 22, 'var(--uat-ink)', 800) + paintShape('rect', `x="${x}" y="2973" width="${yearWidth - 18}" height="14" rx="5"`, paints.get(r.style)) + text(x, 3019, short(r.style, Math.max(10, Math.floor(yearWidth / 8))), 13) + text(x, 3044, t('yearly_description', {count: fmt(r.count)}), 12); });
    out += text(80, 3110, t('poster_coverage_title'), 14, 'var(--uat-heading)', 700);
    [t('poster_status_description'), t('poster_missing_description'), t(s.commentersComplete ? 'poster_commenters_complete' : 'poster_commenters_partial'), t('poster_absence_description'), t('poster_identity_description'), t('poster_excel_description')].filter(Boolean).forEach((line, i) => { out += text(80, 3147 + i * 29, short(line, 150), 15); });
    out += panel(80, 3320, 1640, 190) + text(105, 3355, short(t('badges_title'), 70), 24, 'var(--uat-heading)', 800);
    out += text(105, 3380, t(s.badgesUnknown === s.total ? 'poster_badges_empty' : 'poster_badges_description'), 15);
    s.badges.slice(0, 6).forEach((b, i) => { out += text(105 + i % 3 * 535, 3425 + Math.floor(i / 3) * 35, short(b.label, 35) + (b.level == null ? '' : t('poster_badge_level', {level: fmt(b.level)})), 16, 'var(--uat-ink)'); });
    out += `<path d="M80 3580H1720" stroke="var(--uat-border)"/>` + text(80, 3613, short(t('footer_left'), 140), 13) + text(1720, 3613, short(t('brand'), 36), 13, 'var(--uat-ink)', 700, 'text-anchor="end"');
    out += '</g>';
    return svg(W, H, out, 'Rapport Untappd Atlas — pyramides de canettes');
  }

  window.UATView = {stylePalette, styleSwatch, styleLegend, pyramids, pyramidLayout, pyramidGeometry, pyramidScene, pyramidYear, pyramidCards, heat, ratings, timeline, styleTimeline, ranking, yearlyStyleCards, poster, badgeTiles};
  function boot(scope = document) {
    if (scope.matches?.('.uat-app[data-config]')) mount(scope);
    scope.querySelectorAll('.uat-app[data-config]').forEach(mount);
  }
  boot();
  function editorHook() {
    for (const name of ['untappd-atlas', 'untappd-atlas-story']) {
      window.elementorFrontend?.hooks.addAction('frontend/element_ready/' + name + '.default', scope => boot(scope[0] || scope));
    }
  }
  if (window.elementorFrontend?.hooks) editorHook();
  else if (window.jQuery) window.jQuery(window).on('elementor/frontend/init.uat', editorHook);
  function mount(app) {
    if (app.dataset.uatMounted) return;
    app.dataset.uatMounted = '1';
    const config = JSON.parse(app.dataset.config || '{}');
    const texts = config.texts || {};
    const storyOnly = config.storyOnly && !!window.UATStory;
    let context = {};
    const t = (key, values = {}) => window.UATContent.value(texts, key, '', {...context, ...values});
    const safe = window.UATContent.html;
    const h = key => safe(t(key));
    const tag = (key, name = 'p', cls = '') => t(key) ? `<${name}${cls ? ` class="${cls}"` : ''}>${h(key)}</${name}>` : '';
    let items = [], rawMap = new Map(), source = '', profile = '', isDemo = false, state = null, running = false, generation = 0, pending = false, currentStats = null;
    let checkingProfile = false;
    let token = ''; const storageKey = 'untappd-atlas-session:' + config.api;
    try { token = sessionStorage.getItem(storageKey) || ''; } catch (_) { /* Private mode may disable storage; the current tab still works. */ }
    let zone = config.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    try { C.zoned(new Date().toISOString(), zone); } catch (_) { zone = 'UTC'; }
    const grain = 'month';
    app.innerHTML = `${storyOnly ? '' : `<section class="uat-intro">${tag('hero_title', 'h2')}${tag('hero_subtitle')}</section>`}
      <section class="uat-import" aria-label="Importer mes données"><form class="uat-import-top"><label class="uat-field uat-profile-field">${tag('profile_label', 'span')}<input name="profile" type="text" placeholder="${esc(t('profile_placeholder'))}" autocomplete="off" maxlength="200" required aria-label="Lien ou pseudo du profil Untappd"></label><button type="submit">${h('import_button')}</button><button type="button" data-action="oauth" class="uat-secondary" ${config.configured ? '' : 'hidden'}>${h('connect_button')}</button></form>
      <div class="uat-import-bottom"><label ${config.configured ? '' : 'hidden'}><input type="checkbox" data-enrich> ${h('enrich_label')} ${t('enrich_description') ? `<span title="${esc(t('enrich_description'))}">ⓘ</span>` : ''}</label><div class="uat-import-actions"><label class="uat-file">${h('file_button')}<input type="file" accept=".csv,.json,text/csv,application/json" aria-label="Importer un fichier CSV ou JSON"></label></div></div>
      ${config.configured ? tag('import_api_description', 'p', 'uat-import-help') : ''}</section>
      <div class="uat-message" role="status" aria-live="polite" hidden></div><section class="uat-progress" hidden><div data-progress-copy><p data-progress-text role="status"></p><progress data-progress-meter aria-label="Progression de l’import du profil" hidden></progress><small data-progress-sub></small></div><div class="uat-progress-actions"><button class="uat-secondary" data-action="pause" type="button">${h('pause_button')}</button><button data-action="resume" type="button">${h('resume_button')}</button><button class="uat-secondary" data-action="erase" type="button">${h('erase_button')}</button></div></section>
      <section class="uat-report" hidden>${storyOnly ? `<section class="uat-story uat-story--inline"></section><div class="uat-story-actions"><button type="button" class="uat-text-button" data-action="clear">${h('clear_button')}</button></div>` : `<div class="uat-demo-notice" hidden><strong>DÉMONSTRATION</strong><span>Données entièrement fictives. Elles ne correspondent pas au profil Colonelchaboum.</span></div>
      <div class="uat-report-head"><div><p class="uat-kicker" data-source></p><h2 class="uat-profile-name" data-title></h2></div><div class="uat-export-buttons">${window.UATStory && t('story_open') ? `<button type="button" data-action="story" aria-haspopup="dialog">${h('story_open')}</button>` : ''}<button type="button" class="uat-text-button" data-action="clear">${h('clear_button')}</button><button type="button" class="uat-secondary" data-action="png">${h('export_png')}</button><button type="button" data-action="xlsx">${h('export_excel')}</button></div></div>
      <div class="uat-results"></div>`}</section>
      <div class="uat-share" hidden><button type="button" class="uat-secondary" data-action="share">Conserver une copie pour les statistiques du site</button><p class="uat-import-help">La copie reste accessible aux administrateurs après l’expiration ou l’effacement de cette session.</p></div>
      ${storyOnly ? '' : `<div class="uat-onboard">${tag('onboard_title', 'strong')}</div>`}
      ${t('footer_left') || t('footer_right') ? `<footer class="uat-footer">${tag('footer_left', 'span')}${tag('footer_right', 'span')}</footer>` : ''}`;
    const $ = q => app.querySelector(q);
    const field = name => $(`[name="${name}"]`);
    const action = name => $(`[data-action="${name}"]`);
    const storyButton = action('story');
    const inlineStory = storyOnly ? window.UATStory.mount($('.uat-story--inline'), texts) : null;
    const story = storyButton ? window.UATStory.mountDialog(storyButton, () => ({items, timezone: zone, demo: isDemo}), texts) : null;
    const busy = value => { pending = value; $('.uat-import-top button[type=submit]').disabled = value; action('oauth').disabled = value; action('share').disabled = value; $('.uat-file input').disabled = value; };
    const notify = (message, kind = 'info') => { const el = $('.uat-message'); el.hidden = !message; el.textContent = message; el.dataset.kind = kind; };
    function statusLabel() {
      if (isDemo) return 'Démonstration — données fictives.';
      if (state?.source === 'public' && source === 'api') return `Lecture publique : ${fmt(state.count)} check-ins importés${state.profile?.expected != null ? ` sur ${fmt(state.profile.expected)} annoncés par le profil` : ''}. ${state.phase === 'done' ? 'Lecture des pages accessibles terminée.' : 'Lecture des informations de bière en cours.'} ${state.public_complete ? '' : 'HISTORIQUE PARTIEL. '}Aucun accès aux données réservées à la connexion Untappd.`;
      if (source === 'file') return 'Analyse du fichier fourni ; la complétude de l’historique dépend de cet export.';
      if (!state || state.phase === 'idle') return 'Import non démarré.';
      if (state.phase === 'done') return `Pagination API terminée : ${fmt(state.count)} check-ins importés.${state.profile?.expected && state.count !== state.profile.expected ? ` Le profil annonce ${fmt(state.profile.expected)} check-ins : écart à vérifier.` : ''}`;
      return `Historique partiel : ${fmt(state.count)} check-ins importés. ${state.phase === 'details' ? `Enrichissement des échanges : ${fmt(state.details_done)} / ${fmt(state.count)}.` : 'Import en cours ou en pause.'}`;
    }
    function publicImportMessage() {
      if (state.phase !== 'done') return 'Lecture des informations sur les bières…';
      return items.length ? '' : 'Aucun check-in public accessible pour ce profil.';
    }
    function updateImportMeter() {
      const meter = $('[data-progress-meter]');
      meter.hidden = !checkingProfile && (!running || state.phase === 'done');
      if (meter.hidden) return;
      meter.removeAttribute('value');
      if (checkingProfile) return;
      const [done, total] = {
        feed: [state.count, state.profile?.expected],
        details: [state.details_done, state.count],
        public_beers: [state.details_done, state.beer_total]
      }[state.phase] || [];
      // A profile's announced count can differ from what the feed actually returns.
      if (Number.isFinite(done) && Number.isFinite(total) && done >= 0 && done < total) {
        meter.max = total;
        meter.value = done;
      }
    }
    function progress() {
      $('.uat-share').hidden = source !== 'api' || !items.length;
      const publicDone = state?.source === 'public' && state.phase === 'done';
      const panel = $('.uat-progress');
      panel.hidden = !checkingProfile && (!state || source !== 'api' || (publicDone && !!items.length));
      updateImportMeter();
      if (panel.hidden) return;
      const label = checkingProfile ? 'Vérification du profil auprès d’Untappd…'
        : state.source === 'public' ? (publicDone ? '' : publicImportMessage()) : statusLabel();
      const quota = !checkingProfile && state.retry_at > Date.now() / 1000
        ? `Quota atteint. Reprise possible à ${new Date(state.retry_at * 1000).toLocaleString('fr-FR')}.` : '';
      $('[data-progress-copy]').hidden = !label && !quota;
      $('[data-progress-text]').textContent = label;
      $('[data-progress-sub]').textContent = quota;
      $('.uat-progress-actions').hidden = checkingProfile;
      action('pause').hidden = !running;
      action('resume').hidden = checkingProfile || running || state.phase === 'done' || state.phase === 'idle';
    }
    async function api(path, data, method = 'POST') {
      const res = await fetch(config.api + path, {method, credentials: 'same-origin', headers: {'Content-Type': 'application/json', ...(token ? {'X-UAT-Session': token} : {})}, ...(method === 'GET' ? {} : {body: JSON.stringify(data || {})})});
      try { return await readResponse(res); }
      catch (error) {
        if (error.status === 401) { token = ''; try { sessionStorage.removeItem(storageKey); } catch (_) {} }
        throw error;
      }
    }
    async function session() {
      if (token) return;
      const res = await api('session'); token = res.session;
      try { sessionStorage.setItem(storageKey, token); } catch (_) { /* Current tab only. */ }
    }
    function merge(rawItems) { rawItems.forEach(r => { const n = C.normalize(r, rawMap.size); if (n) rawMap.set(n.id, n); }); items = [...rawMap.values()]; }
    function setData(data, nextSource, nextProfile, demo = false) {
      if (story?.open) story.close();
      items = data; source = nextSource; profile = nextProfile; isDemo = demo;
      render(true); progress();
    }
    function render(restartStory = false) {
      $('.uat-report').hidden = !items.length;
      if (inlineStory) {
        inlineStory({items, timezone: zone, demo: isDemo}, restartStory);
        return;
      }
      $('.uat-onboard').hidden = !!items.length;
      $('.uat-demo-notice').hidden = !isDemo;
      if (!items.length) { currentStats = null; return; }
      const s = currentStats = C.analyze(items, {timezone: zone}), paints = stylePalette(s);
      context = {...statVariables(s), profile};
      $('[data-source]').textContent = t(isDemo ? 'source_demo' : source === 'file' ? 'source_file' : state?.source === 'public' ? 'source_public' : 'source_api');
      $('[data-title]').textContent = t(s.first ? 'report_title' : 'report_empty_title');
      const metric = (icon, n, label, small = '') => `<div class="uat-kpi"><strong>${metricIcon(icon)}${n}</strong>${label ? `<span>${safe(label)}</span>` : ''}${small ? `<small>${safe(small)}</small>` : ''}</div>`;
      const mini = (n, label, small = '') => `<div class="uat-mini"><strong>${n}</strong>${label ? `<span>${safe(label)}</span>` : ''}${small ? `<small>${safe(small)}</small>` : ''}</div>`;
      const card = (title, sub, content, cls = '') => `<article class="uat-card ${cls}">${title ? `<h3>${safe(title)}</h3>` : ''}${sub ? `<p>${safe(sub)}</p>` : ''}${content}</article>`;
      const callout = (number, label, value, sub) => `<div class="uat-callout">${label ? `<h3><span class="uat-number">${number}</span>${safe(label)}</h3>` : ''}<strong>${esc(value)}</strong><p>${esc(sub)}</p></div>`;
      const section = (title, sub = '') => t(title) || (sub && t(sub)) ? `<div class="uat-section-head">${tag(title, 'h3')}${sub ? tag(sub) : ''}</div>` : '';
      const yearlyCards = yearlyStyleCards(s, paints, count => t('yearly_description', {count: fmt(count)}));
      const allUnknown = (total, unknown, value) => unknown === total && total > 0 ? '—' : fmt(value);
      const badgeKnown = s.badgesUnknown < s.total;
      const badgeSection = `${section('badges_title', 'badges_subtitle')}<div class="uat-mini-grid">${mini(badgeKnown ? fmt(s.badges.length) : '—', t('badges_unique_label'), t('badges_unique_description'))}${mini(badgeKnown ? (s.badgesComplete ? '' : '≥ ') + fmt(s.badgeAwards) : '—', t('badges_awards_label'), t('badges_awards_description'))}${mini(fmt(s.badgesUnknown), t('badges_unknown_label'), t('badges_unknown_description'))}${mini(state?.source === 'public' && source === 'api' ? fmt(state.profile?.expected_badges) : '—', t('badges_total_label'), t('badges_total_description'))}</div><div class="uat-badge-grid">${badgeTiles(s, texts)}</div>`;
      $('.uat-results').innerHTML = `<div class="uat-kpis">${metric('checkins', fmt(s.total), t('kpi_checkins'), t('kpi_checkins_description'))}${metric('beers', fmt(s.uniqueBeers), t('kpi_beers'), t('kpi_beers_description'))}${metric('breweries', fmt(s.uniqueBreweries), t('kpi_breweries'), t('kpi_breweries_description'))}${metric('average', fmt(s.average, 2), t('kpi_average'), t('kpi_average_description'))}</div>
        ${section('pyramids_title')}<div class="uat-pyramids">${pyramidCards(s, texts)}</div>
        <div class="uat-pyramid-callouts">${callout(1, t('first_label'), s.first?.beer || '—', t('first_description'))}${callout('↗', t('favorite_label'), s.styles[0]?.label || '—', t('favorite_description', {count: fmt(s.styles[0]?.count || 0)}))}${callout(2, t('biggest_label'), t('checkins_count', {count: fmt(s.biggestDay?.count || 0)}), t('biggest_description'))}${callout(3, t('last_label'), s.last?.beer || '—', t('last_description'))}</div>
        <div class="uat-legend uat-style-legend">${styleLegend(s)}</div>
        ${section('rhythm_title', 'rhythm_subtitle')}<div class="uat-card-grid">${card(t('heat_title'), t('heat_subtitle'), `<div class="uat-chart">${heat(s, texts)}</div>`)}${card(t('styles_time_title'), t('styles_time_subtitle'), `<div class="uat-chart">${styleTimeline(s, grain, texts)}</div>`)}${card(t('ratings_title'), t('ratings_subtitle'), `<div class="uat-chart">${ratings(s, texts)}</div>${tag('ratings_note', 'p', 'uat-chart-note')}`)}${card(t('activity_title'), t('activity_subtitle'), `<div class="uat-chart">${timeline(s, grain, false, texts)}</div>`)}${card(t('average_title'), t('average_subtitle'), `<div class="uat-chart">${timeline(s, grain, true, texts)}</div>`)}${card(t('venues_title'), t('venues_subtitle'), ranking(s.venues, 6, 'var(--uat-series-2)', texts))}</div>
        ${section('favorites_title', 'favorites_subtitle')}<div class="uat-card-grid">${card(t('styles_title'), t('styles_subtitle'), ranking(s.styles, 8, row => paints.get(row.key), texts))}${card(t('breweries_title'), t('breweries_subtitle'), ranking(s.breweries, 8, 'var(--uat-series-2)', texts))}${card(t('beers_title'), t('beers_subtitle'), ranking(s.beers, 8, 'var(--uat-series-3)', texts))}</div>
        ${badgeSection}${section('social_title', 'social_subtitle')}<div class="uat-mini-grid">${mini(fmt(s.withPhotos), t('photos_label'), t('photos_description'))}${mini(fmt(s.withoutPhotos), t('without_photos_label'), t('without_photos_description'))}${mini(fmt(s.withShout), t('shouts_label'), t('shouts_description'))}${mini(allUnknown(s.total, s.commentsUnknown, s.comments), t('comments_label'), t('comments_description'))}${mini(fmt(s.distinctCommenters), t('commenters_label'), t(s.commentersComplete ? 'commenters_complete_description' : 'commenters_partial_description'))}${mini(allUnknown(s.total, s.toastsUnknown, s.toasts), t('toasts_label'), t('toasts_description'))}${mini(fmt(s.activeDays), t('active_days_label'), t('active_days_description'))}${mini(fmt(s.perCalendarDay, 2), t('calendar_days_label'), t('calendar_days_description'))}${mini(fmt(s.averageABV, 2) + ' %', t('abv_label'), t('abv_description'))}${mini(fmt(s.averageIBU, 1), t('ibu_label'), t('ibu_description'))}${mini(fmt(s.countries.length), t('countries_label'), t('countries_description'))}${mini(fmt(s.breweryCountries.length), t('brewery_countries_label'), t('brewery_countries_description'))}</div>
        ${section('details_title')}<div class="uat-card-grid">${card(t('commenters_title'), t('commenters_subtitle'), ranking(s.commenters, 7, 'var(--uat-accent)', texts))}${card(t('countries_title'), t('countries_subtitle'), ranking(s.countries, 7, 'var(--uat-series-5)', texts))}${card(t('servings_title'), t('servings_subtitle'), ranking(s.servings, 7, 'var(--uat-series-4)', texts))}</div>
        ${section('yearly_title')}<div class="uat-year-grid">${yearlyCards || tag('yearly_empty', 'p', 'uat-empty')}</div>`;
      progress();
    }
    async function loop() {
      if (running || pending || !state || !['feed', 'details', 'public_beers'].includes(state.phase)) return;
      running = true; const version = ++generation; busy(true); progress();
      try {
        while (running && version === generation && ['feed', 'details', 'public_beers'].includes(state.phase)) {
          if (state.retry_at > Date.now() / 1000) { notify(`Quota API atteint. Reprise possible à ${new Date(state.retry_at * 1000).toLocaleString('fr-FR')}.`); break; }
          const res = await api('step');
          state = res.state; merge(res.items || []); render(); progress();
          if (!running || version !== generation || state.phase === 'done') break;
          await new Promise(resolve => setTimeout(resolve, state.source === 'public' ? 1100 : 450));
        }
        if (state.phase === 'done') {
          if (state.source === 'public') notify(publicImportMessage());
          else notify(storyOnly ? 'Import terminé. Votre récapitulatif est prêt.' : 'Import terminé. Vos statistiques et exports sont prêts.', 'success');
        }
      } catch (error) {
        if (error.retryAt) state.retry_at = error.retryAt;
        notify(error.message, 'error');
      } finally { running = false; busy(false); progress(); }
    }
    $('.uat-import-top').addEventListener('submit', async event => {
      event.preventDefault(); if (pending) return;
      checkingProfile = true; busy(true); notify(''); progress();
      try {
        await session(); const res = await api('start', {profile: field('profile').value.trim(), source: config.configured ? 'api' : 'public', enrich: $('[data-enrich]').checked});
        checkingProfile = false; rawMap = new Map(); state = res.state;
        merge(res.items || []); setData(items, 'api', state.profile.username);
        if (state.source === 'public' && state.phase === 'done') notify(publicImportMessage());
        busy(false); await loop();
      } catch (error) {
        if (error.status === 401) { token = ''; try { sessionStorage.removeItem(storageKey); } catch (_) {} }
        notify(error.message, 'error');
      } finally { checkingProfile = false; busy(false); progress(); }
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
    action('pause').addEventListener('click', () => { running = false; notify('Pause demandée. La requête en cours sera enregistrée avant l’arrêt.'); progress(); });
    action('resume').addEventListener('click', () => { notify(''); loop(); });
    async function eraseData() {
      if (pending) { running = false; notify('La requête en cours doit se terminer. Cliquez ensuite sur Effacer.'); return; }
      busy(true);
      try { if (token) await api('erase'); token = ''; try { sessionStorage.removeItem(storageKey); } catch (_) {} state = null; rawMap = new Map(); setData([], '', ''); notify('Les données et le jeton de cette session ont été effacés.', 'success'); }
      catch (error) { notify(error.message, 'error'); } finally { busy(false); }
    }
    action('erase').addEventListener('click', eraseData);
    action('clear').addEventListener('click', eraseData);
    action('share').addEventListener('click', async () => {
      if (pending || source !== 'api' || !items.length) return;
      busy(true);
      try {
        const result = await api('share');
        notify(`${fmt(result.shared)} check-ins copiés dans les statistiques du site.`, 'success');
      } catch (error) { notify(error.message, 'error'); }
      finally { busy(false); }
    });
    action('oauth').addEventListener('click', async () => {
      if (pending) return; busy(true);
      try { await session(); const clean = new URL(location.href); clean.hash = ''; const res = await api('oauth', {return: clean.href}); location.assign(res.url); }
      catch (error) { notify(error.message, 'error'); busy(false); }
    });
    function meta() { return {texts, variables: {...context}, profile, profileBadgesTotal: state?.source === 'public' && source === 'api' ? state.profile?.expected_badges : null, demo: isDemo, source: source === 'file' ? 'Export de fichier Untappd' : (state?.source === 'public' ? 'Pages publiques Untappd (limitées)' : 'API Untappd'), status: statusLabel(), timezone: zone, grain}; }
    for (const type of ['xlsx', 'png']) action(type)?.addEventListener('click', async () => {
      if (!currentStats) return;
      const button = action(type); button.disabled = true;
      try {
        notify(type === 'png' ? 'Création de votre affiche PNG…' : 'Création du classeur Excel…');
        await new Promise(resolve => setTimeout(resolve, 20));
        const blob = type === 'xlsx' ? E.xlsx(currentStats, meta()) : await E.png(window.UATTheme.inlineSvg(poster(currentStats, meta()), app));
        E.download(blob, `untappd-atlas${isDemo ? '-DEMO' : ''}-${new Date().toISOString().slice(0, 10)}.${type}`); notify('Votre export est prêt.', 'success');
      } catch (error) { notify(error.message, 'error'); } finally { button.disabled = false; }
    });
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
