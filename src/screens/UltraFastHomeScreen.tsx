import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import Icon from 'react-native-vector-icons/Ionicons';
import { InstagramFastFeed } from '../components/InstagramFastFeed';

const UltraFastHomeScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.background,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border,
    },
    logoContainer: {
      flex: 1,
    },
    logoText: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
      letterSpacing: -0.5,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    actionButton: {
      padding: 8,
    },
    feedContainer: {
      flex: 1,
    },
  }), [colors]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Single Clean Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>Jorvea</Text>
        </View>
        
        <View style={styles.headerActions}>
          {/* Chat Button */}
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
              console.log('💬 Chat button pressed in UltraFastHomeScreen');
              try {
                navigation.navigate('ChatList');
                console.log('✅ Navigation to ChatList successful');
              } catch (error) {
                console.error('❌ Chat navigation error:', error);
              }
            }}
          >
            <Icon 
              name="chatbubble-outline" 
              size={24} 
              color={colors.text} 
            />
          </TouchableOpacity>

          {/* Notifications Button */}
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
              console.log('🔔 Notifications button pressed in UltraFastHomeScreen');
              try {
                navigation.navigate('Notifications');
                console.log('✅ Navigation to Notifications successful');
              } catch (error) {
                console.error('❌ Notifications navigation error:', error);
              }
            }}
          >
            <Icon 
              name="heart-outline" 
              size={24} 
              color={colors.text} 
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Direct Feed - No Tabs */}
      <View style={styles.feedContainer}>
        <InstagramFastFeed />
      </View>
    </SafeAreaView>
  );
};

export default UltraFastHomeScreen;
