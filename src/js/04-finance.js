/* ==========================================================================
   04 — Finances : devis et factures, caisse, dossiers CNAM, comptabilité.
   ========================================================================== */
'use strict';

const MODES_PAIEMENT = {
  especes: 'Espèces', cheque: 'Chèque', virement: 'Virement', carte: 'Carte bancaire', traite: 'Traite',
};

const STATUT_CNAM = {
  a_deposer: ['À déposer', 'warn'],
  depose:    ['Déposé',    'info'],
  rembourse: ['Remboursé', 'ok'],
  rejete:    ['Rejeté',    'bad'],
};

const CATEGORIES_DEPENSE = [
  'Consommables', 'Laboratoire', 'Loyer', 'Salaires', 'Charges sociales', 'Énergie', 'Télécom',
  'Maintenance', 'Assurance', 'Formation', 'Impôts', 'Matériel', 'Publicité', 'Divers',
];

/* ================================================ Devis et factures ========= */

Views.factures = function (arg) {
  const f = S.filtres.factures || (S.filtres.factures = { type: 'facture', statut: '', q: '', periode: '' });
  if (arg) { const cible = Data.facture(arg); if (cible) f.type = cible.type; }

  let list = DB.factures.filter(x => x.type === f.type);
  if (f.q) {
    const t = U.norm(f.q);
    list = list.filter(x => U.norm(x.numero + ' ' + Data.patientNom(x.patientId)).includes(t));
  }
  if (f.statut) list = list.filter(x => Data.statutFacture(x) === f.statut);
  if (f.periode) list = list.filter(x => U.monthKey(x.date) === f.periode);
  list = U.sortBy(list, x => x.date + x.numero, 'desc');

  const toutes = DB.factures.filter(x => x.type === 'facture' && x.statut !== 'annulee');
  const totalFacture = U.sum(toutes, x => Data.totaux(x).total);
  const totalPaye = U.sum(toutes, x => Data.totaux(x).paye);
  const impayes = totalFacture - totalPaye;
  const enRetard = toutes.filter(x => Data.totaux(x).reste > 0.001 && x.echeance < U.todayISO());

  const mois = Array.from(new Set(DB.factures.map(x => U.monthKey(x.date)))).sort().reverse();

  return `
    <div class="page-head">
      <div class="titles"><h1>Devis &amp; factures</h1>
        <p>${list.length} document(s) — ${f.type === 'devis' ? 'propositions au patient' : 'facturation du cabinet'}</p></div>
      <div class="page-actions">
        ${Perm.can('facture.edit') ? `<button class="btn" data-act="new-devis">${Icons.doc} Nouveau devis</button>
          <button class="btn btn-primary" data-act="new-facture">${Icons.plus} Nouvelle facture</button>` : ''}
      </div>
    </div>

    <div class="grid">
      <div class="c3">${UI.kpi({ label: 'Chiffre facturé', value: U.money(totalFacture, false), unit: 'DT', kind: 'gold', foot: `${toutes.length} facture(s)` })}</div>
      <div class="c3">${UI.kpi({ label: 'Encaissé', value: U.money(totalPaye, false), unit: 'DT', kind: 'ok',
        foot: `${totalFacture > 0 ? Math.round(totalPaye / totalFacture * 100) : 0} % du facturé` })}</div>
      <div class="c3">${UI.kpi({ label: 'Reste à encaisser', value: U.money(impayes, false), unit: 'DT', kind: impayes > 0 ? 'warn' : 'ok',
        foot: `${toutes.filter(x => Data.totaux(x).reste > 0.001).length} facture(s) ouverte(s)` })}</div>
      <div class="c3">${UI.kpi({ label: 'En retard de paiement', value: enRetard.length, kind: enRetard.length ? 'bad' : 'ok',
        foot: U.money(U.sum(enRetard, x => Data.totaux(x).reste)) })}</div>

      <div class="c12"><div class="card">
        <div class="tabs">
          <button class="${f.type === 'facture' ? 'is-on' : ''}" data-type="facture" type="button">Factures<span class="count">${DB.factures.filter(x => x.type === 'facture').length}</span></button>
          <button class="${f.type === 'devis' ? 'is-on' : ''}" data-type="devis" type="button">Devis<span class="count">${DB.factures.filter(x => x.type === 'devis').length}</span></button>
        </div>
        <div class="tbl-toolbar">
          <input class="input search" data-f="q" type="search" placeholder="Numéro ou patient…" value="${U.esc(f.q)}">
          <select class="select" data-f="statut">
            <option value="">Tous les statuts</option>
            ${(f.type === 'devis' ? ['propose', 'accepte', 'refuse'] : ['emise', 'partielle', 'payee', 'annulee'])
              .map(s => `<option value="${s}"${f.statut === s ? ' selected' : ''}>${STATUT_FAC[s][0]}</option>`).join('')}
          </select>
          <select class="select" data-f="periode">
            <option value="">Toutes périodes</option>
            ${mois.map(m => `<option value="${m}"${f.periode === m ? ' selected' : ''}>${U.monthLabel(m)}</option>`).join('')}
          </select>
          <button class="btn btn-sm" data-act="export" type="button" style="margin-left:auto">${Icons.download} Exporter CSV</button>
        </div>
        <div class="table-wrap">
          ${list.length ? `<table class="tbl">
            <thead><tr>
              <th>Numéro</th><th>Patient</th><th>Date</th>
              <th class="num">Montant</th>${f.type === 'facture' ? '<th class="num">Réglé</th><th class="num">Reste</th>' : ''}
              <th>Statut</th><th></th>
            </tr></thead>
            <tbody>${list.map(x => {
              const t = Data.totaux(x); const st = Data.statutFacture(x);
              const retard = x.type === 'facture' && t.reste > 0.001 && x.echeance < U.todayISO();
              return `<tr class="clickable" data-fac="${x.id}">
                <td class="mono cell-strong">${U.esc(x.numero)}</td>
                <td>${U.esc(Data.patientNom(x.patientId))}</td>
                <td class="nowrap">${U.fmtDate(x.date)}${retard ? `<span class="cell-sub" style="color:var(--bad)">échue le ${U.fmtDate(x.echeance)}</span>` : ''}</td>
                <td class="num">${U.money(t.total)}</td>
                ${f.type === 'facture' ? `<td class="num">${U.money(t.paye)}</td>
                  <td class="num">${t.reste > 0.001 ? `<b style="color:var(--warn)">${U.money(t.reste)}</b>` : '<span class="muted">—</span>'}</td>` : ''}
                <td>${UI.badge((STATUT_FAC[st] || [st])[0], (STATUT_FAC[st] || ['', ''])[1])}</td>
                <td class="right"><button class="btn btn-sm btn-ghost" data-print="${x.id}" type="button" title="Imprimer">${Icons.print}</button></td>
              </tr>`;
            }).join('')}</tbody>
            <tfoot><tr>
              <td colspan="3">Total affiché</td>
              <td class="num">${U.money(U.sum(list, x => Data.totaux(x).total))}</td>
              ${f.type === 'facture' ? `<td class="num">${U.money(U.sum(list, x => Data.totaux(x).paye))}</td>
                <td class="num">${U.money(U.sum(list, x => Data.totaux(x).reste))}</td>` : ''}
              <td colspan="2"></td>
            </tr></tfoot>
          </table>` : UI.empty('Aucun document', 'Aucun devis ni facture ne correspond à ces critères.')}
        </div>
      </div></div>
    </div>`;
};

