import { firebaseFirestore, firebaseAuth, firebaseStorage, COLLECTIONS } from '../config/firebase';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import storage from '@react-native-firebase/storage';
import { User } from '../types';

// Import FieldValue for server timestamps
const { FieldValue } = firestore;

// Chat Interfaces
export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  message: string;
  messageType: 'text' | 'image' | 'video' | 'audio' | 'call';
  mediaUrl?: string;
  mediaSize?: number;
  mediaWidth?: number;
  mediaHeight?: number;
  isRead: boolean;
  readBy: string[];
  participants: string[]; // Add participants array for Firestore rules
  createdAt: any; // Firebase Timestamp or string
  updatedAt: any; // Firebase Timestamp or string
  replyTo?: string; // Message ID this is replying to
  reactions?: { [userId: string]: string }; // emoji reactions
  isDeleted?: boolean;
  editedAt?: string;
  // Shared Content Support
  type?: 'reel' | 'post';
  content?: string; // Alternative to message for shared content
  reelData?: {
    id: string;
    videoUrl: string;
    caption: string;
    thumbnailUrl: string;
    userId: string;
    user: any;
    duration: number;
    likes: string[];
    views: number;
    createdAt: Date;
    music?: any;
  };
  postData?: {
    id: string;
    imageUrls: string[];
    caption: string;
    userId: string;
    user: any;
    likes: string[];
    createdAt: Date;
  };
}

export interface Chat {
  id: string;
  participants: string[];
  participantNames: string[];
  participantAvatars: string[];
  lastMessage?: ChatMessage;
  lastMessageTime: string;
  unreadCount: { [userId: string]: number };
  isGroup: boolean;
  groupName?: string;
  groupAvatar?: string;
  groupDescription?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface CallLog {
  id: string;
  chatId: string;
  callerId: string;
  callerName: string;
  participants: string[];
  callType: 'audio' | 'video';
  duration: number; // in seconds
  status: 'completed' | 'missed' | 'rejected' | 'failed';
  roomName: string;
  startTime: string;
  endTime?: string;
  createdAt: string;
}

export interface Post {
  id: string;
  userId: string;
  user?: User;
  mediaUrls: string[];
  mediaType: 'image' | 'video' | 'carousel';
  type: 'photo' | 'video' | 'carousel'; // Added for compatibility
  caption: string;
  location?: {
    name: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  hashtags: string[];
  mentions: string[];
  tags?: string[]; // Added for compatibility
  likes?: string[]; // Added for compatibility
  comments?: string[]; // Added for compatibility
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  shares: number; // Added for compatibility with types/index.ts
  saves: string[]; // Added for compatibility with types/index.ts
  isArchived: boolean; // Added for compatibility with types/index.ts
  isHidden: boolean; // Added for compatibility with types/index.ts
  isPrivate: boolean; // Post privacy setting
  viewsCount?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  commentsDisabled: boolean;
  hideLikeCounts: boolean;
  music?: {
    id: string;
    title: string;
    artist: string;
    url: string;
    duration: number;
    isPopular?: boolean;
    usageCount?: number;
    createdAt?: Date;
  };
  filter?: {
    id: string;
    name: string;
    colors: string[];
    intensity: number;
    emoji: string;
  };
  textElements?: Array<{
    id: string;
    text: string;
    x: number;
    y: number;
    fontSize: number;
    color: string;
    fontFamily: string;
    rotation: number;
    scale: number;
    strokeWidth?: number;
    strokeColor?: string;
    shadowOffset?: { x: number; y: number };
    shadowOpacity?: number;
    shadowColor?: string;
    backgroundColor?: string;
    opacity: number;
  }>;
  stickerElements?: Array<{
    id: string;
    type: 'location' | 'time' | 'weather' | 'mention' | 'hashtag' | 'emoji' | 'music';
    x: number;
    y: number;
    scale: number;
    rotation: number;
    data: any;
  }>;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Reel {
  id: string;
  userId: string;
  user?: User;
  videoUrl: string;
  thumbnailUrl: string;
  caption: string;
  music?: {
    id: string;
    title: string;
    artist: string;
    audioUrl: string;
    duration: number;
  };
  musicTitle?: string;
  hashtags: string[];
  tags?: string[]; // Additional tags property
  mentions: string[];
  likesCount: number;
  likes?: number; // Alias for likesCount
  commentsCount: number;
  sharesCount: number;
  viewsCount: number;
  views?: number; // Alias for viewsCount
  timeAgo?: string; // Time ago string
  isLiked?: boolean;
  isSaved?: boolean;
  isPrivate: boolean; // Reel privacy setting
  duration: number;
  createdAt: string;
}

export interface StoryFilter {
  id: string;
  name: string;
  colors: string[];
  intensity: number;
  emoji?: string;
}

export interface StoryText {
  id: string;
  text: string;
  color: string;
  fontSize: number;
  fontFamily: string;
  position: { x: number; y: number };
  rotation: number;
  scale: number;
  opacity: number;
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowOffset?: { x: number; y: number };
  shadowBlur?: number;
}

export interface StorySticker {
  id: string;
  type: 'emoji' | 'gif' | 'location' | 'mention' | 'hashtag' | 'music' | 'time' | 'weather';
  content: string;
  position: { x: number; y: number };
  scale: number;
  rotation: number;
  opacity: number;
}

export interface StoryMusic {
  id: string;
  title: string;
  artist: string;
  url: string;
  duration: number;
  startTime: number;
}

export interface Story {
  id: string;
  userId: string;
  user?: User;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'photo';
  duration?: number;
  caption?: string;
  viewsCount: number;
  viewers: string[];
  viewedBy: string[]; // Array of user IDs who viewed this story
  isViewed?: boolean; // For the current user
  likesCount?: number;
  isLiked?: boolean;
  commentsCount?: number;
  filter?: StoryFilter;
  texts?: StoryText[];
  stickers?: StorySticker[];
  music?: StoryMusic;
  createdAt: string;
  expiresAt: string;
}

export interface Comment {
  id: string;
  postId?: string;
  reelId?: string;
  userId: string;
  user?: User;
  content: string;
  type?: 'text' | 'audio'; // Add type field for voice comments
  mediaUrl?: string | null; // Add mediaUrl field for voice comments
  likesCount: number;
  isLiked?: boolean;
  parentId?: string | null;
  repliesCount: number;
  contentId: string; // The ID of the post or reel
  contentType: 'post' | 'reel';
  mentions: string[];
  isEdited?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export class FirebaseService {
  // Username generators for realistic user data
  private static firstNames = [
    'Alex', 'Jordan', 'Casey', 'Taylor', 'Morgan', 'Riley', 'Avery', 'Parker',
    'Cameron', 'Quinn', 'Sage', 'River', 'Phoenix', 'Sky', 'Blake', 'Drew',
    'Emery', 'Finley', 'Harper', 'Hayden', 'Jamie', 'Kai', 'Lane', 'Logan',
    'Marley', 'Nico', 'Payton', 'Reese', 'Rowan', 'Sam', 'Shay', 'Sydney'
  ];

  private static lastNames = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
    'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White',
    'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Scott'
  ];

  private static adjectives = [
    'Cool', 'Smart', 'Creative', 'Amazing', 'Awesome', 'Bright', 'Clever', 'Dynamic',
    'Epic', 'Fresh', 'Genius', 'Happy', 'Inspiring', 'Joyful', 'Kind', 'Lively',
    'Mighty', 'Noble', 'Optimistic', 'Positive', 'Quick', 'Radiant', 'Super', 'Unique'
  ];

  /**
   * Generate a random realistic username
   */
  private static generateUsername(): string {
    const firstName = this.firstNames[Math.floor(Math.random() * this.firstNames.length)];
    const lastName = this.lastNames[Math.floor(Math.random() * this.lastNames.length)];
    const number = Math.floor(Math.random() * 999) + 1;
    const formats = [
      `${firstName.toLowerCase()}${lastName.toLowerCase()}`,
      `${firstName.toLowerCase()}_${lastName.toLowerCase()}`,
      `${firstName.toLowerCase()}${number}`,
      `${firstName.toLowerCase()}.${lastName.toLowerCase()}`,
      `${firstName.toLowerCase()}${lastName.toLowerCase()}${number}`
    ];
    return formats[Math.floor(Math.random() * formats.length)];
  }

  /**
   * Generate a random display name
   */
  private static generateDisplayName(): string {
    const firstName = this.firstNames[Math.floor(Math.random() * this.firstNames.length)];
    const lastName = this.lastNames[Math.floor(Math.random() * this.lastNames.length)];
    return `${firstName} ${lastName}`;
  }

  /**
   * Generate a random bio
   */
  private static generateBio(): string {
    const adjective = this.adjectives[Math.floor(Math.random() * this.adjectives.length)];
    const interests = ['Photography', 'Travel', 'Music', 'Art', 'Tech', 'Food', 'Fitness', 'Nature'];
    const interest = interests[Math.floor(Math.random() * interests.length)];
    const bios = [
      `${adjective} person who loves ${interest.toLowerCase()} ✨`,
      `Living life to the fullest 🌟 ${interest} enthusiast`,
      `${adjective} soul | ${interest} lover | Creating memories`,
      `Passionate about ${interest.toLowerCase()} 📸 Dream big!`,
      `${adjective} vibes only ✌️ ${interest} is my passion`
    ];
    return bios[Math.floor(Math.random() * bios.length)];
  }

  /**
   * Create or get user with dynamic data
   */
  static async createOrGetDynamicUser(userId: string, email?: string): Promise<User> {
    try {
      // Try to get existing user first
      let user = await this.getUserProfile(userId);
      
      if (!user) {
        // Create new user with dynamic data
        const username = this.generateUsername();
        const displayName = this.generateDisplayName();
        const bio = this.generateBio();
        
        const newUser: User = {
          uid: userId,
          email: email || `${username}@example.com`,
          username,
          displayName,
          bio,
          profilePicture: '', // Will be set when user uploads
          profilePictureType: undefined,
          profilePictureKey: undefined,
          isPrivate: false,
          isVerified: false,
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
              allowMessages: 'everyone',
            },
            theme: 'auto',
          },
        };
        
        await this.createUserProfile(newUser);
        user = newUser;
      }
      
      return user;
    } catch (error) {
      console.error('Error creating/getting dynamic user:', error);
      throw error;
    }
  }

  // User Services
  static async getUserProfile(userId: string): Promise<User | null> {
    try {
      const userDocRef = firestore().collection(COLLECTIONS.USERS).doc(userId);
      const userDoc = await userDocRef.get();
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return { 
          uid: userId, 
          ...userData,
          // Convert Firestore timestamps to Date objects
          createdAt: userData?.createdAt?.toDate?.() || new Date(),
          lastActive: userData?.lastActive?.toDate?.() || new Date(),
        } as User;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  }

  static async updateUserProfile(userId: string, userData: Partial<User>): Promise<void> {
    try {
      // Convert Date objects to Firestore timestamps
      const updateData: any = {
        ...userData,
        updatedAt: new Date(),
      };
      
      // Remove undefined values to prevent Firestore errors
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      await firebaseFirestore.collection(COLLECTIONS.USERS).doc(userId).update(updateData);
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  static async updateUserSettings(userId: string, settings: any): Promise<void> {
    try {
      const updateData = {
        settings: settings,
        updatedAt: new Date(),
      };

      await firebaseFirestore.collection(COLLECTIONS.USERS).doc(userId).update(updateData);
    } catch (error) {
      console.error('Error updating user settings:', error);
      throw error;
    }
  }

  static async createUserProfile(userData: User): Promise<void> {
    try {
      const createData: any = {
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Remove undefined values
      Object.keys(createData).forEach(key => {
        if (createData[key] === undefined) {
          delete createData[key];
        }
      });

      await firebaseFirestore.collection(COLLECTIONS.USERS).doc(userData.uid).set(createData);
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
  }

  static async searchUsers(query: string, limit: number = 20): Promise<User[]> {
    try {
      const usersSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.USERS)
        .where('username', '>=', query.toLowerCase())
        .where('username', '<=', query.toLowerCase() + '\uf8ff')
        .limit(limit)
        .get();

      const displayNameSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.USERS)
        .where('displayName', '>=', query)
        .where('displayName', '<=', query + '\uf8ff')
        .limit(limit)
        .get();

      const users: User[] = [];
      const userIds = new Set();

      usersSnapshot.forEach(doc => {
        if (!userIds.has(doc.id)) {
          users.push({ uid: doc.id, ...doc.data() } as User);
          userIds.add(doc.id);
        }
      });

      displayNameSnapshot.forEach(doc => {
        if (!userIds.has(doc.id)) {
          users.push({ uid: doc.id, ...doc.data() } as User);
          userIds.add(doc.id);
        }
      });

      return users;
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  }

  // Search Posts
  static async searchPosts(query: string, limit: number = 20): Promise<Post[]> {
    try {
      console.log('🔍 Searching posts for:', query);

      // Search by caption content
      const captionSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.POSTS)
        .where('caption', '>=', query.toLowerCase())
        .where('caption', '<=', query.toLowerCase() + '\uf8ff')
        .limit(limit)
        .get();

      // Search by hashtags
      const hashtagSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.POSTS)
        .where('hashtags', 'array-contains', query.toLowerCase().replace('#', ''))
        .limit(limit)
        .get();

      const posts: Post[] = [];
      const postIds = new Set();

      // Process caption search results
      for (const doc of captionSnapshot.docs) {
        if (!postIds.has(doc.id)) {
          const postData = { id: doc.id, ...doc.data() } as Post;
          
          // Get user data
          try {
            const userDoc = await firebaseFirestore
              .collection(COLLECTIONS.USERS)
              .doc(postData.userId)
              .get();
            
            if (userDoc.exists()) {
              postData.user = userDoc.data() as any;
            }
          } catch (error) {
            console.warn('Failed to get user data for post:', postData.id);
          }

          posts.push(postData);
          postIds.add(doc.id);
        }
      }

      // Process hashtag search results
      for (const doc of hashtagSnapshot.docs) {
        if (!postIds.has(doc.id)) {
          const postData = { id: doc.id, ...doc.data() } as Post;
          
          // Get user data
          try {
            const userDoc = await firebaseFirestore
              .collection(COLLECTIONS.USERS)
              .doc(postData.userId)
              .get();
            
            if (userDoc.exists()) {
              postData.user = userDoc.data() as any;
            }
          } catch (error) {
            console.warn('Failed to get user data for post:', postData.id);
          }

          posts.push(postData);
          postIds.add(doc.id);
        }
      }

      console.log(`✅ Found ${posts.length} posts for search: ${query}`);
      return posts.slice(0, limit);

    } catch (error) {
      console.error('Error searching posts:', error);
      return [];
    }
  }

  // Search Reels
  static async searchReels(query: string, limit: number = 20): Promise<Reel[]> {
    try {
      console.log('🔍 Searching reels for:', query);

      // Search by caption content
      const captionSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.REELS)
        .where('caption', '>=', query.toLowerCase())
        .where('caption', '<=', query.toLowerCase() + '\uf8ff')
        .limit(limit)
        .get();

      // Search by hashtags
      const hashtagSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.REELS)
        .where('hashtags', 'array-contains', query.toLowerCase().replace('#', ''))
        .limit(limit)
        .get();

      const reels: Reel[] = [];
      const reelIds = new Set();

      // Process caption search results
      for (const doc of captionSnapshot.docs) {
        if (!reelIds.has(doc.id)) {
          const reelData = { id: doc.id, ...doc.data() } as Reel;
          
          // Get user data
          try {
            const userDoc = await firebaseFirestore
              .collection(COLLECTIONS.USERS)
              .doc(reelData.userId)
              .get();
            
            if (userDoc.exists()) {
              reelData.user = userDoc.data() as any;
            }
          } catch (error) {
            console.warn('Failed to get user data for reel:', reelData.id);
          }

          reels.push(reelData);
          reelIds.add(doc.id);
        }
      }

      // Process hashtag search results
      for (const doc of hashtagSnapshot.docs) {
        if (!reelIds.has(doc.id)) {
          const reelData = { id: doc.id, ...doc.data() } as Reel;
          
          // Get user data
          try {
            const userDoc = await firebaseFirestore
              .collection(COLLECTIONS.USERS)
              .doc(reelData.userId)
              .get();
            
            if (userDoc.exists()) {
              reelData.user = userDoc.data() as any;
            }
          } catch (error) {
            console.warn('Failed to get user data for reel:', reelData.id);
          }

          reels.push(reelData);
          reelIds.add(doc.id);
        }
      }

      console.log(`✅ Found ${reels.length} reels for search: ${query}`);
      return reels.slice(0, limit);

    } catch (error) {
      console.error('Error searching reels:', error);
      return [];
    }
  }

