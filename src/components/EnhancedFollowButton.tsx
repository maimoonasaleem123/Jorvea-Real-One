import React, { useState, useEffect } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Vibration,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/FastAuthContext';
import FirebaseService from '../services/firebaseService';

interface EnhancedFollowButtonProps {
  targetUserId: string;
  targetUserName?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'filled' | 'outlined' | 'text';
  showIcon?: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
  disabled?: boolean;
}

export const EnhancedFollowButton: React.FC<EnhancedFollowButtonProps> = ({
  targetUserId,
  targetUserName = 'User',
  size = 'medium',
  variant = 'filled',
  showIcon = true,
  onFollowChange,
  disabled = false,
}) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);

  // Don't show follow button for self
  if (!user || user.uid === targetUserId) {
    return null;
  }

  // Check initial follow status
  useEffect(() => {
    checkFollowStatus();
    getFollowersCount();
  }, [targetUserId, user?.uid]);

  const checkFollowStatus = async () => {
    if (!user?.uid) return;
    
    try {
      const status = await FirebaseService.checkIfFollowing(user.uid, targetUserId);
      setIsFollowing(status);
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  };

  const getFollowersCount = async () => {
    try {
      const followers = await FirebaseService.getFollowers(targetUserId);
      setFollowersCount(followers.length);
    } catch (error) {
      console.error('Error getting followers count:', error);
    }
  };

  const handleFollowToggle = async () => {
    if (!user?.uid || loading || disabled) return;

    try {
      setLoading(true);
      
      // Optimistic update
      const newFollowingState = !isFollowing;
      setIsFollowing(newFollowingState);
      setFollowersCount(prev => newFollowingState ? prev + 1 : prev - 1);
      
      // Haptic feedback
      Vibration.vibrate(50);

      const result = await FirebaseService.toggleFollowUser(user.uid, targetUserId);
      
      // Update with actual result
      setIsFollowing(result.isFollowing);
      onFollowChange?.(result.isFollowing);
      
      // Refresh followers count
      await getFollowersCount();
      
    } catch (error) {
      console.error('Error toggling follow:', error);
      
      // Revert optimistic update on error
      setIsFollowing(!isFollowing);
      setFollowersCount(prev => isFollowing ? prev + 1 : prev - 1);
      
      Alert.alert(
        'Error',
        'Failed to update follow status. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 15,
          minWidth: 70,
        };
      case 'large':
        return {
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderRadius: 25,
          minWidth: 120,
        };
      default: // medium
        return {
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 20,
          minWidth: 90,
        };
    }
  };

  const getTextSize = () => {
    switch (size) {
      case 'small': return 12;
      case 'large': return 16;
      default: return 14;
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'small': return 14;
      case 'large': return 18;
      default: return 16;
    }
  };

  const renderButtonContent = () => {
    if (loading) {
      return <ActivityIndicator size="small" color={getTextColor()} />;
    }

    const iconName = isFollowing ? 'person-remove' : 'person-add';
    const buttonText = isFollowing ? 'Following' : 'Follow';

    return (
      <>
        {showIcon && (
          <Icon 
            name={iconName} 
            size={getIconSize()} 
            color={getTextColor()} 
            style={styles.icon}
          />
        )}
        <Text style={[styles.buttonText, { 
          color: getTextColor(), 
          fontSize: getTextSize(),
          fontWeight: isFollowing ? '500' : '600',
        }]}>
          {buttonText}
        </Text>
      </>
    );
  };

  const getTextColor = () => {
    if (variant === 'filled') {
      return isFollowing ? colors.text : '#fff';
    }
    return isFollowing ? colors.textSecondary : colors.primary;
  };

  const getBackgroundColors = () => {
    if (variant === 'filled') {
      if (isFollowing) {
        return [colors.surface, colors.surface];
      }
      return ['#667eea', '#764ba2']; // Gradient for follow
    }
    return ['transparent', 'transparent'];
  };

  const getBorderColor = () => {
    if (variant === 'outlined') {
      return isFollowing ? colors.border : colors.primary;
    }
    return 'transparent';
  };

  if (variant === 'filled') {
    return (
      <TouchableOpacity 
        onPress={handleFollowToggle}
        disabled={loading || disabled}
        style={[styles.button, getSizeStyles(), { opacity: disabled ? 0.6 : 1 }]}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={getBackgroundColors()}
          style={[styles.gradientButton, getSizeStyles(), {
            borderWidth: isFollowing ? 1 : 0,
            borderColor: isFollowing ? colors.border : 'transparent',
          }]}
        >
          {renderButtonContent()}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity 
      onPress={handleFollowToggle}
      disabled={loading || disabled}
      style={[
        styles.button, 
        getSizeStyles(), 
        {
          backgroundColor: variant === 'outlined' ? 'transparent' : colors.surface,
          borderWidth: variant === 'outlined' ? 1 : 0,
          borderColor: getBorderColor(),
          opacity: disabled ? 0.6 : 1,
        }
      ]}
      activeOpacity={0.7}
    >
      {renderButtonContent()}
    </TouchableOpacity>
  );
};

// Hook for managing follow states across components
export const useFollowSystem = () => {
  const { user } = useAuth();
  const [followingList, setFollowingList] = useState<string[]>([]);
  const [followersList, setFollowersList] = useState<string[]>([]);

  useEffect(() => {
    if (user?.uid) {
      loadFollowData();
    }
  }, [user?.uid]);

  const loadFollowData = async () => {
    if (!user?.uid) return;

    try {
      const [following, followers] = await Promise.all([
        FirebaseService.getFollowing(user.uid),
        FirebaseService.getFollowers(user.uid),
      ]);

      setFollowingList(following.map(u => u.uid));
      setFollowersList(followers.map(u => u.uid));
    } catch (error) {
      console.error('Error loading follow data:', error);
    }
  };

  const isFollowing = (userId: string) => {
    return followingList.includes(userId);
  };

  const isFollower = (userId: string) => {
    return followersList.includes(userId);
  };

  const toggleFollow = async (targetUserId: string) => {
    if (!user?.uid) return { success: false, isFollowing: false };

    try {
      const result = await FirebaseService.toggleFollowUser(user.uid, targetUserId);
      
      // Update local state
      if (result.isFollowing) {
        setFollowingList(prev => [...prev, targetUserId]);
      } else {
        setFollowingList(prev => prev.filter(id => id !== targetUserId));
      }

      return { success: true, isFollowing: result.isFollowing };
    } catch (error) {
      console.error('Error toggling follow:', error);
      return { success: false, isFollowing: false };
    }
  };

  return {
    followingList,
    followersList,
    isFollowing,
    isFollower,
    toggleFollow,
    refreshFollowData: loadFollowData,
  };
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontWeight: '600',
  },
  icon: {
    marginRight: 4,
  },
});

export default EnhancedFollowButton;
