/* ==========================================================================
   03 — Modules cliniques : tableau de bord, agenda, patients, dossier,
   odontogramme, plans de traitement, ordonnances et documents.
   ========================================================================== */
'use strict';

/* Fixe les gestionnaires de la page courante (remplacés à chaque rendu) */
const Bind = {
  click(fn)  { U.$('#page').onclick = fn; },
  change(fn) { U.$('#page').onchange = fn; },
  input(fn)  { U.$('#page').oninput = fn; },
  submit(fn) { U.$('#page').onsubmit = fn; },
};

/* État d'écran, non persisté */
const S = {
  agendaDate: U.todayISO(),
  agendaVue: 'semaine',
  patientTab: 'dossier',
  odoTool: 'carie',
  odoSet: 'adulte',
  filtres: {},
};

const STATUT_RDV = {
  prevu:    ['Prévu',       ''],
  confirme: ['Confirmé',    'ok'],
  attente:  ['En salle',    'info'],
  fauteuil: ['Au fauteuil', 'accent'],
  termine:  ['Terminé',     ''],
  absent:   ['Absent',      'bad'],
  annule:   ['Annulé',      ''],
};

const STATUT_FAC = {
  brouillon: ['Brouillon', ''], emise: ['À régler', 'warn'], partielle: ['Partiel', 'info'],
  payee: ['Réglée', 'ok'], annulee: ['Annulée', 'bad'],
  propose: ['Proposé', 'info'], accepte: ['Accepté', 'ok'], refuse: ['Refusé', 'bad'], termine: ['Réalisé', 'ok'],
};

/* ===================================================== Dialogues partagés === */

Views.changePassword = function (force) {
  const u = Auth.current;
  UI.modal({
    titre: force ? 'Choisissez votre mot de passe' : 'Changer mon mot de passe',
    sous: force ? 'Première connexion — le mot de passe provisoire doit être remplacé.' : u.nom,
    size: 'sm',
    body: `<form id="pwdForm" class="col" style="gap:14px">
      ${force ? '' : UI.field({ label: 'Mot de passe actuel', name: 'old', type: 'password', required: true })}
      ${UI.field({ label: 'Nouveau mot de passe', name: 'p1', type: 'password', required: true, hint: '8 caractères minimum. Mélangez lettres, chiffres et symboles.' })}
      ${UI.field({ label: 'Confirmation', name: 'p2', type: 'password', required: true })}
      <div class="meter" id="pwdMeter"><i style="width:0"></i></div>
      <div class="err hidden" id="pwdErr" style="color:var(--bad);font-size:12.5px"></div>
    </form>`,
    foot: `${force ? '' : '<button class="btn" data-close type="button">Annuler</button>'}
           <button class="btn btn-primary" id="pwdOk" type="button">Enregistrer</button>`,
    onMount(ov) {
      const f = ov.querySelector('#pwdForm');
      const meter = ov.querySelector('#pwdMeter');
      f.addEventListener('input', () => {
        const s = Auth.strength(f.p1.value);
        meter.querySelector('i').style.width = (s / 4 * 100) + '%';
        meter.className = 'meter ' + (s <= 1 ? 'is-bad' : s === 2 ? 'is-warn' : '');
      });
      ov.querySelector('#pwdOk').addEventListener('click', async () => {
        const err = ov.querySelector('#pwdErr');
        const show = m => { err.textContent = m; err.classList.remove('hidden'); };
        if (!force) {
          const ok = await Auth.verify(f.old.value, u);
          if (!ok) return show('Mot de passe actuel incorrect.');
        }
        if (f.p1.value.length < 8) return show('Le mot de passe doit contenir au moins 8 caractères.');
        if (f.p1.value !== f.p2.value) return show('Les deux saisies ne correspondent pas.');
        await Auth.setPassword(u, f.p1.value);
        Audit.log('mot_de_passe', 'utilisateur', u.id, 'Changement de mot de passe');
        Data.commit(true);
        UI.close(ov);
        UI.toast('Mot de passe enregistré', 'Il sera demandé à la prochaine connexion.', 'ok');
      });
    },
  });
};

Views.alertsPanel = function () {
  const list = Alerts.visible();
  UI.modal({
    titre: 'Alertes du cabinet',
    sous: list.length ? `${list.length} point(s) demandant votre attention` : 'Rien à signaler',
    size: 'lg',
    body: list.length ? `<div class="col" style="gap:8px">${list.map((a, i) => `
      <button class="alert-band ${a.kind === 'bad' ? '' : 'a-' + (a.kind === 'warn' ? 'warn' : 'info')}" data-i="${i}"
        style="width:100%;text-align:left;cursor:pointer;border-width:1px">
        ${Icons.alert}
        <span><b>${U.esc(a.titre)}</b><br>${U.esc(a.texte)}</span>
      </button>`).join('')}</div>`
      : UI.empty('Aucune alerte', 'Stock, échéances, laboratoire et dossiers CNAM sont à jour.'),
    onMount(ov) {
      ov.addEventListener('click', e => {
        const b = e.target.closest('[data-i]');
        if (!b) return;
        UI.close(ov);
        location.hash = list[Number(b.dataset.i)].route;
      });
    },
  });
};

Views.mobileMenu = function () {
  const items = ROUTES.filter(r => !r.perm || Perm.can(r.perm));
  UI.modal({
    titre: 'Navigation', size: 'sm', foot: null,
    body: `<div class="col" style="gap:2px">${items.map(r =>
      `<button class="nav-item" data-go="${r.hash}" type="button" style="font-size:14.5px;padding:11px 12px">${Icons[r.icon]}<span>${U.esc(r.label)}</span></button>`).join('')}
      <hr style="border:0;border-top:1px solid var(--line);margin:8px 0">
      <button class="nav-item" data-logout type="button" style="color:var(--bad);padding:11px 12px">${Icons.logout}<span>Se déconnecter</span></button>
    </div>`,
    onMount(ov) {
      ov.addEventListener('click', e => {
        const g = e.target.closest('[data-go]');
        if (g) { UI.close(ov); location.hash = g.dataset.go; }
        if (e.target.closest('[data-logout]')) { UI.close(ov); Auth.logout(); }
      });
    },
  });
};

/* ================================================== Tableau de bord ========= */

