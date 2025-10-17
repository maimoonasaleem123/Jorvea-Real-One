import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../context/FastAuthContext';
import { AuthStackParamList } from '../../types';
import FirebaseService from '../../services/firebaseService';

type SignUpScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'SignUp'>;

function SignUpScreen(): React.JSX.Element {
  const navigation = useNavigation<SignUpScreenNavigationProp>();
  const { signUp, loading } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    displayName: '',
    bio: '',
    dateOfBirth: new Date(),
    agreeToTerms: false,
  });

  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'offline'>('idle');
  const [usernameError, setUsernameError] = useState<string>('');
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [usernameCheckTimeout, setUsernameCheckTimeout] = useState<any>(null);

  const handleSignUp = async () => {
    if (!formData.email || !formData.password || !formData.username || !formData.displayName) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (formData.username.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters');
      return;
    }

    if (usernameStatus === 'taken' || usernameStatus === 'invalid') {
      Alert.alert('Error', usernameError || 'Please choose a valid username.');
      return;
    }

    // Allow signup in offline mode or when username is available
    if (usernameStatus !== 'available' && usernameStatus !== 'offline') {
      Alert.alert('Error', 'Please wait for username validation to complete or check your internet connection.');
      return;
    }

    if (!formData.agreeToTerms) {
      Alert.alert('Error', 'Please agree to the Terms of Service');
      return;
    }

    try {
      await signUp(formData);
    } catch (error: any) {
      Alert.alert('Sign Up Error', error.message);
    }
  };

  const checkUsernameAvailability = async (username: string) => {
    if (username.length < 3) {
      setUsernameStatus('idle');
      setUsernameError('');
      return;
    }

    setUsernameStatus('checking');
    setUsernameError('');
    
    try {
      // First validate username format locally
      const validation = FirebaseService.validateUsername(username);
      if (!validation.isValid) {
        setUsernameStatus('invalid');
        setUsernameError(validation.error || 'Invalid username format');
        return;
      }

      // Then check availability online
      const isAvailable = await FirebaseService.checkUsernameAvailability(username.toLowerCase());
      
      if (isAvailable) {
        setUsernameStatus('available');
        setUsernameError('');
        setIsOfflineMode(false);
      } else {
        setUsernameStatus('taken');
        setUsernameError('Username is already taken');
      }
    } catch (error: any) {
      console.log('Username check failed, enabling offline mode:', error.message);
      
      // Handle permission denied or network errors gracefully
      if (error.message.includes('permission-denied') || error.message.includes('network')) {
        setUsernameStatus('offline');
        setUsernameError('Cannot verify username availability right now. We\'ll check when you create your account.');
        setIsOfflineMode(true);
      } else {
        setUsernameStatus('idle');
        setUsernameError('');
      }
    }
  };

  const updateFormData = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
    
    // Check username availability with debouncing
    if (field === 'username') {
      // Reset status and error immediately when typing
      setUsernameStatus('idle');
      setUsernameError('');
      
      if (usernameCheckTimeout) {
        clearTimeout(usernameCheckTimeout);
      }
      
      // Only check if username has minimum length
      if (value.length >= 3) {
        const timeout = setTimeout(() => {
          checkUsernameAvailability(value);
        }, 500); // Wait 500ms after user stops typing
        
        setUsernameCheckTimeout(timeout);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.backButtonText}>←</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Join Jorvea</Text>
              <Text style={styles.subtitle}>Create your account and start sharing</Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor="#8E8E93"
                  value={formData.displayName}
                  onChangeText={(text) => updateFormData('displayName', text)}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputContainer}>
                <View style={styles.usernameInputWrapper}>
                  <TextInput
                    style={[
                      styles.input,
                      usernameStatus === 'available' && styles.inputSuccess,
                      (usernameStatus === 'taken' || usernameStatus === 'invalid') && styles.inputError,
                      usernameStatus === 'offline' && styles.inputWarning,
                    ]}
                    placeholder="Username (letters, numbers, underscore only)"
                    placeholderTextColor="#8E8E93"
                    value={formData.username}
                    onChangeText={(text) => {
                      // Clean input: only allow lowercase letters, numbers, and underscores
                      const cleanText = text.toLowerCase().replace(/[^a-z0-9_]/g, '');
                      // Ensure it doesn't start with underscore or number
                      const finalText = cleanText.replace(/^[_0-9]+/, '');
                      updateFormData('username', finalText);
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={30}
                  />
                  {usernameStatus === 'checking' && (
                    <ActivityIndicator size="small" color="#007AFF" style={styles.usernameIndicator} />
                  )}
                  {usernameStatus === 'available' && (
                    <Text style={styles.usernameSuccess}>✓</Text>
                  )}
                  {(usernameStatus === 'taken' || usernameStatus === 'invalid') && (
                    <Text style={styles.usernameError}>✗</Text>
                  )}
                  {usernameStatus === 'offline' && (
                    <Text style={styles.usernameWarning}>⚠</Text>
                  )}
                </View>
                <Text style={[
                  styles.inputHint,
                  usernameStatus === 'available' && styles.hintSuccess,
                  (usernameStatus === 'taken' || usernameStatus === 'invalid') && styles.hintError,
                  usernameStatus === 'offline' && styles.hintWarning,
                ]}>
                  {usernameStatus === 'taken' || usernameStatus === 'invalid'
                    ? usernameError || 'Username is not available' 
                    : usernameStatus === 'available'
                    ? 'Username is available'
                    : usernameStatus === 'offline'
                    ? usernameError || 'Username will be verified during account creation'
                    : 'This will be your unique username (3-30 characters, starts with letter)'}
                </Text>
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#8E8E93"
                  value={formData.email}
                  onChangeText={(text) => updateFormData('email', text)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.bioInput}
                  placeholder="Bio (optional)"
                  placeholderTextColor="#8E8E93"
                  value={formData.bio}
                  onChangeText={(text) => updateFormData('bio', text)}
                  autoCapitalize="sentences"
                  autoCorrect={true}
                  multiline={true}
                  numberOfLines={3}
                  maxLength={150}
                />
                <Text style={styles.inputHint}>Tell people a little about yourself</Text>
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#8E8E93"
                  value={formData.password}
                  onChangeText={(text) => updateFormData('password', text)}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={styles.inputHint}>Must be at least 6 characters</Text>
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor="#8E8E93"
                  value={formData.confirmPassword}
                  onChangeText={(text) => updateFormData('confirmPassword', text)}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Terms Agreement */}
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => updateFormData('agreeToTerms', !formData.agreeToTerms)}
              >
                <View style={[styles.checkbox, formData.agreeToTerms && styles.checkboxChecked]}>
                  {formData.agreeToTerms && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxText}>
                  I agree to the{' '}
                  <Text style={styles.linkText}>Terms of Service</Text>
                  {' '}and{' '}
                  <Text style={styles.linkText}>Privacy Policy</Text>
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.signUpButton, loading && styles.disabledButton]}
                onPress={handleSignUp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.signUpButtonText}>Create Account</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Already have an account?{' '}
                <Text
                  style={styles.signInLink}
                  onPress={() => navigation.navigate('SignIn')}
                >
                  Sign In
                </Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 30,
    paddingBottom: 40,
  },
  header: {
    marginTop: 40,
    marginBottom: 40,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    padding: 10,
  },
  backButtonText: {
    fontSize: 24,
    color: '#262626',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#262626',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  form: {
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#262626',
    backgroundColor: '#F9F9F9',
  },
  inputHint: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
    marginLeft: 4,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 30,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderRadius: 4,
    marginRight: 12,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#E1306C',
    borderColor: '#E1306C',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxText: {
    flex: 1,
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  linkText: {
    color: '#E1306C',
    fontWeight: '500',
  },
  signUpButton: {
    backgroundColor: '#E1306C',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  signUpButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  signInLink: {
    color: '#E1306C',
    fontWeight: '600',
  },
  usernameInputWrapper: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputSuccess: {
    borderColor: '#34C759',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  inputWarning: {
    borderColor: '#FF9500',
  },
  usernameIndicator: {
    position: 'absolute',
    right: 15,
  },
  usernameSuccess: {
    position: 'absolute',
    right: 15,
    color: '#34C759',
    fontSize: 18,
    fontWeight: 'bold',
  },
  usernameError: {
    position: 'absolute',
    right: 15,
    color: '#FF3B30',
    fontSize: 18,
    fontWeight: 'bold',
  },
  usernameWarning: {
    position: 'absolute',
    right: 15,
    color: '#FF9500',
    fontSize: 18,
    fontWeight: 'bold',
  },
  hintSuccess: {
    color: '#34C759',
  },
  hintError: {
    color: '#FF3B30',
  },
  hintWarning: {
    color: '#FF9500',
  },
  bioInput: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#262626',
    textAlignVertical: 'top',
    minHeight: 80,
  },
});

export default SignUpScreen;
