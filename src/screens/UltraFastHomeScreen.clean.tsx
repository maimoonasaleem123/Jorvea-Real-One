import React, { memo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Text,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { InstagramFastFeed } from '../components/InstagramFastFeed';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

// Simple fast header with chat and notifications
const FastHeader = memo(() => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  
  return (
    <View style={[styles.header, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Jorvea</Text>
      
      <View style={styles.headerActions}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate('ChatListScreen')}
        >
          <Icon name="chatbubbles-outline" size={24} color={colors.text} />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate('NotificationsScreen')}
        >
          <Icon name="notifications-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

// Ultra-fast home screen - only posts feed with chat and notifications
export const UltraFastHomeScreen: React.FC = () => {
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  
  const onRefresh = async () => {
    setRefreshing(true);
    // Quick refresh - don't wait for everything
    setTimeout(() => setRefreshing(false), 500);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <FastHeader />
      
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Instant posts feed - loads first, backgrounds load later */}
        <InstagramFastFeed />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: 16,
    padding: 4,
  },
  content: {
    flex: 1,
  },
});
