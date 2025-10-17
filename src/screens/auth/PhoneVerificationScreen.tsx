import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../../types';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';

const { width, height } = Dimensions.get('window');

type PhoneVerificationScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'PhoneVerification'>;

interface RouteParams {
  phoneNumber: string;
  fromSignUp?: boolean;
}

function PhoneVerificationScreen(): React.JSX.Element {
  const navigation = useNavigation<PhoneVerificationScreenNavigationProp>();
  const route = useRoute();
  const { phoneNumber, fromSignUp = false } = (route.params as RouteParams) || {};

  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Refs for OTP inputs
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

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

    // Auto-focus first input
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 500);
  }, []);

  useEffect(() => {
    // Countdown timer
    let timer: NodeJS.Timeout;
    if (countdown > 0 && !canResend) {
      timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (countdown === 0) {
      setCanResend(true);
    }
    return () => clearTimeout(timer);
  }, [countdown, canResend]);

  useEffect(() => {
    // Pulse animation for loading state
    if (isLoading) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    }
  }, [isLoading]);

  const handleCodeChange = (text: string, index: number) => {
    const newCode = [...verificationCode];
    newCode[index] = text;
    setVerificationCode(newCode);

    // Auto-focus next input
    if (text.length === 1 && index < 5) {
      inputRefs.current[index + 1]?.focus();
      setFocusedIndex(index + 1);
    }

    // Auto-verify when all fields are filled
    if (newCode.every(digit => digit.length === 1)) {
      handleVerifyCode(newCode.join(''));
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !verificationCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      setFocusedIndex(index - 1);
    }
  };

  const handleVerifyCode = async (code?: string) => {
    const codeToVerify = code || verificationCode.join('');
    
    if (codeToVerify.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the complete 6-digit verification code');
      return;
    }

    setIsLoading(true);
    try {
      // Simulate phone verification (replace with actual implementation)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In a real implementation, you would verify the code with your backend
      // For now, we'll simulate a successful verification
      Alert.alert(
        'Phone Verified!', 
        'Your phone number has been successfully verified.',
        [
          {
            text: 'Continue',
            onPress: () => {
              if (fromSignUp) {
                navigation.navigate('Home' as any);
              } else {
                navigation.goBack();
              }
            }
          }
        ]
      );
    } catch (error: any) {
      Alert.alert('Verification Failed', error.message || 'Invalid verification code. Please try again.');
      // Clear the code on error
      setVerificationCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      setFocusedIndex(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!canResend || isResending) return;

    setIsResending(true);
    try {
      // Simulate sending SMS (replace with actual implementation)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      Alert.alert('Code Sent', 'A new verification code has been sent to your phone');
      setCountdown(60);
      setCanResend(false);
      // Clear current code
      setVerificationCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      setFocusedIndex(0);
    } catch (error: any) {
      Alert.alert('Failed to Send Code', error.message || 'Please try again');
    } finally {
      setIsResending(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPhoneNumber = (phone: string) => {
    // Format phone number for display (e.g., +1 (555) 123-4567)
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length >= 10) {
      const match = cleaned.match(/^(\d{1,3})(\d{3})(\d{3})(\d{4})$/);
      if (match) {
        return `+${match[1]} (${match[2]}) ${match[3]}-${match[4]}`;
      }
    }
    return phone;
  };

  const renderOTPInputs = () => (
    <View style={styles.otpContainer}>
      {verificationCode.map((digit, index) => (
        <Animated.View
          key={index}
          style={[
            styles.otpInputWrapper,
            {
              transform: [{ scale: isLoading ? pulseAnim : 1 }]
            }
          ]}
        >
          <TextInput
            ref={(ref) => (inputRefs.current[index] = ref)}
            style={[
              styles.otpInput,
              focusedIndex === index && styles.otpInputFocused,
              digit.length === 1 && styles.otpInputFilled,
            ]}
            value={digit}
            onChangeText={(text) => handleCodeChange(text.replace(/[^0-9]/g, '').slice(0, 1), index)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
            onFocus={() => setFocusedIndex(index)}
            maxLength={1}
            keyboardType="numeric"
            textAlign="center"
            selectTextOnFocus
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
          />
          {digit.length === 1 && (
            <View style={styles.checkmarkContainer}>
              <Icon name="checkmark" size={16} color="#4CAF50" />
            </View>
          )}
        </Animated.View>
      ))}
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
              onPress={() => navigation.goBack()}
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
          </View>

          {/* Main Content */}
          <View style={styles.mainContent}>
            {/* Phone Icon */}
            <View style={styles.phoneIconContainer}>
              <LinearGradient
                colors={['rgba(78, 205, 196, 0.2)', 'rgba(78, 205, 196, 0.1)']}
                style={styles.phoneIconGradient}
              >
                <Icon name="call" size={48} color="#4ECDC4" />
              </LinearGradient>
            </View>

            {/* Title and Description */}
            <Text style={styles.title}>Verify Your Phone</Text>
            <Text style={styles.subtitle}>
              We've sent a 6-digit verification code to
            </Text>
            <Text style={styles.phoneNumber}>{formatPhoneNumber(phoneNumber)}</Text>
            <Text style={styles.description}>
              Enter the code below to verify your phone number
            </Text>

            {/* OTP Input */}
            {renderOTPInputs()}

            {/* Loading State */}
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4ECDC4" />
                <Text style={styles.loadingText}>Verifying code...</Text>
              </View>
            )}

            {/* Verify Button */}
            {!isLoading && verificationCode.every(digit => digit.length === 1) && (
              <TouchableOpacity
                style={styles.verifyButton}
                onPress={() => handleVerifyCode()}
              >
                <LinearGradient
                  colors={['#FF6B9D', '#4ECDC4']}
                  style={styles.verifyButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.verifyButtonText}>Verify Phone</Text>
                  <Icon name="checkmark-circle" size={20} color="#fff" style={styles.verifyButtonIcon} />
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            {/* Resend Code */}
            <View style={styles.resendContainer}>
              <Text style={styles.resendText}>Didn't receive the code? </Text>
              {canResend ? (
                <TouchableOpacity 
                  onPress={handleResendCode}
                  disabled={isResending}
                >
                  <Text style={styles.resendLink}>
                    {isResending ? 'Sending...' : 'Resend Code'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.countdownText}>
                  Resend in {formatTime(countdown)}
                </Text>
              )}
            </View>

            {/* Tips */}
            <View style={styles.tipsContainer}>
              <Icon name="information-circle-outline" size={16} color="#8E8E93" />
              <Text style={styles.tipsText}>
                Make sure your phone has signal and can receive SMS messages
              </Text>
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
    marginBottom: 40,
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
  mainContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 20,
  },
  phoneIconContainer: {
    marginBottom: 30,
  },
  phoneIconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(78, 205, 196, 0.3)',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
    marginBottom: 4,
  },
  phoneNumber: {
    fontSize: 16,
    color: '#4ECDC4',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 40,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 300,
    marginBottom: 30,
  },
  otpInputWrapper: {
    position: 'relative',
  },
  otpInput: {
    width: 45,
    height: 55,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 2,
    borderColor: 'transparent',
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  otpInputFocused: {
    borderColor: '#4ECDC4',
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
  },
  otpInputFilled: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  checkmarkContainer: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1a1a2e',
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  loadingText: {
    color: '#4ECDC4',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '600',
  },
  verifyButton: {
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 300,
  },
  verifyButtonGradient: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  verifyButtonIcon: {
    marginLeft: 8,
  },
  footer: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  resendText: {
    color: '#B0B0B0',
    fontSize: 14,
  },
  resendLink: {
    color: '#4ECDC4',
    fontSize: 14,
    fontWeight: '600',
  },
  countdownText: {
    color: '#8E8E93',
    fontSize: 14,
  },
  tipsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    maxWidth: 320,
  },
  tipsText: {
    color: '#8E8E93',
    fontSize: 12,
    marginLeft: 8,
    textAlign: 'center',
    flex: 1,
  },
});

export default PhoneVerificationScreen;
