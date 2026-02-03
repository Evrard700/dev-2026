import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

export default function OrderModal({ visible, onClose, onSubmit }) {
  const [produit, setProduit] = useState('');
  const [quantite, setQuantite] = useState('1');
  const [prix, setPrix] = useState('');

  const handleSubmit = () => {
    if (!produit.trim() || !prix.trim()) return;
    onSubmit({
      produit: produit.trim(),
      quantite: parseInt(quantite) || 1,
      prix: parseFloat(prix) || 0,
    });
    setProduit('');
    setQuantite('1');
    setPrix('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.container}>
          <View style={styles.handle} />
          <Text style={styles.title}>Nouvelle Commande</Text>

          <Text style={styles.label}>Produit *</Text>
          <TextInput
            style={styles.input}
            value={produit}
            onChangeText={setProduit}
            placeholder="Nom du produit"
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Quantite</Text>
          <TextInput
            style={styles.input}
            value={quantite}
            onChangeText={setQuantite}
            placeholder="1"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />

          <Text style={styles.label}>Prix unitaire *</Text>
          <TextInput
            style={styles.input}
            value={prix}
            onChangeText={setPrix}
            placeholder="Prix en FCFA"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, (!produit.trim() || !prix.trim()) && styles.disabledBtn]}
              onPress={handleSubmit}
              disabled={!produit.trim() || !prix.trim()}
            >
              <Text style={styles.submitText}>Ajouter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ddd',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#555',
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#f5f5f8',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1a1a2e',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e8e8ee',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f0f0f5',
    alignItems: 'center',
  },
  cancelText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  submitBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#4361ee',
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
