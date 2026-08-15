/* ==========================================================================
   06 — Amorçage de l'application.
   ========================================================================== */
'use strict';

(function start() {
  const go = () => {
    App.boot().catch(err => {
      console.error(err);
      document.body.innerHTML =
        `<div style="max-width:520px;margin:14vh auto;padding:26px;font-family:system-ui;line-height:1.6">
           <h1 style="font-size:20px;margin:0 0 10px">Le cabinet n'a pas pu démarrer</h1>
           <p style="color:#5C7370">Une erreur est survenue au chargement des données : <code>${String(err && err.message || err)}</code></p>
           <p style="color:#5C7370">Rechargez la page. Si le problème persiste, restaurez une sauvegarde depuis un autre navigateur.</p>
         </div>`;
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
  else go();
})();
