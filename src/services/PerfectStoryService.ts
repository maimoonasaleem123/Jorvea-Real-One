import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';
import { Alert } from 'react-native';
import DigitalOceanService from './digitalOceanService';
import { digitalOceanSpaces } from '../config/digitalOcean';

interface StoryData {
  userId: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  storageLocation: 'digitalocean' | 'firebase';
  duration: number;
  texts?: any[];
  stickers?: any[];
  width?: number;
  height?: number;
}

interface PerfectStory {
  id: string;
  userId: string;
  username: string;
  userAvatar: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  storageLocation: 'digitalocean' | 'firebase';
  digitalOceanKey?: string; // For deletion tracking
  firebaseStoragePath?: string; // For deletion tracking
  duration: number;
  texts?: any[];
  stickers?: any[];
  width?: number;
  height?: number;
  viewsCount: number;
  viewedBy: string[];
  likesCount: number;
  likedBy: string[];
  createdAt: string;
  expiresAt: string;
  isExpired: boolean;
  isViewed?: boolean; // Runtime property for current user
}

/**
 * PerfectStoryService - Complete story system with cloud storage and auto-deletion
 * 
 * Features:
 * - Videos stored in DigitalOcean Spaces
 * - Images stored in Firebase Storage  
 * - Metadata stored in Firebase Firestore
 * - Automatic 24-hour deletion via Cloud Functions
 * - Perfect performance and reliability
 */
export class PerfectStoryService {
  private static readonly COLLECTION_STORIES = 'stories';
  private static readonly COLLECTION_STORY_DELETION_QUEUE = 'story_deletion_queue';

  /**
   * Upload image to Firebase Storage (for smaller files)
   */
  static async uploadImageToFirebase(imageUri: string, userId: string): Promise<string> {
    try {
      console.log('📤 Uploading image to Firebase Storage...');
      
      const timestamp = Date.now();
      const filename = `stories/images/${userId}/${timestamp}.jpg`;
      const reference = storage().ref(filename);

      // Upload file
      await reference.putFile(imageUri);
      
      // Get download URL
      const downloadURL = await reference.getDownloadURL();
      
      console.log('✅ Image uploaded to Firebase:', downloadURL);
      return downloadURL;
    } catch (error) {
      console.error('❌ Error uploading image to Firebase:', error);
      throw new Error('Failed to upload image to Firebase Storage');
    }
  }

