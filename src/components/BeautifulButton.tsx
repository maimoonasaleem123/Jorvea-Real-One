import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../context/ThemeContext';

interface BeautifulButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  gradient?: boolean;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const BeautifulButton: React.FC<BeautifulButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  gradient = false,
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}) => {
  const { colors } = useTheme();

  const getButtonStyle = (): ViewStyle => {
    const baseStyle = styles[size];
    
    switch (variant) {
      case 'primary':
        return {
          ...baseStyle,
          backgroundColor: colors.primary,
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 8,
        };
      case 'secondary':
        return {
          ...baseStyle,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        };
      case 'outline':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderColor: colors.primary,
        };
      case 'ghost':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
        };
      default:
        return baseStyle;
    }
  };

  const getTextStyle = (): TextStyle => {
    const baseTextStyle = styles[`${size}Text` as keyof typeof styles] as TextStyle;
    
    switch (variant) {
      case 'primary':
        return {
          ...baseTextStyle,
          color: '#FFFFFF',
          fontWeight: '600',
        };
      case 'secondary':
        return {
          ...baseTextStyle,
          color: colors.text,
          fontWeight: '500',
        };
      case 'outline':
        return {
          ...baseTextStyle,
          color: colors.primary,
          fontWeight: '600',
        };
      case 'ghost':
        return {
          ...baseTextStyle,
          color: colors.primary,
          fontWeight: '500',
        };
      default:
        return baseTextStyle;
    }
  };

  const buttonStyle = getButtonStyle();
  const textStyleCombined = { ...getTextStyle(), ...textStyle };

  const ButtonContent = () => (
    <TouchableOpacity
      style={[
        buttonStyle,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator 
          size="small" 
          color={variant === 'primary' ? '#FFFFFF' : colors.primary} 
        />
      ) : (
        <>
          {icon}
          <Text style={textStyleCombined}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );

  if (gradient && variant === 'primary') {
    return (
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[buttonStyle, style]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity
          style={styles.gradientInner}
          onPress={onPress}
          disabled={disabled || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              {icon}
              <Text style={[textStyleCombined, { color: '#FFFFFF' }]}>{title}</Text>
            </>
          )}
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  return <ButtonContent />;
};

const styles = StyleSheet.create({
  // Size variants
  sm: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  md: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  lg: {
    height: 52,
    paddingHorizontal: 24,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  
  // Text size variants
  smText: {
    fontSize: 14,
    letterSpacing: 0.3,
  },
  mdText: {
    fontSize: 16,
    letterSpacing: 0.4,
  },
  lgText: {
    fontSize: 18,
    letterSpacing: 0.5,
  },
  
  // States
  disabled: {
    opacity: 0.5,
  },
  gradientInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});

export default BeautifulButton;