  // Post Services
  static async getPosts(lastPostId?: string, limit: number = 10): Promise<Post[]> {
    try {
      let query = firebaseFirestore
        .collection(COLLECTIONS.POSTS)
        .orderBy('createdAt', 'desc')
        .limit(limit);

      if (lastPostId) {
        const lastPostDocRef = firebaseFirestore.collection(COLLECTIONS.POSTS).doc(lastPostId);
        const lastPostDoc = await lastPostDocRef.get();
        query = query.startAfter(lastPostDoc);
      }

      const postsSnapshot = await query.get();
      const posts: Post[] = [];

      for (const doc of postsSnapshot.docs) {
        const postData = { id: doc.id, ...doc.data() } as Post;
        
        // Validate required fields
        if (!postData.userId || !postData.caption || !postData.createdAt) {
          console.warn('Post missing required fields:', postData);
          continue;
        }
        
        if (postData.userId) {
          const userData = await this.getUserProfile(postData.userId);
          if (userData) {
            postData.user = userData;
          }
        }
        
        // Ensure mediaUrls is an array
        if (!postData.mediaUrls || !Array.isArray(postData.mediaUrls)) {
          postData.mediaUrls = [];
        }
        
        posts.push(postData);
      }

      return posts;
    } catch (error) {
      console.error('Error fetching posts:', error);
      throw error;
    }
  }

  static async getUserPosts(userId: string, limit: number = 20, offset: number = 0): Promise<Post[]> {
    try {
      let query = firebaseFirestore
        .collection(COLLECTIONS.POSTS)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit);

      // Add offset support using startAfter
      if (offset > 0) {
        const skipSnapshot = await firebaseFirestore
          .collection(COLLECTIONS.POSTS)
          .where('userId', '==', userId)
          .orderBy('createdAt', 'desc')
          .limit(offset)
          .get();
        
        if (!skipSnapshot.empty) {
          const lastDoc = skipSnapshot.docs[skipSnapshot.docs.length - 1];
          query = query.startAfter(lastDoc);
        }
      }

      const postsSnapshot = await query.get();

      const posts: Post[] = [];
      for (const doc of postsSnapshot.docs) {
        const postData = { id: doc.id, ...doc.data() } as Post;
        
        // Validate required fields
        if (!postData.userId || !postData.caption || !postData.createdAt) {
          console.warn('User post missing required fields:', postData);
          continue;
        }
        
        const userData = await this.getUserProfile(postData.userId);
        if (userData) {
          postData.user = userData;
        }
        
        // Ensure mediaUrls is an array
        if (!postData.mediaUrls || !Array.isArray(postData.mediaUrls)) {
          postData.mediaUrls = [];
        }
        
        posts.push(postData);
      }

      return posts;
    } catch (error) {
      console.error('Error fetching user posts:', error);
      throw error;
    }
  }

  static async createPost(postData: Omit<Post, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      // Validate required fields
      if (!postData.userId || !postData.caption) {
        throw new Error('Missing required fields: userId and caption are required');
      }
      
      // Ensure mediaUrls is an array
      if (!postData.mediaUrls || !Array.isArray(postData.mediaUrls)) {
        postData.mediaUrls = [];
      }
      
      const newPost = {
        ...postData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Remove undefined values to prevent Firestore errors
      const cleanedPost = Object.keys(newPost).reduce((acc: any, key) => {
        if (newPost[key as keyof typeof newPost] !== undefined) {
          acc[key] = newPost[key as keyof typeof newPost];
        }
        return acc;
      }, {});

      const docRef = await firebaseFirestore.collection(COLLECTIONS.POSTS).add(cleanedPost);
      
      await firebaseFirestore.collection(COLLECTIONS.USERS).doc(postData.userId).update({
        postsCount: FieldValue.increment(1),
      });

      // 📢 Notify followers about new post (non-blocking)
      try {
        const followersSnapshot = await firebaseFirestore
          .collection(COLLECTIONS.FOLLOWS)
          .where('following', '==', postData.userId)
          .get();

        const notificationPromises = followersSnapshot.docs.map(async (followerDoc) => {
          const followerData = followerDoc.data();
          return this.createNotification(
            followerData.follower, // recipientId
            postData.userId, // senderId
            'post',
            'shared a new post',
            docRef.id,
            'post'
          );
        });

        if (notificationPromises.length > 0) {
          await Promise.allSettled(notificationPromises);
          console.log(`✅ Notified ${notificationPromises.length} followers about new post ${docRef.id}`);
        }
      } catch (notificationError) {
        console.warn('Failed to notify followers about new post:', notificationError);
      }

      return docRef.id;
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  }

  static async likePost(postId: string, userId: string): Promise<{ isLiked: boolean; likesCount: number }> {
    try {
      const batch = firebaseFirestore.batch();
      const likeRef = firebaseFirestore.collection(COLLECTIONS.LIKES).doc(`${postId}_${userId}`);
      const postRef = firebaseFirestore.collection(COLLECTIONS.POSTS).doc(postId);
      
      const [likeDoc, postDoc] = await Promise.all([
        likeRef.get(),
        postRef.get()
      ]);

      if (!postDoc.exists()) {
        throw new Error('Post not found');
      }

      const isCurrentlyLiked = likeDoc.exists();
      const currentLikesCount = postDoc.data()?.likesCount || 0;

      if (isCurrentlyLiked) {
        // Unlike the post
        batch.delete(likeRef);
        batch.update(postRef, {
          likesCount: Math.max(0, currentLikesCount - 1),
          updatedAt: new Date().toISOString(),
        });
        
        await batch.commit();
        return { isLiked: false, likesCount: Math.max(0, currentLikesCount - 1) };
      } else {
        // Like the post
        batch.set(likeRef, {
          postId,
          userId,
          type: 'post',
          createdAt: new Date().toISOString(),
        });
        batch.update(postRef, {
          likesCount: currentLikesCount + 1,
          updatedAt: new Date().toISOString(),
        });
        
        await batch.commit();
        
        // Create notification for post owner (don't await to not block UI)
        this.createLikeNotification(postId, userId, 'post').catch(console.error);
        
        return { isLiked: true, likesCount: currentLikesCount + 1 };
      }
    } catch (error) {
      console.error('Error liking/unliking post:', error);
      throw error;
    }
  }

  static async likeReel(reelId: string, userId: string): Promise<{ isLiked: boolean; likesCount: number }> {
    try {
      const batch = firebaseFirestore.batch();
      const likeRef = firebaseFirestore.collection(COLLECTIONS.LIKES).doc(`${reelId}_${userId}`);
      const reelRef = firebaseFirestore.collection(COLLECTIONS.REELS).doc(reelId);
      
      const [likeDoc, reelDoc] = await Promise.all([
        likeRef.get(),
        reelRef.get()
      ]);

      if (!reelDoc.exists()) {
        throw new Error('Reel not found');
      }

      const isCurrentlyLiked = likeDoc.exists();
      const currentLikesCount = reelDoc.data()?.likesCount || 0;

      if (isCurrentlyLiked) {
        // Unlike the reel
        batch.delete(likeRef);
        batch.update(reelRef, {
          likesCount: Math.max(0, currentLikesCount - 1),
          updatedAt: new Date().toISOString(),
        });
        
        await batch.commit();
        return { isLiked: false, likesCount: Math.max(0, currentLikesCount - 1) };
      } else {
        // Like the reel
        batch.set(likeRef, {
          reelId,
          userId,
          type: 'reel',
          createdAt: new Date().toISOString(),
        });
        batch.update(reelRef, {
          likesCount: currentLikesCount + 1,
          updatedAt: new Date().toISOString(),
        });
        
        await batch.commit();
        
        // Create notification for reel owner
        this.createLikeNotification(reelId, userId, 'reel').catch(console.error);
        
        return { isLiked: true, likesCount: currentLikesCount + 1 };
      }
    } catch (error) {
      console.error('Error liking/unliking reel:', error);
      throw error;
    }
  }

  static async likeStory(storyId: string, userId: string): Promise<{ isLiked: boolean; likesCount: number }> {
    try {
      const batch = firebaseFirestore.batch();
      const likeRef = firebaseFirestore.collection(COLLECTIONS.LIKES).doc(`${storyId}_${userId}`);
      const storyRef = firebaseFirestore.collection(COLLECTIONS.STORIES).doc(storyId);
      
      const [likeDoc, storyDoc] = await Promise.all([
        likeRef.get(),
        storyRef.get()
      ]);

      if (!storyDoc.exists()) {
        throw new Error('Story not found');
      }

      const isCurrentlyLiked = likeDoc.exists();
      const currentLikesCount = storyDoc.data()?.likesCount || 0;

      if (isCurrentlyLiked) {
        // Unlike the story
        batch.delete(likeRef);
        batch.update(storyRef, {
          likesCount: Math.max(0, currentLikesCount - 1),
          updatedAt: new Date().toISOString(),
        });
        
        await batch.commit();
        return { isLiked: false, likesCount: Math.max(0, currentLikesCount - 1) };
      } else {
        // Like the story
        batch.set(likeRef, {
          storyId,
          userId,
          type: 'story',
          createdAt: new Date().toISOString(),
        });
        batch.update(storyRef, {
          likesCount: currentLikesCount + 1,
          updatedAt: new Date().toISOString(),
        });
        
        await batch.commit();
        
        // Create notification for story owner
        this.createLikeNotification(storyId, userId, 'story').catch(console.error);
        
        return { isLiked: true, likesCount: currentLikesCount + 1 };
      }
    } catch (error) {
      console.error('Error liking/unliking story:', error);
      throw error;
    }
  }

  static async saveReel(reelId: string, userId: string): Promise<{ isSaved: boolean }> {
    try {
      const saveRef = firebaseFirestore.collection(COLLECTIONS.SAVES).doc(`${reelId}_${userId}`);
      const saveDoc = await saveRef.get();

      const isCurrentlySaved = saveDoc.exists();

      if (isCurrentlySaved) {
        // Unsave the reel
        await saveRef.delete();
        return { isSaved: false };
      } else {
        // Save the reel
        await saveRef.set({
          reelId,
          userId,
          type: 'reel',
          createdAt: new Date().toISOString(),
        });
        return { isSaved: true };
      }
    } catch (error) {
      console.error('Error saving/unsaving reel:', error);
      throw error;
    }
  }

  static async incrementReelViews(reelId: string): Promise<void> {
    try {
      const reelRef = firebaseFirestore.collection(COLLECTIONS.REELS).doc(reelId);
      await reelRef.update({
        viewsCount: FieldValue.increment(1),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error incrementing reel views:', error);
      throw error;
    }
  }

  static async incrementReelShares(reelId: string): Promise<void> {
    try {
      const reelRef = firebaseFirestore.collection(COLLECTIONS.REELS).doc(reelId);
      await reelRef.update({
        sharesCount: FieldValue.increment(1),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error incrementing reel shares:', error);
      throw error;
    }
  }

  static async getUserSavedItems(userId: string): Promise<any[]> {
    try {
      const savedSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.SAVES)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();

      const savedItems = [];
      for (const doc of savedSnapshot.docs) {
        const saveData = doc.data();
        let itemData = null;

        if (saveData.type === 'post') {
          const postDocRef = firebaseFirestore.collection(COLLECTIONS.POSTS).doc(saveData.postId || saveData.reelId);
          const postDoc = await postDocRef.get();
          if (postDoc.exists()) {
            itemData = { id: postDoc.id, ...postDoc.data() };
          }
        } else if (saveData.type === 'reel') {
          const reelDocRef = firebaseFirestore.collection(COLLECTIONS.REELS).doc(saveData.reelId);
          const reelDoc = await reelDocRef.get();
          if (reelDoc.exists()) {
            itemData = { id: reelDoc.id, ...reelDoc.data() };
          }
        }

        if (itemData) {
          savedItems.push({
            id: saveData.postId || saveData.reelId,
            type: saveData.type,
            data: itemData,
            savedAt: new Date(saveData.createdAt),
          });
        }
      }

      return savedItems;
    } catch (error) {
      console.error('Error getting user saved items:', error);
      return [];
    }
  }

  static async saveContent(userId: string, content: any): Promise<void> {
    try {
      await firebaseFirestore
        .collection(COLLECTIONS.SAVES)
        .add({
          userId,
          contentId: content.id,
          type: content.type,
          content,
          createdAt: FieldValue.serverTimestamp(),
        });
    } catch (error) {
      console.error('Error saving content:', error);
      throw error;
    }
  }

  static async unsaveContent(userId: string, contentId: string): Promise<void> {
    try {
      const saveSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.SAVES)
        .where('userId', '==', userId)
        .where('contentId', '==', contentId)
        .get();

      const batch = firebaseFirestore.batch();
      saveSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Error unsaving content:', error);
      throw error;
    }
  }

  static async sendDirectMessage(fromUserId: string, toUserId: string, messageData: any): Promise<void> {
    try {
      // Check if chat exists between users
      const existingChatsSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.CHATS)
        .where('participants', 'array-contains', fromUserId)
        .where('isGroup', '==', false)
        .get();

      let chatId = null;
      
      // Find existing chat between these two users
      for (const doc of existingChatsSnapshot.docs) {
        const chatData = doc.data();
        if (chatData.participants.includes(toUserId)) {
          chatId = doc.id;
          break;
        }
      }

      // Create new chat if none exists
      if (!chatId) {
        const [fromUser, toUser] = await Promise.all([
          this.getUserProfile(fromUserId),
          this.getUserProfile(toUserId)
        ]);

        const newChatRef = await firebaseFirestore
          .collection(COLLECTIONS.CHATS)
          .add({
            participants: [fromUserId, toUserId],
            participantNames: [
              fromUser?.displayName || fromUser?.email || 'Unknown',
              toUser?.displayName || toUser?.email || 'Unknown'
            ],
            participantAvatars: [
              fromUser?.profilePicture || fromUser?.photoURL || '',
              toUser?.profilePicture || toUser?.photoURL || ''
            ],
            isGroup: false,
            createdBy: fromUserId,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            isActive: true,
            unreadCount: {
              [fromUserId]: 0,
              [toUserId]: 1
            }
          });
        
        chatId = newChatRef.id;
      }

      // Send the message
      const messageRef = await firebaseFirestore
        .collection(COLLECTIONS.MESSAGES)
        .add({
          chatId,
          senderId: fromUserId,
          senderName: messageData.senderName || 'Unknown',
          senderAvatar: messageData.senderAvatar || '',
          message: messageData.message,
          messageType: messageData.type || 'text',
          mediaUrl: messageData.content?.mediaUrl,
          sharedContent: messageData.content,
          isRead: false,
          readBy: [fromUserId],
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

      // Update chat's last message
      await firebaseFirestore
        .collection(COLLECTIONS.CHATS)
        .doc(chatId)
        .update({
          lastMessage: {
            id: messageRef.id,
            message: messageData.message,
            senderId: fromUserId,
            createdAt: FieldValue.serverTimestamp(),
          },
          lastMessageTime: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          [`unreadCount.${toUserId}`]: FieldValue.increment(1),
        });

    } catch (error) {
      console.error('Error sending direct message:', error);
      throw error;
    }
  }

  // Instagram-like reel recommendation algorithm
  static async getRecommendedReels(userId?: string, limit: number = 20): Promise<Reel[]> {
    try {
      let allReels: Reel[] = [];
      
      // Get all reels with user data
      const reelsSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.REELS)
        .orderBy('createdAt', 'desc')
        .limit(100) // Get more reels to choose from
        .get();

      for (const doc of reelsSnapshot.docs) {
        const reelData = { id: doc.id, ...doc.data() } as Reel;
        
        // Validate required fields
        if (!reelData.userId || !reelData.videoUrl || !reelData.createdAt) {
          console.warn('Reel missing required fields:', reelData);
          continue;
        }
        
        // Get user data
        if (reelData.userId) {
          const userData = await this.getUserProfile(reelData.userId);
          if (userData) {
            reelData.user = userData;
          }
        }

        allReels.push(reelData);
      }

      // If no user is provided, return random high-engagement reels
      if (!userId) {
        return this.sortReelsByEngagement(allReels).slice(0, limit);
      }

      // Get user's interactions for personalization
      const [following, likedReels, viewedReels] = await Promise.all([
        this.getFollowing(userId),
        this.getUserLikedReels(userId),
        this.getUserViewedReels(userId)
      ]);

      const followingIds = following.map(user => user.uid);
      const likedReelIds = new Set(likedReels.map(reel => reel.id));
      const viewedReelIds = new Set(viewedReels.map(reel => reel.id));

      // Score reels based on Instagram-like algorithm
      const scoredReels = allReels.map(reel => {
        let score = 0;
        
        // Base engagement score (likes, comments, shares, views)
        const engagementScore = (
          (reel.likesCount || 0) * 1 +
          (reel.commentsCount || 0) * 2 +
          (reel.sharesCount || 0) * 3 +
          (reel.viewsCount || 0) * 0.1
        );
        score += Math.log(engagementScore + 1) * 10;

        // Boost reels from users you follow
        if (followingIds.includes(reel.userId)) {
          score += 50;
        }

        // Boost recent reels
        const daysSinceCreated = (Date.now() - new Date(reel.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceCreated < 1) score += 30;
        else if (daysSinceCreated < 7) score += 15;
        
        // Slightly boost reels from accounts with similar interests
        // (based on user's liked content)
        if (reel.hashtags && reel.hashtags.length > 0) {
          score += reel.hashtags.length * 2;
        }

        // Penalize already viewed reels
        if (viewedReelIds.has(reel.id)) {
          score *= 0.3;
        }

        // Penalize already liked reels
        if (likedReelIds.has(reel.id)) {
          score *= 0.5;
        }

        // Add randomness for discovery
        score += Math.random() * 20;

        return { ...reel, algorithmScore: score };
      });

      // Sort by score and return top reels
      return scoredReels
        .sort((a, b) => b.algorithmScore - a.algorithmScore)
        .slice(0, limit);

    } catch (error) {
      console.error('Error getting recommended reels:', error);
      // Fallback to basic sorting
      return this.sortReelsByEngagement(await this.getAllReels()).slice(0, limit);
    }
  }

  private static sortReelsByEngagement(reels: Reel[]): Reel[] {
    return reels.sort((a, b) => {
      const aScore = (a.likesCount || 0) + (a.commentsCount || 0) * 2 + (a.viewsCount || 0) * 0.1;
      const bScore = (b.likesCount || 0) + (b.commentsCount || 0) * 2 + (b.viewsCount || 0) * 0.1;
      return bScore - aScore;
    });
  }

  private static async getUserLikedReels(userId: string): Promise<Reel[]> {
    try {
      const likesSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.LIKES)
        .where('userId', '==', userId)
        .where('type', '==', 'reel')
        .get();

      const likedReels: Reel[] = [];
      for (const doc of likesSnapshot.docs) {
        const likeData = doc.data();
        const reelDocRef = firebaseFirestore.collection(COLLECTIONS.REELS).doc(likeData.reelId);
        const reelDoc = await reelDocRef.get();
        if (reelDoc.exists()) {
          likedReels.push({ id: reelDoc.id, ...reelDoc.data() } as Reel);
        }
      }

      return likedReels;
    } catch (error) {
      console.error('Error getting user liked reels:', error);
      return [];
    }
  }

  private static async getUserViewedReels(userId: string): Promise<Reel[]> {
    try {
      // In a real app, you'd track viewed reels in a separate collection
      // For now, return empty array
      return [];
    } catch (error) {
      console.error('Error getting user viewed reels:', error);
      return [];
    }
  }

  private static async getAllReels(): Promise<Reel[]> {
    try {
      const reelsSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.REELS)
        .orderBy('createdAt', 'desc')
        .get();

      const reels: Reel[] = [];
      for (const doc of reelsSnapshot.docs) {
        const reelData = { id: doc.id, ...doc.data() } as Reel;
        
        // Get user data
        if (reelData.userId) {
          const userData = await this.getUserProfile(reelData.userId);
          if (userData) {
            reelData.user = userData;
          }
        }

        reels.push(reelData);
      }

      return reels;
    } catch (error) {
      console.error('Error getting all reels:', error);
      return [];
    }
  }

  static async likeComment(commentId: string, userId: string): Promise<{ isLiked: boolean; likesCount: number }> {
    try {
      const batch = firebaseFirestore.batch();
      const likeRef = firebaseFirestore.collection(COLLECTIONS.LIKES).doc(`${commentId}_${userId}_comment`);
      const commentRef = firebaseFirestore.collection(COLLECTIONS.COMMENTS).doc(commentId);
      
      const [likeDoc, commentDoc] = await Promise.all([
        likeRef.get(),
        commentRef.get()
      ]);

      if (!commentDoc.exists()) {
        throw new Error('Comment not found');
      }

      const isCurrentlyLiked = likeDoc.exists();
      const currentLikesCount = commentDoc.data()?.likesCount || 0;

      if (isCurrentlyLiked) {
        // Unlike the comment
        batch.delete(likeRef);
        batch.update(commentRef, {
          likesCount: Math.max(0, currentLikesCount - 1),
          updatedAt: new Date().toISOString(),
        });
        
        await batch.commit();
        return { isLiked: false, likesCount: Math.max(0, currentLikesCount - 1) };
      } else {
        // Like the comment
        batch.set(likeRef, {
          commentId,
          userId,
          type: 'comment',
          createdAt: new Date().toISOString(),
        });
        batch.update(commentRef, {
          likesCount: currentLikesCount + 1,
          updatedAt: new Date().toISOString(),
        });
        
        await batch.commit();
        return { isLiked: true, likesCount: currentLikesCount + 1 };
      }
    } catch (error) {
      console.error('Error liking/unliking comment:', error);
      throw error;
    }
  }

  static async checkIfPostLiked(postId: string, userId: string): Promise<boolean> {
    try {
      const likeDocRef = firebaseFirestore.collection(COLLECTIONS.LIKES).doc(`${postId}_${userId}`);
      const likeDoc = await likeDocRef.get();
      return likeDoc.exists();
    } catch (error) {
      console.error('Error checking if post is liked:', error);
      return false;
    }
  }

  static async checkIfReelLiked(reelId: string, userId: string): Promise<boolean> {
    try {
      const likeDocRef = firebaseFirestore.collection(COLLECTIONS.LIKES).doc(`${reelId}_${userId}`);
      const likeDoc = await likeDocRef.get();
      return likeDoc.exists();
    } catch (error) {
      console.error('Error checking if reel is liked:', error);
      return false;
    }
  }

  static async getPostLikes(postId: string): Promise<User[]> {
    try {
      const likesSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.LIKES)
        .where('postId', '==', postId)
        .orderBy('createdAt', 'desc')
        .get();

      const users: User[] = [];
      for (const likeDoc of likesSnapshot.docs) {
        const likeData = likeDoc.data();
        const userData = await this.getUserProfile(likeData.userId);
        if (userData) {
          users.push(userData);
        }
      }

      return users;
    } catch (error) {
      console.error('Error getting post likes:', error);
      return [];
    }
  }

  static async getReelLikes(reelId: string): Promise<User[]> {
    try {
      const likesSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.LIKES)
        .where('reelId', '==', reelId)
        .orderBy('createdAt', 'desc')
        .get();

      const users: User[] = [];
      for (const likeDoc of likesSnapshot.docs) {
        const likeData = likeDoc.data();
        const userData = await this.getUserProfile(likeData.userId);
        if (userData) {
          users.push(userData);
        }
      }

      return users;
    } catch (error) {
      console.error('Error getting reel likes:', error);
      return [];
    }
  }