Views.dashboard = function () {
  const today = U.todayISO();
  const u = Auth.current;
  const rdvJour = U.sortBy(DB.rdv.filter(r => r.date === today && r.statut !== 'annule'), r => r.heure);
  const encaisseJour = U.sum(DB.paiements.filter(p => p.date === today), p => p.montant);
  const alerts = Alerts.visible();

  const moisKey = U.monthKey(today);
  const encaisseMois = U.sum(DB.paiements.filter(p => U.monthKey(p.date) === moisKey), p => p.montant);
  const chargesMois = U.sum(DB.depenses.filter(d => U.monthKey(d.date) === moisKey), d => d.montant);
  const impayes = U.sum(DB.factures.filter(f => f.type === 'facture' && f.statut !== 'annulee'), f => Data.totaux(f).reste);
  const cnamADeposer = DB.cnam.filter(c => c.statut === 'a_deposer');

  const now = new Date().getHours() * 60 + new Date().getMinutes();
  const prochain = rdvJour.find(r => U.hmToMinutes(r.heure) >= now && !['termine', 'absent'].includes(r.statut));

  /* Indicateurs — filtrés selon les droits */
  const kpis = [];
  kpis.push(UI.kpi({
    label: "Rendez-vous aujourd'hui", value: rdvJour.length,
    foot: `${rdvJour.filter(r => r.statut === 'termine').length} terminé(s) · ${rdvJour.filter(r => ['prevu', 'confirme'].includes(r.statut)).length} à venir`,
  }));
  if (Perm.can('caisse.view')) kpis.push(UI.kpi({
    label: 'Encaissé aujourd\'hui', value: U.money(encaisseJour, false), unit: 'DT', kind: 'gold',
    foot: `${DB.paiements.filter(p => p.date === today).length} règlement(s)`,
  }));
  if (Perm.can('compta.view')) kpis.push(UI.kpi({
    label: 'Recettes du mois', value: U.money(encaisseMois, false), unit: 'DT', kind: 'ok',
    foot: `Charges ${U.money(chargesMois)} · Résultat <b style="color:${encaisseMois - chargesMois >= 0 ? 'var(--ok)' : 'var(--bad)'}">${U.money(encaisseMois - chargesMois)}</b>`,
  }));
  if (Perm.can('facture.view')) kpis.push(UI.kpi({
    label: 'Impayés en cours', value: U.money(impayes, false), unit: 'DT', kind: impayes > 0 ? 'warn' : 'ok',
    foot: `${DB.factures.filter(f => f.type === 'facture' && Data.statutFacture(f) !== 'payee' && f.statut !== 'annulee').length} facture(s) ouverte(s)`,
  }));
  if (!Perm.can('compta.view')) kpis.push(UI.kpi({
    label: 'Patients actifs', value: DB.patients.filter(p => !p.archived).length,
    foot: `${DB.patients.filter(p => !p.archived && p.assurance.type === 'cnam').length} affiliés CNAM`,
  }));
  if (Perm.can('cnam.view')) kpis.push(UI.kpi({
    label: 'CNAM à déposer', value: cnamADeposer.length, kind: cnamADeposer.length ? 'warn' : 'ok',
    foot: `${U.money(U.sum(cnamADeposer, c => c.montantRemb))} à récupérer`,
  }));

  /* Chronologie du jour */
  const timeline = rdvJour.length ? `<div class="timeline">${rdvJour.map(r => {
    const p = Data.patient(r.patientId);
    const st = STATUT_RDV[r.statut] || ['—', ''];
    const enCours = U.hmToMinutes(r.heure) <= now && now < U.hmToMinutes(r.heure) + r.duree;
    return `<div class="tl-row ${enCours ? 'is-now' : ''}" data-rdv="${r.id}">
      <div class="tl-time">${r.heure}<small>${r.duree} min</small></div>
      <div class="tl-main">
        <div class="row" style="justify-content:space-between;gap:8px">
          <b>${p ? U.esc(p.prenom + ' ' + p.nom) : 'Patient supprimé'}</b>
          ${UI.badge(st[0], st[1])}
        </div>
        <p>${U.esc(r.motif)}${p && p.medical && (p.medical.allergies || []).length ? ` · <span style="color:var(--bad)">⚠ ${U.esc(p.medical.allergies.join(', '))}</span>` : ''}</p>
      </div>
    </div>`;
  }).join('')}</div>` : UI.empty('Journée libre', "Aucun rendez-vous n'est programmé aujourd'hui.");

  /* Actions rapides selon le profil */
  const actions = [
    Perm.can('agenda.edit') ? `<button class="btn btn-primary" data-act="new-rdv">${Icons.plus} Nouveau rendez-vous</button>` : '',
    Perm.can('patients.edit') ? `<button class="btn" data-act="new-patient">${Icons.user} Nouveau patient</button>` : '',
    Perm.can('facture.edit') ? `<button class="btn" data-act="new-facture">${Icons.receipt} Établir une facture</button>` : '',
    Perm.can('paiement.edit') ? `<button class="btn" data-act="new-paiement">${Icons.money} Encaisser</button>` : '',
  ].filter(Boolean).join('');

  /* Recettes des 6 derniers mois (praticienne) */
  let graph = '';
  if (Perm.can('rapports.view')) {
    const mois = [];
    for (let i = 5; i >= 0; i--) {
      const k = U.monthKey(U.addMonths(today, -i));
      mois.push({ label: U.monthLabel(k), v: U.sum(DB.paiements.filter(p => U.monthKey(p.date) === k), p => p.montant) });
    }
    graph = UI.card('Recettes encaissées', UI.bars(mois, { short: true }), { sous: '6 derniers mois, en dinars', cls: 'c12' });
  }

  const alertesCard = UI.card(`Alertes${alerts.length ? ` <span class="badge b-bad no-dot">${alerts.length}</span>` : ''}`,
    alerts.length
      ? `<div class="col" style="gap:7px">${alerts.slice(0, 6).map((a, i) =>
          `<button class="alert-band ${a.kind === 'bad' ? '' : 'a-' + (a.kind === 'warn' ? 'warn' : 'info')}" data-alert="${i}" style="width:100%;text-align:left;cursor:pointer">
            ${Icons.alert}<span><b>${U.esc(a.titre)}</b><br>${U.esc(a.texte)}</span></button>`).join('')}
         ${alerts.length > 6 ? `<button class="btn btn-sm btn-ghost" data-act="all-alerts">Voir les ${alerts.length} alertes</button>` : ''}</div>`
      : `<div class="alert-band a-ok">${Icons.check}<span><b>Tout est à jour.</b><br>Stock, échéances, laboratoire et dossiers CNAM ne signalent rien.</span></div>`,
    { cls: 'c5' });

  return `
    <div class="page-head">
      <div class="titles">
        <h1>Bonjour ${U.esc(u.role === 'admin' ? 'Dr. Abassi' : u.nom.split(' ')[0])}</h1>
        <p>${U.fmtDateLong(today).charAt(0).toUpperCase() + U.fmtDateLong(today).slice(1)}${prochain ? ` — prochain rendez-vous à <b>${prochain.heure}</b> avec ${U.esc(Data.patientNom(prochain.patientId))}` : ''}</p>
      </div>
      <div class="page-actions">${actions}</div>
    </div>

    <div class="grid">
      ${kpis.map(k => `<div class="c3">${k}</div>`).join('')}

      <div class="c7">
        ${UI.card('Journée du ' + U.fmtDate(today), timeline, {
          flush: true, sous: `${rdvJour.length} rendez-vous`,
          actions: Perm.can('agenda.view') ? `<button class="btn btn-sm" data-act="agenda">Ouvrir l'agenda</button>` : '',
        })}
      </div>

      ${alertesCard}

      ${Perm.can('labo.view') ? `<div class="c6">${UI.card('Laboratoire de prothèse',
        DB.labo.filter(l => l.statut !== 'livre').length
          ? `<div class="col" style="gap:0">${U.sortBy(DB.labo.filter(l => l.statut !== 'livre'), l => l.dateLivraisonPrevue).map(l => {
              const retard = U.fromISO(l.dateLivraisonPrevue) < U.fromISO(today);
              return `<div class="list-line" style="padding-left:0;padding-right:0">
                <div class="ll-main"><b>${U.esc(l.type)}</b><span>${U.esc(Data.patientNom(l.patientId))} · ${U.esc((Data.fournisseur(l.laboId) || {}).nom || '')}</span></div>
                <div class="right">${UI.badge(retard ? 'Retard' : (l.statut === 'a_envoyer' ? 'À envoyer' : 'En cours'), retard ? 'bad' : (l.statut === 'a_envoyer' ? 'warn' : 'info'))}
                <div class="muted" style="font-size:11.5px;margin-top:2px">${U.fmtDate(l.dateLivraisonPrevue)}</div></div>
              </div>`;
            }).join('')}</div>`
          : `<p class="muted">Aucun travail en cours au laboratoire.</p>`,
        { cls: '', actions: `<button class="btn btn-sm" data-act="labo">Ouvrir</button>` })}</div>` : ''}

      ${Perm.can('facture.view') ? `<div class="c6">${UI.card('Derniers règlements',
        DB.paiements.length
          ? `<div class="col" style="gap:0">${U.sortBy(DB.paiements, p => p.date, 'desc').slice(0, 6).map(p => `
              <div class="list-line" style="padding-left:0;padding-right:0">
                <div class="ll-main"><b>${U.esc(Data.patientNom(p.patientId))}</b><span>${U.fmtDate(p.date)} · ${MODES_PAIEMENT[p.mode] || p.mode}</span></div>
                <div class="num" style="font-weight:650;font-variant-numeric:tabular-nums">${U.money(p.montant)}</div>
              </div>`).join('')}</div>`
          : `<p class="muted">Aucun règlement enregistré.</p>`,
        { actions: `<button class="btn btn-sm" data-act="factures">Ouvrir</button>` })}</div>` : ''}

      ${graph ? `<div class="c12">${graph}</div>` : ''}
    </div>`;
};

Views.dashboardMount = function () {
  Bind.click(e => {
    const a = e.target.closest('[data-act]');
    if (a) {
      const k = a.dataset.act;
      if (k === 'new-rdv') Views.rdvDialog(null, U.todayISO());
      if (k === 'new-patient') Views.patientDialog(null);
      if (k === 'new-facture') Views.factureDialog(null, 'facture');
      if (k === 'new-paiement') Views.paiementDialog(null);
      if (k === 'agenda') location.hash = '#/agenda';
      if (k === 'labo') location.hash = '#/labo';
      if (k === 'factures') location.hash = '#/factures';
      if (k === 'all-alerts') Views.alertsPanel();
      return;
    }
    const al = e.target.closest('[data-alert]');
    if (al) { location.hash = Alerts.visible()[Number(al.dataset.alert)].route; return; }
    const r = e.target.closest('[data-rdv]');
    if (r) Views.rdvDialog(r.dataset.rdv);
  });
};

/* ============================================================ Agenda ======== */

Views.agenda = function () {
  const today = U.todayISO();
  const cab = DB.cabinet;
  const ref = U.fromISO(S.agendaDate);
  const dow = ref.getDay();
  const monday = U.addDays(S.agendaDate, dow === 0 ? -6 : 1 - dow);
  const jours = (cab.joursOuvres || [1, 2, 3, 4, 5, 6]).length;
  const days = [];
  for (let i = 0; i < 6; i++) days.push(U.addDays(monday, i));

  const h0 = U.hmToMinutes(cab.heureDebut || '08:30');
  const h1 = U.hmToMinutes(cab.heureFin || '18:30');
  const slots = [];
  for (let t = Math.floor(h0 / 60) * 60; t < h1; t += 30) slots.push(t);

  const semaineRdv = DB.rdv.filter(r => r.date >= days[0] && r.date <= days[5]);

  const head = `
    <div class="page-head">
      <div class="titles">
        <h1>Agenda</h1>
        <p>${S.agendaVue === 'semaine'
            ? `Semaine du ${U.fmtDate(days[0])} au ${U.fmtDate(days[5])} — ${semaineRdv.filter(r => r.statut !== 'annule').length} rendez-vous`
            : U.fmtDateLong(S.agendaDate).charAt(0).toUpperCase() + U.fmtDateLong(S.agendaDate).slice(1)}</p>
      </div>
      <div class="page-actions">
        <div class="btn-group">
          <button class="${S.agendaVue === 'jour' ? 'is-on' : ''}" data-vue="jour" type="button">Jour</button>
          <button class="${S.agendaVue === 'semaine' ? 'is-on' : ''}" data-vue="semaine" type="button">Semaine</button>
        </div>
        <button class="btn btn-icon" data-nav="-1" type="button" aria-label="Précédent" style="transform:rotate(180deg)">${Icons.chevron}</button>
        <button class="btn" data-nav="0" type="button">Aujourd'hui</button>
        <button class="btn btn-icon" data-nav="1" type="button" aria-label="Suivant">${Icons.chevron}</button>
        <input class="input" type="date" value="${S.agendaDate}" data-date style="width:auto">
        ${Perm.can('agenda.edit') ? `<button class="btn btn-primary" data-act="new-rdv">${Icons.plus} Rendez-vous</button>` : ''}
      </div>
    </div>`;

  const legend = `<div class="legend-dots" style="padding:12px 16px;border-top:1px solid var(--line)">
    ${Object.entries(STATUT_RDV).map(([k, v]) => `<span><i style="background:${
      { prevu: 'var(--ink-mute)', confirme: 'var(--ok)', attente: 'var(--info)', fauteuil: 'var(--accent)',
        termine: 'var(--ink-mute)', absent: 'var(--bad)', annule: 'var(--ink-mute)' }[k]}"></i>${v[0]}</span>`).join('')}
  </div>`;

  if (S.agendaVue === 'jour') {
    const list = U.sortBy(DB.rdv.filter(r => r.date === S.agendaDate), r => r.heure);
    return head + `<div class="grid">
      <div class="c8">${UI.card(U.fmtDateLong(S.agendaDate),
        list.length ? `<div class="timeline">${list.map(r => {
          const p = Data.patient(r.patientId);
          const st = STATUT_RDV[r.statut] || ['—', ''];
          const acte = Data.acte(r.acteId);
          return `<div class="tl-row" data-rdv="${r.id}">
            <div class="tl-time">${r.heure}<small>${r.duree} min</small></div>
            <div class="tl-main">
              <div class="row" style="justify-content:space-between">
                <b>${p ? U.esc(p.prenom + ' ' + p.nom) : '—'}</b>${UI.badge(st[0], st[1])}
              </div>
              <p>${U.esc(r.motif)}${acte ? ` · ${U.money(acte.prix)}` : ''}${p ? ` · ${U.tel(p.tel)}` : ''}</p>
            </div>
          </div>`;
        }).join('')}</div>` : UI.empty('Journée libre', 'Aucun rendez-vous ce jour.'),
        { flush: true, foot: `<span class="muted">${list.filter(r => r.statut !== 'annule').length} rendez-vous · ${U.sum(list.filter(r => r.statut !== 'annule'), r => r.duree)} minutes de fauteuil</span>` })}</div>
      <div class="c4">${Views._miniCal()}${Views._jourResume(S.agendaDate)}</div>
    </div>`;
  }

  /* Vue semaine */
  const cells = [];
  slots.forEach(t => {
    cells.push(`<div class="ag-hour">${U.minutesToHM(t)}</div>`);
    days.forEach(d => {
      const isSat = U.fromISO(d).getDay() === 6;
      const finJour = isSat ? U.hmToMinutes(cab.samediFin || '13:00') : h1;
      const pause = t >= U.hmToMinutes(cab.pauseDebut || '13:00') && t < U.hmToMinutes(cab.pauseFin || '14:00') && !isSat;
      const off = t < h0 || t >= finJour || pause;
      const items = semaineRdv.filter(r => r.date === d && U.hmToMinutes(r.heure) >= t && U.hmToMinutes(r.heure) < t + 30);
      cells.push(`<div class="ag-cell ${off ? 'is-off' : ''}" ${off ? '' : `data-slot="${d}|${U.minutesToHM(t)}"`}>
        ${items.map(r => {
          const p = Data.patient(r.patientId);
          return `<div class="ag-appt s-${r.statut}" data-rdv="${r.id}" title="${U.esc(r.heure + ' · ' + Data.patientNom(r.patientId) + ' · ' + r.motif)}">
            <b>${p ? U.esc(p.prenom.charAt(0) + '. ' + p.nom) : '—'}</b><span>${U.esc(r.motif)}</span></div>`;
        }).join('')}
      </div>`);
    });
  });

  return head + `<div class="card">
    <div class="table-wrap">
      <div class="agenda-grid" style="--days:6;min-width:820px">
        <div class="ag-corner"></div>
        ${days.map(d => {
          const dd = U.fromISO(d);
          const n = semaineRdv.filter(r => r.date === d && r.statut !== 'annule').length;
          return `<div class="ag-daycol-head ${d === today ? 'is-today' : ''}">
            <span>${dd.toLocaleDateString('fr-FR', { weekday: 'short' })}</span>
            <b>${dd.getDate()}/${String(dd.getMonth() + 1).padStart(2, '0')}</b>
            <span style="font-size:10px">${n} rdv</span>
          </div>`;
        }).join('')}
        ${cells.join('')}
      </div>
    </div>
    ${legend}
  </div>`;
};

Views._miniCal = function () {
  const ref = U.fromISO(S.agendaDate);
  const y = ref.getFullYear(), m = ref.getMonth();
  const first = new Date(y, m, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const iso = U.toISO(d);
    const has = DB.rdv.some(r => r.date === iso && r.statut !== 'annule');
    cells.push(`<button type="button" data-day="${iso}" class="${d.getMonth() !== m ? 'is-out' : ''} ${iso === S.agendaDate ? 'is-sel' : ''} ${has ? 'has-rdv' : ''}">${d.getDate()}</button>`);
  }
  return UI.card(first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    `<div class="mini-cal">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => `<div class="mc-h">${d}</div>`).join('')}${cells.join('')}</div>`,
    { cls: '' });
};

Views._jourResume = function (date) {
  const list = DB.rdv.filter(r => r.date === date && r.statut !== 'annule');
  const enc = U.sum(DB.paiements.filter(p => p.date === date), p => p.montant);
  return `<div style="margin-top:var(--gap)">${UI.card('Résumé du jour', `<dl class="dl">
    <dt>Rendez-vous</dt><dd class="num">${list.length}</dd>
    <dt>Temps de fauteuil</dt><dd class="num">${Math.floor(U.sum(list, r => r.duree) / 60)} h ${U.sum(list, r => r.duree) % 60} min</dd>
    <dt>Terminés</dt><dd class="num">${list.filter(r => r.statut === 'termine').length}</dd>
    <dt>Absents</dt><dd class="num">${list.filter(r => r.statut === 'absent').length}</dd>
    ${Perm.can('caisse.view') ? `<dt>Encaissé</dt><dd class="num">${U.money(enc)}</dd>` : ''}
  </dl>`)}</div>`;
};

Views.agendaMount = function () {
  Bind.click(e => {
    const v = e.target.closest('[data-vue]');
    if (v) { S.agendaVue = v.dataset.vue; App.render(); return; }
    const n = e.target.closest('[data-nav]');
    if (n) {
      const d = Number(n.dataset.nav);
      S.agendaDate = d === 0 ? U.todayISO() : U.addDays(S.agendaDate, d * (S.agendaVue === 'semaine' ? 7 : 1));
      App.render(); return;
    }
    const day = e.target.closest('[data-day]');
    if (day) { S.agendaDate = day.dataset.day; S.agendaVue = 'jour'; App.render(); return; }
    const r = e.target.closest('[data-rdv]');
    if (r) { Views.rdvDialog(r.dataset.rdv); return; }
    const s = e.target.closest('[data-slot]');
    if (s && Perm.can('agenda.edit')) {
      const [d, h] = s.dataset.slot.split('|');
      Views.rdvDialog(null, d, h); return;
    }
    if (e.target.closest('[data-act="new-rdv"]')) Views.rdvDialog(null, S.agendaDate);
  });
  Bind.change(e => {
    if (e.target.matches('[data-date]')) { S.agendaDate = e.target.value; App.render(); }
  });
};

/* ---- Dialogue rendez-vous ---- */
Views.rdvDialog = function (id, date, heure, pid) {
  const r = id ? DB.rdv.find(x => x.id === id) : null;
  const ro = !Perm.can('agenda.edit');
  const p = r ? Data.patient(r.patientId) : (pid ? Data.patient(pid) : null);

  const body = `<form id="rdvForm">
    <div class="form-grid">
      <div class="field full">
        <label for="f_patientId">Patient *</label>
        <select class="select" id="f_patientId" name="patientId" required>
          <option value="">— Choisir un patient —</option>
          ${UI.patientOptions(r ? r.patientId : (pid || ''))}
        </select>
      </div>
      ${UI.field({ label: 'Date', name: 'date', type: 'date', value: r ? r.date : (date || U.todayISO()), required: true })}
      ${UI.field({ label: 'Heure', name: 'heure', type: 'time', value: r ? r.heure : (heure || '09:00'), required: true })}
      ${UI.field({ label: 'Durée (minutes)', name: 'duree', type: 'number', value: r ? r.duree : DB.cabinet.dureeRdvDefaut, min: 10, step: 5, required: true })}
      ${UI.field({ label: 'Acte prévu', name: 'acteId', type: 'select', value: r ? r.acteId : '',
        options: [['', '— Non précisé —']].concat(DB.actes.filter(a => a.actif).map(a => [a.id, `${a.code} · ${a.libelle} (${U.money(a.prix)})`])) })}
      ${UI.field({ label: 'Motif', name: 'motif', value: r ? r.motif : '', full: true, placeholder: 'Détartrage, contrôle, urgence…', required: true })}
      ${UI.field({ label: 'Statut', name: 'statut', type: 'select', value: r ? r.statut : 'prevu',
        options: Object.entries(STATUT_RDV).map(([k, v]) => [k, v[0]]) })}
      ${UI.field({ label: 'Rappel envoyé', name: 'rappelEnvoye', type: 'checkbox', value: r ? r.rappelEnvoye : false })}
      ${UI.field({ label: 'Note interne', name: 'note', type: 'textarea', value: r ? r.note : '', full: true, rows: 2 })}
    </div>
    ${p && p.medical && ((p.medical.allergies || []).length || p.medical.notes) ? `
      <div class="alert-band" style="margin-top:16px">${Icons.alert}<span>
        ${(p.medical.allergies || []).length ? `<b>Allergies : ${U.esc(p.medical.allergies.join(', '))}</b><br>` : ''}
        ${p.medical.notes ? U.esc(p.medical.notes) : ''}</span></div>` : ''}
  </form>`;

  const actions = r && !ro ? `
    <button class="btn btn-sm" data-statut="confirme" type="button">Confirmer</button>
    <button class="btn btn-sm" data-statut="termine" type="button">Terminé</button>
    <button class="btn btn-sm" data-statut="absent" type="button">Absent</button>` : '';

  UI.modal({
    titre: r ? 'Rendez-vous' : 'Nouveau rendez-vous',
    sous: r ? `${Data.patientNom(r.patientId)} — ${U.fmtDate(r.date)} à ${r.heure}` : '',
    size: 'lg', body,
    foot: `<div class="left row" style="gap:6px">
        ${r && !ro ? `<button class="btn btn-sm btn-ghost" data-del type="button" style="color:var(--bad)">${Icons.trash} Supprimer</button>` : ''}
        ${r ? `<button class="btn btn-sm" data-sms type="button">${Icons.sms} Rappel</button>` : ''}
        ${r && Perm.can('patients.view') ? `<button class="btn btn-sm" data-fiche type="button">${Icons.user} Fiche</button>` : ''}
        ${actions}
      </div>
      <button class="btn" data-close type="button">Fermer</button>
      ${ro ? '' : `<button class="btn btn-primary" data-save type="button">${r ? 'Enregistrer' : 'Créer le rendez-vous'}</button>`}`,
    onMount(ov) {
      const form = ov.querySelector('#rdvForm');
      if (ro) U.$$('input,select,textarea', form).forEach(i => { i.disabled = true; });

      form.acteId.addEventListener('change', () => {
        const a = Data.acte(form.acteId.value);
        if (a) { form.duree.value = a.dureeMin; if (!form.motif.value) form.motif.value = a.libelle; }
      });

      const save = () => {
        const v = UI.formValues(form);
        if (!v.patientId) return UI.toast('Patient requis', 'Sélectionnez le patient concerné.', 'bad');
        if (!v.motif) return UI.toast('Motif requis', '', 'bad');
        const rec = r || { id: U.uid('rdv'), createdAt: Date.now(), praticien: 'usr_sarra' };
        Object.assign(rec, {
          patientId: v.patientId, date: v.date, heure: v.heure, duree: Number(v.duree) || 30,
          motif: v.motif, acteId: v.acteId || null, statut: v.statut, note: v.note,
          rappelEnvoye: !!v.rappelEnvoye,
        });
        if (!r) DB.rdv.push(rec);
        Audit.log(r ? 'modification' : 'creation', 'rendez-vous', rec.id, `${Data.patientNom(rec.patientId)} — ${U.fmtDate(rec.date)} ${rec.heure}`);
        Data.commit();
        UI.close(ov);
        UI.toast(r ? 'Rendez-vous mis à jour' : 'Rendez-vous créé', `${Data.patientNom(rec.patientId)} — ${U.fmtDate(rec.date)} à ${rec.heure}`, 'ok');
      };

      ov.addEventListener('click', async e => {
        if (e.target.closest('[data-save]')) return save();
        const st = e.target.closest('[data-statut]');
        if (st) { form.statut.value = st.dataset.statut; return save(); }
        if (e.target.closest('[data-fiche]')) { UI.close(ov); location.hash = '#/patient/' + r.patientId; return; }
        if (e.target.closest('[data-sms]')) { UI.close(ov); Views.rappelDialog(r); return; }
        if (e.target.closest('[data-del]')) {
          const ok = await UI.confirm('Supprimer ce rendez-vous ?', 'Le créneau sera libéré. Cette action est enregistrée dans le journal.', { danger: true, ok: 'Supprimer' });
          if (!ok) return;
          DB.rdv = DB.rdv.filter(x => x.id !== r.id);
          Audit.log('suppression', 'rendez-vous', r.id, `${Data.patientNom(r.patientId)} — ${U.fmtDate(r.date)}`);
          Data.commit(); UI.close(ov);
          UI.toast('Rendez-vous supprimé', '', 'ok');
        }
      });
    },
  });
};

Views.rappelDialog = function (r) {
  const p = Data.patient(r.patientId);
  const texte = (DB.cabinet.rappelSms || '')
    .replace('{prenom}', p ? p.prenom : '')
    .replace('{date}', U.fmtDate(r.date))
    .replace('{heure}', r.heure)
    .replace('{tel}', DB.cabinet.tel);
  UI.modal({
    titre: 'Rappel de rendez-vous', sous: p ? `${p.prenom} ${p.nom} — ${U.tel(p.tel)}` : '',
    size: 'sm',
    body: `<div class="field"><label>Message</label><textarea class="textarea" id="smsTxt" rows="5">${U.esc(texte)}</textarea>
      <span class="hint">Copiez le message puis envoyez-le par SMS ou WhatsApp depuis votre téléphone. Le modèle se règle dans Paramètres.</span></div>`,
    foot: `<button class="btn" data-close type="button">Fermer</button>
           <button class="btn" data-copy type="button">${Icons.copy} Copier</button>
           <button class="btn btn-primary" data-done type="button">Marquer comme envoyé</button>`,
    onMount(ov) {
      ov.addEventListener('click', e => {
        if (e.target.closest('[data-copy]')) {
          const t = ov.querySelector('#smsTxt');
          t.select();
          try { navigator.clipboard.writeText(t.value); } catch (err) { document.execCommand('copy'); }
          UI.toast('Message copié', '', 'ok');
        }
        if (e.target.closest('[data-done]')) {
          r.rappelEnvoye = true;
          Audit.log('rappel', 'rendez-vous', r.id, 'Rappel marqué comme envoyé');
          Data.commit(); UI.close(ov); UI.toast('Rappel noté', '', 'ok');
        }
      });
    },
  });
};

/* ========================================================== Patients ======== */

Views.patients = function () {
  const f = S.filtres.patients || (S.filtres.patients = { q: '', assur: '', tri: 'nom', archives: false });
  let list = DB.patients.filter(p => f.archives ? true : !p.archived);
  if (f.q) {
    const t = U.norm(f.q);
    list = list.filter(p => U.norm(p.nom + ' ' + p.prenom + ' ' + p.code + ' ' + p.tel + ' ' + (p.cin || '') + ' ' + p.ville).includes(t));
  }
  if (f.assur) list = list.filter(p => p.assurance.type === f.assur);
  list = f.tri === 'recent' ? U.sortBy(list, p => p.createdAt, 'desc')
       : f.tri === 'solde' ? U.sortBy(list, p => Data.soldePatient(p.id), 'desc')
       : U.sortBy(list, p => U.norm(p.nom + p.prenom));

  const rows = list.map(p => {
    const solde = Data.soldePatient(p.id);
    const dernier = U.sortBy(DB.rdv.filter(r => r.patientId === p.id && r.date <= U.todayISO()), r => r.date, 'desc')[0];
    const prochain = U.sortBy(DB.rdv.filter(r => r.patientId === p.id && r.date > U.todayISO() && r.statut !== 'annule'), r => r.date)[0];
    const alerte = (p.medical && ((p.medical.allergies || []).length || p.medical.notes)) ? true : false;
    return `<tr class="clickable" data-pat="${p.id}">
      <td>
        <div class="row" style="gap:9px">
          <span class="avatar" style="background:var(--accent-wash);color:var(--accent);font-size:11px">${U.initials(p.nom, p.prenom)}</span>
          <span><span class="cell-strong">${U.esc(p.prenom)} ${U.esc(p.nom)}</span>
          <span class="cell-sub">${U.esc(p.code)} · ${p.dateNaissance ? U.age(p.dateNaissance) + ' ans' : 'âge inconnu'} · ${p.sexe === 'F' ? 'F' : 'M'}</span></span>
          ${alerte ? `<span title="Antécédents médicaux à vérifier" style="color:var(--bad);width:15px;height:15px">${Icons.alert}</span>` : ''}
        </div>
      </td>
      <td class="mono">${U.esc(U.tel(p.tel))}</td>
      <td>${p.assurance.type === 'cnam' ? UI.badge('CNAM', 'info')
           : p.assurance.type === 'privee' ? UI.badge(p.assurance.organisme || 'Privée', 'accent') : UI.badge('Sans', '', true)}</td>
      <td class="nowrap">${dernier ? U.fmtDate(dernier.date) : '<span class="muted">—</span>'}</td>
      <td class="nowrap">${prochain ? `<b>${U.fmtDate(prochain.date)}</b> <span class="muted">${prochain.heure}</span>` : '<span class="muted">—</span>'}</td>
      <td class="num">${solde > 0.001 ? `<b style="color:var(--warn)">${U.money(solde)}</b>` : '<span class="muted">—</span>'}</td>
    </tr>`;
  }).join('');

  return `
    <div class="page-head">
      <div class="titles"><h1>Patients</h1>
        <p>${list.length} patient(s) affiché(s) sur ${DB.patients.filter(p => !p.archived).length} actifs</p></div>
      <div class="page-actions">
        ${Perm.can('patients.edit') ? `<button class="btn btn-primary" data-act="new">${Icons.plus} Nouveau patient</button>` : ''}
      </div>
    </div>

    <div class="card">
      <div class="tbl-toolbar">
        <input class="input search" data-f="q" placeholder="Nom, code, téléphone, CIN…" value="${U.esc(f.q)}" type="search">
        <select class="select" data-f="assur">
          <option value="">Toutes couvertures</option>
          <option value="cnam"${f.assur === 'cnam' ? ' selected' : ''}>CNAM</option>
          <option value="privee"${f.assur === 'privee' ? ' selected' : ''}>Assurance privée</option>
          <option value="aucune"${f.assur === 'aucune' ? ' selected' : ''}>Sans couverture</option>
        </select>
        <select class="select" data-f="tri">
          <option value="nom"${f.tri === 'nom' ? ' selected' : ''}>Trier par nom</option>
          <option value="recent"${f.tri === 'recent' ? ' selected' : ''}>Plus récents</option>
          <option value="solde"${f.tri === 'solde' ? ' selected' : ''}>Solde dû</option>
        </select>
        <label class="check" style="margin-left:auto"><input type="checkbox" data-f="archives"${f.archives ? ' checked' : ''}><span>Inclure les archivés</span></label>
      </div>
      <div class="table-wrap">
        ${list.length ? `<table class="tbl">
          <thead><tr>
            <th>Patient</th><th>Téléphone</th><th>Couverture</th>
            <th>Dernière visite</th><th>Prochain RDV</th><th class="num">Solde dû</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>` : UI.empty('Aucun patient', 'Aucune fiche ne correspond à ces critères.')}
      </div>
    </div>`;
};

Views.patientsMount = function () {
  const f = S.filtres.patients;
  Bind.click(e => {
    if (e.target.closest('[data-act="new"]')) return Views.patientDialog(null);
    const r = e.target.closest('[data-pat]');
    if (r) location.hash = '#/patient/' + r.dataset.pat;
  });
  const upd = e => {
    const k = e.target.dataset.f;
    if (!k) return;
    f[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    App.render();
    if (k === 'q') { const i = U.$('[data-f="q"]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
  };
  Bind.change(upd);
  Bind.input(U.debounce(e => { if (e.target.dataset.f === 'q') upd(e); }, 260));
};

/* ---- Fiche patient : création / édition ---- */
Views.patientDialog = function (id) {
  const p = id ? Data.patient(id) : null;
  const a = p ? p.assurance : { type: 'cnam', numero: '', regime: 'Remboursement des frais' };
  const m = p ? p.medical : {};

  UI.modal({
    titre: p ? 'Modifier la fiche' : 'Nouveau patient',
    sous: p ? `${p.prenom} ${p.nom} — ${p.code}` : 'Les champs marqués d\'une étoile sont obligatoires',
    size: 'lg',
    body: `<form id="patForm">
      <fieldset class="form-block"><legend>Identité</legend>
        <div class="form-grid">
          ${UI.field({ label: 'Nom', name: 'nom', value: p ? p.nom : '', required: true })}
          ${UI.field({ label: 'Prénom', name: 'prenom', value: p ? p.prenom : '', required: true })}
          ${UI.field({ label: 'Sexe', name: 'sexe', type: 'select', value: p ? p.sexe : 'F', options: [['F', 'Féminin'], ['M', 'Masculin']] })}
          ${UI.field({ label: 'Date de naissance', name: 'dateNaissance', type: 'date', value: p ? p.dateNaissance : '' })}
          ${UI.field({ label: 'CIN', name: 'cin', value: p ? p.cin : '', placeholder: '8 chiffres' })}
          ${UI.field({ label: 'Profession', name: 'profession', value: p ? p.profession : '' })}
        </div>
      </fieldset>

      <fieldset class="form-block"><legend>Coordonnées</legend>
        <div class="form-grid">
          ${UI.field({ label: 'Téléphone', name: 'tel', value: p ? p.tel : '', placeholder: '+216 XX XXX XXX', required: true })}
          ${UI.field({ label: 'Second numéro', name: 'tel2', value: p ? p.tel2 : '' })}
          ${UI.field({ label: 'Courriel', name: 'email', type: 'email', value: p ? p.email : '' })}
          ${UI.field({ label: 'Ville / délégation', name: 'ville', value: p ? p.ville : '' })}
          ${UI.field({ label: 'Adresse', name: 'adresse', value: p ? p.adresse : '', full: true })}
        </div>
      </fieldset>

      <fieldset class="form-block"><legend>Couverture sociale</legend>
        <div class="form-grid">
          ${UI.field({ label: 'Type', name: 'assurType', type: 'select', value: a.type,
            options: [['cnam', 'CNAM'], ['privee', 'Assurance privée'], ['aucune', 'Aucune']] })}
          ${UI.field({ label: 'Numéro d\'affiliation', name: 'assurNum', value: a.numero || '' })}
          ${UI.field({ label: 'Régime / organisme', name: 'assurRegime', value: a.regime || a.organisme || '', full: true,
            hint: 'CNAM : remboursement des frais, filière publique ou médecin de famille.' })}
        </div>
      </fieldset>

      <fieldset class="form-block"><legend>Dossier médical</legend>
        <div class="form-grid">
          ${UI.field({ label: 'Allergies (séparées par des virgules)', name: 'allergies', value: (m.allergies || []).join(', '), full: true, placeholder: 'Pénicilline, latex…' })}
          ${UI.field({ label: 'Antécédents / pathologies', name: 'pathologies', value: (m.pathologies || []).join(', '), full: true, placeholder: 'Diabète, hypertension, cardiopathie…' })}
          ${UI.field({ label: 'Traitements en cours', name: 'traitements', value: m.traitements || '', full: true })}
          ${UI.field({ label: 'Groupe sanguin', name: 'groupeSanguin', value: m.groupeSanguin || '' })}
          <div class="col" style="gap:8px;justify-content:center">
            ${UI.field({ label: 'Patient fumeur', name: 'tabac', type: 'checkbox', value: !!m.tabac })}
            ${UI.field({ label: 'Grossesse en cours', name: 'grossesse', type: 'checkbox', value: !!m.grossesse })}
          </div>
          ${UI.field({ label: 'Précautions et remarques cliniques', name: 'mnotes', type: 'textarea', value: m.notes || '', full: true, rows: 2,
            hint: 'Ce texte apparaît en alerte à chaque ouverture du dossier et sur les rendez-vous.' })}
        </div>
      </fieldset>
    </form>`,
    foot: `<button class="btn" data-close type="button">Annuler</button>
           <button class="btn btn-primary" data-save type="button">${p ? 'Enregistrer' : 'Créer la fiche'}</button>`,
    onMount(ov) {
      ov.addEventListener('click', e => {
        if (!e.target.closest('[data-save]')) return;
        const form = ov.querySelector('#patForm');
        const v = UI.formValues(form);
        if (!v.nom || !v.prenom || !v.tel) return UI.toast('Champs obligatoires', 'Nom, prénom et téléphone sont requis.', 'bad');

        const rec = p || {
          id: U.uid('pat'), code: 'P-' + String(Data.nextSeq('patient')).padStart(4, '0'),
          createdAt: Date.now(), createdBy: Auth.current.id, archived: false, tags: [], notes: '',
          premiereVisite: U.todayISO(),
        };
        Object.assign(rec, {
          nom: v.nom.trim(), prenom: v.prenom.trim(), sexe: v.sexe, dateNaissance: v.dateNaissance,
          cin: v.cin, profession: v.profession, tel: v.tel, tel2: v.tel2, email: v.email,
          ville: v.ville, adresse: v.adresse,
          assurance: {
            type: v.assurType,
            numero: v.assurNum,
            regime: v.assurType === 'cnam' ? v.assurRegime : '',
            organisme: v.assurType === 'privee' ? v.assurRegime : '',
            plafondSoins: 150, consommeSoins: (p && p.assurance.consommeSoins) || 0,
          },
          medical: {
            allergies: v.allergies ? v.allergies.split(',').map(s => s.trim()).filter(Boolean) : [],
            pathologies: v.pathologies ? v.pathologies.split(',').map(s => s.trim()).filter(Boolean) : [],
            traitements: v.traitements, groupeSanguin: v.groupeSanguin,
            tabac: !!v.tabac, grossesse: !!v.grossesse, notes: v.mnotes,
          },
        });
        if (!p) DB.patients.push(rec);
        Audit.log(p ? 'modification' : 'creation', 'patient', rec.id, `${rec.prenom} ${rec.nom} (${rec.code})`);
        Data.commit();
        UI.close(ov);
        UI.toast(p ? 'Fiche enregistrée' : 'Patient créé', `${rec.prenom} ${rec.nom} — ${rec.code}`, 'ok');
        if (!p) location.hash = '#/patient/' + rec.id;
      });
    },
  });
};

/* ==================================================== Dossier patient ======= */

Views.patient = function (id) {
  const g = Perm.guard('patients.view'); if (g) return g;
  const p = Data.patient(id);
  if (!p) return UI.empty('Patient introuvable', 'Cette fiche a peut-être été supprimée.');

  const solde = Data.soldePatient(p.id);
  const totalPaye = Data.caPatient(p.id);
  const soins = DB.soins.filter(s => s.patientId === p.id);
  const rdvs = DB.rdv.filter(r => r.patientId === p.id);
  const factures = DB.factures.filter(f => f.patientId === p.id);
  const alertes = [];
  if ((p.medical.allergies || []).length) alertes.push(`<b>Allergies :</b> ${U.esc(p.medical.allergies.join(', '))}`);
  if ((p.medical.pathologies || []).length) alertes.push(`<b>Antécédents :</b> ${U.esc(p.medical.pathologies.join(', '))}`);
  if (p.medical.traitements) alertes.push(`<b>Traitement en cours :</b> ${U.esc(p.medical.traitements)}`);
  if (p.medical.grossesse) alertes.push('<b>Grossesse en cours</b> — éviter radiographies et vasoconstricteurs.');
  if (p.medical.notes) alertes.push(U.esc(p.medical.notes));

  const tabs = [
    ['dossier', 'Dossier', null],
    ['odonto', 'Odontogramme', 'clinique.view'],
    ['soins', 'Traitements', 'clinique.view', soins.length],
    ['rdv', 'Rendez-vous', 'agenda.view', rdvs.length],
    ['finances', 'Finances', 'facture.view', factures.length],
    ['docs', 'Documents', null, DB.ordonnances.filter(o => o.patientId === p.id).length + DB.documents.filter(d => d.patientId === p.id).length],
  ].filter(t => !t[2] || Perm.can(t[2]));

  if (!tabs.some(t => t[0] === S.patientTab)) S.patientTab = 'dossier';

  return `
    <div class="page-head no-print">
      <div class="titles">
        <button class="btn btn-sm btn-ghost" data-act="back" type="button" style="margin-bottom:6px;transform:none">
          <span style="transform:rotate(180deg);display:inline-flex">${Icons.chevron}</span> Tous les patients</button>
      </div>
      <div class="page-actions">
        ${Perm.can('agenda.edit') ? `<button class="btn" data-act="rdv">${Icons.calendar} Rendez-vous</button>` : ''}
        ${Perm.can('facture.edit') ? `<button class="btn" data-act="facture">${Icons.receipt} Facture</button>` : ''}
        ${Perm.can('ordonnance.create') ? `<button class="btn" data-act="ordo">${Icons.doc} Ordonnance</button>` : ''}
        ${Perm.can('patients.edit') ? `<button class="btn btn-primary" data-act="edit">${Icons.edit} Modifier</button>` : ''}
        <button class="btn btn-icon" data-act="more" type="button" aria-label="Autres actions">⋯</button>
      </div>
    </div>

    <div class="pat-head">
      <div class="pat-avatar">${U.initials(p.nom, p.prenom)}</div>
      <div class="pat-id">
        <h1>${U.esc(p.prenom)} ${U.esc(p.nom)}${p.archived ? ' <span class="badge b-bad">Archivé</span>' : ''}</h1>
        <div class="pat-meta">
          <span><b>${U.esc(p.code)}</b></span>
          <span>${p.dateNaissance ? `${U.age(p.dateNaissance)} ans (${U.fmtDate(p.dateNaissance)})` : 'Date de naissance non renseignée'}</span>
          <span>${p.sexe === 'F' ? 'Femme' : 'Homme'}</span>
          ${p.cin ? `<span>CIN ${U.esc(p.cin)}</span>` : ''}
          <span>${Icons.phone.replace('<svg', '<svg style="width:13px;height:13px;vertical-align:-2px"')} ${U.esc(U.tel(p.tel))}</span>
          ${p.email ? `<span>${U.esc(p.email)}</span>` : ''}
          ${p.ville ? `<span>${U.esc(p.ville)}</span>` : ''}
          <span>${p.assurance.type === 'cnam' ? `CNAM ${U.esc(p.assurance.numero || '')}`
                : p.assurance.type === 'privee' ? U.esc(p.assurance.organisme || 'Assurance privée') : 'Sans couverture'}</span>
        </div>
      </div>
      <div class="pat-stats">
        <div><div class="v">${rdvs.filter(r => r.statut === 'termine').length}</div><div class="l">Séances</div></div>
        ${Perm.can('facture.view') ? `
        <div><div class="v">${U.money(totalPaye, false)}</div><div class="l">Réglé</div></div>
        <div><div class="v" style="color:${solde > 0.001 ? 'var(--warn)' : 'var(--ok)'}">${U.money(solde, false)}</div><div class="l">Solde dû</div></div>` : ''}
      </div>
    </div>

    ${alertes.length ? `<div class="alert-band" style="margin-bottom:var(--gap)">${Icons.alert}
      <span>${alertes.join('<br>')}</span></div>` : ''}

    <div class="card" style="margin-bottom:var(--gap)">
      <div class="tabs">${tabs.map(t =>
        `<button data-tab="${t[0]}" class="${S.patientTab === t[0] ? 'is-on' : ''}" type="button">${U.esc(t[1])}${t[3] ? `<span class="count">${t[3]}</span>` : ''}</button>`).join('')}</div>
    </div>

    <div id="patTab">${Views['_pat_' + S.patientTab](p)}</div>`;
};

/* ---- Onglet : dossier ---- */
Views._pat_dossier = function (p) {
  const prochain = U.sortBy(DB.rdv.filter(r => r.patientId === p.id && r.date >= U.todayISO() && r.statut !== 'annule'), r => r.date)[0];
  return `<div class="grid">
    <div class="c6">${UI.card('Identité et coordonnées', `<dl class="dl">
      <dt>Code dossier</dt><dd class="mono">${U.esc(p.code)}</dd>
      <dt>Nom complet</dt><dd>${U.esc(p.prenom + ' ' + p.nom)}</dd>
      <dt>Date de naissance</dt><dd>${p.dateNaissance ? U.fmtDate(p.dateNaissance) + ` (${U.age(p.dateNaissance)} ans)` : '—'}</dd>
      <dt>CIN</dt><dd class="mono">${U.esc(p.cin || '—')}</dd>
      <dt>Profession</dt><dd>${U.esc(p.profession || '—')}</dd>
      <dt>Téléphone</dt><dd class="mono">${U.esc(U.tel(p.tel))}${p.tel2 ? ' · ' + U.esc(U.tel(p.tel2)) : ''}</dd>
      <dt>Courriel</dt><dd>${U.esc(p.email || '—')}</dd>
      <dt>Adresse</dt><dd>${U.esc([p.adresse, p.ville].filter(Boolean).join(', ') || '—')}</dd>
      <dt>Patient depuis</dt><dd>${U.fmtDate(p.premiereVisite || U.toISO(new Date(p.createdAt)))}</dd>
    </dl>`)}</div>

    <div class="c6">${UI.card('Dossier médical', `<dl class="dl">
      <dt>Allergies</dt><dd>${(p.medical.allergies || []).length ? `<span style="color:var(--bad);font-weight:600">${U.esc(p.medical.allergies.join(', '))}</span>` : 'Aucune connue'}</dd>
      <dt>Antécédents</dt><dd>${U.esc((p.medical.pathologies || []).join(', ') || 'Aucun')}</dd>
      <dt>Traitements</dt><dd>${U.esc(p.medical.traitements || '—')}</dd>
      <dt>Groupe sanguin</dt><dd>${U.esc(p.medical.groupeSanguin || '—')}</dd>
      <dt>Tabac</dt><dd>${p.medical.tabac ? 'Oui' : 'Non'}</dd>
      <dt>Grossesse</dt><dd>${p.medical.grossesse ? 'Oui — précautions' : 'Non'}</dd>
      <dt>Remarques</dt><dd>${U.esc(p.medical.notes || '—')}</dd>
    </dl>`)}</div>

    <div class="c6">${UI.card('Couverture sociale', `<dl class="dl">
      <dt>Type</dt><dd>${p.assurance.type === 'cnam' ? 'CNAM' : p.assurance.type === 'privee' ? 'Assurance privée' : 'Aucune'}</dd>
      <dt>Numéro</dt><dd class="mono">${U.esc(p.assurance.numero || '—')}</dd>
      <dt>Régime / organisme</dt><dd>${U.esc(p.assurance.regime || p.assurance.organisme || '—')}</dd>
      ${p.assurance.type === 'cnam' ? `<dt>Plafond soins dentaires</dt><dd>150,000 DT par an, en sus du plafond général</dd>
      <dt>Prothèses</dt><dd>Prises en charge hors plafond, sans accord préalable</dd>` : ''}
    </dl>`)}</div>

    <div class="c6">${UI.card('Suivi', `<dl class="dl">
      <dt>Prochain rendez-vous</dt><dd>${prochain ? `<b>${U.fmtDate(prochain.date)}</b> à ${prochain.heure} — ${U.esc(prochain.motif)}` : 'Aucun'}</dd>
      <dt>Séances réalisées</dt><dd class="num">${DB.rdv.filter(r => r.patientId === p.id && r.statut === 'termine').length}</dd>
      <dt>Absences</dt><dd class="num">${DB.rdv.filter(r => r.patientId === p.id && r.statut === 'absent').length}</dd>
      <dt>Actes réalisés</dt><dd class="num">${DB.soins.filter(s => s.patientId === p.id && s.statut === 'realise').length}</dd>
      <dt>Notes libres</dt><dd>${U.esc(p.notes || '—')}</dd>
    </dl>`)}</div>
  </div>`;
};

/* ---- Onglet : odontogramme ---- */
const FACE_LABEL = { V: 'Vestibulaire', L: 'Lingual / palatin', M: 'Mésial', D: 'Distal', O: 'Occlusal / incisal' };
const ETATS_FACE = {
  carie:  ['Carie',                'var(--t-carie)'],
  soin:   ['Obturation réalisée',  'var(--t-soin)'],
  a_faire:['Soin à réaliser',      'var(--t-afaire)'],
  sain:   ['Sain (effacer)',       'var(--t-sain)'],
};
const ETATS_DENT = {
  couronne:   ['Couronne',        'var(--t-couronne)'],
  implant:    ['Implant',         'var(--t-implant)'],
  absente:    ['Absente',         'var(--t-absente)'],
  a_extraire: ['À extraire',      'var(--t-carie)'],
  saine:      ['Réinitialiser',   'var(--t-sain)'],
};

const QUADRANTS = {
  adulte: [[18, 17, 16, 15, 14, 13, 12, 11], [21, 22, 23, 24, 25, 26, 27, 28],
           [48, 47, 46, 45, 44, 43, 42, 41], [31, 32, 33, 34, 35, 36, 37, 38]],
  enfant: [[55, 54, 53, 52, 51], [61, 62, 63, 64, 65],
           [85, 84, 83, 82, 81], [71, 72, 73, 74, 75]],
};

Views._toothSVG = function (num, etats) {
  /* Mésial vers la ligne médiane : quadrants 1 et 4 → à droite ; 2 et 3 → à gauche */
  const q = Math.floor(num / 10);
  const gauche = (q === 1 || q === 4) ? 'D' : 'M';
  const droite = (q === 1 || q === 4) ? 'M' : 'D';
  const cls = f => 'zone' + (etats[f] && etats[f] !== 'sain' ? ' z-' + etats[f] : '');
  return `<svg viewBox="0 0 40 40">
    <path class="${cls('V')}" data-f="V" d="M4 4 L36 4 L26 14 L14 14 Z"><title>Vestibulaire</title></path>
    <path class="${cls(droite)}" data-f="${droite}" d="M36 4 L36 36 L26 26 L26 14 Z"><title>${FACE_LABEL[droite]}</title></path>
    <path class="${cls('L')}" data-f="L" d="M4 36 L36 36 L26 26 L14 26 Z"><title>Lingual / palatin</title></path>
    <path class="${cls(gauche)}" data-f="${gauche}" d="M4 4 L4 36 L14 26 L14 14 Z"><title>${FACE_LABEL[gauche]}</title></path>
    <rect class="${cls('O')}" data-f="O" x="14" y="14" width="12" height="12"><title>Occlusal / incisal</title></rect>
  </svg>`;
};

Views._odontogramme = function (p, readonly) {
  const set = QUADRANTS[S.odoSet] || QUADRANTS.adulte;
  const etatDe = num => {
    const rec = DB.dents.filter(d => d.patientId === p.id && d.dent === String(num));
    const faces = {}; let whole = null;
    rec.forEach(d => { if (d.face) { String(d.face).split('').forEach(f => { faces[f] = d.etat; }); } else whole = d.etat; });
    return { faces, whole };
  };

  const quad = list => `<div class="odo-quad">${list.map(n => {
    const e = etatDe(n);
    return `<div class="tooth ${e.whole ? 'w-' + e.whole : ''}" data-tooth="${n}">
      ${Views._toothSVG(n, e.faces)}<span class="tooth-num">${n}</span>
    </div>`;
  }).join('')}</div>`;

  const tools = readonly ? '' : `<div class="odo-tools">
    <span class="eyebrow" style="margin-right:4px">Face</span>
    ${Object.entries(ETATS_FACE).map(([k, v]) =>
      `<button class="odo-tool ${S.odoTool === k ? 'is-on' : ''}" data-tool="${k}" type="button"><i style="background:${v[1]}"></i>${v[0]}</button>`).join('')}
    <span style="width:1px;height:20px;background:var(--line);margin:0 4px"></span>
    <span class="eyebrow" style="margin-right:4px">Dent entière</span>
    ${Object.entries(ETATS_DENT).map(([k, v]) =>
      `<button class="odo-tool ${S.odoTool === k ? 'is-on' : ''}" data-tool="${k}" type="button"><i style="background:${v[1]}"></i>${v[0]}</button>`).join('')}
  </div>`;

  const legende = `<div class="odo-legend">
    ${Object.entries(ETATS_FACE).filter(([k]) => k !== 'sain').map(([, v]) => `<span><i style="background:${v[1]}"></i>${v[0]}</span>`).join('')}
    ${Object.entries(ETATS_DENT).filter(([k]) => k !== 'saine').map(([, v]) => `<span><i style="background:${v[1]}"></i>${v[0]}</span>`).join('')}
    <span style="margin-left:auto;font-style:italic">Notation FDI · haut = vestibulaire, bas = lingual/palatin, centre = occlusal</span>
  </div>`;

  return `<div class="card">
    <div class="card-head">
      <div><h3>Schéma dentaire</h3><p>${readonly ? 'Consultation seule — la modification est réservée à la praticienne.' : 'Sélectionnez un état puis cliquez sur une face ou une dent.'}</p></div>
      <div class="btn-group">
        <button class="${S.odoSet === 'adulte' ? 'is-on' : ''}" data-set="adulte" type="button">Denture définitive</button>
        <button class="${S.odoSet === 'enfant' ? 'is-on' : ''}" data-set="enfant" type="button">Denture temporaire</button>
      </div>
    </div>
    ${tools}
    <div class="card-body">
      <div class="odo">
        <div class="odo-arch">${quad(set[0])}${quad(set[1])}</div>
        <div class="odo-sep"></div>
        <div class="odo-arch">${quad(set[2])}${quad(set[3])}</div>
      </div>
    </div>
    ${legende}
  </div>`;
};

Views._pat_odonto = function (p) {
  const ro = !Perm.can('clinique.edit');
  const notes = U.sortBy(DB.dents.filter(d => d.patientId === p.id), d => d.date, 'desc');
  return `${Views._odontogramme(p, ro)}
    <div class="grid" style="margin-top:var(--gap)">
      <div class="c12">${UI.card('Relevé de l\'état dentaire',
        notes.length ? `<div class="table-wrap"><table class="tbl">
          <thead><tr><th>Dent</th><th>Face</th><th>État</th><th>Date du relevé</th><th>Note</th>${ro ? '' : '<th></th>'}</tr></thead>
          <tbody>${notes.map(d => `<tr>
            <td class="mono cell-strong">${U.esc(d.dent)}</td>
            <td>${d.face ? U.esc(String(d.face).split('').map(f => FACE_LABEL[f] || f).join(' + ')) : '<span class="muted">Dent entière</span>'}</td>
            <td>${UI.badge((ETATS_FACE[d.etat] || ETATS_DENT[d.etat] || [d.etat])[0],
                  d.etat === 'carie' || d.etat === 'a_extraire' ? 'bad' : d.etat === 'soin' ? 'info' : d.etat === 'a_faire' ? 'warn' : 'accent')}</td>
            <td class="nowrap">${U.fmtDate(d.date)}</td>
            <td class="muted">${U.esc(d.note || '—')}</td>
            ${ro ? '' : `<td class="right"><button class="btn btn-sm btn-ghost" data-deldent="${d.id}" type="button" style="color:var(--bad)">${Icons.trash}</button></td>`}
          </tr>`).join('')}</tbody></table></div>`
          : `<p class="muted">Aucun relevé enregistré. Cliquez sur le schéma pour commencer.</p>`,
        { flush: notes.length > 0 })}</div>
    </div>`;
};

/* ---- Onglet : traitements ---- */
Views._pat_soins = function (p) {
  const soins = U.sortBy(DB.soins.filter(s => s.patientId === p.id), s => s.date, 'desc');
  const plans = DB.plans.filter(x => x.patientId === p.id);
  const ro = !Perm.can('clinique.edit');

  return `<div class="grid">
    <div class="c12">${UI.card('Actes réalisés et planifiés',
      soins.length ? `<div class="table-wrap"><table class="tbl">
        <thead><tr><th>Date</th><th>Acte</th><th>Dents</th><th class="num">Honoraires</th><th>Statut</th>${ro ? '' : '<th></th>'}</tr></thead>
        <tbody>${soins.map(s => `<tr>
          <td class="nowrap">${U.fmtDate(s.date)}</td>
          <td><span class="cell-strong">${U.esc(s.libelle)}</span>${s.note ? `<span class="cell-sub">${U.esc(s.note)}</span>` : ''}</td>
          <td class="mono">${U.esc((s.dents || []).join(', ') || '—')}</td>
          <td class="num">${U.money(s.prix)}</td>
          <td>${UI.badge(s.statut === 'realise' ? 'Réalisé' : s.statut === 'planifie' ? 'Planifié' : 'Annulé',
                s.statut === 'realise' ? 'ok' : s.statut === 'planifie' ? 'info' : '')}</td>
          ${ro ? '' : `<td class="right"><button class="btn btn-sm btn-ghost" data-delsoin="${s.id}" type="button" style="color:var(--bad)">${Icons.trash}</button></td>`}
        </tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="3">Total des actes réalisés</td>
          <td class="num">${U.money(U.sum(soins.filter(s => s.statut === 'realise'), s => s.prix))}</td><td colspan="${ro ? 1 : 2}"></td></tr></tfoot>
      </table></div>` : UI.empty('Aucun acte', 'Les soins réalisés apparaîtront ici.'),
      { flush: soins.length > 0, actions: ro ? '' : `<button class="btn btn-sm btn-primary" data-act="add-soin">${Icons.plus} Ajouter un acte</button>` })}</div>

    <div class="c12">${UI.card('Plans de traitement',
      plans.length ? `<div class="col" style="gap:0">${plans.map(pl => {
        const total = U.sum(pl.lignes, l => l.prix) - (pl.remise || 0);
        const faits = pl.lignes.filter(l => l.fait).length;
        return `<div class="list-line" data-plan="${pl.id}" style="cursor:pointer">
          <div class="ll-main">
            <b>${U.esc(pl.titre)}</b>
            <span>${U.fmtDate(pl.date)} · ${pl.lignes.length} acte(s) · ${faits}/${pl.lignes.length} réalisé(s)</span>
            <div style="margin-top:6px;max-width:260px">${UI.meter(faits, pl.lignes.length)}</div>
          </div>
          <div class="right">
            <div style="font-weight:650;font-variant-numeric:tabular-nums">${U.money(total)}</div>
            <div style="margin-top:4px">${UI.badge((STATUT_FAC[pl.statut] || [pl.statut])[0], (STATUT_FAC[pl.statut] || ['', ''])[1])}</div>
          </div>
        </div>`;
      }).join('')}</div>` : `<p class="muted">Aucun plan de traitement pour ce patient.</p>`,
      { flush: plans.length > 0, actions: ro ? '' : `<button class="btn btn-sm" data-act="add-plan">${Icons.plus} Nouveau plan</button>` })}</div>
  </div>`;
};

/* ---- Onglet : rendez-vous ---- */
Views._pat_rdv = function (p) {
  const list = U.sortBy(DB.rdv.filter(r => r.patientId === p.id), r => r.date + r.heure, 'desc');
  return UI.card('Historique des rendez-vous',
    list.length ? `<div class="table-wrap"><table class="tbl">
      <thead><tr><th>Date</th><th>Heure</th><th>Motif</th><th>Durée</th><th>Statut</th></tr></thead>
      <tbody>${list.map(r => `<tr class="clickable" data-rdv="${r.id}">
        <td class="nowrap">${U.fmtDate(r.date)}</td><td class="mono">${r.heure}</td>
        <td>${U.esc(r.motif)}</td><td class="num">${r.duree} min</td>
        <td>${UI.badge((STATUT_RDV[r.statut] || [r.statut])[0], (STATUT_RDV[r.statut] || ['', ''])[1])}</td>
      </tr>`).join('')}</tbody></table></div>`
      : UI.empty('Aucun rendez-vous', "Ce patient n'a pas encore de rendez-vous enregistré."),
    { flush: list.length > 0, actions: Perm.can('agenda.edit') ? `<button class="btn btn-sm btn-primary" data-act="rdv">${Icons.plus} Programmer</button>` : '' });
};

/* ---- Onglet : finances ---- */
Views._pat_finances = function (p) {
  const facs = U.sortBy(DB.factures.filter(f => f.patientId === p.id), f => f.date, 'desc');
  const pays = U.sortBy(DB.paiements.filter(x => x.patientId === p.id), x => x.date, 'desc');
  const dossiers = DB.cnam.filter(c => c.patientId === p.id);

  return `<div class="grid">
    <div class="c12">${UI.card('Devis et factures',
      facs.length ? `<div class="table-wrap"><table class="tbl">
        <thead><tr><th>Numéro</th><th>Date</th><th>Type</th><th class="num">Total</th><th class="num">Réglé</th><th class="num">Reste</th><th>Statut</th></tr></thead>
        <tbody>${facs.map(f => {
          const t = Data.totaux(f); const st = Data.statutFacture(f);
          return `<tr class="clickable" data-fac="${f.id}">
            <td class="mono cell-strong">${U.esc(f.numero)}</td>
            <td class="nowrap">${U.fmtDate(f.date)}</td>
            <td>${f.type === 'devis' ? 'Devis' : 'Facture'}</td>
            <td class="num">${U.money(t.total)}</td>
            <td class="num">${U.money(t.paye)}</td>
            <td class="num">${t.reste > 0.001 ? `<b style="color:var(--warn)">${U.money(t.reste)}</b>` : '—'}</td>
            <td>${UI.badge((STATUT_FAC[st] || [st])[0], (STATUT_FAC[st] || ['', ''])[1])}</td>
          </tr>`;
        }).join('')}</tbody></table></div>` : `<p class="muted">Aucun document financier.</p>`,
      { flush: facs.length > 0, actions: Perm.can('facture.edit') ? `<button class="btn btn-sm btn-primary" data-act="facture">${Icons.plus} Facture</button> <button class="btn btn-sm" data-act="devis">Devis</button>` : '' })}</div>

    <div class="c6">${UI.card('Règlements',
      pays.length ? `<div class="col" style="gap:0">${pays.map(x => `
        <div class="list-line" style="padding-left:0;padding-right:0">
          <div class="ll-main"><b>${U.money(x.montant)}</b><span>${U.fmtDate(x.date)} · ${MODES_PAIEMENT[x.mode] || x.mode}${x.reference ? ' · ' + U.esc(x.reference) : ''}</span></div>
          <div class="muted mono" style="font-size:11.5px">${U.esc((Data.facture(x.factureId) || {}).numero || '')}</div>
        </div>`).join('')}</div>` : `<p class="muted">Aucun règlement.</p>`,
      { flush: pays.length > 0, foot: `<div class="row" style="justify-content:space-between"><span class="muted">Total réglé</span><b>${U.money(U.sum(pays, x => x.montant))}</b></div>` })}</div>

    <div class="c6">${UI.card('Dossiers CNAM',
      dossiers.length ? `<div class="col" style="gap:0">${dossiers.map(c => `
        <div class="list-line" style="padding-left:0;padding-right:0">
          <div class="ll-main"><b>${c.type === 'prothese' ? 'Prothèse' : 'Soins'} — ${U.money(c.montantRemb)}</b>
            <span>${U.fmtDate(c.date)} · base ${U.money(c.baseRemb)} · ${c.taux} %</span></div>
          <div>${UI.badge(STATUT_CNAM[c.statut][0], STATUT_CNAM[c.statut][1])}</div>
        </div>`).join('')}</div>`
        : `<p class="muted">${p.assurance.type === 'cnam' ? 'Aucun dossier déposé.' : 'Patient non affilié CNAM.'}</p>`,
      { flush: dossiers.length > 0 })}</div>
  </div>`;
};

/* ---- Onglet : documents ---- */
Views._pat_docs = function (p) {
  const ordos = U.sortBy(DB.ordonnances.filter(o => o.patientId === p.id), o => o.date, 'desc');
  const docs = U.sortBy(DB.documents.filter(d => d.patientId === p.id), d => d.date, 'desc');
  return `<div class="grid">
    <div class="c6">${UI.card('Ordonnances',
      ordos.length ? `<div class="col" style="gap:0">${ordos.map(o => `
        <div class="list-line" data-ordo="${o.id}" style="cursor:pointer;padding-left:0;padding-right:0">
          <div class="ll-main"><b>${U.fmtDate(o.date)}</b><span>${U.esc(o.lignes.map(l => l.medicament).join(' · '))}</span></div>
          <button class="btn btn-sm btn-ghost" data-printordo="${o.id}" type="button">${Icons.print}</button>
        </div>`).join('')}</div>` : `<p class="muted">Aucune ordonnance.</p>`,
      { flush: ordos.length > 0, actions: Perm.can('ordonnance.create') ? `<button class="btn btn-sm btn-primary" data-act="ordo">${Icons.plus} Rédiger</button>` : '' })}</div>

    <div class="c6">${UI.card('Certificats et attestations',
      docs.length ? `<div class="col" style="gap:0">${docs.map(d => `
        <div class="list-line" data-doc="${d.id}" style="cursor:pointer;padding-left:0;padding-right:0">
          <div class="ll-main"><b>${U.esc(d.titre)}</b><span>${U.fmtDate(d.date)}</span></div>
          <button class="btn btn-sm btn-ghost" data-printdoc="${d.id}" type="button">${Icons.print}</button>
        </div>`).join('')}</div>` : `<p class="muted">Aucun document.</p>`,
      { flush: docs.length > 0, actions: Perm.can('ordonnance.create') ? `<button class="btn btn-sm" data-act="certif">${Icons.plus} Nouveau</button>` : '' })}</div>
  </div>`;
};

Views.patientMount = function (id) {
  const p = Data.patient(id);
  if (!p) return;

  Bind.click(async e => {
    const tab = e.target.closest('[data-tab]');
    if (tab) { S.patientTab = tab.dataset.tab; App.render(); return; }

    const set = e.target.closest('[data-set]');
    if (set) { S.odoSet = set.dataset.set; App.render(); return; }

    const tool = e.target.closest('[data-tool]');
    if (tool) { S.odoTool = tool.dataset.tool; App.render(); return; }

    /* Odontogramme : application de l'état */
    const tooth = e.target.closest('[data-tooth]');
    if (tooth && Perm.can('clinique.edit')) {
      const num = tooth.dataset.tooth;
      const zone = e.target.closest('[data-f]');
      const isWhole = Object.keys(ETATS_DENT).includes(S.odoTool);
      if (isWhole) {
        DB.dents = DB.dents.filter(d => !(d.patientId === p.id && d.dent === num && !d.face));
        if (S.odoTool !== 'saine') {
          DB.dents.push({ id: U.uid('dt'), patientId: p.id, dent: num, face: null, etat: S.odoTool,
            date: U.todayISO(), note: '', by: Auth.current.id });
        } else {
          DB.dents = DB.dents.filter(d => !(d.patientId === p.id && d.dent === num));
        }
      } else if (zone) {
        const f = zone.dataset.f;
        DB.dents = DB.dents.filter(d => !(d.patientId === p.id && d.dent === num && d.face === f));
        if (S.odoTool !== 'sain') {
          DB.dents.push({ id: U.uid('dt'), patientId: p.id, dent: num, face: f, etat: S.odoTool,
            date: U.todayISO(), note: '', by: Auth.current.id });
        }
      } else return;
      Audit.log('odontogramme', 'patient', p.id, `Dent ${num} → ${S.odoTool}`);
      Data.commit();
      return;
    }

    const dd = e.target.closest('[data-deldent]');
    if (dd) {
      DB.dents = DB.dents.filter(d => d.id !== dd.dataset.deldent);
      Audit.log('odontogramme', 'patient', p.id, 'Suppression d\'un relevé');
      Data.commit(); return;
    }

    const ds = e.target.closest('[data-delsoin]');
    if (ds) {
      const ok = await UI.confirm('Supprimer cet acte ?', "L'acte sera retiré du dossier clinique.", { danger: true, ok: 'Supprimer' });
      if (!ok) return;
      DB.soins = DB.soins.filter(s => s.id !== ds.dataset.delsoin);
      Audit.log('suppression', 'soin', ds.dataset.delsoin, Data.patientNom(p.id));
      Data.commit(); return;
    }

    const r = e.target.closest('[data-rdv]');
    if (r) { Views.rdvDialog(r.dataset.rdv); return; }
    const fa = e.target.closest('[data-fac]');
    if (fa) { Views.factureView(fa.dataset.fac); return; }
    const pl = e.target.closest('[data-plan]');
    if (pl) { Views.planDialog(pl.dataset.plan); return; }
    const po = e.target.closest('[data-printordo]');
    if (po) { Views.printOrdonnance(po.dataset.printordo); return; }
    const pd = e.target.closest('[data-printdoc]');
    if (pd) { Views.printDocument(pd.dataset.printdoc); return; }
    const oo = e.target.closest('[data-ordo]');
    if (oo) { Views.printOrdonnance(oo.dataset.ordo); return; }
    const od = e.target.closest('[data-doc]');
    if (od) { Views.printDocument(od.dataset.doc); return; }

    const a = e.target.closest('[data-act]');
    if (!a) return;
    const k = a.dataset.act;
    if (k === 'back') location.hash = '#/patients';
    if (k === 'edit') Views.patientDialog(p.id);
    if (k === 'rdv') Views.rdvDialog(null, U.todayISO(), null, p.id);
    if (k === 'facture') Views.factureDialog(null, 'facture', p.id);
    if (k === 'devis') Views.factureDialog(null, 'devis', p.id);
    if (k === 'ordo') Views.ordonnanceDialog(p.id);
    if (k === 'certif') Views.certificatDialog(p.id);
    if (k === 'add-soin') Views.soinDialog(p.id);
    if (k === 'add-plan') Views.planDialog(null, p.id);
    if (k === 'more') {
      UI.menu(a, [
        { text: 'Imprimer la fiche', icon: Icons.print, act: () => window.print() },
        Perm.can('patients.edit') ? { text: p.archived ? 'Réactiver le dossier' : 'Archiver le dossier', icon: Icons.box, act: async () => {
          p.archived = !p.archived;
          Audit.log(p.archived ? 'archivage' : 'reactivation', 'patient', p.id, p.prenom + ' ' + p.nom);
          Data.commit();
          UI.toast(p.archived ? 'Dossier archivé' : 'Dossier réactivé', '', 'ok');
        } } : null,
        Perm.can('patients.delete') ? '-' : null,
        Perm.can('patients.delete') ? { text: 'Supprimer définitivement', icon: Icons.trash, danger: true, act: async () => {
          const ok = await UI.confirm('Supprimer ce patient ?',
            `Toutes les données liées à <b>${U.esc(p.prenom + ' ' + p.nom)}</b> (rendez-vous, soins, odontogramme, factures) seront effacées. Cette action est irréversible.`,
            { danger: true, ok: 'Supprimer définitivement' });
          if (!ok) return;
          ['rdv', 'soins', 'dents', 'plans', 'ordonnances', 'documents', 'cnam'].forEach(c => {
            DB[c] = DB[c].filter(x => x.patientId !== p.id);
          });
          DB.paiements = DB.paiements.filter(x => x.patientId !== p.id);
          DB.factures = DB.factures.filter(x => x.patientId !== p.id);
          DB.labo = DB.labo.filter(x => x.patientId !== p.id);
          DB.patients = DB.patients.filter(x => x.id !== p.id);
          Audit.log('suppression', 'patient', p.id, `${p.prenom} ${p.nom} (${p.code}) et toutes ses données`);
          Data.commit();
          location.hash = '#/patients';
          UI.toast('Patient supprimé', '', 'ok');
        } } : null,
      ].filter(Boolean));
    }
  });
};

/* ---- Ajout d'un acte au dossier ---- */
Views.soinDialog = function (pid) {
  UI.modal({
    titre: 'Ajouter un acte', sous: Data.patientNom(pid), size: 'lg',
    body: `<form id="soinForm"><div class="form-grid">
      ${UI.field({ label: 'Acte', name: 'acteId', type: 'select', required: true, full: true,
        options: DB.actes.filter(a => a.actif).map(a => [a.id, `${a.code} · ${a.libelle} — ${U.money(a.prix)}`]) })}
      ${UI.field({ label: 'Date', name: 'date', type: 'date', value: U.todayISO(), required: true })}
      ${UI.field({ label: 'Honoraires (DT)', name: 'prix', type: 'number', step: '0.001', value: DB.actes[0].prix, required: true })}
      ${UI.field({ label: 'Dents concernées', name: 'dents', placeholder: '16, 26 — notation FDI', full: true })}
      ${UI.field({ label: 'Statut', name: 'statut', type: 'select', value: 'realise', options: [['realise', 'Réalisé'], ['planifie', 'Planifié']] })}
      ${UI.field({ label: 'Note clinique', name: 'note', type: 'textarea', rows: 2, full: true })}
    </div></form>`,
    foot: `<button class="btn" data-close type="button">Annuler</button>
           <button class="btn btn-primary" data-save type="button">Enregistrer l'acte</button>`,
    onMount(ov) {
      const f = ov.querySelector('#soinForm');
      f.acteId.addEventListener('change', () => { const a = Data.acte(f.acteId.value); if (a) f.prix.value = a.prix; });
      ov.addEventListener('click', e => {
        if (!e.target.closest('[data-save]')) return;
        const v = UI.formValues(f);
        const a = Data.acte(v.acteId);
        DB.soins.push({
          id: U.uid('soi'), patientId: pid, date: v.date, acteId: v.acteId, libelle: a.libelle,
          dents: v.dents ? v.dents.split(/[,\s]+/).filter(Boolean) : [], prix: Number(v.prix) || a.prix,
          remise: 0, statut: v.statut, factureId: null, note: v.note, by: Auth.current.id,
        });
        Audit.log('creation', 'soin', pid, `${a.libelle} — ${Data.patientNom(pid)}`);
        Data.commit(); UI.close(ov);
        UI.toast('Acte enregistré', a.libelle, 'ok');
      });
    },
  });
};

/* ================================================ Plans de traitement ======= */

Views.plans = function () {
  const g = Perm.guard('clinique.view'); if (g) return g;
  const list = U.sortBy(DB.plans, p => p.date, 'desc');
  const parStatut = U.groupBy(list, p => p.statut);
  const valeur = s => U.sum((parStatut[s] || []), p => U.sum(p.lignes, l => l.prix) - (p.remise || 0));

  return `
    <div class="page-head">
      <div class="titles"><h1>Plans de traitement</h1>
        <p>${list.length} plan(s) — ${(parStatut.propose || []).length} en attente de réponse</p></div>
      <div class="page-actions">
        ${Perm.can('clinique.edit') ? `<button class="btn btn-primary" data-act="new">${Icons.plus} Nouveau plan</button>` : ''}
      </div>
    </div>

    <div class="grid">
      <div class="c3">${UI.kpi({ label: 'Proposés', value: (parStatut.propose || []).length, foot: U.money(valeur('propose')), kind: 'warn' })}</div>
      <div class="c3">${UI.kpi({ label: 'Acceptés', value: (parStatut.accepte || []).length, foot: U.money(valeur('accepte')), kind: 'ok' })}</div>
      <div class="c3">${UI.kpi({ label: 'Terminés', value: (parStatut.termine || []).length, foot: U.money(valeur('termine')) })}</div>
      <div class="c3">${UI.kpi({ label: "Taux d'acceptation", value: list.length ? Math.round(((parStatut.accepte || []).length + (parStatut.termine || []).length) / list.length * 100) : 0, unit: '%',
        foot: 'Plans acceptés ou réalisés' })}</div>

      <div class="c12">${UI.card('Tous les plans',
        list.length ? `<div class="table-wrap"><table class="tbl">
          <thead><tr><th>Patient</th><th>Intitulé</th><th>Date</th><th class="num">Actes</th><th class="num">Montant</th><th>Avancement</th><th>Statut</th></tr></thead>
          <tbody>${list.map(pl => {
            const total = U.sum(pl.lignes, l => l.prix) - (pl.remise || 0);
            const faits = pl.lignes.filter(l => l.fait).length;
            return `<tr class="clickable" data-plan="${pl.id}">
              <td class="cell-strong">${U.esc(Data.patientNom(pl.patientId))}</td>
              <td>${U.esc(pl.titre)}</td>
              <td class="nowrap">${U.fmtDate(pl.date)}</td>
              <td class="num">${pl.lignes.length}</td>
              <td class="num">${U.money(total)}</td>
              <td style="min-width:120px">${UI.meter(faits, pl.lignes.length)}<span class="cell-sub">${faits}/${pl.lignes.length}</span></td>
              <td>${UI.badge((STATUT_FAC[pl.statut] || [pl.statut])[0], (STATUT_FAC[pl.statut] || ['', ''])[1])}</td>
            </tr>`;
          }).join('')}</tbody></table></div>`
          : UI.empty('Aucun plan de traitement', 'Créez un plan pour présenter un devis structuré au patient.'),
        { flush: list.length > 0 })}</div>
    </div>`;
};

Views.plansMount = function () {
  Bind.click(e => {
    const pl = e.target.closest('[data-plan]');
    if (pl) return Views.planDialog(pl.dataset.plan);
    if (e.target.closest('[data-act="new"]')) Views.planDialog(null);
  });
};

Views.planDialog = function (id, pid) {
  const pl = id ? DB.plans.find(x => x.id === id) : null;
  const ro = !Perm.can('clinique.edit');
  let lignes = pl ? pl.lignes.map(l => Object.assign({}, l)) : [];

  const render = ov => {
    const box = ov.querySelector('#planLignes');
    const total = U.sum(lignes, l => l.prix);
    const remise = Number(ov.querySelector('[name=remise]').value || 0);
    box.innerHTML = lignes.length ? `<table class="tbl">
      <thead><tr><th>Séance</th><th>Acte</th><th>Dents</th><th class="num">Montant</th><th>Fait</th>${ro ? '' : '<th></th>'}</tr></thead>
      <tbody>${lignes.map((l, i) => `<tr>
        <td class="num">${l.seance || i + 1}</td>
        <td>${U.esc(l.libelle)}</td>
        <td class="mono">${U.esc((l.dents || []).join(', ') || '—')}</td>
        <td class="num">${U.money(l.prix)}</td>
        <td><input type="checkbox" data-fait="${i}"${l.fait ? ' checked' : ''}${ro ? ' disabled' : ''} style="accent-color:var(--accent)"></td>
        ${ro ? '' : `<td class="right"><button class="btn btn-sm btn-ghost" data-rm="${i}" type="button" style="color:var(--bad)">${Icons.x}</button></td>`}
      </tr>`).join('')}</tbody>
      <tfoot>
        <tr><td colspan="3">Total des actes</td><td class="num">${U.money(total)}</td><td colspan="${ro ? 1 : 2}"></td></tr>
        ${remise ? `<tr><td colspan="3">Remise</td><td class="num">− ${U.money(remise)}</td><td colspan="${ro ? 1 : 2}"></td></tr>` : ''}
        <tr><td colspan="3"><b>Net à payer</b></td><td class="num"><b>${U.money(total - remise)}</b></td><td colspan="${ro ? 1 : 2}"></td></tr>
      </tfoot></table>`
      : `<p class="muted" style="padding:14px">Ajoutez les actes qui composent ce plan.</p>`;
  };

  UI.modal({
    titre: pl ? 'Plan de traitement' : 'Nouveau plan de traitement',
    sous: pl ? Data.patientNom(pl.patientId) : '', size: 'xl',
    body: `<form id="planForm"><div class="form-grid">
        ${pl ? '' : `<div class="field full"><label for="f_patientId">Patient *</label>
          <select class="select" id="f_patientId" name="patientId" required><option value="">— Choisir —</option>${UI.patientOptions(pid || '')}</select></div>`}
        ${UI.field({ label: 'Intitulé du plan', name: 'titre', value: pl ? pl.titre : '', required: true, full: true, placeholder: 'Réhabilitation du secteur 1…' })}
        ${UI.field({ label: 'Date', name: 'date', type: 'date', value: pl ? pl.date : U.todayISO() })}
        ${UI.field({ label: 'Statut', name: 'statut', type: 'select', value: pl ? pl.statut : 'propose',
          options: [['propose', 'Proposé'], ['accepte', 'Accepté'], ['refuse', 'Refusé'], ['termine', 'Terminé']] })}
        ${UI.field({ label: 'Remise (DT)', name: 'remise', type: 'number', step: '0.001', value: pl ? pl.remise : 0 })}
        ${UI.field({ label: 'Note au patient', name: 'note', type: 'textarea', rows: 2, value: pl ? pl.note : '', full: true })}
      </div></form>
      ${ro ? '' : `<div class="row" style="margin:18px 0 10px;gap:8px;flex-wrap:wrap">
        <select class="select" id="planActe" style="flex:1 1 260px">${DB.actes.filter(a => a.actif).map(a => `<option value="${a.id}">${U.esc(a.code + ' · ' + a.libelle)} — ${U.money(a.prix)}</option>`).join('')}</select>
        <input class="input" id="planDents" placeholder="Dents (ex. 16, 26)" style="width:170px">
        <input class="input" id="planSeance" type="number" min="1" value="1" style="width:100px" title="Séance">
        <button class="btn btn-primary" id="planAdd" type="button">${Icons.plus} Ajouter</button>
      </div>`}
      <div class="table-wrap" id="planLignes" style="border:1px solid var(--line);border-radius:var(--r-sm)"></div>`,
    foot: `<div class="left">${pl && Perm.can('facture.edit') ? `<button class="btn btn-sm" data-devis type="button">${Icons.receipt} Convertir en devis</button>` : ''}
        ${pl && !ro ? `<button class="btn btn-sm btn-ghost" data-del type="button" style="color:var(--bad)">${Icons.trash} Supprimer</button>` : ''}</div>
      <button class="btn" data-close type="button">Fermer</button>
      ${ro ? '' : `<button class="btn btn-primary" data-save type="button">Enregistrer</button>`}`,
    onMount(ov) {
      render(ov);
      const form = ov.querySelector('#planForm');
      if (ro) U.$$('input,select,textarea', form).forEach(i => { i.disabled = true; });
      form.addEventListener('input', () => render(ov));

      const add = ov.querySelector('#planAdd');
      if (add) add.addEventListener('click', () => {
        const a = Data.acte(ov.querySelector('#planActe').value);
        const dents = ov.querySelector('#planDents').value.split(/[,\s]+/).filter(Boolean);
        lignes.push({ acteId: a.id, libelle: a.libelle, dents, prix: a.prix, seance: Number(ov.querySelector('#planSeance').value) || lignes.length + 1, fait: false });
        ov.querySelector('#planDents').value = '';
        render(ov);
      });

      ov.addEventListener('click', async e => {
        const rm = e.target.closest('[data-rm]');
        if (rm) { lignes.splice(Number(rm.dataset.rm), 1); render(ov); return; }

        if (e.target.closest('[data-save]')) {
          const v = UI.formValues(form);
          const targetPid = pl ? pl.patientId : v.patientId;
          if (!targetPid) return UI.toast('Patient requis', '', 'bad');
          if (!v.titre) return UI.toast('Intitulé requis', '', 'bad');
          const rec = pl || { id: U.uid('pln'), patientId: targetPid };
          Object.assign(rec, { patientId: targetPid, titre: v.titre, date: v.date, statut: v.statut,
            remise: Number(v.remise) || 0, note: v.note, lignes });
          if (!pl) DB.plans.push(rec);
          Audit.log(pl ? 'modification' : 'creation', 'plan', rec.id, `${rec.titre} — ${Data.patientNom(rec.patientId)}`);
          Data.commit(); UI.close(ov);
          UI.toast('Plan enregistré', rec.titre, 'ok');
          return;
        }
        if (e.target.closest('[data-devis]')) {
          UI.close(ov);
          Views.factureDialog(null, 'devis', pl.patientId, lignes.map(l => ({
            acteId: l.acteId, libelle: l.libelle, code: (Data.acte(l.acteId) || {}).code || '', qte: 1, pu: l.prix, dents: l.dents,
          })), pl.remise);
          return;
        }
        if (e.target.closest('[data-del]')) {
          const ok = await UI.confirm('Supprimer ce plan ?', 'Le plan de traitement sera effacé.', { danger: true, ok: 'Supprimer' });
          if (!ok) return;
          DB.plans = DB.plans.filter(x => x.id !== pl.id);
          Audit.log('suppression', 'plan', pl.id, pl.titre);
          Data.commit(); UI.close(ov);
        }
      });

      ov.addEventListener('change', e => {
        const f = e.target.closest('[data-fait]');
        if (f) { lignes[Number(f.dataset.fait)].fait = f.checked; render(ov); }
      });
    },
  });
};

/* ============================================ Ordonnances et documents ====== */

Views.documents = function () {
  const ordos = U.sortBy(DB.ordonnances, o => o.date, 'desc');
  const docs = U.sortBy(DB.documents, d => d.date, 'desc');
  const peut = Perm.can('ordonnance.create');

  return `
    <div class="page-head">
      <div class="titles"><h1>Ordonnances &amp; documents</h1>
        <p>${ordos.length} ordonnance(s), ${docs.length} certificat(s) et attestation(s)</p></div>
      <div class="page-actions">
        ${peut ? `<button class="btn btn-primary" data-act="ordo">${Icons.plus} Ordonnance</button>
                  <button class="btn" data-act="certif">${Icons.doc} Certificat</button>` : ''}
      </div>
    </div>
    ${peut ? '' : `<div class="alert-band a-info" style="margin-bottom:var(--gap)">${Icons.alert}
      <span>La rédaction d'ordonnances et de certificats est un acte médical réservé à la praticienne. Vous pouvez consulter et imprimer les documents existants.</span></div>`}

    <div class="grid">
      <div class="c6">${UI.card('Ordonnances',
        ordos.length ? `<div class="col" style="gap:0">${ordos.map(o => `
          <div class="list-line" data-ordo="${o.id}" style="cursor:pointer;padding-left:0;padding-right:0">
            <div class="ll-main"><b>${U.esc(Data.patientNom(o.patientId))}</b>
              <span>${U.fmtDate(o.date)} · ${U.esc(o.lignes.map(l => l.medicament).join(' · '))}</span></div>
            <button class="btn btn-sm btn-ghost" data-printordo="${o.id}" type="button">${Icons.print}</button>
          </div>`).join('')}</div>` : UI.empty('Aucune ordonnance', 'Les prescriptions rédigées apparaîtront ici.'),
        { flush: ordos.length > 0 })}</div>

      <div class="c6">${UI.card('Certificats et attestations',
        docs.length ? `<div class="col" style="gap:0">${docs.map(d => `
          <div class="list-line" data-doc="${d.id}" style="cursor:pointer;padding-left:0;padding-right:0">
            <div class="ll-main"><b>${U.esc(d.titre)}</b><span>${U.esc(Data.patientNom(d.patientId))} · ${U.fmtDate(d.date)}</span></div>
            <button class="btn btn-sm btn-ghost" data-printdoc="${d.id}" type="button">${Icons.print}</button>
          </div>`).join('')}</div>` : UI.empty('Aucun document', 'Certificats médicaux, arrêts de travail et attestations de soins.'),
        { flush: docs.length > 0 })}</div>
    </div>`;
};

Views.documentsMount = function () {
  Bind.click(e => {
    const a = e.target.closest('[data-act]');
    if (a) { if (a.dataset.act === 'ordo') Views.ordonnanceDialog(null); if (a.dataset.act === 'certif') Views.certificatDialog(null); return; }
    const po = e.target.closest('[data-printordo]') || e.target.closest('[data-ordo]');
    if (po) return Views.printOrdonnance(po.dataset.printordo || po.dataset.ordo);
    const pd = e.target.closest('[data-printdoc]') || e.target.closest('[data-doc]');
    if (pd) return Views.printDocument(pd.dataset.printdoc || pd.dataset.doc);
  });
};

const MEDICAMENTS = [
  'Amoxicilline 1 g', 'Amoxicilline + acide clavulanique 1 g', 'Spiramycine 3 MUI', 'Métronidazole 500 mg',
  'Clindamycine 300 mg', 'Paracétamol 1 g', 'Ibuprofène 400 mg', 'Acide méfénamique 500 mg',
  'Prednisolone 20 mg', 'Bain de bouche chlorhexidine 0,12 %', 'Gel gingival anesthésiant', 'Fluor gel 0,2 %',
];

Views.ordonnanceDialog = function (pid) {
  let lignes = [];
  const render = ov => {
    ov.querySelector('#ordoLignes').innerHTML = lignes.length ? lignes.map((l, i) => `
      <div class="list-line" style="padding-left:0;padding-right:0">
        <div class="ll-main"><b>${U.esc(l.medicament)}</b><span>${U.esc(l.posologie)}${l.duree ? ' — ' + U.esc(l.duree) : ''}</span></div>
        <button class="btn btn-sm btn-ghost" data-rm="${i}" type="button" style="color:var(--bad)">${Icons.x}</button>
      </div>`).join('') : `<p class="muted">Aucune ligne. Ajoutez les médicaments prescrits.</p>`;
  };

  UI.modal({
    titre: 'Nouvelle ordonnance', size: 'lg',
    body: `<form id="ordoForm"><div class="form-grid">
        <div class="field full"><label for="f_patientId">Patient *</label>
          <select class="select" id="f_patientId" name="patientId" required><option value="">— Choisir —</option>${UI.patientOptions(pid || '')}</select></div>
        ${UI.field({ label: 'Date', name: 'date', type: 'date', value: U.todayISO() })}
      </div></form>
      <datalist id="medList">${MEDICAMENTS.map(m => `<option value="${U.esc(m)}"></option>`).join('')}</datalist>
      <div class="row" style="margin:18px 0 10px;gap:8px;flex-wrap:wrap">
        <input class="input" id="oMed" list="medList" placeholder="Médicament" style="flex:1 1 200px">
        <input class="input" id="oPos" placeholder="Posologie" style="flex:1 1 200px">
        <input class="input" id="oDur" placeholder="Durée" style="width:130px">
        <button class="btn btn-primary" id="oAdd" type="button">${Icons.plus}</button>
      </div>
      <div id="ordoLignes" style="border:1px solid var(--line);border-radius:var(--r-sm);padding:4px 14px"></div>
      <div class="field" style="margin-top:16px"><label for="oNote">Conseils et recommandations</label>
        <textarea class="textarea" id="oNote" rows="2" placeholder="Ne pas cracher pendant 24 h, alimentation tiède…"></textarea></div>`,
    foot: `<button class="btn" data-close type="button">Annuler</button>
           <button class="btn btn-primary" data-save type="button">Enregistrer et imprimer</button>`,
    onMount(ov) {
      render(ov);
      ov.querySelector('#oAdd').addEventListener('click', () => {
        const m = ov.querySelector('#oMed').value.trim();
        if (!m) return;
        lignes.push({ medicament: m, posologie: ov.querySelector('#oPos').value.trim(), duree: ov.querySelector('#oDur').value.trim() });
        ['#oMed', '#oPos', '#oDur'].forEach(s => { ov.querySelector(s).value = ''; });
        ov.querySelector('#oMed').focus();
        render(ov);
      });
      ov.addEventListener('click', e => {
        const rm = e.target.closest('[data-rm]');
        if (rm) { lignes.splice(Number(rm.dataset.rm), 1); render(ov); return; }
        if (!e.target.closest('[data-save]')) return;
        const v = UI.formValues(ov.querySelector('#ordoForm'));
        if (!v.patientId) return UI.toast('Patient requis', '', 'bad');
        if (!lignes.length) return UI.toast('Ordonnance vide', 'Ajoutez au moins un médicament.', 'bad');
        const rec = { id: U.uid('ord'), patientId: v.patientId, date: v.date, lignes,
          note: ov.querySelector('#oNote').value, by: Auth.current.id };
        DB.ordonnances.push(rec);
        Audit.log('creation', 'ordonnance', rec.id, Data.patientNom(rec.patientId));
        Data.commit(); UI.close(ov);
        Views.printOrdonnance(rec.id);
      });
    },
  });
};

const MODELES_DOC = {
  certificat: { titre: 'Certificat médical', corps: p =>
    `Je soussignée, ${DB.cabinet.praticien}, ${DB.cabinet.titre}, certifie avoir examiné ce jour ${p.sexe === 'F' ? 'Madame' : 'Monsieur'} ${p.prenom} ${p.nom}${p.dateNaissance ? `, né${p.sexe === 'F' ? 'e' : ''} le ${U.fmtDate(p.dateNaissance)}` : ''}${p.cin ? `, titulaire de la CIN n° ${p.cin}` : ''}.\n\nL'état bucco-dentaire nécessite des soins.\n\nCertificat établi à la demande de l'intéressé${p.sexe === 'F' ? 'e' : ''} et remis en main propre pour servir et valoir ce que de droit.` },
  arret: { titre: 'Certificat d\'arrêt de travail', corps: p =>
    `Je soussignée, ${DB.cabinet.praticien}, ${DB.cabinet.titre}, certifie que l'état de santé de ${p.sexe === 'F' ? 'Madame' : 'Monsieur'} ${p.prenom} ${p.nom} nécessite un arrêt de travail de ____ jour(s), à compter du ____________.\n\nSauf complication.` },
  attestation: { titre: 'Attestation de soins', corps: p =>
    `Je soussignée, ${DB.cabinet.praticien}, ${DB.cabinet.titre}, atteste avoir dispensé des soins dentaires à ${p.sexe === 'F' ? 'Madame' : 'Monsieur'} ${p.prenom} ${p.nom}${p.assurance && p.assurance.numero ? `, affilié${p.sexe === 'F' ? 'e' : ''} sous le numéro ${p.assurance.numero}` : ''}.\n\nAttestation délivrée pour servir auprès de la Caisse Nationale d'Assurance Maladie.` },
  presence: { titre: 'Attestation de présence', corps: p =>
    `Je soussignée, ${DB.cabinet.praticien}, ${DB.cabinet.titre}, atteste que ${p.sexe === 'F' ? 'Madame' : 'Monsieur'} ${p.prenom} ${p.nom} s'est présenté${p.sexe === 'F' ? 'e' : ''} à mon cabinet ce jour de ____ h ____ à ____ h ____ pour une consultation dentaire.` },
};

Views.certificatDialog = function (pid) {
  UI.modal({
    titre: 'Nouveau document', size: 'lg',
    body: `<form id="certForm"><div class="form-grid">
      <div class="field full"><label for="f_patientId">Patient *</label>
        <select class="select" id="f_patientId" name="patientId" required><option value="">— Choisir —</option>${UI.patientOptions(pid || '')}</select></div>
      ${UI.field({ label: 'Modèle', name: 'modele', type: 'select', options: Object.entries(MODELES_DOC).map(([k, v]) => [k, v.titre]) })}
      ${UI.field({ label: 'Date', name: 'date', type: 'date', value: U.todayISO() })}
      ${UI.field({ label: 'Titre du document', name: 'titre', value: 'Certificat médical', full: true, required: true })}
      ${UI.field({ label: 'Corps du document', name: 'contenu', type: 'textarea', rows: 9, full: true })}
    </div></form>`,
    foot: `<button class="btn" data-close type="button">Annuler</button>
           <button class="btn btn-primary" data-save type="button">Enregistrer et imprimer</button>`,
    onMount(ov) {
      const f = ov.querySelector('#certForm');
      const fill = () => {
        const p = Data.patient(f.patientId.value);
        const m = MODELES_DOC[f.modele.value];
        f.titre.value = m.titre;
        f.contenu.value = p ? m.corps(p) : 'Sélectionnez d\'abord le patient.';
      };
      f.patientId.addEventListener('change', fill);
      f.modele.addEventListener('change', fill);
      if (pid) fill();

      ov.addEventListener('click', e => {
        if (!e.target.closest('[data-save]')) return;
        const v = UI.formValues(f);
        if (!v.patientId) return UI.toast('Patient requis', '', 'bad');
        const rec = { id: U.uid('doc'), patientId: v.patientId, type: v.modele, titre: v.titre,
          date: v.date, contenu: v.contenu, by: Auth.current.id };
        DB.documents.push(rec);
        Audit.log('creation', 'document', rec.id, `${rec.titre} — ${Data.patientNom(rec.patientId)}`);
        Data.commit(); UI.close(ov);
        Views.printDocument(rec.id);
      });
    },
  });
};

/* ---- Impression ---- */
Views._entete = function () {
  const c = DB.cabinet;
  return `<div class="cab">
    <b>${U.esc(c.praticien)}</b>
    <span>${U.esc(c.titre)}${c.cnom ? ' — ' + U.esc(c.cnom) : ''}</span>
    <span>${U.esc(c.adresse)}</span>
    <span>${U.esc(c.codePostal)} ${U.esc(c.ville)}</span>
    <span>Tél. ${U.esc(c.tel)}${c.mobile ? ' · ' + U.esc(c.mobile) : ''}</span>
  </div>`;
};

Views.printOrdonnance = function (id) {
  const o = DB.ordonnances.find(x => x.id === id);
  if (!o) return;
  const p = Data.patient(o.patientId);
  const c = DB.cabinet;
  UI.modal({
    titre: 'Ordonnance', size: 'lg',
    body: `<div class="print-doc">
      <div class="pd-head">${Views._entete()}
        <div class="doc"><b>Ordonnance</b><span>${U.fmtDate(o.date)}</span></div></div>
      <p><b>${p ? U.esc(p.prenom + ' ' + p.nom) : '—'}</b>${p && p.dateNaissance ? ` — ${U.age(p.dateNaissance)} ans` : ''}${p && p.assurance.numero ? ` — CNAM ${U.esc(p.assurance.numero)}` : ''}</p>
      <div class="pd-rx"><ol style="padding-left:20px;margin-top:18px">
        ${o.lignes.map(l => `<li><b>${U.esc(l.medicament)}</b><br>${U.esc(l.posologie)}${l.duree ? ` — <i>${U.esc(l.duree)}</i>` : ''}</li>`).join('')}
      </ol>
      ${o.note ? `<p style="margin-top:18px"><b>Conseils :</b> ${U.esc(o.note)}</p>` : ''}</div>
      <div class="pd-sign"><span></span><span>${U.esc(c.ville.split(',').pop().trim())}, le ${U.fmtDate(o.date)}<br><br><b>${U.esc(c.praticien)}</b><br>Signature et cachet</span></div>
      <div class="pd-foot">${U.esc(c.nom)} · ${U.esc(c.adresse)}, ${U.esc(c.ville)} · Tél. ${U.esc(c.tel)}${c.matriculeFiscal ? ' · MF ' + U.esc(c.matriculeFiscal) : ''}</div>
    </div>`,
    foot: `<button class="btn" data-close type="button">Fermer</button>
           <button class="btn btn-primary" onclick="window.print()" type="button">${Icons.print} Imprimer</button>`,
  });
};

Views.printDocument = function (id) {
  const d = DB.documents.find(x => x.id === id);
  if (!d) return;
  const p = Data.patient(d.patientId);
  const c = DB.cabinet;
  UI.modal({
    titre: d.titre, size: 'lg',
    body: `<div class="print-doc">
      <div class="pd-head">${Views._entete()}
        <div class="doc"><b>${U.esc(d.titre)}</b><span>${U.fmtDate(d.date)}</span></div></div>
      <div style="white-space:pre-wrap;margin-top:20px;line-height:1.8">${U.esc(d.contenu)}</div>
      <div class="pd-sign"><span></span><span>${U.esc(c.ville.split(',').pop().trim())}, le ${U.fmtDate(d.date)}<br><br><b>${U.esc(c.praticien)}</b><br>Signature et cachet</span></div>
      <div class="pd-foot">${U.esc(c.nom)} · ${U.esc(c.adresse)}, ${U.esc(c.ville)} · Tél. ${U.esc(c.tel)}</div>
    </div>`,
    foot: `<button class="btn" data-close type="button">Fermer</button>
           <button class="btn btn-primary" onclick="window.print()" type="button">${Icons.print} Imprimer</button>`,
  });
};
