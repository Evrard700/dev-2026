import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Image,
  Animated,
  Pressable,
} from 'react-native';

export default function B2BClientPopup({
  visible,
  client,
  onClose,
  onServe,
  onNotServe,
  onNavigate,
  onDeleteClient,
  isDeliveryView = false,
}) {
  const navScale = useRef(new Animated.Value(1)).current;
  const serveScale = useRef(new Animated.Value(1)).current;
  const notServeScale = useRef(new Animated.Value(1)).current;
  const deleteScale = useRef(new Animated.Value(1)).current;

  const animPress = (anim) => ({
    onPressIn: () => Animated.spring(anim, { toValue: 0.95, useNativeDriver: true, speed: 50, bounciness: 4 }).start(),
    onPressOut: () => Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 10 }).start(),
  });

  if (!client) return null;

  const handleDelete = () => {
    if (Platform.OS === 'web') {
      if (confirm(`Voulez-vous vraiment supprimer ${client.nom} ?`)) {
        onDeleteClient(client.id);
      }
    } else {
      Alert.alert(
        'Supprimer le client',
        `Voulez-vous vraiment supprimer ${client.nom} ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Supprimer', style: 'destructive', onPress: () => onDeleteClient(client.id) },
        ]
      );
    }
  };

  const statusColor = client.served === true ? '#34c759' : client.served === false ? '#e74c3c' : '#ff9500';
  const statusLabel = client.served === true ? 'Servi' : client.served === false ? 'Non servi' : 'En attente';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.card}>
          {/* Status badge + close */}
          <View style={styles.cardHeader}>
            <View style={[styles.statusPill, { backgroundColor: statusColor + '18' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnX}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Client photo */}
            {client.photo ? (
              <View style={styles.photoContainer}>
                <Image source={{ uri: client.photo }} style={styles.clientPhoto} />
              </View>
            ) : (
              <View style={styles.photoContainer}>
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{client.nom.charAt(0).toUpperCase()}</Text>
                </View>
              </View>
            )}

            {/* Client name */}
            <Text style={styles.clientName}>{client.nom}</Text>

            {/* Phone */}
            {client.numero ? (
              <View style={styles.infoRow}>
                <View style={styles.infoIconCircle}>
                  <Text style={styles.infoIconText}>T</Text>
                </View>
                <View>
                  <Text style={styles.infoLabel}>Telephone</Text>
                  <Text style={styles.infoValue}>{client.numero}</Text>
                </View>
              </View>
            ) : null}

            {/* Address */}
            {client.adresse ? (
              <View style={styles.infoRow}>
                <View style={styles.infoIconCircle}>
                  <View style={styles.pinIcon}>
                    <View style={styles.pinHead} />
                    <View style={styles.pinTail} />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>Adresse</Text>
                  <Text style={styles.infoValue}>{client.adresse}</Text>
                </View>
              </View>
            ) : null}

            {/* In-app navigate button */}
            {isDeliveryView && (
              <Animated.View style={{ transform: [{ scale: navScale }] }}>
                <Pressable style={styles.navBtn} onPress={() => onNavigate(client)} {...animPress(navScale)}>
                  <View style={styles.navBtnIconWrap}>
                    <View style={styles.navDiamond} />
                  </View>
                  <Text style={styles.navBtnText}>Itineraire dans l'app</Text>
                </Pressable>
              </Animated.View>
            )}

            {/* Serve / Mark as delivered (delivery view) */}
            {isDeliveryView && (
              <View style={styles.actionButtons}>
                <Animated.View style={[{ flex: 1, transform: [{ scale: serveScale }] }]}>
                  <Pressable
                    style={[styles.serveBtn, client.served === true && styles.serveBtnActive]}
                    onPress={() => onServe(client.id)}
                    {...animPress(serveScale)}
                  >
                    <Text style={styles.serveBtnIcon}>{client.served === true ? '✓' : '+'}</Text>
                    <Text style={[styles.serveBtnText, client.served === true && styles.serveBtnTextActive]}>Servi</Text>
                  </Pressable>
                </Animated.View>
                <Animated.View style={[{ flex: 1, transform: [{ scale: notServeScale }] }]}>
                  <Pressable
                    style={[styles.notServeBtn, client.served === false && styles.notServeBtnActive]}
                    onPress={() => onNotServe(client.id)}
                    {...animPress(notServeScale)}
                  >
                    <Text style={styles.notServeBtnIcon}>{client.served === false ? '✕' : '-'}</Text>
                    <Text style={[styles.notServeBtnText, client.served === false && styles.notServeBtnTextActive]}>Non servi</Text>
                  </Pressable>
                </Animated.View>
              </View>
            )}

            {/* Delete */}
            <Animated.View style={{ transform: [{ scale: deleteScale }] }}>
              <Pressable style={styles.deleteBtn} onPress={handleDelete} {...animPress(deleteScale)}>
                <Text style={styles.deleteBtnText}>Supprimer ce client</Text>
              </Pressable>
            </Animated.View>
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
    maxHeight: '75%',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 8,
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
    marginBottom: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '700',
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

  scrollBody: {
    flexGrow: 0,
  },

  // Photo
  photoContainer: {
    alignItems: 'center',
    marginBottom: 14,
  },
  clientPhoto: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    backgroundColor: '#f2f2f7',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '800',
  },

  clientName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1c1c1e',
    marginBottom: 14,
    textAlign: 'center',
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  infoIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f2f2f7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoIconText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
  },
  infoLabel: {
    fontSize: 12,
    color: '#8e8e93',
    marginBottom: 1,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1c1c1e',
  },

  // Pin icon
  pinIcon: {
    alignItems: 'center',
  },
  pinHead: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#007AFF',
    marginTop: -2,
  },

  // In-app nav button
  navBtn: {
    flexDirection: 'row',
    backgroundColor: '#f2f2f7',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  navBtnIconWrap: {
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navDiamond: {
    width: 12,
    height: 12,
    borderWidth: 2.5,
    borderColor: '#007AFF',
    transform: [{ rotate: '45deg' }],
  },
  navBtnText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Serve / Not Serve buttons
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  serveBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#34c75910',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#34c75930',
    gap: 6,
  },
  serveBtnActive: {
    backgroundColor: '#34c759',
    borderColor: '#34c759',
  },
  serveBtnIcon: {
    fontSize: 14,
    color: '#34c759',
    fontWeight: '700',
  },
  serveBtnText: {
    color: '#34c759',
    fontSize: 15,
    fontWeight: '700',
  },
  serveBtnTextActive: {
    color: '#fff',
  },
  notServeBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#e74c3c10',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e74c3c30',
    gap: 6,
  },
  notServeBtnActive: {
    backgroundColor: '#e74c3c',
    borderColor: '#e74c3c',
  },
  notServeBtnIcon: {
    fontSize: 14,
    color: '#e74c3c',
    fontWeight: '700',
  },
  notServeBtnText: {
    color: '#e74c3c',
    fontSize: 15,
    fontWeight: '700',
  },
  notServeBtnTextActive: {
    color: '#fff',
  },

  // Delete
  deleteBtn: {
    marginTop: 4,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  deleteBtnText: {
    color: '#8e8e93',
    fontSize: 13,
    fontWeight: '500',
  },
});