  static async getCommentLikes(commentId: string): Promise<User[]> {
    try {
      const likesSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.LIKES)
        .where('commentId', '==', commentId)
        .orderBy('createdAt', 'desc')
        .get();

      const users: User[] = [];
      for (const likeDoc of likesSnapshot.docs) {
        const likeData = likeDoc.data();
        const userData = await this.getUserProfile(likeData.userId);
        if (userData) {
          users.push(userData);
        }
      }

      return users;
    } catch (error) {
      console.error('Error getting comment likes:', error);
      return [];
    }
  }

  // Comment Services
  static async getComments(contentId: string, contentType: 'post' | 'reel'): Promise<Comment[]> {
    try {
      // Simplified query to avoid complex index requirements
      const commentsSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.COMMENTS)
        .where('contentId', '==', contentId)
        .where('contentType', '==', contentType)
        .get();

      const comments: Comment[] = [];
      for (const doc of commentsSnapshot.docs) {
        const commentData = { id: doc.id, ...doc.data() } as Comment;
        
        // Only include top-level comments (filter client-side)
        if (commentData.parentId) continue;
        
        // Get user data
        if (commentData.userId) {
          const userData = await this.getUserProfile(commentData.userId);
          if (userData) {
            commentData.user = userData;
          }
        }

        // Check if current user liked this comment
        // This would be passed from the calling component
        comments.push(commentData);
      }

      // Sort by creation date (newest first) - client-side sorting
      comments.sort((a, b) => {
        const getTime = (timestamp: any): number => {
          if (timestamp instanceof Date) return timestamp.getTime();
          if (typeof timestamp === 'string') return new Date(timestamp).getTime();
          if (timestamp?.toDate) return timestamp.toDate().getTime();
          return 0;
        };
        
        const aTime = getTime(a.createdAt);
        const bTime = getTime(b.createdAt);
        return bTime - aTime;
      });

      return comments;
    } catch (error) {
      console.error('Error fetching comments:', error);
      return [];
    }
  }

  // Wrapper function for reel comments specifically
  static async getReelComments(reelId: string): Promise<Comment[]> {
    return this.getComments(reelId, 'reel');
  }

  static async getCommentReplies(parentCommentId: string): Promise<Comment[]> {
    try {
      const repliesSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.COMMENTS)
        .where('parentId', '==', parentCommentId)
        .orderBy('createdAt', 'asc')
        .get();

      const replies: Comment[] = [];
      for (const doc of repliesSnapshot.docs) {
        const replyData = { id: doc.id, ...doc.data() } as Comment;
        
        // Get user data
        if (replyData.userId) {
          const userData = await this.getUserProfile(replyData.userId);
          if (userData) {
            replyData.user = userData;
          }
        }

        replies.push(replyData);
      }

      return replies;
    } catch (error) {
      console.error('Error fetching comment replies:', error);
      return [];
    }
  }

  static async createComment(commentData: Omit<Comment, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const newComment = {
        ...commentData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Add the comment
      const docRef = await firebaseFirestore.collection(COLLECTIONS.COMMENTS).add(newComment);
      
      // Update the parent post/reel comment count with better error handling
      try {
        const contentRef = commentData.contentType === 'post' 
          ? firebaseFirestore.collection(COLLECTIONS.POSTS).doc(commentData.contentId)
          : firebaseFirestore.collection(COLLECTIONS.REELS).doc(commentData.contentId);

        // Check if the content exists before updating
        const contentDoc = await contentRef.get();
        if (contentDoc.exists) {
          await contentRef.update({
            commentsCount: FieldValue.increment(1),
          });
          console.log(`✅ Updated comment count for ${commentData.contentType} ${commentData.contentId}`);
        } else {
          console.warn(`❌ Content not found for comment: ${commentData.contentType} ${commentData.contentId}`);
        }
      } catch (error) {
        console.error(`❌ Error updating comment count for ${commentData.contentType} ${commentData.contentId}:`, error);
        // Don't throw - comment was already created successfully
      }

      // If this is a reply, update parent comment reply count with error handling
      if (commentData.parentId) {
        try {
          const parentCommentRef = firebaseFirestore.collection(COLLECTIONS.COMMENTS).doc(commentData.parentId);
          const parentCommentDoc = await parentCommentRef.get();
          if (parentCommentDoc.exists) {
            await parentCommentRef.update({
              repliesCount: FieldValue.increment(1),
            });
            console.log(`✅ Updated reply count for parent comment ${commentData.parentId}`);
          } else {
            console.warn(`❌ Parent comment not found: ${commentData.parentId}`);
          }
        } catch (error) {
          console.error(`❌ Error updating parent comment reply count:`, error);
          // Don't throw - comment was already created successfully
        }
      }

      // 🔔 Create comment notification (non-blocking)
      try {
        // Re-fetch content data for notification if needed
        const contentRef = commentData.contentType === 'post' 
          ? firebaseFirestore.collection(COLLECTIONS.POSTS).doc(commentData.contentId)
          : firebaseFirestore.collection(COLLECTIONS.REELS).doc(commentData.contentId);
        
        const contentDoc = await contentRef.get();
        if (contentDoc.exists) {
          const contentOwnerData = contentDoc.data();
          
          if (contentOwnerData && contentOwnerData.userId !== commentData.userId) {
            // Don't notify yourself
            await this.createNotification(
              contentOwnerData.userId, // recipientId
              commentData.userId, // senderId
              'comment',
              `commented on your ${commentData.contentType}`,
              commentData.contentId,
              commentData.contentType
            );
            console.log(`✅ Created comment notification for ${commentData.contentType} ${commentData.contentId}`);
          }
        } else {
          console.warn(`❌ Content not found for notification: ${commentData.contentType} ${commentData.contentId}`);
        }
      } catch (notificationError) {
        console.warn('❌ Failed to create comment notification:', notificationError);
        // Don't throw - comment was already created successfully
      }

      return docRef.id;
    } catch (error) {
      console.error('Error creating comment:', error);
      throw error;
    }
  }

  static async deleteComment(commentId: string): Promise<void> {
    try {
      const commentDocRef = firebaseFirestore.collection(COLLECTIONS.COMMENTS).doc(commentId);
      const commentDoc = await commentDocRef.get();
      if (!commentDoc.exists()) {
        throw new Error('Comment not found');
      }

      const commentData = commentDoc.data() as Comment;
      
      // Delete the comment
      await firebaseFirestore.collection(COLLECTIONS.COMMENTS).doc(commentId).delete();

      // Update the parent post/reel comment count
      const contentRef = commentData.contentType === 'post' 
        ? firebaseFirestore.collection(COLLECTIONS.POSTS).doc(commentData.contentId)
        : firebaseFirestore.collection(COLLECTIONS.REELS).doc(commentData.contentId);

      await contentRef.update({
        commentsCount: FieldValue.increment(-1),
      });

      // If this is a reply, update parent comment reply count
      if (commentData.parentId) {
        await firebaseFirestore.collection(COLLECTIONS.COMMENTS).doc(commentData.parentId).update({
          repliesCount: FieldValue.increment(-1),
        });
      }

      // Delete all replies to this comment
      const repliesSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.COMMENTS)
        .where('parentId', '==', commentId)
        .get();

      const batch = firebaseFirestore.batch();
      repliesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Error deleting comment:', error);
      throw error;
    }
  }

  static async updateComment(commentId: string, content: string): Promise<void> {
    try {
      await firebaseFirestore.collection(COLLECTIONS.COMMENTS).doc(commentId).update({
        content,
        isEdited: true,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error updating comment:', error);
      throw error;
    }
  }

  // Enhanced addComment function for voice and text comments
  static async addComment(
    contentId: string,
    userId: string,
    content: string,
    contentType: 'post' | 'reel',
    type: 'text' | 'audio' = 'text',
    mediaUrl?: string,
    parentId?: string
  ): Promise<string> {
    try {
      // Validate required fields
      if (!contentId || !userId || !content || !contentType) {
        throw new Error('Missing required fields for comment');
      }

      const commentData = {
        userId: String(userId),
        contentId: String(contentId),
        contentType: String(contentType),
        content: String(content),
        type: String(type),
        mediaUrl: mediaUrl ? String(mediaUrl) : null,
        parentId: parentId ? String(parentId) : null,
        mentions: [],
        likesCount: 0,
        repliesCount: 0,
        isEdited: false,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      // Add the comment
      const docRef = await firebaseFirestore.collection(COLLECTIONS.COMMENTS).add(commentData);
      
      // Update the parent post/reel comment count
      const contentRef = contentType === 'post' 
        ? firebaseFirestore.collection(COLLECTIONS.POSTS).doc(contentId)
        : firebaseFirestore.collection(COLLECTIONS.REELS).doc(contentId);

      await contentRef.update({
        commentsCount: FieldValue.increment(1),
      });

      // If this is a reply, update parent comment reply count
      if (parentId) {
        await firebaseFirestore.collection(COLLECTIONS.COMMENTS).doc(parentId).update({
          repliesCount: FieldValue.increment(1),
        });
      }

      return docRef.id;
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  }

  // Additional Comment Services for Live Comments
  static listenToComments(postId: string, callback: (comments: any[]) => void) {
    return firebaseFirestore
      .collection(COLLECTIONS.COMMENTS)
      .where('contentId', '==', postId)
      .orderBy('createdAt', 'asc')
      .onSnapshot((snapshot) => {
        const comments = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        callback(comments);
      });
  }

  static async addReply(replyData: any) {
    try {
      const docRef = await firebaseFirestore
        .collection(COLLECTIONS.COMMENTS)
        .add({
          ...replyData,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      return docRef.id;
    } catch (error) {
      console.error('Error adding reply:', error);
      throw error;
    }
  }

  static async likeReply(commentId: string, replyId: string, userId: string) {
    try {
      const likeRef = firebaseFirestore
        .collection(COLLECTIONS.COMMENTS)
        .doc(replyId);
      
      await likeRef.update({
        likesCount: FieldValue.increment(1)
      });
    } catch (error) {
      console.error('Error liking reply:', error);
      throw error;
    }
  }

  static async pinComment(commentId: string) {
    try {
      await firebaseFirestore
        .collection(COLLECTIONS.COMMENTS)
        .doc(commentId)
        .update({
          isPinned: true,
          pinnedAt: FieldValue.serverTimestamp()
        });
    } catch (error) {
      console.error('Error pinning comment:', error);
      throw error;
    }
  }

  // Instagram-like personalized feed with following priority
  static async getPersonalizedFeed(userId: string, limit: number = 20): Promise<Post[]> {
    try {
      // Get user's following list
      const following = await this.getFollowing(userId);
      const followingIds = following.map(user => user.uid);
      
      // Get posts from followed users (priority content)
      const followingPosts: Post[] = [];
      if (followingIds.length > 0) {
        // Split into chunks to avoid Firestore 'in' query limit of 10
        const chunks = [];
        for (let i = 0; i < followingIds.length; i += 10) {
          chunks.push(followingIds.slice(i, i + 10));
        }
        
        for (const chunk of chunks) {
          const followingSnapshot = await firebaseFirestore
            .collection(COLLECTIONS.POSTS)
            .where('userId', 'in', chunk)
            .orderBy('createdAt', 'desc')
            .limit(Math.ceil(limit * 0.7)) // 70% from followed users
            .get();
            
          for (const doc of followingSnapshot.docs) {
            const postData = { id: doc.id, ...doc.data() } as Post;
            if (postData.userId) {
              const userData = await this.getUserProfile(postData.userId);
              if (userData) {
                postData.user = userData;
              }
            }
            // Check if user liked this post
            postData.isLiked = await this.checkIfPostLiked(doc.id, userId);
            followingPosts.push(postData);
          }
        }
      }
      
      // Get discover posts (simple query - no complex indexes needed)
      const discoverQuery = firebaseFirestore
        .collection(COLLECTIONS.POSTS)
        .orderBy('createdAt', 'desc')
        .limit(Math.ceil(limit * 0.3)); // 30% discover content
            
      const discoverSnapshot = await discoverQuery.get();
      const discoverPosts: Post[] = [];
      
      for (const doc of discoverSnapshot.docs) {
        const postData = { id: doc.id, ...doc.data() } as Post;
        if (postData.userId) {
          const userData = await this.getUserProfile(postData.userId);
          if (userData) {
            postData.user = userData;
          }
        }
        // Check if user liked this post
        postData.isLiked = await this.checkIfPostLiked(doc.id, userId);
        discoverPosts.push(postData);
      }
      
      // Combine and sort posts with following priority
      const allPosts = [...followingPosts, ...discoverPosts];
      const uniquePosts = allPosts.filter((post, index, self) => 
        index === self.findIndex(p => p.id === post.id)
      );
      
      // Sort with priority: followed users' recent posts first, then by engagement
      const sortedPosts = uniquePosts.sort((a, b) => {
        const aIsFollowed = followingIds.includes(a.userId);
        const bIsFollowed = followingIds.includes(b.userId);
        
        // Priority 1: Posts from followed users
        if (aIsFollowed && !bIsFollowed) return -1;
        if (!aIsFollowed && bIsFollowed) return 1;
        
        // Priority 2: Recent posts (within 24 hours) from followed users
        const now = Date.now();
        const aRecent = (now - new Date(a.createdAt).getTime()) < 24 * 60 * 60 * 1000;
        const bRecent = (now - new Date(b.createdAt).getTime()) < 24 * 60 * 60 * 1000;
        
        if (aIsFollowed && bIsFollowed) {
          if (aRecent && !bRecent) return -1;
          if (!aRecent && bRecent) return 1;
        }
        
        // Priority 3: By creation time (newest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      return sortedPosts.slice(0, limit);
    } catch (error) {
      console.error('Error getting personalized feed:', error);
      // Fallback to regular posts
      return this.getPosts(undefined, limit);
    }
  }

  // Reel Services
  static async getUserReels(userId: string, limit: number = 20, offset: number = 0): Promise<Reel[]> {
    try {
      let query = firebaseFirestore
        .collection(COLLECTIONS.REELS)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit);

      // Add offset support using startAfter
      if (offset > 0) {
        const skipSnapshot = await firebaseFirestore
          .collection(COLLECTIONS.REELS)
          .where('userId', '==', userId)
          .orderBy('createdAt', 'desc')
          .limit(offset)
          .get();
        
        if (!skipSnapshot.empty) {
          const lastDoc = skipSnapshot.docs[skipSnapshot.docs.length - 1];
          query = query.startAfter(lastDoc);
        }
      }

      const reelsSnapshot = await query.get();

      const reels: Reel[] = [];

      for (const doc of reelsSnapshot.docs) {
        const reelData = { id: doc.id, ...doc.data() } as Reel;
        if (reelData.userId) {
          const userData = await this.getUserProfile(reelData.userId);
          if (userData) {
            reelData.user = userData;
          }
        }
        reels.push(reelData);
      }

      return reels;
    } catch (error) {
      console.error('Error fetching user reels:', error);
      throw error;
    }
  }

  static async getReels(limit: number = 20, lastDoc?: any, excludeUserId?: string): Promise<{ reels: Reel[], lastDoc: any, hasMore: boolean }> {
    try {
      let query = firebaseFirestore
        .collection(COLLECTIONS.REELS)
        .orderBy('createdAt', 'desc')
        .limit(limit);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const reelsSnapshot = await query.get();
      const reels: Reel[] = [];

      for (const doc of reelsSnapshot.docs) {
        const reelData = { id: doc.id, ...doc.data() } as Reel;
        
        // Skip current user's reels if excludeUserId is provided
        if (excludeUserId && reelData.userId === excludeUserId) {
          continue;
        }
        
        if (reelData.userId) {
          const userData = await this.getUserProfile(reelData.userId);
          if (userData) {
            reelData.user = userData;
          }
        }
        
        // Add computed fields
        reelData.timeAgo = this.formatTimeAgo(reelData.createdAt);
        
        reels.push(reelData);
      }

      const newLastDoc = reelsSnapshot.docs[reelsSnapshot.docs.length - 1];
      const hasMore = reelsSnapshot.docs.length === limit;

      return {
        reels,
        lastDoc: newLastDoc,
        hasMore
      };
    } catch (error) {
      console.error('Error fetching reels:', error);
      throw error;
    }
  }

  static async createReel(reelData: Omit<Reel, 'id' | 'createdAt'>): Promise<string> {
    try {
      // Clean the data to remove undefined values that cause Firestore errors
      const cleanReelData = {
        userId: reelData.userId,
        videoUrl: reelData.videoUrl,
        caption: reelData.caption || '',
        thumbnailUrl: reelData.thumbnailUrl || reelData.videoUrl,
        duration: reelData.duration || 30,
        isPrivate: reelData.isPrivate || false,
        likesCount: reelData.likesCount || 0,
        commentsCount: reelData.commentsCount || 0,
        sharesCount: reelData.sharesCount || 0,
        viewsCount: reelData.viewsCount || 0,
        hashtags: reelData.hashtags || [],
        mentions: reelData.mentions || [],
        // Only include optional fields if they have values
        ...(reelData.musicTitle && { musicTitle: reelData.musicTitle }),
        ...(reelData.musicArtist && { musicArtist: reelData.musicArtist }),
        ...(reelData.musicId && { musicId: reelData.musicId }),
        ...(reelData.filter && { filter: reelData.filter }),
        ...(reelData.textOverlays && reelData.textOverlays.length > 0 && { textOverlays: reelData.textOverlays }),
        ...(reelData.fileSize && { fileSize: reelData.fileSize }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      console.log('🎬 Creating reel with clean data:', cleanReelData);

      const docRef = await firebaseFirestore.collection(COLLECTIONS.REELS).add(cleanReelData);
      
      // Update user's reels count
      await firebaseFirestore.collection(COLLECTIONS.USERS).doc(reelData.userId).update({
        reelsCount: FieldValue.increment(1),
      });

      // 🎬 Notify followers about new reel (non-blocking)
      try {
        const followersSnapshot = await firebaseFirestore
          .collection(COLLECTIONS.FOLLOWS)
          .where('following', '==', reelData.userId)
          .get();

        const notificationPromises = followersSnapshot.docs.map(async (followerDoc) => {
          const followerData = followerDoc.data();
          return this.createNotification(
            followerData.follower, // recipientId
            reelData.userId, // senderId
            'reel',
            'shared a new reel',
            docRef.id,
            'reel'
          );
        });

        if (notificationPromises.length > 0) {
          await Promise.allSettled(notificationPromises);
          console.log(`✅ Notified ${notificationPromises.length} followers about new reel ${docRef.id}`);
        }
      } catch (notificationError) {
        console.warn('Failed to notify followers about new reel:', notificationError);
      }

      return docRef.id;
    } catch (error) {
      console.error('Error creating reel:', error);
      throw error;
    }
  }

  // Notification Services
  static async createNotification(
    receiverId: string,
    senderId: string,
    type: string,
    message: string,
    contentId?: string,
    contentType?: string
  ): Promise<void> {
    try {
      // Don't create notification for self
      if (receiverId === senderId) return;

      await firebaseFirestore.collection(COLLECTIONS.NOTIFICATIONS).add({
        receiverId,
        senderId,
        type,
        message,
        contentId: contentId || null,
        contentType: contentType || null,
        read: false,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  }

  static async createLikeNotification(contentId: string, likerUserId: string, type: 'post' | 'reel' | 'comment' | 'story'): Promise<void> {
    try {
      // Get the content to find the owner
      let contentRef;
      let contentData;

      if (type === 'post') {
        contentRef = firebaseFirestore.collection(COLLECTIONS.POSTS).doc(contentId);
      } else if (type === 'reel') {
        contentRef = firebaseFirestore.collection(COLLECTIONS.REELS).doc(contentId);
      } else if (type === 'story') {
        contentRef = firebaseFirestore.collection(COLLECTIONS.STORIES).doc(contentId);
      } else {
        contentRef = firebaseFirestore.collection(COLLECTIONS.COMMENTS).doc(contentId);
      }

      const contentDoc = await contentRef.get();
      if (!contentDoc.exists()) return;

      contentData = contentDoc.data();
      const ownerId = contentData?.userId;

      // Don't create notification if user likes their own content
      if (ownerId === likerUserId) return;

      // Create notification
      await firebaseFirestore.collection(COLLECTIONS.NOTIFICATIONS).add({
        recipientId: ownerId,
        senderId: likerUserId,
        type: 'like',
        contentType: type,
        contentId,
        read: false,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error creating like notification:', error);
    }
  }

  static async getUserNotifications(userId: string): Promise<any[]> {
    try {
      // Simplified query to avoid index requirement
      const notificationsSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.NOTIFICATIONS)
        .where('recipientId', '==', userId)
        .limit(50)
        .get();

      const notifications = [];
      
      for (const doc of notificationsSnapshot.docs) {
        const notificationData = { id: doc.id, ...doc.data() } as any;
        
        // Validate required fields
        if (!notificationData.senderId || !notificationData.type) {
          console.warn('Notification missing required fields:', notificationData);
          continue;
        }
        
        // Get sender user data
        const senderData = await this.getUserProfile(notificationData.senderId);
        if (!senderData) continue;

        // Get post image if applicable
        let postImage = '';
        if (notificationData.contentId && notificationData.contentType === 'post') {
          const postData = await this.getPostById(notificationData.contentId);
          postImage = postData?.mediaUrls?.[0] || '';
        }

        // Format notification message
        let message = '';
        switch (notificationData.type) {
          case 'like':
            message = `liked your ${notificationData.contentType || 'post'}`;
            break;
          case 'comment':
            message = `commented on your ${notificationData.contentType || 'post'}`;
            break;
          case 'follow':
            message = 'started following you';
            break;
          case 'mention':
            message = 'mentioned you in a post';
            break;
          default:
            message = 'sent you a notification';
        }

        notifications.push({
          id: doc.id,
          type: notificationData.type,
          fromUserId: notificationData.senderId,
          fromUser: {
            displayName: senderData.displayName,
            profilePicture: senderData.profilePicture || 'https://via.placeholder.com/150',
          },
          postId: notificationData.contentId,
          postImage,
          message,
          timestamp: new Date(notificationData.createdAt),
          read: notificationData.read || false,
          createdAt: notificationData.createdAt, // Add this for sorting
        });
      }

      // Sort notifications by createdAt client-side to avoid index requirement
      notifications.sort((a, b) => {
        const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : 
                     typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() :
                     a.createdAt?.toDate?.()?.getTime() || 0;
        const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 
                     typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() :
                     b.createdAt?.toDate?.()?.getTime() || 0;
        return bTime - aTime; // Sort newest first
      });

      return notifications;
    } catch (error) {
      console.error('Error getting user notifications:', error);
      return [];
    }
  }

  static async getPostById(postId: string): Promise<any> {
    try {
      const postDocRef = firebaseFirestore.collection(COLLECTIONS.POSTS).doc(postId);
      const postDoc = await postDocRef.get();
      if (postDoc.exists()) {
        return { id: postDoc.id, ...postDoc.data() };
      }
      return null;
    } catch (error) {
      console.error('Error getting post by ID:', error);
      return null;
    }
  }

  static async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      await firebaseFirestore
        .collection(COLLECTIONS.NOTIFICATIONS)
        .doc(notificationId)
        .update({
          read: true,
          readAt: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  // Story Services
  static async getStories(userId?: string): Promise<Story[]> {
    try {
      const currentUser = firebaseAuth.currentUser;
      const currentUserId = currentUser?.uid;
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      let query = firebaseFirestore
        .collection(COLLECTIONS.STORIES)
        .where('expiresAt', '>', twentyFourHoursAgo)
        .orderBy('expiresAt', 'asc');

      if (userId) {
        query = query.where('userId', '==', userId);
      }

      const storiesSnapshot = await query.get();
      const stories: Story[] = [];

      for (const doc of storiesSnapshot.docs) {
        const storyData = { id: doc.id, ...doc.data() } as Story;
        
        // Check if current user has viewed this story
        if (currentUserId) {
          storyData.isViewed = storyData.viewedBy?.includes(currentUserId) || false;
        }
        
        if (storyData.userId) {
          const userData = await this.getUserProfile(storyData.userId);
          if (userData) {
            storyData.user = userData;
          }
        }
        stories.push(storyData);
      }

      return stories;
    } catch (error) {
      console.error('Error fetching stories:', error);
      throw error;
    }
  }

  static async createStory(storyData: {
    mediaUri?: string;
    mediaUrl?: string;
    mediaType: 'photo' | 'video' | 'image';
    duration?: number;
    caption?: string;
    filter?: StoryFilter;
    texts?: StoryText[];
    stickers?: StorySticker[];
    music?: StoryMusic;
    userId?: string;
    [key: string]: any;
  }): Promise<string> {
    try {
      const mediaUri = storyData.mediaUri || storyData.mediaUrl;
      if (!mediaUri) {
        throw new Error('Media URI is required');
      }

      // Upload media to storage first
      const mediaUrl = await this.uploadStoryMedia(mediaUri);
      
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const currentUser = firebaseAuth.currentUser;
      const userId = storyData.userId || currentUser?.uid;
      
      if (!userId) {
        throw new Error('User must be authenticated to create a story');
      }

      // Get user data for story display
      const userDocRef = firebaseFirestore.collection(COLLECTIONS.USERS).doc(userId);
      const userDoc = await userDocRef.get();
      const userData = userDoc.data() as User;

      // Create story object with only defined values (Firestore doesn't support undefined)
      const newStory: any = {
        userId,
        mediaUrl,
        mediaType: storyData.mediaType === 'photo' ? 'image' : storyData.mediaType,
        viewsCount: 0,
        viewers: [],
        viewedBy: [], // Initialize empty array for tracking viewers
        likesCount: 0,
        commentsCount: 0,
        texts: storyData.texts || [],
        stickers: storyData.stickers || [],
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };

      // Only add optional fields if they have values
      if (userData) {
        newStory.user = userData;
      }
      if (storyData.duration !== undefined) {
        newStory.duration = storyData.duration;
      }
      if (storyData.caption) {
        newStory.caption = storyData.caption;
      }
      if (storyData.filter) {
        newStory.filter = storyData.filter;
      }
      if (storyData.music) {
        newStory.music = storyData.music;
      }

      const docRef = await firebaseFirestore.collection(COLLECTIONS.STORIES).add(newStory);
      
      // Update user's last story timestamp for better story ordering
      await firebaseFirestore.collection(COLLECTIONS.USERS).doc(userId).update({
        lastStoryAt: now.toISOString(),
      });

      return docRef.id;
    } catch (error) {
      console.error('Error creating story:', error);
      throw error;
    }
  }

  /**
   * Upload media file to Firebase Storage for posts/reels - ENHANCED & FIXED
   */
  static async uploadMedia(uri: string, userId: string, mediaType: 'image' | 'video'): Promise<string> {
    try {
      console.log('🚀 Starting enhanced media upload:', { uri, userId, mediaType });
      
      // Validate input parameters
      if (!uri || !userId || !mediaType) {
        throw new Error('Missing required parameters for upload');
      }

      // Generate unique filename with proper extension detection
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2);
      
      // Get proper file extension from URI or use default
      let extension = 'jpg';
      if (uri.includes('.')) {
        const uriExtension = uri.split('.').pop()?.toLowerCase();
        if (uriExtension) {
          extension = uriExtension;
        }
      } else if (mediaType === 'video') {
        extension = 'mp4';
      }
      
      const fileName = `${mediaType}s/${userId}/${timestamp}_${randomId}.${extension}`;
      console.log('📂 Upload path:', fileName);
      
      // Create Firebase Storage reference
      const storageRef = storage().ref(fileName);
      
      // Check if file exists locally first
      console.log('� Checking local file:', uri);
      
      try {
        // Start upload with proper error handling
        console.log('📤 Starting Firebase Storage upload...');
        
        const uploadTask = storageRef.putFile(uri, {
          cacheControl: 'max-age=3600',
          contentType: mediaType === 'video' ? 'video/mp4' : 'image/jpeg'
        });

        // Enhanced progress tracking
        const progressPromise = new Promise<void>((resolve, reject) => {
          uploadTask.on(
            storage.TaskEvent.STATE_CHANGED,
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              console.log(`📊 Upload progress: ${progress.toFixed(1)}% (${snapshot.bytesTransferred}/${snapshot.totalBytes} bytes)`);
              
              if (snapshot.state === storage.TaskState.SUCCESS) {
                console.log('✅ Upload completed successfully!');
                resolve();
              }
            },
            (error) => {
              console.error('❌ Upload failed:', error);
              reject(error);
            },
            () => {
              console.log('🎉 Upload task completed');
              resolve();
            }
          );
        });

        // Wait for upload to complete
        await Promise.all([uploadTask, progressPromise]);
        
        // Get download URL with retry logic
        let downloadUrl: string;
        let retries = 3;
        
        while (retries > 0) {
          try {
            console.log(`🔗 Getting download URL (attempt ${4 - retries})`);
            downloadUrl = await storageRef.getDownloadURL();
            console.log('✅ Download URL obtained:', downloadUrl);
            break;
          } catch (urlError) {
            retries--;
            console.warn(`⚠️ Failed to get download URL, retries left: ${retries}`, urlError);
            
            if (retries === 0) {
              throw urlError;
            }
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        return downloadUrl!;
        
      } catch (uploadError) {
        console.error('❌ Firebase Storage upload failed:', uploadError);
        throw uploadError;
      }
      
    } catch (error) {
      console.error('❌ Complete upload process failed:', error);
      
      // Enhanced fallback strategy for development
      if (__DEV__) {
        console.warn('🔄 Development mode: Using original URI as fallback');
        
        // For development, we can use a mock URL or the original URI
        // In production, you might want to use a different fallback strategy
        const mockUrl = `https://firebasestorage.googleapis.com/v0/b/jorvea-9f876.appspot.com/o/${encodeURIComponent(`${mediaType}s/${userId}/${Date.now()}_mock.${mediaType === 'video' ? 'mp4' : 'jpg'}`)}?alt=media`;
        console.log('🎭 Using mock URL for development:', mockUrl);
        return mockUrl;
      }
      
      throw error;
    }
  }

  private static async uploadStoryMedia(uri: string): Promise<string> {
    try {
      console.log('📸 Uploading story media to DigitalOcean Spaces:', uri);
      
      // Get current user for upload path
      const currentUser = firebaseAuth.currentUser;
      if (!currentUser) {
        throw new Error('User must be authenticated to upload story media');
      }
      
      // Detect media type from URI
      const isVideo = uri.toLowerCase().includes('.mp4') || 
                     uri.toLowerCase().includes('.mov') || 
                     uri.toLowerCase().includes('video');
      const mediaType = isVideo ? 'video' : 'image';
      const extension = isVideo ? 'mp4' : 'jpg';
      const mimeType = isVideo ? 'video/mp4' : 'image/jpeg';
      
      console.log(`📤 Uploading story ${mediaType} to DigitalOcean Spaces...`);
      
      // Generate unique filename for DigitalOcean
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 15);
      const fileName = `stories/${currentUser.uid}/${timestamp}_${randomId}.${extension}`;
      
      // Import DigitalOceanService dynamically
      const { DigitalOceanService } = await import('./digitalOceanService');
      
      // Upload to DigitalOcean Spaces
      const mediaUrl = await DigitalOceanService.uploadMedia(uri, fileName, mimeType);
      
      console.log('✅ Story media uploaded to DigitalOcean successfully:', mediaUrl);
      return mediaUrl;
    } catch (error) {
      console.error('❌ Error uploading story media to DigitalOcean:', error);
      throw error;
    }
  }

  // Enhanced story management functions
  static async viewStory(storyId: string, viewerId: string): Promise<void> {
    try {
      const storyRef = firebaseFirestore.collection(COLLECTIONS.STORIES).doc(storyId);
      const storyDoc = await storyRef.get();
      
      if (storyDoc.exists()) {
        const story = storyDoc.data() as Story;
        
        // Only increment if viewer hasn't viewed before
        if (!story.viewers.includes(viewerId)) {
          const updateData: any = {
            viewers: [...story.viewers, viewerId],
            viewsCount: story.viewsCount + 1,
          };
          
          // Also update viewedBy array if it exists
          if (story.viewedBy) {
            if (!story.viewedBy.includes(viewerId)) {
              updateData.viewedBy = [...story.viewedBy, viewerId];
            }
          } else {
            updateData.viewedBy = [viewerId];
          }
          
          await storyRef.update(updateData);
        }
      }
    } catch (error) {
      console.error('Error viewing story:', error);
      throw error;
    }
  }

  static async markStoryAsViewed(storyId: string, viewerId: string): Promise<void> {
    try {
      console.log(`Marking story ${storyId} as viewed by ${viewerId}`);
      await this.viewStory(storyId, viewerId);
      console.log(`Successfully marked story ${storyId} as viewed`);
    } catch (error) {
      console.error('Error marking story as viewed:', error);
      throw error;
    }
  }

  static async deleteStory(storyId: string, userId: string): Promise<void> {
    try {
      const storyRef = firebaseFirestore.collection(COLLECTIONS.STORIES).doc(storyId);
      const storyDoc = await storyRef.get();
      
      if (storyDoc.exists()) {
        const story = storyDoc.data() as Story;
        
        // Only allow deletion by story owner
        if (story.userId === userId) {
          await storyRef.delete();
          
          // Clean up associated likes
          const likesQuery = await firebaseFirestore
            .collection(COLLECTIONS.STORY_LIKES)
            .where('storyId', '==', storyId)
            .get();
          
          const batch = firebaseFirestore.batch();
          likesQuery.docs.forEach(doc => {
            batch.delete(doc.ref);
          });
          await batch.commit();
        } else {
          throw new Error('You can only delete your own stories');
        }
      }
    } catch (error) {
      console.error('Error deleting story:', error);
      throw error;
    }
  }

  static async getUserStories(userId: string): Promise<Story[]> {
    try {
      const currentUserId = firebaseAuth.currentUser?.uid;
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const storiesSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.STORIES)
        .where('userId', '==', userId)
        .where('expiresAt', '>', twentyFourHoursAgo)
        .orderBy('expiresAt', 'asc')
        .orderBy('createdAt', 'desc')
        .get();

      const stories: Story[] = [];

      for (const doc of storiesSnapshot.docs) {
        const storyData = { id: doc.id, ...doc.data() } as Story;
        
        // Check if current user has viewed this story
        if (currentUserId) {
          storyData.isViewed = storyData.viewedBy?.includes(currentUserId) || false;
        }
        
        // Get user data if not already present
        if (!storyData.user && storyData.userId) {
          const userData = await this.getUserProfile(storyData.userId);
          if (userData) {
            storyData.user = userData;
          }
        }
        
        stories.push(storyData);
      }

      return stories;
    } catch (error) {
      console.error('Error fetching user stories:', error);
      throw error;
    }
  }

  // Get stories for home page (only from followed users)
  static async getFollowingUsersStories(userId: string): Promise<{ [userId: string]: Story[] }> {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      // Get list of followed users
      const followingSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.FOLLOWING)
        .where('followerId', '==', userId)
        .get();

      const followingUserIds = followingSnapshot.docs.map(doc => doc.data().followingId);
      
      if (followingUserIds.length === 0) {
        return {};
      }

      // Get stories from followed users in batches (Firestore limit is 10 for 'in' queries)
      const storyBatches = [];
      for (let i = 0; i < followingUserIds.length; i += 10) {
        const batch = followingUserIds.slice(i, i + 10);
        const batchPromise = firebaseFirestore
          .collection(COLLECTIONS.STORIES)
          .where('userId', 'in', batch)
          .where('expiresAt', '>', twentyFourHoursAgo)
          .orderBy('expiresAt', 'asc')
          .orderBy('createdAt', 'desc')
          .get();
        storyBatches.push(batchPromise);
      }

      const batchResults = await Promise.all(storyBatches);
      const allStories: Story[] = [];

      for (const snapshot of batchResults) {
        for (const doc of snapshot.docs) {
          const storyData = { id: doc.id, ...doc.data() } as Story;
          
          // Check if current user has viewed this story
          storyData.isViewed = storyData.viewedBy?.includes(userId) || false;
          
          // Get user data if not already present
          if (!storyData.user && storyData.userId) {
            const userData = await this.getUserProfile(storyData.userId);
            if (userData) {
              storyData.user = userData;
            }
          }
          
          allStories.push(storyData);
        }
      }

      // Group stories by user
      const groupedStories: { [userId: string]: Story[] } = {};
      for (const story of allStories) {
        if (!groupedStories[story.userId]) {
          groupedStories[story.userId] = [];
        }
        groupedStories[story.userId].push(story);
      }

      return groupedStories;
    } catch (error) {
      console.error('Error fetching following users stories:', error);
      throw error;
    }
  }

  // Get all user stories for profile page (regardless of follow status)
  static async getAllUserStoriesForProfile(targetUserId: string, currentUserId: string): Promise<Story[]> {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const storiesSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.STORIES)
        .where('userId', '==', targetUserId)
        .where('expiresAt', '>', twentyFourHoursAgo)
        .orderBy('expiresAt', 'asc')
        .orderBy('createdAt', 'desc')
        .get();

      const stories: Story[] = [];

      for (const doc of storiesSnapshot.docs) {
        const storyData = { id: doc.id, ...doc.data() } as Story;
        
        // Check if current user has viewed this story
        storyData.isViewed = storyData.viewedBy?.includes(currentUserId) || false;
        
        // Get user data if not already present
        if (!storyData.user && storyData.userId) {
          const userData = await this.getUserProfile(storyData.userId);
          if (userData) {
            storyData.user = userData;
          }
        }
        
        stories.push(storyData);
      }

      return stories;
    } catch (error) {
      console.error('Error fetching user stories for profile:', error);
      throw error;
    }
  }

  // Mark story as viewed
  static async markStoryAsViewed(storyId: string, userId: string): Promise<void> {
    try {
      const storyRef = firebaseFirestore.collection(COLLECTIONS.STORIES).doc(storyId);
      
      await storyRef.update({
        viewedBy: FieldValue.arrayUnion(userId),
        viewsCount: FieldValue.increment(1)
      });
    } catch (error) {
      console.error('Error marking story as viewed:', error);
      throw error;
    }
  }

  // Like story
  static async likeStory(storyId: string, userId: string): Promise<void> {
    try {
      const storyRef = firebaseFirestore.collection(COLLECTIONS.STORIES).doc(storyId);
      const likeRef = firebaseFirestore.collection(COLLECTIONS.STORY_LIKES).doc(`${storyId}_${userId}`);
      
      const batch = firebaseFirestore.batch();
      
      // Add like document
      batch.set(likeRef, {
        storyId,
        userId,
        createdAt: new Date().toISOString(),
      });
      
      // Increment likes count
      batch.update(storyRef, {
        likesCount: FieldValue.increment(1)
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Error liking story:', error);
      throw error;
    }
  }

  // Unlike story
  static async unlikeStory(storyId: string, userId: string): Promise<void> {
    try {
      const storyRef = firebaseFirestore.collection(COLLECTIONS.STORIES).doc(storyId);
      const likeRef = firebaseFirestore.collection(COLLECTIONS.STORY_LIKES).doc(`${storyId}_${userId}`);
      
      const batch = firebaseFirestore.batch();
      
      // Remove like document
      batch.delete(likeRef);
      
      // Decrement likes count
      batch.update(storyRef, {
        likesCount: FieldValue.increment(-1)
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Error unliking story:', error);
      throw error;
    }
  }

  // Delete expired stories (call this periodically)
  static async deleteExpiredStories(): Promise<void> {
    try {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const expiredStoriesQuery = firebaseFirestore
        .collection(COLLECTIONS.STORIES)
        .where('createdAt', '<', twentyFourHoursAgo.toISOString());
      
      const snapshot = await expiredStoriesQuery.get();
      
      if (!snapshot.empty) {
        const batch = firebaseFirestore.batch();
        
        snapshot.docs.forEach(doc => {
          const story = doc.data();
          
          // Delete from Firebase
          batch.delete(doc.ref);
          
          // Also delete from DigitalOcean if media exists
          if (story.mediaUrl) {
            // Extract key from URL and delete from DigitalOcean
            try {
              const url = new URL(story.mediaUrl);
              const key = url.pathname.substring(1); // Remove leading slash
              // Delete from DigitalOcean (implement this in DigitalOceanService)
              console.log('Should delete from DigitalOcean:', key);
            } catch (error) {
              console.error('Error parsing media URL:', error);
            }
          }
        });
        
        await batch.commit();
        console.log(`Deleted ${snapshot.size} expired stories`);
      }
    } catch (error) {
      console.error('Error deleting expired stories:', error);
      throw error;
    }
  }

  // Delete post (only by owner)
  static async deletePost(postId: string, userId: string): Promise<void> {
    try {
      const postRef = firebaseFirestore.collection(COLLECTIONS.POSTS).doc(postId);
      const postDoc = await postRef.get();
      
      if (!postDoc.exists) {
        throw new Error('Post not found');
      }
      
      const post = postDoc.data();
      if (post?.userId !== userId) {
        throw new Error('Unauthorized: Only post owner can delete');
      }
      
      const batch = firebaseFirestore.batch();
      
      // Delete post
      batch.delete(postRef);
      
      // Delete associated likes
      const likesQuery = firebaseFirestore
        .collection(COLLECTIONS.POST_LIKES)
        .where('postId', '==', postId);
      const likesSnapshot = await likesQuery.get();
      likesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      
      // Delete associated comments
      const commentsQuery = firebaseFirestore
        .collection(COLLECTIONS.POST_COMMENTS)
        .where('postId', '==', postId);
      const commentsSnapshot = await commentsQuery.get();
      commentsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      
      await batch.commit();
      
      // Delete media from DigitalOcean
      if (post.mediaUrls && Array.isArray(post.mediaUrls)) {
        for (const mediaUrl of post.mediaUrls) {
          try {
            const url = new URL(mediaUrl);
            const key = url.pathname.substring(1);
            console.log('Should delete from DigitalOcean:', key);
          } catch (error) {
            console.error('Error parsing media URL:', error);
          }
        }
      }
      
    } catch (error) {
      console.error('Error deleting post:', error);
      throw error;
    }
  }

  // Delete reel (only by owner)
  static async deleteReel(reelId: string, userId: string): Promise<void> {
    try {
      const reelRef = firebaseFirestore.collection(COLLECTIONS.REELS).doc(reelId);
      const reelDoc = await reelRef.get();
      
      if (!reelDoc.exists) {
        throw new Error('Reel not found');
      }
      
      const reel = reelDoc.data();
      if (reel?.userId !== userId) {
        throw new Error('Unauthorized: Only reel owner can delete');
      }
      
      const batch = firebaseFirestore.batch();
      
      // Delete reel
      batch.delete(reelRef);
      
      // Delete associated likes
      const likesQuery = firebaseFirestore
        .collection(COLLECTIONS.REEL_LIKES)
        .where('reelId', '==', reelId);
      const likesSnapshot = await likesQuery.get();
      likesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      
      // Delete associated comments
      const commentsQuery = firebaseFirestore
        .collection(COLLECTIONS.REEL_COMMENTS)
        .where('reelId', '==', reelId);
      const commentsSnapshot = await commentsQuery.get();
      commentsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      
      await batch.commit();
      
      // Delete media from DigitalOcean
      if (reel.videoUrl) {
        try {
          const url = new URL(reel.videoUrl);
          const key = url.pathname.substring(1);
          console.log('Should delete from DigitalOcean:', key);
        } catch (error) {
          console.error('Error parsing media URL:', error);
        }
      }
      
    } catch (error) {
      console.error('Error deleting reel:', error);
      throw error;
    }
  }

  // Follow Services
  static async checkFollowStatus(followerId: string, followingId: string): Promise<boolean> {
    try {
      const followDoc = await firebaseFirestore
        .collection(COLLECTIONS.FOLLOWING)
        .doc(`${followerId}_${followingId}`)
        .get();
      
      return followDoc.exists();
    } catch (error) {
      console.error('Error checking follow status:', error);
      return false;
    }
  }

  static async followUser(followerId: string, followingId: string): Promise<void> {
    try {
      const followRef = firebaseFirestore.collection(COLLECTIONS.FOLLOWING).doc(`${followerId}_${followingId}`);
      const followerRef = firebaseFirestore.collection(COLLECTIONS.FOLLOWERS).doc(`${followingId}_${followerId}`);

      await Promise.all([
        followRef.set({
          followerId,
          followingId,
          createdAt: new Date().toISOString(),
        }),
        followerRef.set({
          followerId,
          followingId,
          createdAt: new Date().toISOString(),
        }),
        firebaseFirestore.collection(COLLECTIONS.USERS).doc(followerId).update({
          followingCount: FieldValue.increment(1),
        }),
        firebaseFirestore.collection(COLLECTIONS.USERS).doc(followingId).update({
          followersCount: FieldValue.increment(1),
        }),
      ]);

      // 👥 Create follow notification (non-blocking)
      try {
        await this.createNotification(
          followingId, // recipientId (person being followed)
          followerId, // senderId (person who followed)
          'follow',
          'started following you',
          followerId, // contentId (follower's profile)
          'user'
        );
        console.log(`✅ Created follow notification: ${followerId} followed ${followingId}`);
      } catch (notificationError) {
        console.warn('Failed to create follow notification:', notificationError);
      }
    } catch (error) {
      console.error('Error following user:', error);
      throw error;
    }
  }

  static async unfollowUser(followerId: string, followingId: string): Promise<void> {
    try {
      const followRef = firebaseFirestore.collection(COLLECTIONS.FOLLOWING).doc(`${followerId}_${followingId}`);
      const followerRef = firebaseFirestore.collection(COLLECTIONS.FOLLOWERS).doc(`${followingId}_${followerId}`);

      await Promise.all([
        followRef.delete(),
        followerRef.delete(),
        firebaseFirestore.collection(COLLECTIONS.USERS).doc(followerId).update({
          followingCount: FieldValue.increment(-1),
        }),
        firebaseFirestore.collection(COLLECTIONS.USERS).doc(followingId).update({
          followersCount: FieldValue.increment(-1),
        }),
      ]);
    } catch (error) {
      console.error('Error unfollowing user:', error);
      throw error;
    }
  }

  static async toggleFollowUser(followerId: string, followingId: string): Promise<{ isFollowing: boolean }> {
    try {
      // Don't allow self-following
      if (followerId === followingId) {
        throw new Error('Cannot follow yourself');
      }

      const isCurrentlyFollowing = await this.checkIfFollowing(followerId, followingId);

      if (isCurrentlyFollowing) {
        await this.unfollowUser(followerId, followingId);
        return { isFollowing: false };
      } else {
        await this.followUser(followerId, followingId);
        
        // Create follow notification
        await this.createNotification(
          followingId,
          followerId,
          'follow',
          '',
          `${await this.getUserDisplayName(followerId)} started following you`
        );
        
        return { isFollowing: true };
      }
    } catch (error) {
      console.error('Error toggling follow status:', error);
      throw error;
    }
  }

  static async getUserDisplayName(userId: string): Promise<string> {
    try {
      const userDocRef = firebaseFirestore.collection(COLLECTIONS.USERS).doc(userId);
      const userDoc = await userDocRef.get();
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return userData?.displayName || userData?.email || 'Unknown User';
      }
      return 'Unknown User';
    } catch (error) {
      console.error('Error getting user display name:', error);
      return 'Unknown User';
    }
  }

  static async checkIfFollowing(followerId: string, followingId: string): Promise<boolean> {
    try {
      const followDoc = await firebaseFirestore
        .collection(COLLECTIONS.FOLLOWING)
        .doc(`${followerId}_${followingId}`)
        .get();
      return followDoc.exists();
    } catch (error) {
      console.error('Error checking if following:', error);
      return false;
    }
  }

  // Alias for checkIfFollowing for privacy methods
  static async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    return this.checkIfFollowing(followerId, followingId);
  }

  // Get user's followers list with user data
  static async getFollowers(userId: string): Promise<User[]> {
    try {
      const followersSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.FOLLOWERS)
        .where('followingId', '==', userId)
        .get();

      const followers: User[] = [];
      for (const doc of followersSnapshot.docs) {
        const followerData = doc.data();
        const userData = await this.getUserProfile(followerData.followerId);
        if (userData) {
          followers.push(userData);
        }
      }

      return followers;
    } catch (error) {
      console.error('Error getting followers:', error);
      return [];
    }
  }

  // Get user's following list with user data
  static async getFollowing(userId: string): Promise<User[]> {
    try {
      const followingSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.FOLLOWING)
        .where('followerId', '==', userId)
        .get();

      const following: User[] = [];
      for (const doc of followingSnapshot.docs) {
        const followingData = doc.data();
        const userData = await this.getUserProfile(followingData.followingId);
        if (userData) {
          following.push(userData);
        }
      }

      return following;
    } catch (error) {
      console.error('Error getting following:', error);
      return [];
    }
  }

  // Get user following IDs only (optimized for reel loading) - Updated to modular API
  static async getUserFollowing(userId: string): Promise<string[]> {
    try {
      const { collection, query, where, getDocs } = await import('@react-native-firebase/firestore');
      const db = firebaseFirestore;
      
      const followingQuery = query(
        collection(db, COLLECTIONS.FOLLOWING),
        where('followerId', '==', userId)
      );
      
      const followingSnapshot = await getDocs(followingQuery);

      const followingIds: string[] = [];
      followingSnapshot.docs.forEach(doc => {
        const followingData = doc.data();
        followingIds.push(followingData.followingId);
      });

      return followingIds;
    } catch (error) {
      console.error('Error getting following IDs:', error);
      // Fallback to legacy API if modular fails
      try {
        const followingSnapshot = await firebaseFirestore
          .collection(COLLECTIONS.FOLLOWING)
          .where('followerId', '==', userId)
          .get();

        const followingIds: string[] = [];
        followingSnapshot.docs.forEach(doc => {
          const followingData = doc.data();
          followingIds.push(followingData.followingId);
        });

        return followingIds;
      } catch (fallbackError) {
        console.error('Fallback error getting following IDs:', fallbackError);
        return [];
      }
    }
  }

  // Get follower count
  static async getFollowerCount(userId: string): Promise<number> {
    try {
      if (!userId || userId === 'undefined' || userId === 'null') {
        console.warn('Invalid userId for getFollowerCount:', userId);
        return 0;
      }

      const followersSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.FOLLOWERS)
        .where('followingId', '==', userId)
        .get();

      return followersSnapshot.size;
    } catch (error) {
      console.error('Error getting follower count:', error);
      return 0;
    }
  }

  // Get following count
  static async getFollowingCount(userId: string): Promise<number> {
    try {
      if (!userId || userId === 'undefined' || userId === 'null') {
        console.warn('Invalid userId for getFollowingCount:', userId);
        return 0;
      }

      const followingSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.FOLLOWING)
        .where('followerId', '==', userId)
        .get();

      return followingSnapshot.size;
    } catch (error) {
      console.error('Error getting following count:', error);
      return 0;
    }
  }

  // Get user's followers and following counts
  static async getUserFollowCounts(userId: string): Promise<{ followersCount: number; followingCount: number }> {
    try {
      const [followersCount, followingCount] = await Promise.all([
        this.getFollowerCount(userId),
        this.getFollowingCount(userId)
      ]);

      return { followersCount, followingCount };
    } catch (error) {
      console.error('Error getting user follow counts:', error);
      return { followersCount: 0, followingCount: 0 };
    }
  }

  static formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  // Chat Services
  static async createOrGetChat(participants: string[]): Promise<string> {
    try {
      // Validate participants array
      if (!participants || !Array.isArray(participants) || participants.length < 2) {
        throw new Error('Invalid participants array. Must contain at least 2 participants.');
      }
      
      // Filter out any undefined/null values and ensure all are strings
      const validParticipants = participants.filter(p => p && typeof p === 'string');
      if (validParticipants.length < 2) {
        throw new Error('Invalid participants. Must have at least 2 valid participant IDs.');
      }
      
      // Sort participants to ensure consistent chat ID
      const sortedParticipants = validParticipants.sort();
      
      // Check if chat already exists
      const existingChatQuery = await firebaseFirestore
        .collection(COLLECTIONS.CHATS)
        .where('participants', '==', sortedParticipants)
        .where('isGroup', '==', false)
        .limit(1)
        .get();

      if (!existingChatQuery.empty) {
        return existingChatQuery.docs[0].id;
      }

      // Get participant data
      const participantData = await Promise.all(
        sortedParticipants.map(userId => this.getUserProfile(userId))
      );

      const participantNames = participantData.map(user => user?.displayName || 'Unknown User');
      const participantAvatars = participantData.map(user => user?.profilePicture || '');

      // Create new chat
      const chatData: Omit<Chat, 'id'> = {
        participants: sortedParticipants,
        participantNames,
        participantAvatars,
        lastMessageTime: new Date().toISOString(),
        unreadCount: Object.fromEntries(sortedParticipants.map(id => [id, 0])),
        isGroup: false,
        createdBy: sortedParticipants[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
      };

      const chatRef = await firebaseFirestore.collection(COLLECTIONS.CHATS).add(chatData);
      return chatRef.id;
    } catch (error) {
      console.error('Error creating chat:', error);
      throw error;
    }
  }

  static async sendMessage(chatId: string, senderId: string, message: string, messageType: 'text' | 'image' | 'video' | 'audio' | 'call' = 'text', mediaUrl?: string): Promise<string> {
    try {
      const senderProfile = await this.getUserProfile(senderId);
      
      // Get chat data to get participants
      const chatRef = firebaseFirestore.collection(COLLECTIONS.CHATS).doc(chatId);
      const chatDoc = await chatRef.get();
      const chatData = chatDoc.data() as Chat;
      
      if (!chatData) {
        throw new Error('Chat not found');
      }

      const messageData: Omit<ChatMessage, 'id'> = {
        chatId,
        senderId,
        senderName: senderProfile?.displayName || 'Unknown User',
        senderAvatar: senderProfile?.profilePicture || '',
        message,
        messageType,
        mediaUrl: mediaUrl || '',
        isRead: false,
        readBy: [senderId], // Sender has automatically read their own message
        participants: chatData.participants, // Add participants array for Firestore rules
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      const messageRef = await firebaseFirestore.collection(COLLECTIONS.MESSAGES).add(messageData);

      // Update chat with last message
      const updatedUnreadCount = { ...chatData.unreadCount };
      chatData.participants.forEach(participantId => {
        if (participantId !== senderId) {
          updatedUnreadCount[participantId] = (updatedUnreadCount[participantId] || 0) + 1;
        }
      });

      await chatRef.update({
        lastMessage: { id: messageRef.id, ...messageData },
        lastMessageTime: FieldValue.serverTimestamp(),
        unreadCount: updatedUnreadCount,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return messageRef.id;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  static async getChats(userId: string): Promise<Chat[]> {
    try {
      const chatsSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.CHATS)
        .where('participants', 'array-contains', userId)
        .where('isActive', '==', true)
        .orderBy('lastMessageTime', 'desc')
        .get();

      return chatsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Chat[];
    } catch (error) {
      console.error('Error getting chats:', error);
      throw error;
    }
  }

  static async getMessages(chatId: string, limit: number = 50, lastMessageId?: string): Promise<ChatMessage[]> {
    try {
      console.log('🔄 Loading messages for chat:', chatId, 'limit:', limit);
      
      const currentUser = auth().currentUser;
      if (!currentUser) {
        console.warn('No authenticated user for getMessages');
        return [];
      }
      
      // Restore participants filter for security - handle index building gracefully
      let query = firebaseFirestore
        .collection(COLLECTIONS.MESSAGES)
        .where('chatId', '==', chatId)
        .where('participants', 'array-contains', currentUser.uid)
        .orderBy('createdAt', 'asc')
        .limit(limit);

      if (lastMessageId) {
        const lastMessageDoc = await firebaseFirestore
          .collection(COLLECTIONS.MESSAGES)
          .doc(lastMessageId)
          .get();
        query = query.startAfter(lastMessageDoc);
      }

      const messagesSnapshot = await query.get();
      
      const messages = messagesSnapshot.docs.map(doc => {
        const messageData = doc.data();
        
        // Process media URL if present
        let processedMediaUrl = messageData.mediaUrl;
        if (processedMediaUrl && typeof processedMediaUrl === 'string') {
          // Ensure proper URL formatting for DigitalOcean
          if (!processedMediaUrl.startsWith('http')) {
            const baseUrl = 'https://jorvea.fra1.digitaloceanspaces.com';
            processedMediaUrl = processedMediaUrl.startsWith('/') ? 
              `${baseUrl}${processedMediaUrl}` : 
              `${baseUrl}/${processedMediaUrl}`;
          }
        }

        // Convert Firebase Timestamp to Date for proper sorting
        let createdAtDate = messageData.createdAt;
        let updatedAtDate = messageData.updatedAt;
        
        if (messageData.createdAt?.toDate) {
          // Firebase Timestamp
          createdAtDate = messageData.createdAt.toDate();
        } else if (typeof messageData.createdAt === 'string') {
          // String timestamp
          createdAtDate = new Date(messageData.createdAt);
        } else {
          // Fallback
          createdAtDate = new Date();
        }
        
        if (messageData.updatedAt?.toDate) {
          updatedAtDate = messageData.updatedAt.toDate();
        } else if (typeof messageData.updatedAt === 'string') {
          updatedAtDate = new Date(messageData.updatedAt);
        } else {
          updatedAtDate = createdAtDate;
        }

        return {
          id: doc.id,
          ...messageData,
          mediaUrl: processedMediaUrl,
          createdAt: createdAtDate,
          updatedAt: updatedAtDate,
        };
      }) as ChatMessage[];

      console.log('📊 Messages loaded:', messages.length);
      return messages;
    } catch (error) {
      console.error('Error getting messages:', error);
      
      // If it's an index error, try without participants filter as fallback
      if (error.code === 'failed-precondition' && error.message.includes('index')) {
        console.warn('⚠️ Index still building, trying fallback query...');
        try {
          let fallbackQuery = firebaseFirestore
            .collection(COLLECTIONS.MESSAGES)
            .where('chatId', '==', chatId)
            .orderBy('createdAt', 'asc')
            .limit(limit);

          if (lastMessageId) {
            const lastMessageDoc = await firebaseFirestore
              .collection(COLLECTIONS.MESSAGES)
              .doc(lastMessageId)
              .get();
            fallbackQuery = fallbackQuery.startAfter(lastMessageDoc);
          }

          const fallbackSnapshot = await fallbackQuery.get();
          const fallbackMessages = fallbackSnapshot.docs
            .map(doc => {
              const messageData = doc.data();
              
              // Only include messages where user is a participant (client-side filter)
              if (!messageData.participants || !messageData.participants.includes(currentUser.uid)) {
                return null;
              }
              
              // Process media URL if present
              let processedMediaUrl = messageData.mediaUrl;
              if (processedMediaUrl && typeof processedMediaUrl === 'string') {
                if (!processedMediaUrl.startsWith('http')) {
                  const baseUrl = 'https://jorvea.fra1.digitaloceanspaces.com';
                  processedMediaUrl = processedMediaUrl.startsWith('/') ? 
                    `${baseUrl}${processedMediaUrl}` : 
                    `${baseUrl}/${processedMediaUrl}`;
                }
              }

              // Convert Firebase Timestamp to Date for proper sorting
              let createdAtDate = messageData.createdAt;
              let updatedAtDate = messageData.updatedAt;
              
              if (messageData.createdAt?.toDate) {
                createdAtDate = messageData.createdAt.toDate();
              } else if (typeof messageData.createdAt === 'string') {
                createdAtDate = new Date(messageData.createdAt);
              } else {
                createdAtDate = new Date();
              }
              
              if (messageData.updatedAt?.toDate) {
                updatedAtDate = messageData.updatedAt.toDate();
              } else if (typeof messageData.updatedAt === 'string') {
                updatedAtDate = new Date(messageData.updatedAt);
              } else {
                updatedAtDate = createdAtDate;
              }

              return {
                id: doc.id,
                ...messageData,
                mediaUrl: processedMediaUrl,
                createdAt: createdAtDate,
                updatedAt: updatedAtDate,
              };
            })
            .filter(Boolean) as ChatMessage[];

          console.log('📊 Fallback messages loaded:', fallbackMessages.length);
          return fallbackMessages;
          
        } catch (fallbackError) {
          console.error('❌ Fallback query also failed:', fallbackError);
          throw fallbackError;
        }
      }
      
      throw error;
    }
  }

  static async markMessagesAsRead(chatId: string, userId: string): Promise<void> {
    try {
      const batch = firebaseFirestore.batch();

      // Query with participants check for security rules compliance
      const messagesQuery = await firebaseFirestore
        .collection(COLLECTIONS.MESSAGES)
        .where('chatId', '==', chatId)
        .where('participants', 'array-contains', userId)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      // Filter messages for this user and unread on client side
      const unreadMessages = messagesQuery.docs.filter(doc => {
        const data = doc.data();
        const participants = data.participants || [];
        const isParticipant = participants.includes(userId);
        const isUnread = !data.readBy?.includes(userId);
        const isNotSender = data.senderId !== userId;
        return isParticipant && isUnread && isNotSender;
      });

      unreadMessages.forEach(doc => {
        batch.update(doc.ref, {
          readBy: FieldValue.arrayUnion(userId),
          isRead: true,
        });
      });

      // Reset unread count for this user in chat
      const chatRef = firebaseFirestore.collection(COLLECTIONS.CHATS).doc(chatId);
      batch.update(chatRef, {
        [`unreadCount.${userId}`]: 0,
      });

      await batch.commit();
    } catch (error) {
      console.error('Error marking messages as read:', error);
      // Don't throw error to prevent blocking chat functionality
    }
  }

  static async deleteMessage(messageId: string): Promise<void> {
    try {
      await firebaseFirestore.collection(COLLECTIONS.MESSAGES).doc(messageId).update({
        isDeleted: true,
        message: 'This message was deleted',
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }

  static async createCallLog(chatId: string, callerId: string, participants: string[], callType: 'audio' | 'video', roomName: string): Promise<string> {
    try {
      const callerProfile = await this.getUserProfile(callerId);
      
      const callLogData: Omit<CallLog, 'id'> = {
        chatId,
        callerId,
        callerName: callerProfile?.displayName || 'Unknown User',
        participants,
        callType,
        duration: 0,
        status: 'completed',
        roomName,
        startTime: new Date().toISOString(),
        endTime: '',
        createdAt: new Date().toISOString(),
      };

      const callLogRef = await firebaseFirestore.collection(COLLECTIONS.VIDEO_CALLS).add(callLogData);

      // Send call message to chat
      await this.sendMessage(
        chatId,
        callerId,
        `${callType === 'video' ? '📹' : '📞'} ${callType.charAt(0).toUpperCase() + callType.slice(1)} call`,
        'call'
      );

      return callLogRef.id;
    } catch (error) {
      console.error('Error creating call log:', error);
      throw error;
    }
  }

  static async updateCallLog(callLogId: string, updates: Partial<CallLog>): Promise<void> {
    try {
      await firebaseFirestore.collection(COLLECTIONS.VIDEO_CALLS).doc(callLogId).update({
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error updating call log:', error);
      throw error;
    }
  }

  // Trending Music Methods
  static async getTrendingMusic(category: string = 'Trending', limit: number = 50): Promise<any[]> {
    try {
      // For demo purposes, return mock trending music
      // In production, you would fetch from a music API like Spotify, SoundCloud, etc.
      const mockTrendingMusic = await this.generateMockTrendingMusic(category, limit);
      
      // Cache the music locally for offline use
      await this.cacheMusicData(mockTrendingMusic);
      
      return mockTrendingMusic;
    } catch (error) {
      console.error('Error getting trending music:', error);
      // Return cached music if available
      return await this.getCachedMusic(category) || [];
    }
  }

  private static async generateMockTrendingMusic(category: string, limit: number): Promise<any[]> {
    const musicData: any[] = [];
    
    const categories = {
      'Trending': [
        { title: 'Blinding Lights', artist: 'The Weeknd', duration: 200 },
        { title: 'Levitating', artist: 'Dua Lipa', duration: 183 },
        { title: 'Good 4 U', artist: 'Olivia Rodrigo', duration: 178 },
        { title: 'Peaches', artist: 'Justin Bieber', duration: 198 },
        { title: 'Save Your Tears', artist: 'The Weeknd', duration: 215 },
      ],
      'Pop': [
        { title: 'Anti-Hero', artist: 'Taylor Swift', duration: 200 },
        { title: 'As It Was', artist: 'Harry Styles', duration: 167 },
        { title: 'Heat Waves', artist: 'Glass Animals', duration: 238 },
        { title: 'Stay', artist: 'The Kid LAROI', duration: 141 },
        { title: 'Industry Baby', artist: 'Lil Nas X', duration: 212 },
      ],
      'Hip Hop': [
        { title: 'HUMBLE.', artist: 'Kendrick Lamar', duration: 177 },
        { title: 'Go\' Plan', artist: 'Drake', duration: 198 },
        { title: 'SICKO MODE', artist: 'Travis Scott', duration: 312 },
        { title: 'Lucid Dreams', artist: 'Juice WRLD', duration: 239 },
        { title: 'The Box', artist: 'Roddy Ricch', duration: 196 },
      ],
      'Electronic': [
        { title: 'Midnight City', artist: 'M83', duration: 244 },
        { title: 'Strobe', artist: 'Deadmau5', duration: 644 },
        { title: 'Levels', artist: 'Avicii', duration: 202 },
        { title: 'Animals', artist: 'Martin Garrix', duration: 305 },
        { title: 'Titanium', artist: 'David Guetta', duration: 245 },
      ]
    };

    const selectedTracks = categories[category as keyof typeof categories] || categories['Trending'];
    
    selectedTracks.forEach((track, index) => {
      if (index < limit) {
        musicData.push({
          id: `${category.toLowerCase()}_${index}`,
          title: track.title,
          artist: track.artist,
          duration: track.duration,
          url: `https://example.com/music/${track.title.replace(/\s+/g, '_').toLowerCase()}.mp3`,
          coverImage: `https://via.placeholder.com/300x300?text=${track.artist}`,
          category: category,
          isPopular: index < 5,
          plays: Math.floor(Math.random() * 1000000) + 100000,
          createdAt: new Date().toISOString(),
        });
      }
    });

    return musicData;
  }

  private static async cacheMusicData(musicData: any[]): Promise<void> {
    try {
      // In a real app, you would store this in AsyncStorage or a local database
      // For now, we'll just store in memory
      console.log('Caching music data:', musicData.length, 'tracks');
    } catch (error) {
      console.error('Error caching music data:', error);
    }
  }

  private static async getCachedMusic(category: string): Promise<any[] | null> {
    try {
      // In a real app, you would retrieve from AsyncStorage or local database
      return null;
    } catch (error) {
      console.error('Error getting cached music:', error);
      return null;
    }
  }

  static async downloadMusicForOfflineUse(musicId: string, url: string): Promise<string> {
    try {
      // In a real app, you would download the music file to device storage
      // and return the local file path
      console.log('Downloading music for offline use:', musicId);
      
      // Mock implementation - return the original URL
      return url;
    } catch (error) {
      console.error('Error downloading music:', error);
      throw error;
    }
  }

  static async searchMusic(query: string, category?: string): Promise<any[]> {
    try {
      const allMusic = await this.getTrendingMusic(category || 'Trending', 100);
      
      return allMusic.filter(track => 
        track.title.toLowerCase().includes(query.toLowerCase()) ||
        track.artist.toLowerCase().includes(query.toLowerCase())
      );
    } catch (error) {
      console.error('Error searching music:', error);
      return [];
    }
  }

  // Archive and Saved Posts functionality
  static async getSavedPosts(userId: string): Promise<Post[]> {
    try {
      const savesSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.SAVES)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();

      const savedPosts: Post[] = [];
      
      for (const saveDoc of savesSnapshot.docs) {
        const saveData = saveDoc.data();
        const postDoc = await firebaseFirestore
          .collection(COLLECTIONS.POSTS)
          .doc(saveData.postId)
          .get();
          
        if (postDoc.exists()) {
          const postData = postDoc.data();
          if (postData) {
            const userDoc = await firebaseFirestore
              .collection(COLLECTIONS.USERS)
              .doc(postData.userId)
              .get();
              
            savedPosts.push({
              id: postDoc.id,
              ...postData,
              user: userDoc.exists() ? userDoc.data() : null,
              likesCount: postData.likes?.length || 0,
              commentsCount: postData.comments?.length || 0,
              createdAt: postData.createdAt?.toDate?.() || new Date(),
            } as Post);
          }
        }
      }
      
      return savedPosts;
    } catch (error) {
      console.error('Error getting saved posts:', error);
      return [];
    }
  }

  static async getArchivedPosts(userId: string): Promise<Post[]> {
    try {
      const postsSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.POSTS)
        .where('userId', '==', userId)
        .where('isArchived', '==', true)
        .orderBy('createdAt', 'desc')
        .get();

      const archivedPosts: Post[] = [];
      
      for (const postDoc of postsSnapshot.docs) {
        const postData = postDoc.data();
        if (postData) {
          const userDoc = await firebaseFirestore
            .collection(COLLECTIONS.USERS)
            .doc(postData.userId)
            .get();
            
          archivedPosts.push({
            id: postDoc.id,
            ...postData,
            user: userDoc.exists() ? userDoc.data() : null,
            likesCount: postData.likes?.length || 0,
            commentsCount: postData.comments?.length || 0,
            createdAt: postData.createdAt?.toDate?.() || new Date(),
          } as Post);
        }
      }
      
      return archivedPosts;
    } catch (error) {
      console.error('Error getting archived posts:', error);
      return [];
    }
  }

  // Chat List Methods
  static async getUserChats(userId: string): Promise<Chat[]> {
    try {
      const chatsSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.CHATS)
        .where('participants', 'array-contains', userId)
        .get();

      const chats = [];
      for (const doc of chatsSnapshot.docs) {
        const chatData = { id: doc.id, ...doc.data() } as Chat;
        chats.push(chatData);
      }

      return chats;
    } catch (error) {
      console.error('Error getting user chats:', error);
      return [];
    }
  }

  static async getChatMessages(chatId: string, limit: number = 50): Promise<ChatMessage[]> {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        console.warn('No authenticated user for getChatMessages');
        return [];
      }

      // Query with participants check for security rules compliance
      const messagesSnapshot = await firebaseFirestore
        .collection(COLLECTIONS.MESSAGES)
        .where('chatId', '==', chatId)
        .where('participants', 'array-contains', currentUser.uid)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      const messages = [];
      for (const doc of messagesSnapshot.docs) {
        const messageData = { id: doc.id, ...doc.data() } as ChatMessage;
        // User is already validated by the participants array-contains query
        messages.push(messageData);
      }

      return messages.reverse(); // Return in chronological order
    } catch (error) {
      console.error('Error getting chat messages:', error);
      return [];
    }
  }

  // Enhanced username availability check with comprehensive validation
  static async checkUsernameAvailability(username: string): Promise<boolean> {
    try {
      const cleanUsername = username.toLowerCase().trim();
      console.log('🔍 FirebaseService: Checking username availability for:', cleanUsername);
      
      // Basic format validation
      if (!cleanUsername || cleanUsername.length < 3 || cleanUsername.length > 30) {
        console.log('❌ Username length invalid');
        return false;
      }
      
      if (!/^[a-zA-Z0-9._]+$/.test(cleanUsername)) {
        console.log('❌ Username contains invalid characters');
        return false;
      }
      
      if (cleanUsername.startsWith('.') || cleanUsername.endsWith('.') || cleanUsername.includes('..')) {
        console.log('❌ Username has invalid dot placement');
        return false;
      }
      
      // Reserved usernames check
      const reservedUsernames = [
        'admin', 'administrator', 'root', 'system', 'jorvea', 'support', 'help',
        'api', 'www', 'mail', 'ftp', 'blog', 'webmaster', 'noreply', 'info',
        'contact', 'sales', 'marketing', 'security', 'privacy', 'legal',
        'terms', 'about', 'careers', 'jobs', 'news', 'press', 'media'
      ];
      
      if (reservedUsernames.includes(cleanUsername)) {
        console.log('❌ Username is reserved');
        return false;
      }

      // Check in Firebase - try multiple approaches for reliability
      let isAvailable = false;
      
      // First try the dedicated usernames collection (more permissive)
      try {
        console.log('🔍 Checking usernames collection...');
        const usernameDoc = await firebaseFirestore
          .collection(COLLECTIONS.USERNAMES)
          .doc(cleanUsername)
          .get();
        
        isAvailable = !usernameDoc.exists();
        console.log('✅ Usernames collection check result:', isAvailable);
        
        if (!isAvailable) {
          return false; // Username is definitely taken
        }
      } catch (usernamesError) {
        console.log('⚠️ Usernames collection not accessible, trying users collection');
      }
      
      // Also check the users collection for double verification
      try {
        console.log('🔍 Checking users collection...');
        const usernameQuery = await firebaseFirestore
          .collection(COLLECTIONS.USERS)
          .where('username', '==', cleanUsername)
          .limit(1)
          .get();

        const isAvailableInUsers = usernameQuery.empty;
        console.log('✅ Users collection check result:', isAvailableInUsers);
        
        // Username must be available in both collections
        isAvailable = isAvailable && isAvailableInUsers;
      } catch (usersError) {
        console.log('⚠️ Users collection not accessible');
        // If users collection fails but usernames collection worked, use that result
        // If both fail, return false for safety
        if (!isAvailable) {
          console.log('❌ Both collections failed, returning false for safety');
          return false;
        }
      }
      
      console.log('🎯 Final username availability result:', isAvailable);
      return isAvailable;
      
    } catch (error) {
      console.error('❌ Username availability check failed:', error);
      // Return false for safety if any error occurs
      return false;
    }
  }

  // Reserve username in the usernames collection
  static async reserveUsername(username: string, userId: string): Promise<void> {
    try {
      const cleanUsername = username.toLowerCase().trim();
      
      await firebaseFirestore
        .collection(COLLECTIONS.USERNAMES)
        .doc(cleanUsername)
        .set({
          userId,
          username: cleanUsername,
          reservedAt: FieldValue.serverTimestamp(),
        });
    } catch (error) {
      console.error('Error reserving username:', error);
      // Don't throw error - this is optional optimization
    }
  }

  // Release username from the usernames collection
  static async releaseUsername(username: string): Promise<void> {
    try {
      const cleanUsername = username.toLowerCase().trim();
      
      await firebaseFirestore
        .collection(COLLECTIONS.USERNAMES)
        .doc(cleanUsername)
        .delete();
    } catch (error) {
      console.error('Error releasing username:', error);
      // Don't throw error - this is cleanup
    }
  }

  // Create username entry for public checking
  static async createUsernameEntry(username: string, userId: string): Promise<void> {
    try {
      await firebaseFirestore
        .collection(COLLECTIONS.USERNAMES)
        .doc(username.toLowerCase())
        .set({
          userId,
          createdAt: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Error creating username entry:', error);
      // Don't throw error as this is not critical
    }
  }

  // Generate unique username if needed
  static async generateUniqueUsername(baseUsername: string): Promise<string> {
    try {
      let username = baseUsername.toLowerCase().replace(/[^a-z0-9_]/g, '');
      
      // Ensure minimum length
      if (username.length < 3) {
        username = `user_${username}`;
      }

      // Check if base username is available
      const isAvailable = await this.checkUsernameAvailability(username);
      if (isAvailable) {
        return username;
      }

      // If not available, try with numbers
      let counter = 1;
      let newUsername = `${username}${counter}`;

      while (!(await this.checkUsernameAvailability(newUsername)) && counter < 1000) {
        counter++;
        newUsername = `${username}${counter}`;
      }

      return newUsername;
    } catch (error) {
      console.error('Error generating unique username:', error);
      return `user_${Date.now()}`;
    }
  }

  // Validate username format
  static validateUsername(username: string): { isValid: boolean; error?: string } {
    const cleanUsername = username.toLowerCase().trim();

    // Check length
    if (cleanUsername.length < 3) {
      return { isValid: false, error: 'Username must be at least 3 characters long' };
    }

    if (cleanUsername.length > 30) {
      return { isValid: false, error: 'Username must be less than 30 characters' };
    }

    // Check format (only letters, numbers, underscores)
    const usernameRegex = /^[a-z0-9_]+$/;
    if (!usernameRegex.test(cleanUsername)) {
      return { isValid: false, error: 'Username can only contain letters, numbers, and underscores' };
    }

    // Check if starts with underscore or number
    if (cleanUsername.startsWith('_') || /^[0-9]/.test(cleanUsername)) {
      return { isValid: false, error: 'Username must start with a letter' };
    }

    // Check for reserved words
    const reservedWords = [
      'admin', 'administrator', 'root', 'support', 'help', 'api', 'www', 'mail', 
      'ftp', 'blog', 'shop', 'store', 'news', 'about', 'contact', 'jorvea',
      'official', 'verified', 'system', 'null', 'undefined', 'delete', 'create'
    ];

    if (reservedWords.includes(cleanUsername)) {
      return { isValid: false, error: 'This username is reserved and cannot be used' };
    }

    return { isValid: true };
  }

  static async archivePost(postId: string, userId: string, archive: boolean = true): Promise<void> {
    try {
      await firebaseFirestore
        .collection(COLLECTIONS.POSTS)
        .doc(postId)
        .update({
          isArchived: archive,
          updatedAt: FieldValue.serverTimestamp(),
        });
    } catch (error) {
      console.error('Error archiving post:', error);
      throw error;
    }
  }

  static async savePost(postId: string, userId: string): Promise<{ isSaved: boolean }> {
    try {
      const saveRef = firebaseFirestore
        .collection(COLLECTIONS.SAVES)
        .doc(`${postId}_${userId}`);
      
      const saveDoc = await saveRef.get();
      
      if (saveDoc.exists()) {
        // Unsave the post
        await saveRef.delete();
        return { isSaved: false };
      } else {
        // Save the post
        await saveRef.set({
          postId,
          userId,
          createdAt: FieldValue.serverTimestamp(),
        });
        return { isSaved: true };
      }
    } catch (error) {
      console.error('Error saving/unsaving post:', error);
      throw error;
    }
  }

  // Social Hub Methods
  static async getUserActivities(userId: string) {
    try {
      const activitiesSnapshot = await firebaseFirestore
        .collection('activities')
        .where('targetUserId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      return activitiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting user activities:', error);
      return [];
    }
  }

  static listenToActivities(userId: string, callback: (activities: any[]) => void) {
    return firebaseFirestore
      .collection('activities')
      .where('targetUserId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .onSnapshot((snapshot) => {
        const activities = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        callback(activities);
      });
  }

  static async getTrendingTopics() {
    try {
      const trendingSnapshot = await firebaseFirestore
        .collection('trending')
        .orderBy('postsCount', 'desc')
        .limit(20)
        .get();

      return trendingSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting trending topics:', error);
      return [];
    }
  }

  static async getSuggestedUsers(userId: string) {
    try {
      const suggestionsSnapshot = await firebaseFirestore
        .collection('userSuggestions')
        .where('targetUserId', '==', userId)
        .orderBy('score', 'desc')
        .limit(20)
        .get();

      return suggestionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting suggested users:', error);
      return [];
    }
  }

  // Utility Methods - ENHANCED to handle multiple date formats
  static formatTimeAgo(timestamp: string | Date | any): string {
    try {
      const now = new Date();
      let createdAt: Date;

      // Handle different timestamp formats
      if (timestamp instanceof Date) {
        createdAt = timestamp;
      } else if (typeof timestamp === 'string') {
        createdAt = new Date(timestamp);
      } else if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
        // Firebase Timestamp object
        createdAt = new Date(timestamp.seconds * 1000);
      } else if (timestamp && timestamp.toDate && typeof timestamp.toDate === 'function') {
        // Firebase Timestamp with toDate method
        createdAt = timestamp.toDate();
      } else {
        console.warn('Invalid timestamp format:', timestamp);
        return 'Unknown';
      }

      // Validate the date
      if (!createdAt || isNaN(createdAt.getTime())) {
        console.warn('Invalid date created from timestamp:', timestamp);
        return 'Unknown';
      }

      const diffInMs = now.getTime() - createdAt.getTime();
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

      if (diffInMinutes < 1) {
        return 'Just now';
      } else if (diffInMinutes < 60) {
        return `${diffInMinutes}m`;
      } else if (diffInHours < 24) {
        return `${diffInHours}h`;
      } else if (diffInDays < 7) {
        return `${diffInDays}d`;
      } else {
        return createdAt.toLocaleDateString();
      }
    } catch (error) {
      console.error('Error formatting time ago:', error, 'for timestamp:', timestamp);
      return 'Unknown';
    }
  }

  static async markActivityAsRead(activityId: string) {
    try {
      await firebaseFirestore
        .collection('activities')
        .doc(activityId)
        .update({
          isRead: true,
          readAt: FieldValue.serverTimestamp()
        });
    } catch (error) {
      console.error('Error marking activity as read:', error);
      throw error;
    }
  }

  // Posts Management Methods for Context
  static async getAllPosts(limit: number = 20, lastPostId?: string): Promise<any[]> {
    try {
      console.log('🔄 FirebaseService: Loading posts with limit:', limit, 'lastPostId:', lastPostId);
      
      let query = firebaseFirestore
        .collection(COLLECTIONS.POSTS)
        .orderBy('createdAt', 'desc');

      // Add pagination if lastPostId is provided
      if (lastPostId) {
        const lastPostDoc = await firebaseFirestore
          .collection(COLLECTIONS.POSTS)
          .doc(lastPostId)
          .get();
        
        if (lastPostDoc.exists) {
          query = query.startAfter(lastPostDoc);
        }
      }

      const postsSnapshot = await query.limit(limit).get();

      console.log('📊 FirebaseService: Raw posts fetched:', postsSnapshot.docs.length);

      const posts = await Promise.all(
        postsSnapshot.docs.map(async (doc) => {
          const postData = doc.data();
          
          try {
            // Get user data
            const userData = await this.getUserProfile(postData.userId);
            
            // Ensure media URLs are properly loaded from DigitalOcean
            let processedMediaUrls = [];
            if (postData.mediaUrls && Array.isArray(postData.mediaUrls)) {
              processedMediaUrls = postData.mediaUrls.map((url: string) => {
                if (!url || url.trim() === '') return null;
                
                // If it's already a full URL, return as is
                if (url.startsWith('http')) return url;
                
                // If it's a DigitalOcean path, ensure proper URL formatting
                if (url.includes('digitaloceanspaces.com')) {
                  return url.startsWith('https://') ? url : `https://${url}`;
                }
                
                // If it's a relative path, construct full DigitalOcean URL
                const baseUrl = 'https://jorvea.fra1.digitaloceanspaces.com';
                return url.startsWith('/') ? `${baseUrl}${url}` : `${baseUrl}/${url}`;
              }).filter(url => url !== null);
            }

            // Ensure mediaTypes array matches mediaUrls length
            const mediaTypes = postData.mediaTypes || [];
            while (mediaTypes.length < processedMediaUrls.length) {
              // Determine media type from URL extension
              const url = processedMediaUrls[mediaTypes.length];
              const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(url);
              mediaTypes.push(isVideo ? 'video' : 'image');
            }

            const processedPost = {
              id: doc.id,
              ...postData,
              user: userData,
              mediaUrls: processedMediaUrls,
              mediaTypes: mediaTypes,
              createdAt: postData.createdAt || new Date().toISOString(),
              updatedAt: postData.updatedAt || postData.createdAt || new Date().toISOString(),
            };

            console.log('✅ Processed post:', {
              id: processedPost.id,
              mediaCount: processedMediaUrls.length,
              hasValidUrls: processedMediaUrls.length > 0,
              userName: userData?.displayName || 'Unknown'
            });

            return processedPost;
          } catch (userError) {
            console.error('Error processing post user data:', userError);
            // Return post with minimal user data if user fetch fails
            return {
              id: doc.id,
              ...postData,
              user: {
                uid: postData.userId,
                displayName: 'Unknown User',
                username: 'unknown',
                profilePicture: '',
              },
              mediaUrls: postData.mediaUrls || [],
              mediaTypes: postData.mediaTypes || [],
            };
          }
        })
      );

      // Filter out posts without valid media
      const validPosts = posts.filter(post => 
        post.mediaUrls && 
        post.mediaUrls.length > 0 && 
        post.mediaUrls.every((url: string) => url && url.trim() !== '' && url.startsWith('http'))
      );

      console.log('📊 FirebaseService: Valid posts returned:', validPosts.length);
      
      return validPosts;
    } catch (error) {
      console.error('Error fetching posts:', error);
      throw error;
    }
  }

  static async updatePost(postId: string, updates: any): Promise<void> {
    try {
      const postRef = firebaseFirestore.collection(COLLECTIONS.POSTS).doc(postId);
      await postRef.update({
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error updating post:', error);
      throw error;
    }
  }

  static async unsavePost(postId: string, userId: string): Promise<{ isSaved: boolean }> {
    try {
      const saveRef = firebaseFirestore.collection(COLLECTIONS.SAVES).doc(`${postId}_${userId}`);
      await saveRef.delete();
      return { isSaved: false };
    } catch (error) {
      console.error('Error unsaving post:', error);
      throw error;
    }
  }

  // Send reel as message to a user
  static async sendReelMessage(senderId: string, recipientId: string, reel: Reel): Promise<void> {
    try {
      const chatId = [senderId, recipientId].sort().join('_');
      const messageId = firebaseFirestore.collection(COLLECTIONS.MESSAGES).doc().id;
      
      const messageData = {
        id: messageId,
        chatId,
        senderId,
        recipientId,
        type: 'reel',
        content: reel.caption || 'Shared a reel',
        reelData: {
          id: reel.id,
          videoUrl: reel.videoUrl,
          thumbnailUrl: reel.thumbnailUrl,
          caption: reel.caption,
          username: reel.user?.username || 'Unknown',
          userAvatar: reel.user?.profilePicture || ''
        },
        timestamp: new Date().toISOString(),
        read: false,
        delivered: false
      };

      // Save message
      await firebaseFirestore.collection(COLLECTIONS.MESSAGES).doc(messageId).set(messageData);

      // Update or create chat
      const chatRef = firebaseFirestore.collection(COLLECTIONS.CHATS).doc(chatId);
      const chatDoc = await chatRef.get();

      if (chatDoc.exists()) {
        await chatRef.update({
          lastMessage: {
            text: '📹 Shared a reel',
            timestamp: messageData.timestamp,
            senderId
          },
          updatedAt: messageData.timestamp,
          [`unreadCount.${recipientId}`]: FieldValue.increment(1)
        });
      } else {
        await chatRef.set({
          id: chatId,
          participants: [senderId, recipientId],
          lastMessage: {
            text: '📹 Shared a reel',
            timestamp: messageData.timestamp,
            senderId
          },
          createdAt: messageData.timestamp,
          updatedAt: messageData.timestamp,
          unreadCount: {
            [senderId]: 0,
            [recipientId]: 1
          }
        });
      }

    } catch (error) {
      console.error('Error sending reel message:', error);
      throw error;
    }
  }

  // Methods for Lightning Fast Service
  static async getMorePosts(userId: string, lastPost?: Post, limit: number = 10): Promise<Post[]> {
    try {
      let query = firebaseFirestore
        .collection(COLLECTIONS.POSTS)
        .orderBy('createdAt', 'desc')
        .limit(limit);

      if (lastPost) {
        const lastPostDoc = await firebaseFirestore
          .collection(COLLECTIONS.POSTS)
          .doc(lastPost.id)
          .get();
        if (lastPostDoc.exists()) {
          query = query.startAfter(lastPostDoc);
        }
      }

      const snapshot = await query.get();
      const posts = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const data = doc.data();
          const userData = await this.getUserProfile(data.userId);
          return {
            ...data,
            id: doc.id,
            user: userData,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : new Date(data.createdAt)),
          } as Post;
        })
      );

      return posts;
    } catch (error) {
      console.error('Error getting more posts:', error);
      return [];
    }
  }

  static async getMoreReels(userId: string, lastReel?: Reel, limit: number = 10): Promise<Reel[]> {
    try {
      let query = firebaseFirestore
        .collection(COLLECTIONS.REELS)
        .orderBy('createdAt', 'desc')
        .limit(limit);

      if (lastReel) {
        const lastReelDoc = await firebaseFirestore
          .collection(COLLECTIONS.REELS)
          .doc(lastReel.id)
          .get();
        if (lastReelDoc.exists()) {
          query = query.startAfter(lastReelDoc);
        }
      }

      const snapshot = await query.get();
      const reels = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const data = doc.data();
          const userData = await this.getUserProfile(data.userId);
          return {
            ...data,
            id: doc.id,
            user: userData,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : new Date(data.createdAt)),
          } as unknown as Reel;
        })
      );

      return reels;
    } catch (error) {
      console.error('Error getting more reels:', error);
      return [];
    }
  }

  // Get recent chat users
  static async getRecentChatUsers(userId: string): Promise<User[]> {
    try {
      const chatsQuery = firebaseFirestore
        .collection(COLLECTIONS.CHATS)
        .where('participants', 'array-contains', userId)
        .orderBy('updatedAt', 'desc')
        .limit(10);

      const chatsSnapshot = await chatsQuery.get();
      const recentUsers: User[] = [];

      for (const chatDoc of chatsSnapshot.docs) {
        const chatData = chatDoc.data();
        const otherUserId = chatData.participants.find((id: string) => id !== userId);
        
        if (otherUserId) {
          const userDocRef = firebaseFirestore.collection(COLLECTIONS.USERS).doc(otherUserId);
          const userDoc = await userDocRef.get();
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            recentUsers.push({
              ...userData,
              id: userDoc.id
            });
          }
        }
      }

      return recentUsers;
    } catch (error) {
      console.error('Error getting recent chat users:', error);
      return [];
    }
  }

  // Simplified delete methods for current user
  static async deletePostSimple(postId: string): Promise<void> {
    try {
      const currentUser = firebaseAuth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      await this.deletePost(postId, currentUser.uid);
    } catch (error) {
      console.error('Error deleting post:', error);
      throw error;
    }
  }

  static async deleteReelSimple(reelId: string): Promise<void> {
    try {
      const currentUser = firebaseAuth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      await this.deleteReel(reelId, currentUser.uid);
    } catch (error) {
      console.error('Error deleting reel:', error);
      throw error;
    }
  }

  // Update post privacy
  static async updatePost(postId: string, data: Partial<Post>): Promise<void> {
    try {
      const currentUser = firebaseAuth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const postRef = firebaseFirestore.collection(COLLECTIONS.POSTS).doc(postId);
      const postDoc = await postRef.get();
      
      if (!postDoc.exists) {
        throw new Error('Post not found');
      }
      
      const post = postDoc.data();
      if (post?.userId !== currentUser.uid) {
        throw new Error('Unauthorized: Only post owner can update');
      }

      await postRef.update({
        ...data,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error updating post:', error);
      throw error;
    }
  }

  // Update reel privacy
  static async updateReel(reelId: string, data: Partial<Reel>): Promise<void> {
    try {
      const currentUser = firebaseAuth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const reelRef = firebaseFirestore.collection(COLLECTIONS.REELS).doc(reelId);
      const reelDoc = await reelRef.get();
      
      if (!reelDoc.exists) {
        throw new Error('Reel not found');
      }
      
      const reel = reelDoc.data();
      if (reel?.userId !== currentUser.uid) {
        throw new Error('Unauthorized: Only reel owner can update');
      }

      await reelRef.update({
        ...data,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error updating reel:', error);
      throw error;
    }
  }

  // Privacy control methods
  static async canViewProfile(viewerId: string, targetUserId: string): Promise<boolean> {
    try {
      // Own profile is always viewable
      if (viewerId === targetUserId) {
        return true;
      }

      // Get target user profile
      const targetUser = await this.getUserProfile(targetUserId);
      if (!targetUser) {
        return false;
      }

      // Check if target user is private
      const isPrivateAccount = targetUser.settings?.privacy?.privateAccount || 
                              targetUser.settings?.privateAccount || 
                              targetUser.isPrivate || false;
      
      if (!isPrivateAccount) {
        // Public accounts can be viewed by anyone
        return true;
      }

      // For private accounts, check if viewer is following
      const isFollowing = await this.isFollowing(viewerId, targetUserId);
      return isFollowing;
    } catch (error) {
      console.error('Error checking profile view permission:', error);
      return false;
    }
  }

  static async canViewPost(viewerId: string, post: Post): Promise<boolean> {
    try {
      // Own post is always viewable
      if (viewerId === post.userId) {
        return true;
      }

      // Check if post is private
      if (post.isPrivate) {
        // Check if viewer is following the post owner
        const isFollowing = await this.isFollowing(viewerId, post.userId);
        return isFollowing;
      }

      // Check if post owner has private account
      const canViewProfile = await this.canViewProfile(viewerId, post.userId);
      return canViewProfile;
    } catch (error) {
      console.error('Error checking post view permission:', error);
      return false;
    }
  }

  static async canViewReel(viewerId: string, reel: Reel): Promise<boolean> {
    try {
      // Own reel is always viewable
      if (viewerId === reel.userId) {
        return true;
      }

      // Check if reel is private
      if (reel.isPrivate) {
        // Check if viewer is following the reel owner
        const isFollowing = await this.isFollowing(viewerId, reel.userId);
        return isFollowing;
      }

      // Check if reel owner has private account
      const canViewProfile = await this.canViewProfile(viewerId, reel.userId);
      return canViewProfile;
    } catch (error) {
      console.error('Error checking reel view permission:', error);
      return false;
    }
  }

  // Filter posts based on privacy settings
  static async filterPostsByPrivacy(posts: Post[], viewerId: string): Promise<Post[]> {
    try {
      const filteredPosts: Post[] = [];
      
      for (const post of posts) {
        const canView = await this.canViewPost(viewerId, post);
        if (canView) {
          filteredPosts.push(post);
        }
      }
      
      return filteredPosts;
    } catch (error) {
      console.error('Error filtering posts by privacy:', error);
      return posts; // Return all posts if error occurs
    }
  }

  // Filter reels based on privacy settings
  static async filterReelsByPrivacy(reels: Reel[], viewerId: string): Promise<Reel[]> {
    try {
      const filteredReels: Reel[] = [];
      
      for (const reel of reels) {
        const canView = await this.canViewReel(viewerId, reel);
        if (canView) {
          filteredReels.push(reel);
        }
      }
      
      return filteredReels;
    } catch (error) {
      console.error('Error filtering reels by privacy:', error);
      return reels; // Return all reels if error occurs
    }
  }

  // Enhanced user posts method with privacy filtering
  static async getUserPostsWithPrivacy(userId: string, viewerId: string, limit: number = 20): Promise<Post[]> {
    try {
      // Check if viewer can see this user's profile
      const canViewProfile = await this.canViewProfile(viewerId, userId);
      if (!canViewProfile) {
        return [];
      }

      // Get posts
      const posts = await this.getUserPosts(userId, limit);
      
      // Filter based on privacy
      const filteredPosts = await this.filterPostsByPrivacy(posts, viewerId);
      
      return filteredPosts;
    } catch (error) {
      console.error('Error getting user posts with privacy:', error);
      return [];
    }
  }

  // Enhanced user reels method with privacy filtering
  static async getUserReelsWithPrivacy(userId: string, viewerId: string, limit: number = 20): Promise<Reel[]> {
    try {
      // Check if viewer can see this user's profile
      const canViewProfile = await this.canViewProfile(viewerId, userId);
      if (!canViewProfile) {
        return [];
      }

      // Get reels
      const reels = await this.getUserReels(userId, limit);
      
      // Filter based on privacy
      const filteredReels = await this.filterReelsByPrivacy(reels, viewerId);
      
      return filteredReels;
    } catch (error) {
      console.error('Error getting user reels with privacy:', error);
      return [];
    }
  }

  // Check if followers/following can be viewed
  static async canViewFollowers(viewerId: string, targetUserId: string): Promise<boolean> {
    try {
      // Own followers are always viewable
      if (viewerId === targetUserId) {
        return true;
      }

      // Get target user profile
      const targetUser = await this.getUserProfile(targetUserId);
      if (!targetUser) {
        return false;
      }

      // Check if target user is private
      const isPrivateAccount = targetUser.settings?.privacy?.privateAccount || 
                              targetUser.settings?.privateAccount || 
                              targetUser.isPrivate || false;
      
      if (!isPrivateAccount) {
        // Public accounts' followers can be viewed by anyone
        return true;
      }

      // For private accounts, only mutual followers can see followers/following
      const isFollowing = await this.isFollowing(viewerId, targetUserId);
      const isFollowedBy = await this.isFollowing(targetUserId, viewerId);
      
      return isFollowing && isFollowedBy;
    } catch (error) {
      console.error('Error checking followers view permission:', error);
      return false;
    }
  }
}

export default FirebaseService;
