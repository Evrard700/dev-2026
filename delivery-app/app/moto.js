import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  TextInput,
  Keyboard,
  Animated,
  Pressable,
  Modal,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getDirectionsUrl, parseGoogleMapsUrl, MAPBOX_TOKEN } from '../src/utils/mapbox';
import { getCurrentLocation, watchLocation } from '../src/utils/location';
import { searchPlaces } from '../src/utils/search';
import {
  getMotoClients,
  addMotoClient,
  deleteMotoClient,
  getMotoOrders,
  addMotoOrder,
  updateMotoOrder,
  deleteMotoOrder,
  getCachedRoute,
  cacheRoute,
  logoutUser,
} from '../src/stores/storage';
import ClientFormModal from '../src/components/ClientFormModal';
import MotoClientPopup from '../src/components/MotoClientPopup';
import SettingsPanel from '../src/components/SettingsPanel';
import NavigationBanner from '../src/components/NavigationBanner';
import {
  parseRouteSteps,
  getNextInstruction,
  isOffRoute,
  speakInstruction,
  stopSpeaking,
  getRouteStats,
} from '../src/utils/navigation';

let MapboxGL, WebMapView;
if (Platform.OS === 'web') {
  WebMapView = require('../src/components/map/MapView.web').default;
} else {
  MapboxGL = require('@rnmapbox/maps').default;
}

