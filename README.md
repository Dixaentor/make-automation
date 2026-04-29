# EZ-one — pipeline de recrutement automatise

Formulaire de candidature multi-etapes → analyse IA multimodale → top 50 candidats.
Stack 100% gratuite (Netlify, Cloudinary, Make.com, Gemini, Google Sheets).

## Architecture

```
┌─ ETAPE 1 — FRONT (Netlify) ───────────────────────────────────────┐
│                                                                   │
│   Form multi-step (3 etapes)                                      │
│       │                                                           │
│       ├── upload direct ──────────────▶ ┌─ Cloudinary ─┐          │
│       │   (XHR + unsigned preset)       │  CV + video  │          │
│       │                                 └──────┬───────┘          │
│       │                                        │ secure_url       │
│       ▼                                        ▼                  │
│   POST Netlify Forms (urlencoded, ~1 Ko)  hidden URL fields       │
│       │                                                           │
│       ▼                                                           │
│   /merci.html                                                     │
└────────────────────────────┬──────────────────────────────────────┘
                             │
                             ▼
┌─ ETAPE 2 — ORCHESTRATION (Make.com) [a configurer] ───────────────┐
│   1. Outgoing webhook Netlify -> webhook Make                     │
│   2. HTTP GET cv_url + video_url depuis Cloudinary                │
│   3. POST Gemini 2.5 Flash multimodal (PDF + video inline)        │
│      -> { score, fit, summary, skills[], red_flags[] }            │
│   4. Append row -> Google Sheets                                  │
│   5. Si match -> Gmail au recruteur                               │
└────────────────────────────┬──────────────────────────────────────┘
                             │
                             ▼
┌─ ETAPE 3 — TOP 50 [a venir] ──────────────────────────────────────┐
│   Cron Make hebdo OU dashboard Netlify lecture seule              │
└───────────────────────────────────────────────────────────────────┘
```

## Stack — choix par defaut

| Etage             | Choix retenu                | Pourquoi                                                      |
|-------------------|-----------------------------|---------------------------------------------------------------|
| Front + form      | HTML statique + Netlify     | 0 build, hosting illimite gratuit                             |
| Multi-step UX     | 3 etapes (Identite/CV/Video)| +completion vs single-page (recherche UX 2026)                |
| Stockage CV+video | **Cloudinary unsigned**     | 10 Go + 20 Go BW gratuits, 100 Mo/fichier, browser-direct OK  |
| Pipeline trigger  | Netlify Outgoing Webhook    | Configure cote dashboard, JSON propre, JWS optionnel          |
| Orchestration     | Make.com (free)             | 1000 ops/mois, webhooks, 3000+ apps, scenarios visuels        |
| IA scoring        | Gemini 2.5 Flash            | Multimodal natif (PDF + video), 1500 req/jour, 1 seul appel   |
| Base candidats    | Google Sheets               | Gratuit, lisible, integre Make natif                          |
| Mailing           | Gmail API                   | Quota tres genereux, integre Make natif                       |

Voir [docs/storage-alternatives.md](docs/storage-alternatives.md) pour le comparatif complet des solutions de stockage.

## Process etape par etape

### Etape 1 — Frontend (fait)

Voir [frontend/README.md](frontend/README.md).

- **3 etapes** avec progress bar et transitions.
- **Cloudinary direct upload** pour CV et video.
- **Validation client** (taille, type, duree).
- **Live video preview** apres upload.
- **Honeypot anti-spam** integre.

### Etape 2 — Make.com (a configurer)

Voir [docs/make-integration.md](docs/make-integration.md).

Configuration cote dashboard uniquement, aucun code.

### Etape 3 — Top 50 (a venir)

Cron Make hebdomadaire OU page `frontend/leaderboard.html` lisant Sheets.

## Demarrage rapide

```bash
# 1. Setup Cloudinary (cf frontend/README.md)
cp frontend/config.example.js frontend/config.js
# editer frontend/config.js avec vos valeurs

# 2. Test local
cd frontend && python -m http.server 8000

# 3. Deploiement
# Push sur GitHub, puis https://app.netlify.com > Import from Git
# netlify.toml gere le reste
```

## Repo

```
make-automation/
├── .gitignore                  # secrets, exports Make, OS
├── netlify.toml                # config deploy + headers securite
├── README.md                   # ce fichier
├── frontend/                   # ETAPE 1 — formulaire statique
│   ├── index.html              # multi-step, attributs Netlify Forms
│   ├── merci.html              # page de confirmation
│   ├── styles.css              # editorial-confident
│   ├── app.js                  # navigation + Cloudinary + Netlify submit
│   ├── config.example.js       # template Cloudinary (commit)
│   └── README.md               # setup detaille
└── docs/
    ├── storage-alternatives.md # comparatif solutions de stockage
    └── make-integration.md     # ETAPE 2 — Netlify webhook + Make scenario
```

## Repo GitHub

https://github.com/Dixaentor/make-automation
