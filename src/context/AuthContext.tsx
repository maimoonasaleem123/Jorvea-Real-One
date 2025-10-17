import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { firebaseAuth, firebaseFirestore, COLLECTIONS } from '../config/firebase';
import { User, SignUpForm, SignInForm } from '../types';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FirebaseService from '../services/firebaseService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (data: SignInForm) => Promise<void>;
  signUp: (data: SignUpForm) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let authTimeout: any;
    
    const initializeAuth = async () => {
      try {
        // Set maximum timeout for auth initialization
        authTimeout = setTimeout(() => {
          if (isMounted) {
            console.log('⚠️ Auth initialization timeout, continuing without auth');
            setLoading(false);
            setInitialized(true);
          }
        }, 3000); // Reduced to 3 seconds for faster startup

        const unsubscribe = firebaseAuth.onAuthStateChanged(async (firebaseUser: FirebaseAuthTypes.User | null) => {
          if (!isMounted) return;
          
          try {
            if (authTimeout) clearTimeout(authTimeout);
            
            if (firebaseUser) {
              console.log('✅ Firebase user found:', firebaseUser.email);
              
              // Try to get user data with timeout
              const userPromise = firebaseFirestore
                .collection(COLLECTIONS.USERS)
                .doc(firebaseUser.uid)
                .get();
              
              const userDoc = await Promise.race([
                userPromise,
                new Promise<any>((_, reject) => 
                  setTimeout(() => reject(new Error('Firestore timeout')), 2000)
                )
              ]);

              if (userDoc.exists) {
                const userData = userDoc.data() as User;
                setUser(userData);
                await AsyncStorage.setItem('user_data', JSON.stringify(userData));
              } else {
                // Create user quickly without blocking
                const newUser: User = {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email || '',
                  username: firebaseUser.displayName?.toLowerCase().replace(/\s+/g, '') || `user_${Date.now()}`,
                  displayName: firebaseUser.displayName || 'Jorvea User',
                  profilePicture: firebaseUser.photoURL || '',
                  bio: '',
                  website: '',
                  phoneNumber: firebaseUser.phoneNumber || '',
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
                      showActivity: true,
                      showOnlineStatus: true,
                      allowMessages: 'everyone' as const,
                    },
                    theme: 'light' as const,
                  },
                };

                // Create user document asynchronously
                firebaseFirestore
                  .collection(COLLECTIONS.USERS)
                  .doc(firebaseUser.uid)
                  .set(newUser)
                  .catch(error => console.error('Failed to create user document:', error));
                
                setUser(newUser);
                await AsyncStorage.setItem('user_data', JSON.stringify(newUser));
              }
            } else {
              setUser(null);
              await AsyncStorage.removeItem('user_data');
            }
          } catch (error) {
            console.error('❌ Auth error:', error);
            // Try to load cached user data
            try {
              const cachedUser = await AsyncStorage.getItem('user_data');
              if (cachedUser && isMounted) {
                const userData = JSON.parse(cachedUser);
                setUser(userData);
              }
            } catch (cacheError) {
              console.error('Failed to load cached user:', cacheError);
            }
          } finally {
            if (isMounted) {
              setLoading(false);
              setInitialized(true);
            }
          }
        });

        return () => {
          isMounted = false;
          if (authTimeout) clearTimeout(authTimeout);
          unsubscribe();
        };
      } catch (error) {
        console.error('❌ Firebase auth setup error:', error);
        if (isMounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    initializeAuth();
  }, []);

  const signIn = async (data: SignInForm) => {
    try {
      setLoading(true);
      console.log('🔐 Signing in user');

      const { emailOrUsername, password } = data;
      
      // Determine if input is email or username
      const isEmail = emailOrUsername.includes('@');
      let email = emailOrUsername;
      
      if (!isEmail) {
        try {
          // Find user by username to get email
          const userQuery = await firebaseFirestore
            .collection(COLLECTIONS.USERS)
            .where('username', '==', emailOrUsername.toLowerCase())
            .limit(1)
            .get();
          
          if (userQuery.empty) {
            throw new Error('Username not found');
          }
          
          email = userQuery.docs[0].data().email;
        } catch (firestoreError) {
          console.error('❌ Firestore query error:', firestoreError);
          throw new Error('Unable to find user. Please check your internet connection.');
        }
      }

      await firebaseAuth.signInWithEmailAndPassword(email, password);
      console.log('✅ User signed in successfully');
    } catch (error: any) {
      console.error('❌ Sign in error:', error);
      let errorMessage = 'Failed to sign in';
      
      // Handle specific Firebase errors
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email/username';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (data: SignUpForm) => {
    try {
      setLoading(true);
      console.log('🔄 Starting comprehensive signup process...');

      // Enhanced password validation
      if (data.password !== data.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      if (data.password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      // Enhanced username validation
      if (!data.username) {
        throw new Error('Username is required');
      }

      const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
      if (!usernameRegex.test(data.username)) {
        throw new Error('Username must be 3-20 characters long and contain only letters, numbers, and underscores');
      }

      // Check reserved usernames
      const reservedUsernames = ['admin', 'root', 'api', 'www', 'mail', 'support', 'help', 'info'];
      if (reservedUsernames.includes(data.username.toLowerCase())) {
        throw new Error('This username is reserved. Please choose another one.');
      }

      console.log('🔍 Checking username availability with enhanced validation...');
      
      // Multi-layer username validation
      try {
        // First check: Firebase service validation
        const usernameValidation = await FirebaseService.validateUsername(data.username);
        if (!usernameValidation.isValid) {
          throw new Error(usernameValidation.error || 'Username is not available');
        }

        // Second check: Availability in main users collection
        const isUsernameAvailable = await FirebaseService.checkUsernameAvailability(data.username.toLowerCase());
        if (!isUsernameAvailable) {
          throw new Error('Username is already taken. Please choose another one.');
        }

      } catch (usernameError: any) {
        console.error('Username validation error:', usernameError);
        
        if (usernameError.message.includes('permission-denied')) {
          // Fallback validation using direct query
          console.log('🔄 Using fallback username validation...');
          try {
            const existingUsers = await firebaseFirestore
              .collection(COLLECTIONS.USERS)
              .where('username', '==', data.username.toLowerCase())
              .limit(1)
              .get();
            
            if (!existingUsers.empty) {
              throw new Error('Username is already taken. Please choose a different one.');
            }
            console.log('✅ Fallback validation successful - username available');
          } catch (fallbackError) {
            console.error('❌ Fallback username check failed:', fallbackError);
            throw new Error('Unable to verify username availability. Please try again.');
          }
        } else {
          throw usernameError;
        }
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        throw new Error('Please enter a valid email address');
      }

      console.log('🔐 Creating Firebase auth user...');
      
      // Create Firebase user
      const result = await firebaseAuth.createUserWithEmailAndPassword(
        data.email.toLowerCase().trim(), 
        data.password
      );
      const firebaseUser = result.user;

      if (!firebaseUser) {
        throw new Error('Failed to create user account');
      }

      console.log('✅ Firebase user created successfully, UID:', firebaseUser.uid);

      // Update Firebase Auth profile
      try {
        await firebaseUser.updateProfile({
          displayName: data.displayName || data.username,
        });
        console.log('✅ Firebase Auth profile updated');
      } catch (profileError) {
        console.warn('⚠️ Could not update Firebase Auth profile:', profileError);
      }

      // Create comprehensive user document
      const newUser: User = {
        uid: firebaseUser.uid,
        email: data.email.toLowerCase().trim(),
        username: data.username.toLowerCase().trim(),
        displayName: data.displayName?.trim() || data.username,
        profilePicture: '',
        bio: data.bio?.trim() || '',
        website: '',
        phoneNumber: '',
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
            showActivity: true,
            showOnlineStatus: true,
            allowMessages: 'everyone' as const,
          },
          theme: 'light' as const,
        },
      };

      console.log('💾 Saving user data with atomic operations...');

      // Use batch operations for data consistency
      const batch = firebaseFirestore.batch();
      
      // Save user document
      const userRef = firebaseFirestore.collection(COLLECTIONS.USERS).doc(firebaseUser.uid);
      batch.set(userRef, newUser);
      
      // Reserve username in public collection
      try {
        const usernameRef = firebaseFirestore.collection(COLLECTIONS.USERNAMES).doc(data.username.toLowerCase());
        batch.set(usernameRef, {
          uid: firebaseUser.uid,
          username: data.username.toLowerCase(),
          createdAt: new Date().toISOString(),
        });
      } catch (usernameReservationError) {
        console.warn('⚠️ Could not reserve username in public collection:', usernameReservationError);
        // Continue without reservation - not critical
      }

      await batch.commit();
      console.log('✅ User data saved successfully with atomic operations');

      // Cache user data locally
      await AsyncStorage.setItem('user_data', JSON.stringify(newUser));
      
      console.log('🎉 Comprehensive signup completed successfully!');
      console.log('👤 New user:', {
        username: newUser.username,
        email: newUser.email,
        displayName: newUser.displayName
      });

    } catch (error: any) {
      console.error('❌ Comprehensive signup error:', error);
      
      // Enhanced error cleanup
      try {
        const currentUser = firebaseAuth.currentUser;
        if (currentUser && (
          error.message.includes('username') || 
          error.message.includes('already taken') ||
          error.message.includes('not available')
        )) {
          console.log('🧹 Cleaning up Firebase user due to validation error...');
          await currentUser.delete();
          console.log('✅ Firebase user cleanup completed');
        }
      } catch (cleanupError) {
        console.error('⚠️ Error during user cleanup:', cleanupError);
      }
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to create account. Please try again.';
      
      if (error.code) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'This email is already registered. Please sign in or use a different email.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Please enter a valid email address.';
            break;
          case 'auth/weak-password':
            errorMessage = 'Password is too weak. Please choose a stronger password.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Network error. Please check your internet connection and try again.';
            break;
          default:
            errorMessage = error.message || errorMessage;
        }
      } else {
        errorMessage = error.message || errorMessage;
      }
      
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      console.log('👋 Signing out user');
      
      await firebaseAuth.signOut();
      setUser(null);
      await AsyncStorage.removeItem('user_data');
      
      console.log('✅ User signed out successfully');
    } catch (error: any) {
      console.error('❌ Sign out error:', error);
      throw new Error(error.message || 'Failed to sign out');
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    try {
      if (!user) {
        throw new Error('No user logged in');
      }

      console.log('📝 Updating user profile');

      const updatedUser = { ...user, ...updates, updatedAt: new Date() };

      await firebaseFirestore
        .collection(COLLECTIONS.USERS)
        .doc(user.uid)
        .update(updates);

      setUser(updatedUser);
      await AsyncStorage.setItem('user_data', JSON.stringify(updatedUser));

      console.log('✅ Profile updated successfully');
    } catch (error: any) {
      console.error('❌ Profile update error:', error);
      throw new Error(error.message || 'Failed to update profile');
    }
  };

  const resetPassword = async (email: string) => {
    try {
      console.log('📧 Sending password reset email');
      await firebaseAuth.sendPasswordResetEmail(email);
      console.log('✅ Password reset email sent');
    } catch (error: any) {
      console.error('❌ Password reset error:', error);
      throw new Error(error.message || 'Failed to send reset email');
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    resetPassword,
    isAuthenticated: !!user,
  };

  if (loading && !initialized) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading Jorvea...</Text>
      </View>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    color: '#666666',
    fontWeight: '500',
  },
});
