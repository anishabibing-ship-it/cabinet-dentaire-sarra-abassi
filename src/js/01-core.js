/* ==========================================================================
   01 — Socle : utilitaires, persistance, modèle de données, authentification,
   droits d'accès et journal d'activité.
   ========================================================================== */
'use strict';

const APP = { version: '1.0.0', key: 'cab-sarra-abassi-v1' };

/* ------------------------------------------------------------- Utilitaires */

const U = {
  $:  (sel, root) => (root || document).querySelector(sel),
  $$: (sel, root) => Array.from((root || document).querySelectorAll(sel)),

  esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  uid(prefix) {
    return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  },

  /* Dinar tunisien : 3 décimales (millimes) */
  money(n, withUnit) {
    const v = Number(n || 0);
    const s = v.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    return withUnit === false ? s : s + ' DT';
  },
  money0(n) {
    return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' DT';
  },
  num(n, d) {
    return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: d || 0, maximumFractionDigits: d === undefined ? 0 : d });
  },

  todayISO() { return U.toISO(new Date()); },
  toISO(d) {
    const x = new Date(d);
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  },
  fromISO(s) {
    if (!s) return null;
    const p = String(s).split('-').map(Number);
    return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
  },
  addDays(iso, n) {
    const d = U.fromISO(iso); d.setDate(d.getDate() + n); return U.toISO(d);
  },
  addMonths(iso, n) {
    const d = U.fromISO(iso); d.setMonth(d.getMonth() + n); return U.toISO(d);
  },
  fmtDate(iso) {
    if (!iso) return '—';
    const d = U.fromISO(iso);
    if (!d || isNaN(d)) return '—';
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  },
  fmtDateLong(iso) {
    if (!iso) return '—';
    const d = U.fromISO(iso);
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  },
  fmtDateShort(iso) {
    const d = U.fromISO(iso);
    return d ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—';
  },
  fmtTS(ts) {
    const d = new Date(ts);
    return U.fmtDate(U.toISO(d)) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  },
  monthKey(iso) { return String(iso || '').slice(0, 7); },
  monthLabel(key) {
    const [y, m] = String(key).split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
  },

  age(iso) {
    if (!iso) return null;
    const b = U.fromISO(iso), n = new Date();
    let a = n.getFullYear() - b.getFullYear();
    const m = n.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && n.getDate() < b.getDate())) a--;
    return a;
  },

  minutesToHM(m) {
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  },
  hmToMinutes(hm) {
    const p = String(hm || '0:0').split(':').map(Number);
    return (p[0] || 0) * 60 + (p[1] || 0);
  },

  initials(nom, prenom) {
    return ((prenom || '').trim()[0] || '' ).toUpperCase() + ((nom || '').trim()[0] || '').toUpperCase() || '?';
  },

  norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  },

  debounce(fn, ms) {
    let t; return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms || 200); };
  },

  sum(arr, get) { return arr.reduce((t, x) => t + Number(get ? get(x) : x || 0), 0); },

  groupBy(arr, get) {
    return arr.reduce((m, x) => { const k = get(x); (m[k] = m[k] || []).push(x); return m; }, {});
  },

  sortBy(arr, get, dir) {
    const s = arr.slice();
    s.sort((a, b) => {
      const x = get(a), y = get(b);
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (x > y ? 1 : -1) * (dir === 'desc' ? -1 : 1);
    });
    return s;
  },

  tel(t) { return String(t || '').replace(/\s+/g, '').replace(/^(\+216)?(\d{2})(\d{3})(\d{3})$/, '$2 $3 $4'); },

  download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 400);
  },
};

/* --------------------------------------------------------- Persistance
   localStorage en premier (synchrone, simple) ; IndexedDB en secours ;
   mémoire seule en dernier recours, avec avertissement à l'écran.        */

const Store = {
  mode: 'memory',
  _mem: null,

  async init() {
    try {
      const probe = '__probe_' + Date.now();
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      this.mode = 'local';
      return;
    } catch (e) { /* refusé : sandbox ou navigation privée */ }
    try {
      await this._idb(db => db);
      this.mode = 'idb';
    } catch (e) {
      this.mode = 'memory';
    }
  },

  _idb(fn) {
    return new Promise((res, rej) => {
      const rq = indexedDB.open(APP.key, 1);
      rq.onupgradeneeded = () => { rq.result.createObjectStore('kv'); };
      rq.onerror = () => rej(rq.error);
      rq.onsuccess = () => { try { res(fn(rq.result)); } catch (e) { rej(e); } };
    });
  },

  async read() {
    if (this.mode === 'local') {
      const raw = localStorage.getItem(APP.key);
      return raw ? JSON.parse(raw) : null;
    }
    if (this.mode === 'idb') {
      return this._idb(db => new Promise((res, rej) => {
        const rq = db.transaction('kv', 'readonly').objectStore('kv').get('data');
        rq.onsuccess = () => res(rq.result || null);
        rq.onerror = () => rej(rq.error);
      }));
    }
    return this._mem;
  },

  async write(data) {
    if (this.mode === 'local') {
      try { localStorage.setItem(APP.key, JSON.stringify(data)); return true; }
      catch (e) { this.mode = 'memory'; this._mem = data; return false; }
    }
    if (this.mode === 'idb') {
      return this._idb(db => new Promise((res, rej) => {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(data, 'data');
        tx.oncomplete = () => res(true);
        tx.onerror = () => rej(tx.error);
      }));
    }
    this._mem = data;
    return false;
  },

  async clear() {
    if (this.mode === 'local') localStorage.removeItem(APP.key);
    if (this.mode === 'idb') await this._idb(db => db.transaction('kv', 'readwrite').objectStore('kv').delete('data'));
    this._mem = null;
  },

  label() {
    return { local: 'navigateur (localStorage)', idb: 'navigateur (IndexedDB)', memory: 'mémoire vive — non persistant' }[this.mode];
  },
};

/* ------------------------------------------------------------------ Données */

let DB = null;

const Data = {
  _timer: null,

  commit(silent) {
    DB.meta.updatedAt = Date.now();
    clearTimeout(this._timer);
    this._timer = setTimeout(async () => {
      const ok = await Store.write(DB);
      if (!ok && Store.mode === 'memory' && !Data._warned) {
        Data._warned = true;
        UI.toast('Stockage indisponible', 'Les données ne seront pas conservées à la fermeture. Exportez une sauvegarde depuis Paramètres.', 'warn', 9000);
      }
    }, 180);
    if (!silent) App.refresh();
  },

  /* Accès collections */
  patient(id) { return DB.patients.find(p => p.id === id); },
  acte(id) { return DB.actes.find(a => a.id === id); },
  facture(id) { return DB.factures.find(f => f.id === id); },
  user(id) { return DB.users.find(u => u.id === id); },
  fournisseur(id) { return DB.fournisseurs.find(f => f.id === id); },
  article(id) { return DB.stock.find(s => s.id === id); },

  patientNom(id) {
    const p = this.patient(id);
    return p ? p.prenom + ' ' + p.nom : 'Patient supprimé';
  },

  nextSeq(kind) {
    DB.seq[kind] = (DB.seq[kind] || 0) + 1;
    return DB.seq[kind];
  },

  numeroFacture(type) {
    const n = this.nextSeq(type);
    const y = new Date().getFullYear();
    return (type === 'devis' ? 'DEV' : 'FAC') + '-' + y + '-' + String(n).padStart(4, '0');
  },

  /* Totaux d'une facture */
  totaux(f) {
    const brut = U.sum(f.lignes || [], l => Number(l.qte || 1) * Number(l.pu || 0));
    const remise = Number(f.remise || 0);
    const ht = Math.max(0, brut - remise);
    const tva = ht * (Number(f.tva || 0) / 100);
    const timbre = f.type === 'facture' ? Number(f.timbre || 0) : 0;
    const total = ht + tva + timbre;
    const paye = U.sum(DB.paiements.filter(p => p.factureId === f.id), p => p.montant);
    return { brut, remise, ht, tva, timbre, total, paye, reste: Math.max(0, total - paye) };
  },

  statutFacture(f) {
    if (f.statut === 'annulee') return 'annulee';
    if (f.type === 'devis') return f.statut;
    const t = this.totaux(f);
    if (t.reste <= 0.0005) return 'payee';
    if (t.paye > 0) return 'partielle';
    return 'emise';
  },

  soldePatient(pid) {
    const fs = DB.factures.filter(f => f.patientId === pid && f.type === 'facture' && f.statut !== 'annulee');
    return U.sum(fs, f => this.totaux(f).reste);
  },

  caPatient(pid) {
    return U.sum(DB.paiements.filter(p => p.patientId === pid), p => p.montant);
  },
};

