import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, ColorSchemeName } from 'react-native';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  colors: typeof lightColors | typeof darkColors;
}

const lightColors = {
  primary: '#10fedb',
  primaryDark: '#0dd4b8',
  primaryLight: '#5cfee6',
  secondary: '#8b5cf6',
  accent: '#ff6b9d',
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  background: '#FFFFFF',
  backgroundSoft: '#FAFBFC',
  surface: '#F8FAFC',
  surfaceElevated: '#FFFFFF',
  card: '#FFFFFF',
  cardShadow: 'rgba(16, 254, 219, 0.1)',
  text: '#1A202C',
  textSecondary: '#4A5568',
  textMuted: '#718096',
  border: '#E2E8F0',
  borderLight: '#F7FAFC',
  placeholder: '#A0AEC0',
  shadow: 'rgba(0,0,0,0.08)',
  shadowDark: 'rgba(0,0,0,0.12)',
  overlay: 'rgba(0,0,0,0.4)',
  gradientStart: '#10fedb',
  gradientEnd: '#8b5cf6',
  gradientDark: '#0dd4b8',
  storyBorder: ['#10fedb', '#ff6b9d', '#8b5cf6', '#34C759', '#FF9500', '#FF6B6B', '#54A0FF'],
  glass: 'rgba(255,255,255,0.8)',
  glassBlur: 'rgba(255,255,255,0.25)',
};

const darkColors = {
  primary: '#10fedb',
  primaryDark: '#0dd4b8',
  primaryLight: '#5cfee6',
  secondary: '#a78bfa',
  accent: '#ff8fab',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  background: '#0F172A',
  backgroundSoft: '#1E293B',
  surface: '#1E293B',
  surfaceElevated: '#334155',
  card: '#1E293B',
  cardShadow: 'rgba(16, 254, 219, 0.2)',
  text: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  border: '#334155',
  borderLight: '#475569',
  placeholder: '#64748B',
  shadow: 'rgba(0,0,0,0.3)',
  shadowDark: 'rgba(0,0,0,0.5)',
  overlay: 'rgba(0,0,0,0.7)',
  gradientStart: '#10fedb',
  gradientEnd: '#a78bfa',
  gradientDark: '#0dd4b8',
  storyBorder: ['#10fedb', '#ff8fab', '#a78bfa', '#10B981', '#F59E0B', '#FF6B6B', '#60A5FA'],
  glass: 'rgba(30, 41, 59, 0.8)',
  glassBlur: 'rgba(30, 41, 59, 0.25)',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    loadThemePreference();
    
    // Listen for system theme changes
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      // Only auto-switch if user hasn't manually set preference
      AsyncStorage.getItem('manual_theme_set').then((manualSet) => {
        if (!manualSet) {
          setIsDarkMode(colorScheme === 'dark');
        }
      });
    });

    return () => subscription?.remove();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme_preference');
      if (savedTheme !== null) {
        setIsDarkMode(savedTheme === 'dark');
      } else {
        // Default to system theme
        const systemTheme = Appearance.getColorScheme();
        setIsDarkMode(systemTheme === 'dark');
      }
    } catch (error) {
      console.log('Error loading theme preference:', error);
    }
  };

  const toggleDarkMode = async () => {
    try {
      const newTheme = !isDarkMode;
      setIsDarkMode(newTheme);
      await AsyncStorage.setItem('theme_preference', newTheme ? 'dark' : 'light');
      await AsyncStorage.setItem('manual_theme_set', 'true');
    } catch (error) {
      console.log('Error saving theme preference:', error);
    }
  };

  const colors = isDarkMode ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export { lightColors, darkColors };
