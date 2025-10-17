import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, Platform, Image } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MainTabParamList } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/FastAuthContext';

// Import main screens (we'll create these)
import UltraFastHomeScreen from '../screens/UltraFastHomeScreen';
import ProgressiveSearchScreen from '../screens/ProgressiveSearchScreen';
import PerfectSearchScreen from '../screens/PerfectSearchScreen';
import CreateScreen from '../screens/CreateScreen';
import ReelsScreen from '../screens/ReelsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PerfectChatListScreen from '../screens/PerfectChatListScreen';
import CallManager from '../components/CallManager';

const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabNavigator(): React.JSX.Element {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  return (
    <>
      <Tab.Navigator
        id={undefined}
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => {
            let iconName = '';

            switch (route.name) {
              case 'Home':
                iconName = focused ? 'home' : 'home-outline';
                break;
              case 'Search':
                iconName = focused ? 'search' : 'search-outline';
                break;
              case 'Create':
                iconName = 'add-outline';
                break;
              case 'Reels':
                iconName = focused ? 'play' : 'play-outline';
                break;
              case 'Profile':
                // Special handling for profile - show user's profile picture
                return (
                  <View style={styles.profileIconContainer}>
                    {user?.profilePicture ? (
                      <Image 
                        source={{ uri: user.profilePicture }} 
                        style={[
                          styles.profileImage,
                          focused && styles.profileImageActive
                        ]} 
                      />
                    ) : (
                      <View style={[
                        styles.defaultProfileIcon,
                        focused && styles.defaultProfileIconActive,
                        { backgroundColor: focused ? colors.primary : colors.textSecondary }
                      ]}>
                        <Icon name="person" size={18} color="#ffffff" />
                      </View>
                    )}
                  </View>
                );
            }

            // Instagram-like Create tab with simple plus
            if (route.name === 'Create') {
              return (
                <View style={styles.createIcon}>
                  <Icon 
                    name="add-outline" 
                    size={28} 
                    color={color} 
                    style={{ fontWeight: 'bold' }}
                  />
                </View>
              );
            }

            return (
              <View style={styles.iconContainer}>
                <Icon name={iconName} size={24} color={color} />
              </View>
            );
          },
          tabBarActiveTintColor: '#262626',
          tabBarInactiveTintColor: '#8e8e8e',
          tabBarStyle: {
            backgroundColor: '#ffffff',
            borderTopWidth: 0.5,
            borderTopColor: 'rgba(0,0,0,0.1)',
            paddingBottom: Platform.OS === 'android' ? Math.max(8, insets.bottom) : Math.max(4, insets.bottom),
            paddingTop: 8,
            height: Platform.OS === 'android' 
              ? 60 + Math.max(0, insets.bottom)
              : 55 + Math.max(0, insets.bottom),
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            marginTop: 4,
          },
          tabBarShowLabel: false, // Instagram doesn't show labels
        })}
      >
        <Tab.Screen
          name="Home"
          component={UltraFastHomeScreen}
          options={{}}
        />
        <Tab.Screen
          name="Search"
          component={PerfectSearchScreen}
          options={{}}
        />
        <Tab.Screen
          name="Create"
          component={CreateScreen}
          options={{}}
        />
        <Tab.Screen
          name="Reels"
          component={ReelsScreen}
          options={{}}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{}}
        />
      </Tab.Navigator>
      
      {/* Call Manager for handling incoming calls globally */}
      <CallManager />
    </>
  );
}

export default MainTabNavigator;

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  createIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10fedb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  createIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderWidth: 1.5,
    borderColor: '#262626',
    borderRadius: 8,
  },
  profileIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  profileImage: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  profileImageActive: {
    borderColor: '#262626',
    borderWidth: 2,
  },
  defaultProfileIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  defaultProfileIconActive: {
    borderColor: '#262626',
    borderWidth: 2,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -6,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
