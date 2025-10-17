import { useEffect } from 'react';
import { firebaseAuth, firebaseFirestore } from '../config/firebase';

// Simple Firebase test utility
export const testFirebaseConnection = () => {
  console.log('🧪 Testing Firebase connection...');
  
  try {
    // Test auth instance
    if (firebaseAuth) {
      console.log('✅ Firebase Auth instance created successfully');
      console.log('🔐 Current user:', firebaseAuth.currentUser ? 'Signed in' : 'Not signed in');
    } else {
      console.error('❌ Firebase Auth instance is null');
    }

    // Test firestore instance
    if (firebaseFirestore) {
      console.log('✅ Firebase Firestore instance created successfully');
      
      // Test a simple read operation
      firebaseFirestore.collection('test').limit(1).get()
        .then(() => {
          console.log('✅ Firestore connection test successful');
        })
        .catch((error) => {
          console.log('⚠️ Firestore connection test failed (this is normal if you have security rules):', error.code);
        });
    } else {
      console.error('❌ Firebase Firestore instance is null');
    }

  } catch (error) {
    console.error('❌ Firebase test failed:', error);
  }
};

// Hook to test Firebase on component mount
export const useFirebaseTest = () => {
  useEffect(() => {
    testFirebaseConnection();
  }, []);
};

export default { testFirebaseConnection, useFirebaseTest };
