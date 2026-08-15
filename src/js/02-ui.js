/* ==========================================================================
   02 — Interface : icônes, composants, routeur, recherche, alertes.
   ========================================================================== */
'use strict';

/* ------------------------------------------------------------------ Icônes */

const svg = (d, extra) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

const Icons = {
  dashboard: svg('<rect x="3" y="3" width="7" height="8" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="11" width="7" height="10" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>'),
  calendar: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  users: svg('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 11a3 3 0 100-6"/><path d="M18 20c0-2.6-.9-4.3-2.4-5.2"/>'),
  plan: svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3.5h6a1 1 0 011 1V6H8V4.5a1 1 0 011-1z"/><path d="M9 11h6M9 15h4"/>'),
  doc: svg('<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'),
  receipt: svg('<path d="M6 2.5h12v19l-2.4-1.6-2.4 1.6-2.4-1.6L8.4 21.5 6 19.9z"/><path d="M9.5 8h5M9.5 12h5"/>'),
  wallet: svg('<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M16.5 14.5h1.5"/>'),
  shield: svg('<path d="M12 3l7.5 3v5.5c0 4.4-3.1 8.2-7.5 9.5-4.4-1.3-7.5-5.1-7.5-9.5V6z"/><path d="M9.2 12l2 2 3.6-3.8"/>'),
  book: svg('<path d="M4 5.5A2.5 2.5 0 016.5 3H19v15H6.5A2.5 2.5 0 004 20.5z"/><path d="M4 18.5V21h15"/>'),
  chart: svg('<path d="M4 20V4"/><path d="M4 20h16"/><rect x="7" y="12" width="3" height="5" rx="1"/><rect x="12" y="8" width="3" height="9" rx="1"/><rect x="17" y="5" width="3" height="12" rx="1"/>'),
  box: svg('<path d="M3.5 8.5L12 4l8.5 4.5v7L12 20l-8.5-4.5z"/><path d="M3.5 8.5L12 13l8.5-4.5M12 13v7"/>'),
  lab: svg('<path d="M10 3h4M11 3v6.2L5.7 18a2 2 0 001.7 3h9.2a2 2 0 001.7-3L13 9.2V3"/><path d="M8 15h8"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2.5l1.3 2.4 2.7-.4.6 2.7 2.4 1.3-1.3 2.4 1.3 2.4-2.4 1.3-.6 2.7-2.7-.4L12 21.5l-1.3-2.4-2.7.4-.6-2.7-2.4-1.3L6.3 13 5 10.6l2.4-1.3.6-2.7 2.7.4z"/>'),
  tooth: svg('<path d="M12 4.2c1.9-1.5 4.6-1.8 6.4-.4 2 1.5 2.5 4.3 1.9 7.1-.4 2.2-1.2 3.7-1.6 5.9-.4 1.8-.5 4.1-2 4.7-1.5.6-2.1-1.4-2.5-3.2-.4-1.6-.6-3.3-2.2-3.3s-1.9 1.7-2.2 3.3c-.4 1.8-1 3.8-2.5 3.2-1.4-.6-1.6-2.9-2-4.7-.4-2.2-1.2-3.7-1.6-5.9-.6-2.8 0-5.6 1.9-7.1 1.8-1.4 4.5-1.1 6.4.4z"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  edit: svg('<path d="M4 20h4L19 9a2.1 2.1 0 10-3-3L5 17z"/><path d="M14.5 6.5l3 3"/>'),
  trash: svg('<path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2"/><path d="M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13"/>'),
  print: svg('<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7" rx="2"/><path d="M7 14h10v6H7z"/>'),
  download: svg('<path d="M12 4v11M8 11l4 4 4-4"/><path d="M5 19h14"/>'),
  upload: svg('<path d="M12 20V9M8 12l4-4 4 4"/><path d="M5 20h14"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7"/>'),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  alert: svg('<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.2v.1"/>'),
  phone: svg('<path d="M6 3h3l2 5-2.2 1.4a12 12 0 005.8 5.8L16 13l5 2v3a2 2 0 01-2.2 2A17 17 0 014 5.2 2 2 0 016 3z"/>'),
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5L12 13l8.5-6.5"/>'),
  money: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7v10M14.5 9.5c-.6-.8-1.5-1.2-2.5-1.2-1.4 0-2.5.8-2.5 2s1.1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-1.9-.4-2.5-1.2"/>'),
  lock: svg('<rect x="4.5" y="10" width="15" height="10.5" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/>'),
  logout: svg('<path d="M15 5V4a1 1 0 00-1-1H5a1 1 0 00-1 1v16a1 1 0 001 1h9a1 1 0 001-1v-1"/><path d="M9 12h11M17 8.5l3.5 3.5L17 15.5"/>'),
  user: svg('<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c0-3.8 3.4-6.2 7.5-6.2s7.5 2.4 7.5 6.2"/>'),
  clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.2V12l3 2"/>'),
  filter: svg('<path d="M4 5h16l-6.2 7.4V19l-3.6 2v-8.6z"/>'),
  chevron: svg('<path d="M9 6l6 6-6 6"/>'),
  copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 011-1h9"/>'),
  sms: svg('<path d="M20 12a7.5 7.5 0 01-11 6.6L4 20l1.4-4.5A7.5 7.5 0 1120 12z"/><path d="M9 12h.01M12 12h.01M15 12h.01"/>'),
  refresh: svg('<path d="M20 11a8 8 0 10-1.5 5.5"/><path d="M20 5v6h-6"/>'),
  empty: svg('<rect x="3.5" y="6" width="17" height="14" rx="2"/><path d="M3.5 11h17M8 3v4M16 3v4"/>'),
};

/* --------------------------------------------------------------- Composants */

const UI = {
  /* ---- Toasts ---- */
  toast(titre, texte, kind, ms) {
    const box = U.$('#toasts');
    const t = document.createElement('div');
    t.className = 'toast t-' + (kind || 'ok');
    t.innerHTML = `<div><b>${U.esc(titre)}</b>${texte ? `<span>${U.esc(texte)}</span>` : ''}</div>`;
    box.appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity .25s ease, transform .25s ease';
      t.style.opacity = '0'; t.style.transform = 'translateX(12px)';
      setTimeout(() => t.remove(), 260);
    }, ms || 3200);
  },

  /* ---- Modales ---- */
  _stack: [],

  modal(opts) {
    const root = U.$('#modalRoot');
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `
      <div class="modal ${opts.size ? 'w-' + opts.size : ''}" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div><h2>${U.esc(opts.titre)}</h2>${opts.sous ? `<p>${U.esc(opts.sous)}</p>` : ''}</div>
          <button class="btn btn-icon btn-ghost btn-sm" data-close type="button" aria-label="Fermer">${Icons.x}</button>
        </div>
        <div class="modal-body">${opts.body || ''}</div>
        ${opts.foot === null ? '' : `<div class="modal-foot">${opts.foot || `<button class="btn" data-close type="button">Fermer</button>`}</div>`}
      </div>`;
    root.appendChild(ov);
    this._stack.push(ov);

    const close = () => this.close(ov);
    ov.addEventListener('click', e => {
      if (e.target === ov) close();
      if (e.target.closest('[data-close]')) close();
    });
    ov.querySelector('.modal').addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    const focusable = ov.querySelector('input:not([type=hidden]), select, textarea, button.btn-primary');
    if (focusable) setTimeout(() => focusable.focus(), 40);
    if (opts.onMount) opts.onMount(ov);
    return ov;
  },

  close(ov) {
    ov = ov || this._stack[this._stack.length - 1];
    if (!ov) return;
    this._stack = this._stack.filter(x => x !== ov);
    ov.remove();
  },

  closeAll() { this._stack.slice().forEach(o => this.close(o)); },

  confirm(titre, texte, opts) {
    opts = opts || {};
    return new Promise(res => {
      const ov = this.modal({
        titre, size: 'sm',
        body: `<p style="color:var(--ink-soft)">${texte}</p>`,
        foot: `<button class="btn" data-close type="button">Annuler</button>
               <button class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'}" data-ok type="button">${U.esc(opts.ok || 'Confirmer')}</button>`,
      });
      ov.addEventListener('click', e => {
        if (e.target.closest('[data-ok]')) { this.close(ov); res(true); }
        else if (e.target === ov || e.target.closest('[data-close]')) res(false);
      });
    });
  },

  prompt(titre, label, value, opts) {
    opts = opts || {};
    return new Promise(res => {
      const ov = this.modal({
        titre, size: 'sm',
        body: `<div class="field"><label for="pv">${U.esc(label)}</label>
               ${opts.multiline
                 ? `<textarea class="textarea" id="pv">${U.esc(value || '')}</textarea>`
                 : `<input class="input" id="pv" type="${opts.type || 'text'}" value="${U.esc(value || '')}">`}
               ${opts.hint ? `<span class="hint">${U.esc(opts.hint)}</span>` : ''}</div>`,
        foot: `<button class="btn" data-close type="button">Annuler</button>
               <button class="btn btn-primary" data-ok type="button">${U.esc(opts.ok || 'Valider')}</button>`,
      });
      const input = ov.querySelector('#pv');
      const done = () => { const v = input.value; this.close(ov); res(v); };
      ov.addEventListener('click', e => {
        if (e.target.closest('[data-ok]')) done();
        else if (e.target === ov || e.target.closest('[data-close]')) res(null);
      });
      input.addEventListener('keydown', e => { if (e.key === 'Enter' && !opts.multiline) { e.preventDefault(); done(); } });
    });
  },

  /* ---- Menu contextuel ---- */
  menu(anchor, items) {
    U.$$('.menu').forEach(m => m.remove());
    const m = document.createElement('div');
    m.className = 'menu';
    m.innerHTML = items.map((it, idx) => {
      if (it === '-') return '<hr>';
      if (it.label) return `<div class="menu-label">${U.esc(it.label)}</div>`;
      return `<button type="button" data-i="${idx}" class="${it.danger ? 'danger' : ''}">${it.icon || ''}<span>${U.esc(it.text)}</span></button>`;
    }).join('');
    document.body.appendChild(m);

    const r = anchor.getBoundingClientRect();
    const w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left)) + 'px';
    m.style.top = (r.bottom + h + 8 > window.innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4) + 'px';

    m.addEventListener('click', e => {
      const b = e.target.closest('button[data-i]');
      if (!b) return;
      const it = items[Number(b.dataset.i)];
      m.remove();
      if (it && it.act) it.act();
    });
    setTimeout(() => {
      const off = e => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', off); } };
      document.addEventListener('mousedown', off);
    }, 0);
    return m;
  },

  /* ---- Fabrique de champs ---- */
  field(o) {
    const id = o.id || ('f_' + o.name);
    const req = o.required ? ' required' : '';
    const dis = o.disabled ? ' disabled' : '';
    let ctrl;
    if (o.type === 'select') {
      ctrl = `<select class="select" id="${id}" name="${o.name}"${req}${dis}>${
        (o.options || []).map(op => {
          const val = Array.isArray(op) ? op[0] : op.value;
          const lab = Array.isArray(op) ? op[1] : op.label;
          return `<option value="${U.esc(val)}"${String(val) === String(o.value) ? ' selected' : ''}>${U.esc(lab)}</option>`;
        }).join('')}</select>`;
    } else if (o.type === 'textarea') {
      ctrl = `<textarea class="textarea" id="${id}" name="${o.name}" rows="${o.rows || 3}" placeholder="${U.esc(o.placeholder || '')}"${req}${dis}>${U.esc(o.value || '')}</textarea>`;
    } else if (o.type === 'checkbox') {
      return `<label class="check"><input type="checkbox" name="${o.name}" id="${id}"${o.value ? ' checked' : ''}${dis}><span>${U.esc(o.label)}</span></label>`;
    } else {
      ctrl = `<input class="input" id="${id}" name="${o.name}" type="${o.type || 'text'}" value="${U.esc(o.value === 0 ? '0' : (o.value || ''))}" placeholder="${U.esc(o.placeholder || '')}"${o.step ? ` step="${o.step}"` : ''}${o.min !== undefined ? ` min="${o.min}"` : ''}${o.max !== undefined ? ` max="${o.max}"` : ''}${o.list ? ` list="${o.list}"` : ''}${req}${dis} autocomplete="off">`;
    }
    return `<div class="field${o.full ? ' full' : ''}">
      <label for="${id}">${U.esc(o.label)}${o.required ? ' *' : ''}</label>
      ${ctrl}
      ${o.hint ? `<span class="hint">${U.esc(o.hint)}</span>` : ''}
    </div>`;
  },

  formValues(form) {
    const out = {};
    new FormData(form).forEach((v, k) => {
      if (out[k] !== undefined) { out[k] = [].concat(out[k], v); } else { out[k] = v; }
    });
    U.$$('input[type=checkbox]', form).forEach(c => { out[c.name] = c.checked; });
    return out;
  },

  /* ---- Fragments réutilisables ---- */
  empty(titre, texte, action) {
    return `<div class="empty">${Icons.empty}<h3>${U.esc(titre)}</h3><p>${U.esc(texte)}</p>${action || ''}</div>`;
  },

  badge(text, kind, noDot) {
    return `<span class="badge ${kind ? 'b-' + kind : ''}${noDot ? ' no-dot' : ''}">${U.esc(text)}</span>`;
  },

  kpi(o) {
    return `<div class="kpi ${o.kind ? 'is-' + o.kind : ''}">
      <div class="k-label">${U.esc(o.label)}</div>
      <div class="k-value">${o.value}${o.unit ? `<small>${U.esc(o.unit)}</small>` : ''}</div>
      ${o.foot ? `<div class="k-foot">${o.foot}</div>` : ''}
    </div>`;
  },

  meter(value, max, kind) {
    const p = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    return `<div class="meter ${kind ? 'is-' + kind : ''}"><i style="width:${p.toFixed(1)}%"></i></div>`;
  },

  card(titre, body, o) {
    o = o || {};
    return `<div class="card ${o.cls || ''}">
      ${titre ? `<div class="card-head"><div><h3>${titre}</h3>${o.sous ? `<p>${U.esc(o.sous)}</p>` : ''}</div>${o.actions || ''}</div>` : ''}
      <div class="card-body ${o.flush ? 'flush' : ''}">${body}</div>
      ${o.foot ? `<div class="card-foot">${o.foot}</div>` : ''}
    </div>`;
  },

  /* Sélecteur de patient (datalist) */
  patientOptions(sel) {
    return DB.patients.filter(p => !p.archived)
      .sort((a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom))
      .map(p => `<option value="${p.id}"${p.id === sel ? ' selected' : ''}>${U.esc(p.nom + ' ' + p.prenom)} — ${U.esc(p.code)}</option>`).join('');
  },

  bars(data, opts) {
    opts = opts || {};
    const max = Math.max(1, ...data.map(d => d.v));
    return `<div class="bar-chart">${data.map(d => `
      <div class="bar ${opts.gold ? 'is-gold' : ''}" title="${U.esc(d.label)} : ${opts.fmt ? opts.fmt(d.v) : U.money(d.v)}">
        <span class="v">${opts.short ? U.num(Math.round(d.v)) : ''}</span>
        <i style="height:${Math.max(2, (d.v / max) * 100)}%"></i>
        <small>${U.esc(d.label)}</small>
      </div>`).join('')}</div>`;
  },

  donut(parts, total, size) {
    const s = size || 128, r = 52, c = 2 * Math.PI * r;
    let off = 0;
    const segs = parts.filter(p => p.v > 0).map(p => {
      const frac = total > 0 ? p.v / total : 0;
      const seg = `<circle cx="64" cy="64" r="${r}" fill="none" stroke="${p.color}" stroke-width="17"
        stroke-dasharray="${(frac * c).toFixed(2)} ${c.toFixed(2)}" stroke-dashoffset="${(-off * c).toFixed(2)}"
        transform="rotate(-90 64 64)" stroke-linecap="butt"><title>${U.esc(p.label)}</title></circle>`;
      off += frac;
      return seg;
    }).join('');
    return `<svg class="donut" viewBox="0 0 128 128" style="width:${s}px;height:${s}px">
      <circle cx="64" cy="64" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="17"/>
      ${segs}
      <text x="64" y="60" text-anchor="middle" font-size="19" font-weight="650" fill="var(--ink)" font-family="var(--font-display)">${U.num(total)}</text>
      <text x="64" y="77" text-anchor="middle" font-size="10" fill="var(--ink-mute)" letter-spacing="1">TOTAL</text>
    </svg>`;
  },
};

