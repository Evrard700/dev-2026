import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import GlassCard from './GlassCard';
import { colors, spacing, typography, borderRadius } from '../styles/glassmorphism';

export default function MotoHeader({ 
  onMenuPress, 
  onSettingsPress,
  clientCount = 0,
  orderCount = 0,
  deliveredCount = 0 
}) {
  return (
    <GlassCard style={styles.header}>
      <View style={styles.headerContent}>
        {/* Logo/Title */}
        <View style={styles.titleSection}>
          <View style={styles.logoSmall}>
            <Text style={styles.logoText}>K</Text>
          </View>
          <View>
            <Text style={styles.title}>KOUZO</Text>
            <Text style={styles.subtitle}>Mode Livreur</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{clientCount}</Text>
            <Text style={styles.statLabel}>Clients</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{deliveredCount}/{orderCount}</Text>
            <Text style={styles.statLabel}>Livrées</Text>
          </View>
        </View>

        {/* Settings Button */}
        <TouchableOpacity 
          style={styles.settingsBtn}
          onPress={onSettingsPress}
          activeOpacity={0.7}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  header: {
    marginHorizontal: spacing.md,
    marginTop: Platform.OS === 'web' ? spacing.md : 0,
    marginBottom: spacing.md,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoSmall: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    fontSize: 18,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    ...typography.h3,
    color: colors.primary,
    fontSize: 20,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 20,
  },
});
