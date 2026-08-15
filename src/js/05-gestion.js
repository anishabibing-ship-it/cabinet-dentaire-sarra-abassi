/* ==========================================================================
   05 — Gestion : stock et commandes, laboratoire de prothèse, rapports,
   paramètres du cabinet, utilisateurs et droits, sauvegarde, journal.
   ========================================================================== */
'use strict';

const STATUT_LABO = {
  a_envoyer: ['À envoyer', 'warn'],
  en_cours:  ['Au laboratoire', 'info'],
  essayage:  ['Essayage', 'accent'],
  livre:     ['Livré', 'ok'],
};

/* ============================================== Stock et commandes ========= */

Views.stock = function () {
  const f = S.filtres.stock || (S.filtres.stock = { q: '', cat: '', vue: 'articles', alerte: false });
  const today = U.todayISO();

  let list = DB.stock.slice();
  if (f.q) { const t = U.norm(f.q); list = list.filter(s => U.norm(s.designation + ' ' + s.ref + ' ' + s.categorie).includes(t)); }
  if (f.cat) list = list.filter(s => s.categorie === f.cat);
  if (f.alerte) list = list.filter(s => s.quantite <= s.seuil || (s.peremption && U.fromISO(s.peremption) - U.fromISO(today) < 60 * 86400000));
  list = U.sortBy(list, s => U.norm(s.categorie + s.designation));

  const cats = Array.from(new Set(DB.stock.map(s => s.categorie))).sort();
  const valeur = U.sum(DB.stock, s => s.quantite * s.prixAchat);
  const sousSeuil = DB.stock.filter(s => s.quantite <= s.seuil);
  const perime = DB.stock.filter(s => s.peremption && U.fromISO(s.peremption) - U.fromISO(today) < 60 * 86400000 && s.quantite > 0);

  const tableArticles = list.length ? `<div class="table-wrap"><table class="tbl">
    <thead><tr>
      <th>Article</th><th>Catégorie</th><th class="num">Quantité</th><th class="num">Seuil</th>
      <th>Niveau</th><th>Péremption</th><th class="num">Valeur</th>${Perm.can('stock.edit') ? '<th></th>' : ''}
    </tr></thead>
    <tbody>${list.map(s => {
      const jours = s.peremption ? Math.round((U.fromISO(s.peremption) - U.fromISO(today)) / 86400000) : null;
      const ratio = s.seuil > 0 ? s.quantite / (s.seuil * 2) : 1;
      return `<tr>
        <td><span class="cell-strong">${U.esc(s.designation)}</span><span class="cell-sub mono">${U.esc(s.ref)} · ${U.esc(s.unite)}</span></td>
        <td>${UI.badge(s.categorie, '', true)}</td>
        <td class="num ${s.quantite <= s.seuil ? 'cell-strong' : ''}" style="${s.quantite === 0 ? 'color:var(--bad)' : s.quantite <= s.seuil ? 'color:var(--warn)' : ''}">${U.num(s.quantite)}</td>
        <td class="num muted">${U.num(s.seuil)}</td>
        <td style="min-width:110px">${UI.meter(Math.min(s.quantite, s.seuil * 2), Math.max(1, s.seuil * 2), s.quantite === 0 ? 'bad' : s.quantite <= s.seuil ? 'warn' : '')}</td>
        <td class="nowrap">${s.peremption
          ? `<span style="${jours < 0 ? 'color:var(--bad);font-weight:600' : jours < 60 ? 'color:var(--warn);font-weight:600' : ''}">${U.fmtDate(s.peremption)}</span>${jours < 60 ? `<span class="cell-sub">${jours < 0 ? 'périmé' : 'dans ' + jours + ' j'}</span>` : ''}`
          : '<span class="muted">—</span>'}</td>
        <td class="num">${U.money(s.quantite * s.prixAchat)}</td>
        ${Perm.can('stock.edit') ? `<td class="right nowrap">
          <button class="btn btn-sm btn-ghost" data-mv="${s.id}|sortie" type="button" title="Sortie">−</button>
          <button class="btn btn-sm btn-ghost" data-mv="${s.id}|entree" type="button" title="Entrée">+</button>
          <button class="btn btn-sm btn-ghost" data-art="${s.id}" type="button" title="Modifier">${Icons.edit}</button>
        </td>` : ''}
      </tr>`;
    }).join('')}</tbody>
    <tfoot><tr><td colspan="6">Valeur du stock affiché</td><td class="num">${U.money(U.sum(list, s => s.quantite * s.prixAchat))}</td>${Perm.can('stock.edit') ? '<td></td>' : ''}</tr></tfoot>
  </table></div>` : UI.empty('Aucun article', 'Aucun article ne correspond à ces critères.');

  const mouvements = U.sortBy(DB.mouvements, m => m.date, 'desc').slice(0, 40);
  const tableMv = mouvements.length ? `<div class="table-wrap"><table class="tbl">
    <thead><tr><th>Date</th><th>Article</th><th>Type</th><th class="num">Quantité</th><th>Motif</th><th>Par</th></tr></thead>
    <tbody>${mouvements.map(m => {
      const a = Data.article(m.stockId);
      return `<tr>
        <td class="nowrap">${U.fmtDate(m.date)}</td>
        <td class="cell-strong">${U.esc(a ? a.designation : 'Article supprimé')}</td>
        <td>${UI.badge(m.type === 'entree' ? 'Entrée' : m.type === 'sortie' ? 'Sortie' : m.type === 'perte' ? 'Perte' : 'Inventaire',
              m.type === 'entree' ? 'ok' : m.type === 'perte' ? 'bad' : '')}</td>
        <td class="num">${m.type === 'entree' ? '+' : '−'}${U.num(m.quantite)}</td>
        <td class="muted">${U.esc(m.motif || '—')}</td>
        <td class="muted">${U.esc((Data.user(m.by) || {}).nom || '—')}</td>
      </tr>`;
    }).join('')}</tbody></table></div>` : UI.empty('Aucun mouvement', 'Les entrées et sorties de stock seront tracées ici.');

  const tableFour = `<div class="table-wrap"><table class="tbl">
    <thead><tr><th>Fournisseur</th><th>Type</th><th>Contact</th><th>Téléphone</th><th class="num">Achats cumulés</th></tr></thead>
    <tbody>${DB.fournisseurs.map(x => `<tr class="clickable" data-four="${x.id}">
      <td class="cell-strong">${U.esc(x.nom)}<span class="cell-sub">${U.esc(x.adresse || '')}</span></td>
      <td>${UI.badge(x.type, '', true)}</td>
      <td>${U.esc(x.contact || '—')}</td>
      <td class="mono">${U.esc(x.tel || '—')}</td>
      <td class="num">${U.money(U.sum(DB.depenses.filter(d => d.fournisseurId === x.id), d => d.montant))}</td>
    </tr>`).join('')}</tbody></table></div>`;

  return `
    <div class="page-head">
      <div class="titles"><h1>Stock &amp; commandes</h1>
        <p>${DB.stock.length} références — ${sousSeuil.length} sous le seuil d'alerte</p></div>
      <div class="page-actions">
        ${Perm.can('stock.edit') ? `<button class="btn" data-act="four">${Icons.box} Fournisseur</button>
          <button class="btn btn-primary" data-act="new">${Icons.plus} Nouvel article</button>` : ''}
      </div>
    </div>

    <div class="grid">
      <div class="c3">${UI.kpi({ label: 'Valeur du stock', value: U.money(valeur, false), unit: 'DT', kind: 'gold',
        foot: `${DB.stock.length} références` })}</div>
      <div class="c3">${UI.kpi({ label: 'Sous le seuil', value: sousSeuil.length, kind: sousSeuil.length ? 'warn' : 'ok',
        foot: `${DB.stock.filter(s => s.quantite === 0).length} en rupture` })}</div>
      <div class="c3">${UI.kpi({ label: 'Péremptions proches', value: perime.length, kind: perime.length ? 'warn' : 'ok',
        foot: 'Moins de 60 jours' })}</div>
      <div class="c3">${UI.kpi({ label: 'Fournisseurs', value: DB.fournisseurs.length,
        foot: `${DB.fournisseurs.filter(x => x.type === 'Laboratoire').length} laboratoire(s)` })}</div>

      <div class="c12"><div class="card">
        <div class="tabs">
          <button class="${f.vue === 'articles' ? 'is-on' : ''}" data-vue="articles" type="button">Articles<span class="count">${DB.stock.length}</span></button>
          <button class="${f.vue === 'mouvements' ? 'is-on' : ''}" data-vue="mouvements" type="button">Mouvements<span class="count">${DB.mouvements.length}</span></button>
          <button class="${f.vue === 'fournisseurs' ? 'is-on' : ''}" data-vue="fournisseurs" type="button">Fournisseurs<span class="count">${DB.fournisseurs.length}</span></button>
        </div>
        ${f.vue === 'articles' ? `<div class="tbl-toolbar">
          <input class="input search" data-f="q" type="search" placeholder="Désignation, référence…" value="${U.esc(f.q)}">
          <select class="select" data-f="cat">
            <option value="">Toutes catégories</option>
            ${cats.map(c => `<option value="${U.esc(c)}"${f.cat === c ? ' selected' : ''}>${U.esc(c)}</option>`).join('')}
          </select>
          <label class="check" style="margin-left:auto"><input type="checkbox" data-f="alerte"${f.alerte ? ' checked' : ''}><span>Seulement les alertes</span></label>
        </div>` : ''}
        ${f.vue === 'articles' ? tableArticles : f.vue === 'mouvements' ? tableMv : tableFour}
      </div></div>
    </div>`;
};

