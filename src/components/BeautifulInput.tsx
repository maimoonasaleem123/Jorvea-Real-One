import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../context/ThemeContext';

interface BeautifulInputProps {
  placeholder?: string;
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  multiline?: boolean;
  numberOfLines?: number;
  editable?: boolean;
  icon?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
  error?: string;
  maxLength?: number;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  gradient?: boolean;
  variant?: 'default' | 'filled' | 'outline' | 'underline';
}

export const BeautifulInput: React.FC<BeautifulInputProps> = ({
  placeholder,
  label,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default',
  multiline = false,
  numberOfLines = 1,
  editable = true,
  icon,
  rightIcon,
  onRightIconPress,
  error,
  maxLength,
  style,
  inputStyle,
  gradient = false,
  variant = 'default',
}) => {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const animatedValue = useRef(new Animated.Value(0)).current;
  const borderColor = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setIsFocused(true);
    Animated.parallel([
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(borderColor, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handleBlur = () => {
    setIsFocused(false);
    Animated.parallel([
      Animated.timing(animatedValue, {
        toValue: value ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(borderColor, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const getContainerStyle = (): ViewStyle => {
    const baseStyle = {
      marginBottom: 16,
    };

    switch (variant) {
      case 'filled':
        return {
          ...baseStyle,
          backgroundColor: colors.surface,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: 'transparent',
        };
      case 'outline':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          borderRadius: 12,
          borderWidth: 2,
          borderColor: colors.border,
        };
      case 'underline':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          borderBottomWidth: 2,
          borderBottomColor: colors.border,
        };
      default:
        return {
          ...baseStyle,
          backgroundColor: colors.surface,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: 'transparent',
        };
    }
  };

  const animatedBorderColor = borderColor.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
  });

  const labelTranslateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  const labelScale = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.85],
  });

  const InputContent = () => (
    <Animated.View
      style={[
        getContainerStyle(),
        {
          borderColor: animatedBorderColor,
        },
        isFocused && styles.focused,
        error && styles.error,
        style,
      ]}
    >
      <View style={styles.inputContainer}>
        {icon && (
          <View style={styles.iconContainer}>
            <Icon name={icon} size={20} color={isFocused ? colors.primary : colors.textSecondary} />
          </View>
        )}

        <View style={styles.textContainer}>
          {label && (
            <Animated.Text
              style={[
                styles.label,
                {
                  color: isFocused ? colors.primary : colors.textSecondary,
                  transform: [
                    { translateY: labelTranslateY },
                    { scale: labelScale },
                  ],
                },
              ]}
            >
              {label}
            </Animated.Text>
          )}

          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                marginTop: label ? 8 : 0,
              },
              inputStyle,
            ]}
            value={value}
            onChangeText={onChangeText}
            placeholder={!label ? placeholder : ''}
            placeholderTextColor={colors.placeholder}
            secureTextEntry={secureTextEntry && !showPassword}
            keyboardType={keyboardType}
            multiline={multiline}
            numberOfLines={numberOfLines}
            editable={editable}
            onFocus={handleFocus}
            onBlur={handleBlur}
            maxLength={maxLength}
            selectionColor={colors.primary}
          />
        </View>

        {(rightIcon || secureTextEntry) && (
          <TouchableOpacity
            style={styles.rightIconContainer}
            onPress={secureTextEntry ? () => setShowPassword(!showPassword) : onRightIconPress}
          >
            <Icon
              name={
                secureTextEntry
                  ? showPassword
                    ? 'eye-outline'
                    : 'eye-off-outline'
                  : rightIcon || 'chevron-forward-outline'
              }
              size={20}
              color={isFocused ? colors.primary : colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Icon name="alert-circle-outline" size={16} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </View>
      )}

      {maxLength && (
        <Text style={[styles.counterText, { color: colors.textMuted }]}>
          {value.length}/{maxLength}
        </Text>
      )}
    </Animated.View>
  );

  if (gradient && isFocused) {
    return (
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={styles.gradientBorder}
      >
        <View style={styles.gradientInner}>
          <InputContent />
        </View>
      </LinearGradient>
    );
  }

  return <InputContent />;
};

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 52,
  },
  textContainer: {
    flex: 1,
    position: 'relative',
  },
  label: {
    position: 'absolute',
    fontSize: 14,
    fontWeight: '500',
    zIndex: 1,
  },
  input: {
    fontSize: 16,
    fontWeight: '400',
    minHeight: 24,
    paddingVertical: 0,
  },
  iconContainer: {
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightIconContainer: {
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  focused: {
    shadowColor: '#10fedb',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  error: {
    borderColor: '#EF4444',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 16,
    gap: 4,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '400',
  },
  counterText: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
    paddingHorizontal: 16,
  },
  gradientBorder: {
    borderRadius: 14,
    padding: 2,
  },
  gradientInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
});

export default BeautifulInput;
