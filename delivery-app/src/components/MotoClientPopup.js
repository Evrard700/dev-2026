import React, { useState, useCallback, memo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
  Image,
  Animated,
  Pressable,
  Linking,
} from 'react-native';

let ImagePicker = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {
  // expo-image-picker not available
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const OrderItem = memo(({ order, onToggle, onDelete, onPhotoPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        style={[styles.orderRow, order.checked && styles.orderChecked]}
        onPress={() => onToggle(order.id)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={() => {
          if (Platform.OS === 'web') {
            if (confirm(`Supprimer "${order.produit}" ?`)) onDelete(order.id);
          } else {
            Alert.alert('Supprimer', `Supprimer "${order.produit}" ?`, [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Supprimer', style: 'destructive', onPress: () => onDelete(order.id) },
            ]);
          }
        }}
      >
        <View style={[styles.checkbox, order.checked && styles.checkboxChecked]}>
          {order.checked && <Text style={styles.checkmark}>✓</Text>}
        </View>
        {order.photo ? (
          <Pressable onPress={() => onPhotoPress(order.photo)}>
            <Image source={{ uri: order.photo }} style={styles.orderPhoto} />
          </Pressable>
        ) : null}
        <View style={styles.orderInfo}>
          <Text style={[styles.orderName, order.checked && styles.orderNameChecked]}>
            {order.produit}
          </Text>
          <Text style={styles.orderDetail}>
            {order.quantite} x {order.prix.toLocaleString()} F
          </Text>
        </View>
        <Text style={[styles.orderTotal, order.checked && styles.orderTotalChecked]}>
          {(order.prix * order.quantite).toLocaleString()} F
        </Text>
      </Pressable>
    </Animated.View>
  );
});

export default function MotoClientPopup({
  visible,
  client,
  orders,
  onClose,
  onToggleOrder,
  onAddOrder,
  onDeleteOrder,
  onNavigate,
  onDeleteClient,
  clientNumber,
  clientDistance,
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [produit, setProduit] = useState('');
  const [quantite, setQuantite] = useState('1');
  const [prix, setPrix] = useState('');
  const [photo, setPhoto] = useState(null);
  const [fullscreenPhoto, setFullscreenPhoto] = useState(null);

  // Animations
  const navScale = useRef(new Animated.Value(1)).current;
  const addBtnScale = useRef(new Animated.Value(1)).current;
  const deleteBtnScale = useRef(new Animated.Value(1)).current;

  const animPress = (anim) => ({
    onPressIn: () => Animated.spring(anim, { toValue: 0.95, useNativeDriver: true, speed: 50, bounciness: 4 }).start(),
    onPressOut: () => Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 10 }).start(),
  });

  const handleDeleteClient = useCallback(() => {
    if (!client) return;
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
  }, [client, onDeleteClient]);

  if (!client) return null;

  const clientOrders = orders.filter(o => o.clientId === client.id);
  const checkedOrders = clientOrders.filter(o => o.checked);
  const totalAmount = checkedOrders.reduce((sum, o) => sum + (o.prix * o.quantite), 0);
  const checkedCount = checkedOrders.length;

  const handleAddOrder = () => {
    if (!produit.trim() || !prix.trim()) return;
    onAddOrder(client.id, {
      produit: produit.trim(),
      quantite: parseInt(quantite) || 1,
      prix: parseFloat(prix) || 0,
      photo: photo,
    });
    setProduit('');
    setQuantite('1');
    setPrix('');
    setPhoto(null);
  };

  const handlePickPhoto = async () => {
    if (!ImagePicker) {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setPhoto(reader.result);
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
          Alert.alert('Permission requise', 'Autorisez l\'acces a la galerie.');
        }
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.4,
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
          Alert.alert('Permission requise', 'Autorisez l\'acces a la camera.');
        }
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.4,
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
          {/* Client Number + Name Banner */}
          <View style={styles.clientBanner}>
            <View style={styles.clientBannerNumber}>
              <Text style={styles.clientBannerNumberText}>{clientNumber || '?'}</Text>
            </View>
            <View style={styles.clientBannerInfo}>
              <Text style={styles.clientBannerName} numberOfLines={1}>{client.nom}</Text>
              {clientDistance && (
                <Text style={styles.clientBannerDistance}>{clientDistance}</Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnX}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Address - Premier plan */}
          {client.adresse ? (
            <View style={styles.addressRow}>
              <View style={styles.addressDot} />
              <Text style={styles.addressText} numberOfLines={2}>{client.adresse}</Text>
            </View>
          ) : null}

          {/* Phone number */}
          {client.numero && (
            <TouchableOpacity
              style={styles.phoneRow}
              onPress={() => {
                const phoneNumber = client.numero.replace(/\s+/g, '');
                Linking.openURL(`tel:${phoneNumber}`).catch(err => {
                  console.warn('Failed to open phone dialer:', err);
                  if (Platform.OS !== 'web') {
                    Alert.alert('Erreur', 'Impossible d\'ouvrir le composeur téléphonique');
                  }
                });
              }}
            >
              <Text style={styles.phoneIcon}>📞</Text>
              <Text style={styles.phoneText}>{client.numero}</Text>
            </TouchableOpacity>
          )}

          {/* Navigate button */}
          <Animated.View style={{ transform: [{ scale: navScale }] }}>
            <Pressable style={styles.navBtn} onPress={() => onNavigate(client)} {...animPress(navScale)}>
              <View style={styles.navBtnIconWrap}>
                <View style={styles.navArrow} />
              </View>
              <Text style={styles.navBtnText}>Itineraire temps reel</Text>
            </Pressable>
          </Animated.View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Orders section */}
            <View style={styles.ordersSection}>
              <View style={styles.ordersHeader}>
                <View style={styles.ordersHeaderLeft}>
                  <Text style={styles.ordersTitle}>Commandes</Text>
                  {clientOrders.length > 0 && (
                    <View style={styles.orderCountBadge}>
                      <Text style={styles.orderCountText}>
                        {checkedCount}/{clientOrders.length}
                      </Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={[
                    styles.addToggleBtn, 
                    showAddForm && styles.addToggleBtnActive
                  ]}
                  onPress={() => {
                    setShowAddForm(!showAddForm);
                  }}
                >
                  <Text style={[
                    styles.addToggleText, 
                    showAddForm && styles.addToggleTextActive
                  ]}>
                    {showAddForm ? 'Fermer' : '+ Ajouter'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Add form */}
              {showAddForm && (
                <View style={styles.addForm}>
                  {/* Photo picker */}
                  <View style={styles.photoRow}>
                    {photo ? (
                      <View style={styles.photoPreviewWrap}>
                        <Image source={{ uri: photo }} style={styles.photoPreview} />
                        <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => setPhoto(null)}>
                          <Text style={styles.photoRemoveText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.photoPickerRow}>
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

                  <View style={styles.smartRow}>
                    {/* Nom du produit - toujours visible */}
                    <View style={[
                      styles.smartField,
                      !produit.trim() ? styles.smartFieldFull : (
                        !quantite.trim() ? styles.smartFieldHalf : styles.smartFieldThird
                      )
                    ]}>
                      <TextInput
                        style={styles.addInputSmart}
                        value={produit}
                        onChangeText={setProduit}
                        placeholder="Nom du produit"
                        placeholderTextColor="#aeaeb2"
                      />
                    </View>
                    
                    {/* Quantité - apparaît quand produit rempli */}
                    {produit.trim() !== '' && (
                      <View style={[
                        styles.smartField,
                        !quantite.trim() ? styles.smartFieldHalf : styles.smartFieldThird
                      ]}>
                        <TextInput
                          style={styles.addInputSmart}
                          value={quantite}
                          onChangeText={setQuantite}
                          placeholder="Qté"
                          placeholderTextColor="#aeaeb2"
                          keyboardType="numeric"
                        />
                      </View>
                    )}
                    
                    {/* Prix - apparaît quand quantité remplie */}
                    {quantite.trim() !== '' && (
                      <View style={[styles.smartField, styles.smartFieldThird]}>
                        <TextInput
                          style={styles.addInputSmart}
                          value={prix}
                          onChangeText={setPrix}
                          placeholder="Prix (F)"
                          placeholderTextColor="#aeaeb2"
                          keyboardType="numeric"
                        />
                      </View>
                    )}
                  </View>
                  <Animated.View style={{ transform: [{ scale: addBtnScale }] }}>
                    <Pressable
                      style={[styles.addBtn, (!produit.trim() || !prix.trim()) && styles.addBtnDisabled]}
                      onPress={handleAddOrder}
                      disabled={!produit.trim() || !prix.trim()}
                      {...animPress(addBtnScale)}
                    >
                      <Text style={styles.addBtnText}>Enregistrer</Text>
                    </Pressable>
                  </Animated.View>
                </View>
              )}

              {/* Order list */}
              {clientOrders.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>📦</Text>
                  <Text style={styles.emptyText}>Aucune commande</Text>
                  <Text style={styles.emptySubtext}>Appuyez sur "+ Ajouter" pour creer</Text>
                </View>
              ) : (
                <>
                  {clientOrders.map((order) => (
                    <OrderItem key={order.id} order={order} onToggle={onToggleOrder} onDelete={onDeleteOrder} onPhotoPress={setFullscreenPhoto} />
                  ))}

                  {/* Total */}
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalAmount}>{totalAmount.toLocaleString()} FCFA</Text>
                  </View>
                </>
              )}
            </View>

            {/* Delete */}
            <Animated.View style={{ transform: [{ scale: deleteBtnScale }] }}>
              <Pressable style={styles.deleteBtn} onPress={handleDeleteClient} {...animPress(deleteBtnScale)}>
                <Text style={styles.deleteBtnText}>Supprimer ce client</Text>
              </Pressable>
            </Animated.View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Fullscreen photo modal */}
      {fullscreenPhoto && (
        <Modal visible={true} transparent animationType="fade" onRequestClose={() => setFullscreenPhoto(null)}>
          <Pressable style={styles.photoFullscreenOverlay} onPress={() => setFullscreenPhoto(null)}>
            <Image source={{ uri: fullscreenPhoto }} style={styles.photoFullscreenImage} resizeMode="contain" />
            <View style={styles.photoFullscreenClose}>
              <Text style={styles.photoFullscreenCloseText}>✕</Text>
            </View>
          </Pressable>
        </Modal>
      )}
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
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  card: {
    width: Math.min(SCREEN_WIDTH * 0.9, 400),
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingTop: 0,
    paddingHorizontal: 0,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 20,
  },

  // Client Banner (Number + Name)
  clientBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  clientBannerNumber: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  clientBannerNumberText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  clientBannerInfo: {
    flex: 1,
  },
  clientBannerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
  },
  clientBannerDistance: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },

  // Phone Row
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f7',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginTop: 14,
    gap: 10,
  },
  phoneIcon: {
    fontSize: 18,
  },
  phoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },

  // Header (OLD - kept for compatibility but hidden)
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  clientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  headerInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 19,
    fontWeight: '700',
    color: '#000',
    letterSpacing: -0.3,
  },
  clientPhone: {
    fontSize: 13,
    color: '#8e8e93',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f2f2f7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnX: {
    color: '#8e8e93',
    fontSize: 14,
    fontWeight: '600',
  },

  // Address
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 10,
  },
  addressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
  },
  addressText: {
    fontSize: 14,
    color: '#3c3c43',
    flex: 1,
    lineHeight: 19,
  },

  // Navigate button
  navBtn: {
    flexDirection: 'row',
    backgroundColor: '#DC2626',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 10,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  navBtnIconWrap: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navArrow: {
    width: 10,
    height: 10,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: '#fff',
    transform: [{ rotate: '45deg' }],
  },
  navBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  scrollBody: {
    flexGrow: 0,
    paddingHorizontal: 20,
  },

  // Orders section
  ordersSection: {
    marginBottom: 8,
  },
  ordersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ordersHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ordersTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
    letterSpacing: -0.2,
  },
  orderCountBadge: {
    backgroundColor: '#EBF5FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  orderCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  addToggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#EBF5FF',
  },
  addToggleBtnActive: {
    backgroundColor: '#f2f2f7',
  },
  addToggleBtnDisabled: {
    backgroundColor: '#f2f2f7',
    opacity: 0.5,
  },
  addToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  addToggleTextActive: {
    color: '#8e8e93',
  },
  addToggleTextDisabled: {
    color: '#8e8e93',
  },

  // Add form
  addForm: {
    backgroundColor: '#f9f9fb',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },

  // Photo picker in form
  photoRow: {
    marginBottom: 2,
  },
  photoPreviewWrap: {
    alignItems: 'center',
    position: 'relative',
  },
  photoPreview: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#e5e5ea',
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: '50%',
    marginRight: -46,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#e74c3c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoRemoveText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  photoPickerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoPickBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e5ea',
    borderStyle: 'dashed',
    gap: 6,
  },
  photoPickIconWrap: {
    width: 28,
    height: 20,
    position: 'relative',
  },
  photoPickMountain: {
    position: 'absolute',
    bottom: 0,
    left: 2,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#DC2626',
  },
  photoPickSun: {
    position: 'absolute',
    top: 0,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
  },
  cameraIconWrap: {
    width: 28,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBody: {
    width: 24,
    height: 15,
    borderRadius: 3,
    borderWidth: 2,
    borderColor: '#DC2626',
  },
  cameraLens: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#DC2626',
  },
  photoPickText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },

  addInputFull: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#000',
    borderWidth: 1,
    borderColor: '#e5e5ea',
  },
  // Smart progressive form
  smartRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  smartField: {
    transition: 'all 0.3s ease',
  },
  smartFieldFull: {
    flex: 1,
  },
  smartFieldHalf: {
    flex: 1,
  },
  smartFieldThird: {
    flex: 1,
  },
  addInputSmart: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#000',
    borderWidth: 1,
    borderColor: '#e5e5ea',
  },
  
  // Old styles (keep for compatibility)
  addRow: {
    flexDirection: 'row',
    gap: 10,
  },
  addFieldSmall: {
    flex: 1,
  },
  addFieldLarge: {
    flex: 2,
  },
  addFieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8e8e93',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  addInputSmall: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#000',
    borderWidth: 1,
    borderColor: '#e5e5ea',
  },
  addBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    opacity: 0.35,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  emptyText: {
    color: '#8e8e93',
    fontSize: 15,
    fontWeight: '600',
  },
  emptySubtext: {
    color: '#aeaeb2',
    fontSize: 13,
    marginTop: 4,
  },

  // Order items
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9fb',
    borderRadius: 14,
    padding: 12,
    marginBottom: 6,
  },
  orderChecked: {
    backgroundColor: '#E8FAF0',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: '#d1d1d6',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#34c759',
    borderColor: '#34c759',
  },
  checkmark: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  orderPhoto: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginRight: 10,
    backgroundColor: '#e5e5ea',
  },
  orderInfo: {
    flex: 1,
  },
  orderName: {
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
  },
  orderNameChecked: {
    textDecorationLine: 'line-through',
    color: '#8e8e93',
  },
  orderDetail: {
    color: '#8e8e93',
    fontSize: 12,
    marginTop: 2,
  },
  orderTotal: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: '700',
  },
  orderTotalChecked: {
    color: '#34c759',
  },

  // Total
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: '#e5e5ea',
    marginTop: 6,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#DC2626',
  },

  // Delete
  deleteBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  deleteBtnText: {
    color: '#FF3B30',
    fontSize: 13,
    fontWeight: '500',
  },

  // Fullscreen photo
  photoFullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoFullscreenImage: {
    width: '90%',
    height: '75%',
    borderRadius: 16,
  },
  photoFullscreenClose: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoFullscreenCloseText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
