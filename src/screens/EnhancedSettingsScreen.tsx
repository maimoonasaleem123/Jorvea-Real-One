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
  Modal,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/FastAuthContext';
import { useTheme } from '../context/ThemeContext';
import FirebaseService from '../services/firebaseService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

interface SettingsData {
  notifications: boolean;
  privateAccount: boolean;
  allowMessages: boolean;
  showActivity: boolean;
  allowComments: boolean;
  allowMentions: boolean;
  allowSharing: boolean;
  autoplayVideos: boolean;
  saveOriginalPhotos: boolean;
  allowLocationServices: boolean;
  allowCameraAccess: boolean;
  allowMicrophoneAccess: boolean;
  showOnlineStatus: boolean;
  readReceipts: boolean;
  allowStoryReplies: boolean;
  allowStorySharing: boolean;
}

interface PrivacyModalProps {
  visible: boolean;
  onClose: () => void;
  setting: string;
  value: boolean;
  onUpdate: (value: boolean) => void;
}

const PrivacyModal: React.FC<PrivacyModalProps> = ({
  visible,
  onClose,
  setting,
  value,
  onUpdate,
}) => {
  const { colors } = useTheme();
  
  const getSettingInfo = () => {
    switch (setting) {
      case 'privateAccount':
        return {
          title: 'Private Account',
          description: 'When your account is private, only people you approve can see your posts, stories and follow you.',
          options: [
            { label: 'Public', value: false, description: 'Anyone can see your content' },
            { label: 'Private', value: true, description: 'Only approved followers can see your content' },
          ],
        };
      case 'allowMessages':
        return {
          title: 'Message Requests',
          description: 'Control who can send you messages and call you.',
          options: [
            { label: 'Everyone', value: true, description: 'Anyone can message you' },
            { label: 'People you follow', value: false, description: 'Only people you follow can message you' },
          ],
        };
      case 'showActivity':
        return {
          title: 'Activity Status',
          description: 'Let others see when you were last active.',
          options: [
            { label: 'Show activity', value: true, description: 'Others can see when you were last active' },
            { label: 'Hide activity', value: false, description: 'Others cannot see when you were last active' },
          ],
        };
      default:
        return {
          title: setting,
          description: '',
          options: [],
        };
    }
  };

  const settingInfo = getSettingInfo();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Icon name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            {settingInfo.title}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.modalContent}>
          <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
            {settingInfo.description}
          </Text>

          <View style={styles.optionsContainer}>
            {settingInfo.options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.optionItem,
                  { 
                    backgroundColor: colors.surface,
                    borderColor: value === option.value ? colors.primary : colors.border,
                  }
                ]}
                onPress={() => onUpdate(option.value)}
              >
                <View style={styles.optionContent}>
                  <View style={styles.optionHeader}>
                    <Text style={[styles.optionLabel, { color: colors.text }]}>
                      {option.label}
                    </Text>
                    <View style={[
                      styles.radioButton,
                      { 
                        borderColor: value === option.value ? colors.primary : colors.border,
                        backgroundColor: value === option.value ? colors.primary : 'transparent',
                      }
                    ]}>
                      {value === option.value && (
                        <View style={styles.radioButtonInner} />
                      )}
                    </View>
                  </View>
                  <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                    {option.description}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

