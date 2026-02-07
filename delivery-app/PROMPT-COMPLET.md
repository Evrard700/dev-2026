# 📱 Application de Livraison - Prompt Complet

## 🎯 Vue d'ensemble

Application mobile/web de gestion de livraisons pour livreurs à moto avec navigation GPS turn-by-turn, gestion de clients et commandes en temps réel.

---

## 🏗️ Architecture Technique

### Stack Technologique
- **Framework** : React Native (Expo) + React Native Web
- **Navigation** : Expo Router (file-based routing)
- **Backend** : Supabase (PostgreSQL + Auth)
- **Cartographie** : Mapbox GL (mobile) + Mapbox GL JS (web)
- **Stockage** : localStorage (web) / AsyncStorage (mobile)
- **TTS** : expo-speech (guidage vocal)
- **Déploiement** : Vercel (web) / APK (Android)

### Structure des Dossiers
```
delivery-app/
├── app/                          # Routes Expo Router
│   ├── index.js                 # Page d'accueil/splash
│   ├── login.js                 # Connexion
│   ├── register.js              # Inscription
│   └── moto.js                  # Interface principale livreur
├── src/
│   ├── components/              # Composants réutilisables
│   │   ├── ClientFormModal.js   # Formulaire ajout client
│   │   ├── MotoClientPopup.js   # Popup détails client
│   │   ├── NavigationBanner.js  # Bannière navigation turn-by-turn
│   │   ├── SettingsPanel.js     # Panneau paramètres
│   │   ├── GlassCard.js         # UI glassmorphism
│   │   ├── GlassButton.js
│   │   └── GlassInput.js
│   ├── components/map/
│   │   ├── MapView.js           # Export conditionnel map
│   │   └── MapView.web.js       # Mapbox GL JS pour web
│   ├── lib/
│   │   ├── supabase.js          # Client Supabase configuré
│   │   └── storage-adapter.js   # Adaptateur localStorage/AsyncStorage
│   ├── stores/
│   │   └── storage.js           # Fonctions CRUD clients/commandes
│   ├── utils/
│   │   ├── mapbox.js            # Configuration Mapbox + directions API
│   │   ├── navigation.js        # Logique turn-by-turn
│   │   ├── location.js          # Géolocalisation GPS
│   │   └── search.js            # Recherche lieux Mapbox
│   └── styles/
│       └── glassmorphism.js     # Styles design system
└── android/                      # Build Android natif
```

---

## 🗄️ Schéma Base de Données (Supabase)

### Table `moto_clients`
```sql
CREATE TABLE moto_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  neighborhood TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_moto_clients_user_id ON moto_clients(user_id);
CREATE INDEX idx_moto_clients_created_at ON moto_clients(created_at DESC);
```

### Table `moto_orders`
```sql
CREATE TABLE moto_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES moto_clients(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_phone TEXT,
  client_address TEXT,
  product TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  price NUMERIC(10, 2),
  photo TEXT,
  checked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_moto_orders_user_id ON moto_orders(user_id);
CREATE INDEX idx_moto_orders_client_id ON moto_orders(client_id);
CREATE INDEX idx_moto_orders_created_at ON moto_orders(created_at DESC);
```

### Politiques RLS (Row Level Security)
```sql
-- moto_clients
ALTER TABLE moto_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own clients" ON moto_clients
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own clients" ON moto_clients
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clients" ON moto_clients
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own clients" ON moto_clients
  FOR DELETE USING (auth.uid() = user_id);

-- moto_orders
ALTER TABLE moto_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders" ON moto_orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own orders" ON moto_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own orders" ON moto_orders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own orders" ON moto_orders
  FOR DELETE USING (auth.uid() = user_id);
```

---

## 🎨 Interface Utilisateur (Mode Moto)

### 1. Écran de Connexion/Inscription
- Design glassmorphism moderne
- Champs : email, mot de passe
- Validation email Supabase
- Redirection automatique après login

