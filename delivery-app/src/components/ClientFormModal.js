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
  ScrollView,
  Image,
} from 'react-native';

let ImagePicker = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {
  // expo-image-picker not available
}

export default function ClientFormModal({ visible, onClose, onSubmit, coordinate, showPhotoUpload = false }) {
  const [nom, setNom] = useState('');
  const [numero, setNumero] = useState('');
  const [adresse, setAdresse] = useState('');
  const [photo, setPhoto] = useState(null);

  const handleSubmit = () => {
    if (!nom.trim()) return;
    onSubmit({
      nom: nom.trim(),
      numero: numero.trim(),
      adresse: adresse.trim(),
      photo: photo,
      coordinate,
    });
    setNom('');
    setNumero('');
    setAdresse('');
    setPhoto(null);
    onClose();
  };

  const handlePickPhoto = async () => {
    if (!ImagePicker) {
      if (Platform.OS === 'web') {
        // Web file input fallback
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
              setPhoto(reader.result);
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
      }
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        if (Platform.OS !== 'web') {
          const { Alert } = require('react-native');
          Alert.alert('Permission requise', 'Autorisez l\'acces a la galerie pour ajouter une photo.');
        }
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          setPhoto(`data:image/jpeg;base64,${asset.base64}`);
        } else {
          setPhoto(asset.uri);
        }
      }
    } catch (e) {
      console.warn('Photo pick error:', e);
    }
  };

  const handleTakePhoto = async () => {
    if (!ImagePicker) return;
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        if (Platform.OS !== 'web') {
          const { Alert } = require('react-native');
          Alert.alert('Permission requise', 'Autorisez l\'acces a la camera pour prendre une photo.');
        }
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          setPhoto(`data:image/jpeg;base64,${asset.base64}`);
        } else {
          setPhoto(asset.uri);
        }
      }
    } catch (e) {
      console.warn('Camera error:', e);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Text style={styles.iconText}>+</Text>
              </View>
              <Text style={styles.title}>Nouveau Client</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnX}>✕</Text>
            </TouchableOpacity>
          </View>

          {coordinate && (
            <Text style={styles.coordText}>
              {coordinate[1].toFixed(5)}, {coordinate[0].toFixed(5)}
            </Text>
          )}

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Photo upload section */}
            {showPhotoUpload && (
              <View style={styles.photoSection}>
                {photo ? (
                  <View style={styles.photoPreviewWrap}>
                    <Image source={{ uri: photo }} style={styles.photoPreview} />
                    <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => setPhoto(null)}>
                      <Text style={styles.photoRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.photoButtons}>
                    <TouchableOpacity style={styles.photoPickBtn} onPress={handlePickPhoto}>
                      <View style={styles.photoPickIconWrap}>
                        <View style={styles.photoPickMountain} />
                        <View style={styles.photoPickSun} />
                      </View>
                      <Text style={styles.photoPickText}>Galerie</Text>
                    </TouchableOpacity>
                    {Platform.OS !== 'web' && (
                      <TouchableOpacity style={styles.photoPickBtn} onPress={handleTakePhoto}>
                        <View style={styles.cameraIconWrap}>
                          <View style={styles.cameraBody} />
                          <View style={styles.cameraLens} />
                        </View>
                        <Text style={styles.photoPickText}>Camera</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}

            <Text style={styles.label}>Nom complet *</Text>
            <TextInput
              style={styles.input}
              value={nom}
              onChangeText={setNom}
              placeholder="Nom complet du client"
              placeholderTextColor="#aaa"
            />

            <Text style={styles.label}>Telephone</Text>
            <TextInput
              style={styles.input}
              value={numero}
              onChangeText={setNumero}
              placeholder="Numero de telephone"
              placeholderTextColor="#aaa"
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Adresse</Text>
            <TextInput
              style={styles.input}
              value={adresse}
              onChangeText={setAdresse}
              placeholder="Adresse du client"
              placeholderTextColor="#aaa"
            />

            <View style={styles.buttons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, !nom.trim() && styles.disabledBtn]}
                onPress={handleSubmit}
                disabled={!nom.trim()}
              >
                <Text style={styles.submitText}>Ajouter</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  card: {
    width: '88%',
    maxWidth: 380,
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DC262620',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#DC2626',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1c1c1e',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f2f2f7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnX: {
    color: '#8e8e93',
    fontSize: 14,
    fontWeight: '600',
  },
  coordText: {
    fontSize: 12,
    color: '#8e8e93',
    marginBottom: 12,
  },
  scrollBody: {
    flexGrow: 0,
  },

  // Photo section
  photoSection: {
    marginBottom: 16,
  },
  photoPreviewWrap: {
    alignItems: 'center',
    position: 'relative',
  },
  photoPreview: {
    width: 120,
    height: 120,
    borderRadius: 16,
    backgroundColor: '#f2f2f7',
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: '50%',
    marginRight: -66,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e74c3c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoRemoveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  photoPickBtn: {
    flex: 1,
    backgroundColor: '#f9f9fb',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e5ea',
    borderStyle: 'dashed',
    gap: 8,
  },
  photoPickIconWrap: {
    width: 32,
    height: 24,
    position: 'relative',
  },
  photoPickMountain: {
    position: 'absolute',
    bottom: 0,
    left: 4,
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderBottomWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#DC2626',
  },
  photoPickSun: {
    position: 'absolute',
    top: 0,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2626',
  },
  cameraIconWrap: {
    width: 32,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBody: {
    width: 28,
    height: 18,
    borderRadius: 4,
    borderWidth: 2.5,
    borderColor: '#DC2626',
  },
  cameraLens: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#DC2626',
  },
  photoPickText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },

  label: {
    fontSize: 13,
    color: '#8e8e93',
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#f9f9fb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1c1c1e',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e5e5ea',
  },
  hint: {
    fontSize: 12,
    color: '#8e8e93',
    marginTop: -8,
    marginBottom: 14,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#f2f2f7',
    alignItems: 'center',
  },
  cancelText: {
    color: '#8e8e93',
    fontSize: 15,
    fontWeight: '600',
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#DC2626',
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.4,
  },
  submitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
