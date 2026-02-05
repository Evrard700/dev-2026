import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react';
import GlassCard from './GlassCard';
import { colors, spacing, borderRadius } from '../styles/glassmorphism';

export function MapStyleButton({ currentStyle, onPress, style }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true,
      damping: 15,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 15,
    }).start();
  };

  const getStyleIcon = () => {
    switch (currentStyle) {
      case 'satellite': return '🛰️';
      case 'nav': return '🧭';
      case '3d': return '🏔️';
      default: return '🗺️';
    }
  };

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.8}
      >
        <GlassCard style={styles.controlBtn}>
          <Text style={styles.controlIcon}>{getStyleIcon()}</Text>
        </GlassCard>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function PositionButton({ onPress, style }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true,
      damping: 15,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 15,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.8}
      >
        <GlassCard style={styles.controlBtn}>
          <Text style={styles.controlIcon}>📍</Text>
        </GlassCard>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function ZoomControls({ onZoomIn, onZoomOut, style }) {
  const zoomInScale = useRef(new Animated.Value(1)).current;
  const zoomOutScale = useRef(new Animated.Value(1)).current;

  const animateButton = (anim, action) => {
    Animated.sequence([
      Animated.spring(anim, {
        toValue: 0.9,
        useNativeDriver: true,
        damping: 15,
      }),
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 15,
      }),
    ]).start();
    action();
  };

  return (
    <View style={[styles.zoomContainer, style]}>
      <Animated.View style={{ transform: [{ scale: zoomInScale }] }}>
        <TouchableOpacity
          onPress={() => animateButton(zoomInScale, onZoomIn)}
          activeOpacity={0.8}
        >
          <GlassCard style={styles.zoomBtn}>
            <Text style={styles.zoomText}>+</Text>
          </GlassCard>
        </TouchableOpacity>
      </Animated.View>
      
      <View style={styles.zoomDivider} />
      
      <Animated.View style={{ transform: [{ scale: zoomOutScale }] }}>
        <TouchableOpacity
          onPress={() => animateButton(zoomOutScale, onZoomOut)}
          activeOpacity={0.8}
        >
          <GlassCard style={styles.zoomBtn}>
            <Text style={styles.zoomText}>−</Text>
          </GlassCard>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

export function CompassButton({ bearing = 0, onPress, style }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true,
      damping: 15,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 15,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.8}
      >
        <GlassCard style={styles.controlBtn}>
          <Text 
            style={[
              styles.controlIcon, 
              { transform: [{ rotate: `${-bearing}deg` }] }
            ]}
          >
            ⬆️
          </Text>
        </GlassCard>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  controlBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  controlIcon: {
    fontSize: 24,
  },
  zoomContainer: {
    overflow: 'hidden',
  },
  zoomBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    borderRadius: 0,
  },
  zoomText: {
    fontSize: 28,
    fontWeight: '300',
    color: colors.textPrimary,
  },
  zoomDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});
