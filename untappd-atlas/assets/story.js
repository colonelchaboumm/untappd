(function () {
  'use strict';

  const C = window.UATCore;
  const {html, value} = window.UATContent;
  const number = new Intl.NumberFormat('fr-FR');
  const decimal = new Intl.NumberFormat('fr-FR', {maximumFractionDigits: 2});
  const monthName = new Intl.DateTimeFormat('fr-FR', {month: 'long', timeZone: 'UTC'});
  const dateName = new Intl.DateTimeFormat('fr-FR', {dateStyle: 'medium', timeZone: 'UTC'});

  function months(s, year) {
    const totals = new Map(s.periods('month').map(month => [month.key, month.count]));
    const counts = Array.from({length: 12}, (_, i) => totals.get(year + '-' + String(i + 1).padStart(2, '0')) || 0);
    const max = Math.max(1, ...counts);
    return '<ol class="uat-story-months" role="list">' + counts.map((count, i) => {
      const month = monthName.format(new Date(Date.UTC(2000, i)));
      const label = month + ' · ' + number.format(count);
      return `<li title="${label}" aria-label="${label}"><b aria-hidden="true">${count || ''}</b><i aria-hidden="true" style="--uat-story-height:${count * 100 / max}%"></i><span aria-hidden="true">${month.slice(0, 1).toUpperCase()}</span></li>`;
    }).join('') + '</ol>';
  }

  function ranking(rows) {
    return '<ol class="uat-story-ranking" role="list">' + rows.slice(0, 3).map((row, i) =>
      `<li><span aria-hidden="true">0${i + 1}</span><strong>${html(row.label)}</strong><b>${number.format(row.count)}</b></li>`
    ).join('') + '</ol>';
  }

  function slides(s, year, texts) {
    const t = (key, vars = {}) => value(texts, 'story_' + key, '', {year, ...vars});
    const metric = (n, label) => `<div><strong>${number.format(n)}</strong><span>${html(label)}</span></div>`;
    const stat = (tone, art, vars) => ({
      tone, title: t(tone + '_title', vars), description: t(tone + '_description', vars), art
    });
    const styles = s.styles.filter(row => row.key !== 'Style inconnu');
    const breweries = s.breweries.filter(row => row.key);
    const best = s.max == null ? null : s.rows.find(row => row.rating === s.max);
    const spotlight = s.biggestDay;
    const summary = [
      metric(s.uniqueBeers, t('beers')),
      metric(s.uniqueBreweries, t('breweries')),
      metric(s.activeDays, t('days'))
    ];
    if (s.withPhotos) summary.push(metric(s.withPhotos, t('photos')));
    if (s.badges.length) summary.push(metric(s.badges.length, t('badges')));
    return [
      stat('cover', `<div class="uat-story-year" aria-hidden="true">${year}</div>`),
      stat('tempo', months(s, year), {
        count: number.format(s.total), day: dateName.format(new Date(spotlight.key + 'T12:00:00Z')),
        peak: number.format(spotlight.count)
      }),
      ...(styles.length ? [stat('styles', ranking(styles), {style: styles[0].label})] : []),
      ...(breweries.length ? [stat('breweries', ranking(breweries), {brewery: breweries[0].label})] : []),
      ...(best ? [stat('rating', `<div class="uat-story-score">${decimal.format(s.max)}<small> / 5</small></div>`, {
        beer: best.beer, average: decimal.format(s.average), rated: number.format(s.rated)
      })] : []),
      {
        ...stat('final', `<div class="uat-story-metrics">${summary.join('')}</div>`),
        note: t('coverage')
      }
    ];
  }

  function mount(button, read, texts) {
    const dialog = document.createElement('dialog');
    dialog.className = 'uat-story';
    dialog.setAttribute('aria-label', 'Récapitulatif annuel');
    dialog.innerHTML = `<div class="uat-story-frame">
      <header class="uat-story-header">
        <div><span class="uat-story-brand">UNTAPPD / ATLAS</span><label><span>Année</span><select></select></label><span class="uat-story-demo" hidden></span></div>
        <button type="button" data-story="close" aria-label="Fermer le récapitulatif" autofocus>×</button>
      </header>
      <div class="uat-story-track" aria-hidden="true"></div>
      <div class="uat-story-stage"></div>
      <footer class="uat-story-nav">
        <button type="button" data-story="previous">← <span>Précédent</span></button>
        <span class="uat-story-position" aria-hidden="true"></span>
        <button type="button" data-story="next"><span>Suivant</span> →</button>
      </footer>
      <span class="uat-story-announcement" aria-live="polite" aria-atomic="true"></span>
    </div>`;
    button.closest('.uat-app').append(dialog);
    const select = dialog.querySelector('select');
    const stage = dialog.querySelector('.uat-story-stage');
    const track = dialog.querySelector('.uat-story-track');
    const position = dialog.querySelector('.uat-story-position');
    const demo = dialog.querySelector('.uat-story-demo');
    const announcement = dialog.querySelector('.uat-story-announcement');
    const previous = dialog.querySelector('[data-story="previous"]');
    const next = dialog.querySelector('[data-story="next"]');
    let data, cards, index;

    function show(target) {
      index = Math.max(0, Math.min(target, cards.length - 1));
      const card = cards[index];
      const last = index === cards.length - 1;
      dialog.dataset.tone = card.tone;
      track.innerHTML = cards.map((_, i) => `<i class="${i <= index ? 'uat-story-seen' : ''}"></i>`).join('');
      stage.innerHTML = `<article class="uat-story-slide">
        <div class="uat-story-copy">
          ${card.title ? `<h2>${html(card.title)}</h2>` : ''}
          ${card.description ? `<p>${html(card.description)}</p>` : ''}
        </div>
        <div class="uat-story-art">${card.art}</div>
        ${card.note ? `<p class="uat-story-note">${html(card.note)}</p>` : ''}
      </article>`;
      stage.scrollTop = 0;
      previous.disabled = index === 0;
      next.innerHTML = last ? '<span>Terminer</span> ✓' : '<span>Suivant</span> →';
      position.textContent = `${index + 1} / ${cards.length}`;
      announcement.textContent = [position.textContent, card.title, card.description].filter(Boolean).join(' · ');
      if (previous.disabled && document.activeElement === previous) next.focus();
    }

    function loadYear() {
      const year = select.value;
      const s = C.analyze(data.items, {timezone: data.timezone, from: year + '-01-01', to: year + '-12-31'});
      cards = slides(s, year, texts);
      show(0);
    }

    button.addEventListener('click', () => {
      if (dialog.open) return;
      data = read();
      const years = [...new Set(data.items.map(row => C.zoned(row.date, data.timezone).year))].sort().reverse();
      if (!years.length) return;
      const current = C.zoned(new Date().toISOString(), data.timezone).year;
      const prior = String(Number(current) - 1);
      select.innerHTML = years.map(year => `<option>${year}</option>`).join('');
      select.value = years.includes(prior) ? prior : years[0];
      demo.textContent = data.demo ? value(texts, 'story_demo') : '';
      demo.hidden = !demo.textContent;
      loadYear();
      dialog.showModal();
    });
    select.addEventListener('change', () => { if (dialog.open) loadYear(); });
    dialog.addEventListener('close', () => {
      if (dialog.open) return;
      data = cards = null;
      stage.replaceChildren();
      announcement.textContent = '';
    });
    dialog.querySelector('[data-story="close"]').addEventListener('click', () => dialog.close());
    previous.addEventListener('click', () => show(index - 1));
    next.addEventListener('click', () => index === cards.length - 1 ? dialog.close() : show(index + 1));
    dialog.addEventListener('keydown', event => {
      if (event.target === select || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      show(index + (event.key === 'ArrowLeft' ? -1 : 1));
    });
    return dialog;
  }

  window.UATStory = {mount};
})();
