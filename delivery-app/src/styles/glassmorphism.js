// iOS 18 Glassmorphism Design System
// Inspired by iOS blur effects and modern UI

export const colors = {
  // Primary colors
  primary: '#DC2626',
  primaryLight: 'rgba(220, 38, 38, 0.8)',
  primaryDark: '#991B1B',
  
  // Background gradients
  bgGradientStart: '#0F172A',
  bgGradientEnd: '#1E293B',
  
  // Glass effects
  glassLight: 'rgba(255, 255, 255, 0.1)',
  glassMedium: 'rgba(255, 255, 255, 0.15)',
  glassDark: 'rgba(0, 0, 0, 0.3)',
  
  // Text colors
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.7)',
  textTertiary: 'rgba(255, 255, 255, 0.5)',
  
  // Status colors
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  
  // Overlays
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  glow: {
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  round: 9999,
};

export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0,
  },
  bodyBold: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0,
  },
  captionBold: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0,
  },
};

// Glassmorphism card style
export const glassCard = {
  backgroundColor: colors.glassLight,
  borderRadius: borderRadius.lg,
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.2)',
  ...shadows.md,
  // Note: backdrop-filter blur not directly supported in RN
  // Will need to use BlurView component for native
};

// Glassmorphism button style
export const glassButton = {
  backgroundColor: colors.glassMedium,
  borderRadius: borderRadius.md,
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.3)',
  paddingVertical: spacing.md,
  paddingHorizontal: spacing.lg,
  ...shadows.sm,
};

// Primary button with glow
export const primaryButton = {
  backgroundColor: colors.primary,
  borderRadius: borderRadius.md,
  paddingVertical: spacing.md,
  paddingHorizontal: spacing.lg,
  ...shadows.glow,
};

// Input field glassmorphism
export const glassInput = {
  backgroundColor: 'rgba(255, 255, 255, 0.08)',
  borderRadius: borderRadius.md,
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.2)',
  paddingVertical: spacing.md,
  paddingHorizontal: spacing.md,
  color: colors.textPrimary,
  fontSize: 16,
};

// Animation configs
export const animations = {
  springConfig: {
    damping: 20,
    mass: 0.5,
    stiffness: 100,
    restSpeedThreshold: 0.001,
    restDisplacementThreshold: 0.001,
  },
  timingConfig: {
    duration: 300,
    useNativeDriver: true,
  },
  fadeIn: {
    duration: 400,
    useNativeDriver: true,
  },
  slideIn: {
    duration: 350,
    useNativeDriver: true,
  },
};
