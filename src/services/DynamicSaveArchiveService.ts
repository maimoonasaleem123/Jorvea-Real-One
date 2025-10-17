import firestore from '@react-native-firebase/firestore';
import { Reel } from './firebaseService';
import { User } from '../types';

interface SavedItem {
  id: string;
  contentId: string;
  contentType: 'post' | 'reel';
  userId: string;
  createdAt: string;
  updatedAt: string;
}

interface ArchivedItem {
  id: string;
  contentId: string;
  contentType: 'post' | 'reel';
  userId: string;
  archivedAt: string;
  reason?: string;
}

interface ActivityItem {
  id: string;
  userId: string;
  type: 'like' | 'comment' | 'follow' | 'save' | 'share' | 'view';
  contentId?: string;
  contentType?: 'post' | 'reel';
  targetUserId?: string;
  metadata?: any;
  createdAt: string;
}

class DynamicSaveArchiveService {
  private static instance: DynamicSaveArchiveService;
  private saveListeners = new Map<string, () => void>();
  private activityListeners = new Map<string, () => void>();

  static getInstance(): DynamicSaveArchiveService {
    if (!DynamicSaveArchiveService.instance) {
      DynamicSaveArchiveService.instance = new DynamicSaveArchiveService();
    }
    return DynamicSaveArchiveService.instance;
  }

  // Dynamic save functionality for reels and posts
  async toggleSave(contentId: string, contentType: 'post' | 'reel', userId: string): Promise<boolean> {
    try {
      const saveRef = firestore().collection('saves').doc(`${contentId}_${userId}`);
      const saveDoc = await saveRef.get();

      if (saveDoc.exists()) {
        // Remove from saved
        await saveRef.delete();
        
        // Remove activity
        await this.removeActivity(userId, 'save', contentId);
        
        return false;
      } else {
        // Add to saved
        await saveRef.set({
          contentId,
          contentType,
          userId,
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });

        // Add activity
        await this.addActivity(userId, 'save', contentId, contentType);
        
        return true;
      }
    } catch (error) {
      console.error('Error toggling save:', error);
      throw error;
    }
  }

  // Check if content is saved
  async checkIsSaved(contentId: string, userId: string): Promise<boolean> {
    try {
      const saveRef = firestore().collection('saves').doc(`${contentId}_${userId}`);
      const saveDoc = await saveRef.get();
      return saveDoc.exists();
    } catch (error) {
      console.error('Error checking if saved:', error);
      return false;
    }
  }

