import React, { useRef, useEffect } from 'react';
import { TextInput, StyleSheet, Animated } from 'react-native';
import { colors, glassInput, spacing } from '../styles/glassmorphism';

export default function GlassInput({ 
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  style,
  ...props
}) {
  const focusAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    Animated.spring(focusAnim, {
      toValue: 1,
      useNativeDriver: false,
      damping: 15,
      stiffness: 150,
    }).start();
  };

  const handleBlur = () => {
    Animated.spring(focusAnim, {
      toValue: 0,
      useNativeDriver: false,
      damping: 15,
      stiffness: 150,
    }).start();
  };

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.2)', colors.primary],
  });

  const animatedStyle = {
    borderColor,
  };

  return (
    <Animated.View style={[styles.container, animatedStyle, style]}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...glassInput,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  input: {
    color: colors.textPrimary,
    fontSize: 16,
    padding: 0,
  },
});
