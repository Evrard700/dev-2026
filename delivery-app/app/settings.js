import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MapboxGL from '../src/utils/mapbox';
import { useTheme } from '../src/contexts/ThemeContext';
import { getCurrentLocation } from '../src/utils/location';

// City presets for offline download
const CITY_PRESETS = [
  { name: 'Abidjan', bounds: [[-4.12, 5.24], [-3.85, 5.45]], zoom: [8, 16] },
  { name: 'Bouake', bounds: [[-5.10, 7.64], [-4.95, 7.76]], zoom: [8, 16] },
  { name: 'Yamoussoukro', bounds: [[-5.35, 6.77], [-5.20, 6.88]], zoom: [8, 16] },
  { name: 'Ma position (30km)', bounds: null, zoom: [8, 16] },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams();
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [offlinePack, setOfflinePack] = useState(null);
  const [selectedCity, setSelectedCity] = useState(0);
  const { themeMode, setThemeMode } = useTheme();

  useEffect(() => {
    checkExistingPacks();
  }, []);

  const checkExistingPacks = async () => {
    if (Platform.OS === 'web' || !MapboxGL) return;
    try {
      const packs = await MapboxGL.offlineManager.getPacks();
      if (packs && packs.length > 0) {
        setOfflinePack(packs[0]);
      }
    } catch (e) {
      console.log('No offline packs found');
    }
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

    Alert.alert(
      'Telecharger la carte',
      `Telecharger la carte de ${CITY_PRESETS[selectedCity].name} pour une utilisation hors ligne ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Telecharger',
          onPress: async () => {
            setDownloading(true);
            setDownloadProgress(0);
            try {
              const progressListener = (offlinePack, status) => {
                setDownloadProgress(status.percentage);
              };
              const errorListener = (offlinePack, err) => {
                console.error('Download error:', err);
                setDownloading(false);
                Alert.alert('Erreur', 'Erreur lors du telechargement de la carte.');
              };
              await MapboxGL.offlineManager.createPack(
                {
                  name: `offline-${CITY_PRESETS[selectedCity].name}`,
                  styleURL: 'mapbox://styles/mapbox/streets-v12',
                  minZoom: CITY_PRESETS[selectedCity].zoom[0],
                  maxZoom: CITY_PRESETS[selectedCity].zoom[1],
                  bounds,
                },
                progressListener,
                errorListener
              );
              setDownloading(false);
              setDownloadProgress(100);
              Alert.alert('Succes', `La carte de ${CITY_PRESETS[selectedCity].name} a ete telechargee.`);
              checkExistingPacks();
            } catch (e) {
              console.error('Download failed:', e);
              setDownloading(false);
              Alert.alert('Erreur', 'Impossible de telecharger la carte.');
            }
          },
        },
      ]
    );
  }, [selectedCity]);

  const handleDeleteOfflineMap = useCallback(async () => {
    Alert.alert(
      'Supprimer la carte hors ligne',
      'Voulez-vous supprimer la carte telechargee ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await MapboxGL.offlineManager.deletePack('offline-map');
              setOfflinePack(null);
              setDownloadProgress(0);
              Alert.alert('Succes', 'Carte hors ligne supprimee.');
            } catch (e) {
              Alert.alert('Erreur', 'Impossible de supprimer la carte.');
            }
          },
        },
      ]
    );
  }, []);

  const handleThemeChange = useCallback(async (m) => {
    await setThemeMode(m);
  }, [setThemeMode]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Parametres</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Mode indicator */}
        <View style={styles.modeIndicator}>
          <Text style={styles.modeText}>
            {mode === 'moto' ? 'Moto Livraison' : 'Livraison B2B'}
          </Text>
        </View>

        {/* Theme Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Apparence</Text>
          <Text style={styles.sectionDescription}>
            Le mode s'adapte automatiquement au theme de votre telephone
          </Text>
          <View style={styles.themeGrid}>
            {[
              { key: 'system', label: 'Automatique' },
              { key: 'light', label: 'Jour' },
              { key: 'dark', label: 'Nuit' },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.themeBtn, themeMode === opt.key && styles.themeBtnActive]}
                onPress={() => handleThemeChange(opt.key)}
              >
                <Text style={[styles.themeBtnText, themeMode === opt.key && styles.themeBtnTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Offline Maps Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Carte hors ligne</Text>
          <Text style={styles.sectionDescription}>
            Telechargez la carte de votre ville pour l'utiliser sans internet
          </Text>

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
              <Text style={styles.downloadingText}>
                Telechargement... {Math.round(downloadProgress)}%
              </Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${downloadProgress}%` }]} />
              </View>
            </View>
          ) : offlinePack || downloadProgress === 100 ? (
            <View>
              <View style={styles.downloadedContainer}>
                <Text style={styles.downloadedText}>Carte telechargee</Text>
              </View>
              <TouchableOpacity style={styles.deleteMapBtn} onPress={handleDeleteOfflineMap}>
                <Text style={styles.deleteMapBtnText}>Supprimer la carte hors ligne</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.downloadBtn} onPress={handleDownloadMap}>
              <Text style={styles.downloadBtnText}>Telecharger la carte</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* App Info */}
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

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8ee',
    backgroundColor: '#ffffff',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    color: '#1a1a2e',
    fontSize: 20,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#1a1a2e',
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  modeIndicator: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8e8ee',
  },
  modeText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#e8e8ee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    color: '#1a1a2e',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  sectionDescription: {
    color: '#888',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  themeGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  themeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f5f5f8',
    borderWidth: 1,
    borderColor: '#e8e8ee',
    alignItems: 'center',
  },
  themeBtnActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  themeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
  },
  themeBtnTextActive: {
    color: '#fff',
  },
  cityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  cityBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#f5f5f8',
    borderWidth: 1,
    borderColor: '#e8e8ee',
  },
  cityBtnActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  cityBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  cityBtnTextActive: {
    color: '#fff',
  },
  downloadBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  downloadBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  downloadingContainer: {
    alignItems: 'center',
    gap: 10,
  },
  downloadingText: {
    color: '#1a1a2e',
    fontSize: 15,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#e8e8ee',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 3,
  },
  downloadedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  downloadedText: {
    color: '#2ecc71',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteMapBtn: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  deleteMapBtnText: {
    color: '#e74c3c',
    fontSize: 15,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f5',
  },
  infoLabel: {
    color: '#888',
    fontSize: 15,
  },
  infoValue: {
    color: '#1a1a2e',
    fontSize: 15,
    fontWeight: '600',
  },
});