const MAP_STYLES = [
  { id: 'streets', label: 'Standard', url: 'mapbox://styles/mapbox/streets-v12' },
  { id: 'satellite', label: 'Satellite', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
  { id: 'nav', label: 'Navigation', url: 'mapbox://styles/mapbox/navigation-day-v1' },
  { id: '3d', label: '3D', url: 'mapbox://styles/mapbox/streets-v12' }, // streets-v12 pour afficher les bâtiments 3D avec pitch
];

const ROUTE_UPDATE_INTERVAL = 5000; // 5s entre recalculs de route
const CAMERA_UPDATE_DELAY = 50; // Délai ultra-court pour rotation instantanée
const BEARING_SMOOTHING = 0.30; // Lissage faible = virages très réactifs
const MIN_SPEED_FOR_ROTATION = 1.4; // ~5 km/h (cahier des charges)
const MIN_DISTANCE_FOR_BEARING = 0.00003; // Distance minimale réduite pour calcul bearing fréquent
const NAVIGATION_ZOOM = 18; // Zoom fixe pendant navigation
const NAVIGATION_PITCH = 60; // Inclinaison fixe pendant navigation
const AUTO_ROTATION_IDLE_TIMEOUT = 10000; // 10s d'inactivité avant réactivation auto-rotation
const COMPASS_STATE_REFRESH_FPS = 60; // 60 fps pour rotation fluide
const TURN_DETECTION_THRESHOLD = 5; // Degrés pour détecter un virage

// Calculate bearing between two points
function calcBearing(from, to) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const dLon = toRad(to[0] - from[0]);
  const lat1 = toRad(from[1]);
  const lat2 = toRad(to[1]);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export default function MotoScreen() {
  const router = useRouter();
  const mapRef = useRef(null);
  const cameraRef = useRef(null);
  const routeIntervalRef = useRef(null);
  const routeTargetRef = useRef(null);
  const prevLocationRef = useRef(null);
  const lastRouteCalcLocationRef = useRef(null);
  const userBearingRef = useRef(0);
  const smoothedBearingRef = useRef(0); // Bearing lissé pour éviter tremblements
  const lastMapBearingRef = useRef(0); // Dernier bearing appliqué à la carte (pour détecter virages)

  const [userLocation, setUserLocation] = useState(null);
  const userLocationRef = useRef(null);
  const [stableUserLocation, setStableUserLocation] = useState(null);
  const stableUserLocationRef = useRef(null);
  const [clients, setClients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedCoord, setSelectedCoord] = useState(null);
  const [showClientForm, setShowClientForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showClientPopup, setShowClientPopup] = useState(false);
  const [routeGeoJSON, setRouteGeoJSON] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeSteps, setRouteSteps] = useState([]);
  const [currentInstruction, setCurrentInstruction] = useState(null);
  const [lastSpokenStepId, setLastSpokenStepId] = useState(null);
  const routeStepsRef = useRef([]);
  const lastSpokenStepIdRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [mapStyle, setMapStyle] = useState(MAP_STYLES[0].url);
  const [is3D, setIs3D] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const isNavigatingRef = useRef(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showLayerPicker, setShowLayerPicker] = useState(false);
  
  // 🧭 MODE NAVIGATION DYNAMIQUE
  const [compassMode, setCompassMode] = useState('inactive'); // 'inactive' | 'active' | 'manual-override'
  const compassModeRef = useRef('inactive');
  const lastUserInteractionRef = useRef(Date.now());
  const autoRotationTimeoutRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showClientsList, setShowClientsList] = useState(false);
  const [clientsSelectionMode, setClientsSelectionMode] = useState(false);
  const [selectedClients, setSelectedClients] = useState([]);
  const searchTimerRef = useRef(null);
  const cameraUpdateTimer = useRef(null);

  // Map view state
  const [mapBearing, setMapBearing] = useState(0);
  const [mapPitch, setMapPitch] = useState(0);
  const [mapZoom, setMapZoom] = useState(14);

  // Button animations
  const settingsBtnScale = useRef(new Animated.Value(1)).current;
  const layerBtnScale = useRef(new Animated.Value(1)).current;
  const posBtnScale = useRef(new Animated.Value(1)).current;
  const viewToggleScale = useRef(new Animated.Value(1)).current;
  const zoomInScale = useRef(new Animated.Value(1)).current;
  const zoomOutScale = useRef(new Animated.Value(1)).current;
  const clientsBtnScale = useRef(new Animated.Value(1)).current;
  const animPress = useCallback((anim) => ({
    onPressIn: () => Animated.spring(anim, { toValue: 0.88, useNativeDriver: true, speed: 50, bounciness: 4 }).start(),
    onPressOut: () => Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 10 }).start(),
  }), []);

  // Initial load
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const location = await getCurrentLocation();
        if (mounted) {
          const loc = [location.coords.longitude, location.coords.latitude];
          userLocationRef.current = loc;
          stableUserLocationRef.current = loc;
          setUserLocation(loc);
          setStableUserLocation(loc);
        }
      } catch (e) {
        console.warn('Location error:', e);
      }
      const [c, o] = await Promise.all([getMotoClients(), getMotoOrders()]);
      if (mounted) {
        setClients(c);
        setOrders(o);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Watch location + calculate bearing + smooth camera follow during navigation
  useEffect(() => {
    const sub = watchLocation((loc) => {
      const newLoc = [loc.coords.longitude, loc.coords.latitude];
      const speed = loc.coords.speed || 0; // Vitesse en m/s
      
      // NE METTRE À JOUR LE BEARING QUE SI EN MOUVEMENT
      const isMoving = speed > MIN_SPEED_FOR_ROTATION;
      
      if (isMoving) {
        // Utiliser le heading GPS natif si disponible ET si en mouvement
        if (loc.coords.heading !== null && loc.coords.heading !== undefined && loc.coords.heading >= 0) {
          // GPS heading disponible - direction native
          userBearingRef.current = loc.coords.heading;
          prevLocationRef.current = newLoc;
        } else if (prevLocationRef.current) {
          // Pas de heading GPS - calculer à partir du mouvement
          const dist = Math.hypot(newLoc[0] - prevLocationRef.current[0], newLoc[1] - prevLocationRef.current[1]);
          // Seuil augmenté pour éviter calculs sur micro-mouvements
          if (dist > MIN_DISTANCE_FOR_BEARING) {
            userBearingRef.current = calcBearing(prevLocationRef.current, newLoc);
            prevLocationRef.current = newLoc;
          }
        } else {
          prevLocationRef.current = newLoc;
        }
        
        // Lissage exponentiel du bearing pour éviter tremblements (SEULEMENT si en mouvement)
        const rawBearing = userBearingRef.current;
        const prevSmoothed = smoothedBearingRef.current;
        
        // Gérer le wraparound 0°/360°
        let diff = rawBearing - prevSmoothed;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        
        // Appliquer lissage ÉLEVÉ
        smoothedBearingRef.current = (prevSmoothed + diff * (1 - BEARING_SMOOTHING)) % 360;
        if (smoothedBearingRef.current < 0) smoothedBearingRef.current += 360;
      }
      
      userLocationRef.current = newLoc;
      setUserLocation(newLoc);

      // Update stableUserLocation only if moved > 50m (reduces enrichedClients recalc)
      if (!stableUserLocationRef.current) {
        stableUserLocationRef.current = newLoc;
        setStableUserLocation(newLoc);
      } else {
        const dx = newLoc[0] - stableUserLocationRef.current[0];
        const dy = newLoc[1] - stableUserLocationRef.current[1];
        // ~0.00045 degrees ≈ 50m at equator
        if (Math.hypot(dx, dy) > 0.00045) {
          stableUserLocationRef.current = newLoc;
          setStableUserLocation(newLoc);
        }
      }

      // 🧭 MODE NAVIGATION DYNAMIQUE : Rotation synchrone avec position au tiers inférieur
      if (isNavigatingRef.current && routeTargetRef.current && isMoving) {
        // Activer le mode boussole si pas déjà actif
        if (compassModeRef.current === 'inactive') {
          compassModeRef.current = 'active';
          setCompassMode('active');
        }
        
        // Appliquer la rotation SEULEMENT si mode active (pas en manual-override)
        if (compassModeRef.current === 'active') {
          if (cameraUpdateTimer.current) clearTimeout(cameraUpdateTimer.current);
          cameraUpdateTimer.current = setTimeout(() => {
            const bearing = smoothedBearingRef.current; // Direction lissée
            
            if (Platform.OS === 'web' && mapRef.current) {
              const map = mapRef.current.getMap?.();
              if (map) {
                // Rotation à 60 fps avec position au tiers inférieur
                map.easeTo({
                  center: [newLoc[0], newLoc[1]],
                  bearing: bearing, // Vecteur de déplacement vers le haut
                  zoom: NAVIGATION_ZOOM,
                  pitch: NAVIGATION_PITCH,
                  duration: 1000 / COMPASS_STATE_REFRESH_FPS, // ~16ms pour 60fps
                  easing: (t) => t, // Linéaire = plus fluide
                  // Position au tiers inférieur (padding bottom)
                  padding: { bottom: window.innerHeight * 0.33, top: 0, left: 0, right: 0 },
                });
              }
            } else if (cameraRef.current) {
              // Mobile: rotation fluide avec padding pour position au tiers inférieur
              cameraRef.current.setCamera({
                centerCoordinate: newLoc,
                zoomLevel: NAVIGATION_ZOOM,
                pitch: NAVIGATION_PITCH,
                heading: bearing, // Vecteur de déplacement vers le haut
                animationDuration: 1000 / COMPASS_STATE_REFRESH_FPS, // 60fps
                animationMode: 'easeTo',
                // Padding Android : position au tiers inférieur
                padding: Platform.OS === 'android' 
                  ? { paddingBottom: 300, paddingTop: 0, paddingLeft: 0, paddingRight: 0 }
                  : undefined,
              });
            }
          }, CAMERA_UPDATE_DELAY);
        }
      } else if (isNavigatingRef.current && routeTargetRef.current && !isMoving) {
        // Immobile: juste centrer, garder orientation (pas de rotation)
        if (cameraUpdateTimer.current) clearTimeout(cameraUpdateTimer.current);
        cameraUpdateTimer.current = setTimeout(() => {
          if (Platform.OS === 'web' && mapRef.current) {
            const map = mapRef.current.getMap?.();
            if (map) {
              map.easeTo({
                center: [newLoc[0], newLoc[1]],
                duration: 200,
              });
            }
          } else if (cameraRef.current) {
            cameraRef.current.setCamera({
              centerCoordinate: newLoc,
              animationDuration: 200,
              animationMode: 'easeTo',
            });
          }
        }, CAMERA_UPDATE_DELAY);
      }
    });
    return () => sub.remove();
  }, []);

  // Real-time route: recalculate periodically (uses refs to avoid re-creating on location change)
  useEffect(() => {
    if (isNavigating && routeTargetRef.current) {
      isNavigatingRef.current = true;
      lastRouteCalcLocationRef.current = null; // Reset to force first calc

      if (routeIntervalRef.current) clearInterval(routeIntervalRef.current);

      routeIntervalRef.current = setInterval(async () => {
        const loc = userLocationRef.current;
        if (!routeTargetRef.current || !loc) return;
        // Skip recalc if user hasn't moved >50m since last route calculation
        if (lastRouteCalcLocationRef.current) {
          const dx = loc[0] - lastRouteCalcLocationRef.current[0];
          const dy = loc[1] - lastRouteCalcLocationRef.current[1];
          if (Math.hypot(dx, dy) < 0.00045) return; // ~50m
        }
        lastRouteCalcLocationRef.current = loc;
        try {
          const target = routeTargetRef.current;
          const url = getDirectionsUrl(loc, [target.longitude, target.latitude]);
          const response = await fetch(url);
          const data = await response.json();
          if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const duration = Math.round(route.duration / 60);
            const distance = (route.distance / 1000).toFixed(1);
            const sk = `${loc[0].toFixed(4)},${loc[1].toFixed(4)}`;
            const ek = `${target.longitude.toFixed(4)},${target.latitude.toFixed(4)}`;
            cacheRoute(sk, ek, { geometry: route.geometry, duration, distance, steps: route.legs });
            setRouteGeoJSON({
              type: 'FeatureCollection',
              features: [{ type: 'Feature', geometry: route.geometry, properties: {} }],
            });
            setRouteInfo({
              duration,
              distance,
              clientName: target.nom,
            });
            
            // 🎯 TURN-BY-TURN : Mettre à jour les steps après recalcul
            const steps = parseRouteSteps(route);
            setRouteSteps(steps);
            routeStepsRef.current = steps;
            console.log(`📍 Itinéraire recalculé: ${steps.length} étapes`);
            if (route.distance < 50) {
              clearInterval(routeIntervalRef.current);
              setIsNavigating(false);
              isNavigatingRef.current = false;
              routeTargetRef.current = null;
              if (Platform.OS === 'web' && mapRef.current) {
                mapRef.current.easeTo(loc, 15, 0, 0);
              } else if (cameraRef.current) {
                cameraRef.current.setCamera({
                  centerCoordinate: loc,
                  zoomLevel: 15,
                  pitch: 0,
                  heading: 0,
                  animationDuration: 1000,
                });
              }
            }
          }
        } catch (e) { /* keep last route on error */ }
      }, ROUTE_UPDATE_INTERVAL);

      return () => {
        if (routeIntervalRef.current) clearInterval(routeIntervalRef.current);
      };
    } else {
      isNavigatingRef.current = false;
    }
  }, [isNavigating]);

  useEffect(() => {
    return () => {
      if (routeIntervalRef.current) clearInterval(routeIntervalRef.current);
    };
  }, []);

  // 🎯 NAVIGATION TURN-BY-TURN : Suivre la position et déclencher les instructions
  useEffect(() => {
    if (!isNavigating || !userLocation || routeStepsRef.current.length === 0) {
      setCurrentInstruction(null);
      return;
    }

    // Vérifier si hors route
    if (routeGeoJSON && isOffRoute(userLocation, routeGeoJSON.features[0].geometry)) {
      console.warn('⚠️ Hors route détecté, recalcul en cours...');
      // Le recalcul automatique est géré par l'intervalle existant
    }

    // Obtenir la prochaine instruction
    const instruction = getNextInstruction(
      userLocation, 
      routeStepsRef.current, 
      lastSpokenStepIdRef.current
    );

    if (instruction) {
      setCurrentInstruction(instruction);

      // Déclencher l'instruction vocale si nécessaire
      if (instruction.shouldSpeak) {
        speakInstruction(instruction.step, instruction.distanceToStep);
        setLastSpokenStepId(instruction.step.id);
        lastSpokenStepIdRef.current = instruction.step.id;
      }
    }
  }, [userLocation, isNavigating, routeGeoJSON]);

  // Close search results and layer picker when user touches the map
  const handleMapInteraction = useCallback(() => {
    setShowSearchResults(false);
    setShowLayerPicker(false);
    Keyboard.dismiss();
    
    // 🧭 MODE NAVIGATION DYNAMIQUE : Suspendre auto-rotation sur interaction manuelle
    if (isNavigatingRef.current) {
      lastUserInteractionRef.current = Date.now();
      if (compassModeRef.current === 'active') {
        compassModeRef.current = 'manual-override';
        setCompassMode('manual-override');
      }
      
      // Timer de réactivation automatique après 10s d'inactivité
      if (autoRotationTimeoutRef.current) {
        clearTimeout(autoRotationTimeoutRef.current);
      }
      autoRotationTimeoutRef.current = setTimeout(() => {
        if (isNavigatingRef.current && compassModeRef.current === 'manual-override') {
          compassModeRef.current = 'active';
          setCompassMode('active');
        }
      }, AUTO_ROTATION_IDLE_TIMEOUT);
    }
  }, []);

  const handleMapLongPress = useCallback((event) => {
    const coord = event.geometry.coordinates;
    setSelectedCoord(coord);
    setShowClientForm(true);
  }, []);

  const handleAddClient = useCallback(async (formData) => {
    try {
      let coord = formData.coordinate || [0, 0];
      if (formData.googleLink) {
        const parsed = parseGoogleMapsUrl(formData.googleLink);
        if (parsed) coord = [parsed.longitude, parsed.latitude];
      }
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newClient = {
        id: tempId,
        nom: formData.nom,
        numero: formData.numero,
        adresse: formData.adresse,
        googleLink: formData.googleLink,
        longitude: coord[0],
        latitude: coord[1],
        createdAt: new Date().toISOString(),
      };
      
      // Add to UI IMMEDIATELY (optimistic)
      const optimisticClients = [newClient, ...clients];
      setClients(optimisticClients);
      
      // Sync to backend in background (don't await, don't use result)
      addMotoClient(newClient).catch(error => {
        console.error('Failed to add client:', error);
        // Remove temp client on error
        setClients(clients);
        if (Platform.OS === 'web') {
          alert('Erreur lors de l\'ajout du client: ' + error.message);
        } else {
          Alert.alert('Erreur', 'Impossible d\'ajouter le client: ' + error.message);
        }
      });
    } catch (error) {
      console.error('Error adding client:', error);
      if (Platform.OS === 'web') {
        alert('Erreur lors de l\'ajout du client: ' + error.message);
      } else {
        Alert.alert('Erreur', 'Impossible d\'ajouter le client: ' + error.message);
      }
    }
  }, [clients]);

  const handleDeleteClient = useCallback(async (clientId) => {
    // Remove from UI IMMEDIATELY (optimistic)
    const optimisticClients = clients.filter(c => c.id !== clientId);
    const optimisticOrders = orders.filter(o => o.clientId !== clientId);
    setClients(optimisticClients);
    setOrders(optimisticOrders);
    setShowClientPopup(false);
    setSelectedClient(null);
    
    // Sync to backend in background (don't await, don't use result)
    deleteMotoClient(clientId).catch(err => {
      console.error('Failed to delete client:', err);
      // Refresh from backend on error
      getMotoClients().then(setClients).catch(console.error);
      getMotoOrders().then(setOrders).catch(console.error);
    });
  }, [clients, orders]);

  const handleAddOrder = useCallback(async (clientId, orderData) => {
    try {
      // Find client info
      const client = clients.find(c => c.id === clientId);
      if (!client) {
        throw new Error('Client introuvable');
      }
      
      // Check if client has temp ID (not yet synced to Supabase)
      const isClientTemp = clientId.startsWith('temp_');
      
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newOrder = {
        id: tempId,
        clientId,
        clientNom: client.nom,
        clientNumero: client.numero,
        clientAdresse: client.adresse,
        produit: orderData.produit,
        quantite: orderData.quantite,
        prix: orderData.prix,
        photo: orderData.photo || null,
        checked: false,
        createdAt: new Date().toISOString(),
      };
      
      // Add to UI IMMEDIATELY (optimistic)
      const optimisticOrders = [newOrder, ...orders];
      setOrders(optimisticOrders);
      
      if (isClientTemp) {
        // Client not synced yet - wait and retry
        console.log('Client temporaire détecté, attente de la synchronisation...');
        setTimeout(async () => {
          // Refresh clients to get real ID
          const refreshedClients = await getMotoClients();
          const realClient = refreshedClients.find(c => 
            c.nom === client.nom && 
            c.numero === client.numero &&
            !c.id.startsWith('temp_')
          );
          
          if (realClient) {
            // Update order with real client ID in backend only
            const orderWithRealClientId = { ...newOrder, clientId: realClient.id };
            addMotoOrder(orderWithRealClientId).catch(console.error);
            // Don't refresh - keep optimistic order visible
          } else {
            console.error('Client non synchronisé après 3s');
          }
        }, 3000);
      } else {
        // Client already synced - add order immediately
        addMotoOrder(newOrder).catch(error => {
          console.error('Failed to add order:', error);
          // Remove temp order on error
          setOrders(orders);
          if (Platform.OS === 'web') {
            alert('Erreur lors de l\'ajout de la commande: ' + error.message);
          } else {
            Alert.alert('Erreur', 'Impossible d\'ajouter la commande: ' + error.message);
          }
        });
        // Don't refresh - keep optimistic order visible
      }
    } catch (error) {
      console.error('Error adding order:', error);
      if (Platform.OS === 'web') {
        alert('Erreur lors de l\'ajout de la commande: ' + error.message);
      } else {
        Alert.alert('Erreur', 'Impossible d\'ajouter la commande: ' + error.message);
      }
    }
  }, [clients, orders]);

  const handleToggleOrder = useCallback(async (orderId) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      // Update UI IMMEDIATELY (optimistic)
      const optimisticOrders = orders.map(o => 
        o.id === orderId ? { ...o, checked: !o.checked } : o
      );
      setOrders(optimisticOrders);
      
      // Sync to backend in background (don't await, don't use result)
      updateMotoOrder(orderId, { checked: !order.checked }).catch(err => {
        console.error('Failed to toggle order:', err);
        // Revert on error
        setOrders(orders);
      });
    }
  }, [orders]);

  const handleDeleteOrder = useCallback(async (orderId) => {
    // Remove from UI IMMEDIATELY (optimistic)
    const optimisticOrders = orders.filter(o => o.id !== orderId);
    setOrders(optimisticOrders);
    
    // Sync to backend in background (don't await, don't use result)
    deleteMotoOrder(orderId).catch(err => {
      console.error('Failed to delete order:', err);
      // Revert on error
      getMotoOrders().then(setOrders).catch(console.error);
    });
  }, [orders]);

  const handleNavigateToClient = useCallback(async (client) => {
    if (!userLocation) {
      if (Platform.OS === 'web') {
        alert('Attendez que votre position soit detectee.');
      } else {
        Alert.alert('Position introuvable', 'Attendez que votre position soit detectee.');
      }
      return;
    }
    setShowClientPopup(false);
    const startKey = `${userLocation[0].toFixed(4)},${userLocation[1].toFixed(4)}`;
    const endKey = `${client.longitude.toFixed(4)},${client.latitude.toFixed(4)}`;

    const applyRoute = (geometry, duration, distance, offline, route = null) => {
      setRouteGeoJSON({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry, properties: {} }],
      });
      setRouteInfo({
        duration,
        distance,
        clientName: client.nom + (offline ? ' (hors ligne)' : ''),
      });
      
      // 🎯 TURN-BY-TURN : Parser les steps de navigation
      if (route) {
        const steps = parseRouteSteps(route);
        setRouteSteps(steps);
        routeStepsRef.current = steps;
        setLastSpokenStepId(null);
        lastSpokenStepIdRef.current = null;
        console.log(`📍 Navigation: ${steps.length} étapes chargées`);
      }
      
      routeTargetRef.current = client;
      isNavigatingRef.current = true;
      setIsNavigating(true);
      
      // 🧭 MODE NAVIGATION DYNAMIQUE : Activer la boussole
      compassModeRef.current = 'active';
      setCompassMode('active');
      
      // Calculer direction initiale vers destination
      const navBearing = calcBearing(userLocation, [client.longitude, client.latitude]);
      userBearingRef.current = navBearing;
      smoothedBearingRef.current = navBearing;
      lastMapBearingRef.current = navBearing;
      // Démarrer en mode GPS: itinéraire vertical vers le haut
      if (Platform.OS === 'web' && mapRef.current) {
        const map = mapRef.current.getMap?.();
        if (map) {
          map.easeTo({
            center: userLocation,
            zoom: NAVIGATION_ZOOM,
            bearing: navBearing, // Orienter vers destination
            pitch: NAVIGATION_PITCH,
            duration: 1000,
          });
        }
      } else if (cameraRef.current) {
        cameraRef.current.setCamera({
          centerCoordinate: userLocation,
          zoomLevel: NAVIGATION_ZOOM,
          pitch: NAVIGATION_PITCH,
          heading: navBearing, // Orienter vers destination
          animationDuration: 1000,
        });
      }
    };

    try {
      const url = getDirectionsUrl(userLocation, [client.longitude, client.latitude]);
      const response = await fetch(url);
      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const duration = Math.round(route.duration / 60);
        const distance = (route.distance / 1000).toFixed(1);
        await cacheRoute(startKey, endKey, { geometry: route.geometry, duration, distance, steps: route.legs });
        applyRoute(route.geometry, duration, distance, false, route);
      }
    } catch (e) {
      const cached = await getCachedRoute(startKey, endKey);
      if (cached) {
        applyRoute(cached.geometry, cached.duration, cached.distance, true);
      } else {
        if (Platform.OS === 'web') {
          alert('Impossible de calculer l\'itineraire.');
        } else {
          Alert.alert('Erreur', 'Impossible de calculer l\'itineraire. Aucun itineraire en cache disponible.');
        }
      }
    }
  }, [userLocation]);

  const clearRoute = useCallback(() => {
    // 🔊 Arrêter les instructions vocales
    stopSpeaking();
    
    setRouteGeoJSON(null);
    setRouteInfo(null);
    setRouteSteps([]);
    setCurrentInstruction(null);
    setLastSpokenStepId(null);
    routeStepsRef.current = [];
    lastSpokenStepIdRef.current = null;
    setIsNavigating(false);
    isNavigatingRef.current = false;
    routeTargetRef.current = null;
    
    // 🧭 MODE NAVIGATION DYNAMIQUE : Désactiver la boussole
    compassModeRef.current = 'inactive';
    setCompassMode('inactive');
    if (autoRotationTimeoutRef.current) {
      clearTimeout(autoRotationTimeoutRef.current);
      autoRotationTimeoutRef.current = null;
    }
    
    if (routeIntervalRef.current) {
      clearInterval(routeIntervalRef.current);
      routeIntervalRef.current = null;
    }
    // Reset camera to normal view
    lastMapBearingRef.current = 0; // Réinitialiser bearing de la carte
    if (userLocation) {
      if (Platform.OS === 'web' && mapRef.current) {
        mapRef.current.easeTo(userLocation, 15, 0, 0);
      } else if (cameraRef.current) {
        cameraRef.current.setCamera({
          centerCoordinate: userLocation,
          zoomLevel: 15,
          pitch: 0,
          heading: 0,
          animationDuration: 1000,
        });
      }
    }
  }, [userLocation]);

  // Pre-calculate checked status for all clients in one pass
  const allCheckedMap = useMemo(() => {
    const map = {};
    const countMap = {};
    const checkedCountMap = {};
    orders.forEach(o => {
      countMap[o.clientId] = (countMap[o.clientId] || 0) + 1;
      if (o.checked) checkedCountMap[o.clientId] = (checkedCountMap[o.clientId] || 0) + 1;
    });
    Object.keys(countMap).forEach(clientId => {
      map[clientId] = countMap[clientId] > 0 && countMap[clientId] === (checkedCountMap[clientId] || 0);
    });
    return map;
  }, [orders]);

  const handleMarkerPress = useCallback((clientId) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setSelectedClient(client);
      setShowClientPopup(true);
    }
  }, [clients]);

  const selectMapStyle = useCallback((styleUrl, enable3D) => {
    setMapStyle(styleUrl);
    if (enable3D !== undefined) setIs3D(enable3D);
  }, []);

  // Toggle 2D/3D view with smooth animation
  const toggle3DView = useCallback(() => {
    const newIs3D = !is3D;
    setIs3D(newIs3D);
    if (Platform.OS === 'web' && mapRef.current?.toggle3D) {
      mapRef.current.toggle3D(newIs3D, 800);
    }
  }, [is3D]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (Platform.OS === 'web' && mapRef.current?.zoomIn) {
      mapRef.current.zoomIn(300);
    } else if (cameraRef.current) {
      cameraRef.current.setCamera({
        zoomLevel: mapZoom + 1,
        animationDuration: 300,
      });
    }
  }, [mapZoom]);

  const handleZoomOut = useCallback(() => {
    if (Platform.OS === 'web' && mapRef.current?.zoomOut) {
      mapRef.current.zoomOut(300);
    } else if (cameraRef.current) {
      cameraRef.current.setCamera({
        zoomLevel: mapZoom - 1,
        animationDuration: 300,
      });
    }
  }, [mapZoom]);

  // Map event handlers
  const handleBearingChange = useCallback((bearing) => {
    setMapBearing(bearing);
  }, []);

  const handlePitchChange = useCallback((pitch) => {
    setMapPitch(pitch);
  }, []);

  const handleZoomChange = useCallback((zoom) => {
    setMapZoom(zoom);
  }, []);

  // Fit map to show all client markers (+ user location)
  const fitAllClients = useCallback(() => {
    if (clients.length === 0) return;
    const coords = clients.map(c => [c.longitude, c.latitude]);
    if (userLocation) coords.push(userLocation);
    if (Platform.OS === 'web' && mapRef.current?.fitBounds) {
      mapRef.current.fitBounds(coords, 60);
    } else if (cameraRef.current) {
      // Native: compute bounding box
      let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
      coords.forEach(([lng, lat]) => {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      });
      const ne = [maxLng, maxLat];
      const sw = [minLng, minLat];
      const centerCoord = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
      // Estimate zoom from bounds span
      const span = Math.max(maxLng - minLng, maxLat - minLat);
      const zoom = span > 0 ? Math.max(2, Math.min(16, Math.log2(360 / span) - 1)) : 14;
      cameraRef.current.setCamera({
        centerCoordinate: centerCoord,
        zoomLevel: zoom,
        pitch: 0,
        heading: 0,
        animationDuration: 1000,
      });
    }
  }, [clients, userLocation]);

  // Auto-fit clients at startup (once data is loaded)
  const hasFittedRef = useRef(false);
  useEffect(() => {
    if (!loading && clients.length > 0 && userLocation && !hasFittedRef.current) {
      hasFittedRef.current = true;
      // Longer delay to ensure map style is fully loaded
      setTimeout(() => {
        try { fitAllClients(); } catch (e) { /* ignore */ }
      }, 1500);
    }
  }, [loading, clients.length, userLocation, fitAllClients]);

  const centerOnUser = useCallback(() => {
    if (!userLocation) return;
    
    // 🧭 MODE NAVIGATION DYNAMIQUE : Réactiver auto-rotation immédiatement
    if (isNavigatingRef.current) {
      if (autoRotationTimeoutRef.current) {
        clearTimeout(autoRotationTimeoutRef.current);
      }
      compassModeRef.current = 'active';
      setCompassMode('active');
      // Pas de clearRoute() - juste recentrer avec mode boussole réactivé
      if (Platform.OS === 'web' && mapRef.current) {
        const map = mapRef.current.getMap?.();
        if (map) {
          map.easeTo({
            center: userLocation,
            zoom: NAVIGATION_ZOOM,
            pitch: NAVIGATION_PITCH,
            bearing: smoothedBearingRef.current,
            duration: 1000,
            padding: { bottom: window.innerHeight * 0.33, top: 0, left: 0, right: 0 },
          });
        }
      } else if (cameraRef.current) {
        cameraRef.current.setCamera({
          centerCoordinate: userLocation,
          zoomLevel: NAVIGATION_ZOOM,
          pitch: NAVIGATION_PITCH,
          heading: smoothedBearingRef.current,
          animationDuration: 1000,
          padding: Platform.OS === 'android' 
            ? { paddingBottom: 300, paddingTop: 0, paddingLeft: 0, paddingRight: 0 }
            : undefined,
        });
      }
      return; // Ne pas exécuter le code ci-dessous
    }
    
    // Comportement normal hors navigation : arrêter la navigation si active
    if (isNavigating) {
      clearRoute();
    }
    if (Platform.OS === 'web' && mapRef.current) {
      mapRef.current.setCamera({
        centerCoordinate: userLocation,
        zoomLevel: 16,
        pitch: 0,
        bearing: 0,
        animationDuration: 1000,
      });
    } else if (cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: userLocation,
        zoomLevel: 16,
        pitch: 0,
        heading: 0,
        animationDuration: 1000,
      });
    }
    setMapBearing(0);
    setMapPitch(0);
  }, [userLocation, isNavigating, clearRoute]);

  // Fonction pour calculer la distance réelle en mètres (formule Haversine)
  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Rayon de la Terre en mètres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance en mètres
  }, []);

  // Calculer clients enrichis avec numéros et distances (pour markers ET liste)
  // 🔄 MISE À JOUR EN TEMPS RÉEL : Utilise userLocation (non stable) pour recalcul continu
  const enrichedClients = useMemo(() => {
    if (!userLocation) {
      // Si pas de position utilisateur, juste afficher dans l'ordre d'ajout
      return clients.map((client, index) => ({
        ...client,
        proximityNumber: index + 1,
        distanceMeters: null,
        distanceText: null,
      }));
    }

    // Calculer la VRAIE distance géographique de chaque client
    const clientsWithDistance = clients.map(client => {
      const distance = calculateDistance(
        userLocation[1], // lat utilisateur (temps réel)
        userLocation[0], // lng utilisateur (temps réel)
        client.latitude,
        client.longitude
      );
      return { ...client, distance };
    });

    // Trier par distance (du plus proche au plus éloigné)
    clientsWithDistance.sort((a, b) => a.distance - b.distance);

    // Assigner numéros et distances
    return clientsWithDistance.map((client, index) => {
      const distanceMeters = Math.round(client.distance);
      const distanceText = distanceMeters < 1000 
        ? `${distanceMeters} m`
        : `${(distanceMeters / 1000).toFixed(1)} km`;
      
      return {
        ...client,
        proximityNumber: index + 1, // 1 = plus proche, 2 = suivant, etc.
        distanceMeters: distanceMeters,
        distanceText: distanceText, // "350 m" ou "1.2 km"
      };
    });
  }, [clients, userLocation, calculateDistance]);

  const handleSearch = useCallback((text) => {
    setSearchQuery(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!text.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    // Recherche lieux uniquement (Mapbox POI)
    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchPlaces(text, userLocation);
        if (results.length > 0) {
          setSearchResults(results);
          setShowSearchResults(true);
        } else {
          setSearchResults([]);
          setShowSearchResults(false);
        }
      } catch (e) {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    }, 300);
  }, [userLocation]);

  const handleSelectSearchResult = useCallback((result) => {
    setSearchQuery(result.name);
    setShowSearchResults(false);
    setSearchResults([]);
    Keyboard.dismiss();
    if (Platform.OS === 'web' && mapRef.current) {
      mapRef.current.setCamera({
        centerCoordinate: result.coords,
        zoomLevel: 16,
        pitch: 0,
        bearing: 0,
        animationDuration: 1200,
      });
    } else if (cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: result.coords,
        zoomLevel: 16,
        pitch: 0,
        heading: 0,
        animationDuration: 1200,
      });
    }
  }, []);

  const webMarkers = useMemo(() => {
    return enrichedClients.map(client => {
      const allChecked = !!allCheckedMap[client.id];
      return {
        id: client.id,
        longitude: client.longitude,
        latitude: client.latitude,
        color: allChecked ? '#27ae60' : '#c0392b',
        label: String(client.proximityNumber),
        name: client.nom,
        showName: mapZoom >= 14,
        distanceMeters: client.distanceMeters,
        distanceText: client.distanceText,
      };
    });
  }, [enrichedClients, orders, allCheckedMap, mapZoom]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4361ee" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  const renderMap = () => {
    if (Platform.OS === 'web') {
      return (
        <WebMapView
          ref={mapRef}
          style={styles.map}
          center={userLocation || [-3.9962, 5.3484]}
          zoom={13}
          pitch={is3D ? 60 : 0}
          bearing={is3D ? 30 : 0}
          mapStyle={mapStyle}
          onLongPress={handleMapLongPress}
          onMarkerPress={handleMarkerPress}
          onMapInteraction={handleMapInteraction}
          onBearingChange={handleBearingChange}
          onPitchChange={handlePitchChange}
          onZoomChange={handleZoomChange}
          markers={webMarkers}
          routeGeoJSON={routeGeoJSON}
          userLocation={userLocation}
          disableGestures={false}
        />
      );
    }

    return (
      <MapboxGL.MapView
        ref={mapRef}
        style={styles.map}
        styleURL={mapStyle}
        onLongPress={handleMapLongPress}
        onPress={handleMapInteraction}
        pitchEnabled={true} // Toujours actif pour manipulation libre
        rotateEnabled={true} // Toujours actif pour rotation 360°
        scrollEnabled={true} // Toujours actif pour pan
        zoomEnabled={true} // Toujours actif pour zoom/dezoom
        compassEnabled={false}
        scaleBarEnabled={false}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          defaultSettings={{
            zoomLevel: 13,
            centerCoordinate: userLocation || [-3.9962, 5.3484],
            pitch: 0,
          }}
          animationMode="flyTo"
          animationDuration={1000}
        />
        <MapboxGL.UserLocation
          visible={true}
          showsUserHeadingIndicator={true}
          pulsing={{ isEnabled: true, color: '#4285F4', radius: 50 }}
        />
        {enrichedClients.map((client) => {
          const allChecked = !!allCheckedMap[client.id];
          const markerColor = allChecked ? '#27ae60' : '#c0392b';
          // 🔍 VISIBILITÉ ZOOM : Afficher les noms uniquement si zoom >= 14
          const showLabel = mapZoom >= 14;
          
          return (
            <MapboxGL.MarkerView
              key={client.id}
              id={`client-${client.id}`}
              coordinate={[client.longitude, client.latitude]}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  console.log('🎯 Marker pressed:', client.nom, 'ID:', client.id);
                  // Force l'état immédiatement
                  const clientData = enrichedClients.find(c => c.id === client.id);
                  if (clientData) {
                    setSelectedClient(clientData);
                    setShowClientPopup(true);
                    console.log('✅ Popup should open for:', clientData.nom);
                  }
                }}
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000,
                }}
              >
                {/* Cercle avec numéro - TOUJOURS VISIBLE */}
                <View
                  style={{
                    width: 64,
                    height: 64,
                    backgroundColor: markerColor,
                    borderRadius: 32,
                    borderWidth: 4,
                    borderColor: '#fff',
                    justifyContent: 'center',
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.3,
                    shadowRadius: 4,
                    elevation: 5,
                  }}
                >
                  <Text style={{
                    color: '#fff',
                    fontSize: 24,
                    fontWeight: 'bold',
                  }}>{client.proximityNumber}</Text>
                </View>
                
                {/* Label nom + distance - MASQUÉ au dézoom */}
                {showLabel && (
                  <View
                    style={{
                      marginTop: 4,
                      backgroundColor: 'rgba(0, 0, 0, 0.75)',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 8,
                      maxWidth: 150,
                    }}
                  >
                    <Text style={{
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 'bold',
                      textAlign: 'center',
                    }} numberOfLines={1}>
                      {client.nom}
                    </Text>
                    <Text style={{
                      color: '#4ade80',
                      fontSize: 11,
                      fontWeight: '600',
                      textAlign: 'center',
                      marginTop: 2,
                    }}>
                      {client.distanceText}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </MapboxGL.MarkerView>
          );
        })}
        {routeGeoJSON && (
          <MapboxGL.ShapeSource id="routeSource" shape={routeGeoJSON}>
            <MapboxGL.LineLayer
              id="routeLine"
              style={{
                lineColor: '#4285F4',
                lineWidth: 8,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </MapboxGL.ShapeSource>
        )}
      </MapboxGL.MapView>
    );
  };

  return (
    <View style={styles.container}>
      {renderMap()}

      {/* Settings button - top left */}
      <Animated.View style={[styles.settingsBtn, { transform: [{ scale: settingsBtnScale }] }]}>
        <Pressable
          style={styles.settingsBtnInner}
          onPress={() => setShowSettingsPanel(true)}
          {...animPress(settingsBtnScale)}
        >
          <View style={styles.settingsIcon}>
            <View style={styles.settingsLine} />
            <View style={styles.settingsLine} />
            <View style={styles.settingsLine} />
          </View>
        </Pressable>
      </Animated.View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>S</Text>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={handleSearch}
            placeholder="Rechercher un lieu..."
            placeholderTextColor="#999"
            returnKeyType="search"
            onFocus={() => { if (searchResults.length > 0) setShowSearchResults(true); }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); setShowSearchResults(false); }}>
              <Text style={styles.searchClear}>x</Text>
            </TouchableOpacity>
          )}
        </View>
        {showSearchResults && searchResults.length > 0 && (
          <View style={styles.searchResultsList}>
            {searchResults.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.searchResultItem}
                onPress={() => handleSelectSearchResult(item)}
              >
                <View style={styles.searchResultIcon}>
                  <Text style={styles.searchResultIconText}>📍</Text>
                </View>
                <View style={styles.searchResultInfo}>
                  <Text style={styles.searchResultName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.searchResultAddress} numberOfLines={2}>
                    {item.subtitle || item.fullName || ''}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Map controls - bottom right */}
      <View style={styles.bottomControls}>

        {/* Layers + 2D/3D Toggle row */}
        <View style={styles.topControlsRow}>
          <Animated.View style={{ transform: [{ scale: layerBtnScale }] }}>
            <Pressable style={styles.controlBtn} onPress={() => setShowLayerPicker(!showLayerPicker)} {...animPress(layerBtnScale)}>
              <View style={styles.layersIcon}>
                <View style={[styles.layerDiamond, styles.layerDiamond1]} />
                <View style={[styles.layerDiamond, styles.layerDiamond2]} />
              </View>
            </Pressable>
          </Animated.View>
          <Animated.View style={{ transform: [{ scale: viewToggleScale }] }}>
            <Pressable
              style={[styles.controlBtn, is3D && styles.controlBtnActive]}
              onPress={toggle3DView}
              {...animPress(viewToggleScale)}
            >
              <Text style={[styles.viewToggleText, is3D && styles.viewToggleTextActive]}>
                {is3D ? '3D' : '2D'}
              </Text>
            </Pressable>
          </Animated.View>
        </View>

        {/* Zoom controls */}
        <View style={styles.zoomControls}>
          <Animated.View style={{ transform: [{ scale: zoomInScale }] }}>
            <Pressable style={styles.zoomBtn} onPress={handleZoomIn} {...animPress(zoomInScale)}>
              <Text style={styles.zoomBtnText}>+</Text>
            </Pressable>
          </Animated.View>
          <View style={styles.zoomDivider} />
          <Animated.View style={{ transform: [{ scale: zoomOutScale }] }}>
            <Pressable style={styles.zoomBtn} onPress={handleZoomOut} {...animPress(zoomOutScale)}>
              <Text style={styles.zoomBtnText}>−</Text>
            </Pressable>
          </Animated.View>
        </View>

        {/* Position/Center button - long press = fit all clients */}
        {/* 🧭 Indicateur de mode boussole */}
        <Animated.View style={{ transform: [{ scale: posBtnScale }] }}>
          <Pressable 
            style={[
              styles.controlBtn, 
              compassMode === 'active' && styles.controlBtnCompassActive,
              compassMode === 'manual-override' && styles.controlBtnCompassOverride
            ]} 
            onPress={centerOnUser} 
            onLongPress={fitAllClients} 
            {...animPress(posBtnScale)}
          >
            {compassMode === 'inactive' ? (
              <View style={styles.crosshairIcon}>
                <View style={styles.crosshairRing} />
                <View style={styles.crosshairDot} />
                <View style={[styles.crosshairLine, styles.crosshairTop]} />
                <View style={[styles.crosshairLine, styles.crosshairBottom]} />
                <View style={[styles.crosshairLine, styles.crosshairLeft]} />
                <View style={[styles.crosshairLine, styles.crosshairRight]} />
              </View>
            ) : (
              <View style={styles.compassIcon}>
                <Text style={[
                  styles.compassArrow,
                  compassMode === 'active' && styles.compassArrowActive
                ]}>↑</Text>
                <View style={[
                  styles.compassDot,
                  compassMode === 'active' && styles.compassDotActive
                ]} />
              </View>
            )}
          </Pressable>
        </Animated.View>
      </View>

      {/* Layer picker backdrop + popup */}
      {showLayerPicker && (
        <>
          <Pressable style={styles.layerPickerBackdrop} onPress={() => setShowLayerPicker(false)} />
          <View style={styles.layerPickerContainer}>
            {MAP_STYLES.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.layerPickerBtn, mapStyle === s.url && styles.layerPickerBtnActive]}
                onPress={() => { selectMapStyle(s.url, s.id === '3d'); setShowLayerPicker(false); }}
              >
                <Text style={[styles.layerPickerBtnText, mapStyle === s.url && styles.layerPickerBtnTextActive]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* 🎯 NAVIGATION TURN-BY-TURN Banner */}
      {isNavigating && currentInstruction && (
        <NavigationBanner
          currentInstruction={currentInstruction}
          routeStats={getRouteStats(routeSteps, currentInstruction?.step?.id)}
          onClose={clearRoute}
        />
      )}

      {/* Fallback: Bannière simple si navigation mais pas d'instructions */}
      {routeInfo && !isNavigating && (
        <View style={styles.routeBanner}>
          <View style={styles.routeInfoContent}>
            <Text style={styles.routeDestination}>{routeInfo.clientName}</Text>
            <Text style={styles.routeDetails}>
              {routeInfo.duration} min {'\u00B7'} {routeInfo.distance} km
            </Text>
          </View>
          <TouchableOpacity style={styles.routeCloseBtn} onPress={clearRoute}>
            <Text style={styles.routeCloseBtnText}>x</Text>
          </TouchableOpacity>
        </View>
      )}

      {clients.length === 0 && !routeInfo && (
        <View style={styles.hint}>
          <Text style={styles.hintText}>Appui long sur la carte pour ajouter un client</Text>
        </View>
      )}
      {/* Clients list button - bottom left */}
      {enrichedClients.length > 0 && (
        <Animated.View style={[styles.clientsListBtn, { transform: [{ scale: clientsBtnScale }] }]}>
          <Pressable
            style={styles.clientsListBtnInner}
            onPress={() => setShowClientsList(true)}
            {...animPress(clientsBtnScale)}
          >
            <View style={styles.clientsIcon}>
              <View style={styles.clientsIconHead} />
              <View style={styles.clientsIconBody} />
            </View>
            <View style={styles.clientsBadge}>
              <Text style={styles.clientsBadgeText}>{enrichedClients.length}</Text>
            </View>
          </Pressable>
        </Animated.View>
      )}

      <ClientFormModal
        visible={showClientForm}
        coordinate={selectedCoord}
        onClose={() => setShowClientForm(false)}
        onSubmit={handleAddClient}
        showGoogleLink={true}
      />

      <MotoClientPopup
        visible={showClientPopup}
        client={selectedClient}
        orders={orders}
        onClose={() => { setShowClientPopup(false); setSelectedClient(null); }}
        onToggleOrder={handleToggleOrder}
        onAddOrder={handleAddOrder}
        onDeleteOrder={handleDeleteOrder}
        onNavigate={handleNavigateToClient}
        onDeleteClient={handleDeleteClient}
        clientNumber={selectedClient ? enrichedClients.find(c => c.id === selectedClient.id)?.proximityNumber : null}
        clientDistance={selectedClient ? enrichedClients.find(c => c.id === selectedClient.id)?.distanceText : null}
      />

      <SettingsPanel
        visible={showSettingsPanel}
        onClose={() => setShowSettingsPanel(false)}
        mode="moto"
        clients={enrichedClients}
        onClientPress={(client) => {
          // Centrer la carte sur le client sélectionné
          if (Platform.OS === 'web' && mapRef.current) {
            mapRef.current.setCamera({
              centerCoordinate: [client.longitude, client.latitude],
              zoomLevel: 17,
              pitch: 0,
              bearing: 0,
              animationDuration: 1200,
            });
          } else if (cameraRef.current) {
            cameraRef.current.setCamera({
              centerCoordinate: [client.longitude, client.latitude],
              zoomLevel: 17,
              pitch: 0,
              heading: 0,
              animationDuration: 1200,
            });
          }
        }}
      />

      {/* Clients List Modal */}
      {showClientsList && (
        <Modal visible={true} transparent animationType="slide" onRequestClose={() => setShowClientsList(false)}>
          <View style={styles.clientsListOverlay}>
            <View style={styles.clientsListContainer}>
              <View style={styles.clientsListHeader}>
                <TouchableOpacity 
                  style={styles.clientsListBackBtn} 
                  onPress={() => {
                    setShowClientsList(false);
                    setClientsSelectionMode(false);
                    setSelectedClients([]);
                  }}
                >
                  <Text style={styles.clientsListBackText}>{'<'}</Text>
                </TouchableOpacity>
                <Text style={styles.clientsListTitle}>Clients</Text>
                <View style={styles.clientsListBadge}>
                  <Text style={styles.clientsListBadgeText}>{enrichedClients.length}</Text>
                </View>
                <TouchableOpacity
                  style={styles.clientsListSelectBtn}
                  onPress={() => {
                    setClientsSelectionMode(!clientsSelectionMode);
                    setSelectedClients([]);
                  }}
                >
                  <Text style={styles.clientsListSelectBtnText}>
                    {clientsSelectionMode ? 'Annuler' : 'Sélectionner'}
                  </Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.clientsListScroll} showsVerticalScrollIndicator={false}>
                {clientsSelectionMode && (
                  <View style={styles.clientsListSelectAll}>
                    <TouchableOpacity
                      style={styles.clientsListSelectAllBtn}
                      onPress={() => {
                        if (selectedClients.length === enrichedClients.length) {
                          setSelectedClients([]);
                        } else {
                          setSelectedClients(enrichedClients.map(c => c.id));
                        }
                      }}
                    >
                      <View style={[
                        styles.clientsListCheckbox,
                        selectedClients.length === enrichedClients.length && styles.clientsListCheckboxChecked
                      ]}>
                        {selectedClients.length === enrichedClients.length && (
                          <Text style={styles.clientsListCheckmark}>✓</Text>
                        )}
                      </View>
                      <Text style={styles.clientsListSelectAllText}>
                        {selectedClients.length === enrichedClients.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                {enrichedClients.map((client) => (
                  <TouchableOpacity
                    key={client.id}
                    style={styles.clientsListItem}
                    onPress={() => {
                      if (clientsSelectionMode) {
                        if (selectedClients.includes(client.id)) {
                          setSelectedClients(selectedClients.filter(id => id !== client.id));
                        } else {
                          setSelectedClients([...selectedClients, client.id]);
                        }
                      } else {
                        setShowClientsList(false);
                        setSelectedClient(client);
                        setShowClientPopup(true);
                      }
                    }}
                  >
                    {clientsSelectionMode && (
                      <View style={[
                        styles.clientsListCheckbox,
                        selectedClients.includes(client.id) && styles.clientsListCheckboxChecked
                      ]}>
                        {selectedClients.includes(client.id) && (
                          <Text style={styles.clientsListCheckmark}>✓</Text>
                        )}
                      </View>
                    )}
                    <View style={styles.clientsListItemNumber}>
                      <Text style={styles.clientsListItemNumberText}>{client.proximityNumber}</Text>
                    </View>
                    <View style={styles.clientsListItemInfo}>
                      <Text style={styles.clientsListItemName}>{client.nom}</Text>
                      {client.distanceText && (
                        <Text style={styles.clientsListItemDistance}>{client.distanceText}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
                <View style={{ height: 30 }} />
              </ScrollView>
              {clientsSelectionMode && selectedClients.length > 0 && (
                <View style={styles.clientsListFooter}>
                  <TouchableOpacity
                    style={styles.clientsListDeleteBtn}
                    onPress={() => {
                      const count = selectedClients.length;
                      const message = count === 1 
                        ? 'Supprimer ce client ?' 
                        : `Supprimer ${count} clients ?`;
                      
                      if (Platform.OS === 'web') {
                        if (confirm(message)) {
                          // Suppression INSTANTANÉE dans l'UI (optimistic)
                          const optimisticClients = clients.filter(c => !selectedClients.includes(c.id));
                          const optimisticOrders = orders.filter(o => !selectedClients.includes(o.clientId));
                          setClients(optimisticClients);
                          setOrders(optimisticOrders);
                          
                          // Synchronisation en arrière-plan
                          selectedClients.forEach(clientId => {
                            deleteMotoClient(clientId).catch(err => {
                              console.error('Failed to delete client:', err);
                            });
                          });
                          
                          setSelectedClients([]);
                          setClientsSelectionMode(false);
                        }
                      } else {
                        Alert.alert('Confirmation', message, [
                          { text: 'Annuler', style: 'cancel' },
                          {
                            text: 'Supprimer',
                            style: 'destructive',
                            onPress: () => {
                              // Suppression INSTANTANÉE dans l'UI (optimistic)
                              const optimisticClients = clients.filter(c => !selectedClients.includes(c.id));
                              const optimisticOrders = orders.filter(o => !selectedClients.includes(o.clientId));
                              setClients(optimisticClients);
                              setOrders(optimisticOrders);
                              
                              // Synchronisation en arrière-plan
                              selectedClients.forEach(clientId => {
                                deleteMotoClient(clientId).catch(err => {
                                  console.error('Failed to delete client:', err);
                                });
                              });
                              
                              setSelectedClients([]);
                              setClientsSelectionMode(false);
                            }
                          }
                        ]);
                      }
                    }}
                  >
                    <Text style={styles.clientsListDeleteBtnText}>
                      Supprimer ({selectedClients.length})
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  loadingContainer: { flex: 1, backgroundColor: '#f2f2f7', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#3c3c43', marginTop: 16, fontSize: 16, fontWeight: '500' },
  map: { flex: 1 },

  // Settings button top left - iOS pill style
  settingsBtn: {
    position: 'absolute',
    top: 20,
    left: 16,
  },
  settingsBtnInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  settingsIcon: {
    gap: 4,
  },
  settingsLine: {
    width: 20,
    height: 2.5,
    backgroundColor: '#DC2626',
    borderRadius: 2,
  },

  // Top controls row (layers + 3D/2D)
  topControlsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 30,
    right: 16,
    gap: 10,
    alignItems: 'flex-end',
  },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  controlBtnActive: {
    backgroundColor: '#DC2626',
  },

  // 2D/3D Toggle
  viewToggleText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#DC2626',
  },
  viewToggleTextActive: {
    color: '#fff',
  },

  // Zoom controls
  zoomControls: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  zoomBtn: {
    width: 48,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomBtnText: {
    fontSize: 24,
    fontWeight: '500',
    color: '#DC2626',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: '#e5e5ea',
    marginHorizontal: 10,
  },

  layersIcon: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  layerDiamond: {
    width: 16,
    height: 16,
    borderWidth: 2,
    borderColor: '#DC2626',
    backgroundColor: 'transparent',
    transform: [{ rotate: '45deg' }],
    position: 'absolute',
  },
  layerDiamond1: {
    top: 1,
  },
  layerDiamond2: {
    top: 6,
    width: 14,
    height: 14,
    borderColor: '#5AC8FA',
  },

  crosshairIcon: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crosshairRing: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#DC2626',
    position: 'absolute',
  },
  crosshairDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DC2626',
    position: 'absolute',
  },
  crosshairLine: {
    position: 'absolute',
    backgroundColor: '#DC2626',
  },
  crosshairTop: { width: 2, height: 5, top: 0 },
  crosshairBottom: { width: 2, height: 5, bottom: 0 },
  crosshairLeft: { width: 5, height: 2, left: 0 },
  crosshairRight: { width: 5, height: 2, right: 0 },

  // 🧭 Compass icon (Mode Navigation Dynamique)
  compassIcon: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compassArrow: {
    fontSize: 20,
    fontWeight: '700',
    color: '#DC2626',
    position: 'absolute',
    top: -2,
  },
  compassArrowActive: {
    color: '#4285F4', // Bleu quand actif
  },
  compassDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DC2626',
    position: 'absolute',
    bottom: 2,
  },
  compassDotActive: {
    backgroundColor: '#4285F4', // Bleu quand actif
  },
  controlBtnCompassActive: {
    backgroundColor: 'rgba(66, 133, 244, 0.15)', // Fond bleu léger quand actif
    borderWidth: 2,
    borderColor: '#4285F4',
  },
  controlBtnCompassOverride: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 2,
    borderColor: '#FFA500', // Orange quand en manuel
  },

  // Layer picker
  layerPickerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9,
  },
  layerPickerContainer: {
    zIndex: 10,
    position: 'absolute',
    bottom: 240,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 18,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    gap: 4,
  },
  layerPickerBtn: {
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#f2f2f7',
  },
  layerPickerBtnActive: {
    backgroundColor: '#DC2626',
  },
  layerPickerBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3c3c43',
  },
  layerPickerBtnTextActive: {
    color: '#fff',
  },

  routeBanner: {
    position: 'absolute',
    bottom: 30,
    left: 16,
    right: 76,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  routeBannerNav: {
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  navPulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2626',
    marginRight: 10,
  },
  routeInfoContent: { flex: 1 },
  routeDestination: { color: '#000', fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  routeDetails: { color: '#DC2626', fontSize: 14, fontWeight: '600', marginTop: 3 },
  routeCloseBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#f2f2f7',
    justifyContent: 'center', alignItems: 'center',
  },
  routeCloseBtnText: { color: '#8e8e93', fontSize: 16, fontWeight: '600' },

  markerOuter: { alignItems: 'center' },
  markerCircle: {
    width: 50, height: 50, borderRadius: 25, borderWidth: 3,
    borderColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 8,
  },
  markerText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  markerArrow: {
    width: 0, height: 0,
    borderLeftWidth: 10, borderRightWidth: 10, borderTopWidth: 12,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    marginTop: -2,
  },
  markerNameLabel: {
    marginTop: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerNameText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  markerDistanceText: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '700',
  },

  hint: {
    position: 'absolute',
    bottom: 90, left: 16, right: 76,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 16, padding: 14,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  hintText: { color: '#8e8e93', fontSize: 14, fontWeight: '500' },

  // Search bar
  searchContainer: {
    position: 'absolute',
    top: 20,
    left: 74,
    right: 16,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  searchIcon: {
    fontSize: 14,
    fontWeight: '800',
    color: '#DC2626',
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    paddingVertical: 0,
  },
  searchClear: {
    fontSize: 16,
    color: '#8e8e93',
    fontWeight: '600',
    paddingLeft: 10,
  },
  searchResultsList: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f7',
    gap: 12,
  },
  searchResultIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EBF5FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultIconText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  searchResultAddress: {
    fontSize: 12,
    color: '#8e8e93',
    marginTop: 2,
  },
  searchResultItemClient: {
    backgroundColor: '#FFF7ED',
  },
  searchResultIconClient: {
    backgroundColor: '#DC2626',
  },
  searchResultNameClient: {
    color: '#DC2626',
    fontWeight: '700',
  },
  searchResultDistBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4ade80',
    backgroundColor: 'rgba(74,222,128,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  searchResultScore: {
    fontSize: 10,
    color: '#10b981',
    marginTop: 3,
    fontWeight: '600',
  },

  // Clients list button - bottom left
  clientsListBtn: {
    position: 'absolute',
    bottom: 30,
    left: 16,
  },
  clientsListBtnInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  clientsIcon: {
    width: 24,
    height: 24,
  },
  clientsIconHead: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#DC2626',
    position: 'absolute',
    top: 0,
    left: 6,
  },
  clientsIconBody: {
    width: 20,
    height: 12,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    backgroundColor: '#DC2626',
    position: 'absolute',
    bottom: 0,
    left: 2,
  },
  clientsBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#DC2626',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  clientsBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  clientsListOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  clientsListContainer: {
    height: '80%',
    backgroundColor: '#f2f2f7',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  clientsListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 12,
  },
  clientsListBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f2f2f7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientsListBackText: {
    color: '#DC2626',
    fontSize: 20,
    fontWeight: '700',
  },
  clientsListTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  clientsListBadge: {
    backgroundColor: '#EBF5FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  clientsListBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  clientsListScroll: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  clientsListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  clientsListItemNumber: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientsListItemNumberText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  clientsListItemInfo: {
    flex: 1,
  },
  clientsListItemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  clientsListItemDistance: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4ade80',
    marginTop: 2,
  },

  clientsListSelectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#EBF5FF',
  },
  clientsListSelectBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },
  clientsListSelectAll: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  clientsListSelectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clientsListSelectAllText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  clientsListCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#d1d1d6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientsListCheckboxChecked: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  clientsListCheckmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  clientsListFooter: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e5ea',
    padding: 16,
  },
  clientsListDeleteBtn: {
    backgroundColor: '#FF3B30',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  clientsListDeleteBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
