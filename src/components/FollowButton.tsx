import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../context/FastAuthContext';
import FirebaseService from '../services/firebaseService';

interface FollowButtonProps {
  userId: string;
  isFollowing?: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
  style?: any;
  textStyle?: any;
}

const FollowButton: React.FC<FollowButtonProps> = ({
  userId,
  isFollowing = false,
  onFollowChange,
  style,
  textStyle
}) => {
  const { user } = useAuth();
  const [following, setFollowing] = useState(isFollowing);
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    if (!user) {
      Alert.alert('Error', 'Please log in to follow users');
      return;
    }

    if (loading) return;

    setLoading(true);
    try {
      // Use the new toggle function that prevents duplicate follows
      const result = await FirebaseService.toggleFollowUser(user.uid, userId);
      
      setFollowing(result.isFollowing);
      onFollowChange?.(result.isFollowing);
    } catch (error) {
      console.error('❌ Error toggling follow:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update follow status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        following ? styles.followingButton : styles.followButton,
        style
      ]}
      onPress={handlePress}
    >
      <Text style={[
        styles.buttonText,
        following ? styles.followingText : styles.followText,
        textStyle
      ]}>
        {loading ? '...' : (following ? 'Following' : 'Follow')}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  followButton: {
    backgroundColor: '#007AFF',
  },
  followingButton: {
    backgroundColor: '#E5E5E7',
    borderWidth: 1,
    borderColor: '#D1D1D6',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  followText: {
    color: '#FFFFFF',
  },
  followingText: {
    color: '#000000',
  },
});

export default FollowButton;
