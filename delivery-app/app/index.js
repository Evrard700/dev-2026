import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getAuthUser, logoutUser } from '../src/stores/storage';

export default function WelcomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getAuthUser().then((u) => {
      if (!u) {
        router.replace('/login');
      } else {
        setUser(u);
        // If user has a mode set from registration, redirect directly
        if (u.mode === 'moto') {
          router.replace('/moto');
          return;
        } else if (u.mode === 'b2b') {
          router.replace('/b2b');
          return;
        }
      }
      setChecking(false);
    });
  }, []);

  if (checking) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#4361ee" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.headerBg}>
        <View style={styles.headerContent}>
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <View style={styles.logoPin}>
                <View style={styles.logoPinHead} />
                <View style={styles.logoPinTail} />
              </View>
            </View>
          </View>
          <Text style={styles.title}>DelivTrack</Text>
          <Text style={styles.subtitle}>
            {user ? `Bienvenue, ${user.name}` : 'Votre assistant de livraison intelligent'}
          </Text>
        </View>
      </View>

      <View style={styles.cardsContainer}>
        {/* Moto Card */}
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.9}
          onPress={() => router.push('/moto')}
        >
          <View style={styles.cardGradient}>
            <View style={[styles.cardIconBg, { backgroundColor: '#4361ee' }]}>
              <View style={styles.motoIcon}>
                <View style={styles.motoBody} />
                <View style={styles.motoWheelLeft} />
                <View style={styles.motoWheelRight} />
                <View style={styles.motoHandle} />
              </View>
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Moto Livraison</Text>
              <Text style={styles.cardDescription}>
                Livraisons rapides avec suivi GPS, navigation 3D et gestion des commandes
              </Text>
              <View style={styles.cardFeatures}>
                <View style={styles.featureTag}>
                  <Text style={styles.featureTagText}>GPS</Text>
                </View>
                <View style={styles.featureTag}>
                  <Text style={styles.featureTagText}>3D</Text>
                </View>
                <View style={styles.featureTag}>
                  <Text style={styles.featureTagText}>Hors ligne</Text>
                </View>
              </View>
            </View>
            <View style={styles.cardArrow}>
              <Text style={styles.cardArrowText}>{'>'}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* B2B Card */}
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.9}
          onPress={() => router.push('/b2b')}
        >
          <View style={styles.cardGradient}>
            <View style={[styles.cardIconBg, { backgroundColor: '#1a73e8' }]}>
              <View style={styles.b2bIcon}>
                <View style={styles.b2bBox1} />
                <View style={styles.b2bBox2} />
                <View style={styles.b2bBox3} />
              </View>
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Gestion B2B</Text>
              <Text style={styles.cardDescription}>
                Vue d'ensemble des livraisons, gestion des clients et suivi professionnel
              </Text>
              <View style={styles.cardFeatures}>
                <View style={[styles.featureTag, { backgroundColor: '#e8f0fe' }]}>
                  <Text style={[styles.featureTagText, { color: '#1a73e8' }]}>Clients</Text>
                </View>
                <View style={[styles.featureTag, { backgroundColor: '#e8f0fe' }]}>
                  <Text style={[styles.featureTagText, { color: '#1a73e8' }]}>Stats</Text>
                </View>
                <View style={[styles.featureTag, { backgroundColor: '#e8f0fe' }]}>
                  <Text style={[styles.featureTagText, { color: '#1a73e8' }]}>Routes</Text>
                </View>
              </View>
            </View>
            <View style={styles.cardArrow}>
              <Text style={styles.cardArrowText}>{'>'}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity onPress={async () => { await logoutUser(); router.replace('/login'); }}>
          <Text style={styles.logoutText}>Deconnexion ({user?.email})</Text>
        </TouchableOpacity>
        <Text style={styles.footerSubtext}>DelivTrack v1.0.0 - Cote d'Ivoire</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f7',
  },
  headerBg: {
    backgroundColor: '#fff',
    paddingBottom: 30,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  headerContent: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? 50 : 60,
  },
  logoContainer: { marginBottom: 16 },
  logoCircle: {
    width: 76, height: 76, borderRadius: 22,
    backgroundColor: '#007AFF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#007AFF', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 10,
  },
  logoPin: { alignItems: 'center' },
  logoPinHead: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#fff', borderWidth: 5, borderColor: '#fff',
  },
  logoPinTail: {
    width: 0, height: 0,
    borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 12,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: '#fff', marginTop: -3,
  },
  title: { fontSize: 30, fontWeight: '700', color: '#000', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: '#8e8e93', marginTop: 6 },

  cardsContainer: { flex: 1, paddingHorizontal: 20, justifyContent: 'center', gap: 16 },
  card: {
    borderRadius: 22, backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 6, overflow: 'hidden',
  },
  cardGradient: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16 },
  cardIconBg: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  motoIcon: { width: 32, height: 24, justifyContent: 'center', alignItems: 'center' },
  motoBody: { width: 20, height: 8, backgroundColor: '#fff', borderRadius: 4, position: 'absolute' },
  motoWheelLeft: { width: 12, height: 12, borderRadius: 6, borderWidth: 2.5, borderColor: '#fff', position: 'absolute', left: 0, bottom: 0 },
  motoWheelRight: { width: 12, height: 12, borderRadius: 6, borderWidth: 2.5, borderColor: '#fff', position: 'absolute', right: 0, bottom: 0 },
  motoHandle: { width: 6, height: 10, backgroundColor: '#fff', borderRadius: 3, position: 'absolute', right: 3, top: 0 },
  b2bIcon: { width: 30, height: 28, justifyContent: 'center', alignItems: 'center' },
  b2bBox1: { width: 22, height: 14, borderWidth: 2.5, borderColor: '#fff', borderRadius: 3, position: 'absolute', top: 0 },
  b2bBox2: { width: 14, height: 10, borderWidth: 2.5, borderColor: '#fff', borderRadius: 2, position: 'absolute', bottom: 0, left: 0 },
  b2bBox3: { width: 14, height: 10, borderWidth: 2.5, borderColor: '#fff', borderRadius: 2, position: 'absolute', bottom: 0, right: 0 },

  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#000', marginBottom: 4, letterSpacing: -0.3 },
  cardDescription: { fontSize: 13, color: '#8e8e93', lineHeight: 18, marginBottom: 10 },
  cardFeatures: { flexDirection: 'row', gap: 6 },
  featureTag: { backgroundColor: '#EBF5FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  featureTagText: { fontSize: 11, fontWeight: '600', color: '#007AFF' },
  cardArrow: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center' },
  cardArrowText: { color: '#fff', fontSize: 18, fontWeight: '600' },

  footer: { alignItems: 'center', paddingBottom: 24, paddingTop: 10 },
  logoutText: { color: '#FF3B30', fontSize: 14, fontWeight: '600', marginBottom: 6 },
  footerSubtext: { color: '#aeaeb2', fontSize: 12 },
});