  // Get user's saved items with real-time updates
  listenToSavedItems(userId: string, callback: (items: SavedItem[]) => void) {
    const unsubscribe = firestore()
      .collection('saves')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        snapshot => {
          const items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          } as SavedItem));
          callback(items);
        },
        error => {
          console.error('Error listening to saved items:', error);
          callback([]);
        }
      );

    this.saveListeners.set(`saved_${userId}`, unsubscribe);
    return unsubscribe;
  }

  // Archive functionality
  async toggleArchive(contentId: string, contentType: 'post' | 'reel', userId: string, reason?: string): Promise<boolean> {
    try {
      const archiveRef = firestore().collection('archives').doc(`${contentId}_${userId}`);
      const archiveDoc = await archiveRef.get();

      if (archiveDoc.exists()) {
        // Remove from archived
        await archiveRef.delete();
        
        // Update content visibility
        await this.updateContentVisibility(contentId, contentType, false);
        
        return false;
      } else {
        // Add to archived
        await archiveRef.set({
          contentId,
          contentType,
          userId,
          reason: reason || 'User archived',
          archivedAt: firestore.FieldValue.serverTimestamp(),
        });

        // Update content visibility
        await this.updateContentVisibility(contentId, contentType, true);
        
        // Add activity
        await this.addActivity(userId, 'save', contentId, contentType, { archived: true, reason });
        
        return true;
      }
    } catch (error) {
      console.error('Error toggling archive:', error);
      throw error;
    }
  }

  // Get archived items
  async getArchivedItems(userId: string): Promise<ArchivedItem[]> {
    try {
      const archiveQuery = await firestore()
        .collection('archives')
        .where('userId', '==', userId)
        .orderBy('archivedAt', 'desc')
        .get();

      return archiveQuery.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        archivedAt: doc.data().archivedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      } as ArchivedItem));
    } catch (error) {
      console.error('Error getting archived items:', error);
      return [];
    }
  }

  // Activity tracking
  async addActivity(
    userId: string, 
    type: ActivityItem['type'], 
    contentId?: string, 
    contentType?: 'post' | 'reel',
    metadata?: any,
    targetUserId?: string
  ): Promise<void> {
    try {
      await firestore().collection('activities').add({
        userId,
        type,
        contentId: contentId || null,
        contentType: contentType || null,
        targetUserId: targetUserId || null,
        metadata: metadata || null,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error('Error adding activity:', error);
    }
  }

  // Remove activity
  async removeActivity(userId: string, type: ActivityItem['type'], contentId?: string): Promise<void> {
    try {
      const activityQuery = await firestore()
        .collection('activities')
        .where('userId', '==', userId)
        .where('type', '==', type)
        .where('contentId', '==', contentId)
        .get();

      const batch = firestore().batch();
      activityQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Error removing activity:', error);
    }
  }

  // Get user activity with real-time updates
  listenToUserActivity(userId: string, callback: (activities: ActivityItem[]) => void) {
    const unsubscribe = firestore()
      .collection('activities')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .onSnapshot(
        snapshot => {
          const activities = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          } as ActivityItem));
          callback(activities);
        },
        error => {
          console.error('Error listening to user activity:', error);
          callback([]);
        }
      );

    this.activityListeners.set(`activity_${userId}`, unsubscribe);
    return unsubscribe;
  }

  // Update content visibility when archived
  private async updateContentVisibility(contentId: string, contentType: 'post' | 'reel', archived: boolean): Promise<void> {
    try {
      const collection = contentType === 'post' ? 'posts' : 'reels';
      await firestore().collection(collection).doc(contentId).update({
        archived,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating content visibility:', error);
    }
  }

  // Get full saved content with details
  async getSavedContentWithDetails(userId: string): Promise<{ reels: Reel[]; posts: any[] }> {
    try {
      const savedItems = await firestore()
        .collection('saves')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();

      const reelIds: string[] = [];
      const postIds: string[] = [];

      savedItems.docs.forEach(doc => {
        const data = doc.data();
        if (data.contentType === 'reel') {
          reelIds.push(data.contentId);
        } else if (data.contentType === 'post') {
          postIds.push(data.contentId);
        }
      });

      // Fetch reels in batches
      const reels: Reel[] = [];
      if (reelIds.length > 0) {
        const batchSize = 10;
        for (let i = 0; i < reelIds.length; i += batchSize) {
          const batch = reelIds.slice(i, i + batchSize);
          const reelsQuery = await firestore()
            .collection('reels')
            .where(firestore.FieldPath.documentId(), 'in', batch)
            .get();
            
          const batchReels = reelsQuery.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Reel));
          
          reels.push(...batchReels);
        }
      }

      // Fetch posts in batches (similar process)
      const posts: any[] = [];
      if (postIds.length > 0) {
        const batchSize = 10;
        for (let i = 0; i < postIds.length; i += batchSize) {
          const batch = postIds.slice(i, i + batchSize);
          const postsQuery = await firestore()
            .collection('posts')
            .where(firestore.FieldPath.documentId(), 'in', batch)
            .get();
            
          const batchPosts = postsQuery.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          posts.push(...batchPosts);
        }
      }

      return { reels, posts };
    } catch (error) {
      console.error('Error getting saved content with details:', error);
      return { reels: [], posts: [] };
    }
  }

  // Get all saved items for a user
  async getSavedItems(userId: string): Promise<SavedItem[]> {
    try {
      const snapshot = await firestore()
        .collection('saves')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      } as SavedItem));
    } catch (error) {
      console.error('Error fetching saved items:', error);
      return [];
    }
  }

  // Clean up listeners
  cleanup() {
    this.saveListeners.forEach(unsubscribe => unsubscribe());
    this.activityListeners.forEach(unsubscribe => unsubscribe());
    this.saveListeners.clear();
    this.activityListeners.clear();
  }
}

export default DynamicSaveArchiveService;
export type { SavedItem, ArchivedItem, ActivityItem };
