import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  Dimensions,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import MapboxGL from '../utils/mapbox';
import {
  getAuthUser,
  logoutUser,
} from '../stores/storage';
import { getCurrentLocation } from '../utils/location';

const CITY_PRESETS = [
  { name: 'Abidjan', bounds: [[-4.12, 5.24], [-3.85, 5.45]], zoom: [8, 16] },
  { name: 'Bouake', bounds: [[-5.10, 7.64], [-4.95, 7.76]], zoom: [8, 16] },
  { name: 'Yamoussoukro', bounds: [[-5.35, 6.77], [-5.20, 6.88]], zoom: [8, 16] },
  { name: 'Ma position (30km)', bounds: null, zoom: [8, 16] },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PANEL_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 380);

export default function SettingsPanel({ visible, onClose, mode }) {
  const router = useRouter();
  const { themeMode, setThemeMode } = useTheme();
  const [slideAnim] = useState(new Animated.Value(PANEL_WIDTH));
  const [fadeAnim] = useState(new Animated.Value(0));

  const [user, setUser] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [offlinePack, setOfflinePack] = useState(null);
  const [selectedCity, setSelectedCity] = useState(0);

  useEffect(() => {
    if (visible) {
      getAuthUser().then(setUser);
      checkExistingPacks();
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: PANEL_WIDTH, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: PANEL_WIDTH, duration: 250, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  }, [onClose]);

  const checkExistingPacks = async () => {
    if (Platform.OS === 'web' || !MapboxGL) return;
    try {
      const packs = await MapboxGL.offlineManager.getPacks();
      if (packs && packs.length > 0) setOfflinePack(packs[0]);
    } catch (e) {}
  };

  const handleDownloadMap = useCallback(async () => {
    if (Platform.OS === 'web') {
      alert('Le telechargement hors ligne n\'est disponible que sur mobile.');
      return;
    }
    if (!MapboxGL) return;
    let bounds = CITY_PRESETS[selectedCity].bounds;
    if (!bounds) {
      try {
        const loc = await getCurrentLocation();
        const lng = loc.coords.longitude;
        const lat = loc.coords.latitude;
        const delta = 0.15;
        bounds = [[lng - delta, lat - delta], [lng + delta, lat + delta]];
      } catch (e) {
        Alert.alert('Erreur', 'Impossible de detecter votre position.');
        return;
      }
    }
    Alert.alert('Telecharger la carte', `Telecharger la carte de ${CITY_PRESETS[selectedCity].name} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Telecharger',
        onPress: async () => {
          setDownloading(true);
          setDownloadProgress(0);
          try {
            await MapboxGL.offlineManager.createPack({
              name: `offline-${CITY_PRESETS[selectedCity].name}`,
              styleURL: 'mapbox://styles/mapbox/streets-v12',
              minZoom: CITY_PRESETS[selectedCity].zoom[0],
              maxZoom: CITY_PRESETS[selectedCity].zoom[1],
              bounds,
            }, (_, status) => setDownloadProgress(status.percentage), (_, err) => {
              setDownloading(false);
              Alert.alert('Erreur', 'Erreur lors du telechargement.');
            });
            setDownloading(false);
            setDownloadProgress(100);
            Alert.alert('Succes', `Carte de ${CITY_PRESETS[selectedCity].name} telechargee.`);
            checkExistingPacks();
          } catch (e) {
            setDownloading(false);
            Alert.alert('Erreur', 'Impossible de telecharger la carte.');
          }
        },
      },
    ]);
  }, [selectedCity]);

  const handleDeleteOfflineMap = useCallback(async () => {
    Alert.alert('Supprimer', 'Supprimer la carte telechargee ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await MapboxGL.offlineManager.deletePack('offline-map');
            setOfflinePack(null);
            setDownloadProgress(0);
          } catch (e) {
            Alert.alert('Erreur', 'Impossible de supprimer.');
          }
        },
      },
    ]);
  }, []);

  const handleThemeChange = useCallback(async (m) => {
    await setThemeMode(m);
  }, [setThemeMode]);

  const handleLogout = useCallback(async () => {
    handleClose();
    await logoutUser();
    router.replace('/login');
  }, [handleClose, router]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />
        </Animated.View>
        <Animated.View style={[styles.panel, { transform: [{ translateX: slideAnim }] }]}>
          {/* Header with user info */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Text style={styles.closeBtnText}>{'<'}</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Parametres</Text>
          </View>

          {/* User profile card */}
          <View style={styles.profileCard}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {user?.name ? user.name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.name || 'Utilisateur'}</Text>
              <Text style={styles.profileEmail}>{user?.email || ''}</Text>
            </View>
            <View style={styles.modeBadge}>
              <Text style={styles.modeBadgeText}>{mode === 'moto' ? 'MOTO' : 'B2B'}</Text>
            </View>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Theme Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Apparence</Text>
              <View style={styles.themeGrid}>
                {[
                  { key: 'system', label: 'Auto', icon: 'A' },
                  { key: 'light', label: 'Jour', icon: 'J' },
                  { key: 'dark', label: 'Nuit', icon: 'N' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.themeBtn, themeMode === opt.key && styles.themeBtnActive]}
                    onPress={() => handleThemeChange(opt.key)}
                  >
                    <View style={[styles.themeIconCircle, themeMode === opt.key && styles.themeIconCircleActive]}>
                      <Text style={[styles.themeIconText, themeMode === opt.key && styles.themeIconTextActive]}>{opt.icon}</Text>
                    </View>
                    <Text style={[styles.themeBtnText, themeMode === opt.key && styles.themeBtnTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Offline Maps */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Carte hors ligne</Text>
              <View style={styles.cityGrid}>
                {CITY_PRESETS.map((city, i) => (
                  <TouchableOpacity
                    key={city.name}
                    style={[styles.cityBtn, selectedCity === i && styles.cityBtnActive]}
                    onPress={() => setSelectedCity(i)}
                  >
                    <Text style={[styles.cityBtnText, selectedCity === i && styles.cityBtnTextActive]}>
                      {city.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {downloading ? (
                <View style={styles.downloadingContainer}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <Text style={styles.downloadingText}>Telechargement... {Math.round(downloadProgress)}%</Text>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${downloadProgress}%` }]} />
                  </View>
                </View>
              ) : offlinePack || downloadProgress === 100 ? (
                <View>
                  <View style={styles.downloadedRow}>
                    <Text style={styles.downloadedText}>Carte telechargee</Text>
                  </View>
                  <TouchableOpacity style={styles.deleteMapBtn} onPress={handleDeleteOfflineMap}>
                    <Text style={styles.deleteMapBtnText}>Supprimer</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.actionBtn} onPress={handleDownloadMap}>
                  <Text style={styles.actionBtnText}>Telecharger la carte</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* App info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>A propos</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Version</Text>
                <Text style={styles.infoValue}>1.0.0</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Carte</Text>
                <Text style={styles.infoValue}>Mapbox</Text>
              </View>
            </View>

            {/* Logout */}
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutBtnText}>Deconnexion</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  panel: {
    width: PANEL_WIDTH,
    height: '100%',
    backgroundColor: '#f2f2f7',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? 20 : 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    gap: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f2f2f7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#007AFF',
    fontSize: 20,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    letterSpacing: -0.3,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5ea',
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
  profileEmail: {
    fontSize: 13,
    color: '#8e8e93',
    marginTop: 2,
  },
  modeBadge: {
    backgroundColor: '#EBF5FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#007AFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 14,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  themeGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  themeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#f2f2f7',
    gap: 6,
  },
  themeBtnActive: {
    backgroundColor: '#007AFF',
  },
  themeIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e5ea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeIconCircleActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  themeIconText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8e8e93',
  },
  themeIconTextActive: {
    color: '#fff',
  },
  themeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8e8e93',
  },
  themeBtnTextActive: {
    color: '#fff',
  },
  cityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  cityBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f2f2f7',
  },
  cityBtnActive: {
    backgroundColor: '#007AFF',
  },
  cityBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8e8e93',
  },
  cityBtnTextActive: {
    color: '#fff',
  },
  downloadingContainer: {
    alignItems: 'center',
    gap: 8,
  },
  downloadingText: {
    color: '#000',
    fontSize: 14,
  },
  progressBar: {
    width: '100%',
    height: 5,
    backgroundColor: '#e5e5ea',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 3,
  },
  downloadedRow: {
    alignItems: 'center',
    marginBottom: 10,
  },
  downloadedText: {
    color: '#34c759',
    fontSize: 15,
    fontWeight: '600',
  },
  deleteMapBtn: {
    backgroundColor: '#FFF2F2',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  deleteMapBtnText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
  emailInput: {
    backgroundColor: '#f2f2f7',
    borderRadius: 12,
    padding: 13,
    fontSize: 15,
    color: '#000',
    marginBottom: 10,
  },
  actionBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  sharesContainer: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f2f2f7',
    paddingTop: 12,
  },
  sharesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  shareItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f7',
    borderRadius: 12,
    padding: 10,
    marginBottom: 6,
  },
  shareItemInfo: { flex: 1 },
  shareItemName: { fontSize: 14, fontWeight: '700', color: '#000' },
  shareItemEmail: { fontSize: 12, color: '#8e8e93', marginTop: 1 },
  importBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  importBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  clearBtn: {
    backgroundColor: '#FFF2F2',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  clearBtnText: { color: '#FF3B30', fontSize: 13, fontWeight: '600' },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f7',
  },
  infoLabel: { color: '#8e8e93', fontSize: 14 },
  infoValue: { color: '#000', fontSize: 14, fontWeight: '600' },
  logoutBtn: {
    backgroundColor: '#FFF2F2',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 14,
  },
  logoutBtnText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '700',
  },
});
