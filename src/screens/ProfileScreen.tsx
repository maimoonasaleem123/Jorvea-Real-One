import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  ScrollView,
  Image,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/FastAuthContext';
import FirebaseService, { Post, Reel, Story } from '../services/firebaseService';
import { User } from '../types';
import { BeautifulCard } from '../components/BeautifulCard';
import { StoryHighlights, StoryList } from '../components/StoryComponents';
import { InstagramStoryViewer } from '../components/InstagramStoryViewer';
import ProfileMediaGrid from '../components/ProfileMediaGrid';
import { useTheme } from '../context/ThemeContext';
import LinearGradient from 'react-native-linear-gradient';
import { InstagramPostViewer, InstagramReelViewer } from '../components/InstagramViewers';
import ProgressiveProfileGrid from '../components/ProgressiveProfileGrid';
import InstagramProfileReels from '../components/InstagramProfileReels';
import InstantProfileService from '../services/InstantProfileService';
import ComprehensivePrivacyService from '../services/ComprehensivePrivacyService';
import UltraFastLazyService from '../services/UltraFastLazyService';
import FollowersDebugService from '../services/FollowersDebugService';

const { width, height } = Dimensions.get('window');
const isTablet = width > 768;
const isSmallScreen = width < 350;
const postImageSize = isTablet ? (width - 20) / 4 : (width - 6) / 3;
const profileImageSize = isSmallScreen ? 70 : 80;

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, signOut } = useAuth();
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [userReels, setUserReels] = useState<Reel[]>([]);
  const [userStories, setUserStories] = useState<Story[]>([]);
  const [storyHighlights, setStoryHighlights] = useState<Story[][]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'reels'>('posts');
  // Removed loading states for instant experience
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [canViewProfile, setCanViewProfile] = useState(true);
  
  // Comprehensive Privacy States
  const [privacySummary, setPrivacySummary] = useState({
    canViewProfile: true,
    canViewReels: true,
    canViewFollowers: true,
    canViewFollowing: true,
    canViewStories: true,
    followStatus: {
      isFollowing: false,
      isFollowedBy: false,
      isMutual: false,
      isBlocked: false,
      isPending: false
    },
    isPrivateAccount: false
  });
  
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [showPostViewer, setShowPostViewer] = useState(false);
  const [showReelViewer, setShowReelViewer] = useState(false);
  const [selectedPostIndex, setSelectedPostIndex] = useState(0);
  const [selectedReelIndex, setSelectedReelIndex] = useState(0);
  const [storyViewerData, setStoryViewerData] = useState<{
    stories: Story[];
    userStories: { [userId: string]: Story[] };
    initialUserIndex: number;
    initialStoryIndex: number;
  } | null>(null);
  const { colors } = useTheme();

  const loadUserDataInstantly = useCallback(async () => {
    if (!user) return;

    try {
      console.log('⚡ ProfileScreen: Loading data INSTANTLY with privacy for user:', user.uid);
      
      // Load profile data INSTANTLY with enhanced lazy loading
      const instantProfileService = InstantProfileService.getInstance();
      const privacyService = ComprehensivePrivacyService.getInstance();
      
      // Get privacy summary for the user
      const summary = await privacyService.getPrivacySummary(user.uid, user.uid);
      setPrivacySummary(summary);
      
      // Load profile data with lazy loading service
      const [profileData, followCountsRaw] = await Promise.all([
        instantProfileService.getProfileInstantly(user.uid, user.uid),
        UltraFastLazyService.getFollowCounts(user.uid)
      ]);
      
      if (!profileData) {
        console.log('⚡ ProfileScreen: No profile found, creating new profile for user:', user.uid);
        
        // Generate a proper username from email or displayName
        const generateUsername = (email: string, displayName?: string): string => {
          if (displayName) {
            return displayName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
          }
          if (email) {
            return email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
          }
          return `user_${user.uid.slice(0, 8)}`;
        };

        const newProfile: User = {
          id: user.uid,
          uid: user.uid,
          email: user.email || '',
          username: generateUsername(user.email || '', user.displayName),
          displayName: user.displayName || user.email?.split('@')[0] || 'Jorvea User',
          profilePicture: user.profilePicture || user.photoURL || undefined,
          photoURL: user.profilePicture || user.photoURL || undefined,
          bio: 'Welcome to my Jorvea! ✨',
          website: '',
          phoneNumber: user.phoneNumber || '',
          isPrivate: false,
          isVerified: false,
          verified: false,
          followers: [],
          following: [],
          blockedUsers: [],
          postsCount: 0,
          storiesCount: 0,
          reelsCount: 0,
          createdAt: new Date(),
          lastActive: new Date(),
          settings: {
            notifications: {
              likes: true,
              comments: true,
              follows: true,
              messages: true,
              mentions: true,
              stories: true,
            },
            privacy: {
              isPrivate: false,
              privateAccount: false,
              showActivity: true,
              showOnlineStatus: true,
              allowMessages: 'everyone' as const,
            },
            theme: 'light' as const,
          },
        };
        
        // Create the profile in Firestore
        await FirebaseService.createUserProfile(newProfile);
        
        // Set empty data for new profile
        setUserProfile(newProfile);
        setUserPosts([]);
        setUserReels([]);
        setUserStories([]);
        setFollowersCount(0);
        setFollowingCount(0);
        setCanViewProfile(true);
        setIsFollowing(false);
        
        return;
      }
      
      // Set all data instantly - NO LOADING STATES
      setUserProfile(profileData.user);
      setUserPosts(profileData.posts);
      setUserReels(profileData.reels);
      setUserStories(profileData.stories);
      
      // Cast follow counts to proper type
      const followCounts = followCountsRaw as { followersCount: number; followingCount: number };
      setFollowersCount(followCounts.followersCount || 0);
      setFollowingCount(followCounts.followingCount || 0);
      setCanViewProfile(true); // Always show profile with privacy filtering in service
      setIsFollowing(false); // Can be updated separately
      
      // DEBUG: Check followers data
      console.log('🔍 DEBUG: Followers count:', followCounts.followersCount);
      console.log('🔍 DEBUG: Following count:', followCounts.followingCount);
      
      // If counts are 0, run debug to check actual data
      if (followCounts.followersCount === 0 && followCounts.followingCount === 0) {
        console.log('⚠️ Zero followers/following detected, running debug...');
        FollowersDebugService.debugFollowersCount(user.uid);
      }
      
      // Group stories into highlights (for demo, group by date)
      const highlights: Story[][] = [];
      if (profileData.stories.length > 0) {
        // Group stories into chunks of 10 for highlights
        for (let i = 0; i < profileData.stories.length; i += 10) {
          highlights.push(profileData.stories.slice(i, i + 10));
        }
      }
      setStoryHighlights(highlights);
      
      console.log('⚡ ProfileScreen: INSTANT data loaded - Posts:', profileData.posts.length, 'Reels:', profileData.reels.length);
      
    } catch (error) {
      console.error('❌ Error loading user data:', error);
      // Don't show alerts for better UX
    }
  }, [user]);

  useEffect(() => {
    loadUserDataInstantly();
  }, [loadUserDataInstantly]);

  const handleRefresh = () => {
    // Instant refresh - clear cache and reload
    if (user) {
      const instantProfileService = InstantProfileService.getInstance();
      instantProfileService.clearUserCache(user.uid);
      loadUserDataInstantly();
    }
  };

  const handleProfileImagePress = () => {
    if (userStories.length > 0) {
      // Show stories if available
      const userStoriesGroup = { [user?.uid || '']: userStories };
      setStoryViewerData({
        stories: userStories,
        userStories: userStoriesGroup,
        initialUserIndex: 0,
        initialStoryIndex: 0,
      });
      setShowStoryViewer(true);
    } else {
      // Show full profile image if no stories
      Alert.alert('Profile Picture', 'No stories available');
    }
  };

  const getStoryBorderColors = () => {
    if (!user?.uid) return [colors.border, colors.border];
    
    const hasUnseenStories = userStories.some(story => 
      !story.viewers.includes(user.uid)
    );
    
    if (hasUnseenStories) {
      return [colors.primary, colors.accent, colors.secondary];
    }
    return [colors.textMuted, colors.border, colors.textMuted];
  };

  const handleCreateStory = () => {
    navigation.navigate('CreateStory' as never);
  };

  const handleViewStory = (story: Story) => {
    const storyIndex = userStories.findIndex(s => s.id === story.id);
    const userStoriesMap = { [user?.uid || '']: userStories };
    setStoryViewerData({
      stories: userStories,
      userStories: userStoriesMap,
      initialUserIndex: 0,
      initialStoryIndex: storyIndex,
    });
    setShowStoryViewer(true);
  };

  const handleCreateHighlight = () => {
    Alert.alert('Create Highlight', 'Create story highlight feature coming soon!');
  };

  const handleViewHighlight = (highlight: Story[]) => {
    const userStoriesMap = { [user?.uid || '']: highlight };
    setStoryViewerData({
      stories: highlight,
      userStories: userStoriesMap,
      initialUserIndex: 0,
      initialStoryIndex: 0,
    });
    setShowStoryViewer(true);
  };

  const handleEditProfile = () => {
    navigation.navigate('EditProfile' as never);
  };

  const handleSettings = () => {
    navigation.navigate('Settings' as never);
  };

  const handlePrivacySettings = () => {
    navigation.navigate('PrivacySettings' as never);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ]
    );
  };

  const showMyFollowers = async () => {
    if (!user) return;
    (navigation as any).navigate('FollowersListScreen', {
      userId: user.uid,
      type: 'followers',
      username: userProfile?.username || user.displayName,
    });
  };

  const showMyFollowing = async () => {
    if (!user) return;
    (navigation as any).navigate('FollowersListScreen', {
      userId: user.uid,
      type: 'following',
      username: userProfile?.username || user.displayName,
    });
  };

  // DEBUG FUNCTION: Fix followers count
  const debugFixFollowers = async () => {
    if (!user) return;
    
    try {
      console.log('🔧 Fixing followers count...');
      const result = await FollowersDebugService.fixFollowersCount(user.uid);
      setFollowersCount(result.followersCount);
      setFollowingCount(result.followingCount);
      Alert.alert('Success', `Fixed followers: ${result.followersCount}, following: ${result.followingCount}`);
    } catch (error) {
      console.error('Error fixing followers:', error);
      Alert.alert('Error', 'Failed to fix followers count');
    }
  };

  const PostGridItem: React.FC<{ post: Post; index: number }> = ({ post, index }) => (
    <TouchableOpacity 
      style={styles.postGridItem}
      onPress={() => {
        setSelectedPostIndex(index);
        setShowPostViewer(true);
      }}
    >
      {post.mediaUrls && post.mediaUrls[0] ? (
        <Image 
          source={{ uri: post.mediaUrls[0] }} 
          style={styles.postGridImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.postGridImage, styles.placeholderImage]}>
          <Icon name="image-outline" size={32} color="#ccc" />
        </View>
      )}
      
      {post.mediaUrls && post.mediaUrls.length > 1 && (
        <View style={styles.carouselIndicator}>
          <Icon name="copy-outline" size={16} color="#fff" />
        </View>
      )}
      
      {post.mediaType === 'video' && (
        <View style={styles.videoIndicator}>
          <Icon name="play" size={16} color="#fff" />
        </View>
      )}

      {/* Post Stats Overlay */}
      <View style={styles.postStatsOverlay}>
        <View style={styles.postStat}>
          <Icon name="heart" size={14} color="#fff" />
          <Text style={styles.postStatText}>
            {FirebaseService.formatNumber(post.likesCount || 0)}
          </Text>
        </View>
        <View style={styles.postStat}>
          <Icon name="chatbubble" size={14} color="#fff" />
          <Text style={styles.postStatText}>
            {FirebaseService.formatNumber(post.commentsCount || 0)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const ReelGridItem: React.FC<{ reel: Reel; index: number }> = ({ reel, index }) => (
    <TouchableOpacity 
      style={styles.postGridItem}
      onPress={() => {
        setSelectedReelIndex(index);
        setShowReelViewer(true);
      }}
    >
      {reel.videoUrl ? (
        <Image 
          source={{ uri: reel.thumbnailUrl || reel.videoUrl }} 
          style={styles.postGridImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.postGridImage, styles.placeholderImage]}>
          <Icon name="videocam-outline" size={32} color="#ccc" />
        </View>
      )}
      
      <View style={styles.videoIndicator}>
        <Icon name="play" size={16} color="#fff" />
      </View>
      
      <View style={styles.reelViewsIndicator}>
        <Icon name="eye" size={12} color="#fff" />
        <Text style={styles.reelViewsText}>
          {FirebaseService.formatNumber(reel.viewsCount || 0)}
        </Text>
      </View>

      {/* Reel Duration */}
      <View style={styles.reelDurationIndicator}>
        <Text style={styles.reelDurationText}>
          {Math.round(reel.duration || 0)}s
        </Text>
      </View>
    </TouchableOpacity>
  );

  // INSTANT MODE - No loading states, always show content immediately
  const profile: User = userProfile || {
    id: user?.uid || '',
    uid: user?.uid || '',
    email: user?.email || '',
    displayName: user?.displayName || user?.email?.split('@')[0] || 'User',
    username: user?.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'user',
    profilePicture: user?.profilePicture || user?.photoURL,
    photoURL: user?.profilePicture || user?.photoURL,
    postsCount: userPosts.length,
    isPrivate: false,
    createdAt: new Date(),
    bio: '',
    website: '',
    phoneNumber: user?.phoneNumber || '',
    isVerified: false,
    verified: false,
    followers: [],
    following: [],
    blockedUsers: [],
    storiesCount: 0,
    reelsCount: userReels.length,
    lastActive: new Date(),
    settings: {
      notifications: {
        likes: true,
        comments: true,
        follows: true,
        messages: true,
        mentions: true,
        stories: true,
      },
      privacy: {
        isPrivate: false,
        privateAccount: false,
        showActivity: true,
        showOnlineStatus: true,
        allowMessages: 'everyone' as const,
      },
      theme: 'light' as const,
    },
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{profile.username}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={debugFixFollowers} style={styles.headerButton}>
            <Icon name="bug-outline" size={24} color="#FF6B00" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePrivacySettings} style={styles.headerButton}>
            <Icon name="lock-closed-outline" size={24} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSettings} style={styles.headerButton}>
            <Icon name="settings-outline" size={24} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.headerButton}>
            <Icon name="log-out-outline" size={24} color="#E1306C" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.scrollView}>
        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.profileHeader}>
            <TouchableOpacity onPress={handleProfileImagePress} activeOpacity={0.8}>
              <LinearGradient
                colors={getStoryBorderColors()}
                style={styles.storyBorder}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <BeautifulCard style={styles.avatarContainer}>
                  {profile.profilePicture ? (
                    <Image source={{ uri: profile.profilePicture }} style={styles.avatar} />
                  ) : (
                    <View style={styles.defaultAvatar}>
                      <Text style={styles.avatarText}>
                        {profile.displayName?.charAt(0)?.toUpperCase() || 'U'}
                      </Text>
                    </View>
                  )}
                </BeautifulCard>
              </LinearGradient>
            </TouchableOpacity>
            
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {FirebaseService.formatNumber(profile.postsCount)}
                </Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
              <TouchableOpacity 
                style={[styles.statItem, !privacySummary.canViewFollowers && styles.disabledStat]} 
                onPress={privacySummary.canViewFollowers ? showMyFollowers : undefined}
                disabled={!privacySummary.canViewFollowers}
              >
                <Text style={[styles.statNumber, !privacySummary.canViewFollowers && styles.disabledText]}>
                  {FirebaseService.formatNumber(followersCount)}
                </Text>
                <Text style={[styles.statLabel, !privacySummary.canViewFollowers && styles.disabledText]}>
                  Followers
                  {privacySummary.isPrivateAccount && !privacySummary.canViewFollowers && (
                    <Icon name="lock-closed" size={12} style={{ marginLeft: 4 }} />
                  )}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.statItem, !privacySummary.canViewFollowing && styles.disabledStat]} 
                onPress={privacySummary.canViewFollowing ? showMyFollowing : undefined}
                disabled={!privacySummary.canViewFollowing}
              >
                <Text style={[styles.statNumber, !privacySummary.canViewFollowing && styles.disabledText]}>
                  {FirebaseService.formatNumber(followingCount)}
                </Text>
                <Text style={[styles.statLabel, !privacySummary.canViewFollowing && styles.disabledText]}>
                  Following
                  {privacySummary.isPrivateAccount && !privacySummary.canViewFollowing && (
                    <Icon name="lock-closed" size={12} style={{ marginLeft: 4 }} />
                  )}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.profileDetails}>
            <Text style={styles.displayName}>{profile.displayName}</Text>
            {profile.bio && (
              <Text style={styles.bio}>{profile.bio}</Text>
            )}
            {profile.website && (
              <TouchableOpacity>
                <Text style={styles.website}>{profile.website}</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Active Stories */}
        {userStories.length > 0 && (
          <View style={styles.storiesSection}>
            <Text style={styles.sectionTitle}>Stories</Text>
            <StoryList
              stories={userStories}
              currentUserId={user?.uid}
              onCreateStory={handleCreateStory}
              onViewStory={handleViewStory}
              showCreateButton={false}
            />
          </View>
        )}

        {/* Story Highlights */}
        {storyHighlights.length > 0 && (
          <StoryHighlights
            highlights={storyHighlights}
            onCreateHighlight={handleCreateHighlight}
            onViewHighlight={handleViewHighlight}
          />
        )}

        {/* Content Grid */}
        <View style={styles.contentSection}>
          {!canViewProfile ? (
            // Private Account Message
            <View style={styles.privateAccountContainer}>
              <Icon name="lock-closed-outline" size={80} color="#666" />
              <Text style={styles.privateAccountTitle}>This Account is Private</Text>
              <Text style={styles.privateAccountMessage}>
                Follow this account to see their posts and reels
              </Text>
              {!isFollowing && (
                <TouchableOpacity style={styles.followButton}>
                  <Text style={styles.followButtonText}>Follow</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <InstagramProfileReels
              userId={profile.uid}
              isOwnProfile={true}
              onReelPress={(reel, index) => {
                // Navigate to ReelsScreen with perfect Instagram-like experience
                (navigation as any).navigate('ReelsScreen', {
                  initialReelId: reel.id,
                  fromProfile: true,
                  reels: userReels,
                  initialIndex: index,
                });
              }}
            />
          )}
        </View>
      </View>

      {/* Instagram Story Viewer */}
      {showStoryViewer && storyViewerData && (
        <InstagramStoryViewer
          stories={storyViewerData.stories}
          userStories={storyViewerData.userStories}
          initialUserIndex={storyViewerData.initialUserIndex}
          initialStoryIndex={storyViewerData.initialStoryIndex}
          visible={showStoryViewer}
          onClose={() => setShowStoryViewer(false)}
          currentUserId={user?.uid}
          isFollowing={true}
        />
      )}

      {/* Instagram Post Viewer */}
      <InstagramPostViewer
        visible={showPostViewer}
        posts={userPosts}
        initialIndex={selectedPostIndex}
        onClose={() => setShowPostViewer(false)}
        onUserProfilePress={(userId) => {
          setShowPostViewer(false);
          // Handle user profile navigation if needed
        }}
      />

      {/* Instagram Reel Viewer */}
      <InstagramReelViewer
        visible={showReelViewer}
        reels={userReels}
        initialIndex={selectedReelIndex}
        onClose={() => setShowReelViewer(false)}
        onUserProfilePress={(userId) => {
          setShowReelViewer(false);
          // Handle user profile navigation if needed
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  scrollView: {
    flex: 1,
  },
  profileSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    marginRight: 0,
    borderRadius: profileImageSize / 2,
    overflow: 'hidden',
    padding: 0,
  },
  storyBorder: {
    padding: 3,
    borderRadius: (profileImageSize + 6) / 2,
    marginRight: 24,
  },
  avatar: {
    width: profileImageSize,
    height: profileImageSize,
    borderRadius: profileImageSize / 2,
  },
  defaultAvatar: {
    width: profileImageSize,
    height: profileImageSize,
    borderRadius: profileImageSize / 2,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: isSmallScreen ? 28 : 32,
    fontWeight: 'bold',
    color: '#666',
  },
  statsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  profileDetails: {
    marginBottom: 16,
  },
  displayName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  bio: {
    fontSize: 14,
    color: '#000',
    lineHeight: 20,
    marginBottom: 4,
  },
  website: {
    fontSize: 14,
    color: '#007AFF',
  },
  editButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 6,
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  postsSection: {
    flex: 1,
  },
  postsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  postsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  postsCount: {
    fontSize: 14,
    color: '#666',
  },
  postsGrid: {
    paddingHorizontal: 1,
  },
  postGridItem: {
    width: postImageSize,
    height: postImageSize,
    margin: 1,
    position: 'relative',
  },
  postGridImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postStats: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  postStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  postStatText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
    marginLeft: 2,
  },
  noPostsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  noPostsText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  noPostsSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: 16,
    padding: 4,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#dbdbdb',
    marginTop: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#E1306C',
  },
  tabText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#E1306C',
  },
  contentSection: {
    flex: 1,
  },
  noContentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  noContentText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#262626',
    marginTop: 16,
  },
  noContentSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  reelViewsIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  reelViewsText: {
    color: '#fff',
    fontSize: 10,
    marginLeft: 2,
  },
  storiesSection: {
    backgroundColor: '#fff',
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  privateAccountContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  privateAccountTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#262626',
    marginTop: 16,
    textAlign: 'center',
  },
  privateAccountMessage: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  followButton: {
    backgroundColor: '#0095F6',
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 6,
    marginTop: 16,
  },
  followButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  postStatsOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  reelDurationIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  reelDurationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
  },
  disabledStat: {
    opacity: 0.6,
  },
  disabledText: {
    color: '#888',
  },
});

export default ProfileScreen;
