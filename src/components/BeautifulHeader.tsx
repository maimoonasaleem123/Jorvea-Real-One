import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  StyleSheet,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface BeautifulHeaderProps {
  title?: string;
  subtitle?: string;
  leftIcon?: string;
  rightIcon?: string;
  rightIcon2?: string;
  onLeftPress?: () => void;
  onRightPress?: () => void;
  onRightPress2?: () => void;
  gradient?: boolean;
  transparent?: boolean;
  showLogo?: boolean;
  centerComponent?: React.ReactNode;
  rightComponent?: React.ReactNode;
  rightIconBadge?: number;
  rightIcon2Badge?: number;
}

export const BeautifulHeader: React.FC<BeautifulHeaderProps> = ({
  title,
  subtitle,
  leftIcon,
  rightIcon,
  rightIcon2,
  onLeftPress,
  onRightPress,
  onRightPress2,
  gradient = false,
  transparent = false,
  showLogo = false,
  centerComponent,
  rightComponent,
  rightIconBadge,
  rightIcon2Badge,
}) => {
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  // Calculate proper header height with status bar
  const headerHeight = 60 + insets.top;

  const HeaderContent = () => (
    <View style={[
      styles.container, 
      { 
        backgroundColor: transparent ? 'transparent' : colors.background,
        borderBottomColor: colors.border,
        paddingTop: insets.top, // Add safe area top padding
        height: headerHeight, // Use calculated height
      }
    ]}>
      <StatusBar
        backgroundColor={transparent ? 'transparent' : colors.background}
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        translucent={true}
      />
      
      <View style={styles.content}>
        {/* Left Section */}
        <View style={styles.leftSection}>
          {showLogo ? (
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                style={styles.logoGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.logoText}>J</Text>
              </LinearGradient>
              <Text style={[styles.appName, { color: colors.text }]}>orvea</Text>
            </View>
          ) : leftIcon ? (
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: colors.surface }]}
              onPress={onLeftPress}
              activeOpacity={0.7}
            >
              <Icon name={leftIcon} size={22} color={colors.text} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Center Section */}
        <View style={styles.centerSection}>
          {centerComponent ? centerComponent : (
            <View style={styles.titleContainer}>
              {title && (
                <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                  {title}
                </Text>
              )}
              {subtitle && (
                <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                  {subtitle}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Right Section */}
        <View style={styles.rightSection}>
          {rightComponent ? rightComponent : (
            <View style={styles.rightIcons}>
              {rightIcon && (
                <TouchableOpacity
                  style={[styles.iconButton, { backgroundColor: colors.surface }]}
                  onPress={() => {
                    console.log('🔴 BeautifulHeader rightIcon TouchableOpacity pressed!');
                    console.log('onRightPress function:', onRightPress);
                    if (onRightPress) {
                      onRightPress();
                    } else {
                      console.log('❌ onRightPress is not defined!');
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Icon name={rightIcon} size={22} color={colors.text} />
                  {rightIconBadge && rightIconBadge > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {rightIconBadge > 99 ? '99+' : rightIconBadge.toString()}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              {rightIcon2 && (
                <TouchableOpacity
                  style={[styles.iconButton, { backgroundColor: colors.surface, marginLeft: 8 }]}
                  onPress={() => {
                    console.log('🔵 BeautifulHeader rightIcon2 TouchableOpacity pressed!');
                    console.log('onRightPress2 function:', onRightPress2);
                    if (onRightPress2) {
                      onRightPress2();
                    } else {
                      console.log('❌ onRightPress2 is not defined!');
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Icon name={rightIcon2} size={22} color={colors.text} />
                  {rightIcon2Badge && rightIcon2Badge > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {rightIcon2Badge > 99 ? '99+' : rightIcon2Badge.toString()}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );

  if (gradient) {
    return (
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={styles.gradientContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={[styles.container, { backgroundColor: 'transparent', borderBottomWidth: 0 }]}>
          <StatusBar
            backgroundColor="transparent"
            barStyle="light-content"
            translucent
          />
          
          <View style={styles.content}>
            {/* Left Section */}
            <View style={styles.leftSection}>
              {showLogo ? (
                <View style={styles.logoContainer}>
                  <View style={[styles.logoGradient, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    <Text style={[styles.logoText, { color: '#FFFFFF' }]}>J</Text>
                  </View>
                  <Text style={[styles.appName, { color: '#FFFFFF' }]}>Jorvea</Text>
                </View>
              ) : leftIcon ? (
                <TouchableOpacity
                  style={[styles.iconButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                  onPress={onLeftPress}
                  activeOpacity={0.7}
                >
                  <Icon name={leftIcon} size={22} color="#FFFFFF" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Center Section */}
            <View style={styles.centerSection}>
              {centerComponent ? centerComponent : (
                <View style={styles.titleContainer}>
                  {title && (
                    <Text style={[styles.title, { color: '#FFFFFF' }]} numberOfLines={1}>
                      {title}
                    </Text>
                  )}
                  {subtitle && (
                    <Text style={[styles.subtitle, { color: 'rgba(255,255,255,0.8)' }]} numberOfLines={1}>
                      {subtitle}
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* Right Section */}
            <View style={styles.rightSection}>
              {rightComponent ? rightComponent : (
                <View style={styles.rightIcons}>
                  {rightIcon && (
                    <TouchableOpacity
                      style={[styles.iconButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                      onPress={onRightPress}
                      activeOpacity={0.7}
                    >
                      <Icon name={rightIcon} size={22} color="#FFFFFF" />
                      {rightIconBadge && rightIconBadge > 0 && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>
                            {rightIconBadge > 99 ? '99+' : rightIconBadge.toString()}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                  {rightIcon2 && (
                    <TouchableOpacity
                      style={[styles.iconButton, { backgroundColor: 'rgba(255,255,255,0.2)', marginLeft: 8 }]}
                      onPress={onRightPress2}
                      activeOpacity={0.7}
                    >
                      <Icon name={rightIcon2} size={22} color="#FFFFFF" />
                      {rightIcon2Badge && rightIcon2Badge > 0 && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>
                            {rightIcon2Badge > 99 ? '99+' : rightIcon2Badge.toString()}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </View>
        </View>
      </LinearGradient>
    );
  }

  return <HeaderContent />;
};

const styles = StyleSheet.create({
  container: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
  },
  gradientContainer: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    paddingHorizontal: 4,
  },
  leftSection: {
    flex: 1.5,
    alignItems: 'flex-start',
  },
  centerSection: {
    flex: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightSection: {
    flex: 1,
    alignItems: 'flex-end',
  },
  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10fedb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  appName: {
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
  titleContainer: {
    alignItems: 'center',
    maxWidth: '90%',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.8,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF3040',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default BeautifulHeader;
