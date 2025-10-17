import Config from 'react-native-config';

// For React Native Firebase - using the traditional approach for stability
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import messaging from '@react-native-firebase/messaging';
import functions from '@react-native-firebase/functions';

// Firebase config from environment variables (for reference)
export const firebaseConfig = {
  apiKey: Config.FIREBASE_API_KEY || "AIzaSyBXGz8vQZd4cYYKZJFZqxEGzkAGFxEJKbM",
  authDomain: Config.FIREBASE_AUTH_DOMAIN || "jorvea-9f876.firebaseapp.com",
  projectId: Config.FIREBASE_PROJECT_ID || "jorvea-9f876",
  storageBucket: Config.FIREBASE_STORAGE_BUCKET || "jorvea-9f876.firebasestorage.app",
  messagingSenderId: Config.FIREBASE_MESSAGING_SENDER_ID || "236350952922",
  appId: Config.FIREBASE_APP_ID || "1:236350952922:android:883204bca91666ab149ce3",
};

console.log('🔥 Firebase configuration loaded');

// React Native Firebase instances (automatically initialized by native modules)
export const firebaseAuth = auth();
export const firebaseFirestore = firestore();
export const firebaseStorage = storage();
export const firebaseMessaging = messaging();
export const firebaseFunctions = functions();

console.log('🔥 Firebase services initialized');

// Collections
export const COLLECTIONS = {
  USERS: 'users',
  USERNAMES: 'usernames', // New collection for public username checking
  POSTS: 'posts',
  REELS: 'reels',
  STORIES: 'stories',
  COMMENTS: 'comments',
  CHATS: 'chats',
  MESSAGES: 'messages',
  CALLS: 'calls',
  NOTIFICATIONS: 'notifications',
  FOLLOWERS: 'followers',
  FOLLOWING: 'following',
  LIKES: 'likes',
  STORY_LIKES: 'story_likes',
  STORY_COMMENTS: 'story_comments',
  SAVES: 'saves',
  BLOCKS: 'blocks',
  REPORTS: 'reports',
  HASHTAGS: 'hashtags',
  LOCATIONS: 'locations',
  MUSIC: 'music',
  EFFECTS: 'effects',
  STORY_HIGHLIGHTS: 'story_highlights',
  LIVE_STREAMS: 'live_streams',
  VIDEO_CALLS: 'video_calls',
  USER_SETTINGS: 'user_settings',
  APP_SETTINGS: 'app_settings',
  ANALYTICS: 'analytics',
} as const;

// Helper functions
export const createTimestamp = () => firestore.FieldValue.serverTimestamp();
export const createId = () => firebaseFirestore.collection('dummy').doc().id;

// Export aliases for easier usage
export { 
  auth, 
  firestore, 
  storage, 
  messaging, 
  functions 
};

// Default export for compatibility
export default {
  auth: firebaseAuth,
  firestore: firebaseFirestore,
  storage: firebaseStorage,
  messaging: firebaseMessaging,
  functions: firebaseFunctions,
};
