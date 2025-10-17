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
    // Add timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (!initialized) {
        setLoading(false);
        setInitialized(true);
      }
    }, 5000);

    try {
      const unsubscribe = firebaseAuth.onAuthStateChanged(async (firebaseUser: FirebaseAuthTypes.User | null) => {
        try {
          clearTimeout(timeout);
          
          if (firebaseUser) {
            console.log('✅ Firebase user found:', firebaseUser.email);
            
            // Get user data from Firestore
            const userDoc = await firebaseFirestore
              .collection(COLLECTIONS.USERS)
              .doc(firebaseUser.uid)
              .get();

            if (userDoc.exists()) {
              const userData = userDoc.data() as User;
              console.log('✅ User data loaded from Firestore');
              setUser(userData);
              
              // Cache user data locally
              await AsyncStorage.setItem('user_data', JSON.stringify(userData));
            } else {
              console.log('ℹ️ User document not found, creating new one');
              
              // Create new user document
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

              await firebaseFirestore
                .collection(COLLECTIONS.USERS)
                .doc(firebaseUser.uid)
                .set(newUser);
              
              setUser(newUser);
              await AsyncStorage.setItem('user_data', JSON.stringify(newUser));
            }
          } else {
            console.log('ℹ️ No Firebase user found');
            setUser(null);
            await AsyncStorage.removeItem('user_data');
          }
        } catch (error) {
          console.error('❌ Error in auth state change:', error);
          setUser(null);
        } finally {
          setLoading(false);
          setInitialized(true);
        }
      });

      return () => {
        clearTimeout(timeout);
        unsubscribe();
      };
    } catch (error) {
      console.error('❌ Firebase auth setup error:', error);
      setLoading(false);
      setInitialized(true);
    }
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
      }

      await firebaseAuth.signInWithEmailAndPassword(email, password);
      console.log('✅ User signed in successfully');
    } catch (error: any) {
      console.error('❌ Sign in error:', error);
      throw new Error(error.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (data: SignUpForm) => {
    try {
      setLoading(true);
      console.log('📝 Creating new user account:', data.email);

      if (data.password !== data.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      // Validate username format first
      const usernameValidation = FirebaseService.validateUsername(data.username);
      
      if (!usernameValidation.isValid) {
        throw new Error(usernameValidation.error || 'Invalid username format');
      }

      // Check if username is available BEFORE creating Firebase user
      const isUsernameAvailable = await FirebaseService.checkUsernameAvailability(data.username.toLowerCase());
      
      if (!isUsernameAvailable) {
        throw new Error('Username is already taken. Please choose another one.');
      }

      // Create Firebase user only after username validation
      const result = await firebaseAuth.createUserWithEmailAndPassword(data.email, data.password);
      const firebaseUser = result.user;

      // Update profile
      await firebaseUser.updateProfile({
        displayName: data.displayName,
      });

      // Create user document in Firestore
      const newUser: User = {
        uid: firebaseUser.uid,
        email: data.email,
        username: data.username.toLowerCase(),
        displayName: data.displayName,
        profilePicture: '',
        bio: data.bio || '',
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

      // Save user to Firestore
      await firebaseFirestore
        .collection(COLLECTIONS.USERS)
        .doc(firebaseUser.uid)
        .set(newUser);

      // Create username entry for future checks
      await FirebaseService.createUsernameEntry(data.username.toLowerCase(), firebaseUser.uid);

      console.log('✅ User account created successfully with username:', data.username);
    } catch (error: any) {
      console.error('❌ Sign up error:', error);
      
      // If there's an error and we created a Firebase user, clean it up
      try {
        const currentUser = firebaseAuth.currentUser;
        if (currentUser && error.message.includes('username')) {
          await currentUser.delete();
          console.log('🧹 Cleaned up Firebase user due to username error');
        }
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      }
      
      throw new Error(error.message || 'Failed to create account');
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
