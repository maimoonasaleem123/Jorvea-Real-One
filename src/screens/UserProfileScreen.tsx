import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Dimensions,
  Platform,
  StatusBar,
  Modal,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, NavigationProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import FirebaseService, { Post, Reel, Story } from '../services/firebaseService';
import InstagramLikeLoadingService from '../services/InstagramLikeLoadingService';
import { User, RootStackParamList } from '../types';
import ComprehensivePrivacyService from '../services/ComprehensivePrivacyService';
import InstantProfileService from '../services/InstantProfileService';
import InstagramInstantProfileService from '../services/InstagramInstantProfileService';
import InstagramProgressiveLoader from '../services/InstagramProgressiveLoader';
import { InstagramPostViewer, InstagramReelViewer } from '../components/InstagramViewers';
import { DynamicFollowButton, DynamicFollowStats } from '../components/DynamicFollowButton';
import DynamicFollowSystem from '../services/DynamicFollowSystem';
import { useAuth } from '../context/FastAuthContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type UserProfileScreenRouteProp = RouteProp<RootStackParamList, 'UserProfile'>;

interface UserProfileScreenProps {}

const UserProfileScreen: React.FC<UserProfileScreenProps> = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<UserProfileScreenRouteProp>();
  const { user: currentUser } = useAuth();
  const { userId } = route.params;

  // Core state - NO LOADING STATES FOR INSTANT EXPERIENCE
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Content state with instant loading
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [userReels, setUserReels] = useState<Reel[]>([]);
  const [userStories, setUserStories] = useState<Story[]>([]);

  // UI state for instant experience
  const [activeTab, setActiveTab] = useState<'posts' | 'reels' | 'tagged'>('reels');

  // Privacy state with comprehensive controls
  const [canViewProfile, setCanViewProfile] = useState(true);
  const [canViewPosts, setCanViewPosts] = useState(true);
  const [canViewReels, setCanViewReels] = useState(true);
  const [canViewFollowers, setCanViewFollowers] = useState(false);
  const [canViewFollowing, setCanViewFollowing] = useState(false);
  const [isAccountPrivate, setIsAccountPrivate] = useState(false);

  // Viewer states for posts and reels
  const [showPostViewer, setShowPostViewer] = useState(false);
  const [showReelViewer, setShowReelViewer] = useState(false);
  const [selectedPostIndex, setSelectedPostIndex] = useState(0);
  const [selectedReelIndex, setSelectedReelIndex] = useState(0);

  // INSTAGRAM-STYLE INSTANT LOADING - NO LOADING STATES
  const loadInstantProfile = useCallback(async () => {
    if (!currentUser) return;

    try {
      console.log('🚀 UserProfileScreen: Instagram-style instant loading for user:', userId);
      
      // Load profile instantly - returns immediately with basic structure
      const profileData = await InstagramInstantProfileService.loadProfileInstantly(userId, currentUser.uid);
      
      // Set all data instantly (NO loading states)
      setUserProfile(profileData.user);
      setCanViewProfile(profileData.canViewProfile);
      setCanViewReels(profileData.canViewReels);
      setIsAccountPrivate(profileData.isPrivate);
      
      // Start progressive loading immediately in background
      if (profileData.canViewProfile) {
        // Initialize empty arrays first
        setUserPosts([]);
        setUserReels([]);

        // Load posts progressively like Instagram (one by one)
        InstagramProgressiveLoader.loadPostsProgressively(userId, {
          batchSize: 12,
          loadDelay: 100,
          onItemLoaded: (post, index) => {
            setUserPosts(prevPosts => {
              const newPosts = [...prevPosts];
              newPosts[index] = post;
              return newPosts.filter(p => p); // Remove empty slots
            });
          },
          onBatchComplete: (allPosts) => {
            setUserPosts(allPosts);
            console.log('✅ All posts loaded progressively:', allPosts.length);
          }
        });

        // Load reels progressively like Instagram (one by one)
        if (profileData.canViewReels) {
          InstagramProgressiveLoader.loadReelsProgressively(userId, {
            batchSize: 12,
            loadDelay: 150,
            onItemLoaded: (reel, index) => {
              setUserReels(prevReels => {
                const newReels = [...prevReels];
                newReels[index] = reel;
                return newReels.filter(r => r); // Remove empty slots
              });
            },
            onBatchComplete: (allReels) => {
              setUserReels(allReels);
              console.log('✅ All reels loaded progressively:', allReels.length);
            }
          });
        }
      }

      // Background loading will update the UI progressively
      // No need to wait - UI is already shown with instant data
      
    } catch (error) {
      console.error('❌ Error in Instagram instant profile loading:', error);
      Alert.alert('Error', 'Failed to load profile');
    }
  }, [userId, currentUser]);

  // Load profile data when component mounts - INSTANT, NO LOADING
  useEffect(() => {
    if (currentUser) {
      loadInstantProfile();
    }
  }, [currentUser, loadInstantProfile]);

  // Instant refresh without loading states
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadInstantProfile().finally(() => setRefreshing(false));
  }, [loadInstantProfile]);

  // INSTAGRAM-STYLE INSTANT FOLLOW/UNFOLLOW - Now using Dynamic Follow System
  const handleFollowToggle = async () => {
    if (!currentUser || !userId) return;
    
    try {
      // Use dynamic follow system for real-time updates
      await DynamicFollowSystem.getInstance().toggleFollow(userId, currentUser.uid);
      
      // Reload cached data in background for updated counts
      setTimeout(() => {
        loadInstantProfile();
      }, 100);
    } catch (error) {
      console.error('Error toggling follow:', error);
      Alert.alert('Error', 'Failed to update follow status');
    }
  };

  // Navigate to messages for this user
  const handleMessageUser = () => {
    if (!currentUser || !userProfile) return;
    
    navigation.navigate('ChatScreen', {
      userId: userId,
      otherUserName: userProfile.displayName || userProfile.username,
      otherUserAvatar: userProfile.profilePicture
    });
  };

  // Handle post selection and viewer
  const handlePostPress = (index: number) => {
    setSelectedPostIndex(index);
    setShowPostViewer(true);
  };

  // Handle reel selection and viewer
  const handleReelPress = (index: number) => {
    setSelectedReelIndex(index);
    setShowReelViewer(true);
  };

  // Navigate to profile settings (only for own profile)
  const handleEditProfile = () => {
    if (currentUser?.uid === userId) {
      navigation.navigate('ProfileSettings' as never);
    }
  };

  // Navigate to followers/following with privacy checks - now using dynamic stats
  const handleFollowersPress = () => {
    if (canViewFollowers) {
      Alert.alert('Followers', 'Followers list will be shown');
    } else {
      Alert.alert('Private Account', 'This information is not available for private accounts.');
    }
  };

  const handleFollowingPress = () => {
    if (canViewFollowing) {
      Alert.alert('Following', 'Following list will be shown');
    } else {
      Alert.alert('Private Account', 'This information is not available for private accounts.');
    }
  };

  // Render privacy-aware profile content
  const renderProfileContent = () => {
    if (!canViewProfile && isAccountPrivate) {
      return (
        <View style={styles.privateAccountContainer}>
          <Icon name="lock-closed" size={80} color="#666" />
          <Text style={styles.privateAccountText}>This Account is Private</Text>
          <Text style={styles.privateAccountSubtext}>
            Follow this account to see their photos and videos.
          </Text>
          <DynamicFollowButton 
            targetUserId={userId}
            size="medium"
            variant="primary"
            style={styles.followButton}
          />
        </View>
      );
    }

    return (
      <>
        {/* Profile Stats */}
        <DynamicFollowStats userId={userId} />

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          {currentUser?.uid === userId ? (
            <TouchableOpacity style={styles.editProfileButton} onPress={handleEditProfile}>
              <Text style={styles.editProfileButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          ) : (
            <>
              <DynamicFollowButton 
                targetUserId={userId}
                size="medium"
                variant="primary"
                style={styles.followButton}
              />
              
              <TouchableOpacity 
                style={styles.messageButton} 
                onPress={handleMessageUser}
              >
                <Icon name="chatbubble-outline" size={20} color="#000" />
                <Text style={styles.messageButtonText}>Message</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Content Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'posts' && styles.activeTab]}
            onPress={() => setActiveTab('posts')}
          >
            <Icon 
              name="grid-outline" 
              size={24} 
              color={activeTab === 'posts' ? '#000' : '#666'} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'reels' && styles.activeTab]}
            onPress={() => setActiveTab('reels')}
          >
            <Icon 
              name="play-circle-outline" 
              size={24} 
              color={activeTab === 'reels' ? '#000' : '#666'} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'tagged' && styles.activeTab]}
            onPress={() => setActiveTab('tagged')}
          >
            <Icon 
              name="person-outline" 
              size={24} 
              color={activeTab === 'tagged' ? '#000' : '#666'} 
            />
          </TouchableOpacity>
        </View>

        {/* Content based on active tab and permissions */}
        {activeTab === 'posts' && canViewPosts && (
          <View style={styles.contentContainer}>
            {userPosts.length > 0 ? (
              <View style={styles.postsGrid}>
                {userPosts.map((post, index) => (
                  <TouchableOpacity 
                    key={post.id} 
                    style={styles.postGridItem}
                    onPress={() => handlePostPress(index)}
                  >
                    <Image 
                      source={{ uri: post.mediaUrls?.[0] || 'https://via.placeholder.com/150' }} 
                      style={styles.postGridImage as any}
                      resizeMode="cover"
                    />
                    {post.mediaType === 'video' && (
                      <View style={styles.videoIndicator}>
                        <Icon name="play" size={16} color="#fff" />
                      </View>
                    )}
                    {post.mediaUrls && post.mediaUrls.length > 1 && (
                      <View style={styles.multipleMediaIndicator}>
                        <Icon name="copy-outline" size={16} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyContent}>
                <Icon name="grid-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No posts yet</Text>
              </View>
            )}
          </View>
        )}
        
        {activeTab === 'reels' && canViewReels && (
          <View style={styles.contentContainer}>
            {userReels.length > 0 ? (
              <View style={styles.reelsGrid}>
                {userReels.map((reel, index) => (
                  <TouchableOpacity 
                    key={reel.id} 
                    style={styles.reelGridItem}
                    onPress={() => handleReelPress(index)}
                  >
                    <Image 
                      source={{ uri: reel.thumbnailUrl || reel.videoUrl || 'https://via.placeholder.com/150' }} 
                      style={styles.reelGridImage as any}
                      resizeMode="cover"
                    />
                    <View style={styles.reelIndicator}>
                      <Icon name="play" size={16} color="#fff" />
                    </View>
                    <View style={styles.reelStats}>
                      <Icon name="heart" size={12} color="#fff" />
                      <Text style={styles.reelStatsText}>{reel.likesCount || 0}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyContent}>
                <Icon name="play-circle-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No reels yet</Text>
              </View>
            )}
          </View>
        )}
        
        {activeTab === 'tagged' && (
          <View style={styles.emptyContent}>
            <Text style={styles.emptyText}>No tagged posts</Text>
          </View>
        )}

        {/* Privacy restrictions message */}
        {((activeTab === 'posts' && !canViewPosts) || 
          (activeTab === 'reels' && !canViewReels)) && (
          <View style={styles.restrictedContent}>
            <Icon name="lock-closed" size={40} color="#666" />
            <Text style={styles.restrictedText}>Content Not Available</Text>
            <Text style={styles.restrictedSubtext}>
              Follow this account to see their {activeTab}.
            </Text>
          </View>
        )}
      </>
    );
  };

  // INSTANT RENDERING - NO LOADING STATES
  if (!userProfile) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>User not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{userProfile.username}</Text>
        <TouchableOpacity>
          <Icon name="ellipsis-horizontal" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.profileImageContainer}>
            <Image
              source={{ 
                uri: userProfile.profilePicture || 'https://via.placeholder.com/100' 
              }}
              style={styles.profileImage as any}
            />
            {isAccountPrivate && (
              <View style={styles.privateIndicator}>
                <Icon name="lock-closed" size={12} color="#fff" />
              </View>
            )}
          </View>
          
          <Text style={styles.displayName}>{userProfile.displayName}</Text>
          {userProfile.bio && (
            <Text style={styles.bio}>{userProfile.bio}</Text>
          )}
        </View>

        {/* Profile Content */}
        {renderProfileContent()}
      </ScrollView>

      {/* Post Viewer Modal */}
      {showPostViewer && userPosts.length > 0 && (
        <InstagramPostViewer
          visible={showPostViewer}
          posts={userPosts}
          initialIndex={selectedPostIndex}
          onClose={() => setShowPostViewer(false)}
          onUserProfilePress={(userId) => {
            // Handle user profile navigation if needed
            console.log('Navigate to user profile:', userId);
          }}
        />
      )}

      {/* Reel Viewer Modal */}
      {showReelViewer && userReels.length > 0 && (
        <InstagramReelViewer
          visible={showReelViewer}
          reels={userReels}
          initialIndex={selectedReelIndex}
          onClose={() => setShowReelViewer(false)}
          onUserProfilePress={(userId) => {
            // Handle user profile navigation if needed
            console.log('Navigate to user profile:', userId);
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  scrollView: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0f0f0',
  },
  privateIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#666',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  displayName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  bio: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  editProfileButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  editProfileButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  followButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  followingButtonText: {
    color: '#000',
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    gap: 6,
  },
  messageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  tabContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  activeTab: {
    borderTopWidth: 2,
    borderTopColor: '#000',
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 1,
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  postGridItem: {
    width: (screenWidth - 4) / 3,
    height: (screenWidth - 4) / 3,
    marginBottom: 2,
    position: 'relative',
  },
  postGridImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
  },
  videoIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  multipleMediaIndicator: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  reelGridItem: {
    width: (screenWidth - 4) / 3,
    height: (screenWidth - 4) / 3 * 1.3,
    marginBottom: 2,
    position: 'relative',
  },
  reelGridImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
  },
  reelIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -12 }, { translateY: -12 }],
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelStats: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  reelStatsText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
  },
  privateAccountContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  privateAccountText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  privateAccountSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  restrictedContent: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 40,
  },
  restrictedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginTop: 12,
    marginBottom: 4,
  },
  restrictedSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default UserProfileScreen;
