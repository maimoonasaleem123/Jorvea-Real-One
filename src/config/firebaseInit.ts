// Firebase initialization for React Native
// This ensures Firebase is properly initialized before any components try to use it

import { AppRegistry } from 'react-native';

// Import React Native Firebase app and initialize it
import { getApps, initializeApp } from '@react-native-firebase/app';

// Optional: Import other services you want to use
import '@react-native-firebase/auth';
import '@react-native-firebase/firestore';
import '@react-native-firebase/storage';
import '@react-native-firebase/messaging';
import '@react-native-firebase/functions';

// Check if Firebase is already initialized
if (getApps().length === 0) {
  console.log('🔥 Initializing Firebase for the first time...');
} else {
  console.log('🔥 Firebase already initialized');
}

console.log('🔥 Firebase modules loaded and ready');

// This file should be imported before any Firebase usage
export default true;
