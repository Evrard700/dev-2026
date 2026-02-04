import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { colors, borderRadius, shadows } from '../styles/glassmorphism';

// Import BlurView only for native platforms
let BlurView = null;
if (Platform.OS !== 'web') {
  try {
    BlurView = require('expo-blur').BlurView;
  } catch (e) {
    // BlurView not available
  }
}

export default function GlassCard({ children, style, intensity = 20 }) {
  const containerStyle = [styles.card, style];

  // Use BlurView on native, simple transparency on web
  if (Platform.OS !== 'web' && BlurView) {
    return (
      <BlurView intensity={intensity} tint="dark" style={containerStyle}>
        {children}
      </BlurView>
    );
  }

  // Web fallback with backdrop-filter
  return (
    <View style={[containerStyle, styles.webGlass]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.glassLight,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    ...shadows.md,
    overflow: 'hidden',
  },
  webGlass: {
    // Web-specific: will apply backdrop-filter via CSS if needed
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});