Views.facturesMount = function (arg) {
  const f = S.filtres.factures;
  if (arg && Data.facture(arg)) setTimeout(() => Views.factureView(arg), 30);
  Bind.click(e => {
    const t = e.target.closest('[data-type]');
    if (t) { f.type = t.dataset.type; f.statut = ''; App.render(); return; }
    const pr = e.target.closest('[data-print]');
    if (pr) { Views.printFacture(pr.dataset.print); return; }
    const fa = e.target.closest('[data-fac]');
    if (fa) { Views.factureView(fa.dataset.fac); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'new-facture') Views.factureDialog(null, 'facture');
    if (a.dataset.act === 'new-devis') Views.factureDialog(null, 'devis');
    if (a.dataset.act === 'export') Views.exportFactures();
  });
  const upd = e => {
    const k = e.target.dataset.f; if (!k) return;
    f[k] = e.target.value; App.render();
    if (k === 'q') { const i = U.$('[data-f="q"]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
  };
  Bind.change(upd);
  Bind.input(U.debounce(e => { if (e.target.dataset.f === 'q') upd(e); }, 260));
};

Views.exportFactures = function () {
  const rows = [['Numéro', 'Type', 'Date', 'Patient', 'Total', 'Réglé', 'Reste', 'Statut']];
  DB.factures.forEach(f => {
    const t = Data.totaux(f);
    rows.push([f.numero, f.type, f.date, Data.patientNom(f.patientId),
      t.total.toFixed(3), t.paye.toFixed(3), t.reste.toFixed(3), Data.statutFacture(f)]);
  });
  U.download(`factures-${U.todayISO()}.csv`, '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  UI.toast('Export terminé', 'Le fichier CSV s\'ouvre dans Excel ou LibreOffice.', 'ok');
};

/* ---- Création / modification ---- */
Views.factureDialog = function (id, type, pid, lignesInit, remiseInit) {
  const fac = id ? Data.facture(id) : null;
  type = fac ? fac.type : (type || 'facture');
  let lignes = fac ? fac.lignes.map(l => Object.assign({}, l)) : (lignesInit || []);

  const render = ov => {
    const form = ov.querySelector('#facForm');
    const remise = Number(form.remise.value || 0);
    const timbre = type === 'facture' ? Number(form.timbre.value || 0) : 0;
    const tva = Number(form.tva.value || 0);
    const brut = U.sum(lignes, l => Number(l.qte || 1) * Number(l.pu || 0));
    const ht = Math.max(0, brut - remise);
    const mtva = ht * tva / 100;
    const total = ht + mtva + timbre;

    ov.querySelector('#facLignes').innerHTML = lignes.length ? `<table class="tbl">
      <thead><tr><th>Désignation</th><th>Dents</th><th class="num">Qté</th><th class="num">P.U.</th><th class="num">Montant</th><th></th></tr></thead>
      <tbody>${lignes.map((l, i) => `<tr>
        <td><span class="cell-strong">${U.esc(l.libelle)}</span>${l.code ? `<span class="cell-sub mono">${U.esc(l.code)}</span>` : ''}</td>
        <td class="mono">${U.esc((l.dents || []).join(', ') || '—')}</td>
        <td class="num"><input class="input" type="number" min="1" step="1" value="${l.qte || 1}" data-q="${i}" style="width:66px;height:30px;text-align:right"></td>
        <td class="num"><input class="input" type="number" min="0" step="0.001" value="${l.pu}" data-pu="${i}" style="width:104px;height:30px;text-align:right"></td>
        <td class="num">${U.money((l.qte || 1) * l.pu)}</td>
        <td class="right"><button class="btn btn-sm btn-ghost" data-rm="${i}" type="button" style="color:var(--bad)">${Icons.x}</button></td>
      </tr>`).join('')}</tbody>
      <tfoot>
        <tr><td colspan="4">Total brut</td><td class="num">${U.money(brut)}</td><td></td></tr>
        ${remise ? `<tr><td colspan="4">Remise accordée</td><td class="num">− ${U.money(remise)}</td><td></td></tr>` : ''}
        ${tva ? `<tr><td colspan="4">TVA ${tva} %</td><td class="num">${U.money(mtva)}</td><td></td></tr>` : ''}
        ${timbre ? `<tr><td colspan="4">Droit de timbre</td><td class="num">${U.money(timbre)}</td><td></td></tr>` : ''}
        <tr><td colspan="4"><b>${type === 'devis' ? 'Montant du devis' : 'Net à payer'}</b></td><td class="num"><b>${U.money(total)}</b></td><td></td></tr>
      </tfoot></table>`
      : `<p class="muted" style="padding:16px">Aucune ligne. Choisissez un acte au catalogue ou saisissez une ligne libre.</p>`;
  };

  UI.modal({
    titre: fac ? `Modifier ${fac.numero}` : (type === 'devis' ? 'Nouveau devis' : 'Nouvelle facture'),
    sous: fac ? Data.patientNom(fac.patientId) : 'Les honoraires proviennent du catalogue d\'actes, modifiables ligne par ligne.',
    size: 'xl',
    body: `<form id="facForm"><div class="form-grid">
        <div class="field full"><label for="f_patientId">Patient *</label>
          <select class="select" id="f_patientId" name="patientId" required${fac ? ' disabled' : ''}>
            <option value="">— Choisir —</option>${UI.patientOptions(fac ? fac.patientId : (pid || ''))}</select></div>
        ${UI.field({ label: 'Date', name: 'date', type: 'date', value: fac ? fac.date : U.todayISO(), required: true })}
        ${UI.field({ label: 'Échéance', name: 'echeance', type: 'date', value: fac ? fac.echeance : U.addDays(U.todayISO(), 30) })}
        ${UI.field({ label: 'Remise (DT)', name: 'remise', type: 'number', step: '0.001', value: fac ? fac.remise : (remiseInit || 0) })}
        ${UI.field({ label: 'TVA (%)', name: 'tva', type: 'number', step: '0.1', value: fac ? fac.tva : DB.cabinet.tvaTaux,
          hint: 'Les actes de médecine dentaire sont exonérés de TVA.' })}
        ${type === 'facture' ? UI.field({ label: 'Droit de timbre (DT)', name: 'timbre', type: 'number', step: '0.001', value: fac ? fac.timbre : DB.cabinet.timbreFiscal })
          : '<input type="hidden" name="timbre" value="0">'}
        ${UI.field({ label: 'Statut', name: 'statut', type: 'select', value: fac ? fac.statut : (type === 'devis' ? 'propose' : 'emise'),
          options: type === 'devis' ? [['propose', 'Proposé'], ['accepte', 'Accepté'], ['refuse', 'Refusé']]
                                    : [['emise', 'Émise'], ['brouillon', 'Brouillon'], ['annulee', 'Annulée']] })}
        ${UI.field({ label: 'Note figurant sur le document', name: 'note', type: 'textarea', rows: 2, value: fac ? fac.note : '', full: true })}
      </div></form>

      <div class="row" style="margin:18px 0 10px;gap:8px;flex-wrap:wrap">
        <select class="select" id="facActe" style="flex:1 1 280px">
          ${Object.entries(U.groupBy(DB.actes.filter(a => a.actif), a => a.categorie)).map(([cat, arr]) =>
            `<optgroup label="${U.esc(cat)}">${arr.map(a => `<option value="${a.id}">${U.esc(a.code + ' · ' + a.libelle)} — ${U.money(a.prix)}</option>`).join('')}</optgroup>`).join('')}
        </select>
        <input class="input" id="facDents" placeholder="Dents (ex. 16, 26)" style="width:160px">
        <button class="btn btn-primary" id="facAdd" type="button">${Icons.plus} Ajouter l'acte</button>
        <button class="btn" id="facFree" type="button">Ligne libre</button>
      </div>
      <div class="table-wrap" id="facLignes" style="border:1px solid var(--line);border-radius:var(--r-sm)"></div>`,
    foot: `<button class="btn" data-close type="button">Annuler</button>
           <button class="btn btn-primary" data-save type="button">${fac ? 'Enregistrer' : 'Créer le document'}</button>`,
    onMount(ov) {
      render(ov);
      const form = ov.querySelector('#facForm');
      form.addEventListener('input', () => render(ov));

      ov.querySelector('#facAdd').addEventListener('click', () => {
        const a = Data.acte(ov.querySelector('#facActe').value);
        if (!a) return;
        lignes.push({ acteId: a.id, code: a.code, libelle: a.libelle, qte: 1, pu: a.prix,
          dents: ov.querySelector('#facDents').value.split(/[,\s]+/).filter(Boolean) });
        ov.querySelector('#facDents').value = '';
        render(ov);
      });

      ov.querySelector('#facFree').addEventListener('click', async () => {
        const lib = await UI.prompt('Ligne libre', 'Désignation', '');
        if (!lib) return;
        const pu = await UI.prompt('Ligne libre', 'Montant en dinars', '0', { type: 'number' });
        lignes.push({ acteId: null, code: '', libelle: lib, qte: 1, pu: Number(pu) || 0, dents: [] });
        render(ov);
      });

      ov.addEventListener('input', e => {
        const q = e.target.closest('[data-q]'); const pu = e.target.closest('[data-pu]');
        if (q) { lignes[Number(q.dataset.q)].qte = Number(q.value) || 1; render(ov); }
        if (pu) { lignes[Number(pu.dataset.pu)].pu = Number(pu.value) || 0; render(ov); }
      });

      ov.addEventListener('click', e => {
        const rm = e.target.closest('[data-rm]');
        if (rm) { lignes.splice(Number(rm.dataset.rm), 1); render(ov); return; }
        if (!e.target.closest('[data-save]')) return;

        const v = UI.formValues(form);
        const targetPid = fac ? fac.patientId : v.patientId;
        if (!targetPid) return UI.toast('Patient requis', '', 'bad');
        if (!lignes.length) return UI.toast('Document vide', 'Ajoutez au moins une ligne.', 'bad');

        const rec = fac || {
          id: U.uid('fac'), type, patientId: targetPid,
          numero: Data.numeroFacture(type), createdBy: Auth.current.id, createdAt: Date.now(),
        };
        Object.assign(rec, {
          patientId: targetPid, date: v.date, echeance: v.echeance, lignes,
          remise: Number(v.remise) || 0, tva: Number(v.tva) || 0,
          timbre: type === 'facture' ? (Number(v.timbre) || 0) : 0,
          statut: v.statut, note: v.note,
        });
        if (!fac) DB.factures.push(rec);

        /* Les actes facturés alimentent le dossier clinique */
        if (!fac && type === 'facture') {
          lignes.filter(l => l.acteId).forEach(l => {
            DB.soins.push({
              id: U.uid('soi'), patientId: targetPid, date: v.date, acteId: l.acteId, libelle: l.libelle,
              dents: l.dents || [], prix: l.pu, remise: 0, statut: 'realise', factureId: rec.id,
              note: '', by: Auth.current.id,
            });
          });
        }

        Audit.log(fac ? 'modification' : 'creation', type, rec.id, `${rec.numero} — ${Data.patientNom(targetPid)} — ${U.money(Data.totaux(rec).total)}`);
        Data.commit(); UI.close(ov);
        UI.toast(fac ? 'Document enregistré' : (type === 'devis' ? 'Devis créé' : 'Facture créée'), rec.numero, 'ok');
        if (!fac) Views.factureView(rec.id);
      });
    },
  });
};

/* ---- Consultation d'une facture ---- */
Views.factureView = function (id) {
  const f = Data.facture(id);
  if (!f) return;
  const t = Data.totaux(f);
  const st = Data.statutFacture(f);
  const pays = DB.paiements.filter(p => p.factureId === f.id);
  const dossier = DB.cnam.find(c => c.factureId === f.id);
  const p = Data.patient(f.patientId);

  UI.modal({
    titre: f.numero,
    sous: `${Data.patientNom(f.patientId)} — ${U.fmtDate(f.date)} — ${U.money(t.total)}`,
    size: 'lg',
    body: `
      <div class="row" style="gap:8px;margin-bottom:16px;flex-wrap:wrap">
        ${UI.badge((STATUT_FAC[st] || [st])[0], (STATUT_FAC[st] || ['', ''])[1])}
        ${f.type === 'facture' && t.reste > 0.001 ? UI.badge(`Reste ${U.money(t.reste)}`, 'warn') : ''}
        ${dossier ? UI.badge('CNAM · ' + STATUT_CNAM[dossier.statut][0], STATUT_CNAM[dossier.statut][1]) : ''}
      </div>

      <div class="table-wrap" style="border:1px solid var(--line);border-radius:var(--r-sm)">
        <table class="tbl">
          <thead><tr><th>Désignation</th><th>Dents</th><th class="num">Qté</th><th class="num">P.U.</th><th class="num">Montant</th></tr></thead>
          <tbody>${f.lignes.map(l => `<tr>
            <td><span class="cell-strong">${U.esc(l.libelle)}</span>${l.code ? `<span class="cell-sub mono">${U.esc(l.code)}</span>` : ''}</td>
            <td class="mono">${U.esc((l.dents || []).join(', ') || '—')}</td>
            <td class="num">${l.qte || 1}</td><td class="num">${U.money(l.pu)}</td>
            <td class="num">${U.money((l.qte || 1) * l.pu)}</td></tr>`).join('')}</tbody>
          <tfoot>
            <tr><td colspan="4">Total brut</td><td class="num">${U.money(t.brut)}</td></tr>
            ${t.remise ? `<tr><td colspan="4">Remise</td><td class="num">− ${U.money(t.remise)}</td></tr>` : ''}
            ${t.tva ? `<tr><td colspan="4">TVA</td><td class="num">${U.money(t.tva)}</td></tr>` : ''}
            ${t.timbre ? `<tr><td colspan="4">Droit de timbre</td><td class="num">${U.money(t.timbre)}</td></tr>` : ''}
            <tr><td colspan="4"><b>${f.type === 'devis' ? 'Montant du devis' : 'Net à payer'}</b></td><td class="num"><b>${U.money(t.total)}</b></td></tr>
            ${f.type === 'facture' ? `<tr><td colspan="4">Déjà réglé</td><td class="num">${U.money(t.paye)}</td></tr>
              <tr><td colspan="4"><b>Reste dû</b></td><td class="num"><b style="color:${t.reste > 0.001 ? 'var(--warn)' : 'var(--ok)'}">${U.money(t.reste)}</b></td></tr>` : ''}
          </tfoot>
        </table>
      </div>

      ${f.note ? `<p class="muted" style="margin-top:14px"><b>Note :</b> ${U.esc(f.note)}</p>` : ''}

      ${pays.length ? `<h3 style="margin:20px 0 8px">Règlements</h3>
        <div class="col" style="gap:0;border:1px solid var(--line);border-radius:var(--r-sm)">
        ${pays.map(x => `<div class="list-line">
          <div class="ll-main"><b>${U.money(x.montant)}</b><span>${U.fmtDate(x.date)} · ${MODES_PAIEMENT[x.mode] || x.mode}${x.reference ? ' · ' + U.esc(x.reference) : ''}</span></div>
          ${Perm.can('paiement.edit') ? `<button class="btn btn-sm btn-ghost" data-delpay="${x.id}" type="button" style="color:var(--bad)">${Icons.trash}</button>` : ''}
        </div>`).join('')}</div>` : ''}

      ${p && p.assurance.type === 'cnam' && f.type === 'facture' && !dossier && Perm.can('cnam.edit') ? `
        <div class="alert-band a-info" style="margin-top:16px">${Icons.shield}
          <span>Ce patient est affilié CNAM. <b>Créez le dossier de remboursement</b> pour suivre le dépôt et le versement.</span></div>` : ''}`,
    foot: `<div class="left row" style="gap:6px">
        ${Perm.can('facture.edit') && f.statut !== 'annulee' ? `<button class="btn btn-sm" data-edit type="button">${Icons.edit} Modifier</button>` : ''}
        ${f.type === 'devis' && Perm.can('facture.edit') ? `<button class="btn btn-sm" data-convert type="button">${Icons.receipt} Convertir en facture</button>` : ''}
        ${f.type === 'facture' && t.reste > 0.001 && Perm.can('paiement.edit') ? `<button class="btn btn-sm btn-primary" data-pay type="button">${Icons.money} Encaisser</button>` : ''}
        ${f.type === 'facture' && !dossier && Perm.can('cnam.edit') && p && p.assurance.type === 'cnam' ? `<button class="btn btn-sm" data-cnam type="button">${Icons.shield} Dossier CNAM</button>` : ''}
        ${Perm.can('facture.delete') && f.statut !== 'annulee' ? `<button class="btn btn-sm btn-ghost" data-cancel type="button" style="color:var(--bad)">Annuler la facture</button>` : ''}
      </div>
      <button class="btn" data-close type="button">Fermer</button>
      <button class="btn btn-primary" data-print type="button">${Icons.print} Imprimer</button>`,
    onMount(ov) {
      ov.addEventListener('click', async e => {
        if (e.target.closest('[data-print]')) { UI.close(ov); Views.printFacture(f.id); return; }
        if (e.target.closest('[data-edit]')) { UI.close(ov); Views.factureDialog(f.id); return; }
        if (e.target.closest('[data-pay]')) { UI.close(ov); Views.paiementDialog(f.id); return; }
        if (e.target.closest('[data-cnam]')) { UI.close(ov); Views.cnamDialog(null, f.id); return; }
        if (e.target.closest('[data-convert]')) {
          const nf = {
            id: U.uid('fac'), type: 'facture', patientId: f.patientId, numero: Data.numeroFacture('facture'),
            date: U.todayISO(), echeance: U.addDays(U.todayISO(), 30), lignes: f.lignes.map(l => Object.assign({}, l)),
            remise: f.remise, tva: f.tva, timbre: DB.cabinet.timbreFiscal, statut: 'emise',
            note: `Suite au devis ${f.numero}.`, createdBy: Auth.current.id, createdAt: Date.now(),
          };
          DB.factures.push(nf);
          f.statut = 'accepte';
          Audit.log('conversion', 'facture', nf.id, `${f.numero} → ${nf.numero}`);
          Data.commit(); UI.close(ov);
          UI.toast('Devis converti', `Facture ${nf.numero} créée.`, 'ok');
          Views.factureView(nf.id);
          return;
        }
        const dp = e.target.closest('[data-delpay]');
        if (dp) {
          const ok = await UI.confirm('Supprimer ce règlement ?', 'Le montant sera de nouveau dû.', { danger: true, ok: 'Supprimer' });
          if (!ok) return;
          DB.paiements = DB.paiements.filter(x => x.id !== dp.dataset.delpay);
          Audit.log('suppression', 'paiement', dp.dataset.delpay, f.numero);
          Data.commit(); UI.close(ov); Views.factureView(f.id);
          return;
        }
        if (e.target.closest('[data-cancel]')) {
          const ok = await UI.confirm('Annuler cette facture ?', 'La facture reste au registre mais n\'est plus comptabilisée.', { danger: true, ok: 'Annuler la facture' });
          if (!ok) return;
          f.statut = 'annulee';
          Audit.log('annulation', 'facture', f.id, f.numero);
          Data.commit(); UI.close(ov);
          UI.toast('Facture annulée', f.numero, 'ok');
        }
      });
    },
  });
};

Views.printFacture = function (id) {
  const f = Data.facture(id);
  if (!f) return;
  const t = Data.totaux(f);
  const p = Data.patient(f.patientId);
  const c = DB.cabinet;
  const estDevis = f.type === 'devis';

  UI.modal({
    titre: estDevis ? 'Devis' : 'Facture', size: 'lg',
    body: `<div class="print-doc">
      <div class="pd-head">${Views._entete()}
        <div class="doc"><b>${estDevis ? 'Devis' : 'Facture'}</b>
          <span>N° ${U.esc(f.numero)}</span><span>${U.fmtDate(f.date)}</span></div></div>

      <table style="width:auto;margin-bottom:6px;border:0">
        <tr><td style="border:0;padding:2px 0"><b>Patient</b></td><td style="border:0;padding:2px 0 2px 14px">${p ? U.esc(p.prenom + ' ' + p.nom) : '—'}</td></tr>
        ${p && p.cin ? `<tr><td style="border:0;padding:2px 0"><b>CIN</b></td><td style="border:0;padding:2px 0 2px 14px">${U.esc(p.cin)}</td></tr>` : ''}
        ${p && p.assurance.numero ? `<tr><td style="border:0;padding:2px 0"><b>${p.assurance.type === 'cnam' ? 'N° CNAM' : 'Assurance'}</b></td><td style="border:0;padding:2px 0 2px 14px">${U.esc(p.assurance.numero)}</td></tr>` : ''}
        ${p && p.adresse ? `<tr><td style="border:0;padding:2px 0"><b>Adresse</b></td><td style="border:0;padding:2px 0 2px 14px">${U.esc([p.adresse, p.ville].filter(Boolean).join(', '))}</td></tr>` : ''}
      </table>

      <table>
        <thead><tr><th>Code</th><th>Désignation de l'acte</th><th>Dents</th><th class="num">Qté</th><th class="num">P.U. (DT)</th><th class="num">Montant (DT)</th></tr></thead>
        <tbody>${f.lignes.map(l => `<tr>
          <td>${U.esc(l.code || '—')}</td><td>${U.esc(l.libelle)}</td>
          <td>${U.esc((l.dents || []).join(', ') || '—')}</td>
          <td class="num">${l.qte || 1}</td><td class="num">${U.money(l.pu, false)}</td>
          <td class="num">${U.money((l.qte || 1) * l.pu, false)}</td></tr>`).join('')}</tbody>
      </table>

      <div class="pd-tot"><table>
        <tr><td>Total brut</td><td class="num">${U.money(t.brut, false)}</td></tr>
        ${t.remise ? `<tr><td>Remise</td><td class="num">− ${U.money(t.remise, false)}</td></tr>` : ''}
        ${t.tva ? `<tr><td>TVA</td><td class="num">${U.money(t.tva, false)}</td></tr>` : ''}
        ${t.timbre ? `<tr><td>Droit de timbre</td><td class="num">${U.money(t.timbre, false)}</td></tr>` : ''}
        <tr><td><b>${estDevis ? 'Montant du devis' : 'Net à payer'}</b></td><td class="num"><b>${U.money(t.total, false)} DT</b></td></tr>
        ${!estDevis && t.paye > 0 ? `<tr><td>Réglé</td><td class="num">${U.money(t.paye, false)}</td></tr>
          <tr><td><b>Reste dû</b></td><td class="num"><b>${U.money(t.reste, false)} DT</b></td></tr>` : ''}
      </table></div>

      ${!estDevis && t.reste <= 0.001 ? `<p style="margin-top:14px;font-weight:700;color:#16794A">FACTURE ACQUITTÉE le ${U.fmtDate((DB.paiements.filter(x => x.factureId === f.id).slice(-1)[0] || {}).date || f.date)}</p>` : ''}
      ${f.note ? `<p style="margin-top:12px"><b>Note :</b> ${U.esc(f.note)}</p>` : ''}
      ${estDevis ? `<p style="margin-top:12px;font-size:11.5px">Devis valable 30 jours. Le patient reconnaît avoir été informé du montant des honoraires et du plan de traitement proposé.</p>
        <div class="pd-sign"><span>Signature du patient<br>(précédée de « lu et approuvé »)<br><br>_______________________</span>
        <span>${U.esc(c.ville.split(',').pop().trim())}, le ${U.fmtDate(f.date)}<br><br><b>${U.esc(c.praticien)}</b></span></div>`
        : `<div class="pd-sign"><span></span><span>${U.esc(c.ville.split(',').pop().trim())}, le ${U.fmtDate(f.date)}<br><br><b>${U.esc(c.praticien)}</b><br>Signature et cachet</span></div>`}

      <div class="pd-foot">
        ${U.esc(c.mentionsFacture || '')}<br>
        ${U.esc(c.nom)} · ${U.esc(c.adresse)}, ${U.esc(c.codePostal)} ${U.esc(c.ville)} · Tél. ${U.esc(c.tel)}
        ${c.matriculeFiscal ? ' · Matricule fiscal ' + U.esc(c.matriculeFiscal) : ''}${c.rib ? ' · RIB ' + U.esc(c.rib) : ''}
      </div>
    </div>`,
    foot: `<button class="btn" data-close type="button">Fermer</button>
           <button class="btn btn-primary" onclick="window.print()" type="button">${Icons.print} Imprimer</button>`,
  });
};

/* ---- Encaissement ---- */
Views.paiementDialog = function (facId) {
  const f = facId ? Data.facture(facId) : null;
  const reste = f ? Data.totaux(f).reste : 0;
  const ouvertes = DB.factures.filter(x => x.type === 'facture' && x.statut !== 'annulee' && Data.totaux(x).reste > 0.001);

  UI.modal({
    titre: 'Encaisser un règlement',
    sous: f ? `${f.numero} — ${Data.patientNom(f.patientId)} — reste ${U.money(reste)}` : `${ouvertes.length} facture(s) en attente de règlement`,
    size: 'sm',
    body: `<form id="payForm" class="col" style="gap:14px">
      ${f ? `<input type="hidden" name="factureId" value="${f.id}">`
          : `<div class="field"><label for="f_factureId">Facture *</label>
             <select class="select" id="f_factureId" name="factureId" required>
               <option value="">— Choisir —</option>
               ${U.sortBy(ouvertes, x => x.date, 'desc').map(x => `<option value="${x.id}">${U.esc(x.numero)} — ${U.esc(Data.patientNom(x.patientId))} — reste ${U.money(Data.totaux(x).reste)}</option>`).join('')}
             </select></div>`}
      ${UI.field({ label: 'Montant (DT)', name: 'montant', type: 'number', step: '0.001', min: 0, value: f ? reste.toFixed(3) : '', required: true })}
      ${UI.field({ label: 'Mode de règlement', name: 'mode', type: 'select', value: 'especes',
        options: Object.entries(MODES_PAIEMENT).map(([k, v]) => [k, v]) })}
      ${UI.field({ label: 'Date', name: 'date', type: 'date', value: U.todayISO(), required: true })}
      ${UI.field({ label: 'Référence (chèque, bordereau…)', name: 'reference' })}
    </form>`,
    foot: `<button class="btn" data-close type="button">Annuler</button>
           <button class="btn btn-primary" data-save type="button">Enregistrer le règlement</button>`,
    onMount(ov) {
      const form = ov.querySelector('#payForm');
      if (!f) form.factureId.addEventListener('change', () => {
        const x = Data.facture(form.factureId.value);
        if (x) form.montant.value = Data.totaux(x).reste.toFixed(3);
      });
      ov.addEventListener('click', e => {
        if (!e.target.closest('[data-save]')) return;
        const v = UI.formValues(form);
        const fac = Data.facture(v.factureId);
        if (!fac) return UI.toast('Facture requise', '', 'bad');
        const montant = Number(v.montant);
        if (!(montant > 0)) return UI.toast('Montant invalide', '', 'bad');
        const caisseJour = DB.caisse.find(c => c.date === v.date && c.statut === 'ouverte');
        DB.paiements.push({
          id: U.uid('pay'), factureId: fac.id, patientId: fac.patientId, date: v.date,
          montant, mode: v.mode, reference: v.reference, note: '',
          by: Auth.current.id, caisseId: v.mode === 'especes' && caisseJour ? caisseJour.id : null,
        });
        Audit.log('encaissement', 'paiement', fac.id, `${U.money(montant)} — ${MODES_PAIEMENT[v.mode]} — ${fac.numero}`);
        Data.commit(); UI.close(ov);
        UI.toast('Règlement enregistré', `${U.money(montant)} — ${Data.patientNom(fac.patientId)}`, 'ok');
      });
    },
  });
};

/* ==================================================== Caisse =============== */

Views.caisse = function () {
  const today = U.todayISO();
  const session = DB.caisse.find(c => c.date === today) || null;
  const paysJour = DB.paiements.filter(p => p.date === today);
  const parMode = U.groupBy(paysJour, p => p.mode);
  const especes = U.sum(parMode.especes || [], p => p.montant);
  const total = U.sum(paysJour, p => p.montant);
  const attendu = (session ? session.fondCaisse : 0) + especes;
  const historique = U.sortBy(DB.caisse.filter(c => c.date !== today), c => c.date, 'desc').slice(0, 14);

  const modes = Object.keys(MODES_PAIEMENT).map(m => ({
    label: MODES_PAIEMENT[m], v: U.sum(parMode[m] || [], p => p.montant), n: (parMode[m] || []).length,
    color: { especes: 'var(--gold)', cheque: 'var(--info)', virement: 'var(--accent)', carte: 'var(--t-couronne)', traite: 'var(--ink-mute)' }[m],
  }));

  return `
    <div class="page-head">
      <div class="titles"><h1>Caisse</h1>
        <p>${U.fmtDateLong(today).charAt(0).toUpperCase() + U.fmtDateLong(today).slice(1)}${session ? ` — ouverte à ${session.ouverture}` : ' — caisse non ouverte'}</p></div>
      <div class="page-actions">
        ${Perm.can('paiement.edit') ? `<button class="btn btn-primary" data-act="pay">${Icons.money} Encaisser</button>` : ''}
        ${!session && Perm.can('caisse.close') ? `<button class="btn" data-act="open">Ouvrir la caisse</button>` : ''}
        ${session && session.statut === 'ouverte' && Perm.can('caisse.close') ? `<button class="btn" data-act="close">${Icons.check} Clôturer la journée</button>` : ''}
      </div>
    </div>

    <div class="grid">
      <div class="c3">${UI.kpi({ label: 'Recette du jour', value: U.money(total, false), unit: 'DT', kind: 'gold', foot: `${paysJour.length} règlement(s)` })}</div>
      <div class="c3">${UI.kpi({ label: 'Espèces en caisse', value: U.money(attendu, false), unit: 'DT',
        foot: `Fond ${U.money(session ? session.fondCaisse : 0)} + ${U.money(especes)}` })}</div>
      <div class="c3">${UI.kpi({ label: 'Encaissements non espèces', value: U.money(total - especes, false), unit: 'DT', kind: 'ok',
        foot: 'Chèques, virements, cartes' })}</div>
      <div class="c3">${UI.kpi({ label: 'Statut', value: session ? (session.statut === 'ouverte' ? 'Ouverte' : 'Clôturée') : 'Fermée',
        kind: session && session.statut === 'ouverte' ? 'warn' : 'ok',
        foot: session && session.fermeture ? `Clôturée à ${session.fermeture}` : 'Clôture en fin de journée' })}</div>

      <div class="c7">${UI.card('Règlements du jour',
        paysJour.length ? `<div class="table-wrap"><table class="tbl">
          <thead><tr><th>Patient</th><th>Facture</th><th>Mode</th><th>Référence</th><th class="num">Montant</th></tr></thead>
          <tbody>${U.sortBy(paysJour, p => p.id).map(p => `<tr>
            <td class="cell-strong">${U.esc(Data.patientNom(p.patientId))}</td>
            <td class="mono">${U.esc((Data.facture(p.factureId) || {}).numero || '—')}</td>
            <td>${UI.badge(MODES_PAIEMENT[p.mode] || p.mode, p.mode === 'especes' ? 'gold' : 'info', true)}</td>
            <td class="muted">${U.esc(p.reference || '—')}</td>
            <td class="num cell-strong">${U.money(p.montant)}</td>
          </tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="4">Total encaissé</td><td class="num">${U.money(total)}</td></tr></tfoot>
        </table></div>` : UI.empty('Aucun encaissement', "Aucun règlement n'a encore été enregistré aujourd'hui."),
        { flush: paysJour.length > 0 })}</div>

      <div class="c5">${UI.card('Répartition par mode',
        total > 0 ? `<div class="donut-row">
          ${UI.donut(modes.filter(m => m.v > 0), total)}
          <div class="col grow" style="gap:8px">
            ${modes.filter(m => m.v > 0).map(m => `<div class="row" style="justify-content:space-between">
              <span class="row" style="gap:7px"><i style="width:9px;height:9px;border-radius:2px;background:${m.color};display:block"></i>${m.label}</span>
              <b class="num">${U.money(m.v)}</b></div>`).join('')}
          </div></div>` : `<p class="muted">Aucun encaissement à répartir.</p>`)}

        <div style="margin-top:var(--gap)">${UI.card('Dernières journées',
          historique.length ? `<div class="col" style="gap:0">${historique.map(c => {
            const enc = U.sum(DB.paiements.filter(p => p.date === c.date), p => p.montant);
            return `<div class="list-line" style="padding-left:0;padding-right:0">
              <div class="ll-main"><b>${U.fmtDate(c.date)}</b><span>${c.statut === 'cloturee' ? `Clôturée à ${c.fermeture}` : 'Non clôturée'}${Math.abs(c.ecart || 0) > 0.001 ? ` · écart ${U.money(c.ecart)}` : ''}</span></div>
              <b class="num">${U.money(enc)}</b></div>`;
          }).join('')}</div>` : `<p class="muted">Aucun historique.</p>`, { flush: historique.length > 0 })}</div>
      </div>
    </div>`;
};

Views.caisseMount = function () {
  Bind.click(async e => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const today = U.todayISO();
    if (a.dataset.act === 'pay') return Views.paiementDialog(null);
    if (a.dataset.act === 'open') {
      const fond = await UI.prompt('Ouverture de caisse', 'Fond de caisse en dinars', '100', { type: 'number' });
      if (fond === null) return;
      DB.caisse.push({
        id: U.uid('cai'), date: today, ouverture: U.minutesToHM(new Date().getHours() * 60 + new Date().getMinutes()),
        fermeture: '', fondCaisse: Number(fond) || 0, totalEspeces: 0, ecart: 0, statut: 'ouverte',
        by: Auth.current.id, note: '',
      });
      Audit.log('ouverture', 'caisse', today, `Fond ${U.money(Number(fond) || 0)}`);
      Data.commit();
      UI.toast('Caisse ouverte', '', 'ok');
      return;
    }
    if (a.dataset.act === 'close') {
      const session = DB.caisse.find(c => c.date === today);
      const especes = U.sum(DB.paiements.filter(p => p.date === today && p.mode === 'especes'), p => p.montant);
      const attendu = session.fondCaisse + especes;
      const compte = await UI.prompt('Clôture de caisse',
        `Espèces comptées en caisse (attendu : ${U.money(attendu)})`, attendu.toFixed(3), { type: 'number' });
      if (compte === null) return;
      session.fermeture = U.minutesToHM(new Date().getHours() * 60 + new Date().getMinutes());
      session.totalEspeces = Number(compte) || 0;
      session.ecart = session.totalEspeces - attendu;
      session.statut = 'cloturee';
      Audit.log('cloture', 'caisse', today, `Compté ${U.money(session.totalEspeces)} — écart ${U.money(session.ecart)}`);
      Data.commit();
      UI.toast('Caisse clôturée',
        Math.abs(session.ecart) < 0.001 ? 'Aucun écart constaté.' : `Écart de ${U.money(session.ecart)}.`,
        Math.abs(session.ecart) < 0.001 ? 'ok' : 'warn');
    }
  });
};

/* ====================================================== CNAM =============== */

Views.cnam = function () {
  const list = U.sortBy(DB.cnam, c => c.date, 'desc');
  const parStatut = U.groupBy(list, c => c.statut);
  const attendu = U.sum((parStatut.depose || []).concat(parStatut.a_deposer || []), c => c.montantRemb);
  const recu = U.sum(parStatut.rembourse || [], c => c.montantRemb);

  return `
    <div class="page-head">
      <div class="titles"><h1>Dossiers CNAM</h1>
        <p>${list.length} dossier(s) — suivi des remboursements de la Caisse Nationale d'Assurance Maladie</p></div>
      <div class="page-actions">
        ${Perm.can('cnam.edit') ? `<button class="btn" data-act="bordereau">${Icons.print} Bordereau de dépôt</button>
          <button class="btn btn-primary" data-act="new">${Icons.plus} Nouveau dossier</button>` : ''}
      </div>
    </div>

    <div class="grid">
      <div class="c3">${UI.kpi({ label: 'À déposer', value: (parStatut.a_deposer || []).length, kind: 'warn',
        foot: U.money(U.sum(parStatut.a_deposer || [], c => c.montantRemb)) })}</div>
      <div class="c3">${UI.kpi({ label: 'Déposés, en attente', value: (parStatut.depose || []).length, kind: 'info',
        foot: U.money(U.sum(parStatut.depose || [], c => c.montantRemb)) })}</div>
      <div class="c3">${UI.kpi({ label: 'Remboursés', value: (parStatut.rembourse || []).length, kind: 'ok', foot: U.money(recu) })}</div>
      <div class="c3">${UI.kpi({ label: 'Rejetés', value: (parStatut.rejete || []).length, kind: (parStatut.rejete || []).length ? 'bad' : 'ok',
        foot: U.money(U.sum(parStatut.rejete || [], c => c.montantRemb)) })}</div>

      <div class="c8">${UI.card('Tous les dossiers',
        list.length ? `<div class="table-wrap"><table class="tbl">
          <thead><tr><th>Patient</th><th>Type</th><th>Facture</th><th class="num">Base</th><th class="num">Remboursement</th><th>Bordereau</th><th>Statut</th></tr></thead>
          <tbody>${list.map(c => `<tr class="clickable" data-cnam="${c.id}">
            <td><span class="cell-strong">${U.esc(Data.patientNom(c.patientId))}</span><span class="cell-sub">${U.fmtDate(c.date)}</span></td>
            <td>${c.type === 'prothese' ? 'Prothèse' : 'Soins'}</td>
            <td class="mono">${U.esc((Data.facture(c.factureId) || {}).numero || '—')}</td>
            <td class="num">${U.money(c.baseRemb)}</td>
            <td class="num cell-strong">${U.money(c.montantRemb)}</td>
            <td class="mono">${U.esc(c.bordereau || '—')}</td>
            <td>${UI.badge(STATUT_CNAM[c.statut][0], STATUT_CNAM[c.statut][1])}</td>
          </tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="4">Total à récupérer (déposés + à déposer)</td>
            <td class="num">${U.money(attendu)}</td><td colspan="2"></td></tr></tfoot>
        </table></div>` : UI.empty('Aucun dossier CNAM', 'Créez un dossier depuis une facture pour suivre son remboursement.'),
        { flush: list.length > 0 })}</div>

      <div class="c4">${UI.card('Règles de prise en charge', `
        <div class="stack-sm" style="font-size:13px;line-height:1.6">
          <div class="alert-band a-info" style="display:block">
            <b>Soins dentaires ambulatoires</b><br>
            Plafond annuel de <b>150 DT</b>, en sus du plafond général de l'assuré.
          </div>
          <div class="alert-band a-ok" style="display:block">
            <b>Prothèses dentaires</b><br>
            Prises en charge <b>hors plafond</b> et <b>sans accord préalable</b>, selon la nomenclature générale des prothèses.
          </div>
          <div class="alert-band a-warn" style="display:block">
            <b>Pas de tiers payant</b><br>
            Le patient règle la totalité puis se fait rembourser. La facture doit être <b>acquittée et cachetée</b>.
          </div>
          <p class="muted">Les soins dentaires sont dispensés du passage obligatoire par le médecin de famille. Le taux appliqué par défaut est de 70 % de la base conventionnelle ; ajustez-le dossier par dossier.</p>
        </div>`)}</div>
    </div>`;
};

Views.cnamMount = function () {
  Bind.click(e => {
    const c = e.target.closest('[data-cnam]');
    if (c) return Views.cnamDialog(c.dataset.cnam);
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'new') Views.cnamDialog(null);
    if (a.dataset.act === 'bordereau') Views.bordereauCnam();
  });
};

Views.cnamDialog = function (id, facId) {
  const d = id ? DB.cnam.find(x => x.id === id) : null;
  const fac = facId ? Data.facture(facId) : (d ? Data.facture(d.factureId) : null);
  const ro = !Perm.can('cnam.edit');
  const facturesCnam = DB.factures.filter(f => {
    if (f.type !== 'facture' || f.statut === 'annulee') return false;
    const p = Data.patient(f.patientId);
    return p && p.assurance.type === 'cnam' && !DB.cnam.some(c => c.factureId === f.id);
  });

  const totalFac = fac ? Data.totaux(fac).total : 0;

  UI.modal({
    titre: d ? 'Dossier CNAM' : 'Nouveau dossier CNAM',
    sous: d ? Data.patientNom(d.patientId) : 'Rattaché à une facture acquittée',
    size: 'lg',
    body: `<form id="cnamForm"><div class="form-grid">
      ${d || fac ? `<div class="field full"><label>Facture</label>
          <input class="input" value="${U.esc(fac ? fac.numero + ' — ' + Data.patientNom(fac.patientId) + ' — ' + U.money(totalFac) : '—')}" disabled>
          <input type="hidden" name="factureId" value="${fac ? fac.id : ''}"></div>`
        : `<div class="field full"><label for="f_factureId">Facture *</label>
          <select class="select" id="f_factureId" name="factureId" required>
            <option value="">— Choisir une facture —</option>
            ${U.sortBy(facturesCnam, f => f.date, 'desc').map(f => `<option value="${f.id}">${U.esc(f.numero)} — ${U.esc(Data.patientNom(f.patientId))} — ${U.money(Data.totaux(f).total)}</option>`).join('')}
          </select>${facturesCnam.length ? '' : '<span class="hint">Toutes les factures des patients CNAM ont déjà un dossier.</span>'}</div>`}
      ${UI.field({ label: 'Nature', name: 'type', type: 'select', value: d ? d.type : 'soins',
        options: [['soins', 'Soins dentaires (plafond 150 DT / an)'], ['prothese', 'Prothèse (hors plafond)']] })}
      ${UI.field({ label: 'Date des soins', name: 'date', type: 'date', value: d ? d.date : (fac ? fac.date : U.todayISO()), required: true })}
      ${UI.field({ label: 'Base de remboursement (DT)', name: 'baseRemb', type: 'number', step: '0.001', value: d ? d.baseRemb : '',
        hint: 'Tarif conventionnel retenu par la CNAM, souvent inférieur aux honoraires.' })}
      ${UI.field({ label: 'Taux (%)', name: 'taux', type: 'number', step: '1', value: d ? d.taux : 70 })}
      ${UI.field({ label: 'Statut', name: 'statut', type: 'select', value: d ? d.statut : 'a_deposer',
        options: Object.entries(STATUT_CNAM).map(([k, v]) => [k, v[0]]) })}
      ${UI.field({ label: 'N° de bordereau', name: 'bordereau', value: d ? d.bordereau : '' })}
      ${UI.field({ label: 'Date de dépôt', name: 'dateDepot', type: 'date', value: d ? d.dateDepot : '' })}
      ${UI.field({ label: 'Date de remboursement', name: 'dateRemb', type: 'date', value: d ? d.dateRemb : '' })}
      ${UI.field({ label: 'Observations', name: 'note', type: 'textarea', rows: 2, value: d ? d.note : '', full: true })}
    </div>
    <div class="alert-band a-info" style="margin-top:16px" id="cnamCalc">${Icons.money}<span></span></div>
    </form>`,
    foot: `<div class="left">${d && !ro ? `<button class="btn btn-sm btn-ghost" data-del type="button" style="color:var(--bad)">${Icons.trash} Supprimer</button>` : ''}</div>
      <button class="btn" data-close type="button">Fermer</button>
      ${ro ? '' : `<button class="btn btn-primary" data-save type="button">Enregistrer</button>`}`,
    onMount(ov) {
      const form = ov.querySelector('#cnamForm');
      if (ro) U.$$('input,select,textarea', form).forEach(i => { i.disabled = true; });

      const calc = () => {
        const base = Number(form.baseRemb.value || 0);
        const taux = Number(form.taux.value || 0);
        const remb = base * taux / 100;
        const plafond = form.type.value === 'soins' ? 150 : null;
        const retenu = plafond !== null ? Math.min(remb, plafond) : remb;
        ov.querySelector('#cnamCalc span').innerHTML =
          `Remboursement estimé : <b>${U.money(retenu)}</b> (base ${U.money(base)} × ${taux} %${plafond !== null && remb > plafond ? ` — plafonné à ${U.money(plafond)}` : ''}).`;
        return retenu;
      };
      form.addEventListener('input', calc);
      form.addEventListener('change', () => {
        const f2 = Data.facture(form.factureId.value);
        if (f2 && !form.baseRemb.value) {
          const t = Data.totaux(f2).total;
          form.baseRemb.value = (form.type.value === 'prothese' ? Math.min(400, t) : Math.min(215, t)).toFixed(3);
        }
        calc();
      });
      calc();

      ov.addEventListener('click', async e => {
        if (e.target.closest('[data-del]')) {
          const ok = await UI.confirm('Supprimer ce dossier ?', 'Le suivi CNAM de cette facture sera perdu.', { danger: true, ok: 'Supprimer' });
          if (!ok) return;
          DB.cnam = DB.cnam.filter(x => x.id !== d.id);
          Audit.log('suppression', 'cnam', d.id, Data.patientNom(d.patientId));
          Data.commit(); UI.close(ov); return;
        }
        if (!e.target.closest('[data-save]')) return;
        const v = UI.formValues(form);
        const f2 = Data.facture(v.factureId);
        if (!f2) return UI.toast('Facture requise', '', 'bad');
        const rec = d || { id: U.uid('cnm'), patientId: f2.patientId };
        Object.assign(rec, {
          patientId: f2.patientId, factureId: f2.id, date: v.date, type: v.type,
          montantFacture: Data.totaux(f2).total, baseRemb: Number(v.baseRemb) || 0,
          taux: Number(v.taux) || 0, montantRemb: calc(), statut: v.statut,
          bordereau: v.bordereau, dateDepot: v.dateDepot, dateRemb: v.dateRemb, note: v.note,
        });
        if (!d) DB.cnam.push(rec);
        Audit.log(d ? 'modification' : 'creation', 'cnam', rec.id, `${Data.patientNom(rec.patientId)} — ${U.money(rec.montantRemb)}`);
        Data.commit(); UI.close(ov);
        UI.toast('Dossier enregistré', `${U.money(rec.montantRemb)} attendus de la CNAM`, 'ok');
      });
    },
  });
};

Views.bordereauCnam = function () {
  const list = DB.cnam.filter(c => c.statut === 'a_deposer');
  const c = DB.cabinet;
  if (!list.length) return UI.toast('Aucun dossier à déposer', 'Tous les dossiers ont déjà été transmis.', 'warn');
  const num = 'BD-' + new Date().getFullYear() + '-' + String(DB.cnam.filter(x => x.bordereau).length + 1).padStart(3, '0');

  UI.modal({
    titre: 'Bordereau de dépôt CNAM', size: 'lg',
    body: `<div class="print-doc">
      <div class="pd-head">${Views._entete()}
        <div class="doc"><b>Bordereau de dépôt</b><span>N° ${num}</span><span>${U.fmtDate(U.todayISO())}</span></div></div>
      <p>Bordereau récapitulatif des dossiers de remboursement déposés auprès de la Caisse Nationale d'Assurance Maladie.</p>
      <table>
        <thead><tr><th>N°</th><th>Assuré</th><th>N° CNAM</th><th>Facture</th><th>Date des soins</th><th>Nature</th><th class="num">Montant (DT)</th></tr></thead>
        <tbody>${list.map((x, i) => {
          const p = Data.patient(x.patientId);
          return `<tr><td>${i + 1}</td><td>${U.esc(Data.patientNom(x.patientId))}</td>
            <td>${U.esc(p && p.assurance ? p.assurance.numero : '—')}</td>
            <td>${U.esc((Data.facture(x.factureId) || {}).numero || '—')}</td>
            <td>${U.fmtDate(x.date)}</td><td>${x.type === 'prothese' ? 'Prothèse' : 'Soins'}</td>
            <td class="num">${U.money(x.montantRemb, false)}</td></tr>`;
        }).join('')}</tbody>
      </table>
      <div class="pd-tot"><table>
        <tr><td>Nombre de dossiers</td><td class="num">${list.length}</td></tr>
        <tr><td><b>Total du bordereau</b></td><td class="num"><b>${U.money(U.sum(list, x => x.montantRemb), false)} DT</b></td></tr>
      </table></div>
      <div class="pd-sign"><span>Cachet de la CNAM</span><span>${U.esc(c.ville.split(',').pop().trim())}, le ${U.fmtDate(U.todayISO())}<br><br><b>${U.esc(c.praticien)}</b><br>Signature et cachet</span></div>
      <div class="pd-foot">${U.esc(c.nom)} · Code conventionnel ${U.esc(c.codeCNAM || '—')} · MF ${U.esc(c.matriculeFiscal || '—')}</div>
    </div>`,
    foot: `<button class="btn" data-close type="button">Fermer</button>
      <button class="btn" onclick="window.print()" type="button">${Icons.print} Imprimer</button>
      <button class="btn btn-primary" data-mark type="button">Marquer les ${list.length} dossiers comme déposés</button>`,
    onMount(ov) {
      ov.addEventListener('click', e => {
        if (!e.target.closest('[data-mark]')) return;
        list.forEach(x => { x.statut = 'depose'; x.bordereau = num; x.dateDepot = U.todayISO(); });
        Audit.log('depot', 'cnam', num, `${list.length} dossiers — ${U.money(U.sum(list, x => x.montantRemb))}`);
        Data.commit(); UI.close(ov);
        UI.toast('Bordereau enregistré', `${list.length} dossiers marqués comme déposés.`, 'ok');
      });
    },
  });
};

/* =============================================== Comptabilité ============== */

Views.compta = function () {
  const f = S.filtres.compta || (S.filtres.compta = { mois: U.monthKey(U.todayISO()), cat: '' });
  const moisDispo = Array.from(new Set(DB.depenses.map(d => U.monthKey(d.date))
    .concat(DB.paiements.map(p => U.monthKey(p.date))))).sort().reverse();

  let dep = DB.depenses.filter(d => !f.mois || U.monthKey(d.date) === f.mois);
  if (f.cat) dep = dep.filter(d => d.categorie === f.cat);
  dep = U.sortBy(dep, d => d.date, 'desc');

  const recettes = U.sum(DB.paiements.filter(p => !f.mois || U.monthKey(p.date) === f.mois), p => p.montant);
  const charges = U.sum(DB.depenses.filter(d => !f.mois || U.monthKey(d.date) === f.mois), d => d.montant);
  const resultat = recettes - charges;
  const marge = recettes > 0 ? (resultat / recettes) * 100 : 0;

  const parCat = U.groupBy(DB.depenses.filter(d => !f.mois || U.monthKey(d.date) === f.mois), d => d.categorie);
  const palette = ['var(--accent)', 'var(--gold)', 'var(--info)', 'var(--t-couronne)', 'var(--ok)', 'var(--warn)', 'var(--bad)', 'var(--ink-mute)'];
  const cats = Object.keys(parCat).map((k, i) => ({
    label: k, v: U.sum(parCat[k], d => d.montant), color: palette[i % palette.length],
  })).sort((a, b) => b.v - a.v);

  const evolution = [];
  for (let i = 5; i >= 0; i--) {
    const k = U.monthKey(U.addMonths(U.todayISO(), -i));
    evolution.push({
      label: U.monthLabel(k),
      r: U.sum(DB.paiements.filter(p => U.monthKey(p.date) === k), p => p.montant),
      c: U.sum(DB.depenses.filter(d => U.monthKey(d.date) === k), d => d.montant),
    });
  }
  const maxEvo = Math.max(1, ...evolution.map(e => Math.max(e.r, e.c)));

  return `
    <div class="page-head">
      <div class="titles"><h1>Comptabilité</h1>
        <p>Recettes encaissées, charges du cabinet et résultat d'exploitation</p></div>
      <div class="page-actions">
        <select class="select" data-f="mois" style="width:auto">
          <option value="">Tout l'historique</option>
          ${moisDispo.map(m => `<option value="${m}"${f.mois === m ? ' selected' : ''}>${U.monthLabel(m)}</option>`).join('')}
        </select>
        <button class="btn" data-act="export">${Icons.download} Exporter</button>
        ${Perm.can('compta.edit') ? `<button class="btn btn-primary" data-act="new">${Icons.plus} Saisir une charge</button>` : ''}
      </div>
    </div>

    <div class="grid">
      <div class="c3">${UI.kpi({ label: 'Recettes encaissées', value: U.money(recettes, false), unit: 'DT', kind: 'ok',
        foot: f.mois ? U.monthLabel(f.mois) : 'Depuis l\'origine' })}</div>
      <div class="c3">${UI.kpi({ label: 'Charges', value: U.money(charges, false), unit: 'DT', kind: 'warn',
        foot: `${dep.length} écriture(s)` })}</div>
      <div class="c3">${UI.kpi({ label: 'Résultat', value: U.money(resultat, false), unit: 'DT', kind: resultat >= 0 ? 'ok' : 'bad',
        foot: `Marge ${marge.toFixed(1)} %` })}</div>
      <div class="c3">${UI.kpi({ label: 'Charge moyenne / jour ouvré', value: U.money(charges / 26, false), unit: 'DT',
        foot: 'Base 26 jours ouvrés' })}</div>

      <div class="c8">${UI.card('Évolution recettes / charges', `
        <div class="bar-chart" style="height:190px">
          ${evolution.map(e => `<div class="bar" title="${e.label} — recettes ${U.money(e.r)}, charges ${U.money(e.c)}">
            <div class="row" style="align-items:flex-end;gap:3px;height:100%;width:100%;justify-content:center">
              <i style="height:${(e.r / maxEvo) * 100}%;background:var(--accent);max-width:20px"></i>
              <i style="height:${(e.c / maxEvo) * 100}%;background:var(--gold);max-width:20px"></i>
            </div>
            <small>${e.label}</small></div>`).join('')}
        </div>
        <div class="legend-dots" style="margin-top:12px;justify-content:center">
          <span><i style="background:var(--accent)"></i>Recettes encaissées</span>
          <span><i style="background:var(--gold)"></i>Charges</span>
        </div>`, { sous: '6 derniers mois' })}</div>

      <div class="c4">${UI.card('Répartition des charges',
        cats.length ? `<div class="donut-row" style="justify-content:center">
            ${UI.donut(cats, U.sum(cats, c => c.v))}
          </div>
          <div class="col" style="gap:7px;margin-top:14px">
            ${cats.slice(0, 7).map(c => `<div class="row" style="justify-content:space-between">
              <span class="row" style="gap:7px"><i style="width:9px;height:9px;border-radius:2px;background:${c.color};display:block"></i>${U.esc(c.label)}</span>
              <b class="num">${U.money(c.v)}</b></div>`).join('')}
          </div>` : `<p class="muted">Aucune charge sur la période.</p>`)}</div>

      <div class="c12">${UI.card('Journal des charges',
        dep.length ? `<div class="table-wrap"><table class="tbl">
          <thead><tr><th>Date</th><th>Catégorie</th><th>Libellé</th><th>Fournisseur</th><th>Mode</th><th class="num">Montant</th>${Perm.can('compta.edit') ? '<th></th>' : ''}</tr></thead>
          <tbody>${dep.map(d => `<tr>
            <td class="nowrap">${U.fmtDate(d.date)}</td>
            <td>${UI.badge(d.categorie, '', true)}</td>
            <td class="cell-strong">${U.esc(d.libelle)}</td>
            <td class="muted">${U.esc((Data.fournisseur(d.fournisseurId) || {}).nom || '—')}</td>
            <td>${MODES_PAIEMENT[d.mode] || d.mode}</td>
            <td class="num cell-strong">${U.money(d.montant)}</td>
            ${Perm.can('compta.edit') ? `<td class="right"><button class="btn btn-sm btn-ghost" data-deldep="${d.id}" type="button" style="color:var(--bad)">${Icons.trash}</button></td>` : ''}
          </tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="5">Total des charges affichées</td><td class="num">${U.money(U.sum(dep, d => d.montant))}</td>${Perm.can('compta.edit') ? '<td></td>' : ''}</tr></tfoot>
        </table></div>` : UI.empty('Aucune charge', 'Aucune écriture sur la période sélectionnée.'),
        { flush: dep.length > 0,
          actions: `<select class="select" data-f="cat" style="height:30px;min-height:30px;font-size:12.5px;width:auto">
            <option value="">Toutes catégories</option>
            ${Object.keys(parCat).map(c => `<option value="${U.esc(c)}"${f.cat === c ? ' selected' : ''}>${U.esc(c)}</option>`).join('')}
          </select>` })}</div>
    </div>`;
};

Views.comptaMount = function () {
  const f = S.filtres.compta;
  Bind.change(e => {
    const k = e.target.dataset.f;
    if (k) { f[k] = e.target.value; App.render(); }
  });
  Bind.click(async e => {
    const dd = e.target.closest('[data-deldep]');
    if (dd) {
      const ok = await UI.confirm('Supprimer cette charge ?', "L'écriture sera retirée de la comptabilité.", { danger: true, ok: 'Supprimer' });
      if (!ok) return;
      DB.depenses = DB.depenses.filter(x => x.id !== dd.dataset.deldep);
      Audit.log('suppression', 'depense', dd.dataset.deldep, '');
      Data.commit(); return;
    }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'new') Views.depenseDialog();
    if (a.dataset.act === 'export') {
      const rows = [['Date', 'Catégorie', 'Libellé', 'Fournisseur', 'Mode', 'Montant DT']];
      U.sortBy(DB.depenses, d => d.date).forEach(d => rows.push([d.date, d.categorie, d.libelle,
        (Data.fournisseur(d.fournisseurId) || {}).nom || '', MODES_PAIEMENT[d.mode] || d.mode, d.montant.toFixed(3)]));
      rows.push([]);
      rows.push(['Recettes encaissées', '', '', '', '', U.sum(DB.paiements, p => p.montant).toFixed(3)]);
      rows.push(['Total des charges', '', '', '', '', U.sum(DB.depenses, d => d.montant).toFixed(3)]);
      U.download(`comptabilite-${U.todayISO()}.csv`, '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
      UI.toast('Export terminé', '', 'ok');
    }
  });
};

Views.depenseDialog = function (id) {
  const d = id ? DB.depenses.find(x => x.id === id) : null;
  UI.modal({
    titre: d ? 'Modifier la charge' : 'Saisir une charge', size: 'lg',
    body: `<form id="depForm"><div class="form-grid">
      ${UI.field({ label: 'Date', name: 'date', type: 'date', value: d ? d.date : U.todayISO(), required: true })}
      ${UI.field({ label: 'Catégorie', name: 'categorie', type: 'select', value: d ? d.categorie : 'Consommables',
        options: CATEGORIES_DEPENSE.map(c => [c, c]) })}
      ${UI.field({ label: 'Libellé', name: 'libelle', value: d ? d.libelle : '', required: true, full: true })}
      ${UI.field({ label: 'Montant (DT)', name: 'montant', type: 'number', step: '0.001', value: d ? d.montant : '', required: true })}
      ${UI.field({ label: 'Mode de règlement', name: 'mode', type: 'select', value: d ? d.mode : 'virement',
        options: Object.entries(MODES_PAIEMENT).map(([k, v]) => [k, v]) })}
      ${UI.field({ label: 'Fournisseur', name: 'fournisseurId', type: 'select', value: d ? d.fournisseurId : '',
        options: [['', '— Aucun —']].concat(DB.fournisseurs.map(x => [x.id, x.nom])), full: true })}
    </div></form>`,
    foot: `<button class="btn" data-close type="button">Annuler</button>
           <button class="btn btn-primary" data-save type="button">Enregistrer</button>`,
    onMount(ov) {
      ov.addEventListener('click', e => {
        if (!e.target.closest('[data-save]')) return;
        const v = UI.formValues(ov.querySelector('#depForm'));
        if (!v.libelle || !(Number(v.montant) > 0)) return UI.toast('Champs requis', 'Libellé et montant sont obligatoires.', 'bad');
        const rec = d || { id: U.uid('dep'), by: Auth.current.id, justificatif: '', recurrent: false };
        Object.assign(rec, { date: v.date, categorie: v.categorie, libelle: v.libelle,
          montant: Number(v.montant), mode: v.mode, fournisseurId: v.fournisseurId || null });
        if (!d) DB.depenses.push(rec);
        Audit.log(d ? 'modification' : 'creation', 'depense', rec.id, `${rec.libelle} — ${U.money(rec.montant)}`);
        Data.commit(); UI.close(ov);
        UI.toast('Charge enregistrée', `${rec.libelle} — ${U.money(rec.montant)}`, 'ok');
      });
    },
  });
};
