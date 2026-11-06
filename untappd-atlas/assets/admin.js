(function () {
  'use strict';
  const panel = document.querySelector('[data-uat-admin]');
  if (!panel) return;
  const config = JSON.parse(panel.dataset.uatAdmin);
  const C = window.UATCore;
  const V = window.UATView;
  const E = window.UATExport;
  const {html} = window.UATContent;
  const number = new Intl.NumberFormat('fr-FR', {maximumFractionDigits: 2});
  const fmt = value => value == null ? '—' : number.format(value);
  const periods = {day: 'Jour', week: 'Semaine ISO', month: 'Mois', year: 'Année'};
  const tables = {
    profiles: 'Profils Untappd', breweries: 'Brasseries', beers: 'Bières', styles: 'Styles',
    countries: 'Pays des lieux', breweryCountries: 'Pays des brasseries', venues: 'Lieux', servings: 'Services',
    periods: 'Activité par période', checkins: 'Historique des check-ins', badges: 'Badges', commenters: 'Auteurs de commentaires'
  };
  const records = new Map();
  const local = new Map();
  let fileId = 0;
  let stats, profiles, tableRows = [], tableHeaders = [], page = 0;
  const pageSize = 50;
  let timezone = config.timezone;
  try { C.zoned(new Date().toISOString(), timezone); } catch (_) { timezone = 'UTC'; }

  panel.innerHTML = `<p role="status" data-message>Chargement des imports…</p>
    <div class="uat-admin-actions">
      <button type="button" data-refresh>Actualiser les imports</button>
      <button type="button" data-export disabled>Télécharger les statistiques Excel</button>
    </div>
    <details class="uat-admin-file">
      <summary>Ajouter un export CSV ou JSON à cette analyse</summary>
      <p>Le fichier est analysé dans cet onglet. Les lignes sans identifiant sont conservées séparément.</p>
      <label>Pseudo Untappd (facultatif) <input name="file-profile"></label>
      <label>Fichier Untappd <input type="file" accept=".csv,.json"></label>
    </details>
    <div class="uat-filters">
      <label class="uat-field">Profil <select name="profile"></select></label>
      <label class="uat-field">Style <select name="style"></select></label>
      <label class="uat-field">Depuis <input name="from" type="date"></label>
      <label class="uat-field">Jusqu’au <input name="to" type="date"></label>
      <label class="uat-field">Période <select name="grain">${Object.entries(periods).map(([k, v]) => `<option value="${k}"${k === 'month' ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
    </div>
    <div data-stats></div>
    <details class="uat-admin-pyramids" data-pyramids hidden>
      <summary>Pyramides de canettes par année</summary>
      <p>Une canette représente un check-in de la sélection. Sa couleur indique le style de bière.</p>
      <div data-pyramid-scene></div>
    </details>
    <div data-charts></div>
    <div class="uat-admin-actions">
      <label>Tableau <select name="table">${Object.entries(tables).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <label>Rechercher <input name="search" type="search"></label>
    </div>
    <div class="uat-admin-table" data-table></div>
    <div class="uat-admin-actions">
      <button type="button" class="uat-secondary" data-prev>Précédent</button>
      <span data-page aria-live="polite"></span>
      <button type="button" class="uat-secondary" data-next>Suivant</button>
    </div>`;
  const $ = selector => panel.querySelector(selector);
  const field = name => $(`[name="${name}"]`);
  const message = text => { $('[data-message]').textContent = text; };
  const pyramids = $('[data-pyramids]');
  let pyramidStats;

  // A richer copy wins when the same check-in appears in multiple sessions.
  function quality(row) {
    return [row.rating, row.photos, row.commentsCount, row.toasts, row.badgesCount, row.abv, row.ibu].filter(value => value != null).length
      + [row.breweryId, row.country, row.breweryCountry, row.venue, row.serving, row.shout, row.style !== 'Style inconnu'].filter(Boolean).length
      + Number(row.commentsComplete) + Number(row.badgesComplete);
  }

  function add(target, row, profile, source) {
    const before = target.get(row.id);
    const best = before && quality(before) > quality(row) ? before : row;
    target.set(row.id, {...best, profile: before?.profile || profile || '', archived: source === 'archive' || !!before?.archived});
  }

  async function refresh() {
    const button = $('[data-refresh]');
    button.disabled = true;
    const pending = new Map();
    try {
      for (const source of ['archive', 'active']) {
        let cursor = {};
        do {
          const url = new URL(config.endpoint);
          for (const [key, value] of Object.entries({source, ...cursor})) url.searchParams.set(key, value);
          const result = await window.UATTransport.readResponse(await fetch(url, {headers: {'X-WP-Nonce': config.nonce}, cache: 'no-store'}));
          for (const {item, profile} of result.records) {
            const row = C.normalize(item);
            if (row && !row.synthetic) add(pending, row, profile, source);
          }
          cursor = result.next;
          message(`Chargement · ${fmt(pending.size)} check-ins uniques…`);
        } while (cursor);
      }
      records.clear();
      for (const [key, row] of pending) records.set(key, row);
      update();
      message(records.size ? `${fmt(records.size)} check-ins uniques disponibles sur le serveur.` : 'Aucun import de profil disponible sur le serveur.');
    } catch (error) { message(error.message); }
    finally { button.disabled = false; }
  }

  function options(select, values, all) {
    const previous = select.value;
    select.replaceChildren(new Option(all, ''), ...values.map(value => new Option(value, value)));
    if (values.includes(previous)) select.value = previous;
  }

  function update() {
    const combined = new Map(records);
    for (const row of local.values()) add(combined, row, row.profile, 'file');
    const items = [...combined.values()];
    const names = new Map();
    for (const row of items) if (row.profile) names.set(row.profile.toLowerCase(), row.profile);
    options(field('profile'), [...names.values()].sort((a, b) => a.localeCompare(b)), 'Tous les profils');
    options(field('style'), [...new Set(items.map(row => row.style))].sort((a, b) => a.localeCompare(b)), 'Tous les styles');
    const profile = field('profile').value.toLowerCase();
    const from = field('from').value;
    const to = field('to').value;
    const grain = field('grain').value;
    if (from && to && from > to) {
      message('La date de début doit précéder la date de fin.');
      $('[data-export]').disabled = true;
      return;
    }
    stats = C.analyze(items.filter(row => !profile || row.profile.toLowerCase() === profile), {
      timezone, from, to, style: field('style').value
    });
    profiles = C.groupRows(stats.rows, row => row.profile.toLowerCase()).map(row => ({...row, label: names.get(row.key)}))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    $('[data-export]').disabled = !stats.total;
    const metrics = [
      ['Profils identifiés', profiles.length], ['Check-ins', stats.total], ['Check-ins notés', stats.rated],
      ['Moyenne sur 5', stats.average], ['Bières différentes', stats.uniqueBeers], ['Brasseries identifiées', stats.uniqueBreweries],
      ['Styles', stats.styles.length], ['Pays des lieux', stats.countries.length], ['Pays des brasseries', stats.breweryCountries.length],
      ['Jours actifs', stats.activeDays], ['Avec photo', stats.withPhotos], ['Sans photo', stats.withoutPhotos], ['Photos non renseignées', stats.photoUnknown],
      ['Médiane des notes', stats.median], ['Note minimale', stats.min], ['Note maximale', stats.max], ['Commentaires connus', stats.comments],
      ['Auteurs identifiés', stats.distinctCommenters], ['Toasts connus', stats.toasts], ['Badges distincts', stats.badges.length],
      ['Check-ins conservés', stats.rows.filter(row => row.archived).length]
    ];
    $('[data-stats]').innerHTML = `<div class="uat-mini-grid">${metrics.map(([label, value]) => `<div class="uat-mini"><strong>${fmt(value)}</strong><span>${label}</span></div>`).join('')}</div>`;
    renderCharts(grain);
    selectTable();
  }

  function renderPyramids() {
    if (!pyramids.open || !stats?.total || pyramidStats === stats) return;
    $('[data-pyramid-scene]').innerHTML = `<div class="uat-pyramids">${V.pyramidCards(stats)}</div>
      <div class="uat-legend uat-style-legend">${V.styleLegend(stats)}</div>`;
    pyramidStats = stats;
  }

  function renderCharts(grain) {
    pyramids.hidden = !stats.total;
    $('[data-pyramid-scene]').replaceChildren();
    pyramidStats = null;
    const charts = $('[data-charts]');
    if (!stats.total) {
      charts.innerHTML = '<p class="uat-empty">Aucun check-in dans la sélection.</p>';
      return;
    }
    renderPyramids();
    const paints = V.stylePalette(stats);
    const card = (title, body) => `<article class="uat-card"><h3>${title}</h3>${body}</article>`;
    const chart = (title, svg) => card(title, `<div class="uat-chart">${svg}</div>`);
    const section = (title, body) => `<section class="uat-admin-chart-section"><div class="uat-section-head"><h3>${title}</h3></div>${body}</section>`;
    const ranking = (title, rows, color) => card(title, V.ranking(rows, 8, color));
    const rhythm = [
      chart('Jours et heures des check-ins', V.heat(stats)),
      chart('Évolution des styles', V.styleTimeline(stats, grain)),
      chart('Répartition des notes', V.ratings(stats)),
      chart('Activité par période', V.timeline(stats, grain)),
      chart('Moyenne des notes dans le temps', V.timeline(stats, grain, true)),
      ranking('Lieux les plus fréquentés', stats.venues, 'var(--uat-series-2)')
    ];
    const favorites = [
      ranking('Styles les plus évalués', stats.styles, row => paints.get(row.key)),
      ranking('Brasseries les plus évaluées', stats.breweries, 'var(--uat-series-2)'),
      ranking('Bières les plus évaluées', stats.beers, 'var(--uat-series-3)'),
      ranking('Profils les plus actifs', profiles, 'var(--uat-accent)'),
      ranking('Pays des lieux', stats.countries, 'var(--uat-series-5)'),
      ranking('Pays des brasseries', stats.breweryCountries, 'var(--uat-series-6)'),
      ranking('Modes de service', stats.servings, 'var(--uat-series-4)'),
      ranking('Auteurs de commentaires', stats.commenters, 'var(--uat-accent)'),
      ranking('Badges les plus obtenus', stats.badges, 'var(--uat-series-2)')
    ];
    charts.innerHTML = section('Rythme des check-ins', `<div class="uat-card-grid">${rhythm.join('')}</div>`)
      + section('Classements', `<div class="uat-card-grid">${favorites.join('')}</div>`)
      + section('Style le plus évalué par année', `<div class="uat-year-grid">${V.yearlyStyleCards(stats, paints, count => `${fmt(count)} check-ins`)}</div>`);
  }

  function selectTable() {
    if (!stats) return;
    const table = field('table').value;
    if (table === 'checkins') {
      tableHeaders = ['Date locale', 'Profil', 'Bière', 'Brasserie', 'Style', 'Note', 'Lieu', 'Pays du lieu', 'Pays brasserie', 'Photos', 'Commentaires', 'Toasts', 'Texte du check-in'];
      tableRows = stats.rows.slice().reverse().map(row => [row.local.day, row.profile, row.beer, row.brewery, row.style, row.rating, row.venue, row.country, row.breweryCountry, row.photos, row.commentsCount, row.toasts, row.shout]);
    } else if (table === 'badges') {
      tableHeaders = ['Badge', 'Niveau maximal', 'Obtentions connues'];
      tableRows = stats.badges.map(row => [row.label, row.level, row.count]);
    } else if (table === 'commenters') {
      tableHeaders = ['Auteur', 'Commentaires observés'];
      tableRows = stats.commenters.map(row => [row.label, row.count]);
    } else {
      const rows = table === 'profiles' ? profiles : table === 'periods' ? stats.periods(field('grain').value) : stats[table];
      tableHeaders = [table === 'periods' ? 'Période' : 'Nom', 'Check-ins', 'Notés', 'Moyenne sur 5', 'Bières différentes', 'Avec photo', 'Commentaires connus'];
      tableRows = rows.map(row => [row.label, row.count, row.rated, row.average, row.beers, row.photos, row.comments]);
    }
    page = 0;
    drawTable();
  }

  function drawTable() {
    const query = field('search').value.trim().toLowerCase();
    const matches = query ? tableRows.filter(row => row.some(value => String(value ?? '').toLowerCase().includes(query))) : tableRows;
    const count = Math.max(1, Math.ceil(matches.length / pageSize));
    page = Math.min(page, count - 1);
    $('[data-table]').innerHTML = `<table class="widefat striped"><thead><tr>${tableHeaders.map(value => `<th scope="col">${value}</th>`).join('')}</tr></thead>
      <tbody>${matches.slice(page * pageSize, (page + 1) * pageSize).map(row => `<tr>${row.map(value => `<td>${typeof value === 'number' ? fmt(value) : html(value || '—')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    $('[data-page]').textContent = `${fmt(matches.length)} lignes · ${page + 1} / ${count}`;
    $('[data-prev]').disabled = page === 0;
    $('[data-next]').disabled = page + 1 >= count;
  }

  $('.uat-filters').addEventListener('change', update);
  pyramids.addEventListener('toggle', renderPyramids);
  field('table').addEventListener('change', selectTable);
  field('search').addEventListener('input', () => { page = 0; drawTable(); });
  $('[data-prev]').addEventListener('click', () => { if (page > 0) page--; drawTable(); });
  $('[data-next]').addEventListener('click', () => { page++; drawTable(); });
  $('[data-refresh]').addEventListener('click', refresh);
  $('[data-export]').addEventListener('click', () => {
    try {
      E.download(E.xlsx(stats, {
        profile: field('profile').value || 'Tous les profils', source: 'Administration Untappd Atlas', profiles,
        from: field('from').value, to: field('to').value, style: field('style').value
      }), 'untappd-atlas-statistiques.xlsx');
    } catch (error) { message(error.message); }
  });
  $('input[type=file]').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { message('Le fichier dépasse 50 Mo.'); return; }
    const profile = field('file-profile').value.trim();
    const batch = ++fileId;
    try {
      const result = C.parse(await file.text(), file.name);
      for (const row of result.items) add(local, row.synthetic ? {...row, id: `file:${batch}:${row.id}`} : row, profile, 'file');
      update();
      message(`${fmt(result.items.length)} check-ins lus dans le fichier. ${fmt(result.invalid)} lignes ignorées.`);
    } catch (error) { message(error.message); }
    finally { event.target.value = ''; }
  });
  update();
  refresh();
})();
