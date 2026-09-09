/**
 * État et rendu de l'interface Kairn Desk. Pas de framework : le DOM est
 * reconstruit à chaque changement d'état, ce qui reste largement assez
 * rapide pour le volume d'une base de sessions personnelle.
 */
(function () {
  const SPORT_SHORT = { course: 'Course', velo: 'VTT', randonnee: 'Rando', trail: 'Trail', marche: 'Marche' };
  const WEEKDAYS = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
  const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const GRANULARITIES = ['auto', '100', '200', '500', '1000'];
  const GRAN_LABEL = { auto: 'Auto', '100': '100 m', '200': '200 m', '500': '500 m', '1000': '1 km' };

  const state = {
    rawWeeks: [],
    filters: { q: '', sport: '', weeks: 8 },
    selectedId: null,
    granularity: 'auto',
  };

  const el = {
    listPane: document.getElementById('list-pane'),
    detailPane: document.getElementById('detail-pane'),
    search: document.getElementById('search'),
    sportFilter: document.getElementById('sport-filter'),
    periodFilter: document.getElementById('period-filter'),
    folderPath: document.getElementById('folder-path'),
    folderMeta: document.getElementById('folder-meta'),
    appVersion: document.getElementById('app-version'),
    btnChangeFolder: document.getElementById('btn-change-folder'),
    btnBackup: document.getElementById('btn-backup'),
    btnCompare: document.getElementById('btn-compare'),
    modalRoot: document.getElementById('modal-root'),
    toastRoot: document.getElementById('toast-root'),
  };

  // — formatage —  (une petite copie côté navigateur des règles de @kairn/core ;
  // ce fichier statique n'est pas passé par un bundler, donc pas d'import direct du paquet)
  function fmtKm(meters) {
    return (meters / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtPace(secPerKm) {
    if (!Number.isFinite(secPerKm) || secPerKm <= 0) return '—';
    const total = Math.round(secPerKm);
    return `${Math.floor(total / 60)}'${String(total % 60).padStart(2, '0')}"`;
  }
  function fmtDate(ms) {
    if (!ms) return '';
    const d = new Date(ms);
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} · ${hh}:${mm}`;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function toast(message) {
    const node = document.createElement('div');
    node.className = 'toast';
    node.textContent = message;
    el.toastRoot.innerHTML = '';
    el.toastRoot.appendChild(node);
    setTimeout(() => node.remove(), 3200);
  }

  function openModal({ title, body, confirmLabel, onConfirm }) {
    el.modalRoot.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal">
          <h3>${escapeHtml(title)}</h3>
          <p>${body}</p>
          <div class="actions">
            <button class="btn btn-secondary" data-action="cancel">Annuler</button>
            <button class="btn btn-primary" data-action="confirm">${escapeHtml(confirmLabel)}</button>
          </div>
        </div>
      </div>`;
    const close = () => { el.modalRoot.innerHTML = ''; };
    el.modalRoot.querySelector('[data-action="cancel"]').onclick = close;
    el.modalRoot.querySelector('.modal-backdrop').addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-backdrop')) close();
    });
    el.modalRoot.querySelector('[data-action="confirm"]').onclick = async () => {
      close();
      await onConfirm();
    };
  }

  // — chargement —

  async function loadStatus() {
    try {
      const status = await Api.status();
      el.folderPath.textContent = status.path;
      const mo = (status.totalBytes / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
      el.folderMeta.textContent = `${status.fileCount} fichier${status.fileCount > 1 ? 's' : ''} GPX · ${mo} Mo`;
    } catch (err) {
      el.folderPath.textContent = 'Dossier inaccessible';
      el.folderMeta.textContent = String(err.message || err);
    }
  }

  async function loadWeeks() {
    el.listPane.innerHTML = '<div class="detail-empty">Chargement…</div>';
    try {
      state.rawWeeks = await Api.weeks(state.filters.weeks);
    } catch (err) {
      state.rawWeeks = [];
      toast(`Impossible de lire les sessions : ${err.message || err}`);
    }
    renderList();
  }

  function matchesFilters(session) {
    const { q, sport } = state.filters;
    if (sport && session.sport !== sport) return false;
    if (q && !session.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }

  function traceSvg(points, { width, height }) {
    const { path, start, end } = Charts.projectTrace(points, { width, height, padding: Math.min(18, width / 6) });
    if (!path) return '';
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <path d="${path}" stroke="var(--color-accent)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      ${start ? `<circle cx="${start[0]}" cy="${start[1]}" r="3" fill="var(--color-accent-300)"/>` : ''}
      ${end ? `<circle cx="${end[0]}" cy="${end[1]}" r="3" fill="none" stroke="var(--color-accent-300)" stroke-width="1.5"/>` : ''}
    </svg>`;
  }

  function renderList() {
    const parts = [];
    for (const week of state.rawWeeks) {
      const sessions = week.sessions.filter(matchesFilters);
      const filtering = state.filters.q || state.filters.sport;
      if (filtering && sessions.length === 0) continue;

      parts.push(`<div class="week-header">
        <div class="kicker">${escapeHtml(week.label)} · ${escapeHtml(week.dateRangeLabel)} · ${fmtKm(week.distanceMeters)} km</div>
      </div>`);

      if (sessions.length === 0) {
        parts.push('<div class="week-empty">Semaine sans enregistrement.</div>');
        continue;
      }

      for (const s of sessions) {
        const selected = s.id === state.selectedId ? ' selected' : '';
        parts.push(`<div class="session-row${selected}" data-id="${escapeHtml(s.id)}">
          <div class="info">
            <div><span class="sport">${escapeHtml(SPORT_SHORT[s.sport] || s.sportLabel)}</span><span class="date">${fmtDate(s.startTime)}</span></div>
            <div class="name">${escapeHtml(s.name)}</div>
            <div class="metrics"><span>${fmtKm(s.distanceMeters)} km</span><span>${s.durationLabel}</span><span>${s.primaryMetric}</span></div>
          </div>
          <div class="thumb">${traceSvg(s.trace, { width: 82, height: 56 })}</div>
        </div>`);
      }
    }
    el.listPane.innerHTML = parts.join('') || '<div class="detail-empty">Aucune session ne correspond à ce filtre.</div>';
    el.listPane.querySelectorAll('.session-row').forEach((row) => {
      row.addEventListener('click', () => selectSession(row.dataset.id));
    });
  }

  // — détail —

  async function selectSession(id) {
    state.selectedId = id;
    renderList();
    el.detailPane.innerHTML = '<div class="detail-empty">Chargement…</div>';
    await loadDetail();
  }

  async function loadDetail() {
    const id = state.selectedId;
    if (!id) return;
    try {
      const [detail, analysis] = await Promise.all([Api.session(id), Api.analysis(id, state.granularity)]);
      if (state.selectedId !== id) return; // une autre sélection a eu lieu entre-temps
      renderDetail(detail, analysis);
    } catch (err) {
      el.detailPane.innerHTML = `<div class="detail-empty">Impossible de charger cette session : ${escapeHtml(err.message || String(err))}</div>`;
    }
  }

  function statTile(kicker, value, unit) {
    return `<div class="stat-tile"><div class="kicker">${escapeHtml(kicker)}</div><div><span class="value">${value}</span>${unit ? `<span class="unit">${escapeHtml(unit)}</span>` : ''}</div></div>`;
  }

  function renderDetail(detail, analysis) {
    const s = detail.summary;
    const primary = detail.sport === 'velo' || detail.sport === 'randonnee'
      ? statTile('Vitesse moy.', s.avgSpeedKmh.toFixed(1), 'km/h')
      : statTile('Allure moy.', fmtPace(s.avgPaceSecPerKm), '/km');

    const alt = Charts.areaPath(
      detail.trace.filter((p) => p.ele !== undefined).map((p) => p.ele),
      { width: 320, height: 88, padding: 4 }
    );

    const bestPace = analysis.segments.reduce((m, seg) => (!seg.isPartial && seg.paceSecPerKm < m ? seg.paceSecPerKm : m), Infinity);
    // L'espacement entre barres doit céder la place quand il y a beaucoup de segments
    // (pas fin sur une longue trace) : à espacement fixe, les intervalles finissent
    // par manger toute la largeur du panneau et le graphique disparaît.
    const barsGap = analysis.segments.length > 120 ? 0 : analysis.segments.length > 50 ? 1 : 3;
    // reduce plutôt que Math.max(...tableau) : robuste même avec des milliers de segments (pas fin sur une trace très longue).
    const maxSpeed = analysis.segments.reduce((m, x) => Math.max(m, x.speedKmh), 1);
    const bars = analysis.segments
      .map((seg) => {
        const h = Math.max(2, Math.round((seg.speedKmh / maxSpeed) * 88));
        return `<div class="bar${seg.isBest ? ' best' : ''}" style="height:${h}px" title="${fmtPace(seg.paceSecPerKm)}/km"></div>`;
      })
      .join('');

    const totalZoneSeconds = analysis.zones.reduce((a, z) => a + z.durationSeconds, 0) || 1;
    const zones = analysis.zones
      .map((z) => {
        const pct = Math.round((z.durationSeconds / totalZoneSeconds) * 100);
        const mm = Math.floor(z.durationSeconds / 60);
        const ss = String(Math.round(z.durationSeconds % 60)).padStart(2, '0');
        return `<div class="zone-row"><span>${escapeHtml(z.label)}</span><span class="time">${mm}:${ss}</span></div>
          <div class="zone-track"><div class="zone-fill" style="width:${pct}%"></div></div>`;
      })
      .join('');

    const granButtons = GRANULARITIES
      .map((g) => `<button class="btn btn-secondary" data-gran="${g}" style="${g === state.granularity ? 'color:var(--color-accent);border-color:var(--color-accent)' : ''}">${GRAN_LABEL[g]}</button>`)
      .join('');

    el.detailPane.innerHTML = `
      <div class="detail-header">
        <div>
          <div class="title">${escapeHtml(detail.name)}</div>
          <div class="subtitle">${detail.id}.gpx · ${s.pointCount} points · ${s.samplingHz > 0 ? s.samplingHz.toFixed(1) + ' Hz' : '—'}${detail.maskedStartMeters ? ` · départ masqué ${detail.maskedStartMeters} m` : ''}</div>
        </div>
        <div class="detail-actions">
          <button class="btn btn-secondary" id="btn-correct" ${detail.maskedStartMeters ? '' : 'disabled title="Aucun masquage défini pour cette session"'}>Corriger</button>
          <a class="btn btn-secondary" href="${Api.exportUrl(detail.id, 'gpx', 0)}">GPX</a>
          <a class="btn btn-secondary" href="${Api.exportUrl(detail.id, 'geojson', 0)}">GeoJSON</a>
          <a class="btn btn-secondary" href="${Api.exportUrl(detail.id, 'csv', 0)}">CSV</a>
        </div>
      </div>

      <div class="stat-row">
        <div class="trace-panel">
          ${traceSvg(detail.trace, { width: 560, height: 260 })}
          <div class="trace-caption">Trace réelle, projection locale · pas de fond de carte pour l'instant</div>
        </div>
        <div class="stat-tiles">
          ${statTile('Distance', fmtKm(s.distanceMeters), 'km')}
          ${statTile('Durée', detail.durationLabel, 'en mouvement')}
          ${primary}
          ${statTile('D+', Math.round(s.elevGainMeters), 'm')}
        </div>
      </div>

      <div class="two-col">
        <div class="panel">
          <div class="panel-head">
            <span class="kicker">Allure par segment · pas ${escapeHtml(analysis.granularity.label)}${analysis.granularity.auto ? ' (auto)' : ''}</span>
            <div class="panel-head-row">${granButtons}</div>
          </div>
          <div class="bars" style="gap:${barsGap}px">${bars || '<span class="muted">Trace trop courte pour être découpée.</span>'}</div>
          <div class="axis-row"><span>0 km</span><span>${bestPace !== Infinity ? `meilleur segment ${fmtPace(bestPace)}` : ''}</span><span>${fmtKm(s.distanceMeters)} km</span></div>
          <div class="muted" style="font-size:11px;margin-top:8px">${escapeHtml(analysis.granularity.note)}</div>
        </div>
        <div class="panel">
          <div class="kicker" style="margin-bottom:10px">Altitude</div>
          <svg width="100%" height="88" viewBox="0 0 320 88" preserveAspectRatio="none">
            <path d="${alt.area}" fill="var(--color-accent)" opacity=".14"/>
            <path d="${alt.line}" stroke="var(--color-accent)" stroke-width="2" fill="none"/>
          </svg>
          <div class="axis-row"><span>0 km</span><span>+${Math.round(s.elevGainMeters)} m cumulés</span><span>${fmtKm(s.distanceMeters)} km</span></div>
        </div>
      </div>

      <div class="panel">
        <div class="kicker" style="margin-bottom:10px">Répartition de vitesse</div>
        ${zones}
      </div>
    `;

    el.detailPane.querySelectorAll('[data-gran]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        state.granularity = btn.dataset.gran;
        await loadDetail();
      });
    });

    const btnCorrect = el.detailPane.querySelector('#btn-correct');
    if (btnCorrect && !btnCorrect.disabled) {
      btnCorrect.addEventListener('click', () => {
        openModal({
          title: 'Corriger cette session ?',
          body: `Retire définitivement les points à moins de ${detail.maskedStartMeters} m du départ et de l'arrivée, puis réécrit le fichier dans le dossier surveillé — c'est ce qui renvoie la correction vers le téléphone, au prochain passage de la synchronisation.`,
          confirmLabel: 'Corriger et réécrire',
          onConfirm: async () => {
            try {
              await Api.correct(detail.id);
              toast('Session corrigée et réécrite dans le dossier surveillé.');
              await loadWeeks();
              await loadDetail();
            } catch (err) {
              toast(`Échec de la correction : ${err.message || err}`);
            }
          },
        });
      });
    }
  }

  // — événements globaux —

  function wireEvents() {
    let searchTimer = null;
    el.search.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.filters.q = el.search.value.trim();
        renderList();
      }, 150);
    });

    el.sportFilter.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      el.sportFilter.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      state.filters.sport = btn.dataset.sport;
      renderList();
    });

    el.periodFilter.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      el.periodFilter.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      state.filters.weeks = Number(btn.dataset.weeks);
      await loadWeeks();
    });

    el.btnChangeFolder.addEventListener('click', () => {
      const next = prompt('Nouveau dossier à surveiller (chemin absolu) :', el.folderPath.textContent);
      if (!next) return;
      Api.setFolder(next)
        .then(async () => {
          toast('Dossier surveillé mis à jour.');
          await loadStatus();
          await loadWeeks();
        })
        .catch((err) => toast(`Impossible de changer de dossier : ${err.message || err}`));
    });

    el.btnBackup.addEventListener('click', () => {
      window.location.href = Api.backupUrl();
    });

    el.btnCompare.addEventListener('click', () => {
      toast('Comparaison de deux sessions côte à côte : à venir.');
    });
  }

  (async function init() {
    wireEvents();
    await loadStatus();
    await loadWeeks();
  })();
})();
