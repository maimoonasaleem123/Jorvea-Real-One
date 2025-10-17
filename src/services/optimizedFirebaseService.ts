import { firebaseFirestore, firebaseAuth, firebaseStorage } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

class OptimizedFirebaseService {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Safe wrapper for all Firebase operations
  private async safeOperation<T>(
    operation: () => Promise<T>,
    fallback: T,
    cacheKey?: string
  ): Promise<T> {
    try {
      // Check cache first
      if (cacheKey && this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey)!;
        if (Date.now() - cached.timestamp < this.CACHE_DURATION) {
          return cached.data;
        }
      }

      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Operation timeout')), 5000)
        )
      ]);

      // Cache the result
      if (cacheKey) {
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      }

      return result;
    } catch (error) {
      console.warn('Firebase operation failed, using fallback:', error);
      return fallback;
    }
  }

  async getUserProfile(userId: string) {
    return this.safeOperation(
      async () => {
        const doc = await firebaseFirestore.collection('users').doc(userId).get();
        return doc.exists() ? doc.data() : null;
      },
      null,
      `user_${userId}`
    );
  }

  async getPosts(limit = 10) {
    return this.safeOperation(
      async () => {
        const snapshot = await firebaseFirestore
          .collection('posts')
          .orderBy('createdAt', 'desc')
          .limit(limit)
          .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      },
      [],
      'recent_posts'
    );
  }

  async getReels(limit = 10) {
    return this.safeOperation(
      async () => {
        const snapshot = await firebaseFirestore
          .collection('reels')
          .orderBy('createdAt', 'desc')
          .limit(limit)
          .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      },
      [],
      'recent_reels'
    );
  }

  async createPost(postData: any) {
    return this.safeOperation(
      async () => {
        const docRef = await firebaseFirestore.collection('posts').add({
          ...postData,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        // Clear cache
        this.cache.delete('recent_posts');
        return docRef.id;
      },
      null
    );
  }

  async uploadImage(imageUri: string, path: string): Promise<string | null> {
    return this.safeOperation(
      async () => {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const ref = firebaseStorage.ref(path);
        await ref.put(blob);
        return await ref.getDownloadURL();
      },
      null
    );
  }

  // Batch operations for better performance
  async batchGetUsers(userIds: string[]) {
    if (userIds.length === 0) return [];
    
    return this.safeOperation(
      async () => {
        const chunks = this.chunkArray(userIds, 10); // Firestore limit
        const results = await Promise.all(
          chunks.map(chunk => 
            firebaseFirestore.collection('users').where('uid', 'in', chunk).get()
          )
        );
        return results.flatMap(snapshot => 
          snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        );
      },
      []
    );
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Clear cache when needed
  clearCache() {
    this.cache.clear();
  }

  // Offline support
  async cacheData(key: string, data: any) {
    try {
      await AsyncStorage.setItem(`cache_${key}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn('Failed to cache data:', error);
    }
  }

  async getCachedData(key: string) {
    try {
      const cached = await AsyncStorage.getItem(`cache_${key}`);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < this.CACHE_DURATION) {
          return data;
        }
      }
    } catch (error) {
      console.warn('Failed to get cached data:', error);
    }
    return null;
  }
}

export default new OptimizedFirebaseService();
