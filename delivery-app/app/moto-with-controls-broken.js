import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Alert,
  Dimensions,
  Animated,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { parseGoogleMapsUrl } from '../src/utils/mapbox';
import { getCurrentLocation, watchLocation } from '../src/utils/location';
import {
  getMotoClients,
  addMotoClient,
  deleteMotoClient,
  getMotoOrders,
  addMotoOrder,
  updateMotoOrder,
  deleteMotoOrder,
  logoutUser,
} from '../src/stores/storage';
import MotoHeader from '../src/components/MotoHeader';
import ClientCard from '../src/components/ClientCard';
import FloatingButton from '../src/components/FloatingButton';
import GlassCard from '../src/components/GlassCard';
import GlassButton from '../src/components/GlassButton';
import ClientFormModal from '../src/components/ClientFormModal.glass';
import MotoClientPopup from '../src/components/MotoClientPopup';
import { 
  MapStyleButton, 
  PositionButton, 
  ZoomControls, 
  CompassButton 
} from '../src/components/MapControls';
import { colors, spacing } from '../src/styles/glassmorphism';

let MapboxGL, WebMapView;
if (Platform.OS === 'web') {
  WebMapView = require('../src/components/map/MapView.web').default;
} else {
  MapboxGL = require('@rnmapbox/maps').default;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function MotoWithMapScreen() {
  const router = useRouter();
  const mapRef = useRef(null);
  const cameraRef = useRef(null);

  const [userLocation, setUserLocation] = useState(null);
  const userLocationRef = useRef(null);
  const [clients, setClients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedCoord, setSelectedCoord] = useState(null);
  const [showClientForm, setShowClientForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showClientPopup, setShowClientPopup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showClientsList, setShowClientsList] = useState(false);
  const [mapStyle, setMapStyle] = useState('mapbox://styles/mapbox/streets-v12');
  const [mapZoom, setMapZoom] = useState(14);
  const [mapBearing, setMapBearing] = useState(0);
  
  const MAP_STYLES = [
    { id: 'streets', label: 'Standard', url: 'mapbox://styles/mapbox/streets-v12' },
    { id: 'satellite', label: 'Satellite', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
    { id: 'nav', label: 'Navigation', url: 'mapbox://styles/mapbox/navigation-day-v1' },
    { id: '3d', label: '3D', url: 'mapbox://styles/mapbox/outdoors-v12' },
  ];

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const clientsListAnim = useRef(new Animated.Value(-SCREEN_W * 0.8)).current;

  useEffect(() => {
    loadData();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  // Get location
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
        // Default to Abidjan
        const defaultLoc = [-4.0083, 5.3600];
        if (mounted) {
          userLocationRef.current = defaultLoc;
          setUserLocation(defaultLoc);
        }
      }
    })();

    const sub = watchLocation((loc) => {
      const newLoc = [loc.coords.longitude, loc.coords.latitude];
      userLocationRef.current = newLoc;
      setUserLocation(newLoc);
    });

    return () => {
      mounted = false;
      if (sub) sub.remove();
    };
  }, []);

  const loadData = async () => {
    try {
      const [clientsData, ordersData] = await Promise.all([
        getMotoClients(),
        getMotoOrders(),
      ]);
      setClients(clientsData);
      setOrders(ordersData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMapPress = useCallback((e) => {
    if (Platform.OS === 'web') {
      if (e && e.lngLat) {
        setSelectedCoord([e.lngLat.lng, e.lngLat.lat]);
        setShowClientForm(true);
      }
    } else {
      if (e && e.geometry && e.geometry.coordinates) {
        setSelectedCoord(e.geometry.coordinates);
        setShowClientForm(true);
      }
    }
  }, []);

  const handleAddClient = useCallback(async (formData) => {
    try {
      let coord = formData.coordinate || selectedCoord || [0, 0];
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
      await addMotoClient(newClient);
      await loadData();
      setShowClientForm(false);
      setSelectedCoord(null);
    } catch (error) {
      console.error('Error adding client:', error);
      if (Platform.OS === 'web') {
        alert('Erreur: ' + error.message);
      } else {
        Alert.alert('Erreur', error.message);
      }
    }
  }, [selectedCoord]);

  const handleDeleteClient = useCallback(async (clientId) => {
    try {
      await deleteMotoClient(clientId);
      await loadData();
      setSelectedClient(null);
      setShowClientPopup(false);
    } catch (error) {
      console.error('Error deleting client:', error);
    }
  }, []);

  const handleAddOrder = useCallback(async (clientId, orderData) => {
    try {
      const client = clients.find(c => c.id === clientId);
      if (!client) throw new Error('Client introuvable');
      
      const newOrder = {
        id: Date.now().toString(),
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
      await addMotoOrder(newOrder);
      await loadData();
    } catch (error) {
      console.error('Error adding order:', error);
      if (Platform.OS === 'web') {
        alert('Erreur: ' + error.message);
      } else {
        Alert.alert('Erreur', error.message);
      }
    }
  }, [clients]);

  const toggleClientsList = () => {
    const toValue = showClientsList ? -SCREEN_W * 0.8 : 0;
    Animated.spring(clientsListAnim, {
      toValue,
      useNativeDriver: true,
      damping: 20,
      stiffness: 100,
    }).start();
    setShowClientsList(!showClientsList);
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
        await logoutUser();
        router.replace('/login');
      }
    } else {
      Alert.alert(
        'Déconnexion',
        'Voulez-vous vraiment vous déconnecter ?',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Déconnexion',
            style: 'destructive',
            onPress: async () => {
              await logoutUser();
              router.replace('/login');
            },
          },
        ]
      );
    }
  };

  const deliveredCount = orders.filter(o => o.checked).length;

  const handleChangeMapStyle = () => {
    const currentIndex = MAP_STYLES.findIndex(s => s.url === mapStyle);
    const nextIndex = (currentIndex + 1) % MAP_STYLES.length;
    setMapStyle(MAP_STYLES[nextIndex].url);
  };

  const handleCenterOnUser = () => {
    if (userLocation && mapRef.current) {
      // Center map on user location
      if (Platform.OS === 'web') {
        mapRef.current.flyTo({
          center: userLocation,
          zoom: 15,
          duration: 1000,
        });
      } else if (cameraRef.current) {
        cameraRef.current.setCamera({
          centerCoordinate: userLocation,
          zoomLevel: 15,
          animationDuration: 1000,
        });
      }
    }
  };

  const handleZoomIn = () => {
    setMapZoom(prev => Math.min(prev + 1, 20));
  };

  const handleZoomOut = () => {
    setMapZoom(prev => Math.max(prev - 1, 1));
  };

  const handleResetBearing = () => {
    setMapBearing(0);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.bgGradient}>
          <View style={[styles.gradientOrb, styles.orb1]} />
          <View style={[styles.gradientOrb, styles.orb2]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Mapbox Map */}
      <View style={styles.mapContainer}>
        {Platform.OS === 'web' ? (
          <WebMapView
            userLocation={userLocation}
            clients={clients}
            onMapPress={handleMapPress}
            onClientPress={(client) => {
              setSelectedClient(client);
              setShowClientPopup(true);
            }}
          />
        ) : (
          MapboxGL && userLocation && (
            <MapboxGL.MapView
              ref={mapRef}
              style={styles.map}
              styleURL={mapStyle}
              onPress={handleMapPress}
            >
              <MapboxGL.Camera
                ref={cameraRef}
                zoomLevel={mapZoom}
                centerCoordinate={userLocation}
                heading={mapBearing}
                animationMode="flyTo"
              />
              {userLocation && (
                <MapboxGL.PointAnnotation
                  id="user-location"
                  coordinate={userLocation}
                >
                  <View style={styles.userMarker}>
                    <View style={styles.userMarkerDot} />
                  </View>
                </MapboxGL.PointAnnotation>
              )}
              {clients.map((client) => (
                <MapboxGL.PointAnnotation
                  key={client.id}
                  id={client.id}
                  coordinate={[client.longitude, client.latitude]}
                  onSelected={() => {
                    setSelectedClient(client);
                    setShowClientPopup(true);
                  }}
                >
                  <View style={styles.clientMarker}>
                    <View style={styles.clientMarkerInner} />
                  </View>
                </MapboxGL.PointAnnotation>
              ))}
            </MapboxGL.MapView>
          )
        )}
      </View>

      {/* UI Overlays */}
      <SafeAreaView style={styles.overlays}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {/* Header */}
          <MotoHeader
            clientCount={clients.length}
            orderCount={orders.length}
            deliveredCount={deliveredCount}
            onSettingsPress={() => setShowSettings(!showSettings)}
          />

          {/* Map Controls */}
          <MapStyleButton
            currentStyle={MAP_STYLES.find(s => s.url === mapStyle)?.id || 'streets'}
            onPress={handleChangeMapStyle}
            style={styles.mapStyleBtn}
          />

          <PositionButton
            onPress={handleCenterOnUser}
            style={styles.positionBtn}
          />

          <ZoomControls
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            style={styles.zoomControls}
          />

          <CompassButton
            bearing={mapBearing}
            onPress={handleResetBearing}
            style={styles.compassBtn}
          />

          {/* Floating Add Button */}
          <FloatingButton
            icon="+"
            onPress={() => setShowClientForm(true)}
            style={styles.floatingAddBtn}
          />

          {/* Floating List Button */}
          <FloatingButton
            icon="☰"
            onPress={toggleClientsList}
            style={styles.floatingListBtn}
          />

          {/* Clients List Sidebar */}
          <Animated.View 
            style={[
              styles.clientsSidebar,
              { transform: [{ translateX: clientsListAnim }] }
            ]}
          >
            <GlassCard style={styles.sidebarCard}>
              {clients.map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  hasOrders={orders.some(o => o.clientId === client.id)}
                  onPress={() => {
                    setSelectedClient(client);
                    setShowClientPopup(true);
                    toggleClientsList();
                  }}
                />
              ))}
            </GlassCard>
          </Animated.View>

          {/* Settings Panel */}
          {showSettings && (
            <View style={styles.settingsOverlay}>
              <GlassCard style={styles.settingsPanel}>
                <GlassButton
                  variant="glass"
                  onPress={handleLogout}
                >
                  🚪 Déconnexion
                </GlassButton>
              </GlassCard>
            </View>
          )}
        </Animated.View>
      </SafeAreaView>

      {/* Client Form Modal */}
      <ClientFormModal
        visible={showClientForm}
        onClose={() => {
          setShowClientForm(false);
          setSelectedCoord(null);
        }}
        onSubmit={handleAddClient}
        coordinate={selectedCoord}
        showGoogleLink={true}
      />

      {/* Client Detail Popup */}
      <MotoClientPopup
        visible={showClientPopup}
        client={selectedClient}
        orders={selectedClient ? orders.filter(o => o.clientId === selectedClient.id) : []}
        onClose={() => {
          setShowClientPopup(false);
          setSelectedClient(null);
        }}
        onDeleteClient={handleDeleteClient}
        onAddOrder={handleAddOrder}
        onToggleOrder={async (orderId) => {
          const order = orders.find(o => o.id === orderId);
          if (order) {
            await updateMotoOrder(orderId, { checked: !order.checked });
            await loadData();
          }
        }}
        onDeleteOrder={async (orderId) => {
          await deleteMotoOrder(orderId);
          await loadData();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgGradientStart,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bgGradientStart,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgGradient: {
    position: 'absolute',
    width: SCREEN_W,
    height: SCREEN_H,
  },
  gradientOrb: {
    position: 'absolute',
    borderRadius: 9999,
    opacity: 0.3,
  },
  orb1: {
    width: 300,
    height: 300,
    backgroundColor: colors.primary,
    top: -100,
    right: -100,
  },
  orb2: {
    width: 250,
    height: 250,
    backgroundColor: '#DC26F5',
    bottom: -80,
    left: -80,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  overlays: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'box-none',
  },
  content: {
    flex: 1,
    pointerEvents: 'box-none',
  },
  floatingAddBtn: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
    pointerEvents: 'auto',
  },
  floatingListBtn: {
    position: 'absolute',
    bottom: spacing.xl + 80,
    right: spacing.lg,
    pointerEvents: 'auto',
  },
  mapStyleBtn: {
    position: 'absolute',
    top: 100,
    right: spacing.lg,
    pointerEvents: 'auto',
  },
  positionBtn: {
    position: 'absolute',
    top: 160,
    right: spacing.lg,
    pointerEvents: 'auto',
  },
  zoomControls: {
    position: 'absolute',
    bottom: spacing.xl + 160,
    right: spacing.lg,
    pointerEvents: 'auto',
  },
  compassBtn: {
    position: 'absolute',
    top: 220,
    right: spacing.lg,
    pointerEvents: 'auto',
  },
  clientsSidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SCREEN_W * 0.8,
    pointerEvents: 'auto',
  },
  sidebarCard: {
    flex: 1,
    margin: spacing.md,
    padding: spacing.sm,
  },
  settingsOverlay: {
    position: 'absolute',
    top: 80,
    right: spacing.md,
    pointerEvents: 'auto',
  },
  settingsPanel: {
    padding: spacing.md,
    minWidth: 200,
  },
  userMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.textPrimary,
  },
  userMarkerDot: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  clientMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientMarkerInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.textPrimary,
  },
});