Views.stockMount = function () {
  const f = S.filtres.stock;
  Bind.click(async e => {
    const v = e.target.closest('[data-vue]');
    if (v) { f.vue = v.dataset.vue; App.render(); return; }
    const mv = e.target.closest('[data-mv]');
    if (mv) {
      const [sid, type] = mv.dataset.mv.split('|');
      const a = Data.article(sid);
      const q = await UI.prompt(type === 'entree' ? 'Entrée en stock' : 'Sortie de stock',
        `${a.designation} — quantité en ${a.unite}`, '1', { type: 'number', hint: `Stock actuel : ${a.quantite} ${a.unite}` });
      if (q === null) return;
      const n = Number(q);
      if (!(n > 0)) return;
      a.quantite = Math.max(0, a.quantite + (type === 'entree' ? n : -n));
      DB.mouvements.unshift({ id: U.uid('mv'), stockId: sid, date: U.todayISO(), type, quantite: n,
        motif: type === 'entree' ? 'Réception' : 'Consommation', by: Auth.current.id });
      Audit.log('mouvement', 'stock', sid, `${type === 'entree' ? '+' : '−'}${n} ${a.unite} — ${a.designation}`);
      Data.commit();
      return;
    }
    const art = e.target.closest('[data-art]');
    if (art) return Views.articleDialog(art.dataset.art);
    const four = e.target.closest('[data-four]');
    if (four) return Views.fournisseurDialog(four.dataset.four);
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'new') Views.articleDialog(null);
    if (a.dataset.act === 'four') Views.fournisseurDialog(null);
  });
  const upd = e => {
    const k = e.target.dataset.f; if (!k) return;
    f[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    App.render();
    if (k === 'q') { const i = U.$('[data-f="q"]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
  };
  Bind.change(upd);
  Bind.input(U.debounce(e => { if (e.target.dataset.f === 'q') upd(e); }, 260));
};

Views.articleDialog = function (id) {
  const s = id ? Data.article(id) : null;
  const cats = Array.from(new Set(DB.stock.map(x => x.categorie))).sort();
  UI.modal({
    titre: s ? 'Modifier l\'article' : 'Nouvel article', sous: s ? s.designation : '', size: 'lg',
    body: `<datalist id="catList">${cats.map(c => `<option value="${U.esc(c)}"></option>`).join('')}</datalist>
      <form id="artForm"><div class="form-grid">
      ${UI.field({ label: 'Désignation', name: 'designation', value: s ? s.designation : '', required: true, full: true })}
      ${UI.field({ label: 'Référence', name: 'ref', value: s ? s.ref : '' })}
      ${UI.field({ label: 'Catégorie', name: 'categorie', value: s ? s.categorie : '', list: 'catList', required: true })}
      ${UI.field({ label: 'Unité', name: 'unite', value: s ? s.unite : 'unité', placeholder: 'boîte de 100, carpule…' })}
      ${UI.field({ label: 'Quantité en stock', name: 'quantite', type: 'number', step: '1', min: 0, value: s ? s.quantite : 0, required: true })}
      ${UI.field({ label: "Seuil d'alerte", name: 'seuil', type: 'number', step: '1', min: 0, value: s ? s.seuil : 3, required: true })}
      ${UI.field({ label: "Prix d'achat unitaire (DT)", name: 'prixAchat', type: 'number', step: '0.001', value: s ? s.prixAchat : 0 })}
      ${UI.field({ label: 'Fournisseur', name: 'fournisseurId', type: 'select', value: s ? s.fournisseurId : '',
        options: [['', '— Aucun —']].concat(DB.fournisseurs.map(x => [x.id, x.nom])) })}
      ${UI.field({ label: 'Date de péremption', name: 'peremption', type: 'date', value: s ? s.peremption : '' })}
      ${UI.field({ label: 'N° de lot', name: 'lot', value: s ? s.lot : '' })}
      ${UI.field({ label: 'Emplacement', name: 'emplacement', value: s ? s.emplacement : '', full: true, placeholder: 'Armoire 2, tiroir du haut…' })}
    </div></form>`,
    foot: `<div class="left">${s ? `<button class="btn btn-sm btn-ghost" data-del type="button" style="color:var(--bad)">${Icons.trash} Supprimer</button>` : ''}</div>
      <button class="btn" data-close type="button">Annuler</button>
      <button class="btn btn-primary" data-save type="button">Enregistrer</button>`,
    onMount(ov) {
      ov.addEventListener('click', async e => {
        if (e.target.closest('[data-del]')) {
          const ok = await UI.confirm('Supprimer cet article ?', 'Son historique de mouvements sera conservé.', { danger: true, ok: 'Supprimer' });
          if (!ok) return;
          DB.stock = DB.stock.filter(x => x.id !== s.id);
          Audit.log('suppression', 'stock', s.id, s.designation);
          Data.commit(); UI.close(ov); return;
        }
        if (!e.target.closest('[data-save]')) return;
        const v = UI.formValues(ov.querySelector('#artForm'));
        if (!v.designation) return UI.toast('Désignation requise', '', 'bad');
        const rec = s || { id: U.uid('stk') };
        Object.assign(rec, {
          designation: v.designation, ref: v.ref, categorie: v.categorie || 'Divers', unite: v.unite || 'unité',
          quantite: Number(v.quantite) || 0, seuil: Number(v.seuil) || 0, prixAchat: Number(v.prixAchat) || 0,
          fournisseurId: v.fournisseurId || null, peremption: v.peremption, lot: v.lot, emplacement: v.emplacement,
        });
        if (!s) DB.stock.push(rec);
        Audit.log(s ? 'modification' : 'creation', 'stock', rec.id, rec.designation);
        Data.commit(); UI.close(ov);
        UI.toast('Article enregistré', rec.designation, 'ok');
      });
    },
  });
};

Views.fournisseurDialog = function (id) {
  const x = id ? Data.fournisseur(id) : null;
  UI.modal({
    titre: x ? 'Modifier le fournisseur' : 'Nouveau fournisseur', size: 'lg',
    body: `<form id="fourForm"><div class="form-grid">
      ${UI.field({ label: 'Raison sociale', name: 'nom', value: x ? x.nom : '', required: true, full: true })}
      ${UI.field({ label: 'Type', name: 'type', type: 'select', value: x ? x.type : 'Consommables',
        options: ['Consommables', 'Laboratoire', 'Implantologie', 'Matériel', 'Services'].map(t => [t, t]) })}
      ${UI.field({ label: 'Interlocuteur', name: 'contact', value: x ? x.contact : '' })}
      ${UI.field({ label: 'Téléphone', name: 'tel', value: x ? x.tel : '' })}
      ${UI.field({ label: 'Courriel', name: 'email', type: 'email', value: x ? x.email : '' })}
      ${UI.field({ label: 'Adresse', name: 'adresse', value: x ? x.adresse : '', full: true })}
      ${UI.field({ label: 'Notes', name: 'notes', type: 'textarea', rows: 2, value: x ? x.notes : '', full: true })}
    </div></form>`,
    foot: `<button class="btn" data-close type="button">Annuler</button>
           <button class="btn btn-primary" data-save type="button">Enregistrer</button>`,
    onMount(ov) {
      ov.addEventListener('click', e => {
        if (!e.target.closest('[data-save]')) return;
        const v = UI.formValues(ov.querySelector('#fourForm'));
        if (!v.nom) return UI.toast('Raison sociale requise', '', 'bad');
        const rec = x || { id: U.uid('four') };
        Object.assign(rec, v);
        if (!x) DB.fournisseurs.push(rec);
        Audit.log(x ? 'modification' : 'creation', 'fournisseur', rec.id, rec.nom);
        Data.commit(); UI.close(ov);
        UI.toast('Fournisseur enregistré', rec.nom, 'ok');
      });
    },
  });
};

/* ================================================== Laboratoire ============ */

Views.labo = function () {
  const today = U.todayISO();
  const list = U.sortBy(DB.labo, l => l.dateLivraisonPrevue);
  const enCours = list.filter(l => l.statut !== 'livre');
  const retard = enCours.filter(l => l.dateLivraisonPrevue && l.dateLivraisonPrevue < today);
  const coutMois = U.sum(DB.labo.filter(l => U.monthKey(l.date) === U.monthKey(today)), l => l.cout);

  return `
    <div class="page-head">
      <div class="titles"><h1>Laboratoire de prothèse</h1>
        <p>${enCours.length} travail(aux) en cours${retard.length ? ` — ${retard.length} en retard` : ''}</p></div>
      <div class="page-actions">
        ${Perm.can('labo.edit') ? `<button class="btn btn-primary" data-act="new">${Icons.plus} Nouveau bon de travail</button>` : ''}
      </div>
    </div>

    <div class="grid">
      <div class="c3">${UI.kpi({ label: 'En cours', value: enCours.length, kind: enCours.length ? 'info' : 'ok',
        foot: `${list.filter(l => l.statut === 'a_envoyer').length} empreinte(s) à envoyer` })}</div>
      <div class="c3">${UI.kpi({ label: 'En retard', value: retard.length, kind: retard.length ? 'bad' : 'ok',
        foot: retard.length ? 'Relancer le laboratoire' : 'Aucun retard' })}</div>
      <div class="c3">${UI.kpi({ label: 'Coût du mois', value: U.money(coutMois, false), unit: 'DT', kind: 'gold',
        foot: 'Travaux envoyés ce mois' })}</div>
      <div class="c3">${UI.kpi({ label: 'Livrés cette année', value: DB.labo.filter(l => l.statut === 'livre').length,
        foot: U.money(U.sum(DB.labo.filter(l => l.statut === 'livre'), l => l.cout)) })}</div>

      <div class="c12">${UI.card('Bons de travail',
        list.length ? `<div class="table-wrap"><table class="tbl">
          <thead><tr><th>N°</th><th>Patient</th><th>Travail</th><th>Laboratoire</th><th>Dents</th><th>Teinte</th>
            <th>Envoi</th><th>Livraison prévue</th><th class="num">Coût</th><th>Statut</th></tr></thead>
          <tbody>${list.map(l => {
            const late = l.statut !== 'livre' && l.dateLivraisonPrevue && l.dateLivraisonPrevue < today;
            return `<tr class="clickable" data-labo="${l.id}">
              <td class="mono cell-strong">${U.esc(l.numero)}</td>
              <td>${U.esc(Data.patientNom(l.patientId))}</td>
              <td>${U.esc(l.type)}</td>
              <td class="muted">${U.esc((Data.fournisseur(l.laboId) || {}).nom || '—')}</td>
              <td class="mono">${U.esc((l.dents || []).join(', ') || '—')}</td>
              <td>${U.esc(l.teinte || '—')}</td>
              <td class="nowrap">${U.fmtDate(l.date)}</td>
              <td class="nowrap" style="${late ? 'color:var(--bad);font-weight:600' : ''}">${U.fmtDate(l.dateLivraisonPrevue)}</td>
              <td class="num">${U.money(l.cout)}</td>
              <td>${UI.badge(late ? 'En retard' : STATUT_LABO[l.statut][0], late ? 'bad' : STATUT_LABO[l.statut][1])}</td>
            </tr>`;
          }).join('')}</tbody>
          <tfoot><tr><td colspan="8">Coût total des travaux</td><td class="num">${U.money(U.sum(list, l => l.cout))}</td><td></td></tr></tfoot>
        </table></div>` : UI.empty('Aucun bon de travail', 'Créez un bon dès l\'envoi d\'une empreinte au laboratoire.'),
        { flush: list.length > 0 })}</div>
    </div>`;
};

Views.laboMount = function () {
  Bind.click(e => {
    const l = e.target.closest('[data-labo]');
    if (l) return Views.laboDialog(l.dataset.labo);
    if (e.target.closest('[data-act="new"]')) Views.laboDialog(null);
  });
};

Views.laboDialog = function (id) {
  const l = id ? DB.labo.find(x => x.id === id) : null;
  const ro = !Perm.can('labo.edit');
  const labos = DB.fournisseurs.filter(x => x.type === 'Laboratoire' || x.type === 'Implantologie');

  UI.modal({
    titre: l ? `Bon de travail ${l.numero}` : 'Nouveau bon de travail',
    sous: l ? Data.patientNom(l.patientId) : '', size: 'lg',
    body: `<form id="laboForm"><div class="form-grid">
      ${l ? '' : `<div class="field full"><label for="f_patientId">Patient *</label>
        <select class="select" id="f_patientId" name="patientId" required><option value="">— Choisir —</option>${UI.patientOptions('')}</select></div>`}
      ${UI.field({ label: 'Nature du travail', name: 'type', value: l ? l.type : '', required: true, full: true,
        placeholder: 'Couronne céramo-métallique, châssis, gouttière…' })}
      ${UI.field({ label: 'Laboratoire', name: 'laboId', type: 'select', value: l ? l.laboId : (labos[0] || {}).id,
        options: labos.map(x => [x.id, x.nom]) })}
      ${UI.field({ label: 'Dents', name: 'dents', value: l ? (l.dents || []).join(', ') : '', placeholder: '11, 21' })}
      ${UI.field({ label: 'Teinte', name: 'teinte', value: l ? l.teinte : '', placeholder: 'A1, A2, B1…' })}
      ${UI.field({ label: 'Coût laboratoire (DT)', name: 'cout', type: 'number', step: '0.001', value: l ? l.cout : 0 })}
      ${UI.field({ label: "Date d'envoi", name: 'date', type: 'date', value: l ? l.date : U.todayISO(), required: true })}
      ${UI.field({ label: 'Livraison prévue', name: 'dateLivraisonPrevue', type: 'date', value: l ? l.dateLivraisonPrevue : U.addDays(U.todayISO(), 10) })}
      ${UI.field({ label: 'Statut', name: 'statut', type: 'select', value: l ? l.statut : 'a_envoyer',
        options: Object.entries(STATUT_LABO).map(([k, v]) => [k, v[0]]) })}
      ${UI.field({ label: 'Date de livraison réelle', name: 'dateLivraison', type: 'date', value: l ? l.dateLivraison : '' })}
      ${UI.field({ label: 'Instructions au prothésiste', name: 'note', type: 'textarea', rows: 3, value: l ? l.note : '', full: true })}
    </div></form>`,
    foot: `<div class="left">${l && !ro ? `<button class="btn btn-sm btn-ghost" data-del type="button" style="color:var(--bad)">${Icons.trash} Supprimer</button>
        <button class="btn btn-sm" data-print type="button">${Icons.print} Imprimer le bon</button>` : ''}</div>
      <button class="btn" data-close type="button">Fermer</button>
      ${ro ? '' : `<button class="btn btn-primary" data-save type="button">Enregistrer</button>`}`,
    onMount(ov) {
      const form = ov.querySelector('#laboForm');
      if (ro) U.$$('input,select,textarea', form).forEach(i => { i.disabled = true; });
      ov.addEventListener('click', async e => {
        if (e.target.closest('[data-del]')) {
          const ok = await UI.confirm('Supprimer ce bon ?', '', { danger: true, ok: 'Supprimer' });
          if (!ok) return;
          DB.labo = DB.labo.filter(x => x.id !== l.id);
          Audit.log('suppression', 'labo', l.id, l.numero);
          Data.commit(); UI.close(ov); return;
        }
        if (e.target.closest('[data-print]')) { UI.close(ov); Views.printLabo(l.id); return; }
        if (!e.target.closest('[data-save]')) return;
        const v = UI.formValues(form);
        const pid = l ? l.patientId : v.patientId;
        if (!pid) return UI.toast('Patient requis', '', 'bad');
        if (!v.type) return UI.toast('Nature du travail requise', '', 'bad');
        const rec = l || {
          id: U.uid('lab'), patientId: pid,
          numero: 'LAB-' + new Date().getFullYear() + '-' + String(Data.nextSeq('labo')).padStart(3, '0'),
        };
        Object.assign(rec, {
          patientId: pid, type: v.type, laboId: v.laboId,
          dents: v.dents ? v.dents.split(/[,\s]+/).filter(Boolean) : [],
          teinte: v.teinte, cout: Number(v.cout) || 0, date: v.date,
          dateLivraisonPrevue: v.dateLivraisonPrevue, dateLivraison: v.dateLivraison,
          statut: v.statut, note: v.note,
        });
        if (!l) DB.labo.push(rec);
        Audit.log(l ? 'modification' : 'creation', 'labo', rec.id, `${rec.numero} — ${rec.type}`);
        Data.commit(); UI.close(ov);
        UI.toast('Bon de travail enregistré', rec.numero, 'ok');
      });
    },
  });
};

Views.printLabo = function (id) {
  const l = DB.labo.find(x => x.id === id);
  if (!l) return;
  const p = Data.patient(l.patientId);
  const c = DB.cabinet;
  UI.modal({
    titre: 'Bon de travail', size: 'lg',
    body: `<div class="print-doc">
      <div class="pd-head">${Views._entete()}
        <div class="doc"><b>Bon de travail</b><span>N° ${U.esc(l.numero)}</span><span>${U.fmtDate(l.date)}</span></div></div>
      <table>
        <tr><th style="width:30%">Laboratoire</th><td>${U.esc((Data.fournisseur(l.laboId) || {}).nom || '—')}</td></tr>
        <tr><th>Patient</th><td>${p ? U.esc(p.prenom + ' ' + p.nom) : '—'}${p && p.dateNaissance ? ` (${U.age(p.dateNaissance)} ans)` : ''}</td></tr>
        <tr><th>Nature du travail</th><td><b>${U.esc(l.type)}</b></td></tr>
        <tr><th>Dents concernées</th><td>${U.esc((l.dents || []).join(', ') || '—')}</td></tr>
        <tr><th>Teinte</th><td>${U.esc(l.teinte || '—')}</td></tr>
        <tr><th>Livraison souhaitée</th><td>${U.fmtDate(l.dateLivraisonPrevue)}</td></tr>
      </table>
      <p style="margin-top:14px"><b>Instructions :</b><br>${U.esc(l.note || 'Selon empreinte et articulé fournis.')}</p>
      <div class="pd-sign"><span>Réception laboratoire<br><br>_______________________</span>
        <span>${U.esc(c.ville.split(',').pop().trim())}, le ${U.fmtDate(l.date)}<br><br><b>${U.esc(c.praticien)}</b></span></div>
      <div class="pd-foot">${U.esc(c.nom)} · ${U.esc(c.adresse)}, ${U.esc(c.ville)} · Tél. ${U.esc(c.tel)}</div>
    </div>`,
    foot: `<button class="btn" data-close type="button">Fermer</button>
           <button class="btn btn-primary" onclick="window.print()" type="button">${Icons.print} Imprimer</button>`,
  });
};

/* ==================================================== Rapports ============= */

Views.rapports = function () {
  const f = S.filtres.rapports || (S.filtres.rapports = { periode: '12' });
  const today = U.todayISO();
  const depuis = U.addMonths(today, -Number(f.periode));

  const pays = DB.paiements.filter(p => p.date >= depuis);
  const soins = DB.soins.filter(s => s.date >= depuis && s.statut === 'realise');
  const rdvs = DB.rdv.filter(r => r.date >= depuis && r.date <= today);
  const facs = DB.factures.filter(x => x.type === 'facture' && x.date >= depuis && x.statut !== 'annulee');
  const deps = DB.depenses.filter(d => d.date >= depuis);

  const ca = U.sum(pays, p => p.montant);
  const charges = U.sum(deps, d => d.montant);
  const honoraires = U.sum(facs, x => Data.totaux(x).total);

  /* Actes les plus fréquents */
  const parActe = U.groupBy(soins, s => s.libelle);
  const topActes = Object.keys(parActe).map(k => ({
    label: k, n: parActe[k].length, v: U.sum(parActe[k], s => s.prix),
  })).sort((a, b) => b.v - a.v).slice(0, 10);

  /* Catégories d'actes */
  const parCat = {};
  soins.forEach(s => {
    const a = Data.acte(s.acteId);
    const cat = a ? a.categorie : 'Divers';
    parCat[cat] = (parCat[cat] || 0) + s.prix;
  });
  const palette = ['var(--accent)', 'var(--gold)', 'var(--info)', 'var(--t-couronne)', 'var(--ok)', 'var(--warn)', 'var(--bad)', 'var(--ink-mute)', 'var(--accent-lo)'];
  const cats = Object.keys(parCat).map((k, i) => ({ label: k, v: parCat[k], color: palette[i % palette.length] }))
    .sort((a, b) => b.v - a.v);

  /* Assiduité */
  const termines = rdvs.filter(r => r.statut === 'termine').length;
  const absents = rdvs.filter(r => r.statut === 'absent').length;
  const tauxPresence = (termines + absents) > 0 ? (termines / (termines + absents)) * 100 : 100;

  /* Patients */
  const nouveaux = DB.patients.filter(p => U.toISO(new Date(p.createdAt)) >= depuis).length;
  const actifs = new Set(rdvs.map(r => r.patientId)).size;

  /* Top patients */
  const parPatient = U.groupBy(pays, p => p.patientId);
  const topPatients = Object.keys(parPatient).map(k => ({
    id: k, nom: Data.patientNom(k), v: U.sum(parPatient[k], p => p.montant), n: parPatient[k].length,
  })).sort((a, b) => b.v - a.v).slice(0, 8);

  /* Évolution mensuelle */
  const evo = [];
  for (let i = Math.min(11, Number(f.periode) - 1); i >= 0; i--) {
    const k = U.monthKey(U.addMonths(today, -i));
    evo.push({ label: U.monthLabel(k), v: U.sum(DB.paiements.filter(p => U.monthKey(p.date) === k), p => p.montant) });
  }

  /* Fréquentation par jour de la semaine */
  const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const parJour = jours.map((j, i) => ({
    label: j.slice(0, 3), v: rdvs.filter(r => U.fromISO(r.date).getDay() === i + 1 && r.statut !== 'annule').length,
  }));

  return `
    <div class="page-head">
      <div class="titles"><h1>Rapports &amp; statistiques</h1>
        <p>Activité du cabinet depuis le ${U.fmtDate(depuis)}</p></div>
      <div class="page-actions">
        <select class="select" data-f="periode" style="width:auto">
          <option value="3"${f.periode === '3' ? ' selected' : ''}>3 derniers mois</option>
          <option value="6"${f.periode === '6' ? ' selected' : ''}>6 derniers mois</option>
          <option value="12"${f.periode === '12' ? ' selected' : ''}>12 derniers mois</option>
          <option value="36"${f.periode === '36' ? ' selected' : ''}>3 dernières années</option>
        </select>
        <button class="btn" onclick="window.print()" type="button">${Icons.print} Imprimer</button>
      </div>
    </div>

    <div class="grid">
      <div class="c3">${UI.kpi({ label: 'Chiffre encaissé', value: U.money(ca, false), unit: 'DT', kind: 'gold',
        foot: `${pays.length} règlement(s)` })}</div>
      <div class="c3">${UI.kpi({ label: 'Honoraires facturés', value: U.money(honoraires, false), unit: 'DT',
        foot: `Recouvrement ${honoraires > 0 ? Math.round(ca / honoraires * 100) : 0} %` })}</div>
      <div class="c3">${UI.kpi({ label: 'Résultat', value: U.money(ca - charges, false), unit: 'DT', kind: ca - charges >= 0 ? 'ok' : 'bad',
        foot: `Charges ${U.money(charges)}` })}</div>
      <div class="c3">${UI.kpi({ label: 'Panier moyen', value: U.money(facs.length ? honoraires / facs.length : 0, false), unit: 'DT',
        foot: `${facs.length} facture(s)` })}</div>

      <div class="c8">${UI.card('Recettes mensuelles', UI.bars(evo, { short: true }), { sous: 'Encaissements par mois, en dinars' })}</div>

      <div class="c4">${UI.card('Répartition par discipline',
        cats.length ? `<div class="donut-row" style="justify-content:center">${UI.donut(cats, U.sum(cats, c => c.v))}</div>
          <div class="col" style="gap:6px;margin-top:14px">
            ${cats.slice(0, 8).map(c => `<div class="row" style="justify-content:space-between">
              <span class="row" style="gap:7px"><i style="width:9px;height:9px;border-radius:2px;background:${c.color};display:block"></i>${U.esc(c.label)}</span>
              <b class="num">${U.money(c.v)}</b></div>`).join('')}
          </div>` : `<p class="muted">Aucun acte sur la période.</p>`)}</div>

      <div class="c6">${UI.card('Actes les plus produits',
        topActes.length ? `<div class="table-wrap"><table class="tbl">
          <thead><tr><th>Acte</th><th class="num">Nombre</th><th class="num">Honoraires</th><th>Part</th></tr></thead>
          <tbody>${topActes.map(a => `<tr>
            <td class="cell-strong">${U.esc(a.label)}</td>
            <td class="num">${a.n}</td><td class="num">${U.money(a.v)}</td>
            <td style="min-width:90px">${UI.meter(a.v, topActes[0].v)}</td>
          </tr>`).join('')}</tbody></table></div>` : `<p class="muted">Aucun acte enregistré.</p>`,
        { flush: topActes.length > 0 })}</div>

      <div class="c6">${UI.card('Patients à plus forte contribution',
        topPatients.length ? `<div class="table-wrap"><table class="tbl">
          <thead><tr><th>Patient</th><th class="num">Règlements</th><th class="num">Total</th></tr></thead>
          <tbody>${topPatients.map(p => `<tr class="clickable" data-pat="${p.id}">
            <td class="cell-strong">${U.esc(p.nom)}</td><td class="num">${p.n}</td><td class="num">${U.money(p.v)}</td>
          </tr>`).join('')}</tbody></table></div>` : `<p class="muted">Aucun règlement.</p>`,
        { flush: topPatients.length > 0 })}</div>

      <div class="c4">${UI.card('Assiduité des patients', `
        <div class="col" style="gap:14px">
          <div><div class="row" style="justify-content:space-between;margin-bottom:6px">
            <span class="eyebrow">Taux de présence</span><b class="num">${tauxPresence.toFixed(1)} %</b></div>
            ${UI.meter(tauxPresence, 100, tauxPresence < 85 ? 'warn' : '')}</div>
          <dl class="dl">
            <dt>Séances honorées</dt><dd class="num">${termines}</dd>
            <dt>Absences</dt><dd class="num">${absents}</dd>
            <dt>Annulations</dt><dd class="num">${rdvs.filter(r => r.statut === 'annule').length}</dd>
            <dt>Durée moyenne</dt><dd class="num">${rdvs.length ? Math.round(U.sum(rdvs, r => r.duree) / rdvs.length) : 0} min</dd>
          </dl>
        </div>`)}</div>

      <div class="c4">${UI.card('Patientèle', `<dl class="dl">
        <dt>Patients actifs sur la période</dt><dd class="num">${actifs}</dd>
        <dt>Nouveaux patients</dt><dd class="num">${nouveaux}</dd>
        <dt>Total en fichier</dt><dd class="num">${DB.patients.filter(p => !p.archived).length}</dd>
        <dt>Affiliés CNAM</dt><dd class="num">${DB.patients.filter(p => p.assurance.type === 'cnam').length}</dd>
        <dt>Assurance privée</dt><dd class="num">${DB.patients.filter(p => p.assurance.type === 'privee').length}</dd>
        <dt>Sans couverture</dt><dd class="num">${DB.patients.filter(p => p.assurance.type === 'aucune').length}</dd>
      </dl>`)}</div>

      <div class="c4">${UI.card('Fréquentation par jour',
        UI.bars(parJour, { short: true, fmt: v => v + ' rdv' }), { sous: 'Nombre de rendez-vous' })}</div>
    </div>`;
};

Views.rapportsMount = function () {
  const f = S.filtres.rapports;
  Bind.change(e => { if (e.target.dataset.f === 'periode') { f.periode = e.target.value; App.render(); } });
  Bind.click(e => {
    const p = e.target.closest('[data-pat]');
    if (p && Perm.can('patients.view')) location.hash = '#/patient/' + p.dataset.pat;
  });
};

/* =================================================== Paramètres ============ */

Views.params = function (arg) {
  const tab = arg || 'cabinet';
  const tabs = [
    ['cabinet', 'Cabinet'],
    ['actes', 'Catalogue des actes'],
    ['users', 'Utilisateurs & droits'],
    ['donnees', 'Sauvegarde'],
    ['journal', "Journal d'activité"],
  ].filter(t => (t[0] === 'users' ? Perm.can('users.manage') : true)
             && (t[0] === 'journal' ? Perm.can('audit.view') : true)
             && (t[0] === 'donnees' ? Perm.can('data.export') : true));

  return `
    <div class="page-head">
      <div class="titles"><h1>Paramètres</h1><p>Configuration du cabinet, tarifs, comptes et sauvegardes</p></div>
    </div>
    <div class="card" style="margin-bottom:var(--gap)">
      <div class="tabs">${tabs.map(t => `<button class="${tab === t[0] ? 'is-on' : ''}" data-ptab="${t[0]}" type="button">${U.esc(t[1])}</button>`).join('')}</div>
    </div>
    ${Views['_par_' + tab] ? Views['_par_' + tab]() : ''}`;
};

Views._par_cabinet = function () {
  const c = DB.cabinet;
  const ro = !Perm.can('params.edit');
  return `<form id="cabForm"><div class="grid">
    <div class="c6">${UI.card('Identité du cabinet', `<div class="form-grid">
      ${UI.field({ label: 'Nom du cabinet', name: 'nom', value: c.nom, full: true, disabled: ro })}
      ${UI.field({ label: 'Praticienne', name: 'praticien', value: c.praticien, disabled: ro })}
      ${UI.field({ label: 'Titre', name: 'titre', value: c.titre, disabled: ro })}
      ${UI.field({ label: 'Spécialité', name: 'specialite', value: c.specialite, full: true, disabled: ro })}
      ${UI.field({ label: 'Adresse', name: 'adresse', value: c.adresse, full: true, disabled: ro })}
      ${UI.field({ label: 'Ville', name: 'ville', value: c.ville, disabled: ro })}
      ${UI.field({ label: 'Code postal', name: 'codePostal', value: c.codePostal, disabled: ro })}
      ${UI.field({ label: 'Téléphone', name: 'tel', value: c.tel, disabled: ro })}
      ${UI.field({ label: 'Mobile', name: 'mobile', value: c.mobile, disabled: ro })}
      ${UI.field({ label: 'Courriel', name: 'email', type: 'email', value: c.email, full: true, disabled: ro })}
    </div>`)}</div>

    <div class="c6">${UI.card('Mentions légales et bancaires', `<div class="form-grid">
      ${UI.field({ label: 'Matricule fiscal', name: 'matriculeFiscal', value: c.matriculeFiscal, full: true, disabled: ro })}
      ${UI.field({ label: 'Code conventionnel CNAM', name: 'codeCNAM', value: c.codeCNAM, disabled: ro })}
      ${UI.field({ label: "N° d'inscription à l'Ordre", name: 'cnom', value: c.cnom, disabled: ro })}
      ${UI.field({ label: 'Banque', name: 'banque', value: c.banque, disabled: ro })}
      ${UI.field({ label: 'RIB', name: 'rib', value: c.rib, disabled: ro })}
      ${UI.field({ label: 'Droit de timbre par facture (DT)', name: 'timbreFiscal', type: 'number', step: '0.001', value: c.timbreFiscal, disabled: ro,
        hint: 'À vérifier selon la loi de finances en vigueur.' })}
      ${UI.field({ label: 'Taux de TVA (%)', name: 'tvaTaux', type: 'number', step: '0.1', value: c.tvaTaux, disabled: ro,
        hint: 'Les actes de médecine dentaire sont exonérés : laisser 0.' })}
      ${UI.field({ label: 'Mentions au bas des factures', name: 'mentionsFacture', type: 'textarea', rows: 3, value: c.mentionsFacture, full: true, disabled: ro })}
    </div>`)}</div>

    <div class="c6">${UI.card('Horaires et rendez-vous', `<div class="form-grid">
      ${UI.field({ label: 'Ouverture', name: 'heureDebut', type: 'time', value: c.heureDebut, disabled: ro })}
      ${UI.field({ label: 'Fermeture', name: 'heureFin', type: 'time', value: c.heureFin, disabled: ro })}
      ${UI.field({ label: 'Début de pause', name: 'pauseDebut', type: 'time', value: c.pauseDebut, disabled: ro })}
      ${UI.field({ label: 'Fin de pause', name: 'pauseFin', type: 'time', value: c.pauseFin, disabled: ro })}
      ${UI.field({ label: 'Fermeture le samedi', name: 'samediFin', type: 'time', value: c.samediFin, disabled: ro })}
      ${UI.field({ label: 'Durée par défaut (min)', name: 'dureeRdvDefaut', type: 'number', step: '5', value: c.dureeRdvDefaut, disabled: ro })}
    </div>`)}</div>

    <div class="c6">${UI.card('Modèle de rappel', `<div class="form-grid">
      ${UI.field({ label: 'Message SMS / WhatsApp', name: 'rappelSms', type: 'textarea', rows: 5, value: c.rappelSms, full: true, disabled: ro,
        hint: 'Variables disponibles : {prenom}, {date}, {heure}, {tel}.' })}
    </div>`)}</div>

    ${ro ? '' : `<div class="c12"><div class="row" style="justify-content:flex-end">
      <button class="btn btn-primary btn-lg" data-savecab type="button">Enregistrer les paramètres</button></div></div>`}
  </div></form>`;
};

Views._par_actes = function () {
  const ro = !Perm.can('params.edit');
  const f = S.filtres.actes || (S.filtres.actes = { q: '', cat: '' });
  let list = DB.actes.slice();
  if (f.q) { const t = U.norm(f.q); list = list.filter(a => U.norm(a.libelle + ' ' + a.code).includes(t)); }
  if (f.cat) list = list.filter(a => a.categorie === f.cat);
  const cats = Array.from(new Set(DB.actes.map(a => a.categorie)));

  return `<div class="card">
    <div class="card-head">
      <div><h3>Catalogue des actes et honoraires</h3>
        <p>${DB.actes.length} actes — les tarifs servent de base aux devis, factures et plans de traitement</p></div>
      ${ro ? '' : `<button class="btn btn-sm btn-primary" data-act="new-acte">${Icons.plus} Nouvel acte</button>`}
    </div>
    <div class="tbl-toolbar">
      <input class="input search" data-f="q" type="search" placeholder="Libellé ou code…" value="${U.esc(f.q)}">
      <select class="select" data-f="cat">
        <option value="">Toutes les disciplines</option>
        ${cats.map(c => `<option value="${U.esc(c)}"${f.cat === c ? ' selected' : ''}>${U.esc(c)}</option>`).join('')}
      </select>
    </div>
    <div class="table-wrap">
      ${list.length ? `<table class="tbl">
        <thead><tr><th>Code</th><th>Libellé</th><th>Discipline</th><th class="num">Honoraires</th>
          <th class="num">Base CNAM</th><th class="num">Taux</th><th class="num">Durée</th><th>Actif</th>${ro ? '' : '<th></th>'}</tr></thead>
        <tbody>${U.sortBy(list, a => a.categorie + a.code).map(a => `<tr>
          <td class="mono cell-strong">${U.esc(a.code)}</td>
          <td>${U.esc(a.libelle)}</td>
          <td>${UI.badge(a.categorie, '', true)}</td>
          <td class="num cell-strong">${U.money(a.prix)}</td>
          <td class="num muted">${a.baseCnam ? U.money(a.baseCnam) : '—'}</td>
          <td class="num muted">${a.tauxCnam ? a.tauxCnam + ' %' : '—'}</td>
          <td class="num muted">${a.dureeMin} min</td>
          <td>${a.actif ? UI.badge('Actif', 'ok') : UI.badge('Inactif', '')}</td>
          ${ro ? '' : `<td class="right"><button class="btn btn-sm btn-ghost" data-acte="${a.id}" type="button">${Icons.edit}</button></td>`}
        </tr>`).join('')}</tbody>
      </table>` : UI.empty('Aucun acte', 'Aucun acte ne correspond à cette recherche.')}
    </div>
  </div>`;
};

Views._par_users = function () {
  return `<div class="grid">
    <div class="c12">${UI.card('Comptes du cabinet',
      `<div class="table-wrap"><table class="tbl">
        <thead><tr><th>Utilisateur</th><th>Identifiant</th><th>Rôle</th><th>Droits</th><th>Dernière connexion</th><th>État</th><th></th></tr></thead>
        <tbody>${DB.users.map(u => `<tr>
          <td><div class="row" style="gap:9px">
            <span class="avatar ${u.role === 'admin' ? '' : 'is-assist'}">${U.initials(u.nom.split(' ').slice(-1)[0], u.nom)}</span>
            <span><span class="cell-strong">${U.esc(u.nom)}</span><span class="cell-sub">${U.esc(u.fonction || '')}</span></span>
          </div></td>
          <td class="mono">${U.esc(u.login)}</td>
          <td>${UI.badge(u.role === 'admin' ? 'Praticienne' : 'Assistante', u.role === 'admin' ? 'accent' : 'gold')}</td>
          <td class="num">${u.role === 'admin' ? 'Tous' : (u.perms || []).length + ' / ' + ALL_PERMS.length}</td>
          <td class="nowrap muted">${u.lastLogin ? U.fmtTS(u.lastLogin) : 'Jamais'}</td>
          <td>${u.actif ? UI.badge('Actif', 'ok') : UI.badge('Désactivé', 'bad')}${u.mustChange ? ' ' + UI.badge('Mot de passe à changer', 'warn') : ''}</td>
          <td class="right"><button class="btn btn-sm" data-user="${u.id}" type="button">Gérer</button></td>
        </tr>`).join('')}</tbody>
      </table></div>`,
      { flush: true, actions: `<button class="btn btn-sm btn-primary" data-act="new-user">${Icons.plus} Nouvel utilisateur</button>` })}</div>

    <div class="c12">${UI.card('Matrice des droits', `
      <p class="muted" style="margin-bottom:14px">Cochez les droits accordés à chaque compte. La praticienne conserve en permanence l'accès complet ; ses droits ne peuvent pas être restreints.</p>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th style="min-width:280px">Droit</th>${DB.users.map(u => `<th class="center">${U.esc(u.nom.split(' ').slice(-1)[0])}</th>`).join('')}</tr></thead>
        <tbody>${PERMISSIONS.map(g => `
          <tr><td colspan="${DB.users.length + 1}" style="background:var(--surface-2)">
            <span class="eyebrow">${U.esc(g.group)}</span></td></tr>
          ${g.items.map(([key, label]) => `<tr>
            <td>${U.esc(label)}<span class="cell-sub mono">${U.esc(key)}</span></td>
            ${DB.users.map(u => `<td class="center">
              <input type="checkbox" data-perm="${u.id}|${key}"
                ${u.role === 'admin' || (u.perms || []).includes(key) ? 'checked' : ''}
                ${u.role === 'admin' ? 'disabled' : ''} style="accent-color:var(--accent);width:16px;height:16px">
            </td>`).join('')}
          </tr>`).join('')}`).join('')}
        </tbody>
      </table></div>`, { flush: false })}</div>
  </div>`;
};

Views._par_donnees = function () {
  const poids = (() => { try { return (JSON.stringify(DB).length / 1024).toFixed(0); } catch (e) { return '?'; } })();
  return `<div class="grid">
    <div class="c6">${UI.card('Sauvegarde et restauration', `
      <p class="muted">Les données du cabinet sont conservées dans le ${U.esc(Store.label())} de cet ordinateur. Exportez régulièrement une sauvegarde et conservez-la hors de la machine.</p>
      <div class="col" style="gap:10px;margin-top:16px">
        <button class="btn btn-primary btn-block" data-act="export-json" type="button">${Icons.download} Exporter la sauvegarde complète (JSON)</button>
        <button class="btn btn-block" data-act="import-json" type="button">${Icons.upload} Restaurer depuis une sauvegarde</button>
        <input type="file" id="importFile" accept="application/json,.json" class="hidden">
      </div>
      <dl class="dl" style="margin-top:18px">
        <dt>Mode de stockage</dt><dd>${U.esc(Store.label())}</dd>
        <dt>Taille des données</dt><dd class="num">${poids} Ko</dd>
        <dt>Dernière modification</dt><dd>${U.fmtTS(DB.meta.updatedAt)}</dd>
        <dt>Version</dt><dd class="mono">${U.esc(DB.meta.version)}</dd>
      </dl>`)}</div>

    <div class="c6">${UI.card('Volumétrie', `<dl class="dl">
      <dt>Patients</dt><dd class="num">${DB.patients.length}</dd>
      <dt>Rendez-vous</dt><dd class="num">${DB.rdv.length}</dd>
      <dt>Actes réalisés</dt><dd class="num">${DB.soins.length}</dd>
      <dt>Relevés d'odontogramme</dt><dd class="num">${DB.dents.length}</dd>
      <dt>Devis et factures</dt><dd class="num">${DB.factures.length}</dd>
      <dt>Règlements</dt><dd class="num">${DB.paiements.length}</dd>
      <dt>Dossiers CNAM</dt><dd class="num">${DB.cnam.length}</dd>
      <dt>Articles en stock</dt><dd class="num">${DB.stock.length}</dd>
      <dt>Bons de laboratoire</dt><dd class="num">${DB.labo.length}</dd>
      <dt>Écritures de charges</dt><dd class="num">${DB.depenses.length}</dd>
      <dt>Entrées du journal</dt><dd class="num">${DB.audit.length}</dd>
    </dl>`)}

    <div style="margin-top:var(--gap)">${UI.card('Zone sensible', `
      <p class="muted">La réinitialisation efface toutes les données du cabinet et rétablit le jeu de démonstration. Exportez une sauvegarde au préalable.</p>
      <button class="btn btn-danger btn-block" data-act="reset" type="button" style="margin-top:14px">${Icons.trash} Réinitialiser la base</button>`)}</div>
    </div>
  </div>`;
};

Views._par_journal = function () {
  const f = S.filtres.journal || (S.filtres.journal = { q: '', user: '' });
  let list = DB.audit.slice();
  if (f.user) list = list.filter(a => a.userId === f.user);
  if (f.q) { const t = U.norm(f.q); list = list.filter(a => U.norm(a.action + ' ' + a.entite + ' ' + a.detail + ' ' + a.userNom).includes(t)); }
  list = list.slice(0, 400);

  return UI.card('Journal d\'activité', `<div class="table-wrap"><table class="tbl">
    <thead><tr><th>Horodatage</th><th>Utilisateur</th><th>Action</th><th>Objet</th><th>Détail</th></tr></thead>
    <tbody>${list.map(a => `<tr>
      <td class="nowrap mono" style="font-size:12px">${U.fmtTS(a.ts)}</td>
      <td>${U.esc(a.userNom)}</td>
      <td>${UI.badge(a.action, a.action === 'suppression' || a.action === 'annulation' ? 'bad'
        : a.action === 'creation' ? 'ok' : a.action === 'connexion' || a.action === 'deconnexion' ? 'info' : '', true)}</td>
      <td class="muted">${U.esc(a.entite)}</td>
      <td>${U.esc(a.detail)}</td>
    </tr>`).join('')}</tbody></table></div>`,
    { flush: true, sous: `${DB.audit.length} événements enregistrés — les 400 plus récents sont affichés`,
      actions: `<div class="row" style="gap:8px">
        <input class="input" data-f="q" type="search" placeholder="Filtrer…" value="${U.esc(f.q)}" style="height:30px;min-height:30px;font-size:12.5px;width:170px">
        <select class="select" data-f="user" style="height:30px;min-height:30px;font-size:12.5px;width:auto">
          <option value="">Tous</option>
          ${DB.users.map(u => `<option value="${u.id}"${f.user === u.id ? ' selected' : ''}>${U.esc(u.nom)}</option>`).join('')}
        </select></div>` });
};

Views.paramsMount = function (arg) {
  const tab = arg || 'cabinet';
  Bind.click(async e => {
    const t = e.target.closest('[data-ptab]');
    if (t) { location.hash = '#/params/' + t.dataset.ptab; return; }

    if (e.target.closest('[data-savecab]')) {
      const v = UI.formValues(U.$('#cabForm'));
      Object.assign(DB.cabinet, v, {
        timbreFiscal: Number(v.timbreFiscal) || 0,
        tvaTaux: Number(v.tvaTaux) || 0,
        dureeRdvDefaut: Number(v.dureeRdvDefaut) || 30,
      });
      Audit.log('modification', 'parametres', null, 'Paramètres du cabinet');
      Data.commit();
      UI.toast('Paramètres enregistrés', '', 'ok');
      return;
    }

    const ac = e.target.closest('[data-acte]');
    if (ac) return Views.acteDialog(ac.dataset.acte);
    const us = e.target.closest('[data-user]');
    if (us) return Views.userDialog(us.dataset.user);

    const a = e.target.closest('[data-act]');
    if (!a) return;
    const k = a.dataset.act;
    if (k === 'new-acte') Views.acteDialog(null);
    if (k === 'new-user') Views.userDialog(null);
    if (k === 'export-json') {
      U.download(`sauvegarde-cabinet-${U.todayISO()}.json`, JSON.stringify(DB, null, 2));
      Audit.log('export', 'donnees', null, 'Sauvegarde complète exportée');
      Data.commit(true);
      UI.toast('Sauvegarde exportée', 'Conservez ce fichier en lieu sûr.', 'ok');
    }
    if (k === 'import-json') U.$('#importFile').click();
    if (k === 'reset') {
      const ok = await UI.confirm('Réinitialiser toute la base ?',
        'Tous les patients, rendez-vous, factures et paramètres seront <b>définitivement effacés</b> et remplacés par le jeu de démonstration.',
        { danger: true, ok: 'Tout effacer' });
      if (!ok) return;
      const conf = await UI.prompt('Confirmation', 'Saisissez EFFACER pour confirmer', '');
      if (conf !== 'EFFACER') return UI.toast('Réinitialisation annulée', '', 'warn');
      await Store.clear();
      location.reload();
    }
  });

  Bind.change(e => {
    const p = e.target.closest('[data-perm]');
    if (p) {
      const [uid, key] = p.dataset.perm.split('|');
      const u = Data.user(uid);
      if (!u || u.role === 'admin') return;
      u.perms = u.perms || [];
      if (p.checked) { if (!u.perms.includes(key)) u.perms.push(key); }
      else u.perms = u.perms.filter(x => x !== key);
      Audit.log('droits', 'utilisateur', u.id, `${p.checked ? 'Accord' : 'Retrait'} du droit « ${PERM_LABEL[key]} »`);
      Data.commit(true);
      if (Auth.current.id === u.id) App.render();
      UI.toast('Droits mis à jour', `${u.nom} — ${PERM_LABEL[key]}`, 'ok');
      return;
    }
    const fk = e.target.dataset.f;
    if (fk) {
      const store = tab === 'actes' ? S.filtres.actes : S.filtres.journal;
      store[fk] = e.target.value;
      App.render();
    }
  });

  Bind.input(U.debounce(e => {
    const fk = e.target.dataset.f;
    if (fk !== 'q') return;
    const store = tab === 'actes' ? S.filtres.actes : S.filtres.journal;
    store.q = e.target.value;
    App.render();
    const i = U.$('[data-f="q"]');
    if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  }, 280));

  const file = U.$('#importFile');
  if (file) file.addEventListener('change', async () => {
    const fl = file.files[0];
    if (!fl) return;
    try {
      const txt = await fl.text();
      const data = JSON.parse(txt);
      if (!data.meta || !data.users || !data.patients) throw new Error('Fichier non reconnu');
      const ok = await UI.confirm('Restaurer cette sauvegarde ?',
        `Le fichier contient <b>${data.patients.length} patients</b> et date du ${U.fmtTS(data.meta.updatedAt)}. Les données actuelles seront remplacées.`,
        { danger: true, ok: 'Restaurer' });
      if (!ok) return;
      await Store.write(data);
      location.reload();
    } catch (err) {
      UI.toast('Restauration impossible', err.message, 'bad');
    }
  });
};

Views.acteDialog = function (id) {
  const a = id ? Data.acte(id) : null;
  const cats = Array.from(new Set(DB.actes.map(x => x.categorie)));
  UI.modal({
    titre: a ? "Modifier l'acte" : 'Nouvel acte', sous: a ? a.libelle : '', size: 'lg',
    body: `<datalist id="acteCats">${cats.map(c => `<option value="${U.esc(c)}"></option>`).join('')}</datalist>
      <form id="acteForm"><div class="form-grid">
      ${UI.field({ label: 'Code', name: 'code', value: a ? a.code : '', required: true, placeholder: 'S01' })}
      ${UI.field({ label: 'Discipline', name: 'categorie', value: a ? a.categorie : '', list: 'acteCats', required: true })}
      ${UI.field({ label: 'Libellé', name: 'libelle', value: a ? a.libelle : '', required: true, full: true })}
      ${UI.field({ label: 'Honoraires (DT)', name: 'prix', type: 'number', step: '0.001', value: a ? a.prix : 0, required: true })}
      ${UI.field({ label: 'Durée (min)', name: 'dureeMin', type: 'number', step: '5', value: a ? a.dureeMin : 30 })}
      ${UI.field({ label: 'Base de remboursement CNAM (DT)', name: 'baseCnam', type: 'number', step: '0.001', value: a ? a.baseCnam : 0,
        hint: '0 si l\'acte n\'est pas pris en charge.' })}
      ${UI.field({ label: 'Taux CNAM (%)', name: 'tauxCnam', type: 'number', step: '1', value: a ? a.tauxCnam : 0 })}
      ${UI.field({ label: 'Acte proposé au catalogue', name: 'actif', type: 'checkbox', value: a ? a.actif : true, full: true })}
    </div></form>`,
    foot: `<div class="left">${a ? `<button class="btn btn-sm btn-ghost" data-del type="button" style="color:var(--bad)">${Icons.trash} Supprimer</button>` : ''}</div>
      <button class="btn" data-close type="button">Annuler</button>
      <button class="btn btn-primary" data-save type="button">Enregistrer</button>`,
    onMount(ov) {
      ov.addEventListener('click', async e => {
        if (e.target.closest('[data-del]')) {
          const ok = await UI.confirm("Supprimer cet acte ?", 'Les documents déjà émis ne sont pas modifiés.', { danger: true, ok: 'Supprimer' });
          if (!ok) return;
          DB.actes = DB.actes.filter(x => x.id !== a.id);
          Audit.log('suppression', 'acte', a.id, a.libelle);
          Data.commit(); UI.close(ov); return;
        }
        if (!e.target.closest('[data-save]')) return;
        const v = UI.formValues(ov.querySelector('#acteForm'));
        if (!v.code || !v.libelle) return UI.toast('Code et libellé requis', '', 'bad');
        const rec = a || { id: U.uid('act') };
        Object.assign(rec, {
          code: v.code.toUpperCase(), libelle: v.libelle, categorie: v.categorie || 'Divers',
          prix: Number(v.prix) || 0, dureeMin: Number(v.dureeMin) || 30,
          baseCnam: Number(v.baseCnam) || 0, tauxCnam: Number(v.tauxCnam) || 0, actif: !!v.actif,
        });
        if (!a) DB.actes.push(rec);
        Audit.log(a ? 'modification' : 'creation', 'acte', rec.id, `${rec.code} — ${rec.libelle} — ${U.money(rec.prix)}`);
        Data.commit(); UI.close(ov);
        UI.toast('Acte enregistré', rec.libelle, 'ok');
      });
    },
  });
};

Views.userDialog = function (id) {
  const u = id ? Data.user(id) : null;
  const estMoi = u && Auth.current.id === u.id;

  UI.modal({
    titre: u ? 'Gérer le compte' : 'Nouvel utilisateur',
    sous: u ? `${u.nom} — ${ROLE_LABEL[u.role]}` : '', size: 'lg',
    body: `<form id="userForm"><div class="form-grid">
      ${UI.field({ label: 'Nom affiché', name: 'nom', value: u ? u.nom : '', required: true, full: true })}
      ${UI.field({ label: 'Fonction', name: 'fonction', value: u ? u.fonction : '', full: true })}
      ${UI.field({ label: 'Identifiant de connexion', name: 'login', value: u ? u.login : '', required: true, disabled: !!u })}
      ${UI.field({ label: 'Rôle', name: 'role', type: 'select', value: u ? u.role : 'assistante',
        options: [['assistante', 'Assistante dentaire'], ['admin', 'Praticienne — accès complet']], disabled: estMoi })}
      ${UI.field({ label: 'Courriel', name: 'email', type: 'email', value: u ? u.email : '' })}
      ${UI.field({ label: 'Téléphone', name: 'tel', value: u ? u.tel : '' })}
      ${u ? '' : UI.field({ label: 'Mot de passe provisoire', name: 'password', type: 'password', required: true, full: true,
        hint: 'Il devra être changé à la première connexion.' })}
      ${u ? UI.field({ label: 'Compte actif', name: 'actif', type: 'checkbox', value: u.actif, full: true }) : ''}
    </div></form>
    ${u && u.role !== 'admin' ? `<div class="alert-band a-info" style="margin-top:16px">${Icons.lock}
      <span>Les droits détaillés de ce compte se règlent dans la <b>matrice des droits</b>, sous le tableau des utilisateurs.</span></div>` : ''}
    ${estMoi ? `<div class="alert-band a-warn" style="margin-top:16px">${Icons.alert}
      <span>Il s'agit de votre propre compte : vous ne pouvez ni changer votre rôle ni le désactiver.</span></div>` : ''}`,
    foot: `<div class="left row" style="gap:6px">
        ${u ? `<button class="btn btn-sm" data-pwd type="button">${Icons.lock} Réinitialiser le mot de passe</button>` : ''}
        ${u && !estMoi && u.role !== 'admin' ? `<button class="btn btn-sm btn-ghost" data-del type="button" style="color:var(--bad)">${Icons.trash} Supprimer</button>` : ''}
      </div>
      <button class="btn" data-close type="button">Annuler</button>
      <button class="btn btn-primary" data-save type="button">Enregistrer</button>`,
    onMount(ov) {
      ov.addEventListener('click', async e => {
        if (e.target.closest('[data-pwd]')) {
          const np = await UI.prompt('Réinitialiser le mot de passe', `Nouveau mot de passe pour ${u.nom}`, '',
            { type: 'password', hint: '8 caractères minimum. Le compte devra le changer à la prochaine connexion.' });
          if (np === null) return;
          if (np.length < 8) return UI.toast('Mot de passe trop court', '8 caractères minimum.', 'bad');
          await Auth.setPassword(u, np);
          u.mustChange = true;
          Audit.log('mot_de_passe', 'utilisateur', u.id, `Réinitialisation par ${Auth.current.nom}`);
          Data.commit(); UI.close(ov);
          UI.toast('Mot de passe réinitialisé', `${u.nom} devra le changer à la prochaine connexion.`, 'ok');
          return;
        }
        if (e.target.closest('[data-del]')) {
          const ok = await UI.confirm('Supprimer ce compte ?', `Le compte de <b>${U.esc(u.nom)}</b> sera supprimé. Les données qu'il a saisies sont conservées.`, { danger: true, ok: 'Supprimer' });
          if (!ok) return;
          DB.users = DB.users.filter(x => x.id !== u.id);
          Audit.log('suppression', 'utilisateur', u.id, u.nom);
          Data.commit(); UI.close(ov); return;
        }
        if (!e.target.closest('[data-save]')) return;
        const v = UI.formValues(ov.querySelector('#userForm'));
        if (!v.nom || !v.login) return UI.toast('Nom et identifiant requis', '', 'bad');

        if (!u) {
          if (!v.password || v.password.length < 8) return UI.toast('Mot de passe trop court', '8 caractères minimum.', 'bad');
          if (DB.users.some(x => U.norm(x.login) === U.norm(v.login))) return UI.toast('Identifiant déjà pris', '', 'bad');
          const h = await Auth.hash(v.password);
          DB.users.push({
            id: U.uid('usr'), login: v.login.trim(), nom: v.nom, fonction: v.fonction, role: v.role,
            actif: true, salt: h.salt, hash: h.hash, mustChange: true,
            perms: v.role === 'admin' ? null : ROLE_DEFAULTS.assistante.slice(),
            email: v.email, tel: v.tel, createdAt: Date.now(), lastLogin: null, echecs: 0,
          });
          Audit.log('creation', 'utilisateur', null, `${v.nom} (${v.login}) — ${ROLE_LABEL[v.role]}`);
        } else {
          Object.assign(u, { nom: v.nom, fonction: v.fonction, email: v.email, tel: v.tel });
          if (!estMoi) {
            u.role = v.role;
            u.actif = !!v.actif;
            if (v.role === 'admin') u.perms = null;
            else if (!u.perms) u.perms = ROLE_DEFAULTS.assistante.slice();
          }
          Audit.log('modification', 'utilisateur', u.id, u.nom);
        }
        Data.commit(); UI.close(ov);
        UI.toast('Compte enregistré', v.nom, 'ok');
      });
    },
  });
};