/* ------------------------------------------------------------------- Droits */

const PERMISSIONS = [
  { group: 'Clinique', items: [
    ['agenda.view',      "Consulter l'agenda"],
    ['agenda.edit',      'Créer et modifier les rendez-vous'],
    ['patients.view',    'Consulter la liste des patients'],
    ['patients.edit',    'Créer et modifier les fiches patients'],
    ['patients.delete',  'Archiver ou supprimer un patient'],
    ['clinique.view',    "Consulter le dossier médical et l'odontogramme"],
    ['clinique.edit',    "Modifier l'odontogramme, les soins et les plans de traitement"],
    ['ordonnance.create','Rédiger ordonnances et certificats'],
  ]},
  { group: 'Finances', items: [
    ['facture.view',   'Consulter devis et factures'],
    ['facture.edit',   'Établir devis et factures'],
    ['facture.delete', 'Annuler une facture'],
    ['paiement.edit',  'Encaisser un règlement'],
    ['caisse.view',    'Consulter la caisse du jour'],
    ['caisse.close',   'Clôturer la caisse'],
    ['cnam.view',      'Consulter les dossiers CNAM'],
    ['cnam.edit',      'Gérer les dossiers CNAM'],
    ['compta.view',    'Consulter la comptabilité et le résultat'],
    ['compta.edit',    'Saisir les charges et dépenses'],
    ['rapports.view',  'Consulter les rapports et statistiques'],
  ]},
  { group: 'Gestion', items: [
    ['stock.view',   'Consulter le stock'],
    ['stock.edit',   'Mouvementer le stock et commander'],
    ['labo.view',    'Consulter les travaux de laboratoire'],
    ['labo.edit',    'Gérer les travaux de laboratoire'],
    ['params.view',  'Accéder aux paramètres du cabinet'],
    ['params.edit',  'Modifier les paramètres, tarifs et catalogue'],
    ['users.manage', 'Gérer les utilisateurs et leurs droits'],
    ['audit.view',   "Consulter le journal d'activité"],
    ['data.export',  'Sauvegarder et restaurer les données'],
  ]},
];

const ALL_PERMS = PERMISSIONS.flatMap(g => g.items.map(i => i[0]));

const PERM_LABEL = Object.fromEntries(PERMISSIONS.flatMap(g => g.items));

const ROLE_DEFAULTS = {
  admin: ALL_PERMS.slice(),
  assistante: [
    'agenda.view', 'agenda.edit',
    'patients.view', 'patients.edit',
    'clinique.view',
    'facture.view', 'facture.edit',
    'paiement.edit', 'caisse.view', 'caisse.close',
    'cnam.view', 'cnam.edit',
    'stock.view', 'stock.edit',
    'labo.view', 'labo.edit',
  ],
};

const ROLE_LABEL = { admin: 'Praticienne — accès complet', assistante: 'Assistante dentaire' };

const Perm = {
  can(p) {
    const u = Auth.current;
    if (!u) return false;
    if (u.role === 'admin') return true;
    return (u.perms || ROLE_DEFAULTS[u.role] || []).includes(p);
  },
  canAny(...ps) { return ps.some(p => this.can(p)); },
  /* Garde-fou pour les vues : renvoie du HTML si l'accès est refusé */
  guard(p) {
    if (this.can(p)) return null;
    return `<div class="card"><div class="empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>
      <h3>Accès non autorisé</h3>
      <p>Votre profil ne dispose pas du droit « ${U.esc(PERM_LABEL[p] || p)} ». Demandez à Dr. Sarra Abassi de vous l'accorder depuis Paramètres → Utilisateurs.</p>
    </div></div>`;
  },
};

/* ---------------------------------------------------------- Authentification */

const Auth = {
  current: null,

  async hash(password, saltHex) {
    const enc = new TextEncoder();
    const salt = saltHex ? Uint8Array.from(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)))
                         : crypto.getRandomValues(new Uint8Array(16));
    const saltStr = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');

    if (crypto.subtle && crypto.subtle.importKey) {
      try {
        const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits(
          { name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, key, 256);
        const hex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
        return { salt: saltStr, hash: 'pbkdf2$' + hex };
      } catch (e) { /* repli ci-dessous */ }
    }
    /* Repli si WebCrypto indisponible (contexte non sécurisé) */
    let h = 0x811c9dc5;
    const s = saltStr + '|' + password + '|' + saltStr;
    for (let round = 0; round < 5000; round++) {
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    }
    return { salt: saltStr, hash: 'fnv$' + h.toString(16) };
  },

  async verify(password, user) {
    const r = await this.hash(password, user.salt);
    return r.hash === user.hash;
  },

  async login(login, password) {
    const u = DB.users.find(x => U.norm(x.login) === U.norm(login));
    if (!u) return { ok: false, msg: "Identifiant inconnu." };
    if (!u.actif) return { ok: false, msg: 'Ce compte est désactivé.' };
    const ok = await this.verify(password, u);
    if (!ok) {
      u.echecs = (u.echecs || 0) + 1;
      Data.commit(true);
      return { ok: false, msg: 'Mot de passe incorrect.' };
    }
    u.echecs = 0;
    u.lastLogin = Date.now();
    this.current = u;
    try { sessionStorage.setItem(APP.key + ':sess', u.id); } catch (e) {}
    Audit.log('connexion', 'session', u.id, 'Ouverture de session');
    Data.commit(true);
    return { ok: true, user: u };
  },

  logout() {
    if (this.current) Audit.log('deconnexion', 'session', this.current.id, 'Fermeture de session');
    this.current = null;
    try { sessionStorage.removeItem(APP.key + ':sess'); } catch (e) {}
    location.hash = '';
    App.showAuth();
  },

  restore() {
    let id = null;
    try { id = sessionStorage.getItem(APP.key + ':sess'); } catch (e) {}
    if (!id) return false;
    const u = DB.users.find(x => x.id === id && x.actif);
    if (!u) return false;
    this.current = u;
    return true;
  },

  async setPassword(user, password) {
    const r = await this.hash(password);
    user.salt = r.salt;
    user.hash = r.hash;
    user.mustChange = false;
    user.pwdChangedAt = Date.now();
    Data.commit(true);
  },

  strength(p) {
    let s = 0;
    if (p.length >= 8) s++;
    if (p.length >= 12) s++;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
    if (/\d/.test(p)) s++;
    if (/[^\w\s]/.test(p)) s++;
    return Math.min(s, 4);
  },
};

/* ------------------------------------------------------- Journal d'activité */

const Audit = {
  log(action, entite, entiteId, detail) {
    if (!DB) return;
    DB.audit.unshift({
      id: U.uid('log'),
      ts: Date.now(),
      userId: Auth.current ? Auth.current.id : null,
      userNom: Auth.current ? Auth.current.nom : 'Système',
      action, entite, entiteId: entiteId || null,
      detail: detail || '',
    });
    if (DB.audit.length > 4000) DB.audit.length = 4000;
  },
};

/* ================================================================= Amorçage
   Jeu de données initial : cabinet, comptes, catalogue d'actes, patients,
   agenda de la semaine, factures, stock, laboratoire et charges.
   ================================================================= */

