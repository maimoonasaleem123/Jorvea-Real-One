import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/FastAuthContext';
import { DynamicFollowService } from '../services/DynamicFollowService';

interface UniversalFollowButtonProps {
  targetUserId: string;
  targetUserName?: string;
  targetUserAvatar?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'filled' | 'outlined' | 'text' | 'gradient';
  showIcon?: boolean;
  showFollowingCount?: boolean;
  onFollowChange?: (isFollowing: boolean, followersCount: number) => void;
  disabled?: boolean;
  style?: any;
  textStyle?: any;
}

export const UniversalFollowButton: React.FC<UniversalFollowButtonProps> = ({
  targetUserId,
  targetUserName = 'User',
  targetUserAvatar,
  size = 'medium',
  variant = 'gradient',
  showIcon = true,
  showFollowingCount = false,
  onFollowChange,
  disabled = false,
  style,
  textStyle,
}) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  
  // Simple animation state
  const [isPressed, setIsPressed] = useState(false);

  // Don't show button for self
  if (!user || user.uid === targetUserId) {
    return null;
  }

  // Initialize follow status
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        await DynamicFollowService.initialize(user.uid);
        
        const [followStatus, counts] = await Promise.all([
          DynamicFollowService.isFollowing(user.uid, targetUserId),
          DynamicFollowService.getFollowCounts(targetUserId)
        ]);
        
        if (isMounted) {
          setIsFollowing(followStatus);
          setFollowersCount(counts.followersCount);
        }
      } catch (error) {
        console.error('Error initializing follow button:', error);
      }
    };

    initialize();

    // Subscribe to real-time follow events
    const unsubscribe = DynamicFollowService.subscribeToFollowEvents(user.uid, (event) => {
      if (event.targetUserId === targetUserId) {
        const newFollowingState = event.type === 'follow';
        setIsFollowing(newFollowingState);
        setFollowersCount(prev => newFollowingState ? prev + 1 : Math.max(0, prev - 1));
        
        // Simple visual feedback
        console.log('✨ Follow state changed:', newFollowingState);
        
        onFollowChange?.(newFollowingState, followersCount + (newFollowingState ? 1 : -1));
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [user.uid, targetUserId]);

  const handleFollowToggle = useCallback(async () => {
    if (loading || disabled) return;

    try {
      setLoading(true);
      
      // Simple press feedback
      setIsPressed(true);
      setTimeout(() => setIsPressed(false), 150);

      const result = await DynamicFollowService.toggleFollow(
        user.uid, 
        targetUserId, 
        targetUserName
      );

      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to update follow status');
        return;
      }

      // Success feedback
      if (result.isFollowing) {
        Alert.alert(
          'Following!',
          `You are now following ${targetUserName}`,
          [{ text: 'OK' }],
          { cancelable: true }
        );
      }

    } catch (error) {
      console.error('Error in follow toggle:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user.uid, targetUserId, targetUserName, loading, disabled]);

  // Get size-specific styles
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 16,
          fontSize: 12,
          iconSize: 14,
        };
      case 'large':
        return {
          paddingHorizontal: 24,
          paddingVertical: 12,
          borderRadius: 24,
          fontSize: 16,
          iconSize: 18,
        };
      default: // medium
        return {
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 20,
          fontSize: 14,
          iconSize: 16,
        };
    }
  };

  const sizeStyles = getSizeStyles();

  // Get button colors based on variant and state
  const getButtonColors = () => {
    if (isFollowing) {
      return {
        backgroundColor: variant === 'outlined' ? 'transparent' : colors.surface,
        borderColor: colors.border,
        textColor: colors.text,
      };
    }

    switch (variant) {
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          borderColor: colors.primary,
          textColor: colors.primary,
        };
      case 'text':
        return {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          textColor: colors.primary,
        };
      default: // filled and gradient
        return {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
          textColor: colors.background,
        };
    }
  };

  const buttonColors = getButtonColors();

  // Simple styles based on press state
  const buttonStyle = useMemo(() => ({
    transform: [{ scale: isPressed ? 0.95 : 1 }],
  }), [isPressed]);

  // Render button content
  const renderButtonContent = () => {
    if (loading) {
      return (
        <ActivityIndicator 
          size="small" 
          color={buttonColors.textColor} 
        />
      );
    }

    return (
      <View style={styles.buttonContent}>
        {showIcon && (
          <View>
            <Icon
              name={isFollowing ? 'person-remove' : 'person-add'}
              size={sizeStyles.iconSize}
              color={buttonColors.textColor}
              style={[styles.icon, { marginRight: showFollowingCount || size !== 'small' ? 4 : 0 }]}
            />
          </View>
        )}
        
        <Text
          style={[
            styles.buttonText,
            {
              fontSize: sizeStyles.fontSize,
              color: buttonColors.textColor,
            },
            textStyle,
          ]}
          numberOfLines={1}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </Text>
        
        {showFollowingCount && followersCount > 0 && (
          <Text
            style={[
              styles.countText,
              {
                fontSize: sizeStyles.fontSize - 2,
                color: buttonColors.textColor,
                opacity: 0.8,
              },
            ]}
          >
            {' '}({followersCount})
          </Text>
        )}
      </View>
    );
  };

  // Render different variants
  const renderButton = () => {
    if (variant === 'gradient' && !isFollowing) {
      return (
        <View style={buttonStyle}>
          <TouchableOpacity
            onPress={handleFollowToggle}
            disabled={loading || disabled}
            activeOpacity={0.8}
            style={[style, { opacity: disabled ? 0.6 : 1 }]}
          >
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.gradientButton,
                {
                  paddingHorizontal: sizeStyles.paddingHorizontal,
                  paddingVertical: sizeStyles.paddingVertical,
                  borderRadius: sizeStyles.borderRadius,
                },
              ]}
            >
              {renderButtonContent()}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={buttonStyle}>
        <TouchableOpacity
          onPress={handleFollowToggle}
          disabled={loading || disabled}
          activeOpacity={0.8}
          style={[
            styles.button,
            {
              backgroundColor: buttonColors.backgroundColor,
              borderColor: buttonColors.borderColor,
              borderWidth: variant === 'outlined' || isFollowing ? 1 : 0,
              paddingHorizontal: sizeStyles.paddingHorizontal,
              paddingVertical: sizeStyles.paddingVertical,
              borderRadius: sizeStyles.borderRadius,
              opacity: disabled ? 0.6 : 1,
            },
            style,
          ]}
        >
          {renderButtonContent()}
        </TouchableOpacity>
      </View>
    );
  };

  return renderButton();
};

