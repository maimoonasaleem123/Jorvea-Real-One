import { firebaseFirestore, firebaseAuth, firebaseStorage } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class SafeFirebaseService {
  static async safeFirestoreOperation<T>(
    operation: () => Promise<T>,
    fallbackValue: T,
    errorMessage = 'Firebase operation failed'
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      console.error(errorMessage, error);
      return fallbackValue;
    }
  }

  static async safeAuthOperation<T>(
    operation: () => Promise<T>,
    errorMessage = 'Auth operation failed'
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      console.error(errorMessage, error);
      throw error; // Re-throw auth errors so they can be handled by UI
    }
  }

  static async safeStorageOperation<T>(
    operation: () => Promise<T>,
    fallbackValue: T,
    errorMessage = 'Storage operation failed'
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      console.error(errorMessage, error);
      return fallbackValue;
    }
  }

  static async getUserSafely(userId: string) {
    return this.safeFirestoreOperation(
      async () => {
        const doc = await firebaseFirestore.collection('users').doc(userId).get();
        return doc.exists() ? doc.data() : null;
      },
      null,
      `Failed to get user ${userId}`
    );
  }

  static async getPostsSafely(userId?: string) {
    return this.safeFirestoreOperation(
      async () => {
        let query = firebaseFirestore.collection('posts').orderBy('createdAt', 'desc');
        if (userId) {
          query = query.where('userId', '==', userId);
        }
        const snapshot = await query.limit(20).get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      },
      [],
      'Failed to get posts'
    );
  }

  static async getReelsSafely(userId?: string) {
    return this.safeFirestoreOperation(
      async () => {
        let query = firebaseFirestore.collection('reels').orderBy('createdAt', 'desc');
        if (userId) {
          query = query.where('userId', '==', userId);
        }
        const snapshot = await query.limit(20).get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      },
      [],
      'Failed to get reels'
    );
  }

  static async uploadImageSafely(imageUri: string, path: string): Promise<string | null> {
    return this.safeStorageOperation(
      async () => {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const ref = firebaseStorage.ref(path);
        await ref.put(blob);
        return await ref.getDownloadURL();
      },
      null,
      'Failed to upload image'
    );
  }

  static async cacheData(key: string, data: any) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to cache data:', error);
    }
  }

  static async getCachedData(key: string) {
    try {
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get cached data:', error);
      return null;
    }
  }

  static isOnline(): boolean {
    // Basic network check - can be enhanced with proper network detection
    return true; // Assume online by default
  }
}

export default SafeFirebaseService;
