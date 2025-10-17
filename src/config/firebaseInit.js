// Firebase initialization file
// This must be imported before any other Firebase imports

import { firebase } from '@react-native-firebase/app';

// Check if Firebase is already initialized
if (!firebase.apps.length) {
  // Firebase will auto-initialize from google-services.json and GoogleService-Info.plist
  console.log('🔥 Firebase initialized successfully');
} else {
  console.log('🔥 Firebase already initialized');
}

// Test Firebase connection
try {
  const app = firebase.app();
  console.log('✅ Firebase app instance:', app.name);
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
}

export default firebase;