// Hook for using follow service across app
export const useUniversalFollow = (userId: string) => {
  const { user } = useAuth();
  const [followingList, setFollowingList] = useState<string[]>([]);
  const [followersCount, setFollowersCount] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user?.uid) return;

    const initialize = async () => {
      try {
        await DynamicFollowService.initialize(user.uid);
        const following = await DynamicFollowService.getFollowing(user.uid);
        setFollowingList(following.map(u => u.uid));
      } catch (error) {
        console.error('Error initializing universal follow:', error);
      }
    };

    initialize();

    // Subscribe to follow events
    const unsubscribe = DynamicFollowService.subscribeToFollowEvents(user.uid, (event) => {
      if (event.type === 'follow') {
        setFollowingList(prev => [...new Set([...prev, event.targetUserId])]);
      } else {
        setFollowingList(prev => prev.filter(id => id !== event.targetUserId));
      }
    });

    return unsubscribe;
  }, [user?.uid]);

  const isFollowing = useCallback((targetUserId: string) => {
    return followingList.includes(targetUserId);
  }, [followingList]);

  const toggleFollow = useCallback(async (targetUserId: string, targetUserName?: string) => {
    if (!user?.uid) return { success: false, isFollowing: false };

    try {
      const result = await DynamicFollowService.toggleFollow(user.uid, targetUserId, targetUserName);
      return result;
    } catch (error) {
      console.error('Error in universal follow toggle:', error);
      return { success: false, isFollowing: false };
    }
  }, [user?.uid]);

  const getFollowersCount = useCallback(async (targetUserId: string) => {
    if (followersCount[targetUserId]) {
      return followersCount[targetUserId];
    }

    try {
      const counts = await DynamicFollowService.getFollowCounts(targetUserId);
      setFollowersCount(prev => ({ ...prev, [targetUserId]: counts.followersCount }));
      return counts.followersCount;
    } catch (error) {
      console.error('Error getting followers count:', error);
      return 0;
    }
  }, [followersCount]);

  return {
    followingList,
    isFollowing,
    toggleFollow,
    getFollowersCount,
  };
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  countText: {
    fontWeight: '400',
  },
  icon: {
    marginRight: 4,
  },
});

export default UniversalFollowButton;
