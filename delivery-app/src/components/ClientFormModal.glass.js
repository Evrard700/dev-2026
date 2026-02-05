import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import GlassCard from './GlassCard';
import GlassButton from './GlassButton';
import GlassInput from './GlassInput';
import { colors, spacing, typography, borderRadius } from '../styles/glassmorphism';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function ClientFormModalGlass({ 
  visible, 
  onClose, 
  onSubmit, 
  coordinate, 
  showGoogleLink = false 
}) {
  const [nom, setNom] = useState('');
  const [numero, setNumero] = useState('');
  const [adresse, setAdresse] = useState('');
  const [googleLink, setGoogleLink] = useState('');

  const handleSubmit = () => {
    if (!nom.trim()) return;
    onSubmit({
      nom: nom.trim(),
      numero: numero.trim(),
      adresse: adresse.trim(),
      googleLink: googleLink.trim(),
      coordinate,
    });
    setNom('');
    setNumero('');
    setAdresse('');
    setGoogleLink('');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        {/* Backdrop */}
        <TouchableOpacity 
          style={styles.backdrop}
          onPress={onClose}
          activeOpacity={1}
        />

        {/* Form Card */}
        <GlassCard style={styles.card}>
          <ScrollView 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.title}>➕ Nouveau Client</Text>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nom</Text>
                <GlassInput
                  value={nom}
                  onChangeText={setNom}
                  placeholder="Nom du client"
                  autoFocus
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Numéro</Text>
                <GlassInput
                  value={numero}
                  onChangeText={setNumero}
                  placeholder="07 XX XX XX XX"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Adresse</Text>
                <GlassInput
                  value={adresse}
                  onChangeText={setAdresse}
                  placeholder="Cocody Riviera..."
                />
              </View>

              {showGoogleLink && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Lien Google Maps (optionnel)</Text>
                  <GlassInput
                    value={googleLink}
                    onChangeText={setGoogleLink}
                    placeholder="https://maps.google.com/..."
                    autoCapitalize="none"
                  />
                </View>
              )}
            </View>

            <View style={styles.buttons}>
              <GlassButton
                variant="glass"
                onPress={onClose}
                style={styles.cancelBtn}
              >
                Annuler
              </GlassButton>
              <GlassButton
                variant="primary"
                onPress={handleSubmit}
                style={styles.submitBtn}
                disabled={!nom.trim()}
              >
                Ajouter
              </GlassButton>
            </View>
          </ScrollView>
        </GlassCard>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
  },
  card: {
    width: SCREEN_W * 0.9,
    maxWidth: 500,
    maxHeight: SCREEN_H * 0.8,
    padding: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  form: {
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
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelBtn: {
    flex: 1,
  },
  submitBtn: {
    flex: 1,
  },
});
