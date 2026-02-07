import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { formatDistance, formatDuration } from '../utils/navigation';

/**
 * Bannière de navigation Turn-by-Turn
 * Affiche l'instruction actuelle, la distance, et les stats globales
 */
export default function NavigationBanner({ 
  currentInstruction, 
  routeStats, 
  onClose 
}) {
  if (!currentInstruction || !currentInstruction.step) {
    return null;
  }

  const { step, distanceToStep, isImminent } = currentInstruction;
  const { currentStepIndex, totalSteps, remainingDistance, remainingDuration, progress } = routeStats;

  return (
    <View style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${Math.min(progress, 100)}%` }]} />
      </View>

      {/* Main instruction */}
      <View style={styles.mainContent}>
        <View style={styles.instructionRow}>
          {/* Icône de la manœuvre */}
          <View style={[styles.iconContainer, isImminent && styles.iconContainerImminent]}>
            <Text style={styles.icon}>{step.icon}</Text>
          </View>

          {/* Texte de l'instruction */}
          <View style={styles.textContainer}>
            <Text style={[styles.instruction, isImminent && styles.instructionImminent]} numberOfLines={2}>
              {step.instruction}
            </Text>
            {step.streetName && step.streetName !== 'unknown' && (
              <Text style={styles.streetName} numberOfLines={1}>
                {step.streetName}
              </Text>
            )}
          </View>

          {/* Distance restante jusqu'à la manœuvre */}
          <View style={styles.distanceContainer}>
            <Text style={[styles.distance, isImminent && styles.distanceImminent]}>
              {formatDistance(distanceToStep)}
            </Text>
          </View>
        </View>

        {/* Stats globales */}
        <View style={styles.statsRow}>
          <Text style={styles.statsText}>
            Étape {currentStepIndex}/{totalSteps}
          </Text>
          <Text style={styles.statsSeparator}>•</Text>
          <Text style={styles.statsText}>
            {formatDistance(remainingDistance)} restants
          </Text>
          <Text style={styles.statsSeparator}>•</Text>
          <Text style={styles.statsText}>
            {formatDuration(remainingDuration)}
          </Text>
        </View>
      </View>

      {/* Bouton fermer */}
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeButtonText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1e293b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3b82f6',
  },
  mainContent: {
    padding: 16,
    paddingTop: 12,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconContainer: {
    width: 56,
    height: 56,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconContainerImminent: {
    backgroundColor: '#f59e0b',
  },
  icon: {
    fontSize: 32,
    color: '#fff',
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  instruction: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  instructionImminent: {
    color: '#fbbf24',
  },
  streetName: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  distanceContainer: {
    alignItems: 'flex-end',
  },
  distance: {
    fontSize: 24,
    fontWeight: '800',
    color: '#3b82f6',
  },
  distanceImminent: {
    color: '#f59e0b',
    fontSize: 28,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  statsText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
  },
  statsSeparator: {
    fontSize: 13,
    color: '#475569',
    marginHorizontal: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#94a3b8',
    fontWeight: '600',
  },
});
