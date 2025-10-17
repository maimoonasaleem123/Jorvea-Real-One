import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Image,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Text,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface DynamicProfilePictureProps {
  userId: string;
  size?: number;
  showOnlineStatus?: boolean;
  onPress?: () => void;
  style?: any;
  priority?: 'high' | 'medium' | 'low';
  fallbackIcon?: string;
  borderColor?: string;
  borderWidth?: number;
}

export const DynamicProfilePicture: React.FC<DynamicProfilePictureProps> = ({
  userId,
  size = 40,
  showOnlineStatus = false,
  onPress,
  style,
  priority = 'medium',
  fallbackIcon = 'person',
  borderColor = '#fff',
  borderWidth = 2,
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Fetch user profile picture and online status
  const fetchUserData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(false);
      
      const userDoc = await firestore().collection('users').doc(userId).get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        const profileUrl = userData?.profilePicture || userData?.photoURL || null;
        
        setImageUrl(profileUrl);
        
        if (showOnlineStatus) {
          setIsOnline(userData?.isOnline || false);
        }
      } else {
        console.warn(`User not found: ${userId}`);
        setImageUrl(null);
      }
    } catch (err) {
      console.error('Error fetching user profile picture:', err);
      setError(true);
      setImageUrl(null);
    } finally {
      setLoading(false);
    }
  }, [userId, showOnlineStatus]);

  // Real-time listener for profile picture changes
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = firestore()
      .collection('users')
      .doc(userId)
      .onSnapshot(
        (doc) => {
          if (doc.exists) {
            const userData = doc.data();
            const profileUrl = userData?.profilePicture || userData?.photoURL || null;
            
            setImageUrl(profileUrl);
            setError(false);
            
            if (showOnlineStatus) {
              setIsOnline(userData?.isOnline || false);
            }
          }
          setLoading(false);
        },
        (error) => {
          console.error('Profile picture listener error:', error);
          setError(true);
          setLoading(false);
        }
      );

    return unsubscribe;
  }, [userId, showOnlineStatus]);

  // Handle image load error with retry
  const handleImageError = useCallback(() => {
    console.warn(`Failed to load profile picture for user: ${userId}`);
    setError(true);
    
    // Retry loading up to 2 times
    if (retryCount < 2) {
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        fetchUserData();
      }, 1000 * (retryCount + 1));
    }
  }, [userId, retryCount, fetchUserData]);

  // Handle retry button press
  const handleRetry = useCallback(() => {
    setRetryCount(0);
    fetchUserData();
  }, [fetchUserData]);

  // Render loading state
  if (loading) {
    return (
      <View style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2 },
        style
      ]}>
        <View style={[
          styles.loadingContainer,
          { width: size, height: size, borderRadius: size / 2 }
        ]}>
          <ActivityIndicator 
            size={size > 50 ? 'small' : 'small'} 
            color="#666" 
          />
        </View>
      </View>
    );
  }

  // Render error state with fallback
  if (error || !imageUrl) {
    return (
      <TouchableOpacity 
        style={[
          styles.container,
          { width: size, height: size, borderRadius: size / 2 },
          style
        ]}
        onPress={error ? handleRetry : onPress}
        activeOpacity={0.7}
      >
        <View style={[
          styles.fallbackContainer,
          { 
            width: size, 
            height: size, 
            borderRadius: size / 2,
            borderColor: error ? '#ff6b6b' : borderColor,
            borderWidth: borderWidth,
          }
        ]}>
          <Icon 
            name={error ? 'refresh' : fallbackIcon} 
            size={size * 0.5} 
            color={error ? '#ff6b6b' : '#666'} 
          />
        </View>
        
        {showOnlineStatus && (
          <View style={[
            styles.onlineStatus,
            { 
              width: size * 0.3, 
              height: size * 0.3, 
              borderRadius: size * 0.15,
              right: -2,
              bottom: -2,
              backgroundColor: isOnline ? '#4CAF50' : '#ccc',
            }
          ]} />
        )}
      </TouchableOpacity>
    );
  }

  // Render profile picture
  return (
    <TouchableOpacity 
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2 },
        style
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: imageUrl }}
        style={[
          styles.image,
          { 
            width: size, 
            height: size, 
            borderRadius: size / 2,
            borderColor: borderColor,
            borderWidth: borderWidth,
          }
        ]}
        onError={handleImageError}
        resizeMode="cover"
      />
      
      {showOnlineStatus && (
        <View style={[
          styles.onlineStatus,
          { 
            width: size * 0.3, 
            height: size * 0.3, 
            borderRadius: size * 0.15,
            right: -2,
            bottom: -2,
            backgroundColor: isOnline ? '#4CAF50' : '#ccc',
          }
        ]} />
      )}
    </TouchableOpacity>
  );
};

// Enhanced profile picture specifically for reels
export const ReelsProfilePicture: React.FC<{
  userId: string;
  size?: number;
  onPress?: () => void;
}> = ({ userId, size = 40, onPress }) => {
  return (
    <DynamicProfilePicture
      userId={userId}
      size={size}
      onPress={onPress}
      priority="high"
      borderColor="#fff"
      borderWidth={2}
      style={styles.reelsProfile}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  loadingContainer: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackContainer: {
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    resizeMode: 'cover',
  },
  onlineStatus: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#fff',
  },
  reelsProfile: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});

export default DynamicProfilePicture;
