import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import GlassCard from './GlassCard';
import { colors, spacing, typography, borderRadius } from '../styles/glassmorphism';

export default function OrderCard({ order, onToggle, onDelete }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const checkAnim = useRef(new Animated.Value(order.checked ? 1 : 0)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      damping: 15,
      stiffness: 150,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 15,
      stiffness: 150,
    }).start();
  };

  const handleToggle = () => {
    Animated.spring(checkAnim, {
      toValue: order.checked ? 0 : 1,
      useNativeDriver: true,
      damping: 15,
      stiffness: 150,
    }).start();
    onToggle();
  };

  const checkScale = checkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.2],
  });

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <GlassCard style={[styles.card, order.checked && styles.cardChecked]}>
        <View style={styles.content}>
          {/* Checkbox */}
          <TouchableOpacity
            style={styles.checkbox}
            onPress={handleToggle}
            activeOpacity={0.7}
          >
            <Animated.View
              style={[
                styles.checkboxInner,
                order.checked && styles.checkboxChecked,
                { transform: [{ scale: checkScale }] },
              ]}
            >
              {order.checked && <Text style={styles.checkmark}>✓</Text>}
            </Animated.View>
          </TouchableOpacity>

          {/* Order Info */}
          <View style={styles.info}>
            <Text style={[styles.product, order.checked && styles.textChecked]}>
              {order.produit || 'Colis'}
            </Text>
            <Text style={styles.details}>
              {order.quantite && `${order.quantite} • `}
              {order.prix} FCFA
            </Text>
            <Text style={styles.client} numberOfLines={1}>
              👤 {order.clientNom}
            </Text>
          </View>

          {/* Delete Button */}
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={onDelete}
            activeOpacity={0.7}
          >
            <Text style={styles.deleteIcon}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  cardChecked: {
    opacity: 0.7,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  checkbox: {
    marginRight: spacing.md,
  },
  checkboxInner: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  info: {
    flex: 1,
  },
  product: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  textChecked: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  details: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  client: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  deleteIcon: {
    fontSize: 18,
  },
});
