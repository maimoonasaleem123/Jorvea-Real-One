/**
 * UniversalFollowButton - Enhanced dynamic follow button for all screens
 * Automatically updates across the app when follow status changes
 */

import React, { useState, useEffect } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import DynamicFollowSystem from '../services/DynamicFollowSystem';
import { useAuth } from '../context/FastAuthContext';

interface UniversalFollowButtonProps {
  targetUserId: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'outline' | 'minimal';
  showIcon?: boolean;
  customText?: {
    follow: string;
    following: string;
  };
  onFollowChange?: (isFollowing: boolean) => void;
  disabled?: boolean;
}

export const DynamicFollowButton: React.FC<UniversalFollowButtonProps> = ({
  targetUserId,
  style,
  textStyle,
  size = 'medium',
  variant = 'primary',
  showIcon = false,
  customText,
  onFollowChange,
  disabled = false,
}) => {
  const { user: currentUser } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const followSystem = DynamicFollowSystem.getInstance();

  // Initialize follow data
  useEffect(() => {
    if (!currentUser || !targetUserId || currentUser.uid === targetUserId) {
      return;
    }

    const initializeData = async () => {
      try {
        const data = await followSystem.initializeUser(targetUserId, currentUser.uid);
        setIsFollowing(data.isFollowing);
        setFollowersCount(data.followersCount);
        setInitialized(true);
      } catch (error) {
        console.error('Error initializing follow button:', error);
        setInitialized(true);
      }
    };

    initializeData();
  }, [targetUserId, currentUser, followSystem]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!currentUser || !targetUserId) return;

    const unsubscribe = followSystem.subscribeToUser(targetUserId, (data) => {
      setIsFollowing(data.isFollowing);
      setFollowersCount(data.followersCount);
    });

    return unsubscribe;
  }, [targetUserId, currentUser, followSystem]);

  const handlePress = async () => {
    if (!currentUser || loading || disabled) return;

    setLoading(true);
    try {
      const newFollowingState = await followSystem.toggleFollow(targetUserId, currentUser.uid);
      
      // Update local state
      setIsFollowing(newFollowingState);
      setFollowersCount(prev => newFollowingState ? prev + 1 : Math.max(0, prev - 1));
      
      // Notify parent component
      if (onFollowChange) {
        onFollowChange(newFollowingState);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setLoading(false);
    }
  };

  // Don't render if not initialized or if it's the same user
  if (!initialized || !currentUser || currentUser.uid === targetUserId) {
    return null;
  }

  const getButtonStyle = (): ViewStyle => {
    const baseStyle = styles[`${size}Button`] as ViewStyle;
    const variantStyle = isFollowing 
      ? styles[`${variant}ButtonFollowing`] as ViewStyle
      : styles[`${variant}Button`] as ViewStyle;
    
    return {
      ...baseStyle,
      ...variantStyle,
      ...style,
    };
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle = styles[`${size}Text`] as TextStyle;
    const variantStyle = isFollowing 
      ? styles[`${variant}TextFollowing`] as TextStyle
      : styles[`${variant}Text`] as TextStyle;
    
    return {
      ...baseStyle,
      ...variantStyle,
      ...textStyle,
    };
  };

  const getButtonText = () => {
    if (customText) {
      return isFollowing ? customText.following : customText.follow;
    }
    return isFollowing ? 'Following' : 'Follow';
  };

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={handlePress}
      disabled={loading || disabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator 
          size="small" 
          color={isFollowing ? "#666" : "#fff"} 
        />
      ) : (
        <View style={styles.buttonContent}>
          {showIcon && (
            <Icon 
              name={isFollowing ? "person-remove" : "person-add"} 
              size={16} 
              color={isFollowing ? "#666" : "#fff"}
              style={styles.icon}
            />
          )}
          <Text style={getTextStyle()}>
            {getButtonText()}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

interface FollowStatsProps {
  userId: string;
  style?: ViewStyle;
  onPress?: (type: 'followers' | 'following') => void;
  showLabels?: boolean;
}

export const DynamicFollowStats: React.FC<FollowStatsProps> = ({
  userId,
  style,
  onPress,
  showLabels = true,
}) => {
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [initialized, setInitialized] = useState(false);

  const followSystem = DynamicFollowSystem.getInstance();

  useEffect(() => {
    if (!userId) return;

    const initializeData = async () => {
      try {
        const data = await followSystem.initializeUser(userId);
        setFollowersCount(data.followersCount);
        setFollowingCount(data.followingCount);
        setInitialized(true);
      } catch (error) {
        console.error('Error initializing follow stats:', error);
        setInitialized(true);
      }
    };

    initializeData();
  }, [userId, followSystem]);

  useEffect(() => {
    if (!userId) return;

    const unsubscribe = followSystem.subscribeToUser(userId, (data) => {
      setFollowersCount(data.followersCount);
      setFollowingCount(data.followingCount);
    });

    return unsubscribe;
  }, [userId, followSystem]);

  if (!initialized) {
    return (
      <View style={[styles.statsContainer, style]}>
        <ActivityIndicator size="small" color="#666" />
      </View>
    );
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  return (
    <View style={[styles.statsContainer, style]}>
      <TouchableOpacity 
        style={styles.statItem}
        onPress={() => onPress?.('followers')}
        disabled={!onPress}
      >
        <Text style={styles.statNumber}>{formatNumber(followersCount)}</Text>
        {showLabels && <Text style={styles.statLabel}>Followers</Text>}
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.statItem}
        onPress={() => onPress?.('following')}
        disabled={!onPress}
      >
        <Text style={styles.statNumber}>{formatNumber(followingCount)}</Text>
        {showLabels && <Text style={styles.statLabel}>Following</Text>}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  // Button sizes
  smallButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 4,
    minWidth: 60,
  },
  mediumButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 80,
  },
  largeButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
  },

  // Button variants
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  primaryButtonFollowing: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  outlineButtonFollowing: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  minimalButton: {
    backgroundColor: 'transparent',
  },
  minimalButtonFollowing: {
    backgroundColor: 'transparent',
  },

  // Text sizes
  smallText: {
    fontSize: 12,
    fontWeight: '600',
  },
  mediumText: {
    fontSize: 14,
    fontWeight: '600',
  },
  largeText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Text variants
  primaryText: {
    color: '#fff',
  },
  primaryTextFollowing: {
    color: '#000',
  },
  outlineText: {
    color: '#007AFF',
  },
  outlineTextFollowing: {
    color: '#666',
  },
  minimalText: {
    color: '#007AFF',
  },
  minimalTextFollowing: {
    color: '#666',
  },

  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 4,
  },

  // Stats styles
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    marginHorizontal: 8,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});

export default DynamicFollowButton;
