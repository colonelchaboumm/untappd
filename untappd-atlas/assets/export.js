/* Native OpenXML XLSX export. Text cells use inlineStr, never formulas. */
(function (root) {
  'use strict';
  const xml = s => String(s ?? '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'}[c]));
  const encoder = new TextEncoder();
  const crcTable = Array.from({length: 256}, (_, n) => { for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
  const crc = bytes => { let n = 0xffffffff; for (const b of bytes) n = crcTable[(n ^ b) & 255] ^ (n >>> 8); return (n ^ 0xffffffff) >>> 0; };
  function zip(files) {
    const chunks = [], directory = []; let offset = 0, directorySize = 0;
    for (const [path, value] of files) {
      const name = encoder.encode(path), data = encoder.encode(value), sum = crc(data);
      const local = new Uint8Array(30 + name.length), v = new DataView(local.buffer);
      v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x800, true); v.setUint16(12, 0x21, true);
      v.setUint32(14, sum, true); v.setUint32(18, data.length, true); v.setUint32(22, data.length, true); v.setUint16(26, name.length, true); local.set(name, 30);
      const central = new Uint8Array(46 + name.length), c = new DataView(central.buffer);
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x800, true); c.setUint16(14, 0x21, true);
      c.setUint32(16, sum, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true); central.set(name, 46);
      chunks.push(local, data); directory.push(central); offset += local.length + data.length; directorySize += central.length;
    }
    const end = new Uint8Array(22), e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, directorySize, true); e.setUint32(16, offset, true);
    return new Blob([...chunks, ...directory, end], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  function column(i) { let s = ''; for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; }
  function worksheet(rows) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols><col min="1" max="30" width="24" customWidth="1"/></cols><sheetData>' + rows.map((row, ri) => `<row r="${ri + 1}">` + row.map((value, ci) => {
      const ref = column(ci) + (ri + 1), style = ri === 0 ? ' s="1"' : '';
      if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${style}><v>${value}</v></c>`;
      if (value == null) return `<c r="${ref}"${style}/>`;
      return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xml(String(value).slice(0, 32767))}</t></is></c>`;
    }).join('') + '</row>').join('') + `</sheetData><autoFilter ref="A1:${column(Math.max(0, (rows[0]?.length || 1) - 1))}${Math.max(1, rows.length)}"/></worksheet>`;
  }
  function sheetsFor(s, meta = {}) {
    const sheets = [];
    const add = (name, rows) => sheets.push({name, rows});
    add('Synthèse', [['Indicateur', 'Valeur'], ['Profil', meta.profile || 'Import de fichier'], ['Source', meta.demo ? 'DÉMONSTRATION FICTIVE' : meta.source || 'Untappd'], ['État de l’import', meta.status || 'Fichier fourni'], ['Fuseau horaire', s.timezone], ['Début du filtre', meta.from || 'Toute la période'], ['Fin du filtre', meta.to || 'Toute la période'], ['Style filtré', meta.style || 'Tous'], ['Check-ins', s.total], ['Check-ins notés', s.rated], ['Non notés', s.unrated], ['Bières uniques', s.uniqueBeers], ['Bières uniques avec note', s.ratedUniqueBeers], ['Brasseries uniques avec note', s.ratedUniqueBreweries], ['Brasseries uniques identifiées', s.uniqueBreweries], ['Styles', s.styles.length], ['Note moyenne', s.average], ['Médiane', s.median], ['Note minimale', s.min], ['Note maximale', s.max], ['Avec photo', s.withPhotos], ['Sans photo (champ connu)', s.withoutPhotos], ['Photo non renseignée', s.photoUnknown], ['Nombre de photos', s.photos], ['Textes de vos check-ins', s.withShout], ['Commentaires connus sur les check-ins', s.comments], ['Check-ins sans données commentaires', s.commentsUnknown], ['Auteurs distincts observés', s.distinctCommenters], ['Liste complète des auteurs', s.commentersComplete ? 'Oui' : 'Non — minimum observé'], ['Toasts connus', s.toasts], ['Check-ins sans données toasts', s.toastsUnknown], ['Jours actifs', s.activeDays], ['Jours calendaires (bornes de données)', s.calendarDays], ['Check-ins / jour calendaire', s.perCalendarDay], ['Check-ins / jour actif', s.perActiveDay], ['Série de jours actifs', s.streak.count], ['Série : début', s.streak.from], ['Série : fin', s.streak.to], ['Plus grand intervalle sans check-in', s.longestGap.days], ['Degré alcoolique moyen (%)', s.averageABV], ['IBU moyen (0 inclus)', s.averageIBU], ['Déduplication', 'ID de check-in ; sans ID chaque ligne est conservée'], ['Dates sans fuseau', 'Interprétées en UTC'], ['Identités sans ID', 'Bières et brasseries regroupées par nom ; homonymes possibles'], ['Histogramme', 'Notes regroupées au quart de point le plus proche'], ['Commentaires', 'Totaux et identités peuvent être partiels selon la source']]);
    sheets[0].rows.push(['Badges annoncés par le profil (hors filtres)', meta.profileBadgesTotal ?? null], ['Badges distincts observés', s.badgesUnknown === s.total && s.total ? null : s.badges.length], ['Obtentions de badges connues', s.badgesUnknown === s.total && s.total ? null : s.badgeAwards], ['Check-ins sans information badges', s.badgesUnknown], ['Liste complète des badges dans les données', s.badgesComplete ? 'Oui' : 'Non — minimum observé']);
    add('Badges', [['Identifiant', 'Badge', 'Niveau maximal observé', 'Obtentions observées', 'Première date observée', 'Dernière date observée'], ...s.badges.map(b => [b.key, b.label, b.level, b.count, b.first, b.last])]);
    add('Badges obtenus', [['Check-in', 'Identifiant badge', 'Badge', 'Niveau', 'Date badge ou check-in', 'Date check-in', 'Image'], ...s.badgeEvents.map(b => [b.checkin, b.id, b.name, b.level, b.date, b.checkinDate, b.image])]);
    const periodHeaders = ['Période', 'Check-ins', 'Bières uniques', 'Notés', 'Moyenne', 'Avec photo', 'Données photo connues', 'Commentaires connus', 'Données commentaires connues'];
    const periodRow = r => [r.key, r.count, r.beers, r.rated, r.average, r.photos, r.photosKnown, r.comments, r.commentsKnown];
    for (const [grain, label] of [['day', 'Jour'], ['week', 'Semaine'], ['month', 'Mois'], ['year', 'Année']]) {
      add(label, [periodHeaders, ...s.periods(grain).map(periodRow)]);
      const badgePeriods = new Map();
      for (const r of s.rows) {
        const key = r.local[grain], p = badgePeriods.get(key) || {count: 0, unknown: 0};
        if (r.badgesCount == null) p.unknown++; else p.count += r.badgesCount;
        badgePeriods.set(key, p);
      }
      add(`Badges par ${label.toLowerCase()}`, [['Période du check-in', 'Obtentions connues', 'Check-ins sans information badges'], ...s.periods(grain).map(p => [p.key, badgePeriods.get(p.key)?.count || 0, badgePeriods.get(p.key)?.unknown || 0])]);
      add(`Styles par ${label.toLowerCase()}`, [['Période', 'Style', ...periodHeaders.slice(1)], ...s.stylePeriods(grain).map(r => [...r.key.split('\t'), ...periodRow(r).slice(1)])]);
    }
    for (const [name, rows] of [['Styles', s.styles], ['Brasseries', s.breweries], ['Bières', s.beers], ['Lieux', s.venues], ['Pays des lieux', s.countries], ['Pays des brasseries', s.breweryCountries], ['Services', s.servings]]) add(name, [['Nom', 'Check-ins', 'Bières uniques', 'Notés', 'Moyenne', 'Avec photo', 'Photos connues', 'Commentaires connus'], ...rows.map(r => [r.label, r.count, r.beers, r.rated, r.average, r.photos, r.photosKnown, r.comments])]);
    add('Notes', [['Note (quart le plus proche)', 'Nombre'], ...s.distribution.map(r => [r.rating, r.count])]);
    add('Heures de la semaine', [['Jour', ...Array.from({length: 24}, (_, i) => `${i} h`)], ...s.heat.map((r, i) => [['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'][i], ...r])]);
    add('Auteurs observés', [['Identifiant', 'Pseudo', 'Commentaires observés'], ...s.commenters.map(c => [c.key, c.label, c.count])]);
    add('Commentaires observés', [['Check-in', 'Auteur ID', 'Pseudo', 'Texte', 'Date source'], ...s.rows.flatMap(r => r.commenters.map(c => [r.id, c.id, c.name, c.text, c.date]))]);
    add('Check-ins', [['ID', 'Date UTC', 'Date locale', 'Heure locale', 'Semaine ISO', 'Bière ID', 'Bière', 'Brasserie ID', 'Brasserie', 'Style', 'Note', 'ABV (%)', 'IBU', 'Photos', 'Texte personnel', 'Commentaires connus', 'Auteurs complets', 'Toasts', 'Lieu', 'Ville', 'Pays du lieu', 'Pays brasserie', 'Service'], ...s.rows.map(r => [r.synthetic ? '' : r.id, r.date, r.local.day, `${String(r.local.hour).padStart(2, '0')}:${String(r.local.minute).padStart(2, '0')}`, r.local.week, r.beerId, r.beer, r.breweryId, r.brewery, r.style, r.rating, r.abv, r.ibu, r.photos, r.shout, r.commentsCount, r.commentsComplete ? 'Oui' : 'Non', r.toasts, r.venue, r.city, r.country, r.breweryCountry, r.serving])]);
    if (meta.profiles) {
      add('Profils Untappd', [['Profil', 'Check-ins', 'Notés', 'Moyenne', 'Bières différentes', 'Avec photo', 'Commentaires connus'],
        ...meta.profiles.map(row => [row.label, row.count, row.rated, row.average, row.beers, row.photos, row.comments])]);
      const checkins = sheets.find(sheet => sheet.name === 'Check-ins').rows;
      checkins[0].push('Profil Untappd', 'Copie conservée');
      s.rows.forEach((row, index) => checkins[index + 1].push(row.profile || '', row.archived ? 'Oui' : 'Non'));
    }
    return sheets;
  }
  function xlsx(s, meta) {
    const sheets = sheetsFor(s, meta), files = [];
    const ns = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    files.push(['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`]);
    files.push(['_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument" Target="xl/workbook.xml"/></Relationships>`]);
    files.push(['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${ns}"><bookViews><workbookView/></bookViews><sheets>${sheets.map((s, i) => `<sheet name="${xml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`]);
    files.push(['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="${ns}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="${ns}/styles" Target="styles.xml"/></Relationships>`]);
    files.push(['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>']);
    sheets.forEach((s, i) => files.push([`xl/worksheets/sheet${i + 1}.xml`, worksheet(s.rows)]));
    return zip(files);
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function png(svg, width = 1800) {
    const image = new Image(), url = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml;charset=utf-8'}));
    try {
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('Impossible de générer l’image dans ce navigateur.')); image.src = url; });
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = Math.round(image.height * width / image.width);
      const context = canvas.getContext('2d'); if (!context) throw new Error('Export PNG indisponible.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Image trop grande pour ce navigateur.')), 'image/png'));
    } finally { URL.revokeObjectURL(url); }
  }
  const api = {xlsx, sheetsFor, download, png, xml};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.UATExport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
