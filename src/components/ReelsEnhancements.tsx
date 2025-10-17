import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Share,
  Alert,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { InstagramLikeButton } from './InstagramLikeButton';

const { width, height } = Dimensions.get('window');

// Reels Enhancement Features
interface ReelsEnhancementsProps {
  videoId: string;
  userId: string;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => void;
  onFollow: () => void;
  isLiked: boolean;
  isSaved: boolean;
  isFollowing: boolean;
  likesCount: number;
  commentsCount: number;
  userName: string;
  description: string;
  audioName?: string;
}

export const ReelsEnhancements: React.FC<ReelsEnhancementsProps> = ({
  videoId,
  userId,
  onLike,
  onComment,
  onShare,
  onSave,
  onFollow,
  isLiked,
  isSaved,
  isFollowing,
  likesCount,
  commentsCount,
  userName,
  description,
  audioName
}) => {
  const [likeAnimation] = useState(new Animated.Value(0));
  const [saveAnimation] = useState(new Animated.Value(0));

  const handleLike = useCallback(() => {
    onLike();
    
    // Animate like button
    Animated.sequence([
      Animated.timing(likeAnimation, {
        toValue: 1.2,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(likeAnimation, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [onLike, likeAnimation]);

  const handleSave = useCallback(() => {
    onSave();
    
    // Animate save button
    Animated.sequence([
      Animated.timing(saveAnimation, {
        toValue: 1.2,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(saveAnimation, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [onSave, saveAnimation]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `Check out this reel by ${userName} on Jorvea!`,
        url: `https://jorvea.app/reels/${videoId}`, // Your app's deep link
        title: `Reel by ${userName}`,
      });
      onShare();
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert('Error', 'Failed to share reel');
    }
  }, [videoId, userName, onShare]);

  return (
    <View style={styles.container}>
      {/* Right Side Actions */}
      <View style={styles.actionsContainer}>
        {/* Like Button */}
        <View style={styles.actionButton}>
          <InstagramLikeButton
            contentId={videoId}
            contentType="reel"
            initialLiked={isLiked}
            initialCount={likesCount}
            variant="story"
            size="large"
            showCount={true}
            showAnimation={true}
            onLikeChange={(liked, count) => {
              // Update parent component if needed
            }}
          />
        </View>

        {/* Comment Button */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onComment}
          activeOpacity={0.7}
        >
          <Icon name="chatbubble-outline" size={30} color="#FFFFFF" />
          <Text style={styles.actionText}>
            {commentsCount > 999 ? `${(commentsCount / 1000).toFixed(1)}K` : commentsCount}
          </Text>
        </TouchableOpacity>

        {/* Share Button */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleShare}
          activeOpacity={0.7}
        >
          <Icon name="paper-plane-outline" size={30} color="#FFFFFF" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>

        {/* Save Button */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleSave}
          activeOpacity={0.7}
        >
          <Animated.View style={{ transform: [{ scale: saveAnimation }] }}>
            <Icon
              name={isSaved ? "bookmark" : "bookmark-outline"}
              size={30}
              color={isSaved ? "#FFD700" : "#FFFFFF"}
            />
          </Animated.View>
          <Text style={styles.actionText}>Save</Text>
        </TouchableOpacity>

        {/* More Options */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            Alert.alert(
              'Options',
              'Choose an action',
              [
                { text: 'Report', onPress: () => console.log('Report pressed') },
                { text: 'Not Interested', onPress: () => console.log('Not Interested pressed') },
                { text: 'Copy Link', onPress: () => console.log('Copy Link pressed') },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}
          activeOpacity={0.7}
        >
          <Icon name="ellipsis-horizontal" size={30} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Bottom Info */}
      <View style={styles.infoContainer}>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>@{userName}</Text>
          {!isFollowing && (
            <TouchableOpacity
              style={styles.followButton}
              onPress={onFollow}
              activeOpacity={0.8}
            >
              <Text style={styles.followText}>Follow</Text>
            </TouchableOpacity>
          )}
        </View>

        {description ? (
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        ) : null}

        {audioName ? (
          <View style={styles.audioInfo}>
            <Icon name="musical-note" size={14} color="#FFFFFF" />
            <Text style={styles.audioText} numberOfLines={1}>
              {audioName}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

// Progress Indicator Component
interface ProgressIndicatorProps {
  currentIndex: number;
  totalCount: number;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentIndex,
  totalCount
}) => {
  if (totalCount <= 1) return null;

  return (
    <View style={styles.progressContainer}>
      {Array.from({ length: totalCount }, (_, index) => (
        <View
          key={index}
          style={[
            styles.progressDot,
            index === currentIndex && styles.progressDotActive
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.4,
    justifyContent: 'space-between',
    zIndex: 10,
  },
  actionsContainer: {
    position: 'absolute',
    right: 15,
    bottom: 100,
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 25,
    minWidth: 50,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  infoContainer: {
    position: 'absolute',
    bottom: 30,
    left: 15,
    right: 80,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  followButton: {
    marginLeft: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#FF3040',
    borderRadius: 20,
  },
  followText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  description: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  audioInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    maxWidth: width * 0.6,
  },
  audioText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginLeft: 6,
    flex: 1,
  },
  progressContainer: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 2,
  },
  progressDotActive: {
    backgroundColor: '#FFFFFF',
  },
});

export default ReelsEnhancements;
