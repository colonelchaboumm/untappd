/* Untappd Atlas — parsing and statistics, no network or DOM dependency. */
(function (root) {
  'use strict';
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);
  const num = x => x === '' || x == null || !Number.isFinite(Number(String(x).replace(',', '.'))) ? null : Number(String(x).replace(',', '.'));
  const str = x => x == null ? '' : String(x);
  const pick = (o, keys) => { for (const k of keys) if (own(o, k) && o[k] !== '') return o[k]; return undefined; };
  function csv(text) {
    text = text.replace(/^\uFEFF/, '');
    const first = text.split(/\r?\n/, 1)[0];
    const delimiter = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
    const rows = []; let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c; }
      else if (c === '"' && !cell) quoted = true;
      else if (c === delimiter) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some(x => x !== '')) rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (quoted) throw new Error('CSV invalide : un champ entre guillemets n’est pas fermé.');
    if (cell || row.length) { row.push(cell); rows.push(row); }
    if (rows.length < 2) throw new Error('Le fichier CSV ne contient aucune évaluation.');
    const headers = rows.shift().map(h => h.trim().toLowerCase().replace(/[\s-]+/g, '_'));
    if (new Set(headers).size !== headers.length) throw new Error('CSV invalide : colonnes en double.');
    return rows.map((r, index) => {
      if (r.length !== headers.length) throw new Error(`CSV : nombre de colonnes incorrect à la ligne ${index + 2}.`);
      return Object.fromEntries(headers.map((h, i) => [h, r[i]]));
    });
  }
  function extract(data) {
    if (Array.isArray(data)) return data;
    for (const value of [data?.response?.checkins?.items, data?.checkins?.items, data?.checkins, data?.items, data?.data]) if (Array.isArray(value)) return value;
    throw new Error('JSON non reconnu. Importez une liste de check-ins ou un export Untappd.');
  }
  function dateValue(value) {
    if (typeof value === 'number') return new Date(value < 1e12 ? value * 1000 : value);
    let v = str(value).trim();
    // Untappd CSV timestamps without zone are interpreted as UTC, explicitly documented.
    if (/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d(?::\d\d)?$/.test(v)) v = v.replace(' ', 'T') + 'Z';
    if (/^\d{4}-\d\d-\d\d$/.test(v)) v += 'T00:00:00Z';
    if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/.test(v)) return new Date(NaN);
    return new Date(v);
  }
  function normalize(raw, index = 0) {
    if (!raw || typeof raw !== 'object') return null;
    const beer = raw.beer || {}, brewery = raw.brewery || {}, venue = raw.venue || {};
    const d = dateValue(pick(raw, ['created_at', 'checkin_date', 'date', 'timestamp']));
    if (!Number.isFinite(d.getTime())) return null;
    const rating = num(pick(raw, ['rating_score', 'rating', 'your_rating']));
    const media = raw.media, comments = raw.comments, toasts = raw.toasts;
    let photos = num(pick(raw, ['photo_count', 'photos_count']));
    if (media && typeof media === 'object') photos = num(media.count) ?? (Array.isArray(media.items) ? media.items.length : null);
    const photo = pick(raw, ['photo_url', 'photo', 'checkin_photo', 'photo_url_full', 'photo_url_sm']);
    if (photo !== undefined) photos = str(photo).trim() ? 1 : 0;
    // An explicitly empty photo column still establishes the absence of a photo.
    if (photos == null && ['photo_url', 'photo', 'checkin_photo', 'photo_url_full', 'photo_url_sm'].some(k => own(raw, k))) photos = 0;
    const list = Array.isArray(comments) ? comments : (Array.isArray(comments?.items) ? comments.items : []);
    let commentsCount = num(pick(raw, ['comments_count', 'comment_count']));
    if (comments && typeof comments === 'object') commentsCount = num(comments.count) ?? list.length;
    const commenters = list.map(c => ({
      id: str(c.user?.uid ?? c.user?.user_name ?? c.user_id ?? c.username),
      name: str(c.user?.user_name ?? c.username ?? c.user?.first_name ?? c.user_id),
      text: str(c.comment ?? c.comment_text ?? c.text),
      date: str(c.created_at)
    }));
    let toastCount = num(pick(raw, ['toasts_count', 'toast_count']));
    if (toasts && typeof toasts === 'object') toastCount = num(toasts.count) ?? (Array.isArray(toasts.items) ? toasts.items.length : null);
    const beerName = str(beer.beer_name ?? pick(raw, ['beer_name', 'name'])).trim();
    const breweryName = str(brewery.brewery_name ?? raw.brewery_name ?? (typeof raw.brewery === 'string' ? raw.brewery : '')).trim();
    if (!beerName) return null;
    const id = str(pick(raw, ['checkin_id', 'id']));
    return {
      id: id || `row:${index}`, synthetic: !id, date: d.toISOString(),
      beer: beerName, beerId: str(beer.bid ?? raw.bid ?? raw.beer_id) || `name:${breweryName}|${beerName}`,
      brewery: breweryName || 'Brasserie inconnue', breweryId: str(brewery.brewery_id ?? raw.brewery_id) || (breweryName ? `name:${breweryName}` : ''),
      style: str(beer.beer_style ?? pick(raw, ['beer_type', 'beer_style', 'style'])) || 'Style inconnu',
      abv: num(beer.beer_abv ?? pick(raw, ['beer_abv', 'abv'])), ibu: num(beer.beer_ibu ?? pick(raw, ['beer_ibu', 'ibu'])),
      rating: rating != null && rating > 0 && rating <= 5 ? rating : null,
      photos: photos == null ? null : Math.max(0, photos),
      shout: str(pick(raw, ['checkin_comment', 'comment', 'shout', 'description'])),
      commentsCount: commentsCount == null ? null : Math.max(0, commentsCount), commenters,
      commentsComplete: commentsCount != null && list.length >= commentsCount && commenters.filter(c => c.id).length >= commentsCount,
      toasts: toastCount, venue: str(venue.venue_name ?? raw.venue_name),
      city: str(venue.location?.venue_city ?? raw.venue_city),
      country: str(venue.location?.venue_country ?? raw.venue_country),
      breweryCountry: str(brewery.country_name ?? raw.brewery_country),
      serving: str(raw.serving_type ?? raw.serving_style ?? raw.serving?.serving_type),
      ...badgeData(raw)
    };
  }
  function badgeImage(value) {
    try { const u = new URL(str(value)); return u.protocol === 'https:' && !u.username && !u.password && ['assets.untappd.com', 'images.untp.beer', 'untappd.s3.amazonaws.com'].includes(u.hostname) ? u.href : ''; } catch (_) { return ''; }
  }
  function badgeData(raw) {
    let value = raw.badges ?? raw.badge_names;
    if (typeof value === 'string') { try { value = JSON.parse(value); } catch (_) { value = value.trim() ? value.split(/[|;\n]/) : []; } }
    const list = Array.isArray(value) ? value : (Array.isArray(value?.items) ? value.items : null);
    const explicit = num(value?.count ?? raw.badges_count);
    const count = explicit != null && explicit >= 0 ? Math.max(explicit, list?.length || 0) : (list ? list.length : null);
    const seen = new Set(), badges = [];
    for (const original of list || []) {
      const b = typeof original === 'string' ? {badge_name: original} : original;
      if (!b || typeof b !== 'object') continue;
      const label = str(b.badge_name ?? b.name).trim(); if (!label) continue;
      const suffix = label.match(/\s*\((?:Level|Niveau)\s+(\d+)\)\s*$/i);
      const name = suffix ? label.slice(0, suffix.index).trim() : label;
      const level = num(b.badge_level ?? b.level ?? suffix?.[1]);
      const id = str(b.badge_id ?? b.id) || 'name:' + name.toLowerCase();
      const key = id + '|' + (level ?? ''); if (seen.has(key)) continue; seen.add(key);
      const d = dateValue(b.created_at ?? b.earned_at);
      badges.push({id, name, level: level != null && level > 0 ? level : null, image: badgeImage(b.badge_image?.sm ?? b.badge_image?.md ?? b.badge_image ?? b.image), earnedAt: Number.isFinite(d.getTime()) ? d.toISOString() : null});
    }
    return {badges, badgesCount: count, badgesComplete: count != null && badges.length >= count && raw.badges_partial !== true};
  }
  function parse(text, filename = '') {
    const raw = /\.json$/i.test(filename) || /^[\s\uFEFF]*[\[{]/.test(text) ? extract(JSON.parse(text.replace(/^\uFEFF/, ''))) : csv(text);
    const result = [], ids = new Set(); let invalid = 0, duplicates = 0;
    raw.forEach((r, i) => { const n = normalize(r, i); if (!n) invalid++; else if (!n.synthetic && ids.has(n.id)) duplicates++; else { ids.add(n.id); result.push(n); } });
    if (!result.length) throw new Error('Aucune évaluation exploitable. Les champs beer_name et created_at sont nécessaires ; utilisez des dates ISO ou Untappd.');
    return {items: result, invalid, duplicates, missingIds: result.filter(x => x.synthetic).length};
  }
  const formatters = new Map();
  function zoned(date, timezone) {
    if (!formatters.has(timezone)) formatters.set(timezone, new Intl.DateTimeFormat('en-GB', {timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}));
    const p = Object.fromEntries(formatters.get(timezone).formatToParts(new Date(date)).filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
    const key = `${p.year}-${p.month}-${p.day}`, utc = new Date(key + 'T12:00:00Z');
    return {day: key, month: key.slice(0, 7), year: p.year, hour: Number(p.hour), minute: Number(p.minute), weekday: (utc.getUTCDay() + 6) % 7, week: weekKey(key)};
  }
  function weekKey(day) {
    const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 3 - (d.getUTCDay() + 6) % 7);
    const year = d.getUTCFullYear(), first = new Date(Date.UTC(year, 0, 4, 12));
    return `${year}-W${String(1 + Math.round(((d - first) / 86400000 - 3 + (first.getUTCDay() + 6) % 7) / 7)).padStart(2, '0')}`;
  }
  function groupRows(rows, getKey) {
    const groups = new Map();
    rows.forEach(r => {
      const key = getKey(r); if (!key) return;
      if (!groups.has(key)) groups.set(key, {key, count: 0, rated: 0, sum: 0, photos: 0, photosKnown: 0, comments: 0, commentsKnown: 0, beers: new Set(), label: key});
      const g = groups.get(key); g.count++; g.beers.add(r.beerId);
      if (r.rating != null) { g.rated++; g.sum += r.rating; }
      if (r.photos != null) { g.photosKnown++; g.photos += r.photos > 0 ? 1 : 0; }
      if (r.commentsCount != null) { g.commentsKnown++; g.comments += r.commentsCount; }
    });
    return [...groups.values()].map(g => ({...g, beers: g.beers.size, average: g.rated ? g.sum / g.rated : null}));
  }
  function periods(rows, grain) {
    const grouped = new Map(groupRows(rows, r => r.local[grain]).map(g => [g.key, g]));
    if (!rows.length) return [];
    const start = new Date(rows[0].local.day + 'T12:00:00Z'), end = new Date(rows[rows.length - 1].local.day + 'T12:00:00Z');
    const keys = new Set(); let days = 0;
    for (let d = new Date(start); d <= end && days < 40000; d.setUTCDate(d.getUTCDate() + 1), days++) {
      const day = d.toISOString().slice(0, 10);
      keys.add(grain === 'day' ? day : grain === 'month' ? day.slice(0, 7) : grain === 'year' ? day.slice(0, 4) : weekKey(day));
    }
    return [...keys].sort().map(key => grouped.get(key) || {key, label: key, count: 0, rated: 0, sum: 0, photos: 0, photosKnown: 0, comments: 0, commentsKnown: 0, beers: 0, average: null});
  }
  function analyze(items, options = {}) {
    const timezone = options.timezone || 'Europe/Paris';
    let rows = items.map(r => ({...r, local: zoned(r.date, timezone)}));
    rows = rows.filter(r => (!options.from || r.local.day >= options.from) && (!options.to || r.local.day <= options.to) && (!options.style || r.style === options.style)).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const rated = rows.filter(r => r.rating != null), withPhotos = rows.filter(r => r.photos > 0), photoKnown = rows.filter(r => r.photos != null);
    const commentKnown = rows.filter(r => r.commentsCount != null), toastKnown = rows.filter(r => r.toasts != null);
    const rank = (getter, label) => groupRows(rows, getter).map(g => ({...g, label: label ? label(g.key) : g.key})).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    const beerLabels = new Map(rows.map(r => [r.beerId, `${r.beer} · ${r.brewery}`]));
    const breweryLabels = new Map(rows.map(r => [r.breweryId, r.brewery]));
    const styles = rank(r => r.style), breweries = rank(r => r.breweryId, k => breweryLabels.get(k)), beers = rank(r => r.beerId, k => beerLabels.get(k));
    const heat = Array.from({length: 7}, () => Array(24).fill(0));
    rows.forEach(r => heat[r.local.weekday][r.local.hour]++);
    const distribution = Array.from({length: 21}, (_, i) => ({rating: i / 4, count: 0}));
    rated.forEach(r => distribution[Math.min(20, Math.max(0, Math.round(r.rating * 4)))].count++);
    const sortedRatings = rated.map(r => r.rating).sort((a, b) => a - b), mid = Math.floor(sortedRatings.length / 2);
    const commenters = new Map();
    rows.forEach(r => r.commenters.forEach(c => { if (!c.id) return; const prior = commenters.get(c.id) || {key: c.id, label: c.name || c.id, count: 0}; prior.count++; commenters.set(c.id, prior); }));
    const dayRows = groupRows(rows, r => r.local.day).sort((a, b) => a.key.localeCompare(b.key));
    let streak = {count: 0, from: '', to: ''}, current = null;
    dayRows.forEach(d => { const delta = current ? (new Date(d.key) - new Date(current.to)) / 86400000 : 0; current = delta === 1 ? {...current, count: current.count + 1, to: d.key} : {count: 1, from: d.key, to: d.key}; if (current.count > streak.count) streak = {...current}; });
    let longestGap = {days: 0, from: '', to: ''};
    dayRows.forEach((d, i) => { if (!i) return; const days = (new Date(d.key) - new Date(dayRows[i - 1].key)) / 86400000 - 1; if (days > longestGap.days) longestGap = {days, from: dayRows[i - 1].key, to: d.key}; });
    const yearly = groupRows(rows, r => `${r.local.year}\t${r.style}`).sort((a, b) => b.count - a.count);
    const winners = new Map(); yearly.forEach(g => { const [year, style] = g.key.split('\t'); if (!winners.has(year)) winners.set(year, {year, style, count: g.count}); });
    const n = rows.length, avg = rated.length ? rated.reduce((a, r) => a + r.rating, 0) / rated.length : null;
    const activeDays = dayRows.length, calendarDays = n ? Math.round((new Date(rows[n - 1].local.day) - new Date(rows[0].local.day)) / 86400000) + 1 : 0;
    const periodCache = new Map(), styleCache = new Map();
    const badgeMap = new Map(), badgeEvents = [];
    for (const r of rows) for (const b of r.badges || []) {
      const event = {...b, checkin: r.id, date: b.earnedAt || r.date, checkinDate: r.date}; badgeEvents.push(event);
      const prior = badgeMap.get(b.id) || {key: b.id, label: b.name, count: 0, level: null, image: b.image, first: event.date, last: event.date};
      prior.count++; prior.level = b.level == null ? prior.level : Math.max(prior.level || 0, b.level); prior.image ||= b.image;
      if (event.date < prior.first) prior.first = event.date; if (event.date > prior.last) prior.last = event.date;
      badgeMap.set(b.id, prior);
    }
    const badgeKnown = rows.filter(r => r.badgesCount != null);
    return {
      rows, timezone, total: n, rated: rated.length, unrated: n - rated.length, average: avg,
      badges: [...badgeMap.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)), badgeEvents,
      badgeAwards: badgeKnown.reduce((sum, r) => sum + r.badgesCount, 0), badgesUnknown: n - badgeKnown.length,
      badgesComplete: rows.every(r => r.badgesComplete),
      median: sortedRatings.length ? (sortedRatings[mid] + sortedRatings[Math.floor((sortedRatings.length - 1) / 2)]) / 2 : null,
      min: sortedRatings[0] ?? null, max: sortedRatings[sortedRatings.length - 1] ?? null,
      uniqueBeers: new Set(rows.map(r => r.beerId)).size, uniqueBreweries: new Set(rows.map(r => r.breweryId).filter(Boolean)).size,
      ratedUniqueBeers: new Set(rated.map(r => r.beerId)).size, ratedUniqueBreweries: new Set(rated.map(r => r.breweryId).filter(Boolean)).size,
      styles, breweries, beers, venues: rank(r => r.venue), countries: rank(r => r.country), breweryCountries: rank(r => r.breweryCountry), servings: rank(r => r.serving),
      withPhotos: withPhotos.length, withoutPhotos: photoKnown.length - withPhotos.length, photoUnknown: n - photoKnown.length, photos: withPhotos.reduce((s, r) => s + r.photos, 0),
      withShout: rows.filter(r => r.shout.trim()).length,
      comments: commentKnown.reduce((s, r) => s + r.commentsCount, 0), commentsUnknown: n - commentKnown.length,
      distinctCommenters: commenters.size, commenters: [...commenters.values()].sort((a, b) => b.count - a.count),
      commentersComplete: rows.every(r => r.commentsComplete),
      toasts: toastKnown.reduce((s, r) => s + r.toasts, 0), toastsUnknown: n - toastKnown.length,
      activeDays, calendarDays, perCalendarDay: calendarDays ? n / calendarDays : 0, perActiveDay: activeDays ? n / activeDays : 0,
      streak, longestGap, biggestDay: [...dayRows].sort((a, b) => b.count - a.count)[0] || null,
      first: rows[0] || null, last: rows[n - 1] || null,
      averageABV: rows.some(r => r.abv != null) ? rows.filter(r => r.abv != null).reduce((s, r) => s + r.abv, 0) / rows.filter(r => r.abv != null).length : null,
      averageIBU: rows.some(r => r.ibu != null) ? rows.filter(r => r.ibu != null).reduce((s, r) => s + r.ibu, 0) / rows.filter(r => r.ibu != null).length : null,
      distribution, heat, yearlyWinners: [...winners.values()].sort((a, b) => a.year.localeCompare(b.year)),
      periods: grain => { if (!periodCache.has(grain)) periodCache.set(grain, periods(rows, grain)); return periodCache.get(grain); },
      stylePeriods: grain => { if (!styleCache.has(grain)) styleCache.set(grain, groupRows(rows, r => `${r.local[grain]}\t${r.style}`).sort((a, b) => a.key.localeCompare(b.key))); return styleCache.get(grain); }
    };
  }
  function demo() {
    // Deterministic fictitious data, never presented as a real profile.
    const styles = ['IPA - New England / Hazy', 'Stout - Imperial / Double', 'Sour - Fruited', 'Pale Ale - American', 'Pilsner - German', 'IPA - American', 'Lager - Helles', 'Belgian Tripel', 'Porter - Baltic', 'Saison'];
    const breweries = ['Brasserie Aurore', 'Atelier du Houblon', 'Les Trois Lunes', 'Brasserie des Dunes', 'Maison Sauvage', 'La Fabrique'];
    let seed = 93; const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const rows = [];
    for (let day = 0; day < 1826; day++) {
      const weekend = new Date(Date.UTC(2021, 0, day + 1)).getUTCDay() % 6 === 0;
      const count = random() < (weekend ? .58 : .26) ? 1 + Math.floor(random() * 4) : 0;
      for (let j = 0; j < count; j++) {
        const style = Math.floor(Math.pow(random(), 1.7) * styles.length), beer = Math.floor(random() * 380), brewer = beer % breweries.length;
        const date = new Date(Date.UTC(2021, 0, day + 1, 15 + Math.floor(random() * 8), Math.floor(random() * 60)));
        const commentsCount = random() < .3 ? Math.floor(random() * 5) : 0;
        rows.push(normalize({checkin_id: String(10000 + rows.length), created_at: date.toISOString(), beer: {bid: beer + 1, beer_name: ['Brume', 'Éclipse', 'Mirage', 'Horizon', 'Équinoxe'][beer % 5] + ' ' + (beer + 1), beer_style: styles[style], beer_abv: 4 + Math.round(random() * 70) / 10, beer_ibu: Math.round(random() * 85)}, brewery: {brewery_id: brewer + 1, brewery_name: breweries[brewer], country_name: 'France'}, rating_score: random() < .08 ? 0 : Math.min(5, 2 + Math.floor(random() * 13) / 4), media: {count: random() < .65 ? 1 : 0}, checkin_comment: random() < .4 ? 'Une belle découverte.' : '', comments: {count: commentsCount, items: Array.from({length: commentsCount}, () => { const id = 1 + Math.floor(random() * 24); return {user: {uid: id, user_name: `Amateur ${id}`}, comment: 'À découvrir !'}; })}, toasts: {count: Math.floor(random() * 15)}, venue: {venue_name: ['Chez les copains', 'La Cave', 'Le Comptoir'][beer % 3], location: {venue_country: ['France', 'Belgique', 'Pays-Bas'][beer % 3], venue_city: 'Lille'}}, badges: {count: beer % 3 === 0 ? 1 : 0, items: beer % 3 === 0 ? [{badge_name: ['Wheel of Styles', 'IPA Day', 'Cheers to Independent U.S. Craft Breweries'][beer % 3], badge_level: 1 + beer % 10}] : []}, serving_type: ['Canette', 'Pression', 'Bouteille'][beer % 3]}, rows.length));
      }
    }
    return rows;
  }
  const api = {csv, extract, normalize, parse, analyze, zoned, weekKey, periods, demo, badgeImage};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.UATCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
