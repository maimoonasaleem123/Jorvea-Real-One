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
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/FastAuthContext';
import { useTheme } from '../context/ThemeContext';
import ComprehensivePrivacyService, { PrivacySettings } from '../services/ComprehensivePrivacyService';
import LinearGradient from 'react-native-linear-gradient';

const PrivacySettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    isPrivateAccount: false,
    allowPublicReels: true,
    allowPublicPosts: true,
    hideFollowersList: false,
    hideFollowingList: false,
    allowStoryViewFromFollowers: true,
    allowDirectMessages: true,
    allowMentions: true,
    allowTagging: true,
    allowComments: 'everyone',
    allowLikes: 'everyone'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const privacyService = ComprehensivePrivacyService.getInstance();

  useEffect(() => {
    loadPrivacySettings();
  }, []);

  const loadPrivacySettings = async () => {
    if (!user?.uid) return;

    try {
      const settings = await privacyService.getUserPrivacySettings(user.uid);
      setPrivacySettings(settings);
    } catch (error) {
      console.error('Error loading privacy settings:', error);
      Alert.alert('Error', 'Failed to load privacy settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: keyof PrivacySettings, value: any) => {
    if (!user?.uid) return;

    setSaving(true);
    try {
      const newSettings = { ...privacySettings, [key]: value };
      setPrivacySettings(newSettings);
      
      await privacyService.updatePrivacySettings(user.uid, { [key]: value });
      
      console.log(`✅ Updated ${key} to ${value}`);
    } catch (error) {
      console.error('Error updating privacy setting:', error);
      Alert.alert('Error', 'Failed to update privacy setting');
      // Revert the change
      setPrivacySettings(prev => ({ ...prev, [key]: !value }));
    } finally {
      setSaving(false);
    }
  };

  const SettingRow = ({ 
    title, 
    subtitle, 
    value, 
    onValueChange, 
    icon,
    disabled = false 
  }: {
    title: string;
    subtitle: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
    icon: string;
    disabled?: boolean;
  }) => (
    <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
      <View style={styles.settingInfo}>
        <Icon name={icon} size={24} color={colors.primary} style={styles.settingIcon} />
        <View style={styles.settingText}>
          <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primary + '30' }}
        thumbColor={value ? colors.primary : colors.textSecondary}
        disabled={disabled || saving}
      />
    </View>
  );

  const CommentLikesRow = ({ 
    title, 
    subtitle, 
    value, 
    onValueChange, 
    icon,
    options = ['everyone', 'followers', 'mutual']
  }: {
    title: string;
    subtitle: string;
    value: string;
    onValueChange: (value: string) => void;
    icon: string;
    options?: string[];
  }) => (
    <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
      <View style={styles.settingInfo}>
        <Icon name={icon} size={24} color={colors.primary} style={styles.settingIcon} />
        <View style={styles.settingText}>
          <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        </View>
      </View>
      <View style={styles.optionsContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.optionButton,
              { borderColor: colors.border },
              value === option && { backgroundColor: colors.primary, borderColor: colors.primary }
            ]}
            onPress={() => onValueChange(option)}
            disabled={saving}
          >
            <Text style={[
              styles.optionText,
              { color: colors.text },
              value === option && { color: 'white' }
            ]}>
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading privacy settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Settings</Text>
        <View style={styles.headerRight} />
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Account Privacy Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Account Privacy</Text>
          
          <SettingRow
            title="Private Account"
            subtitle="Only followers can see your posts and profile"
            value={privacySettings.isPrivateAccount}
            onValueChange={(value) => updateSetting('isPrivateAccount', value)}
            icon="lock-closed"
          />

          <SettingRow
            title="Public Reels"
            subtitle="Allow your reels to be public even if account is private"
            value={privacySettings.allowPublicReels}
            onValueChange={(value) => updateSetting('allowPublicReels', value)}
            icon="videocam"
            disabled={!privacySettings.isPrivateAccount}
          />

          <SettingRow
            title="Public Posts"
            subtitle="Allow your posts to be public even if account is private"
            value={privacySettings.allowPublicPosts}
            onValueChange={(value) => updateSetting('allowPublicPosts', value)}
            icon="images"
            disabled={!privacySettings.isPrivateAccount}
          />
        </View>

        {/* Followers & Following Privacy */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Followers & Following</Text>
          
          <SettingRow
            title="Hide Followers List"
            subtitle="Only mutual followers can see your followers"
            value={privacySettings.hideFollowersList}
            onValueChange={(value) => updateSetting('hideFollowersList', value)}
            icon="people"
          />

          <SettingRow
            title="Hide Following List"
            subtitle="Only mutual followers can see who you follow"
            value={privacySettings.hideFollowingList}
            onValueChange={(value) => updateSetting('hideFollowingList', value)}
            icon="person-add"
          />
        </View>

        {/* Stories Privacy */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Stories</Text>
          
          <SettingRow
            title="Stories for Followers Only"
            subtitle="Only your followers can view your stories"
            value={privacySettings.allowStoryViewFromFollowers}
            onValueChange={(value) => updateSetting('allowStoryViewFromFollowers', value)}
            icon="sparkles"
          />
        </View>

        {/* Interactions Privacy */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Interactions</Text>
          
          <CommentLikesRow
            title="Comments"
            subtitle="Who can comment on your posts"
            value={privacySettings.allowComments}
            onValueChange={(value) => updateSetting('allowComments', value)}
            icon="chatbubble"
          />

          <CommentLikesRow
            title="Likes Visibility"
            subtitle="Who can see likes on your posts"
            value={privacySettings.allowLikes}
            onValueChange={(value) => updateSetting('allowLikes', value)}
            icon="heart"
          />

          <SettingRow
            title="Direct Messages"
            subtitle="Allow DMs from people you don't follow"
            value={privacySettings.allowDirectMessages}
            onValueChange={(value) => updateSetting('allowDirectMessages', value)}
            icon="mail"
          />

          <SettingRow
            title="Mentions"
            subtitle="Allow mentions from people you don't follow"
            value={privacySettings.allowMentions}
            onValueChange={(value) => updateSetting('allowMentions', value)}
            icon="at"
          />

          <SettingRow
            title="Tagging"
            subtitle="Allow tagging from people you don't follow"
            value={privacySettings.allowTagging}
            onValueChange={(value) => updateSetting('allowTagging', value)}
            icon="pricetag"
          />
        </View>

        {/* Privacy Tips */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Privacy Tips</Text>
          <View style={styles.tipCard}>
            <Icon name="information-circle" size={20} color={colors.primary} />
            <Text style={[styles.tipText, { color: colors.textSecondary }]}>
              Private accounts require approval for new followers. Public reels will still be visible to everyone even with a private account.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginRight: 34, // Compensate for back button
  },
  headerRight: {
    width: 34,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  section: {
    borderRadius: 12,
    marginBottom: 20,
    paddingVertical: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 15,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  optionsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1,
  },
  optionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 15,
    gap: 10,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});

export default PrivacySettingsScreen;
