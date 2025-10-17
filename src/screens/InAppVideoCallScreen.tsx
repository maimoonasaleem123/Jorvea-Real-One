import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Dimensions,
  StatusBar,
  Image,
  Animated,
  BackHandler,
  Platform,
  Vibration,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MediaStream } from 'react-native-webrtc';
import WebRTCService, { RTCView } from '../services/webrtcService';
import { useAuth } from '../context/FastAuthContext';
import FirebaseService from '../services/firebaseService';

const { width, height } = Dimensions.get('window');

interface VideoCallScreenProps {
  route: {
    params: {
      callId: string;
      isInitiator?: boolean;
      isVideoCall?: boolean;
      otherUser?: {
        uid: string;
        displayName: string;
        profilePicture?: string;
      };
    };
  };
}

export default function InAppVideoCallScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { callId, isInitiator = false, isVideoCall = true, otherUser } = (route.params as any) || {};

  // State variables
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(isVideoCall);
  const [callStatus, setCallStatus] = useState(isInitiator ? 'calling' : 'ringing');
  const [callDuration, setCallDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor' | 'unknown'>('unknown');
  const [isMinimized, setIsMinimized] = useState(false);

  // Refs
  const callStartTime = useRef<Date | null>(null);
  const callTimer = useRef<any>(null);
  const controlsTimer = useRef<any>(null);
  const isCallActive = useRef(true);

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  // Initialize call and setup
  useEffect(() => {
    if (!callId || !user || !otherUser) {
      Alert.alert('Error', 'Invalid call parameters');
      navigation.goBack();
      return;
    }

    const initializeCall = async () => {
      try {
        console.log('Initializing call:', { callId, isInitiator, isVideoCall });
        
        WebRTCService.setCurrentUser(user.uid);
        WebRTCService.setEventHandlers({
          onLocalStream: (stream) => {
            console.log('Local stream received');
            setLocalStream(stream);
          },
          onRemoteStream: (stream) => {
            console.log('Remote stream received');
            setRemoteStream(stream);
            setCallStatus('connected');
            startCallTimer();
          },
          onCallEnded: () => {
            console.log('Call ended callback received');
            if (isCallActive.current) {
              isCallActive.current = false;
              cleanup();
              navigateBack();
            }
          },
          onCallConnected: () => {
            console.log('Call connected');
            setCallStatus('connected');
            startCallTimer();
          },
          onError: (error) => {
            console.error('WebRTC error:', error);
            
            // Prevent multiple error alerts
            if (callStatus !== 'error' && callStatus !== 'ended') {
              setCallStatus('error');
              
              // Only show alert if it's a meaningful error
              if (error && !error.includes('cleanup') && !error.includes('closed')) {
                Alert.alert('Call Error', error, [
                  { 
                    text: 'OK', 
                    onPress: () => {
                      cleanup();
                      navigateBack();
                    }
                  }
                ]);
              } else {
                // Silent cleanup for expected errors
                cleanup();
                navigateBack();
              }
            }
          },
        });

        if (isInitiator) {
          await WebRTCService.initializeCall(callId, true, { isAudioOnly: !isVideoCall });
        } else {
          await WebRTCService.initializeCall(callId, false, { isAudioOnly: !isVideoCall });
        }
      } catch (error) {
        console.error('Error initializing call:', error);
        Alert.alert('Call Error', 'Failed to initialize call', [
          { text: 'OK', onPress: () => navigateBack() }
        ]);
      }
    };

    const cleanup = () => {
      if (callTimer.current) {
        clearTimeout(callTimer.current);
        callTimer.current = null;
      }
      if (controlsTimer.current) {
        clearTimeout(controlsTimer.current);
        controlsTimer.current = null;
      }
    };

    const navigateBack = () => {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainFlow' as never }],
        });
      }
    };

    // Handle hardware back button
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (Platform.OS === 'android') {
        Alert.alert(
          'End Call?',
          'Are you sure you want to end this call?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'End Call', style: 'destructive', onPress: endCall },
          ]
        );
        return true;
      }
      return false;
    });

    initializeCall();

    return () => {
      isCallActive.current = false;
      backHandler.remove();
      cleanup();
    };
  }, []);

  // Entrance animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Mock connection quality tracking
    const qualityInterval = setInterval(() => {
      const qualities = ['excellent', 'good', 'poor'] as const;
      setConnectionQuality(qualities[Math.floor(Math.random() * qualities.length)]);
    }, 10000);

    return () => clearInterval(qualityInterval);
  }, []);

  // Pulse animation for ringing state
  useEffect(() => {
    if (callStatus === 'ringing' || callStatus === 'calling') {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    }
  }, [callStatus]);

  // Auto-hide controls
  useEffect(() => {
    if (isVideoCall && remoteStream && showControls) {
      controlsTimer.current = setTimeout(() => {
        setShowControls(false);
      }, 5000);
    }

    return () => {
      if (controlsTimer.current) {
        clearTimeout(controlsTimer.current);
      }
    };
  }, [showControls, remoteStream, isVideoCall]);

  // Controls visibility animation
  useEffect(() => {
    Animated.timing(controlsOpacity, {
      toValue: showControls ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showControls]);

  const startCallTimer = () => {
    if (!callStartTime.current) {
      callStartTime.current = new Date();
      callTimer.current = setInterval(() => {
        if (callStartTime.current) {
          const duration = Math.floor((Date.now() - callStartTime.current.getTime()) / 1000);
          setCallDuration(duration);
        }
      }, 1000);
    }
  };

  const formatCallDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const endCall = async () => {
    try {
      isCallActive.current = false;
      
      if (callTimer.current) {
        clearTimeout(callTimer.current);
        callTimer.current = null;
      }
      if (controlsTimer.current) {
        clearTimeout(controlsTimer.current);
        controlsTimer.current = null;
      }
      
      await WebRTCService.endCallManually();
      
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainFlow' as never }],
        });
      }
    } catch (error) {
      console.error('Error ending call:', error);
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainFlow' as never }],
        });
      }
    }
  };

  const handleAnswerCall = async () => {
    try {
      console.log('User pressed answer button');
      Vibration.cancel();
      
      setCallStatus('connecting');
      
      await WebRTCService.answerCall();
      
      // Don't immediately set to connected, wait for onCallConnected callback
      console.log('Answer call request sent, waiting for connection...');
    } catch (error) {
      console.error('Error answering call:', error);
      setCallStatus('error');
      Alert.alert('Error', 'Failed to answer call', [
        { text: 'OK', onPress: () => handleRejectCall() }
      ]);
    }
  };

  const handleRejectCall = async () => {
    try {
      Vibration.cancel();
      await WebRTCService.rejectCall();
      isCallActive.current = false;
      
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainFlow' as never }],
        });
      }
    } catch (error) {
      console.error('Error rejecting call:', error);
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainFlow' as never }],
        });
      }
    }
  };

  const handleToggleMute = async () => {
    try {
      await WebRTCService.toggleMute();
      setIsMuted(!isMuted);
      Vibration.vibrate(50);
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  };

  const handleToggleCamera = async () => {
    try {
      await WebRTCService.toggleCamera();
      setIsCameraOff(!isCameraOff);
      Vibration.vibrate(50);
    } catch (error) {
      console.error('Error toggling camera:', error);
    }
  };

  const handleToggleSpeaker = async () => {
    try {
      await WebRTCService.toggleSpeaker();
      setIsSpeakerOn(!isSpeakerOn);
      Vibration.vibrate(50);
    } catch (error) {
      console.error('Error toggling speaker:', error);
    }
  };

  const toggleControlsVisibility = () => {
    if (isVideoCall && remoteStream) {
      setShowControls(!showControls);
    }
  };

  const getConnectionQualityColor = () => {
    switch (connectionQuality) {
      case 'excellent': return '#4CAF50';
      case 'good': return '#FF9800';
      case 'poor': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const renderConnectionIndicator = () => (
    <View style={styles.connectionIndicator}>
      <View style={[styles.connectionDot, { backgroundColor: getConnectionQualityColor() }]} />
      <Text style={styles.connectionText}>
        {connectionQuality === 'unknown' ? 'Connecting...' : connectionQuality}
      </Text>
    </View>
  );

  const renderAudioCallUI = () => (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <SafeAreaView style={styles.audioCallContainer}>
        {/* Connection indicator */}
        {renderConnectionIndicator()}

        {/* Avatar section */}
        <View style={styles.avatarContainer}>
          <Animated.View style={[styles.avatarWrapper, { transform: [{ scale: pulseAnim }] }]}>
            <Image
              source={{
                uri: otherUser?.profilePicture || 
                     `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser?.displayName || 'User')}&background=E1306C&color=fff&size=200`
              }}
              style={styles.avatar}
            />
          </Animated.View>
          {callStatus === 'connected' && (
            <View style={styles.callStatusBadge}>
              <Icon name="call" size={12} color="#4CAF50" />
            </View>
          )}
        </View>

        {/* Caller info */}
        <Text style={styles.callerName}>{otherUser?.displayName || 'Unknown'}</Text>
        <Text style={styles.callStatusText}>
          {callStatus === 'ringing' && 'Incoming audio call...'}
          {callStatus === 'calling' && 'Calling...'}
          {callStatus === 'connecting' && 'Connecting...'}
          {callStatus === 'connected' && formatCallDuration(callDuration)}
        </Text>

        {/* Controls */}
        <Animated.View style={[styles.audioControls, { transform: [{ translateY: slideAnim }] }]}>
          {callStatus === 'ringing' && (
            <>
              <TouchableOpacity style={styles.rejectButton} onPress={handleRejectCall}>
                <Icon name="call" size={30} color="#fff" />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.answerButton} onPress={handleAnswerCall}>
                <Icon name="call" size={30} color="#fff" />
              </TouchableOpacity>
            </>
          )}

          {(callStatus === 'calling' || callStatus === 'connecting' || callStatus === 'connected') && (
            <>
              <TouchableOpacity
                style={[styles.controlButton, isMuted && styles.controlButtonActive]}
                onPress={handleToggleMute}
              >
                <Icon name={isMuted ? "mic-off" : "mic"} size={24} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
                onPress={handleToggleSpeaker}
              >
                <Icon name="volume-high" size={24} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.endCallButton} onPress={endCall}>
                <Icon name="call" size={30} color="#fff" />
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </SafeAreaView>
    </Animated.View>
  );

  const renderVideoCallUI = () => (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <TouchableOpacity 
        style={styles.videoContainer} 
        activeOpacity={1}
        onPress={toggleControlsVisibility}
      >
        {/* Remote video */}
        {remoteStream ? (
          <RTCView
            style={styles.remoteVideo}
            streamURL={remoteStream.toURL()}
            objectFit="cover"
          />
        ) : (
          <View style={styles.remoteVideoPlaceholder}>
            <Animated.View style={[styles.placeholderAvatar, { transform: [{ scale: pulseAnim }] }]}>
              <Image
                source={{
                  uri: otherUser?.profilePicture || 
                       `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser?.displayName || 'User')}&background=E1306C&color=fff&size=200`
                }}
                style={styles.placeholderAvatarImage}
              />
            </Animated.View>
            <Text style={styles.placeholderText}>
              {callStatus === 'calling' && 'Calling...'}
              {callStatus === 'ringing' && 'Incoming video call'}
              {callStatus === 'connecting' && 'Connecting...'}
              {callStatus === 'connected' && 'Camera is off'}
            </Text>
          </View>
        )}

        {/* Local video */}
        {localStream && !isCameraOff && (
          <View style={styles.localVideoContainer}>
            <RTCView
              style={styles.localVideo}
              streamURL={localStream.toURL()}
              objectFit="cover"
              mirror={true}
            />
          </View>
        )}

        {/* Controls overlay */}
        {showControls && (
          <Animated.View style={[styles.videoControlsOverlay, { opacity: controlsOpacity }]}>
            {/* Top controls */}
            <View style={styles.topControls}>
              {renderConnectionIndicator()}
              <Text style={styles.callerNameVideo}>{otherUser?.displayName || 'Unknown'}</Text>
              {callStatus === 'connected' && (
                <Text style={styles.callDurationVideo}>{formatCallDuration(callDuration)}</Text>
              )}
            </View>

            {/* Bottom controls */}
            <Animated.View style={[styles.bottomControls, { transform: [{ translateY: slideAnim }] }]}>
              {callStatus === 'ringing' && (
                <>
                  <TouchableOpacity style={styles.rejectButtonVideo} onPress={handleRejectCall}>
                    <Icon name="call" size={30} color="#fff" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.answerButtonVideo} onPress={handleAnswerCall}>
                    <Icon name="call" size={30} color="#fff" />
                  </TouchableOpacity>
                </>
              )}

              {(callStatus === 'calling' || callStatus === 'connecting' || callStatus === 'connected') && (
                <>
                  <TouchableOpacity
                    style={[styles.videoControlButton, isMuted && styles.videoControlButtonActive]}
                    onPress={handleToggleMute}
                  >
                    <Icon name={isMuted ? "mic-off" : "mic"} size={24} color="#fff" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.videoControlButton, isCameraOff && styles.videoControlButtonActive]}
                    onPress={handleToggleCamera}
                  >
                    <Icon name={isCameraOff ? "videocam-off" : "videocam"} size={24} color="#fff" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.videoControlButton, isSpeakerOn && styles.videoControlButtonActive]}
                    onPress={handleToggleSpeaker}
                  >
                    <Icon name="volume-high" size={24} color="#fff" />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.endCallButtonVideo} onPress={endCall}>
                    <Icon name="call" size={30} color="#fff" />
                  </TouchableOpacity>
                </>
              )}
            </Animated.View>
          </Animated.View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );

  return isVideoCall ? renderVideoCallUI() : renderAudioCallUI();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  
  // Connection indicator
  connectionIndicator: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 1000,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  connectionText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },

  // Audio Call Styles
  audioCallContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#667eea',
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: height * 0.05,
    position: 'relative',
  },
  avatarWrapper: {
    width: Math.min(width * 0.4, 180),
    height: Math.min(width * 0.4, 180),
    borderRadius: Math.min(width * 0.2, 90),
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  avatar: {
    width: Math.min(width * 0.35, 160),
    height: Math.min(width * 0.35, 160),
    borderRadius: Math.min(width * 0.175, 80),
  },
  callStatusBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callerName: {
    fontSize: Math.min(width * 0.07, 28),
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  callStatusText: {
    fontSize: Math.min(width * 0.04, 16),
    color: 'rgba(255,255,255,0.8)',
    marginBottom: height * 0.08,
    textAlign: 'center',
  },
  audioControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: width * 0.08,
    paddingBottom: 30,
  },
  controlButton: {
    width: Math.min(width * 0.15, 60),
    height: Math.min(width * 0.15, 60),
    borderRadius: Math.min(width * 0.075, 30),
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  controlButtonActive: {
    backgroundColor: '#ff3b30',
  },
  answerButton: {
    width: Math.min(width * 0.2, 80),
    height: Math.min(width * 0.2, 80),
    borderRadius: Math.min(width * 0.1, 40),
    backgroundColor: '#4caf50',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  rejectButton: {
    width: Math.min(width * 0.2, 80),
    height: Math.min(width * 0.2, 80),
    borderRadius: Math.min(width * 0.1, 40),
    backgroundColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '135deg' }],
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  endCallButton: {
    width: Math.min(width * 0.2, 80),
    height: Math.min(width * 0.2, 80),
    borderRadius: Math.min(width * 0.1, 40),
    backgroundColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '135deg' }],
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },

  // Video Call Styles
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  remoteVideo: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  remoteVideoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  placeholderAvatar: {
    width: Math.min(width * 0.3, 120),
    height: Math.min(width * 0.3, 120),
    borderRadius: Math.min(width * 0.15, 60),
    marginBottom: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  placeholderAvatarImage: {
    width: Math.min(width * 0.3, 120),
    height: Math.min(width * 0.3, 120),
    borderRadius: Math.min(width * 0.15, 60),
  },
  placeholderText: {
    fontSize: Math.min(width * 0.045, 18),
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  localVideoContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    right: 20,
    width: Math.min(width * 0.3, 120),
    height: Math.min(width * 0.4, 160),
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  localVideo: {
    width: '100%',
    height: '100%',
  },
  videoControlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    paddingVertical: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  topControls: {
    alignItems: 'center',
    paddingTop: 20,
  },
  callerNameVideo: {
    fontSize: Math.min(width * 0.055, 22),
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    paddingHorizontal: 20,
  },
  callDurationVideo: {
    fontSize: Math.min(width * 0.035, 14),
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Math.min(width * 0.06, 25),
    paddingBottom: 20,
    flexWrap: 'wrap',
  },
  videoControlButton: {
    width: Math.min(width * 0.14, 56),
    height: Math.min(width * 0.14, 56),
    borderRadius: Math.min(width * 0.07, 28),
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  videoControlButtonActive: {
    backgroundColor: '#ff3b30',
  },
  answerButtonVideo: {
    width: Math.min(width * 0.175, 70),
    height: Math.min(width * 0.175, 70),
    borderRadius: Math.min(width * 0.0875, 35),
    backgroundColor: '#4caf50',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  rejectButtonVideo: {
    width: Math.min(width * 0.175, 70),
    height: Math.min(width * 0.175, 70),
    borderRadius: Math.min(width * 0.0875, 35),
    backgroundColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '135deg' }],
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  endCallButtonVideo: {
    width: Math.min(width * 0.175, 70),
    height: Math.min(width * 0.175, 70),
    borderRadius: Math.min(width * 0.0875, 35),
    backgroundColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '135deg' }],
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
});
