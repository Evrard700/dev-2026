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
  ScrollView,
  Animated,
  Image,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getDirectionsUrl, MAPBOX_TOKEN } from '../src/utils/mapbox';
import { getCurrentLocation, watchLocation } from '../src/utils/location';
import {
  getB2BClients,
  addB2BClient,
  updateB2BClient,
  deleteB2BClient,
  getB2BDeliveryList,
  saveB2BDeliveryList,
  getCachedRoute,
  cacheRoute,
  logoutUser,
} from '../src/stores/storage';
import ClientFormModal from '../src/components/ClientFormModal';
import B2BClientPopup from '../src/components/B2BClientPopup';
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

export default function B2BScreen() {
  const router = useRouter();
  const mapRef = useRef(null);
  const cameraRef = useRef(null);

  const [userLocation, setUserLocation] = useState(null);
  const [clients, setClients] = useState([]);
  const [deliveryList, setDeliveryList] = useState([]);
  const [selectedCoord, setSelectedCoord] = useState(null);
  const [showClientForm, setShowClientForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showClientPopup, setShowClientPopup] = useState(false);
  const [activeView, setActiveView] = useState('overview');
  const [routeGeoJSON, setRouteGeoJSON] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapStyle, setMapStyle] = useState(MAP_STYLES[0].url);
  const [is3D, setIs3D] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showLayerPicker, setShowLayerPicker] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showClientList, setShowClientList] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchTimerRef = useRef(null);
  const clientListAnim = useRef(new Animated.Value(0)).current;
  const clientListScale = useRef(new Animated.Value(0.95)).current;

  // Map view state
  const [mapBearing, setMapBearing] = useState(0);
  const [mapPitch, setMapPitch] = useState(0);
  const [mapZoom, setMapZoom] = useState(14);

  // Button animations
  const settingsBtnScale = useRef(new Animated.Value(1)).current;
  const layerBtnScale = useRef(new Animated.Value(1)).current;
  const posBtnScale = useRef(new Animated.Value(1)).current;
  const viewMenuBtnScale = useRef(new Animated.Value(1)).current;
  const viewToggleScale = useRef(new Animated.Value(1)).current;
  const zoomInScale = useRef(new Animated.Value(1)).current;
  const zoomOutScale = useRef(new Animated.Value(1)).current;
  const compassScale = useRef(new Animated.Value(1)).current;

  const animPress = useCallback((anim) => ({
    onPressIn: () => Animated.spring(anim, { toValue: 0.88, useNativeDriver: true, speed: 50, bounciness: 4 }).start(),
    onPressOut: () => Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 10 }).start(),
  }), []);

  useEffect(() => {
    (async () => {
      try {
        const location = await getCurrentLocation();
        setUserLocation([location.coords.longitude, location.coords.latitude]);
      } catch (e) {
        console.warn('Location error:', e);
      }
      const [c, dl] = await Promise.all([getB2BClients(), getB2BDeliveryList()]);
      setClients(c);
      setDeliveryList(dl);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const sub = watchLocation((loc) => {
      setUserLocation([loc.coords.longitude, loc.coords.latitude]);
    });
    return () => sub.remove();
  }, []);

  // Animate client list open/close
  useEffect(() => {
    if (showClientList && activeView === 'overview') {
      clientListAnim.setValue(0);
      clientListScale.setValue(0.95);
      Animated.parallel([
        Animated.spring(clientListAnim, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
        Animated.spring(clientListScale, { toValue: 1, friction: 5, tension: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [showClientList, activeView]);

  const handleMapLongPress = useCallback((event) => {
    if (activeView === 'overview') return; // No adding clients in overview mode
    const coord = event.geometry.coordinates;
    setSelectedCoord(coord);
    setShowClientForm(true);
  }, [activeView]);

  const handleAddClient = useCallback(async (formData) => {
    const newClient = {
      id: Date.now().toString(),
      nom: formData.nom,
      numero: formData.numero,
      adresse: formData.adresse,
      photo: formData.photo || null,
      longitude: formData.coordinate[0],
      latitude: formData.coordinate[1],
      served: null,
      createdAt: new Date().toISOString(),
    };
    const updated = await addB2BClient(newClient);
    setClients(updated);
    // Auto-add to delivery list when added from delivery view
    if (activeView === 'delivery') {
      const newList = [...deliveryList, newClient.id];
      setDeliveryList(newList);
      await saveB2BDeliveryList(newList);
    }
  }, [activeView, deliveryList]);

  const handleDeleteClient = useCallback(async (clientId) => {
    const updated = await deleteB2BClient(clientId);
    setClients(updated);
    const newDeliveryList = deliveryList.filter(id => id !== clientId);
    await saveB2BDeliveryList(newDeliveryList);
    setDeliveryList(newDeliveryList);
    setShowClientPopup(false);
    setSelectedClient(null);
  }, [deliveryList]);

  const handleServe = useCallback(async (clientId) => {
    const updated = await updateB2BClient(clientId, { served: true });
    setClients(updated);
    setSelectedClient(prev => prev ? { ...prev, served: true } : null);
  }, []);

  const handleNotServe = useCallback(async (clientId) => {
    const updated = await updateB2BClient(clientId, { served: false });
    setClients(updated);
    setSelectedClient(prev => prev ? { ...prev, served: false } : null);
  }, []);

  // Toggle client selection for delivery list
  const toggleClientSelection = useCallback(async (clientId) => {
    let newList;
    if (deliveryList.includes(clientId)) {
      newList = deliveryList.filter(id => id !== clientId);
    } else {
      newList = [...deliveryList, clientId];
    }
    setDeliveryList(newList);
    await saveB2BDeliveryList(newList);
  }, [deliveryList]);

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
    try {
      const url = getDirectionsUrl(userLocation, [client.longitude, client.latitude]);
      const response = await fetch(url);
      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const routeData = {
          geometry: route.geometry,
          duration: Math.round(route.duration / 60),
          distance: (route.distance / 1000).toFixed(1),
        };
        await cacheRoute(startKey, endKey, routeData);
        setRouteGeoJSON({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', geometry: route.geometry, properties: {} }],
        });
        setRouteInfo({
          duration: routeData.duration,
          distance: routeData.distance,
          clientName: client.nom,
        });
      }
    } catch (e) {
      const cached = await getCachedRoute(startKey, endKey);
      if (cached) {
        setRouteGeoJSON({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', geometry: cached.geometry, properties: {} }],
        });
        setRouteInfo({
          duration: cached.duration,
          distance: cached.distance,
          clientName: client.nom + ' (hors ligne)',
        });
      } else {
        if (Platform.OS === 'web') {
          alert('Impossible de calculer l\'itineraire.');
        } else {
          Alert.alert('Erreur', 'Impossible de calculer l\'itineraire.');
        }
      }
    }
  }, [userLocation]);

  const clearRoute = useCallback(() => {
    setRouteGeoJSON(null);
    setRouteInfo(null);
  }, []);

  const selectMapStyle = useCallback((styleUrl, enable3D) => {
    setMapStyle(styleUrl);
    if (enable3D !== undefined) setIs3D(enable3D);
    setShowLayerPicker(false);
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
  }, [userLocation]);

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

  const displayedClients = activeView === 'delivery'
    ? clients.filter(c => deliveryList.includes(c.id))
    : clients;

  const handleMarkerPress = useCallback((clientId) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setSelectedClient(client);
      setShowClientPopup(true);
    }
  }, [clients]);

  const webMarkers = useMemo(() => {
    return displayedClients.map(client => {
      let color = '#DC2626';
      if (activeView === 'delivery') {
        color = client.served === true ? '#34c759' : '#DC2626';
      }
      let borderColor = '#ffffff';
      if (activeView === 'delivery') {
        if (client.served === true) borderColor = '#34c759';
        else if (client.served === false) borderColor = '#e74c3c';
      }
      return {
        id: client.id,
        longitude: client.longitude,
        latitude: client.latitude,
        color,
        borderColor,
        label: client.nom.charAt(0).toUpperCase(),
        photo: client.photo || null,
      };
    });
  }, [displayedClients, activeView]);

  const deliveryCount = deliveryList.length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#DC2626" />
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
          bearing={mapBearing}
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
          pulsing={{ isEnabled: true, color: '#DC2626', radius: 50 }}
        />
        {displayedClients.map((client) => {
          let markerColor = '#DC2626';
          let markerBorder = '#ffffff';
          if (activeView === 'delivery') {
            markerColor = client.served === true ? '#34c759' : '#DC2626';
            if (client.served === true) markerBorder = '#34c759';
            else if (client.served === false) markerBorder = '#e74c3c';
          }
          return (
            <MapboxGL.PointAnnotation
              key={`${client.id}-${client.served}`}
              id={`b2b-client-${client.id}`}
              coordinate={[client.longitude, client.latitude]}
              onSelected={() => {
                setSelectedClient(client);
                setShowClientPopup(true);
              }}
            >
              <View style={styles.markerOuter}>
                {client.photo ? (
                  <Image source={{ uri: client.photo }} style={[styles.markerPhoto, { borderColor: markerBorder }]} />
                ) : (
                  <View style={[styles.markerCircle, { backgroundColor: markerColor, borderColor: markerBorder }]}>
                    <Text style={styles.markerText}>{client.nom.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={[styles.markerArrow, { borderTopColor: client.photo ? markerBorder : markerColor }]} />
              </View>
            </MapboxGL.PointAnnotation>
          );
        })}
        {routeGeoJSON && (
          <MapboxGL.ShapeSource id="routeSource" shape={routeGeoJSON}>
            <MapboxGL.LineLayer
              id="routeLine"
              style={{
                lineColor: '#DC2626',
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
          <View style={styles.layersIconWrap}>
            <View style={[styles.layerDiamond, styles.layerDiamond1]} />
            <View style={[styles.layerDiamond, styles.layerDiamond2]} />
          </View>
        </Pressable>
      </Animated.View>

      {/* Map controls - bottom right */}
      <View style={styles.bottomControls}>
        {/* Compass - visible when map is rotated */}
        {Math.abs(mapBearing) > 1 && (
          <Animated.View style={{ transform: [{ scale: compassScale }] }}>
            <Pressable
              style={styles.controlBtn}
              onPress={handleResetNorth}
              {...animPress(compassScale)}
            >
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

        {/* Position/center button */}
        <Animated.View style={{ transform: [{ scale: posBtnScale }] }}>
          <Pressable style={styles.controlBtn} onPress={centerOnUser} {...animPress(posBtnScale)}>
            <View style={styles.crosshairWrap}>
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
              onPress={() => selectMapStyle(s.url, s.id === '3d')}
            >
              <Text style={[styles.layerPickerBtnText, mapStyle === s.url && styles.layerPickerBtnTextActive]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Floating view menu button - bottom left */}
      <View style={styles.viewMenuContainer}>
        {showViewMenu && (
          <View style={styles.viewMenuButtons}>
            {/* Vue d'ensemble button */}
            <TouchableOpacity
              style={[styles.viewMenuBtn, activeView === 'overview' && styles.viewMenuBtnActive]}
              onPress={() => {
                setActiveView('overview');
                setShowViewMenu(false);
                setShowClientList(true);
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.viewMenuBtnIcon, activeView === 'overview' && styles.viewMenuBtnIconActive]}>
                {/* Multi-clients icon */}
                <View style={styles.multiClientIcon}>
                  <View style={[styles.personHead, { left: 4, top: 0 }]} />
                  <View style={[styles.personBody, { left: 1, top: 8 }]} />
                  <View style={[styles.personHead, { right: 4, top: 0 }]} />
                  <View style={[styles.personBody, { right: 1, top: 8 }]} />
                </View>
              </View>
              <Text style={[styles.viewMenuBtnText, activeView === 'overview' && styles.viewMenuBtnTextActive]} numberOfLines={1}>
                Vue d'ensemble
              </Text>
              <View style={styles.clientCountBadge}>
                <Text style={styles.clientCountText}>{clients.length}</Text>
              </View>
            </TouchableOpacity>

            {/* Client a livrer button */}
            <TouchableOpacity
              style={[styles.viewMenuBtn, activeView === 'delivery' && styles.viewMenuBtnActive]}
              onPress={() => {
                setActiveView('delivery');
                setShowViewMenu(false);
                setShowClientList(false);
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.viewMenuBtnIcon, activeView === 'delivery' && styles.viewMenuBtnIconActive]}>
                {/* Moto delivery man icon */}
                <View style={styles.motoDelivIcon}>
                  <View style={styles.motoRiderHead} />
                  <View style={styles.motoRiderBody} />
                  <View style={styles.motoWheelL} />
                  <View style={styles.motoWheelR} />
                  <View style={styles.motoFrame} />
                </View>
              </View>
              <Text style={[styles.viewMenuBtnText, activeView === 'delivery' && styles.viewMenuBtnTextActive]} numberOfLines={1}>
                Client a livrer
              </Text>
              {deliveryCount > 0 && (
                <View style={styles.viewMenuBadge}>
                  <Text style={styles.viewMenuBadgeText}>{deliveryCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Main button - dynamic color based on active view */}
        <Animated.View style={{ transform: [{ scale: viewMenuBtnScale }] }}>
        <Pressable
          style={[
            styles.viewMenuMainBtn,
            showViewMenu && styles.viewMenuMainBtnActive,
            activeView === 'overview' && !showViewMenu && styles.viewMenuMainBtnOverview,
            activeView === 'delivery' && !showViewMenu && styles.viewMenuMainBtnDelivery,
          ]}
          onPress={() => setShowViewMenu(!showViewMenu)}
          {...animPress(viewMenuBtnScale)}
        >
          <View style={styles.multiPeopleMainIcon}>
            <View style={styles.mainPersonGroup}>
              <View style={[styles.mainPersonHead, !showViewMenu && activeView === 'overview' && styles.mainPersonHeadBlue, { marginRight: -2 }]} />
              <View style={[styles.mainPersonHead, !showViewMenu && activeView === 'overview' && styles.mainPersonHeadBlue, { marginLeft: -2 }]} />
            </View>
            <View style={styles.mainPersonBodyRow}>
              <View style={[styles.mainPersonBodySmall, !showViewMenu && activeView === 'overview' && styles.mainPersonBodyBlue, { marginRight: -1 }]} />
              <View style={[styles.mainPersonBodySmall, !showViewMenu && activeView === 'overview' && styles.mainPersonBodyBlue, { marginLeft: -1 }]} />
            </View>
          </View>
        </Pressable>
        </Animated.View>
      </View>

      {/* Floating client list (overview mode) */}
      {showClientList && activeView === 'overview' && clients.length > 0 && (
        <Animated.View style={[
          styles.clientListContainer,
          {
            opacity: clientListAnim,
            transform: [
              { scale: clientListScale },
              { translateY: clientListAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) },
            ],
          },
        ]}>
          <View style={styles.clientListHeader}>
            <Text style={styles.clientListTitle}>Clients ({clients.length})</Text>
            <TouchableOpacity onPress={() => setShowClientList(false)} style={styles.clientListClose}>
              <Text style={styles.clientListCloseText}>x</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.clientListScroll} showsVerticalScrollIndicator={false}>
            {clients.map((client) => {
              const isSelected = deliveryList.includes(client.id);
              return (
                <TouchableOpacity
                  key={client.id}
                  style={[styles.clientListItem, isSelected && styles.clientListItemSelected]}
                  onPress={() => toggleClientSelection(client.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.clientCheckbox, isSelected && styles.clientCheckboxChecked]}>
                    {isSelected && <Text style={styles.clientCheckmark}>✓</Text>}
                  </View>
                  <View style={styles.clientListInfo}>
                    <Text style={[styles.clientListName, isSelected && styles.clientListNameSelected]}>{client.nom}</Text>
                    {client.adresse ? (
                      <Text style={styles.clientListAddr} numberOfLines={1}>{client.adresse}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={styles.clientListLocateBtn}
                    onPress={() => {
                      if (Platform.OS === 'web' && mapRef.current) {
                        mapRef.current.flyTo([client.longitude, client.latitude], 16);
                      } else if (cameraRef.current) {
                        cameraRef.current.setCamera({
                          centerCoordinate: [client.longitude, client.latitude],
                          zoomLevel: 16,
                          animationDuration: 1000,
                        });
                      }
                    }}
                  >
                    <View style={styles.locateIcon}>
                      <View style={styles.locatePinHead} />
                      <View style={styles.locatePinTail} />
                    </View>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {deliveryList.length > 0 && (
            <TouchableOpacity
              style={styles.goToDeliveryBtn}
              onPress={() => {
                setActiveView('delivery');
                setShowClientList(false);
              }}
            >
              <Text style={styles.goToDeliveryText}>Voir les {deliveryList.length} client(s) a livrer</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      {/* Route info */}
      {routeInfo && (
        <View style={styles.routeBanner}>
          <View style={styles.routeInfoContent}>
            <Text style={styles.routeDestination}>{routeInfo.clientName}</Text>
            <Text style={styles.routeDetails}>
              {routeInfo.duration} min  ·  {routeInfo.distance} km
            </Text>
          </View>
          <TouchableOpacity style={styles.routeCloseBtn} onPress={clearRoute}>
            <Text style={styles.routeCloseBtnText}>x</Text>
          </TouchableOpacity>
        </View>
      )}

      <ClientFormModal
        visible={showClientForm}
        coordinate={selectedCoord}
        onClose={() => setShowClientForm(false)}
        onSubmit={handleAddClient}
        showGoogleLink={false}
        showPhotoUpload={true}
      />

      <B2BClientPopup
        visible={showClientPopup}
        client={selectedClient}
        onClose={() => { setShowClientPopup(false); setSelectedClient(null); }}
        onServe={handleServe}
        onNotServe={handleNotServe}
        onNavigate={handleNavigateToClient}
        onDeleteClient={handleDeleteClient}
        isDeliveryView={activeView === 'delivery'}
      />

      <SettingsPanel
        visible={showSettingsPanel}
        onClose={() => setShowSettingsPanel(false)}
        mode="b2b"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  loadingContainer: { flex: 1, backgroundColor: '#f2f2f7', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#3c3c43', marginTop: 16, fontSize: 16, fontWeight: '500' },
  map: { flex: 1 },

  // Settings button top left
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
  settingsIcon: { gap: 4 },
  settingsLine: { width: 20, height: 2.5, backgroundColor: '#DC2626', borderRadius: 2 },

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
    color: '#DC2626',
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
  menuItemContent: { flex: 1 },
  menuItemText: { fontSize: 15, fontWeight: '600', color: '#000' },
  menuItemDesc: { fontSize: 12, color: '#8e8e93', marginTop: 1 },
  menuItemLogout: {
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FFF2F2',
    borderRadius: 14,
  },
  menuItemLogoutText: { color: '#FF3B30', fontSize: 15, fontWeight: '600' },

  // Gear icon
  gearIcon: { width: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
  gearCircle: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#DC2626', position: 'absolute' },
  gearTooth: { width: 4, height: 4, borderRadius: 1, backgroundColor: '#DC2626', position: 'absolute' },

  // Position icon
  posIcon: { width: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
  posRing: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#34c759', position: 'absolute' },
  posDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#34c759', position: 'absolute' },

  topRightBtn: {
    position: 'absolute',
    top: 76,
    right: 16,
  },
  // Bottom right controls
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
    backgroundColor: '#DC2626',
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#DC2626',
  },
  viewToggleTextActive: {
    color: '#fff',
  },
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
    fontSize: 22,
    fontWeight: '600',
    color: '#DC2626',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: '#e5e5ea',
    marginHorizontal: 8,
  },
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
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FF3B30',
    position: 'absolute',
    top: 2,
  },
  compassSouth: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#8e8e93',
    position: 'absolute',
    bottom: 2,
  },
  layersIconWrap: { width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
  layerDiamond: {
    width: 16, height: 16, borderWidth: 2, borderColor: '#DC2626',
    backgroundColor: 'transparent', transform: [{ rotate: '45deg' }], position: 'absolute',
  },
  layerDiamond1: { top: 1 },
  layerDiamond2: { top: 6, width: 14, height: 14, borderColor: '#5AC8FA' },
  crosshairWrap: { width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
  crosshairRing: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#DC2626', position: 'absolute' },
  crosshairDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#DC2626', position: 'absolute' },
  crosshairLine: { position: 'absolute', backgroundColor: '#DC2626' },
  crosshairTop: { width: 2, height: 5, top: 0 },
  crosshairBottom: { width: 2, height: 5, bottom: 0 },
  crosshairLeft: { width: 5, height: 2, left: 0 },
  crosshairRight: { width: 5, height: 2, right: 0 },

  // Layer picker
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
  layerPickerBtnActive: { backgroundColor: '#DC2626' },
  layerPickerBtnText: { fontSize: 14, fontWeight: '600', color: '#3c3c43' },
  layerPickerBtnTextActive: { color: '#fff' },

  // View menu - bottom left floating button
  viewMenuContainer: {
    position: 'absolute',
    bottom: 30,
    left: 16,
    alignItems: 'flex-start',
  },
  viewMenuButtons: {
    marginBottom: 10,
    gap: 8,
  },
  viewMenuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 18,
    paddingVertical: 13,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    gap: 10,
    minWidth: 200,
  },
  viewMenuBtnActive: {
    backgroundColor: '#DC2626',
  },
  viewMenuBtnIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#EBF5FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewMenuBtnIconActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  viewMenuBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  viewMenuBtnTextActive: {
    color: '#fff',
  },
  clientCountBadge: {
    backgroundColor: '#DC2626',
    borderRadius: 11,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 7,
  },
  clientCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  viewMenuBadge: {
    backgroundColor: '#DC2626',
    borderRadius: 11,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 7,
  },
  viewMenuBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  // Multi-client icon (vue d'ensemble)
  multiClientIcon: {
    width: 22,
    height: 18,
    position: 'relative',
  },
  personHead: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DC2626',
    position: 'absolute',
  },
  personBody: {
    width: 10,
    height: 6,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    backgroundColor: '#DC2626',
    position: 'absolute',
  },

  // Moto delivery man icon
  motoDelivIcon: {
    width: 24,
    height: 18,
    position: 'relative',
  },
  motoRiderHead: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DC2626',
    position: 'absolute',
    left: 8,
    top: 0,
  },
  motoRiderBody: {
    width: 8,
    height: 5,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    backgroundColor: '#DC2626',
    position: 'absolute',
    left: 7,
    top: 6,
  },
  motoWheelL: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 2,
    borderColor: '#DC2626',
    position: 'absolute',
    left: 1,
    bottom: 0,
  },
  motoWheelR: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 2,
    borderColor: '#DC2626',
    position: 'absolute',
    right: 1,
    bottom: 0,
  },
  motoFrame: {
    width: 12,
    height: 2.5,
    backgroundColor: '#DC2626',
    borderRadius: 1,
    position: 'absolute',
    left: 6,
    bottom: 3,
  },

  // Main button - multi people icon
  viewMenuMainBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  viewMenuMainBtnOverview: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#000',
    shadowOpacity: 0.15,
  },
  viewMenuMainBtnDelivery: {
    backgroundColor: '#DC2626',
  },
  viewMenuMainBtnActive: {
    backgroundColor: '#0055CC',
  },
  multiPeopleMainIcon: {
    alignItems: 'center',
    gap: 1,
  },
  mainPersonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainPersonHead: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  mainPersonHeadActive: {
    backgroundColor: '#fff',
  },
  mainPersonBodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  mainPersonBodySmall: {
    width: 12,
    height: 7,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: '#fff',
  },
  mainPersonBodyActive: {
    backgroundColor: '#fff',
  },
  mainPersonHeadBlue: {
    backgroundColor: '#DC2626',
  },
  mainPersonBodyBlue: {
    backgroundColor: '#DC2626',
  },

  // Floating client list
  clientListContainer: {
    position: 'absolute',
    top: 78,
    left: 16,
    width: 280,
    maxHeight: '70%',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    overflow: 'hidden',
  },
  clientListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f7',
  },
  clientListTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    letterSpacing: -0.2,
  },
  clientListClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f2f2f7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientListCloseText: {
    color: '#8e8e93',
    fontSize: 14,
    fontWeight: '600',
  },
  clientListScroll: {
    maxHeight: 450,
  },
  clientListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f7',
    gap: 10,
  },
  clientListItemSelected: {
    backgroundColor: '#EBF5FF',
  },
  clientCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: '#d1d1d6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientCheckboxChecked: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  clientCheckmark: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  clientListInfo: {
    flex: 1,
  },
  clientListName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  clientListNameSelected: {
    color: '#DC2626',
  },
  clientListAddr: {
    fontSize: 12,
    color: '#8e8e93',
    marginTop: 2,
  },
  clientListLocateBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#f2f2f7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locateIcon: {
    alignItems: 'center',
  },
  locatePinHead: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2.5,
    borderColor: '#DC2626',
  },
  locatePinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#DC2626',
    marginTop: -2,
  },
  goToDeliveryBtn: {
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  goToDeliveryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Route banner
  routeBanner: {
    position: 'absolute',
    bottom: 100,
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
  routeInfoContent: { flex: 1 },
  routeDestination: { color: '#000', fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  routeDetails: { color: '#DC2626', fontSize: 14, fontWeight: '600', marginTop: 3 },
  routeCloseBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#f2f2f7',
    justifyContent: 'center', alignItems: 'center',
  },
  routeCloseBtnText: { color: '#8e8e93', fontSize: 16, fontWeight: '600' },

  // Markers
  markerOuter: { alignItems: 'center' },
  markerCircle: {
    width: 50, height: 50, borderRadius: 25, borderWidth: 3.5,
    borderColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 6,
  },
  markerPhoto: {
    width: 50, height: 50, borderRadius: 25, borderWidth: 3.5,
    borderColor: '#fff',
  },
  markerText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  markerArrow: {
    width: 0, height: 0,
    borderLeftWidth: 10, borderRightWidth: 10, borderTopWidth: 12,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -2,
  },

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
});
