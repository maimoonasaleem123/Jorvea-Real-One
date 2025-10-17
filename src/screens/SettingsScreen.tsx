import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Share,
  Linking,
  Image,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/FastAuthContext';
import { useTheme } from '../context/ThemeContext';
import FirebaseService from '../services/firebaseService';
import { BeautifulCard } from '../components/BeautifulCard';
import { BeautifulHeader } from '../components/BeautifulHeader';

const { width } = Dimensions.get('window');

export default function SettingsScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const { user, signOut } = useAuth();
  const { isDarkMode, toggleDarkMode, colors } = useTheme();
  const [settings, setSettings] = useState({
    notifications: true,
    privateAccount: false,
    allowMessages: true,
    showActivity: true,
    allowComments: true,
    allowMentions: true,
    allowSharing: true,
    autoplayVideos: true,
    saveOriginalPhotos: false,
    allowLocationServices: false,
    allowCameraAccess: true,
    allowMicrophoneAccess: true,
  });

  useEffect(() => {
    loadUserSettings();
  }, []);

  const loadUserSettings = async () => {
    try {
      if (user?.uid) {
        const userProfile = await FirebaseService.getUserProfile(user.uid);
        if (userProfile?.settings) {
          // Simple settings extraction for boolean values only
          const userSettings = userProfile.settings as any;
          const newSettings = { ...settings };
          
          // Only update boolean settings that exist in both objects
          if (typeof userSettings.notifications === 'boolean') newSettings.notifications = userSettings.notifications;
          if (typeof userSettings.privateAccount === 'boolean') newSettings.privateAccount = userSettings.privateAccount;
          if (typeof userSettings.allowMessages === 'boolean') newSettings.allowMessages = userSettings.allowMessages;
          if (typeof userSettings.showActivity === 'boolean') newSettings.showActivity = userSettings.showActivity;
          if (typeof userSettings.allowComments === 'boolean') newSettings.allowComments = userSettings.allowComments;
          if (typeof userSettings.allowMentions === 'boolean') newSettings.allowMentions = userSettings.allowMentions;
          if (typeof userSettings.allowSharing === 'boolean') newSettings.allowSharing = userSettings.allowSharing;
          if (typeof userSettings.autoplayVideos === 'boolean') newSettings.autoplayVideos = userSettings.autoplayVideos;
          if (typeof userSettings.saveOriginalPhotos === 'boolean') newSettings.saveOriginalPhotos = userSettings.saveOriginalPhotos;
          if (typeof userSettings.allowLocationServices === 'boolean') newSettings.allowLocationServices = userSettings.allowLocationServices;
          if (typeof userSettings.allowCameraAccess === 'boolean') newSettings.allowCameraAccess = userSettings.allowCameraAccess;
          if (typeof userSettings.allowMicrophoneAccess === 'boolean') newSettings.allowMicrophoneAccess = userSettings.allowMicrophoneAccess;
          
          setSettings(newSettings);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const updateSetting = async (key: string, value: boolean) => {
    try {
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);
      
      if (user?.uid) {
        await FirebaseService.updateUserSettings(user.uid, newSettings);
      }
    } catch (error) {
      console.error('Error updating setting:', error);
      Alert.alert('Error', 'Failed to update setting');
      // Revert the change
      setSettings(prevSettings => ({ ...prevSettings, [key]: !value }));
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out');
            }
          }
        },
      ]
    );
  };

  const handleShareApp = async () => {
    try {
      await Share.share({
        message: 'Check out Jorvea - The amazing social media app! Download it now.',
        url: 'https://jorvea.app',
        title: 'Jorvea Social Media App',
      });
    } catch (error) {
      console.error('Error sharing app:', error);
    }
  };

  const handleContactSupport = () => {
    Alert.alert(
      'Contact Support',
      'How would you like to contact us?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Email', 
          onPress: () => Linking.openURL('mailto:support@jorvea.app')
        },
        { 
          text: 'Phone', 
          onPress: () => Linking.openURL('tel:+1234567890')
        },
      ]
    );
  };

  const SettingItem = ({ 
    icon, 
    title, 
    subtitle, 
    onPress, 
    showArrow = true,
    rightComponent 
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    showArrow?: boolean;
    rightComponent?: React.ReactNode;
  }) => (
    <TouchableOpacity 
      style={[styles.settingItem, { 
        backgroundColor: colors.card,
        borderBottomColor: colors.border 
      }]} 
      onPress={onPress}
    >
      <View style={styles.settingContent}>
        <Icon name={icon} size={24} color={colors.primary} style={styles.settingIcon} />
        <View style={styles.settingText}>
          <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
          {subtitle && <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
        </View>
      </View>
      {rightComponent || (showArrow && (
        <Icon name="chevron-forward" size={16} color={colors.textMuted} />
      ))}
    </TouchableOpacity>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <View style={[styles.sectionHeader, { backgroundColor: colors.backgroundSoft }]}>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <BeautifulHeader
        title="Settings"
        leftIcon="arrow-back"
        onLeftPress={() => navigation.goBack()}
      />

      <ScrollView style={styles.content}>
        {/* Profile Section */}
        <BeautifulCard style={styles.profileCard}>
          <TouchableOpacity 
            style={styles.profileSection}
            onPress={() => navigation.navigate('Profile' as never)}
          >
            <Image
              source={
                user?.photoURL 
                  ? { uri: user.photoURL }
                  : { uri: 'https://via.placeholder.com/60/10fedb/FFFFFF?text=U' }
              }
              style={styles.profileImage}
            />
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: colors.text }]}>
                {user?.displayName || 'Your Name'}
              </Text>
              <Text style={[styles.profileUsername, { color: colors.textSecondary }]}>
                @{user?.email?.split('@')[0] || 'username'}
              </Text>
              <Text style={[styles.viewProfileText, { color: colors.primary }]}>View Profile</Text>
            </View>
            <Icon name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </BeautifulCard>

        <SectionHeader title="Account" />
        <SettingItem
          icon="person-outline"
          title="Edit Profile"
          onPress={() => navigation.navigate('EditProfile' as never)}
        />
        <SettingItem
          icon="bookmark-outline"
          title="Saved"
          subtitle="See your saved posts and reels"
          onPress={() => navigation.navigate('SavedPosts' as never)}
        />
        <SettingItem
          icon="archive-outline"
          title="Archive"
          subtitle="See your archived stories and posts"
          onPress={() => navigation.navigate('Archive' as never)}
        />
        <SettingItem
          icon="time-outline"
          title="Your Activity"
          subtitle="See your account activity and manage your time"
          onPress={() => navigation.navigate('YourActivity' as never)}
        />
        <SettingItem
          icon="key-outline"
          title="Password"
          subtitle="Change your password"
          onPress={() => Alert.alert('Coming Soon', 'Password change feature will be available soon')}
        />
        <SettingItem
          icon="shield-checkmark-outline"
          title="Privacy"
          subtitle="Manage your privacy settings"
          onPress={() => navigation.navigate('PrivacySettings' as never)}
        />
        <SettingItem
          icon="lock-closed-outline"
          title="Private Account"
          subtitle="Only followers can see your posts"
          rightComponent={
            <Switch
              value={settings.privateAccount}
              onValueChange={(value) => updateSetting('privateAccount', value)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#ffffff"
            />
          }
          showArrow={false}
        />
        <SettingItem
          icon="chatbubble-outline"
          title="Allow Messages"
          subtitle="Let others send you messages"
          rightComponent={
            <Switch
              value={settings.allowMessages}
              onValueChange={(value) => updateSetting('allowMessages', value)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#ffffff"
            />
          }
          showArrow={false}
        />
        <SettingItem
          icon="eye-outline"
          title="Show Activity Status"
          subtitle="Let others see when you're active"
          rightComponent={
            <Switch
              value={settings.showActivity}
              onValueChange={(value) => updateSetting('showActivity', value)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#ffffff"
            />
          }
          showArrow={false}
        />
        <SettingItem
          icon="lock-closed-outline"
          title="Security"
          subtitle="Two-factor authentication, login activity"
          onPress={() => navigation.navigate('SecuritySettings' as never)}
        />

        <SectionHeader title="Notifications" />
        <SettingItem
          icon="notifications-outline"
          title="Push Notifications"
          subtitle="Likes, comments, follows, and more"
          rightComponent={
            <Switch
              value={settings.notifications}
              onValueChange={(value) => updateSetting('notifications', value)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#ffffff"
            />
          }
          showArrow={false}
        />
        <SettingItem
          icon="mail-outline"
          title="Email Notifications"
          subtitle="Security, tips, and updates"
          onPress={() => navigation.navigate('EmailSettings' as never)}
        />
        <SettingItem
          icon="chatbubble-outline"
          title="Comment Notifications"
          subtitle="Get notified when someone comments"
          rightComponent={
            <Switch
              value={settings.allowComments}
              onValueChange={(value) => updateSetting('allowComments', value)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#ffffff"
            />
          }
          showArrow={false}
        />
        <SettingItem
          icon="at-outline"
          title="Mention Notifications"
          subtitle="Get notified when someone mentions you"
          rightComponent={
            <Switch
              value={settings.allowMentions}
              onValueChange={(value) => updateSetting('allowMentions', value)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#ffffff"
            />
          }
          showArrow={false}
        />

        <SectionHeader title="Content" />
        <SettingItem
          icon="download-outline"
          title="Save Original Photos"
          subtitle="Keep original quality when saving"
          rightComponent={
            <Switch
              value={settings.saveOriginalPhotos}
              onValueChange={(value) => updateSetting('saveOriginalPhotos', value)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#ffffff"
            />
          }
          showArrow={false}
        />
        <SettingItem
          icon="play-outline"
          title="Autoplay Videos"
          subtitle="Videos play automatically in feed"
          rightComponent={
            <Switch
              value={settings.autoplayVideos}
              onValueChange={(value) => updateSetting('autoplayVideos', value)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#ffffff"
            />
          }
          showArrow={false}
        />
        <SettingItem
          icon="share-outline"
          title="Allow Sharing"
          subtitle="Let others share your content"
          rightComponent={
            <Switch
              value={settings.allowSharing}
              onValueChange={(value) => updateSetting('allowSharing', value)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#ffffff"
            />
          }
          showArrow={false}
        />
        <SettingItem
          icon="archive-outline"
          title="Archive"
          subtitle="Posts and stories you've archived"
          onPress={() => navigation.navigate('Archive' as never)}
        />
        <SettingItem
          icon="time-outline"
          title="Your Activity"
          subtitle="See your time on Jorvea"
          onPress={() => navigation.navigate('YourActivity' as never)}
        />

        <SectionHeader title="Support" />
        <SettingItem
          icon="help-circle-outline"
          title="Help"
          subtitle="Get help with using Jorvea"
          onPress={handleContactSupport}
        />
        <SettingItem
          icon="document-text-outline"
          title="About"
          subtitle="App info, terms, and policies"
          onPress={() => navigation.navigate('About' as never)}
        />
        <SettingItem
          icon="bug-outline"
          title="Report a Problem"
          subtitle="Let us know if something isn't working"
          onPress={() => navigation.navigate('ReportProblem' as never)}
        />
        <SettingItem
          icon="share-outline"
          title="Share App"
          subtitle="Tell your friends about Jorvea"
          onPress={handleShareApp}
        />
        <SettingItem
          icon="star-outline"
          title="Rate App"
          subtitle="Rate us in the app store"
          onPress={() => {
            Alert.alert(
              'Rate App',
              'Would you like to rate Jorvea in the app store?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Rate Now', onPress: () => Linking.openURL('https://apps.apple.com/app/jorvea') }
              ]
            );
          }}
        />

        <SectionHeader title="App" />
        <SettingItem
          icon="moon-outline"
          title="Dark Mode"
          subtitle="Switch between light and dark theme"
          rightComponent={
            <Switch
              value={isDarkMode}
              onValueChange={toggleDarkMode}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#ffffff"
            />
          }
          showArrow={false}
        />
        <SettingItem
          icon="language-outline"
          title="Language"
          subtitle="English"
          onPress={() => navigation.navigate('LanguageSettings' as never)}
        />
        <SettingItem
          icon="cellular-outline"
          title="Data Usage"
          subtitle="Manage data consumption"
          onPress={() => navigation.navigate('DataUsage' as never)}
        />
        <SettingItem
          icon="location-outline"
          title="Location Services"
          subtitle="Allow location access for features"
          rightComponent={
            <Switch
              value={settings.allowLocationServices}
              onValueChange={(value) => updateSetting('allowLocationServices', value)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#ffffff"
            />
          }
          showArrow={false}
        />
        <SettingItem
          icon="camera-outline"
          title="Camera Access"
          subtitle="Allow camera for photos and videos"
          rightComponent={
            <Switch
              value={settings.allowCameraAccess}
              onValueChange={(value) => updateSetting('allowCameraAccess', value)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#ffffff"
            />
          }
          showArrow={false}
        />
        <SettingItem
          icon="mic-outline"
          title="Microphone Access"
          subtitle="Allow microphone for voice messages"
          rightComponent={
            <Switch
              value={settings.allowMicrophoneAccess}
              onValueChange={(value) => updateSetting('allowMicrophoneAccess', value)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#ffffff"
            />
          }
          showArrow={false}
        />

        <SectionHeader title="Account Actions" />
        <SettingItem
          icon="refresh-outline"
          title="Sync Data"
          subtitle="Sync your data with cloud"
          onPress={() => {
            Alert.alert(
              'Sync Data',
              'This will sync your data with the cloud. Continue?',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Sync', 
                  onPress: async () => {
                    Alert.alert('Success', 'Data synced successfully');
                  }
                }
              ]
            );
          }}
        />
        <SettingItem
          icon="trash-outline"
          title="Clear Cache"
          subtitle="Free up storage space"
          onPress={() => {
            Alert.alert(
              'Clear Cache',
              'This will clear app cache and free up storage. Continue?',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Clear', 
                  style: 'destructive',
                  onPress: () => Alert.alert('Success', 'Cache cleared successfully')
                }
              ]
            );
          }}
        />
        <SettingItem
          icon="log-out-outline"
          title="Sign Out"
          subtitle="Sign out of your account"
          onPress={handleSignOut}
          showArrow={false}
        />

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.text }]}>
            Jorvea Social Media App
          </Text>
          <Text style={[styles.footerVersion, { color: colors.textSecondary }]}>
            Version 1.0.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 16,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  settingValue: {
    fontSize: 16,
    marginRight: 8,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  footerText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  footerVersion: {
    fontSize: 14,
  },
  profileCard: {
    margin: 16,
    marginBottom: 0,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  profileUsername: {
    fontSize: 14,
    marginBottom: 4,
  },
  viewProfileText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