  /**
   * Create a perfect story with cloud storage and auto-deletion
   */
  static async createPerfectStory(storyData: StoryData): Promise<string> {
    try {
      console.log('🎬 Creating perfect story...');
      
      const currentUser = auth().currentUser;
      if (!currentUser) {
        throw new Error('User must be authenticated');
      }

      // Get user data for story display
      const userDoc = await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .get();
      
      const userData = userDoc.data();
      if (!userData) {
        throw new Error('User data not found');
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

      // Extract storage keys for deletion tracking
      let digitalOceanKey: string | undefined;
      let firebaseStoragePath: string | undefined;

      if (storyData.storageLocation === 'digitalocean') {
        // Extract key from DigitalOcean URL
        try {
          const url = new URL(storyData.mediaUrl);
          digitalOceanKey = url.pathname.substring(1); // Remove leading slash
        } catch (error) {
          console.warn('Could not extract DigitalOcean key from URL');
        }
      } else if (storyData.storageLocation === 'firebase') {
        // Extract path from Firebase Storage URL
        try {
          const decodedUrl = decodeURIComponent(storyData.mediaUrl);
          const pathMatch = decodedUrl.match(/stories\/images\/[^?]+/);
          if (pathMatch) {
            firebaseStoragePath = pathMatch[0];
          }
        } catch (error) {
          console.warn('Could not extract Firebase storage path from URL');
        }
      }

      // Create story document
      const storyDoc: Omit<PerfectStory, 'id'> = {
        userId: currentUser.uid,
        username: userData.username || userData.displayName || 'Anonymous',
        userAvatar: userData.profilePicture || userData.photoURL || '',
        mediaUrl: storyData.mediaUrl,
        mediaType: storyData.mediaType,
        storageLocation: storyData.storageLocation,
        digitalOceanKey,
        firebaseStoragePath,
        duration: storyData.duration,
        texts: storyData.texts || [],
        stickers: storyData.stickers || [],
        width: storyData.width,
        height: storyData.height,
        viewsCount: 0,
        viewedBy: [],
        likesCount: 0,
        likedBy: [],
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        isExpired: false,
      };

      // Save story to Firestore
      const storyRef = await firestore()
        .collection(this.COLLECTION_STORIES)
        .add(storyDoc);

      console.log('✅ Story created with ID:', storyRef.id);

      // Schedule deletion (Cloud Function will handle this)
      await this.scheduleStoryDeletion(storyRef.id, expiresAt, storyDoc);

      // Update user's last story timestamp
      await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .update({
          lastStoryAt: now.toISOString(),
          storiesCount: firestore.FieldValue.increment(1),
        });

      return storyRef.id;
    } catch (error) {
      console.error('❌ Error creating perfect story:', error);
      throw error;
    }
  }

  /**
   * Schedule story for automatic deletion
   */
  private static async scheduleStoryDeletion(
    storyId: string,
    expiresAt: Date,
    storyData: Omit<PerfectStory, 'id'>
  ): Promise<void> {
    try {
      console.log('⏰ Scheduling story deletion...');
      
      const deletionDoc = {
        storyId,
        userId: storyData.userId,
        mediaUrl: storyData.mediaUrl,
        storageLocation: storyData.storageLocation,
        digitalOceanKey: storyData.digitalOceanKey,
        firebaseStoragePath: storyData.firebaseStoragePath,
        expiresAt: expiresAt.toISOString(),
        createdAt: new Date().toISOString(),
        processed: false,
      };

      await firestore()
        .collection(this.COLLECTION_STORY_DELETION_QUEUE)
        .doc(storyId)
        .set(deletionDoc);

      console.log('✅ Story deletion scheduled');
    } catch (error) {
      console.error('❌ Error scheduling story deletion:', error);
      // Don't throw error - story was created successfully
    }
  }

  /**
   * Get all stories for home feed
   */
  static async getStoriesForFeed(userId: string): Promise<PerfectStory[]> {
    try {
      console.log('📱 Loading stories for feed...');
      
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Get following users first
      const followingSnapshot = await firestore()
        .collection('follows')
        .where('followerId', '==', userId)
        .get();

      const followingIds = followingSnapshot.docs.map(doc => doc.data().followingId);
      followingIds.push(userId); // Include user's own stories

      if (followingIds.length === 0) {
        return [];
      }

      // Get stories from followed users
      const storiesSnapshot = await firestore()
        .collection(this.COLLECTION_STORIES)
        .where('userId', 'in', followingIds.slice(0, 10)) // Firestore limit
        .where('expiresAt', '>', now.toISOString())
        .where('isExpired', '==', false)
        .orderBy('expiresAt')
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      const stories: PerfectStory[] = [];

      for (const doc of storiesSnapshot.docs) {
        const storyData = { id: doc.id, ...doc.data() } as PerfectStory;
        
        // Mark if current user has viewed this story
        storyData.isViewed = storyData.viewedBy.includes(userId);
        
        stories.push(storyData);
      }

      console.log(`✅ Loaded ${stories.length} stories for feed`);
      return stories;
    } catch (error) {
      console.error('❌ Error loading stories for feed:', error);
      return [];
    }
  }

  /**
   * Get user's own stories
   */
  static async getUserStories(userId: string): Promise<PerfectStory[]> {
    try {
      console.log('👤 Loading user stories...');
      
      const now = new Date();
      
      const storiesSnapshot = await firestore()
        .collection(this.COLLECTION_STORIES)
        .where('userId', '==', userId)
        .where('expiresAt', '>', now.toISOString())
        .where('isExpired', '==', false)
        .orderBy('expiresAt')
        .orderBy('createdAt', 'desc')
        .get();

      const stories: PerfectStory[] = storiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as PerfectStory));

      console.log(`✅ Loaded ${stories.length} user stories`);
      return stories;
    } catch (error) {
      console.error('❌ Error loading user stories:', error);
      return [];
    }
  }

  /**
   * View a story (increment view count)
   */
  static async viewStory(storyId: string, viewerId: string): Promise<void> {
    try {
      const storyRef = firestore().collection(this.COLLECTION_STORIES).doc(storyId);
      const storyDoc = await storyRef.get();
      
      if (!storyDoc.exists) {
        return;
      }

      const storyData = storyDoc.data() as PerfectStory;
      
      // Only increment if viewer hasn't viewed before
      if (!storyData.viewedBy.includes(viewerId)) {
        await storyRef.update({
          viewedBy: firestore.FieldValue.arrayUnion(viewerId),
          viewsCount: firestore.FieldValue.increment(1),
        });
      }
    } catch (error) {
      console.error('❌ Error viewing story:', error);
    }
  }

  /**
   * Like a story
   */
  static async likeStory(storyId: string, userId: string): Promise<void> {
    try {
      const storyRef = firestore().collection(this.COLLECTION_STORIES).doc(storyId);
      const storyDoc = await storyRef.get();
      
      if (!storyDoc.exists) {
        return;
      }

      const storyData = storyDoc.data() as PerfectStory;
      
      if (!storyData.likedBy.includes(userId)) {
        await storyRef.update({
          likedBy: firestore.FieldValue.arrayUnion(userId),
          likesCount: firestore.FieldValue.increment(1),
        });
      }
    } catch (error) {
      console.error('❌ Error liking story:', error);
    }
  }

  /**
   * Unlike a story
   */
  static async unlikeStory(storyId: string, userId: string): Promise<void> {
    try {
      const storyRef = firestore().collection(this.COLLECTION_STORIES).doc(storyId);
      const storyDoc = await storyRef.get();
      
      if (!storyDoc.exists) {
        return;
      }

      const storyData = storyDoc.data() as PerfectStory;
      
      if (storyData.likedBy.includes(userId)) {
        await storyRef.update({
          likedBy: firestore.FieldValue.arrayRemove(userId),
          likesCount: firestore.FieldValue.increment(-1),
        });
      }
    } catch (error) {
      console.error('❌ Error unliking story:', error);
    }
  }

  /**
   * Delete a story manually (by owner)
   */
  static async deleteStory(storyId: string, userId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting story manually...');
      
      const storyRef = firestore().collection(this.COLLECTION_STORIES).doc(storyId);
      const storyDoc = await storyRef.get();
      
      if (!storyDoc.exists) {
        throw new Error('Story not found');
      }

      const storyData = storyDoc.data() as PerfectStory;
      
      // Only allow owner to delete
      if (storyData.userId !== userId) {
        throw new Error('Only story owner can delete');
      }

      // Delete media from storage
      await this.deleteStoryMedia(storyData);

      // Delete story document
      await storyRef.delete();

      // Remove from deletion queue
      await firestore()
        .collection(this.COLLECTION_STORY_DELETION_QUEUE)
        .doc(storyId)
        .delete();

      // Update user stats
      await firestore()
        .collection('users')
        .doc(userId)
        .update({
          storiesCount: firestore.FieldValue.increment(-1),
        });

      console.log('✅ Story deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting story:', error);
      throw error;
    }
  }

  /**
   * Delete story media from storage
   */
  private static async deleteStoryMedia(storyData: PerfectStory): Promise<void> {
    try {
      if (storyData.storageLocation === 'digitalocean' && storyData.digitalOceanKey) {
        console.log('🗑️ Deleting from DigitalOcean:', storyData.digitalOceanKey);
        await digitalOceanSpaces.deleteFile(storyData.digitalOceanKey);
      } else if (storyData.storageLocation === 'firebase' && storyData.firebaseStoragePath) {
        console.log('🗑️ Deleting from Firebase Storage:', storyData.firebaseStoragePath);
        const reference = storage().ref(storyData.firebaseStoragePath);
        await reference.delete();
      }
      
      console.log('✅ Media deleted from storage');
    } catch (error) {
      console.error('❌ Error deleting media from storage:', error);
      // Don't throw - deletion from database is more important
    }
  }

  /**
   * Manual cleanup of expired stories (for testing)
   */
  static async cleanupExpiredStories(): Promise<number> {
    try {
      console.log('🧹 Cleaning up expired stories...');
      
      const now = new Date();
      
      const expiredStoriesSnapshot = await firestore()
        .collection(this.COLLECTION_STORIES)
        .where('expiresAt', '<', now.toISOString())
        .where('isExpired', '==', false)
        .limit(100)
        .get();

      if (expiredStoriesSnapshot.empty) {
        console.log('✅ No expired stories to cleanup');
        return 0;
      }

      const batch = firestore().batch();
      let deletedCount = 0;

      for (const doc of expiredStoriesSnapshot.docs) {
        const storyData = doc.data() as PerfectStory;
        
        // Delete media from storage
        await this.deleteStoryMedia({ ...storyData, id: doc.id });
        
        // Mark as expired and delete
        batch.delete(doc.ref);
        
        // Remove from deletion queue
        batch.delete(
          firestore()
            .collection(this.COLLECTION_STORY_DELETION_QUEUE)
            .doc(doc.id)
        );
        
        deletedCount++;
      }

      await batch.commit();
      
      console.log(`✅ Cleaned up ${deletedCount} expired stories`);
      return deletedCount;
    } catch (error) {
      console.error('❌ Error cleaning up expired stories:', error);
      return 0;
    }
  }

  /**
   * Get story deletion queue (for Cloud Function)
   */
  static async getStoryDeletionQueue(): Promise<any[]> {
    try {
      const now = new Date();
      
      const queueSnapshot = await firestore()
        .collection(this.COLLECTION_STORY_DELETION_QUEUE)
        .where('expiresAt', '<', now.toISOString())
        .where('processed', '==', false)
        .limit(50)
        .get();

      return queueSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error('❌ Error getting deletion queue:', error);
      return [];
    }
  }
}

export default PerfectStoryService;