const Seed = {
  async build() {
    const today = U.todayISO();
    const admin = await Auth.hash('Sarra@2026');
    const assist = await Auth.hash('Assistante@2026');

    const db = {
      meta: { version: APP.version, createdAt: Date.now(), updatedAt: Date.now(), seeded: true },

      cabinet: {
        nom: 'Cabinet dentaire Dr. Sarra Abassi',
        praticien: 'Dr. Sarra Abassi',
        titre: 'Médecin dentiste',
        specialite: 'Médecine dentaire — soins conservateurs, prothèse et esthétique',
        adresse: '14, rue du Lac Turkana, Immeuble Yasmine, 2e étage',
        ville: 'Les Berges du Lac, Tunis',
        codePostal: '1053',
        pays: 'Tunisie',
        tel: '+216 71 962 480',
        mobile: '+216 98 415 072',
        email: 'contact@cabinet-abassi.tn',
        matriculeFiscal: '1789456 / A / M / 000',
        codeCNAM: 'CNAM-DT-04127',
        cnom: 'CNOMD 4127',
        rib: 'TN59 1010 0350 1234 5678 9012',
        banque: 'STB — Agence Lac 2',
        devise: 'DT',
        timbreFiscal: 1.000,
        tvaTaux: 0,
        joursOuvres: [1, 2, 3, 4, 5, 6],
        heureDebut: '08:30',
        heureFin: '18:30',
        pauseDebut: '13:00',
        pauseFin: '14:00',
        samediFin: '13:00',
        dureeRdvDefaut: 30,
        mentionsFacture: 'Actes de médecine dentaire — exonérés de TVA (art. 8 du code de la TVA). Règlement à réception. Aucun tiers payant : la facture acquittée sert de justificatif de remboursement CNAM.',
        rappelSms: 'Bonjour {prenom}, nous vous rappelons votre rendez-vous au Cabinet Dr. Sarra Abassi le {date} à {heure}. Pour annuler ou reporter : {tel}. Merci.',
      },

      users: [
        {
          id: 'usr_sarra', login: 'sarra', nom: 'Dr. Sarra Abassi', fonction: 'Médecin dentiste — gérante',
          role: 'admin', actif: true, salt: admin.salt, hash: admin.hash, mustChange: true,
          perms: null, email: 'sarra.abassi@cabinet-abassi.tn', tel: '+216 98 415 072',
          createdAt: Date.now(), lastLogin: null, echecs: 0,
        },
        {
          id: 'usr_assist', login: 'assistante', nom: 'Assistante du cabinet', fonction: 'Assistante dentaire — accueil et stérilisation',
          role: 'assistante', actif: true, salt: assist.salt, hash: assist.hash, mustChange: true,
          perms: ROLE_DEFAULTS.assistante.slice(), email: 'accueil@cabinet-abassi.tn', tel: '+216 71 962 480',
          createdAt: Date.now(), lastLogin: null, echecs: 0,
        },
      ],

      actes: Seed.actes(),
      patients: [], dents: [], rdv: [], soins: [], plans: [],
      factures: [], paiements: [], caisse: [], cnam: [],
      stock: [], mouvements: [], fournisseurs: [], commandes: [],
      labo: [], depenses: [], ordonnances: [], documents: [], audit: [],
      seq: { facture: 0, devis: 0, patient: 0, labo: 0, commande: 0 },
    };

    Seed.fill(db, today);
    return db;
  },

  /* ---- Catalogue des actes (tarifs indicatifs, à ajuster en Paramètres) --- */
  actes() {
    const A = (code, libelle, categorie, prix, dureeMin, baseCnam, tauxCnam) =>
      ({ id: 'act_' + code.toLowerCase(), code, libelle, categorie, prix, dureeMin, baseCnam: baseCnam || 0, tauxCnam: tauxCnam || 0, actif: true });

    return [
      A('C01', 'Consultation et examen clinique', 'Consultation', 40, 20, 30, 70),
      A('C02', 'Consultation d\'urgence', 'Consultation', 60, 20, 30, 70),
      A('C03', 'Visite de contrôle', 'Consultation', 25, 15, 0, 0),

      A('R01', 'Radiographie rétro-alvéolaire', 'Radiologie', 25, 10, 20, 70),
      A('R02', 'Radiographie panoramique', 'Radiologie', 60, 15, 45, 70),

      A('P01', 'Détartrage complet (2 arcades)', 'Prévention', 80, 40, 40, 70),
      A('P02', 'Détartrage + polissage', 'Prévention', 100, 45, 40, 70),
      A('P03', 'Scellement de sillons (par dent)', 'Prévention', 45, 20, 0, 0),
      A('P04', 'Application de fluor', 'Prévention', 50, 20, 0, 0),
      A('P05', 'Motivation à l\'hygiène bucco-dentaire', 'Prévention', 30, 20, 0, 0),

      A('S01', 'Composite 1 face', 'Soins conservateurs', 90, 30, 45, 70),
      A('S02', 'Composite 2 faces', 'Soins conservateurs', 120, 40, 55, 70),
      A('S03', 'Composite 3 faces / reconstitution', 'Soins conservateurs', 160, 50, 65, 70),
      A('S04', 'Coiffage pulpaire', 'Soins conservateurs', 70, 25, 0, 0),
      A('S05', 'Restauration provisoire (IRM)', 'Soins conservateurs', 45, 20, 0, 0),
      A('S06', 'Inlay-onlay composite', 'Soins conservateurs', 320, 60, 0, 0),

      A('E01', 'Traitement canalaire monoradiculaire', 'Endodontie', 190, 60, 90, 70),
      A('E02', 'Traitement canalaire biradiculaire', 'Endodontie', 250, 75, 110, 70),
      A('E03', 'Traitement canalaire pluriradiculaire', 'Endodontie', 320, 90, 130, 70),
      A('E04', 'Reprise de traitement endodontique', 'Endodontie', 400, 90, 0, 0),
      A('E05', 'Pulpotomie (dent temporaire)', 'Endodontie', 110, 40, 0, 0),

      A('X01', 'Extraction simple', 'Chirurgie', 80, 30, 40, 70),
      A('X02', 'Extraction complexe / alvéolectomie', 'Chirurgie', 160, 45, 70, 70),
      A('X03', 'Extraction dent de sagesse incluse', 'Chirurgie', 350, 60, 120, 70),
      A('X04', 'Germectomie', 'Chirurgie', 300, 60, 0, 0),
      A('X05', 'Suture / révision alvéolaire', 'Chirurgie', 60, 20, 0, 0),
      A('X06', 'Kystectomie / apicectomie', 'Chirurgie', 450, 75, 0, 0),

      A('D01', 'Détartrage sous-gingival par secteur', 'Parodontologie', 120, 45, 0, 0),
      A('D02', 'Surfaçage radiculaire (par quadrant)', 'Parodontologie', 180, 50, 0, 0),
      A('D03', 'Gingivectomie', 'Parodontologie', 250, 45, 0, 0),
      A('D04', 'Contention parodontale', 'Parodontologie', 300, 60, 0, 0),

      A('F01', 'Couronne céramo-métallique', 'Prothèse fixe', 480, 60, 200, 70),
      A('F02', 'Couronne céramo-céramique (E-max)', 'Prothèse fixe', 750, 60, 200, 70),
      A('F03', 'Couronne zircone', 'Prothèse fixe', 850, 60, 200, 70),
      A('F04', 'Inlay-core / faux moignon', 'Prothèse fixe', 220, 45, 90, 70),
      A('F05', 'Bridge — élément intermédiaire', 'Prothèse fixe', 480, 45, 200, 70),
      A('F06', 'Couronne provisoire', 'Prothèse fixe', 90, 30, 0, 0),
      A('F07', 'Descellement / rescellement', 'Prothèse fixe', 70, 20, 0, 0),

      A('M01', 'Prothèse adjointe complète (1 arcade)', 'Prothèse amovible', 950, 60, 400, 70),
      A('M02', 'Prothèse adjointe partielle résine', 'Prothèse amovible', 620, 60, 280, 70),
      A('M03', 'Prothèse châssis métallique (stellite)', 'Prothèse amovible', 1250, 60, 400, 70),
      A('M04', 'Réparation de prothèse', 'Prothèse amovible', 120, 30, 0, 0),
      A('M05', 'Rebasage de prothèse', 'Prothèse amovible', 220, 40, 0, 0),
      A('M06', 'Dent supplémentaire sur prothèse', 'Prothèse amovible', 90, 30, 0, 0),

      A('I01', 'Pose d\'implant (unitaire)', 'Implantologie', 1800, 90, 0, 0),
      A('I02', 'Pilier implantaire + couronne', 'Implantologie', 1100, 60, 0, 0),
      A('I03', 'Greffe osseuse / comblement', 'Implantologie', 900, 75, 0, 0),
      A('I04', 'Sinus lift', 'Implantologie', 1500, 90, 0, 0),

      A('B01', 'Blanchiment au fauteuil (2 arcades)', 'Esthétique', 550, 75, 0, 0),
      A('B02', 'Blanchiment ambulatoire + gouttières', 'Esthétique', 400, 45, 0, 0),
      A('B03', 'Facette céramique', 'Esthétique', 900, 60, 0, 0),
      A('B04', 'Facette composite (stratification)', 'Esthétique', 350, 60, 0, 0),

      A('O01', 'Consultation orthodontique + bilan', 'Orthodontie', 120, 45, 0, 0),
      A('O02', 'Traitement multi-attaches (semestre)', 'Orthodontie', 1400, 40, 0, 0),
      A('O03', 'Séance de réglage ODF', 'Orthodontie', 120, 30, 0, 0),
      A('O04', 'Contention post-orthodontique', 'Orthodontie', 380, 40, 0, 0),

      A('K01', 'Consultation pédodontique', 'Pédodontie', 40, 25, 30, 70),
      A('K02', 'Soin dent temporaire', 'Pédodontie', 80, 30, 0, 0),
      A('K03', 'Extraction dent temporaire', 'Pédodontie', 60, 20, 0, 0),
      A('K04', 'Mainteneur d\'espace', 'Pédodontie', 280, 40, 0, 0),
    ];
  },

  /* ------------------------- Données d'exemple, ancrées sur la date du jour */
  fill(db, today) {
    /* Générateur pseudo-aléatoire déterministe : le jeu de démonstration
       est identique d'une installation à l'autre. */
    let graine = 7;
    const rnd = () => { graine = (graine * 9301 + 49297) % 233280; return graine / 233280; };

    const P = (code, nom, prenom, sexe, naiss, cin, tel, ville, assur, opts) => {
      const p = {
        id: 'pat_' + code, code: 'P-' + String(code).padStart(4, '0'),
        nom, prenom, sexe, dateNaissance: naiss, cin, tel, tel2: '', email: (opts && opts.email) || '',
        adresse: (opts && opts.adresse) || '', ville, profession: (opts && opts.profession) || '',
        assurance: assur,
        medical: Object.assign({
          allergies: [], pathologies: [], traitements: '', tabac: false, grossesse: false,
          groupeSanguin: '', notes: '',
        }, (opts && opts.medical) || {}),
        tags: (opts && opts.tags) || [],
        notes: (opts && opts.notes) || '',
        createdAt: Date.now() - (opts && opts.anciennete ? opts.anciennete : 200) * 86400000,
        createdBy: 'usr_sarra', archived: false,
        premiereVisite: (opts && opts.premiereVisite) || U.addDays(today, -(opts && opts.anciennete ? opts.anciennete : 200)),
      };
      db.patients.push(p);
      db.seq.patient = Math.max(db.seq.patient, Number(code));
      return p;
    };

    const cnam = (num, regime) => ({ type: 'cnam', numero: num, regime: regime || 'Remboursement des frais', plafondSoins: 150, consommeSoins: 0 });
    const priv = (org, num) => ({ type: 'privee', organisme: org, numero: num, regime: 'Assurance groupe' });
    const aucune = () => ({ type: 'aucune', numero: '', regime: '' });

    P(1,  'Ben Salah',  'Amine',   'M', '1985-03-14', '08214563', '+216 98 214 563', 'El Menzah 6, Tunis',  cnam('105874123', 'Remboursement des frais'), { profession: 'Ingénieur', anciennete: 640, adresse: '22, rue Ibn Khaldoun', email: 'a.bensalah@mail.tn', medical: { pathologies: ['Hypertension artérielle'], traitements: 'Amlodipine 5 mg / jour', tabac: true, groupeSanguin: 'O+' } });
    P(2,  'Trabelsi',   'Ines',    'F', '1992-11-02', '09873214', '+216 22 873 214', 'Ariana Ville',        cnam('112458796'), { profession: 'Pharmacienne', anciennete: 410, adresse: '5, avenue Habib Bourguiba', medical: { allergies: ['Pénicilline'], groupeSanguin: 'A+' } });
    P(3,  'Gharbi',     'Mohamed', 'M', '1978-06-23', '05412789', '+216 71 845 210', 'Le Bardo, Tunis',     priv('GAT Assurances', 'GAT-88541'), { profession: 'Commerçant', anciennete: 900, medical: { pathologies: ['Diabète type 2'], traitements: 'Metformine 1000 mg × 2', notes: 'Contrôle glycémique avant tout acte chirurgical.', groupeSanguin: 'B+' } });
    P(4,  'Khelifi',    'Rania',   'F', '1998-01-19', '11254789', '+216 55 124 789', 'La Marsa, Tunis',     cnam('120145879'), { profession: 'Étudiante en architecture', anciennete: 200, medical: { groupeSanguin: 'O-' }, tags: ['Orthodontie'] });
    P(5,  'Jaziri',     'Slim',    'M', '1965-09-08', '02147859', '+216 98 741 852', 'El Manar 2, Tunis',   cnam('098754123'), { profession: 'Professeur universitaire', anciennete: 1200, medical: { pathologies: ['Cardiopathie — valve mécanique'], traitements: 'Sintrom (AVK)', notes: 'ANTIBIOPROPHYLAXIE OBLIGATOIRE avant tout acte sanglant. INR à contrôler.', groupeSanguin: 'A-' } });
    P(6,  'Belhaj',     'Nour',    'F', '2016-04-27', '',         '+216 27 458 123', 'Les Berges du Lac 2', cnam('120145879'), { profession: 'Scolarisée (CE2)', anciennete: 300, notes: 'Accompagnée par sa mère, Mme Khelifi Rania.', tags: ['Pédodontie'] });
    P(7,  'Mansouri',   'Karim',   'M', '1989-12-11', '07854123', '+216 52 145 963', 'Ennasr 2, Ariana',    aucune(), { profession: 'Développeur', anciennete: 90, medical: { tabac: true, groupeSanguin: 'AB+' }, tags: ['Esthétique'] });
    P(8,  'Zouari',     'Faten',   'F', '1974-07-30', '03214785', '+216 20 587 412', 'Mégrine, Ben Arous',  cnam('087451236'), { profession: 'Fonctionnaire', anciennete: 750, medical: { allergies: ['Latex'], groupeSanguin: 'O+' } });
    P(9,  'Chaabane',   'Hedi',    'M', '1955-02-05', '00458712', '+216 71 452 013', 'Bab Souika, Tunis',   cnam('045871236', 'Pensionné'), { profession: 'Retraité', anciennete: 1500, medical: { pathologies: ['Diabète type 2', 'Insuffisance rénale légère'], groupeSanguin: 'B-' }, tags: ['Prothèse'] });
    P(10, 'Ferchichi',  'Salma',   'F', '1995-05-16', '10254789', '+216 24 587 963', 'Manouba',             cnam('118745236'), { profession: 'Infirmière', anciennete: 150, medical: { grossesse: true, notes: 'Grossesse — 5e mois. Éviter radiographies et vasoconstricteurs.', groupeSanguin: 'A+' } });
    P(11, 'Ouali',      'Yassine', 'M', '2011-10-03', '',         '+216 98 336 147', 'El Menzah 9, Tunis',  cnam('105874123'), { profession: 'Collégien', anciennete: 420, tags: ['Pédodontie', 'Orthodontie'] });
    P(12, 'Dridi',      'Leila',   'F', '1982-08-21', '06541239', '+216 29 654 123', 'Carthage, Tunis',     priv('STAR Assurances', 'STAR-45120'), { profession: 'Avocate', anciennete: 560, medical: { groupeSanguin: 'AB-' }, tags: ['Esthétique'] });
    P(13, 'Nasri',      'Walid',   'M', '1990-04-09', '08745120', '+216 50 874 512', 'Radès, Ben Arous',    cnam('109874521'), { profession: 'Technicien', anciennete: 45, medical: { tabac: true } });
    P(14, 'Bouazizi',   'Sonia',   'F', '1968-01-25', '01254783', '+216 98 125 478', 'Sidi Bou Saïd',       cnam('065412378'), { profession: 'Restauratrice', anciennete: 1000, medical: { pathologies: ['Ostéoporose'], traitements: 'Biphosphonates (Alendronate)', notes: 'Biphosphonates : risque d\'ostéonécrose — prudence en chirurgie.', groupeSanguin: 'O+' }, tags: ['Prothèse'] });

    /* ---- État dentaire de départ (odontogramme) ---- */
    const D = (pid, dent, face, etat, note) => db.dents.push({
      id: U.uid('dt'), patientId: pid, dent: String(dent), face: face || null, etat,
      date: U.addDays(today, -Math.floor(Math.random() * 300) - 10), note: note || '', by: 'usr_sarra',
    });
    D('pat_1', 36, null, 'couronne'); D('pat_1', 46, 'O', 'soin'); D('pat_1', 16, 'MO', 'carie');
    D('pat_1', 26, 'O', 'soin'); D('pat_1', 18, null, 'absente');
    D('pat_3', 47, null, 'absente'); D('pat_3', 46, null, 'implant'); D('pat_3', 45, 'D', 'carie');
    D('pat_3', 24, 'O', 'soin'); D('pat_3', 25, 'MO', 'soin');
    D('pat_5', 11, null, 'couronne'); D('pat_5', 21, null, 'couronne'); D('pat_5', 12, 'V', 'soin');
    D('pat_9', 17, null, 'absente'); D('pat_9', 16, null, 'absente'); D('pat_9', 26, null, 'absente');
    D('pat_9', 27, null, 'absente'); D('pat_9', 36, null, 'absente'); D('pat_9', 37, null, 'absente');
    D('pat_9', 34, null, 'couronne'); D('pat_9', 44, null, 'couronne');
    D('pat_14', 15, null, 'a_extraire'); D('pat_14', 25, null, 'couronne'); D('pat_14', 35, 'O', 'carie');
    D('pat_2', 36, 'O', 'carie'); D('pat_2', 37, 'OD', 'a_faire');
    D('pat_6', 75, 'O', 'carie'); D('pat_6', 85, 'O', 'carie'); D('pat_6', 55, 'O', 'soin');
    D('pat_11', 36, 'O', 'soin'); D('pat_11', 46, 'O', 'soin');
    D('pat_7', 11, 'V', 'a_faire'); D('pat_7', 21, 'V', 'a_faire');
    D('pat_12', 13, 'V', 'a_faire'); D('pat_12', 12, 'V', 'a_faire'); D('pat_12', 11, 'V', 'a_faire');

    /* ---- Fournisseurs ---- */
    const F = (id, nom, type, contact, tel, email, ville) =>
      db.fournisseurs.push({ id, nom, type, contact, tel, email, adresse: ville, notes: '' });
    F('four_dentalux', 'Dentalux Tunisie',        'Consommables', 'M. Riadh Ayari',    '+216 71 234 567', 'commande@dentalux.tn',   'Zone industrielle Charguia II, Tunis');
    F('four_medident', 'MediDent Distribution',   'Consommables', 'Mme Olfa Ben Amor', '+216 71 876 543', 'contact@medident.tn',    'Rue de Marseille, Tunis');
    F('four_lab_sfax', 'Laboratoire Dental Art',  'Laboratoire',  'M. Nizar Kammoun',  '+216 74 445 120', 'dentalart@mail.tn',      'Sfax');
    F('four_lab_tunis','Laboratoire Prothéo',     'Laboratoire',  'M. Hatem Ghedira',  '+216 71 558 200', 'protheo.lab@mail.tn',    'Montplaisir, Tunis');
    F('four_implant',  'Implant Systems Tunisie', 'Implantologie','Dr. Sami Louati',   '+216 98 771 400', 'sav@implantsys.tn',      'Les Berges du Lac, Tunis');

    /* ---- Stock ---- */
    const S = (id, ref, designation, categorie, unite, quantite, seuil, prixAchat, four, peremption, lot) =>
      db.stock.push({ id, ref, designation, categorie, unite, quantite, seuil, prixAchat, fournisseurId: four, peremption: peremption || '', lot: lot || '', emplacement: '' });
    S('stk_01', 'ANE-ART4', 'Anesthésique Articaïne 4 % + adrénaline', 'Anesthésie', 'carpule', 42, 50, 1.850, 'four_dentalux', U.addDays(today, 120), 'L-24118');
    S('stk_02', 'ANE-LID2', 'Anesthésique Lidocaïne 2 %', 'Anesthésie', 'carpule', 90, 40, 1.200, 'four_dentalux', U.addDays(today, 260), 'L-24007');
    S('stk_03', 'AIG-30G',  'Aiguilles courtes 30G', 'Anesthésie', 'boîte de 100', 6, 4, 22.000, 'four_dentalux', U.addDays(today, 500), '');
    S('stk_04', 'GAN-NIT',  'Gants nitrile non poudrés (M)', 'Hygiène', 'boîte de 100', 14, 10, 18.500, 'four_medident', U.addDays(today, 400), '');
    S('stk_05', 'MAS-CHIR', 'Masques chirurgicaux 3 plis', 'Hygiène', 'boîte de 50', 22, 12, 9.000, 'four_medident', '', '');
    S('stk_06', 'COMP-A2',  'Composite photopolymérisable A2', 'Restauration', 'seringue', 7, 6, 46.000, 'four_dentalux', U.addDays(today, 210), 'C-2417');
    S('stk_07', 'COMP-A3',  'Composite photopolymérisable A3', 'Restauration', 'seringue', 3, 6, 46.000, 'four_dentalux', U.addDays(today, 180), 'C-2419');
    S('stk_08', 'ADH-UNI',  'Adhésif universel (5 ml)', 'Restauration', 'flacon', 4, 3, 78.000, 'four_dentalux', U.addDays(today, 150), '');
    S('stk_09', 'CIM-VER',  'Ciment verre ionomère', 'Restauration', 'kit', 5, 3, 92.000, 'four_medident', U.addDays(today, 330), '');
    S('stk_10', 'FRA-DIA',  'Fraises diamantées (assortiment)', 'Rotatif', 'boîte de 10', 9, 5, 34.000, 'four_dentalux', '', '');
    S('stk_11', 'FRA-CAR',  'Fraises carbure de tungstène', 'Rotatif', 'boîte de 5', 4, 4, 41.000, 'four_dentalux', '', '');
    S('stk_12', 'LIM-PRO',  'Limes endodontiques rotatives ProTaper', 'Endodontie', 'coffret', 2, 3, 165.000, 'four_medident', '', '');
    S('stk_13', 'GUT-PER',  'Pointes de gutta-percha', 'Endodontie', 'boîte', 8, 4, 28.000, 'four_medident', U.addDays(today, 600), '');
    S('stk_14', 'HYP-25',   'Hypochlorite de sodium 2,5 %', 'Endodontie', 'flacon 1 L', 5, 3, 12.000, 'four_dentalux', U.addDays(today, 90), '');
    S('stk_15', 'ALG-EMP',  'Alginate pour empreintes', 'Prothèse', 'sachet 500 g', 6, 4, 26.000, 'four_medident', U.addDays(today, 240), '');
    S('stk_16', 'SIL-EMP',  'Silicone d\'empreinte (base + catalyseur)', 'Prothèse', 'kit', 3, 2, 168.000, 'four_medident', U.addDays(today, 300), '');
    S('stk_17', 'PLA-DUR',  'Plâtre dur type IV', 'Prothèse', 'sac 5 kg', 4, 2, 45.000, 'four_lab_tunis', '', '');
    S('stk_18', 'SUT-30',   'Fils de suture résorbables 3/0', 'Chirurgie', 'boîte de 12', 3, 2, 88.000, 'four_medident', U.addDays(today, 420), '');
    S('stk_19', 'STE-SAC',  'Sachets de stérilisation autoclave', 'Stérilisation', 'boîte de 200', 5, 3, 32.000, 'four_medident', '', '');
    S('stk_20', 'DES-SUR',  'Désinfectant de surfaces', 'Stérilisation', 'bidon 5 L', 2, 2, 54.000, 'four_medident', U.addDays(today, 170), '');
    S('stk_21', 'IMP-3510', 'Implants titane Ø3,5 × 10 mm', 'Implantologie', 'unité', 6, 3, 420.000, 'four_implant', U.addDays(today, 900), 'IMP-77120');
    S('stk_22', 'BLA-GEL',  'Gel de blanchiment 35 % (kit)', 'Esthétique', 'kit', 2, 2, 210.000, 'four_dentalux', U.addDays(today, 60), 'B-2404');
    S('stk_23', 'ASP-CAN',  'Canules d\'aspiration jetables', 'Hygiène', 'sachet de 100', 11, 6, 14.000, 'four_medident', '', '');
    S('stk_24', 'GOB-PAT',  'Gobelets patients', 'Hygiène', 'sachet de 100', 18, 8, 7.500, 'four_medident', '', '');

    /* Quelques mouvements récents */
    [['stk_01', -8, 'sortie', 'Consommation soins'], ['stk_07', -3, 'sortie', 'Composites du jour'],
     ['stk_04', 10, 'entree', 'Réception commande CMD-2026-0031'], ['stk_20', -1, 'sortie', 'Désinfection salle'],
     ['stk_14', -1, 'perte', 'Flacon renversé']].forEach((m, i) => {
      db.mouvements.push({ id: U.uid('mv'), stockId: m[0], date: U.addDays(today, -i - 1), type: m[2], quantite: Math.abs(m[1]), motif: m[3], by: 'usr_assist' });
    });

    /* ---- Agenda : la semaine courante ---- */
    const motifs = [
      ['Détartrage', 'act_p01'], ['Composite 36', 'act_s02'], ['Contrôle post-opératoire', 'act_c03'],
      ['Traitement canalaire', 'act_e02'], ['Empreinte couronne', 'act_f01'], ['Consultation', 'act_c01'],
      ['Extraction', 'act_x01'], ['Essayage prothèse', 'act_m03'], ['Pose couronne', 'act_f01'],
      ['Urgence — douleur', 'act_c02'], ['Réglage ODF', 'act_o03'], ['Blanchiment', 'act_b01'],
      ['Radiographie panoramique', 'act_r02'], ['Soin pédodontique', 'act_k02'], ['Surfaçage', 'act_d02'],
    ];
    const statuts = ['confirme', 'confirme', 'prevu', 'confirme', 'termine', 'prevu', 'confirme'];
    const pids = db.patients.map(p => p.id);
    const dow = U.fromISO(today).getDay();
    const monday = U.addDays(today, dow === 0 ? -6 : 1 - dow);

    for (let d = 0; d < 6; d++) {
      const date = U.addDays(monday, d);
      const past = U.fromISO(date) < U.fromISO(today);
      const n = d === 5 ? 4 : 6 + Math.floor(rnd() * 3);
      let t = 8 * 60 + 30;
      for (let i = 0; i < n; i++) {
        const m = motifs[Math.floor(rnd() * motifs.length)];
        const acte = db.actes.find(a => a.id === m[1]);
        const duree = acte ? Math.max(20, acte.dureeMin) : 30;
        if (t >= 13 * 60 && t < 14 * 60) t = 14 * 60;
        if (d === 5 && t >= 13 * 60) break;
        if (t + duree > 18 * 60 + 30) break;
        const statut = past ? (rnd() < 0.12 ? 'absent' : 'termine')
                            : (date === today ? (t < 11 * 60 ? 'termine' : statuts[Math.floor(rnd() * statuts.length)]) : (rnd() < 0.65 ? 'confirme' : 'prevu'));
        db.rdv.push({
          id: U.uid('rdv'), patientId: pids[Math.floor(rnd() * pids.length)],
          date, heure: U.minutesToHM(t), duree, motif: m[0], acteId: m[1],
          statut, note: '', praticien: 'usr_sarra', createdAt: Date.now(), rappelEnvoye: past || rnd() < .5,
        });
        t += duree + (rnd() < .3 ? 10 : 0);
      }
    }
    /* Quelques rendez-vous la semaine suivante */
    for (let d = 7; d < 12; d++) {
      const date = U.addDays(monday, d);
      let t = 9 * 60;
      for (let i = 0; i < 3 + Math.floor(rnd() * 3); i++) {
        const m = motifs[Math.floor(rnd() * motifs.length)];
        db.rdv.push({
          id: U.uid('rdv'), patientId: pids[Math.floor(rnd() * pids.length)], date,
          heure: U.minutesToHM(t), duree: 30, motif: m[0], acteId: m[1], statut: 'prevu',
          note: '', praticien: 'usr_sarra', createdAt: Date.now(), rappelEnvoye: false,
        });
        t += 45;
      }
    }

    /* ---- Soins réalisés, factures et règlements ---- */
    const mkFacture = (pid, dateISO, lignes, opts) => {
      opts = opts || {};
      const f = {
        id: U.uid('fac'), numero: '', type: opts.type || 'facture', patientId: pid,
        date: dateISO, echeance: U.addDays(dateISO, 30), lignes,
        remise: opts.remise || 0, timbre: (opts.type === 'devis') ? 0 : db.cabinet.timbreFiscal,
        tva: db.cabinet.tvaTaux, statut: opts.statut || 'emise', note: opts.note || '',
        createdBy: 'usr_sarra', createdAt: Date.now(),
      };
      const n = (db.seq[f.type] = (db.seq[f.type] || 0) + 1);
      f.numero = (f.type === 'devis' ? 'DEV' : 'FAC') + '-' + U.fromISO(dateISO).getFullYear() + '-' + String(n).padStart(4, '0');
      db.factures.push(f);
      return f;
    };
    const L = (acteId, qte, dents) => {
      const a = db.actes.find(x => x.id === acteId);
      return { acteId, libelle: a.libelle, code: a.code, qte: qte || 1, pu: a.prix, dents: dents || [] };
    };
    const pay = (f, montant, mode, dateISO) => db.paiements.push({
      id: U.uid('pay'), factureId: f.id, patientId: f.patientId, date: dateISO,
      montant, mode, reference: '', note: '', by: 'usr_assist', caisseId: null,
    });

    /* Historique de production des sept mois précédents : le cabinet doit
       présenter une activité cohérente dans les rapports et la comptabilité. */
    const poids = [
      ['act_c01', 4], ['act_c03', 3], ['act_c02', 1], ['act_p01', 4], ['act_p02', 3],
      ['act_s01', 4], ['act_s02', 4], ['act_s03', 2], ['act_s05', 1],
      ['act_e01', 2], ['act_e02', 2], ['act_e03', 1],
      ['act_x01', 3], ['act_x02', 1], ['act_x03', 1],
      ['act_r01', 3], ['act_r02', 1],
      ['act_f01', 2], ['act_f02', 1], ['act_f04', 1], ['act_m02', 1], ['act_m01', 1],
      ['act_d01', 1], ['act_d02', 1], ['act_k01', 2], ['act_k02', 2],
      ['act_b02', 1], ['act_b04', 1], ['act_o03', 2], ['act_p03', 1],
    ];
    const panier = [];
    poids.forEach(([id, w]) => { for (let i = 0; i < w; i++) panier.push(id); });
    const modes = ['especes', 'especes', 'especes', 'especes', 'especes', 'especes',
                   'cheque', 'cheque', 'carte', 'carte', 'virement'];

    for (let m = 7; m >= 0; m--) {
      const ancre = U.addMonths(today, -m);
      const nb = 24 + Math.floor(rnd() * 13);
      for (let i = 0; i < nb; i++) {
        const d = U.fromISO(ancre);
        d.setDate(1 + Math.floor(rnd() * 27));
        if (d.getDay() === 0) d.setDate(d.getDate() + 1);
        const date = U.toISO(d);
        if (date >= today) continue;

        const pid = pids[Math.floor(rnd() * pids.length)];
        const nbActes = 1 + (rnd() < 0.38 ? 1 : 0) + (rnd() < 0.13 ? 1 : 0);
        const lignes = [];
        for (let k = 0; k < nbActes; k++) lignes.push(L(panier[Math.floor(rnd() * panier.length)]));

        const f = mkFacture(pid, date, lignes);
        const total = U.sum(lignes, l => l.qte * l.pu) + f.timbre;
        const mode = modes[Math.floor(rnd() * modes.length)];
        const sort = rnd();
        if (sort < 0.87) pay(f, Math.round(total * 1000) / 1000, mode, date);
        else if (sort < 0.95) pay(f, Math.round(total * 0.5 * 1000) / 1000, mode, date);

        lignes.forEach(l => db.soins.push({
          id: U.uid('soi'), patientId: pid, date, acteId: l.acteId, libelle: l.libelle,
          dents: [], prix: l.pu, remise: 0, statut: 'realise', factureId: f.id,
          note: '', by: 'usr_sarra',
        }));
      }
    }

    const f1 = mkFacture('pat_1', U.addDays(today, -46), [L('act_p02'), L('act_s02', 1, ['46'])]);
    pay(f1, 221.000, 'especes', U.addDays(today, -46));
    const f2 = mkFacture('pat_3', U.addDays(today, -38), [L('act_e03', 1, ['46']), L('act_f01', 1, ['46'])]);
    pay(f2, 400.000, 'cheque', U.addDays(today, -38));
    pay(f2, 300.000, 'especes', U.addDays(today, -12));
    const f3 = mkFacture('pat_5', U.addDays(today, -30), [L('act_f02', 2, ['11', '21']), L('act_f04', 2, ['11', '21'])]);
    pay(f3, 1000.000, 'virement', U.addDays(today, -29));
    const f4 = mkFacture('pat_9', U.addDays(today, -22), [L('act_m01', 1), L('act_c01')]);
    pay(f4, 500.000, 'especes', U.addDays(today, -22));
    const f5 = mkFacture('pat_2', U.addDays(today, -15), [L('act_p01'), L('act_s01', 1, ['36'])]);
    pay(f5, 171.000, 'carte', U.addDays(today, -15));
    const f6 = mkFacture('pat_14', U.addDays(today, -9), [L('act_c01'), L('act_r02')]);
    pay(f6, 101.000, 'especes', U.addDays(today, -9));
    const f7 = mkFacture('pat_12', U.addDays(today, -6), [L('act_b01')]);
    const f8 = mkFacture('pat_8', U.addDays(today, -4), [L('act_x02', 1, ['38'])]);
    pay(f8, 161.000, 'especes', U.addDays(today, -4));
    const f9 = mkFacture('pat_13', U.addDays(today, -2), [L('act_c02'), L('act_s05', 1, ['26'])]);
    const f10 = mkFacture('pat_10', today, [L('act_c01'), L('act_p01')]);
    pay(f10, 121.000, 'especes', today);
    const f11 = mkFacture('pat_11', today, [L('act_o03')]);
    pay(f11, 121.000, 'especes', today);
    const f12 = mkFacture('pat_4', U.addDays(today, -60), [L('act_o01'), L('act_r02')]);
    pay(f12, 181.000, 'especes', U.addDays(today, -60));

    /* Devis en attente */
    mkFacture('pat_7', U.addDays(today, -8), [L('act_b04', 4, ['11', '12', '21', '22'])], { type: 'devis', statut: 'propose', note: 'Facettes composite sur les 4 incisives — 2 séances.' });
    mkFacture('pat_14', U.addDays(today, -5), [L('act_x01', 1, ['15']), L('act_i01', 1, ['15']), L('act_i02', 1, ['15'])], { type: 'devis', statut: 'propose', remise: 150, note: 'Extraction, implant et couronne sur 15. Remise confrère.' });
    mkFacture('pat_9', U.addDays(today, -3), [L('act_m03', 1)], { type: 'devis', statut: 'propose', note: 'Châssis métallique mandibulaire.' });
    mkFacture('pat_12', U.addDays(today, -20), [L('act_b03', 6)], { type: 'devis', statut: 'accepte', note: '6 facettes céramiques — accepté le ' + U.fmtDate(U.addDays(today, -14)) });

    /* ---- Plans de traitement ---- */
    db.plans.push({
      id: 'pln_1', patientId: 'pat_14', titre: 'Réhabilitation secteur 1 — implant sur 15',
      date: U.addDays(today, -5), statut: 'propose', remise: 150,
      lignes: [
        { acteId: 'act_x01', libelle: 'Extraction simple', dents: ['15'], prix: 80, seance: 1, fait: false },
        { acteId: 'act_i01', libelle: 'Pose d\'implant (unitaire)', dents: ['15'], prix: 1800, seance: 2, fait: false },
        { acteId: 'act_i02', libelle: 'Pilier implantaire + couronne', dents: ['15'], prix: 1100, seance: 3, fait: false },
      ], note: 'Délai de cicatrisation de 3 mois entre la pose et la couronne.',
    });
    db.plans.push({
      id: 'pln_2', patientId: 'pat_3', titre: 'Assainissement et prothèse secteur 4',
      date: U.addDays(today, -40), statut: 'accepte', remise: 0,
      lignes: [
        { acteId: 'act_e03', libelle: 'Traitement canalaire pluriradiculaire', dents: ['46'], prix: 320, seance: 1, fait: true },
        { acteId: 'act_f01', libelle: 'Couronne céramo-métallique', dents: ['46'], prix: 480, seance: 2, fait: true },
        { acteId: 'act_s02', libelle: 'Composite 2 faces', dents: ['45'], prix: 120, seance: 3, fait: false },
      ], note: '',
    });
    db.plans.push({
      id: 'pln_3', patientId: 'pat_7', titre: 'Harmonisation du sourire — facettes composite',
      date: U.addDays(today, -8), statut: 'propose', remise: 0,
      lignes: [
        { acteId: 'act_p02', libelle: 'Détartrage + polissage', dents: [], prix: 100, seance: 1, fait: false },
        { acteId: 'act_b04', libelle: 'Facette composite (stratification)', dents: ['11', '12', '21', '22'], prix: 350, seance: 2, fait: false },
      ], note: 'Patient fumeur : prévenir du risque de coloration.',
    });

    /* ---- Soins réalisés (historique clinique) ---- */
    const soin = (pid, dateISO, acteId, dents, statut) => {
      const a = db.actes.find(x => x.id === acteId);
      db.soins.push({
        id: U.uid('soi'), patientId: pid, date: dateISO, acteId, libelle: a.libelle,
        dents: dents || [], prix: a.prix, remise: 0, statut: statut || 'realise',
        factureId: null, note: '', by: 'usr_sarra',
      });
    };
    soin('pat_1', U.addDays(today, -46), 'act_p02', []);
    soin('pat_1', U.addDays(today, -46), 'act_s02', ['46']);
    soin('pat_3', U.addDays(today, -38), 'act_e03', ['46']);
    soin('pat_3', U.addDays(today, -20), 'act_f01', ['46']);
    soin('pat_5', U.addDays(today, -30), 'act_f02', ['11', '21']);
    soin('pat_9', U.addDays(today, -22), 'act_m01', []);
    soin('pat_2', U.addDays(today, -15), 'act_s01', ['36']);
    soin('pat_8', U.addDays(today, -4), 'act_x02', ['38']);
    soin('pat_10', today, 'act_p01', []);
    soin('pat_13', U.addDays(today, -2), 'act_s05', ['26']);
    soin('pat_2', U.addDays(today, 6), 'act_s02', ['37'], 'planifie');

    /* ---- Dossiers CNAM ---- */
    const dossierCnam = (pid, f, type, statut, jours) => {
      const t = (() => {
        const brut = U.sum(f.lignes, l => l.qte * l.pu);
        return brut - (f.remise || 0) + (f.timbre || 0);
      })();
      const base = type === 'prothese' ? 400 : Math.min(150, t * 0.7);
      db.cnam.push({
        id: U.uid('cnm'), patientId: pid, factureId: f.id, date: f.date, type,
        montantFacture: t, baseRemb: base, taux: 70,
        montantRemb: Math.round(base * 0.7 * 1000) / 1000,
        statut, bordereau: statut === 'a_deposer' ? '' : 'BD-' + U.fromISO(f.date).getFullYear() + '-' + String(10 + jours).padStart(3, '0'),
        dateDepot: statut === 'a_deposer' ? '' : U.addDays(f.date, 3),
        dateRemb: statut === 'rembourse' ? U.addDays(f.date, 32) : '',
        note: '',
      });
    };
    dossierCnam('pat_1', f1, 'soins', 'rembourse', 1);
    dossierCnam('pat_3', f2, 'prothese', 'depose', 2);
    dossierCnam('pat_5', f3, 'prothese', 'rembourse', 3);
    dossierCnam('pat_9', f4, 'prothese', 'depose', 4);
    dossierCnam('pat_2', f5, 'soins', 'a_deposer', 5);
    dossierCnam('pat_10', f10, 'soins', 'a_deposer', 6);
    dossierCnam('pat_14', f6, 'soins', 'rejete', 7);
    db.cnam[db.cnam.length - 1].note = 'Rejet : facture non acquittée lors du dépôt. À redéposer avec cachet « payé ».';

    /* ---- Laboratoire de prothèse ---- */
    const labo = (pid, four, type, dents, teinte, statut, jEnvoi, jPrevu, cout) => {
      const n = (db.seq.labo = (db.seq.labo || 0) + 1);
      db.labo.push({
        id: U.uid('lab'), numero: 'LAB-' + U.fromISO(today).getFullYear() + '-' + String(n).padStart(3, '0'),
        patientId: pid, laboId: four, type, dents, teinte, statut,
        date: U.addDays(today, jEnvoi), dateLivraisonPrevue: U.addDays(today, jPrevu),
        dateLivraison: statut === 'livre' ? U.addDays(today, jPrevu) : '',
        cout, note: '',
      });
    };
    labo('pat_9',  'four_lab_tunis', 'Prothèse adjointe complète maxillaire', [], 'A2', 'livre',      -22, -8,  380);
    labo('pat_5',  'four_lab_sfax',  'Couronnes E-max ×2',                    ['11', '21'], 'A1', 'livre', -30, -18, 420);
    labo('pat_3',  'four_lab_tunis', 'Couronne céramo-métallique',            ['46'], 'A3', 'livre',      -26, -20, 190);
    labo('pat_14', 'four_lab_tunis', 'Châssis métallique mandibulaire',       [], 'A2', 'en_cours',   -6,  4,   520);
    labo('pat_12', 'four_lab_sfax',  'Facettes céramiques ×6',                ['13', '12', '11', '21', '22', '23'], 'B1', 'en_cours', -3, 9, 1080);
    labo('pat_1',  'four_lab_tunis', 'Couronne zircone',                      ['36'], 'A2', 'a_envoyer', 0, 12, 310);

    /* ---- Dépenses et charges ---- */
    const dep = (jours, categorie, libelle, montant, mode, four) => db.depenses.push({
      id: U.uid('dep'), date: U.addDays(today, -jours), categorie, libelle, montant,
      mode: mode || 'virement', fournisseurId: four || null, justificatif: '', recurrent: false, by: 'usr_sarra',
    });
    /* Charges récurrentes sur huit mois */
    for (let m = 0; m < 8; m++) {
      const ancre = U.addMonths(today, -m);
      const jour = j => {
        const d = U.fromISO(ancre); d.setDate(Math.min(j, 28));
        return Math.round((U.fromISO(today) - d) / 86400000);
      };
      if (jour(5) < 0) continue;
      dep(jour(5),  'Loyer',       'Loyer du cabinet',                     1800.000, 'virement', null);
      dep(jour(4),  'Salaires',    'Salaire assistante dentaire',           950.000, 'virement', null);
      dep(jour(4),  'Charges sociales', 'CNSS — cotisations',               218.000, 'virement', null);
      dep(jour(11), 'Énergie',     'STEG — électricité et gaz',   210 + Math.round(rnd() * 90), 'virement', null);
      dep(jour(11), 'Énergie',     'SONEDE — eau',                 55 + Math.round(rnd() * 25), 'virement', null);
      dep(jour(18), 'Télécom',     'Internet et téléphonie fixe',            89.900, 'virement', null);
      dep(jour(9),  'Consommables', 'Réassort consommables du mois', 380 + Math.round(rnd() * 520), 'cheque', rnd() < .5 ? 'four_medident' : 'four_dentalux');
      if (rnd() < 0.7) dep(jour(21), 'Laboratoire', 'Facture laboratoire de prothèse', 450 + Math.round(rnd() * 700), 'cheque', rnd() < .5 ? 'four_lab_tunis' : 'four_lab_sfax');
    }
    /* Charges ponctuelles */
    dep(18, 'Maintenance', 'Entretien annuel fauteuil et compresseur',  480.000, 'especes',  null);
    dep(20, 'Assurance',   'Responsabilité civile professionnelle',     620.000, 'virement', null);
    dep(30, 'Formation',   'Congrès de médecine dentaire — inscription', 350.000, 'carte',   null);
    dep(44, 'Impôts',      'Acompte provisionnel',                      980.000, 'virement', null);
    dep(52, 'Consommables', 'Implants et matériel de chirurgie',       1260.000, 'virement', 'four_implant');
    dep(96, 'Matériel',    'Radiographie panoramique — 2e échéance',   2400.000, 'virement', null);

    /* ---- Ordonnances ---- */
    db.ordonnances.push({
      id: U.uid('ord'), patientId: 'pat_8', date: U.addDays(today, -4), by: 'usr_sarra',
      lignes: [
        { medicament: 'Amoxicilline 1 g', posologie: '1 comprimé matin et soir', duree: '6 jours' },
        { medicament: 'Paracétamol 1 g', posologie: '1 comprimé toutes les 6 h si douleur', duree: '4 jours' },
        { medicament: 'Bain de bouche chlorhexidine 0,12 %', posologie: '2 bains de bouche par jour après les repas', duree: '7 jours' },
      ],
      note: 'Ne pas cracher ni rincer pendant 24 h. Alimentation tiède. Contrôle à 7 jours.',
    });
    db.ordonnances.push({
      id: U.uid('ord'), patientId: 'pat_13', date: U.addDays(today, -2), by: 'usr_sarra',
      lignes: [
        { medicament: 'Ibuprofène 400 mg', posologie: '1 comprimé 3 fois par jour au cours des repas', duree: '3 jours' },
      ],
      note: 'Pulpite sur 26 — traitement canalaire programmé.',
    });

    /* ---- Caisse : journée en cours ---- */
    db.caisse.push({
      id: U.uid('cai'), date: today, ouverture: '08:15', fermeture: '', fondCaisse: 100.000,
      totalEspeces: 0, ecart: 0, statut: 'ouverte', by: 'usr_assist', note: '',
    });

    /* Rattacher les règlements en espèces du jour à la caisse ouverte */
    const caisseJour = db.caisse[0];
    db.paiements.filter(p => p.date === today && p.mode === 'especes').forEach(p => { p.caisseId = caisseJour.id; });

    db.audit.push({
      id: U.uid('log'), ts: Date.now(), userId: null, userNom: 'Système',
      action: 'initialisation', entite: 'application', entiteId: null,
      detail: 'Création de la base du cabinet avec le jeu de données de démonstration.',
    });
  },
};
