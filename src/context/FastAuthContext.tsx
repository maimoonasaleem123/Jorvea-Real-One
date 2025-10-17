import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { firebaseAuth, firebaseFirestore, COLLECTIONS } from '../config/firebase';
import { User, SignUpForm, SignInForm } from '../types';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FirebaseService from '../services/firebaseService';

// Utility function to check if error is timeout related
const isTimeoutError = (error: any): boolean => {
  return error?.message?.toLowerCase().includes('timeout') || 
         error?.code === 'network-request-failed' ||
         error?.code === 'unavailable';
};

// Utility function to get user-friendly error message
const getErrorMessage = (error: any): string => {
  if (isTimeoutError(error)) {
    return 'Connection timeout. Please check your internet connection and try again.';
  }
  
  switch (error?.code) {
    case 'auth/user-not-found':
      return 'No account found with this email.';
    case 'auth/wrong-password':
      return 'Incorrect password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection.';
    default:
      return error?.message || 'An unexpected error occurred.';
  }
};

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (data: SignInForm) => Promise<void>;
  signUp: (data: SignUpForm) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  sendEmailVerification: () => Promise<void>;
  checkEmailVerification: () => Promise<boolean>;
  resendEmailVerification: () => Promise<void>;
  validateUsername: (username: string) => Promise<boolean>;
  validateEmail: (email: string) => boolean;
  validatePassword: (password: string) => { isValid: boolean; errors: string[] };
  isAuthenticated: boolean;
  isEmailVerified: boolean;
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

  // Load cached user data on app start
  useEffect(() => {
    const loadCachedUser = async () => {
      try {
        const cachedUser = await AsyncStorage.getItem('@user_data');
        if (cachedUser) {
          setUser(JSON.parse(cachedUser));
          console.log('📱 Loaded cached user data');
        }
      } catch (error) {
        console.warn('Failed to load cached user:', error);
      }
    };
    
    loadCachedUser();
  }, []);

  // Cache user data whenever it changes
  useEffect(() => {
    if (user) {
      AsyncStorage.setItem('@user_data', JSON.stringify(user))
        .catch(error => console.warn('Failed to cache user:', error));
    } else {
      AsyncStorage.removeItem('@user_data')
        .catch(error => console.warn('Failed to remove cached user:', error));
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;
    
    // Quick timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (isMounted && loading) {
        console.log('⚠️ Auth timeout - continuing without user');
        setLoading(false);
      }
    }, 3000); // Increased to 3 seconds for better reliability

    const unsubscribe = firebaseAuth.onAuthStateChanged(async (firebaseUser) => {
      if (!isMounted) return;
      
      clearTimeout(timeout);
      
      try {
        if (firebaseUser) {
          // Try to get user data quickly with retry mechanism
          let userDoc;
          let retryCount = 0;
          const maxRetries = 2;
          
          while (retryCount < maxRetries) {
            try {
              userDoc = await Promise.race([
                firebaseFirestore.collection(COLLECTIONS.USERS).doc(firebaseUser.uid).get(),
                new Promise<any>((_, reject) => 
                  setTimeout(() => reject(new Error('User data fetch timeout')), 5000)
                )
              ]);
              break; // Success, exit retry loop
            } catch (error) {
              retryCount++;
              console.warn(`User data fetch attempt ${retryCount} failed:`, error);
              if (retryCount >= maxRetries) {
                throw error;
              }
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }

          if (userDoc.exists) {
            const userData = userDoc.data() as User;
            setUser(userData);
          } else {
            // Create minimal user
            const newUser: User = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              username: `user_${Date.now()}`,
              displayName: firebaseUser.displayName || 'User',
              profilePicture: '',
              bio: '',
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
            setUser(newUser);
            
            // Create user document in background
            firebaseFirestore.collection(COLLECTIONS.USERS).doc(firebaseUser.uid).set(newUser)
              .catch(console.error);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Auth error:', error);
        setUser(null);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  // Validation Functions
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/(?=.*[a-z])/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/(?=.*\d)/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (!/(?=.*[@$!%*?&])/.test(password)) {
      errors.push('Password must contain at least one special character (@$!%*?&)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  const validateUsername = async (username: string): Promise<boolean> => {
    try {
      // Username validation rules
      if (username.length < 3) return false;
      if (username.length > 30) return false;
      if (!/^[a-zA-Z0-9._]+$/.test(username)) return false;
      if (username.startsWith('.') || username.endsWith('.')) return false;
      if (username.includes('..')) return false;

      // Check availability in Firestore
      const isAvailable = await FirebaseService.checkUsernameAvailability(username.toLowerCase());
      return isAvailable;
    } catch (error) {
      console.error('Username validation error:', error);
      return false;
    }
  };

  // Email Verification Functions
  const sendEmailVerification = async (): Promise<void> => {
    try {
      const currentUser = firebaseAuth.currentUser;
      if (!currentUser) {
        throw new Error('No user is currently signed in');
      }

      if (currentUser.emailVerified) {
        throw new Error('Email is already verified');
      }

      await currentUser.sendEmailVerification({
        url: 'https://jorvea.app/verify-email',
        handleCodeInApp: true,
      });

      Alert.alert(
        'Verification Email Sent',
        'Please check your email and click the verification link to verify your account.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('Send email verification error:', error);
      throw new Error(getErrorMessage(error));
    }
  };

  const checkEmailVerification = async (): Promise<boolean> => {
    try {
      const currentUser = firebaseAuth.currentUser;
      if (!currentUser) return false;

      await currentUser.reload();
      return currentUser.emailVerified;
    } catch (error) {
      console.error('Check email verification error:', error);
      return false;
    }
  };

  const resendEmailVerification = async (): Promise<void> => {
    try {
      await sendEmailVerification();
    } catch (error) {
      throw error;
    }
  };

  const signIn = async (data: SignInForm) => {
    try {
      setLoading(true);
      const { emailOrUsername, password } = data;
      
      let email = emailOrUsername;
      if (!emailOrUsername.includes('@')) {
        // Try to find email by username with timeout
        try {
          const userQuery: any = await Promise.race([
            firebaseFirestore
              .collection(COLLECTIONS.USERS)
              .where('username', '==', emailOrUsername.toLowerCase())
              .limit(1)
              .get(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Username lookup timeout')), 10000)
            )
          ]);
          
          if (!userQuery.empty) {
            email = userQuery.docs[0].data().email;
          }
        } catch (error) {
          console.warn('Username lookup failed, trying as email:', error);
          // Continue with original input as email
        }
      }

      // Sign in with timeout
      const userCredential = await Promise.race([
        firebaseAuth.signInWithEmailAndPassword(email.toLowerCase(), password),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Sign in timeout - please check your connection')), 15000)
        )
      ]) as any;

      // Check if email is verified and show appropriate message
      if (userCredential.user && !userCredential.user.emailVerified) {
        Alert.alert(
          'Email Not Verified',
          'Your email address is not verified yet. Please check your email for the verification link or request a new one.',
          [
            {
              text: 'Resend Verification',
              onPress: async () => {
                try {
                  await sendEmailVerification();
                } catch (error) {
                  console.error('Failed to resend verification:', error);
                }
              }
            },
            { text: 'Continue Anyway' }
          ]
        );
      }

      console.log('✅ Sign in successful!');
    } catch (error: any) {
      console.error('Sign in error:', error);
      
      // Show user-friendly error message
      const errorMessage = getErrorMessage(error);
      
      // For timeout errors, suggest offline mode or retry
      if (isTimeoutError(error)) {
        Alert.alert(
          'Connection Timeout',
          'Unable to connect to the server. Please check your internet connection and try again.',
          [
            { text: 'Retry', onPress: () => {} },
            { text: 'OK' }
          ]
        );
      }
      
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (data: SignUpForm) => {
    try {
      setLoading(true);
      const { email, password, username, displayName, bio } = data;

      console.log('🔐 Starting signup process for:', { email, username, displayName });

      // Comprehensive validation before attempting signup
      if (!validateEmail(email)) {
        throw new Error('Please enter a valid email address');
      }

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        throw new Error(`Password requirements not met:\n${passwordValidation.errors.join('\n')}`);
      }

      if (!username || username.length < 3) {
        throw new Error('Username must be at least 3 characters long');
      }

      if (!displayName || displayName.trim().length < 2) {
        throw new Error('Display name must be at least 2 characters long');
      }

      // Check username availability
      console.log('🔍 Checking username availability...');
      const isUsernameAvailable = await validateUsername(username);
      if (!isUsernameAvailable) {
        throw new Error('Username is already taken or invalid. Please choose a different one.');
      }

      console.log('✅ Username is available');

      // Check if email is already in use
      try {
        const emailQuery = await firebaseFirestore
          .collection(COLLECTIONS.USERS)
          .where('email', '==', email.toLowerCase())
          .limit(1)
          .get();
        
        if (!emailQuery.empty) {
          throw new Error('An account with this email already exists');
        }
      } catch (error: any) {
        if (error.message.includes('already exists')) {
          throw error;
        }
        console.warn('Email check failed, continuing with signup:', error);
      }

      console.log('📧 Creating Firebase user...');

      // Create user with timeout
      const userCredential = await Promise.race([
        firebaseAuth.createUserWithEmailAndPassword(email.toLowerCase(), password),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Sign up timeout - please check your connection')), 15000)
        )
      ]) as any;
      
      if (userCredential.user) {
        console.log('✅ Firebase user created:', userCredential.user.uid);

        // Update Firebase profile
        await Promise.race([
          userCredential.user.updateProfile({ displayName }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Profile update timeout')), 10000)
          )
        ]);

        // Create comprehensive user document in Firestore
        const newUser: User = {
          uid: userCredential.user.uid,
          email: email.toLowerCase(),
          username: username.toLowerCase(),
          displayName: displayName.trim(),
          profilePicture: '',
          bio: bio?.trim() || '',
          website: '',
          phoneNumber: '',
          isPrivate: false,
          isVerified: false, // Will be updated after email verification
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
              allowMessages: 'everyone',
            },
            theme: 'dark',
          },
        };

        // Save user to Firestore with timeout
        await Promise.race([
          firebaseFirestore.collection(COLLECTIONS.USERS).doc(userCredential.user.uid).set(newUser),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('User creation timeout')), 15000)
          )
        ]);

        console.log('✅ User document created in Firestore');

        // Send email verification immediately after signup
        try {
          await userCredential.user.sendEmailVerification({
            url: 'https://jorvea.app/verify-email',
            handleCodeInApp: true,
          });
          console.log('📧 Email verification sent');
          
          Alert.alert(
            'Account Created Successfully!',
            'Please check your email and click the verification link to verify your account. You can use the app, but some features may be limited until verification.',
            [{ text: 'OK' }]
          );
        } catch (emailError) {
          console.warn('Failed to send verification email:', emailError);
          Alert.alert(
            'Account Created!',
            'Your account was created successfully, but we couldn\'t send the verification email. You can request it later from your profile.',
            [{ text: 'OK' }]
          );
        }

        // Set user in context immediately
        setUser(newUser);

        console.log('🎉 Signup completed successfully!');
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      
      // Show user-friendly error message
      const errorMessage = getErrorMessage(error);
      
      // For timeout errors, suggest retry
      if (isTimeoutError(error)) {
        Alert.alert(
          'Connection Timeout',
          'Unable to connect to the server. Please check your internet connection and try again.',
          [
            { text: 'Retry', onPress: () => {} },
            { text: 'OK' }
          ]
        );
      }
      
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      // Sign out with timeout
      await Promise.race([
        firebaseAuth.signOut(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Sign out timeout')), 10000)
        )
      ]);
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
      // Force sign out locally even if Firebase fails
      setUser(null);
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) return;

    try {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      
      // Update in Firestore with timeout
      Promise.race([
        firebaseFirestore.collection(COLLECTIONS.USERS).doc(user.uid).update(updates),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Profile update timeout')), 10000)
        )
      ]).catch(error => {
        console.error('Firestore update failed:', error);
        // Keep local changes even if Firestore fails
      });
    } catch (error) {
      console.error('Update profile error:', error);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      console.log('🔄 Sending password reset email to:', email);
      
      // Validate email format
      if (!validateEmail(email)) {
        throw new Error('Please enter a valid email address');
      }

      // Reset password with timeout
      await Promise.race([
        firebaseAuth.sendPasswordResetEmail(email.toLowerCase(), {
          url: 'https://jorvea.app/reset-complete',
          handleCodeInApp: false,
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Reset password timeout - please check your connection')), 15000)
        )
      ]);

      console.log('✅ Password reset email sent successfully');
      
      Alert.alert(
        'Password Reset Email Sent',
        'Please check your email for instructions to reset your password. The link will expire in 1 hour.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('Reset password error:', error);
      const errorMessage = getErrorMessage(error);
      throw new Error(errorMessage);
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
    sendEmailVerification,
    checkEmailVerification,
    resendEmailVerification,
    validateUsername,
    validateEmail,
    validatePassword,
    isAuthenticated: !!user,
    isEmailVerified: !!user && firebaseAuth.currentUser?.emailVerified === true,
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});
