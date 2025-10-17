import React, { useState, useRef, useEffect } from 'react';
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
  Animated,
  Dimensions,
  StatusBar,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../context/FastAuthContext';
import { AuthStackParamList } from '../../types';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import FirebaseService from '../../services/firebaseService';

const { width, height } = Dimensions.get('window');

type SignUpScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'SignUp'>;

interface ValidationErrors {
  [key: string]: string;
}

function EnhancedSignUpScreen(): React.JSX.Element {
  const navigation = useNavigation<SignUpScreenNavigationProp>();
  const { signUp, loading, validateEmail, validatePassword, validateUsername } = useAuth();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    displayName: '',
    bio: '',
    agreeToTerms: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  
  // Username validation states
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error'>('idle');
  const [usernameCheckTimeout, setUsernameCheckTimeout] = useState<NodeJS.Timeout | null>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    // Progress bar animation
    Animated.timing(progressAnim, {
      toValue: (currentStep - 1) / 2, // 3 steps total
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentStep]);

  const validateField = async (field: string, value: string) => {
    const errors = { ...validationErrors };
    
    switch (field) {
      case 'email':
        if (!value.trim()) {
          errors.email = 'Email is required';
        } else if (!validateEmail(value)) {
          errors.email = 'Please enter a valid email address';
        } else {
          delete errors.email;
        }
        break;
        
      case 'password':
        if (!value) {
          errors.password = 'Password is required';
        } else {
          const passwordValidation = validatePassword(value);
          if (!passwordValidation.isValid) {
            errors.password = passwordValidation.errors[0]; // Show first error
          } else {
            delete errors.password;
          }
        }
        break;
        
      case 'confirmPassword':
        if (!value) {
          errors.confirmPassword = 'Please confirm your password';
        } else if (value !== formData.password) {
          errors.confirmPassword = 'Passwords do not match';
        } else {
          delete errors.confirmPassword;
        }
        break;
        
      case 'username':
        if (!value.trim()) {
          errors.username = 'Username is required';
        } else {
          // Use the context validation function
          try {
            const isValid = await validateUsername(value);
            if (!isValid) {
              errors.username = 'Username is invalid or already taken';
            } else {
              delete errors.username;
            }
          } catch (error) {
            errors.username = 'Error checking username availability';
          }
        }
        break;
        
      case 'displayName':
        if (!value.trim()) {
          errors.displayName = 'Display name is required';
        } else if (value.length < 2) {
          errors.displayName = 'Display name must be at least 2 characters';
        } else if (value.length > 50) {
          errors.displayName = 'Display name must be less than 50 characters';
        } else {
          delete errors.displayName;
        }
        break;
    }
    
    setValidationErrors(errors);
  };

  const handleInputChange = async (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    await validateField(field, value);
    
    // Special handling for username validation
    if (field === 'username') {
      handleUsernameChange(value);
    }
  };

  const handleUsernameChange = async (username: string) => {
    // Clear previous timeout
    if (usernameCheckTimeout) {
      clearTimeout(usernameCheckTimeout);
    }
    
    // Reset status
    setUsernameStatus('idle');
    
    // Basic format validation first
    if (!username || username.length < 3) {
      return;
    }
    
    if (!/^[a-zA-Z0-9._]+$/.test(username)) {
      setUsernameStatus('invalid');
      return;
    }
    
    if (username.startsWith('.') || username.endsWith('.') || username.includes('..')) {
      setUsernameStatus('invalid');
      return;
    }
    
    // Only check availability if format is valid and no other validation errors
    setUsernameStatus('checking');
    
    // Debounced Firebase check
    const timeout = setTimeout(async () => {
      try {
        console.log('🔍 Checking username availability for:', username);
        
        // Use the context validation function for complete check
        const isValid = await validateUsername(username);
        
        if (isValid) {
          console.log('✅ Username is available:', username);
          setUsernameStatus('available');
          
          // Clear any validation errors for username
          const errors = { ...validationErrors };
          delete errors.username;
          setValidationErrors(errors);
        } else {
          console.log('❌ Username is taken or invalid:', username);
          setUsernameStatus('taken');
          
          // Set validation error
          const errors = { ...validationErrors };
          errors.username = 'Username is already taken or invalid';
          setValidationErrors(errors);
        }
      } catch (error) {
        console.error('Username check error:', error);
        setUsernameStatus('error');
        
        // Set validation error
        const errors = { ...validationErrors };
        errors.username = 'Error checking username availability';
        setValidationErrors(errors);
      }
    }, 300); // Reduced debounce time for more responsive checking
    
    setUsernameCheckTimeout(timeout);
  };

  const getUsernameStatusIcon = () => {
    switch (usernameStatus) {
      case 'checking':
        return <ActivityIndicator size="small" color="#4ECDC4" />;
      case 'available':
        return <Icon name="checkmark-circle" size={20} color="#4CAF50" />;
      case 'taken':
        return <Icon name="close-circle" size={20} color="#FF6B6B" />;
      case 'invalid':
        return <Icon name="warning" size={20} color="#FF9800" />;
      case 'error':
        return <Icon name="alert-circle" size={20} color="#FF5722" />;
      default:
        return null;
    }
  };

  const getUsernameStatusText = () => {
    switch (usernameStatus) {
      case 'checking':
        return 'Checking availability...';
      case 'available':
        return 'Username is available!';
      case 'taken':
        return 'Username is already taken';
      case 'invalid':
        return 'Invalid username format';
      case 'error':
        return 'Error checking availability';
      default:
        return '';
    }
  };

  const getUsernameStatusColor = () => {
    switch (usernameStatus) {
      case 'checking':
        return '#4ECDC4';
      case 'available':
        return '#4CAF50';
      case 'taken':
        return '#FF6B6B';
      case 'invalid':
        return '#FF9800';
      case 'error':
        return '#FF5722';
      default:
        return '#666';
    }
  };

  const canProceedToNextStep = () => {
    switch (currentStep) {
      case 1:
        // Step 1: Email and Password validation
        const hasValidEmail = !validationErrors.email && formData.email.trim() && validateEmail(formData.email);
        const hasValidPassword = !validationErrors.password && formData.password;
        const hasValidConfirmPassword = !validationErrors.confirmPassword && formData.confirmPassword && formData.password === formData.confirmPassword;
        return hasValidEmail && hasValidPassword && hasValidConfirmPassword;
        
      case 2:
        // Step 2: Username and Display Name validation
        const hasValidUsername = !validationErrors.username && formData.username.trim() && usernameStatus === 'available';
        const hasValidDisplayName = !validationErrors.displayName && formData.displayName.trim() && formData.displayName.length >= 2;
        return hasValidUsername && hasValidDisplayName;
        
      case 3:
        // Step 3: Final review and terms
        return formData.agreeToTerms;
        
      default:
        return false;
    }
  };

  const handleNextStep = () => {
    if (canProceedToNextStep() && currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSignUp = async () => {
    try {
      console.log('🔄 Starting comprehensive sign up validation...');
      
      // Step 1: Final field validation
      console.log('📝 Validating all fields...');
      Object.keys(formData).forEach(key => {
        if (key !== 'bio' && key !== 'agreeToTerms' && key !== 'confirmPassword') {
          validateField(key, (formData as any)[key]);
        }
      });

      // Check for validation errors
      if (Object.keys(validationErrors).length > 0) {
        console.log('❌ Validation errors found:', validationErrors);
        Alert.alert('Validation Error', 'Please fix the errors and try again');
        return;
      }

      // Step 2: Ensure username is available
      if (usernameStatus !== 'available') {
        console.log('❌ Username not available:', usernameStatus);
        Alert.alert('Username Error', 'Please choose an available username');
        return;
      }

      // Step 3: Terms agreement check
      if (!formData.agreeToTerms) {
        Alert.alert('Terms Required', 'Please agree to the Terms and Conditions');
        return;
      }

      // Step 4: Password confirmation check
      if (formData.password !== formData.confirmPassword) {
        Alert.alert('Password Mismatch', 'Passwords do not match');
        return;
      }

      // Step 5: Final username availability check (double-check)
      console.log('🔍 Double-checking username availability...');
      const isUsernameStillAvailable = await validateUsername(formData.username);
      if (!isUsernameStillAvailable) {
        Alert.alert('Username Taken', 'This username was just taken by another user. Please choose a different one.');
        setUsernameStatus('taken');
        return;
      }

      console.log('✅ All validations passed. Creating user...');

      // Prepare clean data for signup
      const signUpData = {
        email: formData.email.toLowerCase().trim(),
        password: formData.password,
        username: formData.username.toLowerCase().trim(),
        displayName: formData.displayName.trim(),
        bio: formData.bio?.trim() || '',
      };

      console.log('📤 Submitting sign up data:', { ...signUpData, password: '[HIDDEN]' });

      // Call the enhanced signUp function
      await signUp(signUpData);

      console.log('🎉 User created successfully!');
      
      // Navigation will be handled automatically by the auth context
    } catch (error: any) {
      console.error('❌ Sign up error:', error);
      Alert.alert(
        'Sign Up Failed', 
        error.message || 'An unexpected error occurred. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressBar}>
        <Animated.View 
          style={[
            styles.progressFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            }
          ]} 
        />
      </View>
      <Text style={styles.progressText}>Step {currentStep} of 3</Text>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Create Your Account</Text>
      <Text style={styles.stepSubtitle}>Let's start with your email and password</Text>

      {/* Email Input */}
      <View style={styles.inputWrapper}>
        <View style={[
          styles.inputContainer,
          focusedField === 'email' && styles.inputFocused,
          validationErrors.email && styles.inputError
        ]}>
          <Icon 
            name="mail" 
            size={20} 
            color={focusedField === 'email' ? '#4ECDC4' : '#8E8E93'} 
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Email Address"
            placeholderTextColor="#8E8E93"
            value={formData.email}
            onChangeText={(text) => handleInputChange('email', text)}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField('')}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
        </View>
        {validationErrors.email && (
          <Text style={styles.errorText}>{validationErrors.email}</Text>
        )}
      </View>

      {/* Password Input */}
      <View style={styles.inputWrapper}>
        <View style={[
          styles.inputContainer,
          focusedField === 'password' && styles.inputFocused,
          validationErrors.password && styles.inputError
        ]}>
          <Icon 
            name="lock-closed" 
            size={20} 
            color={focusedField === 'password' ? '#4ECDC4' : '#8E8E93'} 
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#8E8E93"
            value={formData.password}
            onChangeText={(text) => handleInputChange('password', text)}
            onFocus={() => setFocusedField('password')}
            onBlur={() => setFocusedField('')}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeIcon}
          >
            <Icon 
              name={showPassword ? 'eye-off' : 'eye'} 
              size={20} 
              color="#8E8E93" 
            />
          </TouchableOpacity>
        </View>
        {validationErrors.password && (
          <Text style={styles.errorText}>{validationErrors.password}</Text>
        )}
        
        {/* Password Strength Indicator */}
        {formData.password.length > 0 && !validationErrors.password && (
          <View style={styles.passwordStrengthContainer}>
            <Text style={[styles.hintText, { color: '#4CAF50' }]}>
              ✓ Password meets all requirements
            </Text>
          </View>
        )}
        
        {formData.password.length > 0 && formData.password.length < 8 && (
          <Text style={[styles.hintText, { color: '#FF9800' }]}>
            Password must be at least 8 characters
          </Text>
        )}
      </View>

      {/* Confirm Password Input */}
      <View style={styles.inputWrapper}>
        <View style={[
          styles.inputContainer,
          focusedField === 'confirmPassword' && styles.inputFocused,
          validationErrors.confirmPassword && styles.inputError
        ]}>
          <Icon 
            name="lock-closed" 
            size={20} 
            color={focusedField === 'confirmPassword' ? '#4ECDC4' : '#8E8E93'} 
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#8E8E93"
            value={formData.confirmPassword}
            onChangeText={(text) => handleInputChange('confirmPassword', text)}
            onFocus={() => setFocusedField('confirmPassword')}
            onBlur={() => setFocusedField('')}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            style={styles.eyeIcon}
          >
            <Icon 
              name={showConfirmPassword ? 'eye-off' : 'eye'} 
              size={20} 
              color="#8E8E93" 
            />
          </TouchableOpacity>
        </View>
        {validationErrors.confirmPassword && (
          <Text style={styles.errorText}>{validationErrors.confirmPassword}</Text>
        )}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Choose Your Identity</Text>
      <Text style={styles.stepSubtitle}>Pick a unique username and display name</Text>

      {/* Username Input */}
      <View style={styles.inputWrapper}>
        <View style={[
          styles.inputContainer,
          focusedField === 'username' && styles.inputFocused,
          validationErrors.username && styles.inputError,
          usernameStatus === 'available' && styles.inputSuccess,
          usernameStatus === 'taken' && styles.inputError
        ]}>
          <Icon 
            name="at" 
            size={20} 
            color={focusedField === 'username' ? '#4ECDC4' : '#8E8E93'} 
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#8E8E93"
            value={formData.username}
            onChangeText={(text) => handleInputChange('username', text.toLowerCase())}
            onFocus={() => setFocusedField('username')}
            onBlur={() => setFocusedField('')}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.usernameStatus}>
            {getUsernameStatusIcon()}
          </View>
        </View>
        {validationErrors.username && (
          <Text style={styles.errorText}>{validationErrors.username}</Text>
        )}
        {/* Username Status Display */}
        {getUsernameStatusText() && !validationErrors.username && (
          <Text style={[
            styles.statusText,
            { color: getUsernameStatusColor() }
          ]}>
            {getUsernameStatusText()}
          </Text>
        )}
        
        {/* Username Guidelines */}
        {formData.username.length > 0 && usernameStatus === 'idle' && (
          <Text style={styles.hintText}>
            Username must be 3-30 characters, alphanumeric + dots/underscores
          </Text>
        )}
      </View>

      {/* Display Name Input */}
      <View style={styles.inputWrapper}>
        <View style={[
          styles.inputContainer,
          focusedField === 'displayName' && styles.inputFocused,
          validationErrors.displayName && styles.inputError
        ]}>
          <Icon 
            name="person" 
            size={20} 
            color={focusedField === 'displayName' ? '#4ECDC4' : '#8E8E93'} 
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Display Name"
            placeholderTextColor="#8E8E93"
            value={formData.displayName}
            onChangeText={(text) => handleInputChange('displayName', text)}
            onFocus={() => setFocusedField('displayName')}
            onBlur={() => setFocusedField('')}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>
        {validationErrors.displayName && (
          <Text style={styles.errorText}>{validationErrors.displayName}</Text>
        )}
      </View>

      {/* Bio Input (Optional) */}
      <View style={styles.inputWrapper}>
        <View style={[
          styles.inputContainer,
          styles.textAreaContainer,
          focusedField === 'bio' && styles.inputFocused
        ]}>
          <Icon 
            name="document-text" 
            size={20} 
            color={focusedField === 'bio' ? '#4ECDC4' : '#8E8E93'} 
            style={[styles.inputIcon, styles.textAreaIcon]}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Bio (Optional)"
            placeholderTextColor="#8E8E93"
            value={formData.bio}
            onChangeText={(text) => handleInputChange('bio', text)}
            onFocus={() => setFocusedField('bio')}
            onBlur={() => setFocusedField('')}
            multiline
            numberOfLines={3}
            maxLength={150}
            textAlignVertical="top"
          />
        </View>
        <Text style={styles.characterCount}>{formData.bio.length}/150</Text>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Almost Done!</Text>
      <Text style={styles.stepSubtitle}>Review your information and agree to our terms</Text>

      {/* Profile Summary */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Email:</Text>
          <Text style={styles.summaryValue}>{formData.email}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Username:</Text>
          <Text style={styles.summaryValue}>@{formData.username}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Display Name:</Text>
          <Text style={styles.summaryValue}>{formData.displayName}</Text>
        </View>
        {formData.bio && (
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Bio:</Text>
            <Text style={styles.summaryValue}>{formData.bio}</Text>
          </View>
        )}
      </View>

      {/* Terms Agreement */}
      <TouchableOpacity
        style={styles.termsContainer}
        onPress={() => setFormData({ ...formData, agreeToTerms: !formData.agreeToTerms })}
      >
        <Icon
          name={formData.agreeToTerms ? 'checkbox' : 'square-outline'}
          size={24}
          color={formData.agreeToTerms ? '#4ECDC4' : '#8E8E93'}
        />
        <View style={styles.termsTextContainer}>
          <Text style={styles.termsText}>
            I agree to the{' '}
            <Text style={styles.termsLink}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      
      {/* Background Gradient */}
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <Animated.View 
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={currentStep === 1 ? () => navigation.goBack() : handlePreviousStep}
            >
              <Icon name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            
            {/* Logo */}
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={['#FF6B9D', '#4ECDC4', '#45B7D1']}
                style={styles.logoGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.logoText}>J</Text>
              </LinearGradient>
            </View>

            {renderProgressBar()}
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            {currentStep < 3 ? (
              <TouchableOpacity
                style={[styles.nextButton, !canProceedToNextStep() && styles.disabledButton]}
                onPress={handleNextStep}
                disabled={!canProceedToNextStep()}
              >
                <LinearGradient
                  colors={canProceedToNextStep() ? ['#FF6B9D', '#4ECDC4'] : ['#666', '#666']}
                  style={styles.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.buttonText}>Continue</Text>
                  <Icon name="chevron-forward" size={20} color="#fff" style={styles.buttonIcon} />
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.signUpButton, (!canProceedToNextStep() || loading) && styles.disabledButton]}
                onPress={handleSignUp}
                disabled={!canProceedToNextStep() || loading}
              >
                <LinearGradient
                  colors={canProceedToNextStep() && !loading ? ['#FF6B9D', '#4ECDC4'] : ['#666', '#666']}
                  style={styles.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Text style={styles.buttonText}>Create Account</Text>
                      <Icon name="checkmark-circle" size={20} color="#fff" style={styles.buttonIcon} />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}

            <View style={styles.signInLinkContainer}>
              <Text style={styles.signInText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
                <Text style={styles.signInLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    paddingTop: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 20,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  progressContainer: {
    alignItems: 'center',
    width: '100%',
  },
  progressBar: {
    width: '80%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4ECDC4',
    borderRadius: 2,
  },
  progressText: {
    color: '#B0B0B0',
    fontSize: 12,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  stepContainer: {
    paddingVertical: 20,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
    marginBottom: 30,
  },
  inputWrapper: {
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  textAreaContainer: {
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  inputFocused: {
    borderColor: '#4ECDC4',
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
  },
  inputError: {
    borderColor: '#FF6B6B',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  inputSuccess: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  inputIcon: {
    marginRight: 12,
  },
  textAreaIcon: {
    marginTop: 2,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    paddingVertical: 16,
  },
  textArea: {
    minHeight: 80,
    paddingVertical: 8,
  },
  eyeIcon: {
    padding: 4,
  },
  usernameStatus: {
    minWidth: 24,
    alignItems: 'center',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 16,
  },
  statusText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 16,
  },
  hintText: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 4,
    marginLeft: 16,
    fontStyle: 'italic',
  },
  passwordStrengthContainer: {
    marginTop: 4,
    marginLeft: 16,
  },
  successText: {
    color: '#4CAF50',
  },
  checkingText: {
    color: '#4ECDC4',
  },
  characterCount: {
    color: '#8E8E93',
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
  },
  summaryContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    color: '#B0B0B0',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryValue: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  termsTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  termsText: {
    color: '#B0B0B0',
    fontSize: 14,
    lineHeight: 20,
  },
  termsLink: {
    color: '#4ECDC4',
    fontWeight: '600',
  },
  footer: {
    paddingVertical: 20,
  },
  nextButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  signUpButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  buttonGradient: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonIcon: {
    marginLeft: 8,
  },
  signInLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInText: {
    color: '#B0B0B0',
    fontSize: 16,
  },
  signInLink: {
    color: '#4ECDC4',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default EnhancedSignUpScreen;
