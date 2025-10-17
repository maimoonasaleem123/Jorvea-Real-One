import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../context/ThemeContext';

interface BeautifulCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  onPress?: () => void;
  gradient?: boolean;
  glowEffect?: boolean;
  elevation?: 'none' | 'low' | 'medium' | 'high';
  variant?: 'default' | 'glass' | 'outline' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  style?: ViewStyle;
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
}

export const BeautifulCard: React.FC<BeautifulCardProps> = ({
  children,
  title,
  subtitle,
  onPress,
  gradient = false,
  glowEffect = false,
  elevation = 'medium',
  variant = 'default',
  padding = 'md',
  style,
  titleStyle,
  subtitleStyle,
}) => {
  const { colors } = useTheme();

  const getCardStyle = (): ViewStyle => {
    const baseStyle = styles.baseCard;
    
    const elevationStyles = {
      none: {},
      low: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
      },
      medium: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
      },
      high: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
      },
    };

    const variantStyles = {
      default: {
        backgroundColor: colors.card,
        borderRadius: 16,
      },
      glass: {
        backgroundColor: colors.glass,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.borderLight,
        backdropFilter: 'blur(20px)',
      },
      outline: {
        backgroundColor: 'transparent',
        borderRadius: 16,
        borderWidth: 2,
        borderColor: colors.primary,
      },
      elevated: {
        backgroundColor: colors.surfaceElevated,
        borderRadius: 20,
      },
    };

    const paddingStyles = {
      none: { padding: 0 },
      sm: { padding: 12 },
      md: { padding: 16 },
      lg: { padding: 20 },
      xl: { padding: 24 },
    };

    const glowStyles = glowEffect ? {
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    } : {};

    return {
      ...baseStyle,
      ...variantStyles[variant],
      ...elevationStyles[elevation],
      ...paddingStyles[padding],
      ...glowStyles,
    };
  };

  const CardContent = () => (
    <View style={[getCardStyle(), style]}>
      {(title || subtitle) && (
        <View style={styles.header}>
          {title && (
            <Text style={[styles.title, { color: colors.text }, titleStyle]}>
              {title}
            </Text>
          )}
          {subtitle && (
            <Text style={[styles.subtitle, { color: colors.textSecondary }, subtitleStyle]}>
              {subtitle}
            </Text>
          )}
        </View>
      )}
      {children}
    </View>
  );

  if (gradient) {
    return (
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[getCardStyle(), style]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.gradientContent}>
          {(title || subtitle) && (
            <View style={styles.header}>
              {title && (
                <Text style={[styles.title, { color: '#FFFFFF' }, titleStyle]}>
                  {title}
                </Text>
              )}
              {subtitle && (
                <Text style={[styles.subtitle, { color: 'rgba(255,255,255,0.8)' }, subtitleStyle]}>
                  {subtitle}
                </Text>
              )}
            </View>
          )}
          {children}
        </View>
      </LinearGradient>
    );
  }

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        <CardContent />
      </TouchableOpacity>
    );
  }

  return <CardContent />;
};

const styles = StyleSheet.create({
  baseCard: {
    overflow: 'hidden',
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  gradientContent: {
    flex: 1,
  },
});

export default BeautifulCard;
