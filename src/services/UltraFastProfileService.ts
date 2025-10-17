import firestore from '@react-native-firebase/firestore';
import { User, Post, Reel, Story } from '../types';

interface UltraFastProfileData {
  user: User;
  posts: Post[];
  reels: Reel[];
  stories: Story[];
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  canViewProfile: boolean;
  canViewReels: boolean;
  canViewFollowers: boolean;
  canViewFollowing: boolean;
  isPrivateAccount: boolean;
}

class UltraFastProfileService {
  private static instance: UltraFastProfileService;
  private profileCache = new Map<string, UltraFastProfileData>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance(): UltraFastProfileService {
    if (!UltraFastProfileService.instance) {
      UltraFastProfileService.instance = new UltraFastProfileService();
    }
    return UltraFastProfileService.instance;
  }

  // Instagram-style instant profile loading with aggressive caching
  async getProfileInstantly(userId: string, currentUserId: string): Promise<UltraFastProfileData | null> {
    try {
      console.log('⚡ UltraFastProfile: Loading profile INSTANTLY for:', userId);
      
      // Check cache first for ultra-fast loading
      const cacheKey = `${userId}_${currentUserId}`;
      const cached = this.profileCache.get(cacheKey);
      const cacheTime = this.cacheExpiry.get(cacheKey);
      
      if (cached && cacheTime && Date.now() - cacheTime < this.CACHE_DURATION) {
        console.log('⚡ UltraFastProfile: Returning CACHED data instantly');
        return cached;
      }

      // Load everything in parallel for maximum speed
      const [
        userDoc,
        postsSnapshot,
        reelsSnapshot,
        storiesSnapshot,
        currentUserDoc,
        followingCheckDoc
      ] = await Promise.all([
        firestore().collection('users').doc(userId).get(),
        firestore()
          .collection('posts')
          .where('userId', '==', userId)
          .orderBy('createdAt', 'desc')
          .limit(50)
          .get(),
        firestore()
          .collection('reels')
          .where('userId', '==', userId)
          .orderBy('createdAt', 'desc')
          .limit(50)
          .get(),
        firestore()
          .collection('stories')
          .where('userId', '==', userId)
          .where('expiresAt', '>', new Date())
          .orderBy('createdAt', 'desc')
          .get(),
        firestore().collection('users').doc(currentUserId).get(),
        firestore()
          .collection('users')
          .doc(currentUserId)
          .collection('following')
          .doc(userId)
          .get()
      ]);

      if (!userDoc.exists) {
        console.log('⚡ UltraFastProfile: User not found');
        return null;
      }

      const user = { id: userDoc.id, ...userDoc.data() } as User;
      const currentUser = currentUserDoc.exists ? 
        { id: currentUserDoc.id, ...currentUserDoc.data() } as User : null;
      const userIsFollowing: boolean = followingCheckDoc.exists;

      // Process posts with instant type conversion
      const posts: Post[] = postsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as Post[];

      // Process reels with instant type conversion
      const reels: Reel[] = reelsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          uploadedAt: data.uploadedAt?.toDate() || new Date()
        } as unknown as Reel;
      });

      // Process stories with instant type conversion
      const stories: Story[] = storiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        expiresAt: doc.data().expiresAt?.toDate() || new Date()
      })) as Story[];

      // Calculate privacy permissions instantly
      const isPrivateAccount = user.settings?.privacy?.privateAccount || 
                              user.settings?.privacy?.isPrivate || 
                              user.isPrivate || false;
      
      // Privacy logic: if account is private and not following, limit access
      const canViewProfile = !isPrivateAccount || userIsFollowing || userId === currentUserId;
      const canViewReels = canViewProfile;
      const canViewFollowers = canViewProfile;
      const canViewFollowing = canViewProfile;

      // Follower counts
      const followersCount = user.followers?.length || 0;
      const followingCount = user.following?.length || 0;

      const profileData: UltraFastProfileData = {
        user,
        posts: canViewProfile ? posts : [],
        reels: canViewReels ? reels : [],
        stories: canViewProfile ? stories : [],
        followersCount,
        followingCount,
        isFollowing: userIsFollowing,
        canViewProfile: canViewProfile,
        canViewReels: canViewReels,
        canViewFollowers: canViewFollowers,
        canViewFollowing: canViewFollowing,
        isPrivateAccount
      };

      // Cache for ultra-fast subsequent loads
      this.profileCache.set(cacheKey, profileData);
      this.cacheExpiry.set(cacheKey, Date.now());

      console.log('⚡ UltraFastProfile: Profile loaded INSTANTLY - Posts:', posts.length, 'Reels:', reels.length);
      return profileData;

    } catch (error) {
      console.error('❌ UltraFastProfile: Error loading profile:', error);
      return null;
    }
  }

  // Follow user with instant updates
  async followUserInstantly(currentUserId: string, targetUserId: string): Promise<boolean> {
    try {
      console.log('⚡ UltraFastProfile: Following user INSTANTLY');
      
      const batch = firestore().batch();
      
      // Add to current user's following
      const followingRef = firestore()
        .collection('users')
        .doc(currentUserId)
        .collection('following')
        .doc(targetUserId);
      
      batch.set(followingRef, {
        userId: targetUserId,
        followedAt: firestore.FieldValue.serverTimestamp()
      });

      // Add to target user's followers
      const followerRef = firestore()
        .collection('users')
        .doc(targetUserId)
        .collection('followers')
        .doc(currentUserId);
        
      batch.set(followerRef, {
        userId: currentUserId,
        followedAt: firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();

      // Invalidate cache for instant refresh
      this.invalidateUserCache(targetUserId);
      this.invalidateUserCache(currentUserId);

      return true;
    } catch (error) {
      console.error('❌ UltraFastProfile: Error following user:', error);
      return false;
    }
  }

  // Unfollow user with instant updates
  async unfollowUserInstantly(currentUserId: string, targetUserId: string): Promise<boolean> {
    try {
      console.log('⚡ UltraFastProfile: Unfollowing user INSTANTLY');
      
      const batch = firestore().batch();
      
      // Remove from current user's following
      const followingRef = firestore()
        .collection('users')
        .doc(currentUserId)
        .collection('following')
        .doc(targetUserId);
      
      batch.delete(followingRef);

      // Remove from target user's followers
      const followerRef = firestore()
        .collection('users')
        .doc(targetUserId)
        .collection('followers')
        .doc(currentUserId);
        
      batch.delete(followerRef);

      await batch.commit();

      // Invalidate cache for instant refresh
      this.invalidateUserCache(targetUserId);
      this.invalidateUserCache(currentUserId);

      return true;
    } catch (error) {
      console.error('❌ UltraFastProfile: Error unfollowing user:', error);
      return false;
    }
  }

  // Get user basic info instantly (for UI elements)
  async getUserBasicInfoInstantly(userId: string): Promise<Partial<User> | null> {
    try {
      const cacheKey = `basic_${userId}`;
      const cached = this.profileCache.get(cacheKey);
      
      if (cached) {
        return {
          id: cached.user.id,
          username: cached.user.username,
          displayName: cached.user.displayName,
          profilePicture: cached.user.profilePicture,
          isVerified: cached.user.isVerified
        };
      }

      const userDoc = await firestore().collection('users').doc(userId).get();
      
      if (!userDoc.exists) return null;
      
      const userData = userDoc.data() as User;
      return {
        id: userDoc.id,
        username: userData.username,
        displayName: userData.displayName,
        profilePicture: userData.profilePicture,
        isVerified: userData.isVerified
      };
    } catch (error) {
      console.error('❌ UltraFastProfile: Error getting basic user info:', error);
      return null;
    }
  }

  // Invalidate cache for user
  private invalidateUserCache(userId: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.profileCache.keys()) {
      if (key.includes(userId)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.profileCache.delete(key);
      this.cacheExpiry.delete(key);
    });
  }

  // Clear all cache
  clearCache(): void {
    this.profileCache.clear();
    this.cacheExpiry.clear();
  }

  // Preload popular users for instant access
  async preloadPopularUsers(userIds: string[], currentUserId: string): Promise<void> {
    try {
      console.log('⚡ UltraFastProfile: Preloading popular users');
      
      const promises = userIds.map(userId => 
        this.getProfileInstantly(userId, currentUserId)
      );
      
      await Promise.all(promises);
      console.log('⚡ UltraFastProfile: Preloaded', userIds.length, 'users');
    } catch (error) {
      console.error('❌ UltraFastProfile: Error preloading users:', error);
    }
  }
}

export default UltraFastProfileService;
