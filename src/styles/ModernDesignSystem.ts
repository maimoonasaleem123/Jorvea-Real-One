import { Dimensions, Platform } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Modern Design System with your beautiful turquoise color #10fedb
export const designSystem = {
  // Colors - Your beautiful turquoise theme
  colors: {
    primary: '#10fedb',
    primaryDark: '#0dd4b8',
    primaryLight: '#5cfee6',
    primaryGlow: 'rgba(16, 254, 219, 0.3)',
    
    secondary: '#8b5cf6',
    accent: '#ff6b9d',
    
    // Gradients with your color
    gradients: {
      primary: ['#10fedb', '#0dd4b8'],
      secondary: ['#8b5cf6', '#a78bfa'],
      sunset: ['#ff6b9d', '#10fedb'],
      ocean: ['#10fedb', '#60a5fa'],
      neon: ['#10fedb', '#8b5cf6', '#ff6b9d'],
      glass: ['rgba(16, 254, 219, 0.1)', 'rgba(139, 92, 246, 0.1)'],
    },
    
    // Semantic colors
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
    
    // Background hierarchy
    background: {
      primary: '#FFFFFF',
      secondary: '#FAFBFC',
      tertiary: '#F8FAFC',
      elevated: '#FFFFFF',
    },
    
    // Text hierarchy
    text: {
      primary: '#1A202C',
      secondary: '#4A5568',
      tertiary: '#718096',
      disabled: '#A0AEC0',
      inverse: '#FFFFFF',
    },
    
    // Border colors
    border: {
      light: '#F7FAFC',
      default: '#E2E8F0',
      dark: '#CBD5E1',
      primary: '#10fedb',
    },
    
    // Interactive states
    interactive: {
      hover: 'rgba(16, 254, 219, 0.1)',
      pressed: 'rgba(16, 254, 219, 0.2)',
      disabled: '#F7FAFC',
    },
  },

  // Typography Scale
  typography: {
    // Font families
    fonts: {
      regular: Platform.OS === 'ios' ? 'SF Pro Display' : 'Roboto',
      medium: Platform.OS === 'ios' ? 'SF Pro Display Medium' : 'Roboto Medium',
      semibold: Platform.OS === 'ios' ? 'SF Pro Display Semibold' : 'Roboto Medium',
      bold: Platform.OS === 'ios' ? 'SF Pro Display Bold' : 'Roboto Bold',
    },
    
    // Font sizes
    sizes: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      '3xl': 30,
      '4xl': 36,
      '5xl': 48,
      '6xl': 60,
    },
    
    // Line heights
    lineHeights: {
      tight: 1.2,
      snug: 1.375,
      normal: 1.5,
      relaxed: 1.625,
      loose: 2,
    },
    
    // Letter spacing
    letterSpacing: {
      tighter: -0.05,
      tight: -0.025,
      normal: 0,
      wide: 0.025,
      wider: 0.05,
      widest: 0.1,
    },
  },

  // Spacing Scale
  spacing: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
    20: 80,
    24: 96,
    32: 128,
  },

  // Border Radius
  radius: {
    none: 0,
    sm: 4,
    default: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    full: 9999,
  },

  // Shadows with your turquoise glow
  shadows: {
    sm: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    default: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8,
    },
    // Special glow effect with your color
    glow: {
      shadowColor: '#10fedb',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
    primaryGlow: {
      shadowColor: '#10fedb',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 12,
    },
  },

  // Animation durations
  animation: {
    fast: 150,
    normal: 250,
    slow: 350,
    slower: 500,
  },

  // Layout constants
  layout: {
    screenWidth,
    screenHeight,
    headerHeight: Platform.OS === 'ios' ? 88 : 56,
    tabBarHeight: Platform.OS === 'ios' ? 83 : 56,
    statusBarHeight: Platform.OS === 'ios' ? 44 : 24,
    borderWidth: 1,
    dividerHeight: 0.5,
  },

  // Component variants
  components: {
    button: {
      height: {
        sm: 32,
        md: 40,
        lg: 48,
        xl: 56,
      },
      padding: {
        sm: { paddingHorizontal: 12, paddingVertical: 6 },
        md: { paddingHorizontal: 16, paddingVertical: 8 },
        lg: { paddingHorizontal: 20, paddingVertical: 12 },
        xl: { paddingHorizontal: 24, paddingVertical: 16 },
      },
    },
    input: {
      height: {
        sm: 36,
        md: 44,
        lg: 52,
      },
      padding: {
        horizontal: 16,
        vertical: 12,
      },
    },
    card: {
      padding: {
        sm: 12,
        md: 16,
        lg: 20,
        xl: 24,
      },
    },
  },
};

// Helper functions for creating beautiful components
export const createGradient = (colors: string[], angle = 0) => ({
  colors,
  angle,
});

export const createShadow = (color = '#000000', opacity = 0.1, radius = 4, elevation = 2) => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: opacity,
  shadowRadius: radius,
  elevation,
});

export const createGlowEffect = (color = '#10fedb', intensity = 0.3) => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: intensity,
  shadowRadius: 12,
  elevation: 8,
});

// Pre-built beautiful styles
export const beautifulStyles = {
  // Glass morphism effect
  glassMorphism: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: designSystem.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    ...designSystem.shadows.md,
  },
  
  // Neon glow card
  neonCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: designSystem.radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(16, 254, 219, 0.2)',
    ...createGlowEffect('#10fedb', 0.2),
  },
  
  // Primary button with glow
  primaryButton: {
    backgroundColor: '#10fedb',
    borderRadius: designSystem.radius.lg,
    height: designSystem.components.button.height.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...createGlowEffect('#10fedb', 0.3),
  },
  
  // Floating action button
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10fedb',
    justifyContent: 'center',
    alignItems: 'center',
    ...designSystem.shadows.lg,
    ...createGlowEffect('#10fedb', 0.4),
  },
  
  // Modern input
  modernInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: designSystem.radius.lg,
    height: designSystem.components.input.height.lg,
    paddingHorizontal: designSystem.spacing[4],
    borderWidth: 1,
    borderColor: 'transparent',
    fontSize: designSystem.typography.sizes.base,
    color: designSystem.colors.text.primary,
  } as const,
  
  // Focus state for inputs
  focusedInput: {
    borderColor: '#10fedb',
    backgroundColor: '#FFFFFF',
    ...createGlowEffect('#10fedb', 0.1),
  },
};

export default designSystem;
