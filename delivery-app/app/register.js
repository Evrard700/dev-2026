import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { registerUser } from '../src/stores/storage';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function RegisterScreen() {
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState('moto');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
  const [transitionMode, setTransitionMode] = useState('moto');

  // Welcome animations
  const welcomeFade = useRef(new Animated.Value(0)).current;
  const welcomeSlide = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const sparkle1 = useRef(new Animated.Value(0)).current;
  const sparkle2 = useRef(new Animated.Value(0)).current;
  const sparkle3 = useRef(new Animated.Value(0)).current;
  const formFade = useRef(new Animated.Value(0)).current;
  const formSlide = useRef(new Animated.Value(40)).current;

  // Transition animation refs
  const transOverlay = useRef(new Animated.Value(0)).current;
  const transVehicle = useRef(new Animated.Value(-SCREEN_W)).current;
  const transScale = useRef(new Animated.Value(0.5)).current;
  const transText = useRef(new Animated.Value(0)).current;
  const transPulse = useRef(new Animated.Value(1)).current;
  const transTrail1 = useRef(new Animated.Value(0)).current;
  const transTrail2 = useRef(new Animated.Value(0)).current;
  const transTrail3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Staggered entrance animation
    Animated.sequence([
      // Logo bounces in
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
        Animated.timing(logoRotate, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
      // Sparkles appear
      Animated.stagger(150, [
        Animated.spring(sparkle1, { toValue: 1, friction: 5, useNativeDriver: true }),
        Animated.spring(sparkle2, { toValue: 1, friction: 5, useNativeDriver: true }),
        Animated.spring(sparkle3, { toValue: 1, friction: 5, useNativeDriver: true }),
      ]),
      // Welcome text fades in
      Animated.parallel([
        Animated.timing(welcomeFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(welcomeSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      // Form slides up
      Animated.parallel([
        Animated.timing(formFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(formSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const logoSpin = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleRegister = async () => {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Veuillez remplir tous les champs.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caracteres.');
      return;
    }
    setLoading(true);
    const result = await registerUser(email.trim(), password, email.trim().split('@')[0], selectedMode);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      const userMode = result.user?.mode || selectedMode;
      setTransitionMode(userMode);
      setShowTransition(true);
      playTransitionAnimation(userMode);
    }
  };

  const playTransitionAnimation = (mode) => {
    // Reset values
    transOverlay.setValue(0);
    transVehicle.setValue(-SCREEN_W);
    transScale.setValue(0.5);
    transText.setValue(0);
    transPulse.setValue(1);
    transTrail1.setValue(0);
    transTrail2.setValue(0);
    transTrail3.setValue(0);

    Animated.sequence([
      // Overlay fades in
      Animated.timing(transOverlay, { toValue: 1, duration: 300, useNativeDriver: true }),
      // Vehicle enters from left
      Animated.parallel([
        Animated.spring(transVehicle, { toValue: 0, friction: 6, tension: 40, useNativeDriver: true }),
        Animated.spring(transScale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
      ]),
      // Speed trails appear
      Animated.stagger(100, [
        Animated.timing(transTrail1, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(transTrail2, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(transTrail3, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      // Text appears
      Animated.spring(transText, { toValue: 1, friction: 5, useNativeDriver: true }),
      // Pulse effect
      Animated.sequence([
        Animated.timing(transPulse, { toValue: 1.15, duration: 300, useNativeDriver: true }),
        Animated.timing(transPulse, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      // Hold
      Animated.delay(600),
      // Vehicle exits right
      Animated.timing(transVehicle, { toValue: SCREEN_W * 1.5, duration: 500, useNativeDriver: true }),
      Animated.delay(200),
    ]).start(() => {
      router.replace(mode === 'b2b' ? '/b2b' : '/moto');
    });
  };

  const renderTransition = () => {
    if (!showTransition) return null;

    const isMoto = transitionMode === 'moto';
    const primaryColor = isMoto ? '#007AFF' : '#FF9500';
    const secondaryColor = isMoto ? '#5AC8FA' : '#FFCC02';
    const label = isMoto ? 'MOTO LIVRAISON' : 'GESTION B2B';
    const subLabel = isMoto ? 'Pret a livrer !' : 'Gerez vos livraisons !';

    return (
      <Animated.View style={[styles.transOverlay, { opacity: transOverlay }]}>
        {/* Background gradient circles */}
        <View style={[styles.transBgCircle1, { backgroundColor: primaryColor + '15' }]} />
        <View style={[styles.transBgCircle2, { backgroundColor: secondaryColor + '10' }]} />
        <View style={[styles.transBgCircle3, { backgroundColor: primaryColor + '08' }]} />

        {/* Speed trails */}
        <Animated.View style={[styles.transTrail, { top: '42%', opacity: transTrail1, backgroundColor: primaryColor + '30' }]} />
        <Animated.View style={[styles.transTrail, { top: '50%', opacity: transTrail2, backgroundColor: secondaryColor + '25', width: SCREEN_W * 0.7 }]} />
        <Animated.View style={[styles.transTrail, { top: '58%', opacity: transTrail3, backgroundColor: primaryColor + '20', width: SCREEN_W * 0.5 }]} />

        {/* Vehicle */}
        <Animated.View style={[
          styles.transVehicleWrap,
          {
            transform: [
              { translateX: transVehicle },
              { scale: transScale },
            ],
          },
        ]}>
          <Animated.View style={{ transform: [{ scale: transPulse }] }}>
            {isMoto ? (
              <View style={styles.transVehicleContainer}>
                {/* Moto body */}
                <View style={[styles.transMotoBody, { backgroundColor: primaryColor }]}>
                  <View style={styles.transMotoSeat} />
                  <View style={[styles.transMotoHandle, { backgroundColor: secondaryColor }]} />
                </View>
                {/* Rider */}
                <View style={[styles.transMotoRider, { backgroundColor: primaryColor }]}>
                  <View style={styles.transMotoHelmet} />
                  <View style={[styles.transMotoVisor, { backgroundColor: secondaryColor }]} />
                </View>
                {/* Package */}
                <View style={[styles.transMotoPackage, { backgroundColor: secondaryColor }]}>
                  <View style={styles.transMotoPackageLine} />
                </View>
                {/* Wheels */}
                <View style={[styles.transWheel, styles.transWheelFront]}>
                  <View style={styles.transWheelInner} />
                  <View style={[styles.transWheelHub, { backgroundColor: primaryColor }]} />
                </View>
                <View style={[styles.transWheel, styles.transWheelBack]}>
                  <View style={styles.transWheelInner} />
                  <View style={[styles.transWheelHub, { backgroundColor: primaryColor }]} />
                </View>
                {/* Exhaust particles */}
                <View style={[styles.transExhaust, styles.transExhaust1]} />
                <View style={[styles.transExhaust, styles.transExhaust2]} />
                <View style={[styles.transExhaust, styles.transExhaust3]} />
              </View>
            ) : (
              <View style={styles.transVehicleContainer}>
                {/* Truck cab */}
                <View style={[styles.transTruckCab, { backgroundColor: primaryColor }]}>
                  <View style={[styles.transTruckWindow, { borderColor: secondaryColor }]} />
                </View>
                {/* Truck cargo */}
                <View style={[styles.transTruckCargo, { backgroundColor: secondaryColor }]}>
                  <Text style={[styles.transTruckLabel, { color: primaryColor }]}>B2B</Text>
                </View>
                {/* Truck wheels */}
                <View style={[styles.transWheel, styles.transTruckWheelF]}>
                  <View style={styles.transWheelInner} />
                  <View style={[styles.transWheelHub, { backgroundColor: primaryColor }]} />
                </View>
                <View style={[styles.transWheel, styles.transTruckWheelB]}>
                  <View style={styles.transWheelInner} />
                  <View style={[styles.transWheelHub, { backgroundColor: primaryColor }]} />
                </View>
                {/* Exhaust */}
                <View style={[styles.transExhaust, styles.transExhaust1, { bottom: 10, left: -20 }]} />
                <View style={[styles.transExhaust, styles.transExhaust2, { bottom: 15, left: -30 }]} />
              </View>
            )}
          </Animated.View>
        </Animated.View>

        {/* Text */}
        <Animated.View style={[
          styles.transTextWrap,
          {
            opacity: transText,
            transform: [{ scale: transText.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
          },
        ]}>
          <Text style={[styles.transLabel, { color: primaryColor }]}>{label}</Text>
          <Text style={styles.transSubLabel}>{subLabel}</Text>
          <View style={styles.transDotsRow}>
            <View style={[styles.transDot, { backgroundColor: primaryColor }]} />
            <View style={[styles.transDot, { backgroundColor: secondaryColor }]} />
            <View style={[styles.transDot, { backgroundColor: primaryColor, opacity: 0.5 }]} />
          </View>
        </Animated.View>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Animated Logo */}
          <View style={styles.logoContainer}>
            <Animated.View style={[
              styles.logoBox,
              {
                transform: [
                  { scale: logoScale },
                  { rotate: logoSpin },
                ],
              },
            ]}>
              <View style={styles.logoIcon}>
                <View style={styles.logoRect} />
                <View style={styles.logoLine1} />
                <View style={styles.logoLine2} />
              </View>
            </Animated.View>

            {/* Sparkles around logo */}
            <Animated.View style={[styles.sparkle, styles.sparkle1, {
              opacity: sparkle1,
              transform: [{ scale: sparkle1 }],
            }]}>
              <View style={styles.sparkleInner} />
            </Animated.View>
            <Animated.View style={[styles.sparkle, styles.sparkle2, {
              opacity: sparkle2,
              transform: [{ scale: sparkle2 }],
            }]}>
              <View style={[styles.sparkleInner, { backgroundColor: '#5AC8FA' }]} />
            </Animated.View>
            <Animated.View style={[styles.sparkle, styles.sparkle3, {
              opacity: sparkle3,
              transform: [{ scale: sparkle3 }],
            }]}>
              <View style={[styles.sparkleInner, { backgroundColor: '#FF9500' }]} />
            </Animated.View>
          </View>

          {/* Welcome text with animation */}
          <Animated.View style={{
            opacity: welcomeFade,
            transform: [{ translateY: welcomeSlide }],
          }}>
            <Text style={styles.welcomeText}>Bienvenue !</Text>
            <Text style={styles.title}>Creer un compte</Text>
            <Text style={styles.subtitle}>Choisissez votre mode d'utilisation</Text>
          </Animated.View>

          {/* Form with animation */}
          <Animated.View style={{
            opacity: formFade,
            transform: [{ translateY: formSlide }],
          }}>
            {/* Mode selector */}
            <View style={styles.modeContainer}>
              <TouchableOpacity
                style={[styles.modeCard, selectedMode === 'moto' && styles.modeCardActive]}
                onPress={() => setSelectedMode('moto')}
                activeOpacity={0.8}
              >
                <View style={[styles.modeIconBox, selectedMode === 'moto' && styles.modeIconBoxActive]}>
                  {/* Moto icon */}
                  <View style={styles.modeIconMoto}>
                    <View style={[styles.motoIconWheel, selectedMode === 'moto' && styles.motoIconWheelActive]} />
                    <View style={[styles.motoIconWheel, selectedMode === 'moto' && styles.motoIconWheelActive, { left: 22 }]} />
                    <View style={[styles.motoIconBody, selectedMode === 'moto' && styles.motoIconBodyActive]} />
                    <View style={[styles.motoIconRider, selectedMode === 'moto' && styles.motoIconRiderActive]} />
                  </View>
                </View>
                <Text style={[styles.modeLabel, selectedMode === 'moto' && styles.modeLabelActive]}>MOTO</Text>
                <Text style={styles.modeDesc}>Livreur individuel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modeCard, selectedMode === 'b2b' && styles.modeCardActive]}
                onPress={() => setSelectedMode('b2b')}
                activeOpacity={0.8}
              >
                <View style={[styles.modeIconBox, selectedMode === 'b2b' && styles.modeIconBoxActive]}>
                  {/* Truck icon */}
                  <View style={styles.modeIconTruck}>
                    <View style={[styles.truckCab, selectedMode === 'b2b' && styles.truckCabActive]} />
                    <View style={[styles.truckCargo, selectedMode === 'b2b' && styles.truckCargoActive]} />
                    <View style={[styles.truckWh, { left: 6, bottom: 0 }, selectedMode === 'b2b' && styles.truckWhActive]} />
                    <View style={[styles.truckWh, { right: 4, bottom: 0 }, selectedMode === 'b2b' && styles.truckWhActive]} />
                  </View>
                </View>
                <Text style={[styles.modeLabel, selectedMode === 'b2b' && styles.modeLabelActive]}>B2B</Text>
                <Text style={styles.modeDesc}>Equipe logistique</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modeNote}>
              Le mode choisi ne pourra pas etre modifie apres l'inscription
            </Text>

            {/* Form */}
            <View style={styles.formContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="votre@email.com"
                placeholderTextColor="#bbb"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.label}>Mot de passe</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Minimum 6 caracteres"
                placeholderTextColor="#bbb"
                secureTextEntry
              />

              <Text style={styles.label}>Confirmer le mot de passe</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirmez votre mot de passe"
                placeholderTextColor="#bbb"
                secureTextEntry
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.registerBtn, loading && styles.registerBtnDisabled]}
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.registerBtnText}>Creer mon compte</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.bottomRow}>
              <Text style={styles.bottomText}>Deja un compte ? </Text>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.bottomLink}>Se connecter</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Transition overlay */}
      {renderTransition()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FF9500',
  },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    paddingVertical: 40,
  },

  logoContainer: {
    alignItems: 'center',
    marginBottom: 18,
    height: 100,
    justifyContent: 'center',
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  logoIcon: {
    width: 28,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoRect: {
    width: 24,
    height: 30,
    borderWidth: 2.5,
    borderColor: '#FF9500',
    borderRadius: 6,
    position: 'absolute',
  },
  logoLine1: {
    width: 12,
    height: 2.5,
    backgroundColor: '#FF9500',
    borderRadius: 2,
    position: 'absolute',
    top: 12,
  },
  logoLine2: {
    width: 12,
    height: 2.5,
    backgroundColor: '#FF9500',
    borderRadius: 2,
    position: 'absolute',
    top: 18,
  },

  // Sparkles
  sparkle: {
    position: 'absolute',
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sparkle1: { top: 8, right: '30%' },
  sparkle2: { top: 24, left: '28%' },
  sparkle3: { bottom: 8, right: '34%' },
  sparkleInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },

  // Welcome text
  welcomeText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: -0.8,
  },

  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 22,
  },

  // Mode selector
  modeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  modeCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#e5e5ea',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  modeCardActive: {
    borderColor: '#007AFF',
    backgroundColor: '#EBF5FF',
  },
  modeIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#f2f2f7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  modeIconBoxActive: {
    backgroundColor: '#007AFF',
  },

  // Moto icon in mode card
  modeIconMoto: {
    width: 34,
    height: 22,
    position: 'relative',
  },
  motoIconWheel: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#8e8e93',
    position: 'absolute',
    bottom: 0,
    left: 2,
  },
  motoIconWheelActive: { borderColor: '#fff' },
  motoIconBody: {
    width: 16,
    height: 4,
    backgroundColor: '#8e8e93',
    borderRadius: 2,
    position: 'absolute',
    bottom: 6,
    left: 9,
  },
  motoIconBodyActive: { backgroundColor: '#fff' },
  motoIconRider: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8e8e93',
    position: 'absolute',
    top: 0,
    left: 12,
  },
  motoIconRiderActive: { backgroundColor: '#fff' },

  // Truck icon in mode card
  modeIconTruck: {
    width: 34,
    height: 22,
    position: 'relative',
  },
  truckCab: {
    width: 12,
    height: 14,
    backgroundColor: '#8e8e93',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    position: 'absolute',
    right: 0,
    top: 2,
  },
  truckCabActive: { backgroundColor: '#fff' },
  truckCargo: {
    width: 22,
    height: 12,
    backgroundColor: '#aeaeb2',
    borderRadius: 3,
    position: 'absolute',
    left: 0,
    top: 4,
  },
  truckCargoActive: { backgroundColor: 'rgba(255,255,255,0.7)' },
  truckWh: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#8e8e93',
    position: 'absolute',
  },
  truckWhActive: { borderColor: '#fff' },

  modeLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3c3c43',
    marginBottom: 2,
  },
  modeLabelActive: {
    color: '#007AFF',
  },
  modeDesc: {
    fontSize: 11,
    color: '#8e8e93',
  },
  modeNote: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 18,
    fontStyle: 'italic',
  },

  formContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8e8e93',
    marginBottom: 6,
    marginTop: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 0,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#f2f2f7',
  },

  errorText: {
    color: '#FF3B30',
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
    fontWeight: '500',
  },

  registerBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  registerBtnDisabled: {
    opacity: 0.6,
  },
  registerBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },

  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 28,
  },
  bottomText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
  },
  bottomLink: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // ========== TRANSITION OVERLAY ==========
  transOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f2f2f7',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  transBgCircle1: {
    position: 'absolute',
    width: SCREEN_W * 1.2,
    height: SCREEN_W * 1.2,
    borderRadius: SCREEN_W * 0.6,
    top: -SCREEN_W * 0.3,
    left: -SCREEN_W * 0.1,
  },
  transBgCircle2: {
    position: 'absolute',
    width: SCREEN_W * 0.8,
    height: SCREEN_W * 0.8,
    borderRadius: SCREEN_W * 0.4,
    bottom: -SCREEN_W * 0.2,
    right: -SCREEN_W * 0.2,
  },
  transBgCircle3: {
    position: 'absolute',
    width: SCREEN_W * 0.5,
    height: SCREEN_W * 0.5,
    borderRadius: SCREEN_W * 0.25,
    top: '20%',
    right: -SCREEN_W * 0.1,
  },
  transTrail: {
    position: 'absolute',
    left: 0,
    height: 4,
    width: SCREEN_W * 0.9,
    borderRadius: 2,
  },
  transVehicleWrap: {
    position: 'absolute',
    top: '35%',
    alignSelf: 'center',
  },
  transVehicleContainer: {
    width: 180,
    height: 100,
    position: 'relative',
  },

  // Moto transition
  transMotoBody: {
    width: 90,
    height: 24,
    borderRadius: 12,
    position: 'absolute',
    bottom: 28,
    left: 40,
  },
  transMotoSeat: {
    width: 22,
    height: 10,
    backgroundColor: '#1c1c1e',
    borderRadius: 5,
    position: 'absolute',
    top: -6,
    right: 20,
  },
  transMotoHandle: {
    width: 12,
    height: 18,
    borderRadius: 3,
    position: 'absolute',
    top: -10,
    right: 0,
  },
  transMotoRider: {
    width: 24,
    height: 30,
    borderRadius: 6,
    position: 'absolute',
    bottom: 44,
    left: 72,
  },
  transMotoHelmet: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1c1c1e',
    position: 'absolute',
    top: -14,
    left: 2,
  },
  transMotoVisor: {
    width: 14,
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    top: -8,
    left: 6,
  },
  transMotoPackage: {
    width: 26,
    height: 22,
    borderRadius: 5,
    position: 'absolute',
    bottom: 34,
    left: 36,
  },
  transMotoPackageLine: {
    width: 16,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 1,
    position: 'absolute',
    top: 6,
    left: 5,
  },
  transWheel: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 4,
    borderColor: '#1c1c1e',
    position: 'absolute',
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transWheelInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3c3c43',
    position: 'absolute',
  },
  transWheelHub: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  transWheelFront: { right: 10 },
  transWheelBack: { left: 10 },
  transExhaust: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(142,142,147,0.3)',
    position: 'absolute',
  },
  transExhaust1: { bottom: 15, left: -5 },
  transExhaust2: { bottom: 20, left: -15, width: 8, height: 8 },
  transExhaust3: { bottom: 10, left: -22, width: 6, height: 6, opacity: 0.5 },

  // Truck transition
  transTruckCab: {
    width: 50,
    height: 40,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 4,
    position: 'absolute',
    right: 10,
    bottom: 20,
  },
  transTruckWindow: {
    width: 30,
    height: 18,
    borderWidth: 3,
    borderRadius: 4,
    backgroundColor: '#5AC8FA',
    position: 'absolute',
    top: 6,
    left: 8,
  },
  transTruckCargo: {
    width: 100,
    height: 50,
    borderRadius: 6,
    position: 'absolute',
    left: 10,
    bottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transTruckLabel: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
  },
  transTruckWheelF: { right: 18 },
  transTruckWheelB: { left: 18 },

  transTextWrap: {
    position: 'absolute',
    bottom: '22%',
    alignItems: 'center',
  },
  transLabel: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  transSubLabel: {
    fontSize: 16,
    color: '#8e8e93',
    fontWeight: '500',
    marginTop: 6,
  },
  transDotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  transDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