/* ------------------------------------------------------------------ Alertes */

const Alerts = {
  compute() {
    const today = U.todayISO();
    const out = [];

    DB.stock.filter(s => s.quantite <= s.seuil).forEach(s => out.push({
      kind: s.quantite === 0 ? 'bad' : 'warn', module: 'stock',
      titre: s.quantite === 0 ? 'Rupture de stock' : 'Stock bas',
      texte: `${s.designation} — ${s.quantite} ${s.unite} (seuil ${s.seuil})`, route: '#/stock',
    }));

    DB.stock.filter(s => s.peremption && U.fromISO(s.peremption) - U.fromISO(today) < 60 * 86400000 && s.quantite > 0).forEach(s => {
      const j = Math.round((U.fromISO(s.peremption) - U.fromISO(today)) / 86400000);
      out.push({
        kind: j < 0 ? 'bad' : 'warn', module: 'stock',
        titre: j < 0 ? 'Produit périmé' : 'Péremption proche',
        texte: `${s.designation} — ${j < 0 ? 'périmé depuis ' + Math.abs(j) + ' j' : 'expire dans ' + j + ' j'} (${U.fmtDate(s.peremption)})`,
        route: '#/stock',
      });
    });

    DB.factures.filter(f => f.type === 'facture' && f.statut !== 'annulee').forEach(f => {
      const t = Data.totaux(f);
      const retard = Math.round((U.fromISO(today) - U.fromISO(f.echeance)) / 86400000);
      if (t.reste > 0.001 && retard > 0) out.push({
        kind: retard > 60 ? 'bad' : 'warn', module: 'factures',
        titre: 'Facture impayée',
        texte: `${f.numero} — ${Data.patientNom(f.patientId)} — ${U.money(t.reste)} — ${retard} j de retard`,
        route: '#/factures',
      });
    });

    DB.factures.filter(f => f.type === 'devis' && f.statut === 'propose').forEach(f => {
      const j = Math.round((U.fromISO(today) - U.fromISO(f.date)) / 86400000);
      if (j > 15) out.push({
        kind: 'info', module: 'factures', titre: 'Devis sans réponse',
        texte: `${f.numero} — ${Data.patientNom(f.patientId)} — proposé il y a ${j} jours`, route: '#/factures',
      });
    });

    const aDeposer = DB.cnam.filter(c => c.statut === 'a_deposer');
    if (aDeposer.length) out.push({
      kind: 'info', module: 'cnam', titre: 'Dossiers CNAM à déposer',
      texte: `${aDeposer.length} dossier(s) en attente de dépôt — ${U.money(U.sum(aDeposer, c => c.montantRemb))} à récupérer`,
      route: '#/cnam',
    });
    DB.cnam.filter(c => c.statut === 'rejete').forEach(c => out.push({
      kind: 'bad', module: 'cnam', titre: 'Dossier CNAM rejeté',
      texte: `${Data.patientNom(c.patientId)} — ${U.money(c.montantRemb)} — ${c.note || 'motif non précisé'}`, route: '#/cnam',
    }));

    DB.labo.filter(l => l.statut !== 'livre' && l.dateLivraisonPrevue && U.fromISO(l.dateLivraisonPrevue) < U.fromISO(today)).forEach(l => out.push({
      kind: 'bad', module: 'labo', titre: 'Travail de laboratoire en retard',
      texte: `${l.numero} — ${Data.patientNom(l.patientId)} — ${l.type} — attendu le ${U.fmtDate(l.dateLivraisonPrevue)}`, route: '#/labo',
    }));
    DB.labo.filter(l => l.statut === 'a_envoyer').forEach(l => out.push({
      kind: 'warn', module: 'labo', titre: 'Empreinte à envoyer',
      texte: `${l.numero} — ${Data.patientNom(l.patientId)} — ${l.type}`, route: '#/labo',
    }));

    const demain = U.addDays(today, 1);
    const nonConfirmes = DB.rdv.filter(r => r.date === demain && r.statut === 'prevu');
    if (nonConfirmes.length) out.push({
      kind: 'warn', module: 'agenda', titre: 'Rendez-vous à confirmer',
      texte: `${nonConfirmes.length} rendez-vous de demain ne sont pas encore confirmés`, route: '#/agenda',
    });

    const caisseOuverte = DB.caisse.find(c => c.statut === 'ouverte' && c.date < today);
    if (caisseOuverte) out.push({
      kind: 'warn', module: 'caisse', titre: 'Caisse non clôturée',
      texte: `La caisse du ${U.fmtDate(caisseOuverte.date)} est restée ouverte`, route: '#/caisse',
    });

    DB.patients.filter(p => !p.archived && p.medical && (p.medical.allergies || []).length === 0 && !p.medical.notes && p.dateNaissance === '').forEach(() => {});

    return out;
  },

  visible() {
    const all = this.compute();
    const modPerm = {
      stock: 'stock.view', factures: 'facture.view', cnam: 'cnam.view',
      labo: 'labo.view', agenda: 'agenda.view', caisse: 'caisse.view',
    };
    return all.filter(a => Perm.can(modPerm[a.module] || 'agenda.view'));
  },
};