### 2. Carte Interactive Principale
**Composants :**
- Carte Mapbox plein écran
- Marqueurs clients numérotés (1, 2, 3...)
  - Rouge : commandes non livrées
  - Vert : toutes commandes livrées
  - Numéro = ordre de proximité GPS
- Position utilisateur en temps réel (point bleu pulsant)
- Itinéraire tracé en bleu lors de navigation

**Contrôles :**
- Bouton paramètres (hamburger, haut gauche)
- Boutons zoom +/- (bas droite)
- Toggle 2D/3D (bas droite)
- Sélecteur de style carte (bas droite)
- Bouton recentrage GPS (bas droite)
- Bouton liste clients (bas gauche)

**Interactions :**
- **Appui long** sur carte → Ouvre formulaire ajout client
- **Clic sur marqueur** → Ouvre popup détails client
- **Double clic** → Zoom
- **Pinch** → Zoom/rotation

### 3. Formulaire Ajout Client
**Champs :**
- Nom (obligatoire)
- Numéro de téléphone
- Adresse
- Lien Google Maps (optionnel)
- Coordonnées GPS (auto-remplies ou manuelles)

**Actions :**
- Sauvegarder → Crée client + marqueur sur carte
- Annuler → Ferme modal

### 4. Popup Client
**Affichage :**
- Numéro de proximité (#1, #2...)
- Nom, téléphone, adresse
- Distance en temps réel (ex: "350 m", "1.2 km")
- Liste des commandes associées
  - Checkbox pour marquer livré/non livré
  - Produit, quantité, prix
  - Photo si disponible

**Actions :**
- **Appeler** → Ouvre dialer téléphone
- **Naviguer** → Lance navigation turn-by-turn
- **Ajouter commande** → Modal formulaire commande
- **Supprimer commande** → Confirmation + suppression
- **Supprimer client** → Confirmation + suppression

### 5. Navigation Turn-by-Turn
**Bannière en haut d'écran :**
- Icône de manœuvre (flèche directionnelle)
- Instruction vocale + texte (ex: "Tournez à gauche")
- Nom de rue
- Distance jusqu'à manœuvre (ex: "150 m")
- Progression : "Étape 3/7"
- Temps et distance restants totaux
- Barre de progression horizontale

**Comportements :**
- Instruction vocale déclenchée à 200m avant manœuvre
- Recalcul automatique si déviation >50m
- Alerte visuelle (orange) si manœuvre imminente (<50m)
- Caméra suit position GPS en temps réel
- Mode boussole : rotation synchrone (vecteur déplacement vers haut)
- Position utilisateur au tiers inférieur de l'écran
- Zoom fixe 18, pitch 60° pendant navigation

**États visuels :**
- Boussole inactive : icône crosshair grise
- Boussole active : flèche bleue pointant vers haut
- Suspension manuelle : bordure orange (10s d'inactivité avant réactivation)

### 6. Panneau Paramètres
**Sections :**
- Liste complète des clients (scrollable)
  - Tri par proximité GPS
  - Affichage distance en temps réel
  - Clic → Centrer carte sur client
- Bouton déconnexion

### 7. Liste Clients (Modale)
- Affichage compact avec numéros de proximité
- Distance en temps réel pour chaque client
- Scroll vertical
- Clic → Centrer carte + fermer modal

---

## 🧭 Système de Navigation Turn-by-Turn

### Logique de Calcul d'Itinéraire
```javascript
// API Mapbox Directions
const getDirectionsUrl = (start, end) => 
  `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&overview=full&steps=true&access_token=${MAPBOX_TOKEN}`;

// Parsing des steps
const steps = route.legs[0].steps.map(step => ({
  type: step.maneuver.type,           // 'turn-left', 'turn-right', etc.
  instruction: step.maneuver.instruction,
  streetName: step.name,
  distance: step.distance,            // mètres
  duration: step.duration,            // secondes
  location: step.maneuver.location    // [lng, lat]
}));
```

### Instructions Vocales
**Déclenchement :**
- 200m avant la manœuvre : "Dans 200 mètres, tournez à gauche sur Rue de la Paix"
- <50m : "Tournez à gauche sur Rue de la Paix" (ton urgent)

**Langue :** Français (fr)  
**Vitesse :** 0.85 (légèrement ralenti pour clarté)  
**Librairie :** expo-speech

**Types de manœuvres supportées :**
- turn-left / turn-right (↰ ↱)
- turn-slight-left / turn-slight-right (↖ ↗)
- turn-sharp-left / turn-sharp-right (⬅ ➡)
- uturn-left / uturn-right (↶ ↷)
- continue (↑)
- merge (⤴)
- fork-left / fork-right
- off-ramp-left / off-ramp-right
- roundabout (⭯)
- arrive (📍)

### Détection Hors-Route
- Calcul distance min entre position GPS et tracé géométrie route
- Seuil : 50 mètres
- Si dépassé → Recalcul automatique itinéraire

### Recalcul Automatique
- Déclenché toutes les 5 secondes pendant navigation
- Seulement si mouvement >50m depuis dernier calcul
- Mise à jour des steps + instructions vocales
- Arrêt automatique si distance <50m de destination

---

## 📍 Système de Géolocalisation

### Configuration GPS
```javascript
const locationOptions = {
  accuracy: LocationAccuracy.High,  // Précision maximale
  timeInterval: 1000,               // Update chaque seconde
  distanceInterval: 5,              // Update tous les 5 mètres
};
```

### Calcul Distances en Temps Réel
**Formule Haversine (distance orthodromique) :**
```javascript
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Rayon Terre en mètres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c; // Distance en mètres
};
```

### Tri Clients par Proximité
- Calcul distance GPS → chaque client
- Tri ascendant (plus proche = #1)
- Mise à jour en temps réel (useMemo dépendant de userLocation)
- Affichage : "350 m" ou "1.2 km"

---

## 🗺️ Configuration Mapbox

### Styles de Carte Disponibles
1. **Standard** : streets-v12 (défaut)
2. **Satellite** : satellite-streets-v12
3. **Navigation** : navigation-day-v1 (optimisé guidage)
4. **3D** : streets-v12 + pitch 60° (bâtiments 3D)

### Token Mapbox
```
pk.eyJ1IjoiZXZyYXJkNzAwIiwiYSI6ImNtZHFsbnk1NDA3NnUya3Nhc2ZzMXhtNm8ifQ.38Ot2vrfENkyvJ7mi7AsVw
```

### Paramètres Carte
```javascript
const MAP_CONFIG = {
  zoom: {
    default: 14,
    navigation: 18,
    client: 17,
    minZoom: 2,
    maxZoom: 22
  },
  pitch: {
    default: 0,
    navigation: 60,
    threeD: 60
  },
  bearing: {
    default: 0,
    compassMode: (dynamique selon déplacement)
  }
};
```

---

## 🔐 Authentification & Sécurité

### Supabase Auth
```javascript
const SUPABASE_URL = 'https://ybmpvlhwplsxotpymetp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGci...'; // Key publique
```

### Flux Authentification
1. **Inscription** :
   - Email + mot de passe (min 6 caractères)
   - Confirmation email automatique
   - Création profil utilisateur
   
2. **Connexion** :
   - Email + mot de passe
   - Session JWT stockée dans localStorage (web) / AsyncStorage (mobile)
   - Auto-refresh token avant expiration
   
3. **Déconnexion** :
   - Révocation session Supabase
   - Clear storage local
   - Redirection vers /login

### Gestion Session
```javascript
// Récupération utilisateur courant
const { data: { user } } = await supabase.auth.getUser();
const userId = user?.id;

// Toutes les requêtes DB filtrent par user_id
const { data } = await supabase
  .from('moto_clients')
  .select('*')
  .eq('user_id', userId);
```

---

## 🎨 Design System (Glassmorphism)

### Palette Couleurs
```javascript
const colors = {
  primary: '#DC2626',      // Rouge vif
  secondary: '#4285F4',    // Bleu
  success: '#10b981',      // Vert
  warning: '#f59e0b',      // Orange
  background: {
    light: 'rgba(255, 255, 255, 0.15)',
    dark: 'rgba(0, 0, 0, 0.25)'
  },
  text: {
    primary: '#ffffff',
    secondary: '#94a3b8'
  }
};
```

### Effets Verre
```javascript
const glassEffect = {
  backgroundColor: 'rgba(255, 255, 255, 0.15)',
  backdropFilter: 'blur(10px)',
  borderRadius: 16,
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.2)',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.1,
  shadowRadius: 12,
  elevation: 8
};
```

---

## 📊 Optimisations Performance

### 1. Mise en Cache Locale
- Clients et commandes stockés en cache
- Synchronisation Supabase en arrière-plan
- UI optimiste (affichage immédiat avant sync)
- Fallback cache en cas d'erreur réseau

### 2. Recalcul Intelligent
- `useMemo` pour tri clients par proximité
- Déclenchement uniquement si position bouge >50m
- `useCallback` pour fonctions événements

### 3. Debouncing
- Recherche lieux : 300ms de délai
- Updates caméra navigation : 50ms
- Recalcul route : 5000ms

### 4. Lazy Loading
- Composants map conditionnels (web vs mobile)
- Images client chargées on-demand
- Historique commandes paginé

---

## 🚀 Déploiement

### Web (Vercel)
```bash
# Build production
npm run build

# Déploiement automatique via Git
git push origin main
# → Vercel détecte le push et build/deploy automatiquement

# URL production
https://delivery-app-omega-five.vercel.app
```

### Android (APK)
```bash
# Build APK release
cd android
./gradlew clean
./gradlew assembleRelease

# Fichier généré
android/app/build/outputs/apk/release/app-release.apk

# Taille typique : ~150 MB
# Temps build : 20-25 minutes
```

---

## 🧪 Variables d'Environnement

### `.env`
```bash
# Mapbox
MAPBOX_PUBLIC_TOKEN=pk.eyJ1IjoiZXZyYXJkNzAwIiwiYSI6ImNtZHFsbnk1NDA3NnUya3Nhc2ZzMXhtNm8ifQ.38Ot2vrfENkyvJ7mi7AsVw
RNMAPBOX_MAPS_DOWNLOAD_TOKEN=(même token que ci-dessus)
GOOGLE_MAPS_API_KEY=(non utilisé actuellement)

# Supabase (hardcodé dans src/lib/supabase.js pour simplicité)
SUPABASE_URL=https://ybmpvlhwplsxotpymetp.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
```

---

## 📝 Commandes Utiles

### Développement
```bash
# Démarrer serveur dev
npm start

# Web
npm run web

# Android
npm run android

# iOS
npm run ios
```

### Build
```bash
# Web production
npm run build
npm run export

# Android APK
cd android && ./gradlew assembleRelease
```

### Mise à jour
```bash
# Dépendances
npm install

# Expo SDK
npx expo upgrade
```

---

## 🐛 Debug & Logs

### Console Logs Importants
```javascript
// Navigation
console.log('🔊 Navigation:', instructionText);
console.log('📍 Navigation: X étapes chargées');
console.log('⚠️ Hors route détecté, recalcul en cours...');

// Marqueurs
console.log('🎯 Marker pressed:', clientName);
console.log('✅ Popup should open for:', clientData);

// Auth
console.warn('No user logged in, returning empty clients');
console.error('User not authenticated');

// Sync
console.log('Client synced to Supabase:', data);
console.error('Background sync failed:', error);
```

### Outils Debug
- **React Native Debugger** (mobile)
- **Chrome DevTools** (web)
- **Flipper** (mobile avancé)
- **Mapbox Studio** (debug carte)

---

## 🔮 Fonctionnalités Futures Possibles

### Phase 2 - Cartographie Hors-ligne
- Téléchargement zones géographiques
- Cache tuiles Mapbox localement
- Navigation sans connexion internet
- Sync différée quand réseau revient

### Phase 3 - Optimisations Avancées
- Calcul itinéraire multi-clients optimal (TSP solver)
- Prédictions temps trajet basées historique
- Zones de livraison avec polygones
- Heatmap des clients fréquents

### Phase 4 - Collaboration
- Partage clients entre livreurs équipe
- Attribution automatique commandes
- Chat temps réel
- Suivi flotte en temps réel (admin)

---

## 📚 Documentation APIs Utilisées

### Mapbox Directions API
- Doc : https://docs.mapbox.com/api/navigation/directions/
- Limites : 300 req/min gratuit, puis payant
- Réponse : GeoJSON LineString + steps détaillés

### Mapbox Geocoding API (recherche)
- Doc : https://docs.mapbox.com/api/search/geocoding/
- Endpoint : `/geocoding/v5/mapbox.places/{query}.json`
- Limites : 100 000 req/mois gratuit

### Supabase
- Doc : https://supabase.com/docs
- PostgREST API auto-générée
- Realtime : WebSockets pour subscriptions

### Expo Location
- Doc : https://docs.expo.dev/versions/latest/sdk/location/
- Permissions : iOS (Info.plist), Android (AndroidManifest.xml)

---

## ✅ Checklist Configuration Projet

### 1. Cloner & Installer
```bash
git clone https://github.com/Evrard700/dev-2026.git
cd delivery-app
npm install
```

### 2. Configuration Supabase
- Créer projet sur supabase.com
- Exécuter `supabase-schema.sql`
- Copier URL + anon key dans `src/lib/supabase.js`

### 3. Configuration Mapbox
- Créer compte sur mapbox.com
- Copier token dans `.env` et `src/utils/mapbox.js`

### 4. Android
- Installer Android Studio + SDK 36
- Créer `android/local.properties` avec `sdk.dir`

### 5. Lancer
```bash
npm start
# Puis 'w' pour web, 'a' pour Android
```

---

## 🎓 Concepts Clés à Comprendre

### 1. Expo Router
- File-based routing : `app/moto.js` → `/moto`
- `useRouter()` pour navigation programmatique
- Layouts avec `_layout.js`

### 2. React Native Web
- Même code → web + mobile
- `Platform.OS === 'web'` pour code spécifique
- Composants conditionnels pour map/storage

### 3. Supabase Row Level Security (RLS)
- Sécurité au niveau base de données
- Policies basées sur `auth.uid()`
- Empêche accès données autres users

### 4. useMemo & useCallback
- `useMemo` : mémorise résultat calcul coûteux
- `useCallback` : mémorise fonction pour éviter re-render
- Déclenchement via array dependencies

### 5. Refs React
- `useRef` : valeur persistante sans re-render
- Idéal pour intervalles, timeouts, valeurs internes
- `ref.current` pour accéder/modifier

---

## 🏁 Résumé Exécutif

**Application de livraison full-stack** avec :
- ✅ Authentification sécurisée (Supabase)
- ✅ Carte interactive temps réel (Mapbox)
- ✅ Navigation GPS turn-by-turn vocale
- ✅ Gestion clients/commandes CRUD
- ✅ Déploiement web + mobile
- ✅ Interface moderne glassmorphism
- ✅ Performance optimisée (cache, memoization)
- ✅ Stockage universel web/mobile

**Stack :** React Native + Expo + Supabase + Mapbox  
**Plateformes :** Web (Vercel) + Android (APK)  
**Mode :** Livreur moto uniquement (B2B désactivé)

---

*Document généré le 7 février 2026*  
*Version : 1.0.0*  
*Auteur : Assistant Molt 🦎*
