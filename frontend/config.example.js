// EZ-one — config front
// Copiez ce fichier vers `config.js`, puis remplissez avec vos valeurs.
// `config.js` est gitignore.
//
// IMPORTANT : ces valeurs sont PUBLIQUES par nature.
// L'unsigned upload preset Cloudinary est concu pour etre expose cote front.
// Sa securite repose sur les contraintes definies dans le preset (folder,
// taille max, types autorises) et non sur le secret de la cle.
//
// Setup Cloudinary (5 minutes) :
//   1. Creez un compte sur https://cloudinary.com (free tier : 10 Go storage,
//      20 Go bandwidth/mois, 100 Mo/fichier).
//   2. Console > Settings > Upload > Upload presets > Add upload preset.
//   3. Configuration recommandee — onglet "General" :
//        - Signing Mode        : Unsigned
//        - Preset name         : ez_one_candidatures
//        - Folder              : candidatures
//        - Use filename        : true
//        - Unique filename     : true
//   4. Onglet "Upload control" :
//        - Allowed formats     : pdf,mp4,webm,mov
//        - Max file size       : 100000000 (100 Mo)
//        - Resource type       : Auto
//   5. Onglet "Advanced" — IMPORTANT :
//        - Return delete token : true   <-- INDISPENSABLE
//        Ce flag doit etre active dans le preset (et NON passe en parametre
//        cote front, car interdit en unsigned upload). Il fait que la reponse
//        d'upload contient un `delete_token` valide 10 min, qui permet au
//        navigateur de supprimer le fichier si le candidat change d'avis.
//   6. Save. Copiez le nom du preset.
//   7. Le cloud_name est en haut de la console Cloudinary.

window.EZONE_CONFIG = {
  CLOUDINARY: {
    cloud_name:    "dp2gg2xss",
    upload_preset: "ez_one_candidatures",
    folder:        "candidatures",
  },

  // Limites cote client (validation avant upload)
  LIMITS: {
    cv_max_mb:         25,   // PDF
    video_max_mb:      100,  // limite Cloudinary single-shot (chunked au-dela)
    video_max_seconds: 90,   // marge sur "1 min"
  },
};
