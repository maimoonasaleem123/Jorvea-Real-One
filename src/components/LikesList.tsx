import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import FirebaseService from '../services/firebaseService';
import { User } from '../types';
import { useAuth } from '../context/FastAuthContext';

interface LikesListProps {
  visible: boolean;
  onClose: () => void;
  postId?: string;
  reelId?: string;
  commentId?: string;
}

export const LikesList: React.FC<LikesListProps> = ({
  visible,
  onClose,
  postId,
  reelId,
  commentId,
}) => {
  const { user } = useAuth();
  const [likes, setLikes] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && (postId || reelId || commentId)) {
      loadLikes();
    }
  }, [visible, postId, reelId, commentId]);

  const loadLikes = async () => {
    if (!postId && !reelId && !commentId) return;

    setLoading(true);
    try {
      let likesData: User[] = [];
      
      if (postId) {
        likesData = await FirebaseService.getPostLikes(postId);
      } else if (reelId) {
        likesData = await FirebaseService.getReelLikes(reelId);
      } else if (commentId) {
        likesData = await FirebaseService.getCommentLikes(commentId);
      }

      setLikes(likesData);
    } catch (error) {
      console.error('Error loading likes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (userId: string) => {
    if (!user) return;

    try {
      const isFollowing = await FirebaseService.checkIfFollowing(user.uid, userId);
      
      if (isFollowing) {
        await FirebaseService.unfollowUser(user.uid, userId);
      } else {
        await FirebaseService.followUser(user.uid, userId);
      }

      // Update local state
      setLikes(prev =>
        prev.map(likeUser =>
          likeUser.uid === userId
            ? { ...likeUser, isFollowing: !isFollowing }
            : likeUser
        )
      );
    } catch (error) {
      console.error('Error following/unfollowing user:', error);
    }
  };

  const renderLikeItem = ({ item: likeUser }: { item: User }) => (
    <View style={styles.likeItem}>
      <TouchableOpacity style={styles.userInfo}>
        <Image
          source={{ uri: likeUser.profilePicture || likeUser.photoURL }}
          style={styles.avatar}
        />
        <View style={styles.userDetails}>
          <Text style={styles.displayName}>{likeUser.displayName}</Text>
          <Text style={styles.username}>@{likeUser.username}</Text>
        </View>
      </TouchableOpacity>

      {likeUser.uid !== user?.uid && (
        <TouchableOpacity
          style={[
            styles.followButton,
            likeUser.isFollowing && styles.followingButton,
          ]}
          onPress={() => handleFollow(likeUser.uid)}
        >
          <Text
            style={[
              styles.followButtonText,
              likeUser.isFollowing && styles.followingButtonText,
            ]}
          >
            {likeUser.isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Likes</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color="#000" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        ) : (
          <FlatList
            data={likes}
            renderItem={renderLikeItem}
            keyExtractor={(item) => item.uid}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        )}

        {!loading && likes.length === 0 && (
          <View style={styles.emptyContainer}>
            <Icon name="heart-outline" size={48} color="#C7C7CC" />
            <Text style={styles.emptyText}>No likes yet</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  closeButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  likeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: '#8E8E93',
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  followingButton: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  followingButtonText: {
    color: '#000',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 12,
  },
});