export default function EnhancedSettingsScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const { user, signOut } = useAuth();
  const { isDarkMode, toggleDarkMode, colors } = useTheme();
  const [settings, setSettings] = useState<SettingsData>({
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
    showOnlineStatus: true,
    readReceipts: true,
    allowStoryReplies: true,
    allowStorySharing: true,
  });
  
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [currentPrivacySetting, setCurrentPrivacySetting] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUserSettings();
  }, []);

  const loadUserSettings = async () => {
    try {
      if (user?.uid) {
        const userProfile = await FirebaseService.getUserProfile(user.uid);
        if (userProfile?.settings) {
          // Merge with existing settings, handling any type differences
          const savedSettings = userProfile.settings as any;
          setSettings(prev => ({ ...prev, ...savedSettings }));
        }
      }
    } catch (error) {
      console.log('Error loading settings:', error);
    }
  };

  const updateSetting = async (key: keyof SettingsData, value: boolean) => {
    try {
      setLoading(true);
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);
      
      if (user?.uid) {
        // For now, save settings as any to avoid type conflicts
        await FirebaseService.updateUserProfile(user.uid, { settings: newSettings as any });
      }
      
      // Save to local storage for offline access
      await AsyncStorage.setItem('user_settings', JSON.stringify(newSettings));
    } catch (error) {
      console.log('Error updating setting:', error);
      Alert.alert('Error', 'Failed to update setting');
    } finally {
      setLoading(false);
    }
  };

  const openPrivacyModal = (setting: string) => {
    setCurrentPrivacySetting(setting);
    setPrivacyModalVisible(true);
  };

  const handlePrivacyUpdate = (value: boolean) => {
    updateSetting(currentPrivacySetting as keyof SettingsData, value);
    setPrivacyModalVisible(false);
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
          onPress: signOut 
        },
      ]
    );
  };

  const handleShareApp = async () => {
    try {
      await Share.share({
        message: 'Check out Jorvea - The best social media app! Download it now.',
        url: 'https://jorvea.app', // Replace with your app store URL
      });
    } catch (error) {
      console.log('Error sharing app:', error);
    }
  };

  const handleReportBug = () => {
    Linking.openURL('mailto:support@jorvea.com?subject=Bug Report');
  };

  const renderSettingItem = (
    icon: string,
    title: string,
    subtitle: string,
    value: boolean,
    onPress: () => void,
    showArrow: boolean = false
  ) => (
    <TouchableOpacity
      style={[styles.settingItem, { backgroundColor: colors.surface }]}
      onPress={onPress}
      disabled={loading}
    >
      <View style={[styles.settingIcon, { backgroundColor: colors.primary }]}>
        <Icon name={icon} size={20} color="#fff" />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>
      {showArrow ? (
        <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
      ) : (
        <Switch
          value={value}
          onValueChange={onPress}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#fff"
          disabled={loading}
        />
      )}
    </TouchableOpacity>
  );

  const renderSectionHeader = (title: string) => (
    <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{title}</Text>
  );

  const renderActionItem = (icon: string, title: string, onPress: () => void, destructive: boolean = false) => (
    <TouchableOpacity
      style={[styles.actionItem, { backgroundColor: colors.surface }]}
      onPress={onPress}
    >
      <View style={[styles.settingIcon, { 
        backgroundColor: destructive ? colors.error : colors.primary 
      }]}>
        <Icon name={icon} size={20} color="#fff" />
      </View>
      <Text style={[
        styles.actionTitle, 
        { color: destructive ? colors.error : colors.text }
      ]}>
        {title}
      </Text>
      <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Appearance */}
        {renderSectionHeader('Appearance')}
        {renderSettingItem(
          isDarkMode ? 'moon' : 'sunny',
          'Dark Mode',
          isDarkMode ? 'Using dark theme' : 'Using light theme',
          isDarkMode,
          toggleDarkMode
        )}

        {/* Privacy */}
        {renderSectionHeader('Privacy')}
        {renderSettingItem(
          'lock-closed',
          'Private Account',
          settings.privateAccount ? 'Only approved followers can see your content' : 'Anyone can see your content',
          settings.privateAccount,
          () => openPrivacyModal('privateAccount'),
          true
        )}
        {renderSettingItem(
          'chatbubble',
          'Message Requests',
          settings.allowMessages ? 'Anyone can message you' : 'Only people you follow can message you',
          settings.allowMessages,
          () => openPrivacyModal('allowMessages'),
          true
        )}
        {renderSettingItem(
          'pulse',
          'Activity Status',
          settings.showActivity ? 'Others can see when you were last active' : 'Others cannot see when you were last active',
          settings.showActivity,
          () => openPrivacyModal('showActivity'),
          true
        )}
        {renderSettingItem(
          'eye',
          'Online Status',
          'Show when you are online',
          settings.showOnlineStatus,
          () => updateSetting('showOnlineStatus', !settings.showOnlineStatus)
        )}
        {renderSettingItem(
          'checkmark-done',
          'Read Receipts',
          'Show when you have read messages',
          settings.readReceipts,
          () => updateSetting('readReceipts', !settings.readReceipts)
        )}

        {/* Content & Interactions */}
        {renderSectionHeader('Content & Interactions')}
        {renderSettingItem(
          'heart',
          'Allow Comments',
          'Let others comment on your posts',
          settings.allowComments,
          () => updateSetting('allowComments', !settings.allowComments)
        )}
        {renderSettingItem(
          'at',
          'Allow Mentions',
          'Let others mention you in posts and stories',
          settings.allowMentions,
          () => updateSetting('allowMentions', !settings.allowMentions)
        )}
        {renderSettingItem(
          'share',
          'Allow Sharing',
          'Let others share your posts',
          settings.allowSharing,
          () => updateSetting('allowSharing', !settings.allowSharing)
        )}
        {renderSettingItem(
          'chatbubble-ellipses',
          'Story Replies',
          'Allow replies to your stories',
          settings.allowStoryReplies,
          () => updateSetting('allowStoryReplies', !settings.allowStoryReplies)
        )}
        {renderSettingItem(
          'repeat',
          'Story Sharing',
          'Allow others to share your stories',
          settings.allowStorySharing,
          () => updateSetting('allowStorySharing', !settings.allowStorySharing)
        )}

        {/* Media & Storage */}
        {renderSectionHeader('Media & Storage')}
        {renderSettingItem(
          'play',
          'Autoplay Videos',
          'Automatically play videos in feed',
          settings.autoplayVideos,
          () => updateSetting('autoplayVideos', !settings.autoplayVideos)
        )}
        {renderSettingItem(
          'download',
          'Save Original Photos',
          'Save original quality photos to device',
          settings.saveOriginalPhotos,
          () => updateSetting('saveOriginalPhotos', !settings.saveOriginalPhotos)
        )}

        {/* Permissions */}
        {renderSectionHeader('Permissions')}
        {renderSettingItem(
          'location',
          'Location Services',
          'Allow location access for posts and stories',
          settings.allowLocationServices,
          () => updateSetting('allowLocationServices', !settings.allowLocationServices)
        )}
        {renderSettingItem(
          'camera',
          'Camera Access',
          'Allow camera access for posts and stories',
          settings.allowCameraAccess,
          () => updateSetting('allowCameraAccess', !settings.allowCameraAccess)
        )}
        {renderSettingItem(
          'mic',
          'Microphone Access',
          'Allow microphone access for voice messages and videos',
          settings.allowMicrophoneAccess,
          () => updateSetting('allowMicrophoneAccess', !settings.allowMicrophoneAccess)
        )}

        {/* Notifications */}
        {renderSectionHeader('Notifications')}
        {renderSettingItem(
          'notifications',
          'Push Notifications',
          'Receive notifications for likes, comments, and messages',
          settings.notifications,
          () => updateSetting('notifications', !settings.notifications)
        )}

        {/* Actions */}
        {renderSectionHeader('Actions')}
        {renderActionItem('share', 'Share Jorvea', handleShareApp)}
        {renderActionItem('bug', 'Report a Bug', handleReportBug)}
        {renderActionItem('log-out', 'Sign Out', handleSignOut, true)}

        <View style={{ height: 50 }} />
      </ScrollView>

      <PrivacyModal
        visible={privacyModalVisible}
        onClose={() => setPrivacyModalVisible(false)}
        setting={currentPrivacySetting}
        value={settings[currentPrivacySetting as keyof SettingsData] as boolean}
        onUpdate={handlePrivacyUpdate}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 8,
    marginHorizontal: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginVertical: 2,
    borderRadius: 12,
  },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginVertical: 2,
    borderRadius: 12,
  },
  actionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  optionsContainer: {
    gap: 12,
  },
  optionItem: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  optionDescription: {
    fontSize: 14,
    lineHeight: 18,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
});
