import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { registerUser } from '../src/stores/storage';
import GlassCard from '../src/components/GlassCard';
import GlassButton from '../src/components/GlassButton';
import GlassInput from '../src/components/GlassInput';
import { colors, spacing, typography, borderRadius } from '../src/styles/glassmorphism';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function RegisterGlassScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

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
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    setLoading(true);
    // MVP: Force MOTO mode
    const result = await registerUser(email.trim(), password, email.trim().split('@')[0], 'moto');
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.replace('/moto');
    }
  };

  return (
    <View style={styles.container}>
      {/* Background gradient */}
      <View style={styles.bgGradient}>
        <View style={[styles.gradientOrb, styles.orb1]} />
        <View style={[styles.gradientOrb, styles.orb2]} />
        <View style={[styles.gradientOrb, styles.orb3]} />
      </View>

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent} 
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Logo */}
            <Animated.View 
              style={[
                styles.logoContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ scale: logoScale }],
                },
              ]}
            >
              <View style={styles.logoGlow}>
                <View style={styles.logo}>
                  <Text style={styles.logoText}>K</Text>
                </View>
              </View>
            </Animated.View>

            {/* Title */}
            <Animated.View
              style={{
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }}
            >
              <Text style={styles.title}>KOUZO</Text>
              <Text style={styles.subtitle}>Créer un compte</Text>
              <Text style={styles.subsubtitle}>Mode livreur • Version MVP</Text>
            </Animated.View>

            {/* Form Card */}
            <Animated.View
              style={{
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }}
            >
              <GlassCard style={styles.formCard}>
                <Text style={styles.formTitle}>Inscription</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email</Text>
                  <GlassInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="votre@email.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Mot de passe</Text>
                  <GlassInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Minimum 6 caractères"
                    secureTextEntry
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirmer le mot de passe</Text>
                  <GlassInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Retapez votre mot de passe"
                    secureTextEntry
                  />
                </View>

                {error ? (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>⚠️ {error}</Text>
                  </View>
                ) : null}

                <GlassButton
                  variant="primary"
                  onPress={handleRegister}
                  loading={loading}
                  style={styles.registerBtn}
                >
                  Créer mon compte
                </GlassButton>

                <View style={styles.divider} />

                <View style={styles.loginRow}>
                  <Text style={styles.loginText}>Déjà un compte ? </Text>
                  <GlassButton
                    variant="glass"
                    onPress={() => router.push('/login')}
                    style={styles.loginBtn}
                    textStyle={styles.loginBtnText}
                  >
                    Se connecter
                  </GlassButton>
                </View>
              </GlassCard>
            </Animated.View>

            {/* Footer */}
            <Animated.View
              style={[
                styles.footer,
                { opacity: fadeAnim },
              ]}
            >
              <Text style={styles.footerText}>
                Propulsé par KOUZO ✨
              </Text>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
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
    filter: 'blur(100px)',
  },
  orb2: {
    width: 250,
    height: 250,
    backgroundColor: '#DC26F5',
    bottom: -80,
    left: -80,
    filter: 'blur(100px)',
  },
  orb3: {
    width: 200,
    height: 200,
    backgroundColor: '#3B82F6',
    top: SCREEN_H * 0.4,
    right: -50,
    filter: 'blur(80px)',
  },
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoGlow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 40,
    elevation: 20,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -2,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subsubtitle: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  formCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  formTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error,
    ...typography.caption,
    textAlign: 'center',
  },
  registerBtn: {
    marginTop: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: spacing.lg,
  },
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  loginBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 0,
  },
  loginBtnText: {
    fontSize: 16,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  footerText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