/* ------------------------------------------------------------------- Routeur */

const ROUTES = [
  { group: 'Clinique', id: 'dashboard', hash: '#/', label: 'Tableau de bord', icon: 'dashboard', perm: null },
  { group: 'Clinique', id: 'agenda',    hash: '#/agenda',   label: 'Agenda',    icon: 'calendar', perm: 'agenda.view' },
  { group: 'Clinique', id: 'patients',  hash: '#/patients', label: 'Patients',  icon: 'users',    perm: 'patients.view' },
  { group: 'Clinique', id: 'plans',     hash: '#/plans',    label: 'Plans de traitement', icon: 'plan', perm: 'clinique.view' },
  { group: 'Clinique', id: 'documents', hash: '#/documents', label: 'Ordonnances & documents', icon: 'doc', perm: 'patients.view' },

  { group: 'Finances', id: 'factures', hash: '#/factures', label: 'Devis & factures', icon: 'receipt', perm: 'facture.view' },
  { group: 'Finances', id: 'caisse',   hash: '#/caisse',   label: 'Caisse',           icon: 'wallet',  perm: 'caisse.view' },
  { group: 'Finances', id: 'cnam',     hash: '#/cnam',     label: 'CNAM',             icon: 'shield',  perm: 'cnam.view' },
  { group: 'Finances', id: 'compta',   hash: '#/compta',   label: 'Comptabilité',     icon: 'book',    perm: 'compta.view' },
  { group: 'Finances', id: 'rapports', hash: '#/rapports', label: 'Rapports',         icon: 'chart',   perm: 'rapports.view' },

  { group: 'Gestion', id: 'stock',  hash: '#/stock',  label: 'Stock & commandes', icon: 'box',      perm: 'stock.view' },
  { group: 'Gestion', id: 'labo',   hash: '#/labo',   label: 'Laboratoire',       icon: 'lab',      perm: 'labo.view' },
  { group: 'Gestion', id: 'params', hash: '#/params', label: 'Paramètres',        icon: 'settings', perm: 'params.view' },
];

