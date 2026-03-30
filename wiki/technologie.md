# ⚙️ Stack technique

Gwadloup Alèrt est construit avec une stack **100% gratuite** prouvant qu'un outil citoyen sérieux peut naître sans budget.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│              Client (Browser)            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Leaflet  │ │ Supabase │ │  ImgBB   │ │
│  │  (carte) │ │   (JS)   │ │  (API)   │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ │
│       │             │             │       │
└───────┼─────────────┼─────────────┼───────┘
        │             │             │
   ┌────▼─────┐  ┌────▼─────┐ ┌────▼─────┐
   │  CARTO   │  │ Supabase │ │  ImgBB   │
   │  Tiles   │  │ (Cloud)  │ │  (Cloud) │
   │ (cartes) │  │ Auth+BDD │ │ (images) │
   └──────────┘  └──────────┘ └──────────┘
```

---

## 🧩 Services utilisés

### 🗺️ OpenStreetMap + CARTO + Leaflet
- **Cartographie open source** de la Guadeloupe
- Tuiles servies par CARTO (style Voyager)
- Clustering des marqueurs avec MarkerCluster
- **Coût : 0€**

### 🗄️ Supabase
- **Base de données PostgreSQL** avec Row Level Security
- **Authentification** email/mot de passe
- **Temps réel** via WebSocket (changements en direct)
- **Coût : 0€** (Free tier : 500MB BDD, 50K users)

### 🖼️ ImgBB
- **Hébergement d'images** illimité
- Compression côté client avec `browser-image-compression`
- Conversion automatique en **WebP** (60-80% de réduction)
- **Coût : 0€** (API gratuite, sans carte bancaire)

### 🚀 Render.com
- **Hébergement Node.js** de l'application
- Déploiement automatique depuis GitHub
- SSL gratuit inclus
- **Coût : 0€** (Free tier)

---

## 📁 Structure du projet

```
gwadloup-alert/
├── server.js            # Serveur Express
├── package.json
├── .env                 # Variables d'environnement
├── public/
│   ├── index.html       # SPA unique
│   ├── css/
│   │   └── style.css    # Styles complets
│   └── js/
│       ├── app.js       # App principale + config
│       ├── auth.js      # Authentification
│       ├── map.js       # Carte Leaflet
│       ├── reports.js   # CRUD signalements
│       ├── imageUpload.js # Upload + compression
│       └── ui.js        # Interface utilisateur
├── wiki/                # Pages wiki en Markdown
│   ├── accueil.md
│   ├── categories.md
│   ├── communes.md
│   └── technologie.md
└── supabase/
    └── schema.sql       # Schéma BDD
```

---

## 🔒 Sécurité

- **Row Level Security (RLS)** sur toutes les tables
- Les utilisateurs ne peuvent modifier que leurs propres données
- Les admins ont des permissions étendues via le rôle `admin`
- Mots de passe hashés par Supabase (bcrypt)
- Clés API publiques uniquement (jamais de secret côté client)
