# Cabinet dentaire Dr. Sarra Abassi — progiciel de gestion

Application de gestion complète d'un cabinet de médecine dentaire en Tunisie :
agenda, dossiers patients, odontogramme, plans de traitement, devis et factures
en dinars, caisse, dossiers CNAM, stock, laboratoire de prothèse, comptabilité
et rapports. Deux comptes avec des niveaux d'accès distincts.

Application web autonome : un seul fichier HTML, aucune dépendance externe,
aucun serveur applicatif, aucune installation.

---

## Comptes livrés

| Compte | Identifiant | Mot de passe provisoire | Rôle |
|---|---|---|---|
| Dr. Sarra Abassi | `sarra` | `Sarra@2026` | Praticienne — accès complet |
| Assistante du cabinet | `assistante` | `Assistante@2026` | Assistante dentaire — accès restreint |

Le mot de passe provisoire doit être remplacé à la première connexion : l'écran
s'ouvre automatiquement et ne peut pas être ignoré.

### Ce que voit l'assistante

Accès accordé : agenda, patients (fiche administrative), consultation du dossier
clinique et de l'odontogramme, devis et factures, encaissements, caisse et sa
clôture, dossiers CNAM, stock et commandes, laboratoire de prothèse.

Accès refusé : comptabilité et résultat, rapports financiers, paramètres du
cabinet, gestion des utilisateurs, journal d'activité, suppression de patients
ou de factures, modification de l'odontogramme, rédaction d'ordonnances et de
certificats — actes médicaux réservés à la praticienne.

Ces droits sont modifiables un par un depuis **Paramètres → Utilisateurs &
droits → Matrice des droits**. Trente droits élémentaires sont proposés.

---

## Modules

**Clinique** — Tableau de bord, agenda (vues jour et semaine, statuts de
rendez-vous, modèles de rappel SMS/WhatsApp), patients, odontogramme FDI
interactif (denture définitive et temporaire, cinq faces par dent, états
couronne / implant / absente / à extraire), plans de traitement par séances,
ordonnances et certificats imprimables.

**Finances** — Devis et factures avec catalogue d'actes, droit de timbre et TVA
paramétrables, mentions légales tunisiennes ; règlements multi-modes ; caisse
avec ouverture, clôture et contrôle d'écart ; dossiers CNAM avec calcul du
remboursement, plafond de 150 DT sur les soins, prothèses hors plafond, et
bordereau de dépôt imprimable ; comptabilité (charges par catégorie, recettes,
résultat, export CSV) ; rapports d'activité.

**Gestion** — Stock avec seuils d'alerte, péremptions, mouvements tracés et
fournisseurs ; bons de travail au laboratoire de prothèse avec suivi des délais ;
paramètres du cabinet ; catalogue de 62 actes tarifés ; sauvegarde et
restauration ; journal d'activité horodaté.

---

## Où sont les données

Les données sont conservées dans le navigateur du poste (localStorage, avec
repli sur IndexedDB). Elles ne transitent par aucun serveur : rien ne sort du
poste de travail. Conséquences à connaître :

- **Chaque navigateur a sa propre base.** Le poste d'accueil et l'ordinateur du
  bureau ne partagent pas leurs données. Pour un usage à deux postes, exportez
  et réimportez la sauvegarde, ou branchez une base distante (voir plus bas).
- **Exportez régulièrement.** Paramètres → Sauvegarde → *Exporter la sauvegarde
  complète*. Conservez le fichier JSON hors de la machine.
- **L'authentification est locale.** Les mots de passe sont hachés (PBKDF2-SHA256,
  120 000 itérations, sel aléatoire par compte) : ils ne sont jamais stockés en
  clair. Le cloisonnement des rôles régit l'usage quotidien, mais il ne protège
  pas contre quelqu'un qui aurait un accès physique complet à la machine. Le
  poste doit rester sous session Windows verrouillée.

---

## Développement

```bash
node build.mjs     # assemble src/ en deux fichiers autonomes dans dist/
node server.mjs    # sert dist/ sur http://localhost:5273
```

Sources dans `src/` :

| Fichier | Contenu |
|---|---|
| `css/app.css` | jetons de couleur (clair/sombre), composants, impression |
| `js/01-core.js` | utilitaires, persistance, modèle de données, authentification, droits, jeu de démonstration |
| `js/02-ui.js` | icônes, composants d'interface, routeur, recherche, alertes |
| `js/03-clinique.js` | tableau de bord, agenda, patients, odontogramme, plans, documents |
| `js/04-finance.js` | devis et factures, caisse, CNAM, comptabilité |
| `js/05-gestion.js` | stock, laboratoire, rapports, paramètres, utilisateurs |
| `js/06-boot.js` | amorçage |

Sorties dans `dist/` :

- `cabinet-erp.html` — document complet, à ouvrir localement ou à déposer sur
  n'importe quel hébergeur statique.
- `cabinet-erp.artifact.html` — même contenu sans les balises `<html>`, `<head>`
  et `<body>`, pour publication en Artifact claude.ai.

---

## Réinitialiser la démonstration

Le jeu de démonstration (14 patients tunisiens, 8 mois d'activité facturée,
stock, laboratoire, charges) se recrée depuis **Paramètres → Sauvegarde → Zone
sensible → Réinitialiser la base**. Avant la mise en service réelle, il est
recommandé de repartir d'une base vide : supprimez les patients de
démonstration, ou restaurez une sauvegarde nettoyée.

---

## Évolution possible : base partagée

Le code isole les accès aux données dans l'objet `Store` (`src/js/01-core.js`).
Pour que les deux postes travaillent sur la même base, il suffit de remplacer
ses méthodes `read` et `write` par des appels à un service distant (Supabase,
Neon, Cloudflare D1 — tous proposent une offre gratuite suffisante pour un
cabinet). Le reste de l'application n'a pas à changer. Cette étape nécessite la
création d'un compte chez le prestataire retenu.