const Views = {}; /* rempli par les modules 03/04/05 */

const App = {
  route: { name: 'dashboard', arg: null },
  _busy: false,

  /* ---- Démarrage ---- */
  async boot() {
    await Store.init();
    let data = null;
    try { data = await Store.read(); } catch (e) { console.warn('Lecture du stockage impossible', e); }

    if (!data || !data.meta || !data.users) {
      data = await Seed.build();
      await Store.write(data);
    }
    DB = data;
    this.migrate();

    this.bindChrome();

    if (Auth.restore()) this.showApp();
    else this.showAuth();
  },

  /* Ajout non destructif des champs introduits après la création de la base */
  migrate() {
    const defaults = {
      patients: [], dents: [], rdv: [], soins: [], plans: [], factures: [], paiements: [],
      caisse: [], cnam: [], stock: [], mouvements: [], fournisseurs: [], commandes: [],
      labo: [], depenses: [], ordonnances: [], documents: [], audit: [], actes: [],
    };
    Object.keys(defaults).forEach(k => { if (!Array.isArray(DB[k])) DB[k] = defaults[k]; });
    DB.seq = DB.seq || { facture: 0, devis: 0, patient: 0, labo: 0, commande: 0 };
    DB.cabinet = DB.cabinet || {};
    DB.users.forEach(u => { if (u.role !== 'admin' && !u.perms) u.perms = ROLE_DEFAULTS[u.role] || []; });
  },

  /* ---- Écrans ---- */
  showAuth() {
    U.$('#app').classList.remove('is-on');
    U.$('#auth').style.display = '';
    const hint = U.$('#loginHint');
    const seeded = DB && DB.users.some(u => u.mustChange);
    hint.innerHTML = seeded
      ? `<b>Premier démarrage.</b> Deux comptes sont prêts :<br>
         Praticienne — <code>sarra</code> / <code>Sarra@2026</code><br>
         Assistante — <code>assistante</code> / <code>Assistante@2026</code><br>
         Le changement du mot de passe est demandé à la première connexion.`
      : `Données conservées dans le ${U.esc(Store.label())}. En cas d'oubli du mot de passe, restaurez une sauvegarde.`;
    setTimeout(() => { const f = U.$('#loginUser'); if (f) f.focus(); }, 60);
  },

  showApp() {
    U.$('#auth').style.display = 'none';
    U.$('#app').classList.add('is-on');
    const u = Auth.current;
    U.$('#userName').textContent = u.nom;
    U.$('#userRole').textContent = u.role === 'admin' ? 'Praticienne' : 'Assistante';
    U.$('#userAvatar').textContent = U.initials(u.nom.replace(/^Dr\.?\s*/i, '').split(' ').slice(-1)[0], u.nom.replace(/^Dr\.?\s*/i, ''));
    U.$('#userAvatar').className = 'avatar' + (u.role === 'admin' ? '' : ' is-assist');
    U.$('#railCabName').textContent = DB.cabinet.nom.replace(/^Cabinet dentaire\s*/i, '') || DB.cabinet.nom;
    U.$('#railCabCity').textContent = (DB.cabinet.ville || '').split(',').pop().trim();

    this.buildNav();
    this.onHash();

    if (u.mustChange) setTimeout(() => Views.changePassword(true), 350);
  },

  /* ---- Chrome (barre, rail, raccourcis) ---- */
  bindChrome() {
    /* Thème */
    const saved = (() => { try { return localStorage.getItem(APP.key + ':theme'); } catch (e) { return null; } })();
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    U.$('#themeBtn').addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const isDark = cur ? cur === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
      const next = isDark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem(APP.key + ':theme', next); } catch (e) {}
    });

    /* Connexion */
    U.$('#loginForm').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = U.$('#loginBtn'); const err = U.$('#loginError');
      btn.disabled = true; btn.textContent = 'Vérification…';
      const r = await Auth.login(U.$('#loginUser').value.trim(), U.$('#loginPass').value);
      btn.disabled = false; btn.textContent = 'Ouvrir le cabinet';
      if (!r.ok) {
        err.textContent = r.msg; err.classList.remove('hidden');
        U.$('#loginPass').value = ''; U.$('#loginPass').focus();
        return;
      }
      err.classList.add('hidden');
      U.$('#loginPass').value = '';
      this.showApp();
    });

    /* Rail réduit */
    U.$('#railToggle').addEventListener('click', () => {
      U.$('#app').classList.toggle('is-mini');
      const mini = U.$('#app').classList.contains('is-mini');
      U.$('#railToggle').querySelector('span').textContent = mini ? '' : 'Réduire';
      try { localStorage.setItem(APP.key + ':mini', mini ? '1' : '0'); } catch (e) {}
    });
    try { if (localStorage.getItem(APP.key + ':mini') === '1') U.$('#app').classList.add('is-mini'); } catch (e) {}

    U.$('#mobileMenuBtn').addEventListener('click', () => Views.mobileMenu());

    /* Menu utilisateur */
    U.$('#userBtn').addEventListener('click', e => {
      const u = Auth.current;
      UI.menu(e.currentTarget, [
        { label: u.nom + ' — ' + ROLE_LABEL[u.role] },
        { text: 'Changer mon mot de passe', icon: Icons.lock, act: () => Views.changePassword(false) },
        { text: 'Thème clair / sombre', icon: Icons.settings, act: () => U.$('#themeBtn').click() },
        '-',
        { text: 'Se déconnecter', icon: Icons.logout, danger: true, act: () => Auth.logout() },
      ]);
    });

    /* Alertes */
    U.$('#alertsBtn').addEventListener('click', () => Views.alertsPanel());

    /* Recherche globale */
    const si = U.$('#globalSearch');
    si.addEventListener('input', U.debounce(() => this.search(si.value), 140));
    si.addEventListener('focus', () => { if (si.value) this.search(si.value); });
    si.addEventListener('keydown', e => { if (e.key === 'Escape') { si.value = ''; U.$('#searchResults').innerHTML = ''; si.blur(); } });
    document.addEventListener('click', e => {
      if (!e.target.closest('.searchbox')) U.$('#searchResults').innerHTML = '';
    });
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); si.focus(); si.select(); }
      if (e.key === 'Escape') UI.close();
    });

    window.addEventListener('hashchange', () => this.onHash());
  },

  buildNav() {
    const nav = U.$('#railNav');
    const groups = {};
    ROUTES.forEach(r => {
      if (r.perm && !Perm.can(r.perm)) return;
      (groups[r.group] = groups[r.group] || []).push(r);
    });
    const alerts = Alerts.visible();
    const byMod = U.groupBy(alerts, a => a.module);
    const modRoute = { stock: 'stock', factures: 'factures', cnam: 'cnam', labo: 'labo', agenda: 'agenda', caisse: 'caisse' };

    nav.innerHTML = Object.keys(groups).map(g => `
      <div class="rail-group">
        <span class="eyebrow">${U.esc(g)}</span>
        ${groups[g].map(r => {
          const n = Object.keys(byMod).filter(m => modRoute[m] === r.id).reduce((t, m) => t + byMod[m].length, 0);
          const actif = this.route.name === r.id || (this.route.name === 'patient' && r.id === 'patients');
          return `<button class="nav-item ${actif ? 'is-active' : ''}" data-go="${r.hash}" type="button" title="${U.esc(r.label)}">
            ${Icons[r.icon]}<span>${U.esc(r.label)}</span>${n ? `<span class="badge-dot">${n}</span>` : ''}
          </button>`;
        }).join('')}
      </div>`).join('');

    nav.onclick = e => {
      const b = e.target.closest('[data-go]');
      if (b) location.hash = b.dataset.go;
    };

    /* Navigation mobile — 5 entrées principales */
    const mob = ROUTES.filter(r => ['dashboard', 'agenda', 'patients', 'factures', 'stock'].includes(r.id) && (!r.perm || Perm.can(r.perm))).slice(0, 5);
    const mn = U.$('#mobileNav');
    mn.innerHTML = mob.map(r => `<button data-go="${r.hash}" class="${this.route.name === r.id ? 'is-active' : ''}" type="button">${Icons[r.icon]}<span>${U.esc(r.label.split(' ')[0])}</span></button>`).join('');
    mn.onclick = e => { const b = e.target.closest('[data-go]'); if (b) location.hash = b.dataset.go; };

    const c = U.$('#alertsCount');
    if (alerts.length) { c.textContent = alerts.length; c.classList.remove('hidden'); }
    else c.classList.add('hidden');
  },

  onHash() {
    const h = location.hash || '#/';
    const parts = h.replace(/^#\/?/, '').split('/');
    const name = parts[0] || 'dashboard';
    this.route = { name: name === '' ? 'dashboard' : name, arg: parts[1] || null };
    this.render();
    U.$('#page').scrollTop = 0;
    window.scrollTo(0, 0);
  },

  go(hash) { location.hash = hash; },

  render() {
    if (!Auth.current) return;
    const r = this.route;
    const def = ROUTES.find(x => x.id === r.name);
    const page = U.$('#page');

    if (def && def.perm && !Perm.can(def.perm)) { page.innerHTML = Perm.guard(def.perm); this.buildNav(); return; }

    /* Les gestionnaires sont posés en propriétés : ils ne s'accumulent pas */
    page.onclick = null; page.onchange = null; page.oninput = null;
    page.onsubmit = null; page.onkeydown = null;

    const fn = Views[r.name];
    if (!fn) {
      page.innerHTML = UI.empty('Page introuvable', "Cette section n'existe pas ou a été déplacée.",
        `<button class="btn btn-primary" onclick="location.hash='#/'">Revenir au tableau de bord</button>`);
      return;
    }
    try {
      page.innerHTML = fn(r.arg) || '';
      if (Views[r.name + 'Mount']) Views[r.name + 'Mount'](r.arg);
    } catch (err) {
      console.error(err);
      page.innerHTML = `<div class="card"><div class="empty"><h3>Erreur d'affichage</h3><p>${U.esc(err.message)}</p></div></div>`;
    }
    this.buildNav();
  },

  refresh() {
    if (!Auth.current) return;
    if (this._busy) return;
    this._busy = true;
    requestAnimationFrame(() => { this._busy = false; this.render(); });
  },

  /* ---- Recherche globale ---- */
  search(q) {
    const box = U.$('#searchResults');
    const term = U.norm(q).trim();
    if (term.length < 2) { box.innerHTML = ''; return; }

    const hits = [];
    if (Perm.can('patients.view')) {
      DB.patients.filter(p => !p.archived).forEach(p => {
        const hay = U.norm(p.nom + ' ' + p.prenom + ' ' + p.code + ' ' + (p.tel || '') + ' ' + (p.cin || ''));
        if (hay.includes(term)) hits.push({
          icon: Icons.user, titre: p.prenom + ' ' + p.nom,
          sous: `${p.code} · ${U.tel(p.tel)}${p.assurance.type === 'cnam' ? ' · CNAM' : ''}`,
          go: '#/patient/' + p.id,
        });
      });
    }
    if (Perm.can('facture.view')) {
      DB.factures.forEach(f => {
        if (U.norm(f.numero + ' ' + Data.patientNom(f.patientId)).includes(term)) hits.push({
          icon: Icons.receipt, titre: f.numero + ' — ' + Data.patientNom(f.patientId),
          sous: `${f.type === 'devis' ? 'Devis' : 'Facture'} du ${U.fmtDate(f.date)} · ${U.money(Data.totaux(f).total)}`,
          go: '#/factures/' + f.id,
        });
      });
    }
    DB.actes.filter(a => a.actif).forEach(a => {
      if (U.norm(a.libelle + ' ' + a.code).includes(term)) hits.push({
        icon: Icons.tooth, titre: a.libelle, sous: `${a.code} · ${a.categorie} · ${U.money(a.prix)}`,
        go: Perm.can('params.view') ? '#/params/actes' : '#/',
      });
    });
    if (Perm.can('labo.view')) {
      DB.labo.forEach(l => {
        if (U.norm(l.numero + ' ' + l.type + ' ' + Data.patientNom(l.patientId)).includes(term)) hits.push({
          icon: Icons.lab, titre: l.numero + ' — ' + l.type, sous: Data.patientNom(l.patientId), go: '#/labo',
        });
      });
    }

    box.innerHTML = hits.length
      ? hits.slice(0, 12).map(h => `<button class="search-hit" data-go="${h.go}" type="button">
          <span style="width:16px;height:16px;color:var(--ink-mute);flex:0 0 auto">${h.icon}</span>
          <span class="grow"><b style="display:block;font-size:13.5px">${U.esc(h.titre)}</b><small>${U.esc(h.sous)}</small></span>
        </button>`).join('')
      : `<div style="padding:16px;text-align:center;color:var(--ink-mute);font-size:13px">Aucun résultat pour « ${U.esc(q)} »</div>`;

    box.onclick = e => {
      const b = e.target.closest('[data-go]');
      if (!b) return;
      location.hash = b.dataset.go;
      U.$('#globalSearch').value = '';
      box.innerHTML = '';
    };
  },
};

/* Pont pour les gestionnaires inline du HTML rendu */
window.App = App;
window.UI = UI;
window.U = U;
