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
} from 'react-native';
import { useRouter } from 'expo-router';
import { getDirectionsUrl, parseGoogleMapsUrl, MAPBOX_TOKEN } from '../src/utils/mapbox';
import { getCurrentLocation, watchLocation } from '../src/utils/location';
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
  { id: '3d', label: '3D', url: 'mapbox://styles/mapbox/outdoors-v12' },
];

const ROUTE_UPDATE_INTERVAL = 8000;

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
  const userBearingRef = useRef(0);

  const [userLocation, setUserLocation] = useState(null);
  const userLocationRef = useRef(null);
  const [clients, setClients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedCoord, setSelectedCoord] = useState(null);
  const [showClientForm, setShowClientForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showClientPopup, setShowClientPopup] = useState(false);
  const [routeGeoJSON, setRouteGeoJSON] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapStyle, setMapStyle] = useState(MAP_STYLES[0].url);
  const [is3D, setIs3D] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const isNavigatingRef = useRef(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showLayerPicker, setShowLayerPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
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
  const compassScale = useRef(new Animated.Value(1)).current;
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
          setUserLocation(loc);
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
      if (prevLocationRef.current) {
        const dist = Math.hypot(newLoc[0] - prevLocationRef.current[0], newLoc[1] - prevLocationRef.current[1]);
        if (dist > 0.00005) {
          userBearingRef.current = calcBearing(prevLocationRef.current, newLoc);
          prevLocationRef.current = newLoc;
        }
      } else {
        prevLocationRef.current = newLoc;
      }
      userLocationRef.current = newLoc;
      setUserLocation(newLoc);

      // Smooth camera follow during navigation (no re-creating intervals)
      if (isNavigatingRef.current && routeTargetRef.current) {
        if (cameraUpdateTimer.current) clearTimeout(cameraUpdateTimer.current);
        cameraUpdateTimer.current = setTimeout(() => {
          const bearing = userBearingRef.current;
          if (Platform.OS === 'web' && mapRef.current) {
            mapRef.current.easeTo(newLoc, 17, bearing, 60);
          } else if (cameraRef.current) {
            cameraRef.current.setCamera({
              centerCoordinate: newLoc,
              zoomLevel: 17,
              pitch: 60,
              heading: bearing,
              animationDuration: 2000,
              animationMode: 'easeTo',
            });
          }
        }, 100);
      }
    });
    return () => sub.remove();
  }, []);

  // Real-time route: recalculate periodically (uses refs to avoid re-creating on location change)
  useEffect(() => {
    if (isNavigating && routeTargetRef.current) {
      isNavigatingRef.current = true;

      if (routeIntervalRef.current) clearInterval(routeIntervalRef.current);

      routeIntervalRef.current = setInterval(async () => {
        const loc = userLocationRef.current;
        if (!routeTargetRef.current || !loc) return;
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
            cacheRoute(sk, ek, { geometry: route.geometry, duration, distance });
            setRouteGeoJSON({
              type: 'FeatureCollection',
              features: [{ type: 'Feature', geometry: route.geometry, properties: {} }],
            });
            setRouteInfo({
              duration,
              distance,
              clientName: target.nom,
            });
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

  const handleMapLongPress = useCallback((event) => {
    const coord = event.geometry.coordinates;
    setSelectedCoord(coord);
    setShowClientForm(true);
  }, []);

  const handleAddClient = useCallback(async (formData) => {
    let coord = formData.coordinate;
    if (formData.googleLink) {
      const parsed = parseGoogleMapsUrl(formData.googleLink);
      if (parsed) coord = [parsed.longitude, parsed.latitude];
    }
    const newClient = {
      id: Date.now().toString(),
      nom: formData.nom,
      numero: formData.numero,
      adresse: formData.adresse,
      googleLink: formData.googleLink,
      longitude: coord[0],
      latitude: coord[1],
      createdAt: new Date().toISOString(),
    };
    const updated = await addMotoClient(newClient);
    setClients(updated);
  }, []);

  const handleDeleteClient = useCallback(async (clientId) => {
    const updated = await deleteMotoClient(clientId);
    setClients(updated);
    const updatedOrders = await getMotoOrders();
    setOrders(updatedOrders);
    setShowClientPopup(false);
    setSelectedClient(null);
  }, []);

  const handleAddOrder = useCallback(async (clientId, orderData) => {
    const newOrder = {
      id: Date.now().toString(),
      clientId,
      produit: orderData.produit,
      quantite: orderData.quantite,
      prix: orderData.prix,
      photo: orderData.photo || null,
      checked: false,
      createdAt: new Date().toISOString(),
    };
    const updated = await addMotoOrder(newOrder);
    setOrders(updated);
  }, []);

  const handleToggleOrder = useCallback(async (orderId) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      const updated = await updateMotoOrder(orderId, { checked: !order.checked });
      setOrders(updated);
    }
  }, [orders]);

  const handleDeleteOrder = useCallback(async (orderId) => {
    const updated = await deleteMotoOrder(orderId);
    setOrders(updated);
  }, []);

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

    const applyRoute = (geometry, duration, distance, offline) => {
      setRouteGeoJSON({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry, properties: {} }],
      });
      setRouteInfo({
        duration,
        distance,
        clientName: client.nom + (offline ? ' (hors ligne)' : ''),
      });
      routeTargetRef.current = client;
      isNavigatingRef.current = true;
      setIsNavigating(true);
      const navBearing = calcBearing(userLocation, [client.longitude, client.latitude]);
      userBearingRef.current = navBearing;
      if (Platform.OS === 'web' && mapRef.current) {
        mapRef.current.easeTo(userLocation, 17, navBearing, 60);
      } else if (cameraRef.current) {
        cameraRef.current.setCamera({
          centerCoordinate: userLocation,
          zoomLevel: 17,
          pitch: 60,
          heading: navBearing,
          animationDuration: 1500,
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
        await cacheRoute(startKey, endKey, { geometry: route.geometry, duration, distance });
        applyRoute(route.geometry, duration, distance, false);
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
    setRouteGeoJSON(null);
    setRouteInfo(null);
    setIsNavigating(false);
    isNavigatingRef.current = false;
    routeTargetRef.current = null;
    if (routeIntervalRef.current) {
      clearInterval(routeIntervalRef.current);
      routeIntervalRef.current = null;
    }
    // Reset camera to normal view
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

  const isClientAllChecked = useCallback((clientId) => {
    const clientOrders = orders.filter(o => o.clientId === clientId);
    return clientOrders.length > 0 && clientOrders.every(o => o.checked);
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

  // Reset compass/north
  const handleResetNorth = useCallback(() => {
    if (Platform.OS === 'web' && mapRef.current?.resetNorth) {
      mapRef.current.resetNorth(500);
    } else if (cameraRef.current) {
      cameraRef.current.setCamera({
        heading: 0,
        animationDuration: 500,
      });
    }
    setMapBearing(0);
  }, []);

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

  const centerOnUser = useCallback(() => {
    if (!userLocation) return;
    // Reset navigation state when centering on user
    if (isNavigating) {
      clearRoute();
    }
    if (Platform.OS === 'web' && mapRef.current) {
      // Use setCamera for more reliable behavior with explicit pitch/bearing reset
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

  const handleSearch = useCallback((text) => {
    setSearchQuery(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!text.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const proximity = userLocation ? `&proximity=${userLocation[0]},${userLocation[1]}` : '';
        // Use bbox around user location for better local results (roughly 50km radius)
        const bbox = userLocation
          ? `&bbox=${userLocation[0] - 0.5},${userLocation[1] - 0.5},${userLocation[0] + 0.5},${userLocation[1] + 0.5}`
          : '';
        // Enhanced search with all POI types and autocomplete
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json?access_token=${MAPBOX_TOKEN}&limit=15&language=fr${proximity}${bbox}&types=poi,address,place,locality,neighborhood,district,region&autocomplete=true&fuzzyMatch=true`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.features && data.features.length > 0) {
          setSearchResults(data.features.map(f => ({
            id: f.id,
            name: f.text,
            fullName: f.place_name,
            coords: f.center,
            category: f.properties?.category || '',
          })));
          setShowSearchResults(true);
        } else {
          // If no results, try without bbox for broader search
          const fallbackUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json?access_token=${MAPBOX_TOKEN}&limit=10&language=fr${proximity}&types=poi,address,place,locality,neighborhood&autocomplete=true`;
          const fallbackRes = await fetch(fallbackUrl);
          const fallbackData = await fallbackRes.json();
          if (fallbackData.features) {
            setSearchResults(fallbackData.features.map(f => ({
              id: f.id,
              name: f.text,
              fullName: f.place_name,
              coords: f.center,
              category: f.properties?.category || '',
            })));
            setShowSearchResults(true);
          }
        }
      } catch (e) {
        console.warn('Search error:', e);
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
    return clients.map(client => {
      const allChecked = isClientAllChecked(client.id);
      return {
        id: client.id,
        longitude: client.longitude,
        latitude: client.latitude,
        color: allChecked ? '#27ae60' : '#c0392b',
        label: client.nom.substring(0, 2).toUpperCase(),
      };
    });
  }, [clients, orders, isClientAllChecked]);

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
          onBearingChange={handleBearingChange}
          onPitchChange={handlePitchChange}
          onZoomChange={handleZoomChange}
          markers={webMarkers}
          routeGeoJSON={routeGeoJSON}
          userLocation={userLocation}
        />
      );
    }

    return (
      <MapboxGL.MapView
        ref={mapRef}
        style={styles.map}
        styleURL={mapStyle}
        onLongPress={handleMapLongPress}
        pitchEnabled={true}
        rotateEnabled={true}
        compassEnabled={true}
        scaleBarEnabled={false}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          zoomLevel={13}
          centerCoordinate={userLocation || [-3.9962, 5.3484]}
          pitch={is3D ? 60 : 0}
          animationMode="flyTo"
          animationDuration={1000}
        />
        <MapboxGL.UserLocation
          visible={true}
          showsUserHeadingIndicator={true}
          pulsing={{ isEnabled: true, color: '#4285F4', radius: 50 }}
        />
        {clients.map((client) => {
          const allChecked = isClientAllChecked(client.id);
          const markerColor = allChecked ? '#27ae60' : '#c0392b';
          return (
            <MapboxGL.PointAnnotation
              key={client.id}
              id={`client-${client.id}`}
              coordinate={[client.longitude, client.latitude]}
              onSelected={() => {
                setSelectedClient(client);
                setShowClientPopup(true);
              }}
            >
              <View style={styles.markerOuter}>
                <View style={[styles.markerCircle, { backgroundColor: markerColor }]}>
                  <Text style={styles.markerText}>{client.nom.substring(0, 2).toUpperCase()}</Text>
                </View>
                <View style={[styles.markerArrow, { borderTopColor: markerColor }]} />
              </View>
            </MapboxGL.PointAnnotation>
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
                  <Text style={styles.searchResultIconText}>P</Text>
                </View>
                <View style={styles.searchResultInfo}>
                  <Text style={styles.searchResultName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.searchResultAddress} numberOfLines={1}>{item.fullName}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Settings menu modal removed - 3 lines now directly opens settings panel */}

      {/* Layers button - top right (Google Maps style) */}
      <Animated.View style={[styles.topRightBtn, { transform: [{ scale: layerBtnScale }] }]}>
        <Pressable style={styles.controlBtn} onPress={() => setShowLayerPicker(!showLayerPicker)} {...animPress(layerBtnScale)}>
          <View style={styles.layersIcon}>
            <View style={[styles.layerDiamond, styles.layerDiamond1]} />
            <View style={[styles.layerDiamond, styles.layerDiamond2]} />
          </View>
        </Pressable>
      </Animated.View>

      {/* Map controls - bottom right */}
      <View style={styles.bottomControls}>
        {/* Compass/Reset North - only show when rotated */}
        {Math.abs(mapBearing) > 5 && (
          <Animated.View style={{ transform: [{ scale: compassScale }] }}>
            <Pressable style={styles.controlBtn} onPress={handleResetNorth} {...animPress(compassScale)}>
              <View style={[styles.compassIcon, { transform: [{ rotate: `${-mapBearing}deg` }] }]}>
                <View style={styles.compassNorth} />
                <View style={styles.compassSouth} />
              </View>
            </Pressable>
          </Animated.View>
        )}

        {/* 2D/3D Toggle */}
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

        {/* Position/Center button */}
        <Animated.View style={{ transform: [{ scale: posBtnScale }] }}>
          <Pressable style={styles.controlBtn} onPress={centerOnUser} {...animPress(posBtnScale)}>
            <View style={styles.crosshairIcon}>
              <View style={styles.crosshairRing} />
              <View style={styles.crosshairDot} />
              <View style={[styles.crosshairLine, styles.crosshairTop]} />
              <View style={[styles.crosshairLine, styles.crosshairBottom]} />
              <View style={[styles.crosshairLine, styles.crosshairLeft]} />
              <View style={[styles.crosshairLine, styles.crosshairRight]} />
            </View>
          </Pressable>
        </Animated.View>
      </View>

      {/* Layer picker popup */}
      {showLayerPicker && (
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
      )}

      {routeInfo && (
        <View style={[styles.routeBanner, isNavigating && styles.routeBannerNav]}>
          {isNavigating && <View style={styles.navPulse} />}
          <View style={styles.routeInfoContent}>
            <Text style={styles.routeDestination}>{routeInfo.clientName}</Text>
            <Text style={styles.routeDetails}>
              {routeInfo.duration} min  Â·  {routeInfo.distance} km
              {isNavigating ? '  Â·  En cours' : ''}
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
      />

      <SettingsPanel
        visible={showSettingsPanel}
        onClose={() => setShowSettingsPanel(false)}
        mode="moto"
      />
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
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },

  // Menu overlay
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  menuPanel: {
    marginTop: 110,
    marginLeft: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 18,
    width: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#007AFF',
    letterSpacing: 0.8,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#e5e5ea',
    marginVertical: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  menuItemIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemIconText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  menuItemDesc: {
    fontSize: 12,
    color: '#8e8e93',
    marginTop: 1,
  },
  menuItemLogout: {
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FFF2F2',
    borderRadius: 14,
  },
  menuItemLogoutText: {
    color: '#FF3B30',
    fontSize: 15,
    fontWeight: '600',
  },

  // Gear icon
  gearIcon: { width: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
  gearCircle: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#007AFF', position: 'absolute' },
  gearTooth: { width: 4, height: 4, borderRadius: 1, backgroundColor: '#007AFF', position: 'absolute' },

  // Position icon
  posIcon: { width: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
  posRing: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#34c759', position: 'absolute' },
  posDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#34c759', position: 'absolute' },

  // Bottom right
  topRightBtn: {
    position: 'absolute',
    top: 76,
    right: 16,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 30,
    right: 16,
    gap: 10,
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
    backgroundColor: '#007AFF',
  },

  // 2D/3D Toggle
  viewToggleText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#007AFF',
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
    color: '#007AFF',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: '#e5e5ea',
    marginHorizontal: 10,
  },

  // Compass icon
  compassIcon: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compassNorth: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FF3B30',
    position: 'absolute',
    top: 0,
  },
  compassSouth: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#8e8e93',
    position: 'absolute',
    bottom: 0,
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
    borderColor: '#007AFF',
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
    borderColor: '#007AFF',
    position: 'absolute',
  },
  crosshairDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#007AFF',
    position: 'absolute',
  },
  crosshairLine: {
    position: 'absolute',
    backgroundColor: '#007AFF',
  },
  crosshairTop: { width: 2, height: 5, top: 0 },
  crosshairBottom: { width: 2, height: 5, bottom: 0 },
  crosshairLeft: { width: 5, height: 2, left: 0 },
  crosshairRight: { width: 5, height: 2, right: 0 },

  // Layer picker popup
  layerPickerContainer: {
    position: 'absolute',
    top: 132,
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
    backgroundColor: '#007AFF',
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
    borderLeftColor: '#007AFF',
  },
  navPulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
    marginRight: 10,
  },
  routeInfoContent: { flex: 1 },
  routeDestination: { color: '#000', fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  routeDetails: { color: '#007AFF', fontSize: 14, fontWeight: '600', marginTop: 3 },
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
    color: '#007AFF',
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
    color: '#007AFF',
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
});
