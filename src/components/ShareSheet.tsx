import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  Share as RNShare,
  Clipboard,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';
import { BeautifulCard } from './BeautifulCard';
import LinearGradient from 'react-native-linear-gradient';

const { width } = Dimensions.get('window');

interface ShareOption {
  id: string;
  label: string;
  icon: string;
  iconType?: 'ionicons' | 'material';
  color: string;
  action: () => void;
}

interface ShareSheetProps {
  visible: boolean;
  onClose: () => void;
  content: {
    type: 'post' | 'reel' | 'story';
    url?: string;
    text?: string;
    title?: string;
    mediaUrl?: string;
  };
  onSave?: () => void;
  onSaveToCollection?: () => void;
  onAddToHighlight?: () => void;
  onCopyLink?: () => void;
  onShareToStory?: () => void;
  onSendMessage?: () => void;
}

export const ShareSheet: React.FC<ShareSheetProps> = ({
  visible,
  onClose,
  content,
  onSave,
  onSaveToCollection,
  onAddToHighlight,
  onCopyLink,
  onShareToStory,
  onSendMessage,
}) => {
  const { colors, isDarkMode } = useTheme();

  const handleNativeShare = async () => {
    try {
      await RNShare.share({
        message: content.text || content.title || 'Check out this amazing content on Jorvea!',
        url: content.url || content.mediaUrl,
        title: content.title || 'Jorvea Content',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleCopyLink = async () => {
    try {
      await Clipboard.setString(content.url || content.mediaUrl || 'https://jorvea.app');
      Alert.alert('Success', 'Link copied to clipboard');
      onCopyLink?.();
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to copy link');
    }
  };

  const shareOptions: ShareOption[] = [
    {
      id: 'save',
      label: 'Save',
      icon: 'bookmark-outline',
      color: colors.primary,
      action: () => {
        onSave?.();
        onClose();
      },
    },
    {
      id: 'collection',
      label: 'Save to Collection',
      icon: 'folder-outline',
      color: colors.secondary,
      action: () => {
        onSaveToCollection?.();
        onClose();
      },
    },
    {
      id: 'story',
      label: 'Add to Story',
      icon: 'add-circle-outline',
      color: colors.accent,
      action: () => {
        onShareToStory?.();
        onClose();
      },
    },
    {
      id: 'message',
      label: 'Send Message',
      icon: 'paper-plane-outline',
      color: colors.success,
      action: () => {
        onSendMessage?.();
        onClose();
      },
    },
    {
      id: 'copy',
      label: 'Copy Link',
      icon: 'copy-outline',
      color: colors.warning,
      action: handleCopyLink,
    },
    {
      id: 'share',
      label: 'Share via...',
      icon: 'share-outline',
      color: colors.textSecondary,
      action: handleNativeShare,
    },
  ];

  if (content.type === 'story') {
    shareOptions.push({
      id: 'highlight',
      label: 'Add to Highlight',
      icon: 'heart-circle-outline',
      color: colors.error,
      action: () => {
        onAddToHighlight?.();
        onClose();
      },
    });
  }

  const renderShareOption = (option: ShareOption) => (
    <TouchableOpacity
      key={option.id}
      style={[styles.shareOption, { backgroundColor: colors.card }]}
      onPress={option.action}
      activeOpacity={0.7}
    >
      <LinearGradient
        colors={[option.color, `${option.color}80`]}
        style={styles.shareIconContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Icon 
          name={option.icon} 
          size={24} 
          color="#FFFFFF" 
        />
      </LinearGradient>
      <Text style={[styles.shareOptionText, { color: colors.text }]}>
        {option.label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.backdropTouchable}
          activeOpacity={1}
          onPress={onClose}
        >
          <View style={styles.backdrop} />
        </TouchableOpacity>
        
        <SafeAreaView style={styles.bottomSheet}>
          <BeautifulCard style={[styles.sheetContent, { backgroundColor: colors.background }] as any}>
            {/* Header */}
            <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                Share {content.type}
              </Text>
              <TouchableOpacity 
                onPress={onClose}
                style={[styles.closeButton, { backgroundColor: colors.surface }]}
              >
                <Icon name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Share Options */}
            <ScrollView 
              style={styles.optionsContainer}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.optionsGrid}>
                {shareOptions.map(renderShareOption)}
              </View>

              {/* Quick Actions */}
              <View style={[styles.quickActions, { borderTopColor: colors.border }]}>
                <Text style={[styles.quickActionsTitle, { color: colors.textSecondary }]}>
                  Quick Actions
                </Text>
                
                <TouchableOpacity
                  style={[styles.quickAction, { backgroundColor: colors.surface }]}
                  onPress={() => {
                    Alert.alert('Report', 'This feature will be available soon');
                    onClose();
                  }}
                >
                  <Icon name="flag-outline" size={20} color={colors.error} />
                  <Text style={[styles.quickActionText, { color: colors.text }]}>
                    Report
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.quickAction, { backgroundColor: colors.surface }]}
                  onPress={() => {
                    Alert.alert('Not Interested', 'This feature will be available soon');
                    onClose();
                  }}
                >
                  <Icon name="eye-off-outline" size={20} color={colors.textMuted} />
                  <Text style={[styles.quickActionText, { color: colors.text }]}>
                    Not Interested
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </BeautifulCard>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  backdropTouchable: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
  },
  bottomSheet: {
    maxHeight: '80%',
    minHeight: '50%',
  },
  sheetContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 0,
    margin: 0,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsContainer: {
    flex: 1,
  },
  optionsGrid: {
    padding: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  shareOption: {
    width: (width - 60) / 3,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  shareIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  shareOptionText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  quickActions: {
    borderTopWidth: 1,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  quickActionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  quickActionText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '500',
  },
});

export default ShareSheet;
