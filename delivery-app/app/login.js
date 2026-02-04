import React, { useState } from 'react';
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
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { loginUser } from '../src/stores/storage';
import { supabase } from '../src/lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Veuillez entrer votre email pour reinitialiser le mot de passe.');
      return;
    }
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
    } else {
      if (Platform.OS === 'web') {
        alert('Un email de reinitialisation a ete envoye a ' + email.trim());
      } else {
        Alert.alert('Email envoye', 'Un email de reinitialisation a ete envoye a ' + email.trim());
      }
    }
  };

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Veuillez remplir tous les champs.');
      return;
    }
    setLoading(true);
    const result = await loginUser(email.trim(), password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      const userMode = result.user?.mode || 'moto';
      router.replace(userMode === 'b2b' ? '/b2b' : '/moto');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoBox}>
              <View style={styles.logoIcon}>
                <View style={styles.logoRect} />
                <View style={styles.logoLine1} />
                <View style={styles.logoLine2} />
              </View>
            </View>
          </View>

          <Text style={styles.title}>KOUZO</Text>
          <Text style={styles.subtitle}>Connectez-vous pour acceder a votre espace</Text>

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
              placeholder="Votre mot de passe"
              placeholderTextColor="#bbb"
              secureTextEntry
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPassword}>
              <Text style={styles.forgotText}>Mot de passe oublie ?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.loginBtnText}>Se connecter</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.bottomRow}>
            <Text style={styles.bottomText}>Pas encore de compte ? </Text>
            <TouchableOpacity onPress={() => router.push('/register')}>
              <Text style={styles.bottomLink}>S'inscrire</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1F2937',
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
    marginBottom: 24,
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
    shadowRadius: 16,
    elevation: 8,
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
    borderColor: '#DC2626',
    borderRadius: 6,
    position: 'absolute',
  },
  logoLine1: {
    width: 12,
    height: 2.5,
    backgroundColor: '#DC2626',
    borderRadius: 2,
    position: 'absolute',
    top: 12,
  },
  logoLine2: {
    width: 12,
    height: 2.5,
    backgroundColor: '#DC2626',
    borderRadius: 2,
    position: 'absolute',
    top: 18,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 36,
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
    marginTop: 12,
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

  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: 14,
    marginBottom: 22,
  },
  forgotText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },

  loginBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },

  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
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
});
