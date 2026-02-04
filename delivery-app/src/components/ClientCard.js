import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import GlassCard from './GlassCard';
import { colors, spacing, typography, borderRadius } from '../styles/glassmorphism';

export default function ClientCard({ client, onPress, hasOrders = false }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

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

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
      >
        <GlassCard style={styles.card}>
          <View style={styles.content}>
            {/* Client Icon */}
            <View style={[styles.icon, hasOrders && styles.iconWithOrders]}>
              <Text style={styles.iconText}>👤</Text>
              {hasOrders && (
                <View style={styles.badge}>
                  <View style={styles.badgeDot} />
                </View>
              )}
            </View>

            {/* Client Info */}
            <View style={styles.info}>
              <Text style={styles.name}>{client.nom}</Text>
              <Text style={styles.phone}>{client.numero}</Text>
              <Text style={styles.address} numberOfLines={1}>
                📍 {client.adresse}
              </Text>
            </View>

            {/* Arrow */}
            <Text style={styles.arrow}>›</Text>
          </View>
        </GlassCard>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  icon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    position: 'relative',
  },
  iconWithOrders: {
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
  },
  iconText: {
    fontSize: 24,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bgGradientStart,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textPrimary,
  },
  info: {
    flex: 1,
  },
  name: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  phone: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  address: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  arrow: {
    fontSize: 28,
    color: colors.textSecondary,
    fontWeight: '300',
  },
});
