# Frontend EZ-one

Formulaire de candidature multi-etapes, statique, deploye sur Netlify.
Upload direct des fichiers vers Cloudinary, soumission de metadonnees vers
Netlify Forms.

## Architecture

```
                             ┌─ Cloudinary ──┐
        upload direct (XHR)  │  CV (raw/pdf) │
   ┌───────────────────────▶ │  Video (mp4)  │
   │                         └───────┬───────┘
   │                                 │ secure_url
   │                                 ▼
   │                        hidden inputs du form
   │                                 │
[Navigateur] ──── POST urlencoded ───▶ [Netlify Forms]
   ↑                                              │
   └──────────────── /merci.html ◄────────────────┘
```

## Structure

```
frontend/
├── index.html          # form 3 etapes (Identite -> CV -> Video)
├── merci.html          # page de confirmation
├── styles.css          # editorial-confident, multi-step transitions
├── app.js              # navigation, Cloudinary upload, Netlify submit
├── config.example.js   # template de config (commit)
└── config.js           # vos valeurs Cloudinary (gitignore)
```

## UX/UI choisie (basee sur recherche 2026)

- **Multi-step (3 etapes)** : taux de completion superieur aux long forms.
- **Single-column** : alignement avec le scan vertical naturel.
- **Stepper visible** avec progress bar : reduit l'abandon.
- **Inline validation** : erreurs au focus / blur, jamais brutalement.
- **Required vs optional** explicites : asterisque rouge / "optionnel" mono.
- **CTA action-specific** : "Envoyer mon dossier" plutot que "Submit".
- **Drag-and-drop + click** sur les dropzones.
- **Live video preview** apres upload (joue dans la page).
- **Copy editoriale** : on parle a un humain, pas a un formulaire.

## Direction esthetique

| Element       | Choix                                                    |
|---------------|----------------------------------------------------------|
| Display       | **Fraunces** (serif variable, italic pour les emphases)  |
| Body          | **IBM Plex Sans** (anti-AI-slop)                         |
| Mono          | **IBM Plex Mono** (kickers, numeros, micro)              |
| Papier        | `#FAF6EE` (off-white chaud, grain subtil)                |
| Encre         | `#0E1E2B` (navy profond)                                 |
| Accent        | `#C2410C` (terracotta, jamais violet)                    |
| Composition   | Asymetrique 2 cols, intro sticky a gauche                |
| Motion        | Entree staggered, transitions de step `cubic-bezier(.2,.8,.2,1)` |

## Setup local

```bash
# 1. Copiez config.example.js vers config.js
cp frontend/config.example.js frontend/config.js

# 2. Editez frontend/config.js avec vos valeurs Cloudinary (voir setup ci-dessous)

# 3. Servez le dossier
cd frontend
python -m http.server 8000
# Ouvrir http://localhost:8000
```

## Setup Cloudinary (5 min)

1. Creez un compte gratuit sur https://cloudinary.com.
2. Console > **Settings** > **Upload** > **Upload presets** > **Add upload preset**.
3. Configuration recommandee :

   **Onglet General**
   | Champ              | Valeur                          |
   |--------------------|---------------------------------|
   | Signing Mode       | **Unsigned**                    |
   | Preset name        | `ez_one_candidatures`           |
   | Folder             | `candidatures`                  |
   | Use filename       | `true`                          |
   | Unique filename    | `true`                          |

   **Onglet Upload control**
   | Champ              | Valeur                          |
   |--------------------|---------------------------------|
   | Max file size      | `100000000` (100 Mo)            |
   | Allowed formats    | `pdf,mp4,webm,mov`              |
   | Resource type      | `Auto`                          |

   **Onglet Advanced — IMPORTANT**
   | Champ                  | Valeur     |
   |------------------------|------------|
   | **Return delete token**| **`true`** |

   Sans ce dernier flag, l'API Cloudinary ne renvoie pas de `delete_token` dans la
   reponse d'upload, et le bouton "X" sur le formulaire ne pourra pas supprimer le
   fichier cote serveur. Le flag DOIT etre defini dans le preset (en unsigned upload,
   il est interdit de le passer en parametre lors de la requete).

4. Save.
5. Ouvrez `frontend/config.js` :
   ```js
   window.EZONE_CONFIG = {
     CLOUDINARY: {
       cloud_name:    "votre-cloud-name",        // en haut de la console
       upload_preset: "ez_one_candidatures",
       folder:        "candidatures",
     },
     LIMITS: { cv_max_mb: 25, video_max_mb: 100, video_max_seconds: 90 }
   };
   ```

## Setup Netlify (3 min)

1. Push le repo sur GitHub.
2. https://app.netlify.com > **Add new site** > **Import from Git** > selectionnez le repo.
3. **Pas de config a toucher** : `netlify.toml` a la racine gere tout.
4. Au premier deploy, Netlify scanne `index.html` et detecte le form
   `name="candidature"` automatiquement.
5. Le form apparait dans **Site > Forms** apres le premier submit.

## Limites cote client

| Element           | Limite     | Origine                                    |
|-------------------|------------|--------------------------------------------|
| CV PDF            | 25 Mo      | choix UX (au-dela = trop lourd a lire)     |
| Video             | 100 Mo     | limite Cloudinary single-shot upload       |
| Duree video       | ~90 sec    | choix UX (au-dela = on demande de la sync) |
| Total submission  | ~1 Ko      | seulement les meta + URLs (pas les fichiers)|

## Securite

- **Aucune cle secrete cote front.** `cloud_name` et `upload_preset` sont
  publics par design (unsigned preset).
- **Honeypot Netlify** : champ `bot-field` invisible (`.hp` en CSS),
  les bots qui le remplissent voient leur soumission silencieusement bloquee.
- **Restrictions Cloudinary** : folder, formats, taille appliques cote serveur.
- En prod, ajouter optionnellement : signed uploads via Netlify Function,
  Cloudinary moderation auto, JWS signature sur le webhook Netlify.

## Voir aussi

- [docs/storage-alternatives.md](../docs/storage-alternatives.md) — comparatif et raisons du choix Cloudinary.
- [docs/make-integration.md](../docs/make-integration.md) — etape 2, configuration backend.
