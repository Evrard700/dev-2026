import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  Dimensions,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
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
import OrderCard from '../src/components/OrderCard';
import FloatingButton from '../src/components/FloatingButton';
import GlassCard from '../src/components/GlassCard';
import GlassButton from '../src/components/GlassButton';
import ClientFormModal from '../src/components/ClientFormModal.glass';
import { colors, spacing } from '../src/styles/glassmorphism';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function MotoGlassScreen() {
  const router = useRouter();
  const [clients, setClients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showClientForm, setShowClientForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState('clients'); // 'clients' or 'orders'

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadData();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
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

  const handleAddClient = useCallback(async (formData) => {
    try {
      const coord = formData.coordinate || [0, 0];
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
    } catch (error) {
      console.error('Error adding client:', error);
      if (Platform.OS === 'web') {
        alert('Erreur: ' + error.message);
      } else {
        Alert.alert('Erreur', error.message);
      }
    }
  }, []);

  const handleDeleteClient = useCallback(async (clientId) => {
    try {
      await deleteMotoClient(clientId);
      await loadData();
      setSelectedClient(null);
    } catch (error) {
      console.error('Error deleting client:', error);
    }
  }, []);

  const handleToggleOrder = useCallback(async (orderId) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (order) {
        await updateMotoOrder(orderId, { checked: !order.checked });
        await loadData();
      }
    } catch (error) {
      console.error('Error toggling order:', error);
    }
  }, [orders]);

  const handleDeleteOrder = useCallback(async (orderId) => {
    try {
      await deleteMotoOrder(orderId);
      await loadData();
    } catch (error) {
      console.error('Error deleting order:', error);
    }
  }, []);

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

  const getClientOrders = (clientId) => {
    return orders.filter(o => o.clientId === clientId);
  };

  const deliveredCount = orders.filter(o => o.checked).length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.bgGradient}>
          <View style={[styles.gradientOrb, styles.orb1]} />
          <View style={[styles.gradientOrb, styles.orb2]} />
        </View>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Background gradient */}
      <View style={styles.bgGradient}>
        <View style={[styles.gradientOrb, styles.orb1]} />
        <View style={[styles.gradientOrb, styles.orb2]} />
        <View style={[styles.gradientOrb, styles.orb3]} />
      </View>

      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {/* Header */}
          <MotoHeader
            clientCount={clients.length}
            orderCount={orders.length}
            deliveredCount={deliveredCount}
            onSettingsPress={() => setShowSettings(!showSettings)}
          />

          {/* View Toggle */}
          <View style={styles.toggleContainer}>
            <GlassCard style={styles.toggle}>
              <TouchableOpacity
                style={[styles.toggleBtn, viewMode === 'clients' && styles.toggleBtnActive]}
                onPress={() => setViewMode('clients')}
                activeOpacity={0.7}
              >
                <Text style={[styles.toggleText, viewMode === 'clients' && styles.toggleTextActive]}>
                  👤 Clients ({clients.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, viewMode === 'orders' && styles.toggleBtnActive]}
                onPress={() => setViewMode('orders')}
                activeOpacity={0.7}
              >
                <Text style={[styles.toggleText, viewMode === 'orders' && styles.toggleTextActive]}>
                  📦 Commandes ({orders.length})
                </Text>
              </TouchableOpacity>
            </GlassCard>
          </View>

          {/* Content */}
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {viewMode === 'clients' ? (
              // Clients List
              <>
                {clients.length === 0 ? (
                  <GlassCard style={styles.emptyCard}>
                    <Text style={styles.emptyIcon}>👤</Text>
                    <Text style={styles.emptyTitle}>Aucun client</Text>
                    <Text style={styles.emptyText}>
                      Appuyez sur + pour ajouter votre premier client
                    </Text>
                  </GlassCard>
                ) : (
                  clients.map((client) => (
                    <ClientCard
                      key={client.id}
                      client={client}
                      hasOrders={getClientOrders(client.id).length > 0}
                      onPress={() => setSelectedClient(client)}
                    />
                  ))
                )}
              </>
            ) : (
              // Orders List
              <>
                {orders.length === 0 ? (
                  <GlassCard style={styles.emptyCard}>
                    <Text style={styles.emptyIcon}>📦</Text>
                    <Text style={styles.emptyTitle}>Aucune commande</Text>
                    <Text style={styles.emptyText}>
                      Sélectionnez un client pour ajouter une commande
                    </Text>
                  </GlassCard>
                ) : (
                  orders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onToggle={() => handleToggleOrder(order.id)}
                      onDelete={() => handleDeleteOrder(order.id)}
                    />
                  ))
                )}
              </>
            )}

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Floating Add Button */}
          <FloatingButton
            icon="+"
            onPress={() => setShowClientForm(true)}
            style={styles.floatingBtn}
          />

          {/* Settings Panel */}
          {showSettings && (
            <View style={styles.settingsOverlay}>
              <TouchableOpacity 
                style={styles.settingsBackdrop}
                onPress={() => setShowSettings(false)}
                activeOpacity={1}
              />
              <GlassCard style={styles.settingsPanel}>
                <Text style={styles.settingsTitle}>Paramètres</Text>
                <GlassButton
                  variant="glass"
                  onPress={handleLogout}
                  style={styles.settingsBtn}
                >
                  🚪 Déconnexion
                </GlassButton>
              </GlassCard>
            </View>
          )}

          {/* Client Detail Modal */}
          {selectedClient && (
            <View style={styles.modalOverlay}>
              <TouchableOpacity 
                style={styles.modalBackdrop}
                onPress={() => setSelectedClient(null)}
                activeOpacity={1}
              />
              <GlassCard style={styles.modal}>
                <Text style={styles.modalTitle}>{selectedClient.nom}</Text>
                <Text style={styles.modalInfo}>📱 {selectedClient.numero}</Text>
                <Text style={styles.modalInfo}>📍 {selectedClient.adresse}</Text>
                
                <View style={styles.modalDivider} />
                
                <Text style={styles.modalSubtitle}>
                  Commandes ({getClientOrders(selectedClient.id).length})
                </Text>
                
                {getClientOrders(selectedClient.id).map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onToggle={() => handleToggleOrder(order.id)}
                    onDelete={() => handleDeleteOrder(order.id)}
                  />
                ))}

                <GlassButton
                  variant="primary"
                  onPress={() => setSelectedClient(null)}
                  style={styles.modalCloseBtn}
                >
                  Fermer
                </GlassButton>
              </GlassCard>
            </View>
          )}

          {/* Client Form Modal */}
          <ClientFormModal
            visible={showClientForm}
            onClose={() => setShowClientForm(false)}
            onSubmit={handleAddClient}
            coordinate={[0, 0]}
            showGoogleLink={true}
          />
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgGradientStart,
  },
  bgGradient: {
    position: 'absolute',
    width: SCREEN_W,
    height: SCREEN_H,
    overflow: 'hidden',
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
  orb3: {
    width: 200,
    height: 200,
    backgroundColor: '#3B82F6',
    top: SCREEN_H * 0.5,
    right: -50,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bgGradientStart,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  toggleContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  toggle: {
    flexDirection: 'row',
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  emptyCard: {
    marginHorizontal: spacing.md,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  floatingBtn: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
  },
  settingsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  settingsBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
  },
  settingsPanel: {
    position: 'absolute',
    top: 80,
    right: spacing.md,
    minWidth: 200,
    padding: spacing.md,
  },
  settingsTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  settingsBtn: {
    marginTop: spacing.sm,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
  },
  modal: {
    width: SCREEN_W * 0.9,
    maxHeight: SCREEN_H * 0.8,
    padding: spacing.lg,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  modalInfo: {
    color: colors.textSecondary,
    fontSize: 16,
    marginBottom: spacing.xs,
  },
  modalDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: spacing.md,
  },
  modalSubtitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  modalCloseBtn: {
    marginTop: spacing.md,
  },
});
