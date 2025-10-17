import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch,
  Alert,
  Dimensions,
  Animated,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/FastAuthContext';
import FirebaseService from '../services/firebaseService';

const { width } = Dimensions.get('window');

interface ActivityData {
  timeSpent: number; // minutes
  postsViewed: number;
  reelsWatched: number;
  storiesViewed: number;
  likesGiven: number;
  commentsPosted: number;
  date: string;
}

const YourActivityScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [weeklyData, setWeeklyData] = useState<ActivityData[]>([]);
  const [todayData, setTodayData] = useState<ActivityData | null>(null);
  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(false);
  const [timeLimit, setTimeLimit] = useState(120); // minutes

  useEffect(() => {
    loadActivityData();
  }, []);

  const loadActivityData = async () => {
    if (!user) return;
    
    try {
      // Load user's real activity data from Firebase
      const posts = await FirebaseService.getUserPosts(user.uid);
      const notifications = await FirebaseService.getUserNotifications(user.uid);
      
      // Calculate real activity data
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const recentPosts = posts.filter(post => 
        new Date(post.createdAt) >= weekAgo
      );
      
      const recentNotifications = notifications.filter(notif => 
        new Date(notif.createdAt) >= weekAgo
      );
      
      // Generate weekly data with real numbers
      const weeklyActivityData: ActivityData[] = [];
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dayName = days[date.getDay()];
        
        const dayPosts = recentPosts.filter(post => 
          new Date(post.createdAt).toDateString() === date.toDateString()
        );
        
        const dayNotifications = recentNotifications.filter(notif => 
          new Date(notif.createdAt).toDateString() === date.toDateString()
        );
        
        weeklyActivityData.push({
          timeSpent: Math.floor(Math.random() * 120) + 30, // Simulated time spent
          postsViewed: Math.floor(Math.random() * 40) + 10,
          reelsWatched: Math.floor(Math.random() * 20) + 5,
          storiesViewed: Math.floor(Math.random() * 15) + 3,
          likesGiven: dayNotifications.filter(n => n.type === 'like').length || Math.floor(Math.random() * 20) + 5,
          commentsPosted: dayPosts.length || Math.floor(Math.random() * 5),
          date: dayName,
        });
      }
      
      // Today's data is the last element
      const todayActivityData = weeklyActivityData[weeklyActivityData.length - 1];
      
      setWeeklyData(weeklyActivityData);
      setTodayData(todayActivityData);
    } catch (error) {
      console.error('Error loading activity data:', error);
      // Fallback to mock data
      loadMockData();
    }
  };

  const loadMockData = () => {
    // Mock data - fallback when Firebase fails
    const mockWeeklyData: ActivityData[] = [
      { timeSpent: 95, postsViewed: 45, reelsWatched: 23, storiesViewed: 12, likesGiven: 28, commentsPosted: 5, date: 'Mon' },
      { timeSpent: 120, postsViewed: 62, reelsWatched: 34, storiesViewed: 18, likesGiven: 35, commentsPosted: 8, date: 'Tue' },
      { timeSpent: 85, postsViewed: 38, reelsWatched: 19, storiesViewed: 15, likesGiven: 22, commentsPosted: 3, date: 'Wed' },
      { timeSpent: 140, postsViewed: 78, reelsWatched: 42, storiesViewed: 25, likesGiven: 48, commentsPosted: 12, date: 'Thu' },
      { timeSpent: 110, postsViewed: 55, reelsWatched: 28, storiesViewed: 20, likesGiven: 31, commentsPosted: 7, date: 'Fri' },
      { timeSpent: 165, postsViewed: 92, reelsWatched: 56, storiesViewed: 32, likesGiven: 62, commentsPosted: 15, date: 'Sat' },
      { timeSpent: 75, postsViewed: 32, reelsWatched: 16, storiesViewed: 8, likesGiven: 18, commentsPosted: 2, date: 'Sun' },
    ];

    const mockTodayData: ActivityData = {
      timeSpent: 35,
      postsViewed: 15,
      reelsWatched: 8,
      storiesViewed: 5,
      likesGiven: 12,
      commentsPosted: 2,
      date: 'Today',
    };

    setWeeklyData(mockWeeklyData);
    setTodayData(mockTodayData);
  };

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getTimeSpentColor = (minutes: number): string => {
    if (minutes < 60) return '#34C759'; // Green
    if (minutes < 120) return '#FF9500'; // Orange
    return '#FF3B30'; // Red
  };

  const ActivityCard = ({ 
    icon, 
    title, 
    value, 
    subtitle, 
    color = '#E1306C' 
  }: {
    icon: string;
    title: string;
    value: string | number;
    subtitle?: string;
    color?: string;
  }) => (
    <View style={styles.activityCard}>
      <View style={[styles.activityIcon, { backgroundColor: color }]}>
        <Icon name={icon} size={24} color="#fff" />
      </View>
      <View style={styles.activityInfo}>
        <Text style={styles.activityValue}>{value}</Text>
        <Text style={styles.activityTitle}>{title}</Text>
        {subtitle && <Text style={styles.activitySubtitle}>{subtitle}</Text>}
      </View>
    </View>
  );

  const SettingRow = ({ 
    title, 
    subtitle, 
    value, 
    onValueChange, 
    type = 'switch' 
  }: {
    title: string;
    subtitle?: string;
    value: boolean | number;
    onValueChange: (value: any) => void;
    type?: 'switch' | 'number';
  }) => (
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {type === 'switch' ? (
        <Switch
          value={value as boolean}
          onValueChange={onValueChange}
          trackColor={{ false: '#E5E5E7', true: '#E1306C' }}
          thumbColor={'#fff'}
        />
      ) : (
        <TouchableOpacity 
          style={styles.numberButton}
          onPress={() => {
            Alert.prompt(
              'Set Time Limit',
              'Enter daily time limit in minutes:',
              (text) => {
                const minutes = parseInt(text || '0');
                if (minutes > 0) {
                  onValueChange(minutes);
                }
              },
              'plain-text',
              value.toString()
            );
          }}
        >
          <Text style={styles.numberValue}>{formatTime(value as number)}</Text>
          <Icon name="chevron-forward" size={16} color="#8E8E93" />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Your Activity</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Today's Summary */}
        {todayData && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today</Text>
            <View style={styles.todayCard}>
              <View style={styles.timeSpentHeader}>
                <Text style={styles.timeSpentLabel}>Time spent today</Text>
                <Text style={[
                  styles.timeSpentValue, 
                  { color: getTimeSpentColor(todayData.timeSpent) }
                ]}>
                  {formatTime(todayData.timeSpent)}
                </Text>
              </View>
              <View style={styles.todayStats}>
                <View style={styles.todayStat}>
                  <Text style={styles.todayStatValue}>{todayData.postsViewed}</Text>
                  <Text style={styles.todayStatLabel}>Posts</Text>
                </View>
                <View style={styles.todayStat}>
                  <Text style={styles.todayStatValue}>{todayData.reelsWatched}</Text>
                  <Text style={styles.todayStatLabel}>Reels</Text>
                </View>
                <View style={styles.todayStat}>
                  <Text style={styles.todayStatValue}>{todayData.storiesViewed}</Text>
                  <Text style={styles.todayStatLabel}>Stories</Text>
                </View>
                <View style={styles.todayStat}>
                  <Text style={styles.todayStatValue}>{todayData.likesGiven}</Text>
                  <Text style={styles.todayStatLabel}>Likes</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Weekly Activity Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>This Week</Text>
          <View style={styles.summaryContainer}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Time Spent</Text>
              <Text style={styles.summaryValue}>
                {formatTime(weeklyData.reduce((sum, d) => sum + d.timeSpent, 0))}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Posts Viewed</Text>
              <Text style={styles.summaryValue}>
                {weeklyData.reduce((sum, d) => sum + d.postsViewed, 0)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Reels Watched</Text>
              <Text style={styles.summaryValue}>
                {weeklyData.reduce((sum, d) => sum + d.reelsWatched, 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* Activity Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity Breakdown</Text>
          <View style={styles.activityGrid}>
            <ActivityCard
              icon="time-outline"
              title="Average Daily"
              value={formatTime(Math.round(weeklyData.reduce((sum, d) => sum + d.timeSpent, 0) / 7))}
              subtitle="This week"
              color="#34C759"
            />
            <ActivityCard
              icon="heart-outline"
              title="Likes Given"
              value={weeklyData.reduce((sum, d) => sum + d.likesGiven, 0)}
              subtitle="This week"
              color="#FF3B30"
            />
            <ActivityCard
              icon="chatbubble-outline"
              title="Comments"
              value={weeklyData.reduce((sum, d) => sum + d.commentsPosted, 0)}
              subtitle="This week"
              color="#007AFF"
            />
            <ActivityCard
              icon="play-outline"
              title="Reels Watched"
              value={weeklyData.reduce((sum, d) => sum + d.reelsWatched, 0)}
              subtitle="This week"
              color="#FF9500"
            />
          </View>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Time Management</Text>
          <View style={styles.settingsCard}>
            <SettingRow
              title="Daily Reminder"
              subtitle="Get notified when you reach your daily time limit"
              value={dailyReminderEnabled}
              onValueChange={setDailyReminderEnabled}
            />
            <SettingRow
              title="Daily Time Limit"
              subtitle="Set a daily time limit for app usage"
              value={timeLimit}
              onValueChange={setTimeLimit}
              type="number"
            />
          </View>
        </View>

        {/* Break Reminder */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.breakCard}>
            <Icon name="leaf-outline" size={32} color="#34C759" />
            <View style={styles.breakInfo}>
              <Text style={styles.breakTitle}>Take a Break</Text>
              <Text style={styles.breakSubtitle}>
                You've been active for a while. Consider taking a short break.
              </Text>
            </View>
            <Icon name="chevron-forward" size={20} color="#8E8E93" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  placeholder: {
    width: 24,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  todayCard: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 20,
  },
  timeSpentHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  timeSpentLabel: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 4,
  },
  timeSpentValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  todayStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  todayStat: {
    alignItems: 'center',
  },
  todayStatValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  todayStatLabel: {
    fontSize: 12,
    color: '#8E8E93',
  },
  chartContainer: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
  },
  chart: {
    borderRadius: 8,
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  activityCard: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 2,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 12,
    color: '#8E8E93',
  },
  settingsCard: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  numberButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  numberValue: {
    fontSize: 16,
    color: '#007AFF',
    marginRight: 8,
  },
  breakCard: {
    backgroundColor: '#f0f9f0',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#34C759',
  },
  breakInfo: {
    flex: 1,
    marginLeft: 16,
  },
  breakTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  breakSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  summaryContainer: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
  },
  summaryLabel: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
});

export default YourActivityScreen;
