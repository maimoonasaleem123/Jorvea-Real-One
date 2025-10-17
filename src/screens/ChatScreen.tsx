import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
  Linking,
  PermissionsAndroid,
  ImageStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { launchImageLibrary, MediaType, PhotoQuality } from 'react-native-image-picker';
import Video from 'react-native-video';
import VideoMessagePlayer from '../components/VideoMessagePlayer';
import { SimpleVoicePlayer, SimpleVoiceRecorder } from '../components/SimpleVoiceComponents';
import { SharedReelMessage, SharedPostMessage } from '../components/SharedContentMessage';
import { useTheme } from '../context/ThemeContext';
import Sound from 'react-native-sound';
import { useAuth } from '../context/FastAuthContext';
import DigitalOceanService from '../services/digitalOceanService';
import FirebaseService, { ChatMessage, Chat } from '../services/firebaseService';
import { firebaseFirestore, COLLECTIONS } from '../config/firebase';
import JitsiService from '../services/jitsiService';
import WebRTCService from '../services/webrtcService';
import PerfectChatService from '../services/PerfectChatService';
import UltraFastShareService from '../services/UltraFastShareService';
import { User } from '../types';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import firestore from '@react-native-firebase/firestore';

const { width } = Dimensions.get('window');

// Instagram-style message cache for instant loading
const messageCache = new Map<string, ChatMessage[]>();
const messageCacheTime = new Map<string, number>();
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes cache for instant loading

interface ChatScreenProps {
  route?: {
    params?: {
      chatId?: string;
      userId?: string;
      user?: User;
      shareContent?: {
        type: 'post' | 'reel';
        id: string;
        mediaUrls?: string[];
        videoUrl?: string;
        caption?: string;
        userName: string;
        userProfilePicture?: string;
        thumbnailUrl?: string;
        createdAt?: Date;
      };
    };
  };
}

// Voice Message Player Component
interface VoiceMessagePlayerProps {
  audioUrl: string;
  isMyMessage: boolean;
  duration: string;
}

const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({ audioUrl, isMyMessage, duration }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef<Sound | null>(null);

  useEffect(() => {
    // Enable playback in silence mode
    Sound.setCategory('Playback');
    
    return () => {
      if (soundRef.current) {
        soundRef.current.release();
      }
    };
  }, []);

  const playAudio = async () => {
    try {
      if (isPlaying && soundRef.current) {
        soundRef.current.pause();
        setIsPlaying(false);
        return;
      }

      if (soundRef.current) {
        soundRef.current.play((success) => {
          if (success) {
            setIsPlaying(false);
          }
        });
        setIsPlaying(true);
      } else {
        // Create new Sound instance
        soundRef.current = new Sound(audioUrl, '', (error) => {
          if (error) {
            console.error('Failed to load sound:', error);
            // For demo purposes, we'll just show that it's playing
            setIsPlaying(true);
            setTimeout(() => setIsPlaying(false), 3000);
            return;
          }
          
          soundRef.current?.play((success) => {
            if (success) {
              setIsPlaying(false);
            }
          });
          setIsPlaying(true);
        });
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsPlaying(false);
    }
  };

  const formatAudioTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[
      styles.voiceMessageContainer,
      isMyMessage ? styles.myVoiceMessage : styles.otherVoiceMessage
    ]}>
      <TouchableOpacity onPress={playAudio} style={styles.playButton}>
        <Icon 
          name={isPlaying ? "pause" : "play"} 
          size={20} 
          color={isMyMessage ? "#fff" : "#007AFF"} 
        />
      </TouchableOpacity>
      
      <View style={styles.audioInfo}>
        <View style={[
          styles.waveform,
          isMyMessage ? styles.myWaveform : styles.otherWaveform
        ]}>
          {/* Simple waveform visualization */}
          {[...Array(20)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.waveBar,
                {
                  height: Math.random() * 20 + 10,
                  backgroundColor: isMyMessage ? 'rgba(255,255,255,0.7)' : 'rgba(0,122,255,0.7)',
                  opacity: isPlaying && i < 10 ? 1 : 0.3,
                }
              ]}
            />
          ))}
        </View>
        
        <Text style={[
          styles.audioDuration,
          isMyMessage ? styles.myAudioDuration : styles.otherAudioDuration
        ]}>
          {duration}
        </Text>
      </View>
    </View>
  );
};

interface ChatScreenProps {
  route?: any; // Simplified to accept any params structure
}

export default function ChatScreen({ route }: ChatScreenProps): React.JSX.Element {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatData, setChatData] = useState<Chat | null>(null);
  const [otherUser, setOtherUser] = useState<User | null>(route?.params?.user || null);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const [chatId, setChatId] = useState<string | undefined>(route?.params?.chatId);
  
  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [recordTime, setRecordTime] = useState('00:00');
  const [currentRecordingPath, setCurrentRecordingPath] = useState<string>('');
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const recordingTimer = useRef<any>(null);

  // Initialize chat
  const initializeChat = useCallback(async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'User not authenticated');
      navigation.goBack();
      return;
    }

    try {
      setLoading(true);
      let currentChatId = chatId;

      // Get the other user ID from various parameter formats
      const otherUserId = (route?.params as any)?.userId || (route?.params as any)?.otherUserId;

      // If we have a userId but no chatId, create or get chat
      if (!currentChatId && otherUserId) {
        console.log('🔄 Creating/getting chat between:', user.uid, 'and', otherUserId);
        
        // Validate that we have valid user IDs
        if (!user.uid || !otherUserId || user.uid === otherUserId) {
          throw new Error('Invalid user IDs for chat creation');
        }

        // Try using the improved UltraFastShareService
        try {
          const shareService = UltraFastShareService.getInstance();
          currentChatId = await shareService.getOrCreateChat(user.uid, otherUserId);
          setChatId(currentChatId);
          console.log('✅ Chat created/found:', currentChatId);
        } catch (shareServiceError) {
          console.warn('⚠️ UltraFastShareService failed, trying FirebaseService:', shareServiceError);
          
          // Fallback to FirebaseService if UltraFastShareService fails
          currentChatId = await FirebaseService.createOrGetChat([user.uid, otherUserId]);
          setChatId(currentChatId);
          console.log('✅ Chat created/found via fallback:', currentChatId);
        }
      }

      if (!currentChatId) {
        Alert.alert('Error', 'Unable to initialize chat');
        navigation.goBack();
        return;
      }

      // Set a basic otherUser if we have the data from params
      if (!otherUser && (route?.params as any)?.otherUserName) {
        setOtherUser({
          uid: otherUserId || '',
          displayName: (route?.params as any)?.otherUserName,
          profilePicture: (route?.params as any)?.otherUserAvatar,
          username: (route?.params as any)?.otherUserName,
        } as User);
      }

      // Try to load chat data (optional, don't fail if this doesn't work)
      try {
        const chatDoc = await firebaseFirestore.collection(COLLECTIONS.CHATS).doc(currentChatId).get();
        if (chatDoc.exists()) {
          const chat = { id: chatDoc.id, ...chatDoc.data() } as Chat;
          setChatData(chat);

          // Get other user data if not provided
          if (!otherUser) {
            const otherParticipantId = chat.participants.find(id => id !== user.uid);
            if (otherParticipantId) {
              console.log('👤 Loading other user profile:', otherParticipantId);
              const userData = await FirebaseService.getUserProfile(otherParticipantId);
              setOtherUser(userData);
            }
          }
        }
      } catch (chatDataError) {
        console.warn('⚠️ Could not load chat data, continuing anyway:', chatDataError);
      }

      // Load messages
      loadMessages(currentChatId);

      // Try to mark messages as read (optional)
      try {
        await FirebaseService.markMessagesAsRead(currentChatId, user.uid);
      } catch (markReadError) {
        console.warn('⚠️ Could not mark messages as read:', markReadError);
      }
    } catch (error) {
      console.error('❌ Error initializing chat:', error);
      Alert.alert('Failed to Initialize Chat', `Could not start conversation. Please try again.\n\nError: ${error.message}`);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [user, chatId, route?.params, otherUser, navigation]);

  const loadMessages = useCallback(async (chatId: string) => {
    try {
      console.log('🔄 ChatScreen: Loading messages for chat:', chatId);
      
      // Check cache first for INSTANT loading
      const now = Date.now();
      const cacheKey = `messages_${chatId}`;
      const lastCacheTime = messageCacheTime.get(cacheKey) || 0;
      
      // Return cached messages immediately for instant loading
      if (messageCache.has(cacheKey) && (now - lastCacheTime) < CACHE_DURATION) {
        console.log('⚡ Using cached messages for instant loading');
        const cachedMessages = messageCache.get(cacheKey) || [];
        setMessages(cachedMessages);
      }
      
      // Load ONLY last 20 messages from Firebase (Instagram-style)
      const messagesData = await FirebaseService.getMessages(chatId, 20);
      
      // Validate and process messages with support for shared content
      const validMessages = messagesData.filter(msg => {
        // Check for valid content - either regular message, media, or shared content
        const hasValidContent = msg.message || msg.mediaUrl || msg.content || (msg.type && (msg.reelData || msg.postData));
        const hasValidSender = msg.senderId; // Don't require senderName for now
        
        if (!hasValidContent) {
          console.log('⚠️ Invalid message content:', msg.id, 'Message:', msg);
        }
        if (!hasValidSender) {
          console.log('⚠️ Invalid message sender:', msg.id, 'Message:', msg);
        }
        
        return hasValidContent && hasValidSender;
      });

      console.log(`📊 ChatScreen: Loaded last ${validMessages.length} messages (Instagram-style)`);
      setMessages(validMessages); // Keep Firebase order (newest first), FlatList will reverse it
      
      // Update cache
      messageCache.set(cacheKey, validMessages);
      messageCacheTime.set(cacheKey, now);
      
    } catch (error) {
      console.error('Error loading messages:', error);
      Alert.alert('Error', 'Failed to load messages. Please try again.');
    }
  }, []);

  // Set up real-time message listener - FIXED FOR INDEX ISSUES
  useEffect(() => {
    if (!chatId || !user) return;

    console.log('🔄 ChatScreen: Setting up real-time listener for chat:', chatId);

    let unsubscribe: () => void;

    // Try with participants filter first
    try {
      unsubscribe = firebaseFirestore
        .collection(COLLECTIONS.MESSAGES)
        .where('chatId', '==', chatId)
        .where('participants', 'array-contains', user.uid)
        .orderBy('createdAt', 'desc')
        .limit(20)
        .onSnapshot(
          snapshot => {
            const newMessages = snapshot.docs.map(doc => {
              const messageData = doc.data();
              
              // Process media URL if present
              let processedMediaUrl = messageData.mediaUrl;
              if (processedMediaUrl && typeof processedMediaUrl === 'string') {
                // Ensure proper URL formatting for DigitalOcean
                if (!processedMediaUrl.startsWith('http')) {
                  const baseUrl = 'https://jorvea.fra1.digitaloceanspaces.com';
                  processedMediaUrl = processedMediaUrl.startsWith('/') ? 
                    `${baseUrl}${processedMediaUrl}` : 
                    `${baseUrl}/${processedMediaUrl}`;
                }
              }

              // Convert Firebase Timestamp to Date for proper sorting
              let createdAtDate = messageData.createdAt;
              if (messageData.createdAt?.toDate) {
                // Firebase Timestamp
                createdAtDate = messageData.createdAt.toDate();
              } else if (typeof messageData.createdAt === 'string') {
                // String timestamp
                createdAtDate = new Date(messageData.createdAt);
              } else {
                // Fallback
                createdAtDate = new Date();
              }

              return {
                id: doc.id,
                ...messageData,
                mediaUrl: processedMediaUrl,
                createdAt: createdAtDate,
              };
            }) as ChatMessage[];
            
            // Validate messages with support for shared content
            const validMessages = newMessages.filter(msg => {
              const hasValidContent = msg.message || msg.mediaUrl || msg.content || (msg.type && (msg.reelData || msg.postData));
              const hasValidSender = msg.senderId; // Don't require senderName for real-time updates
              return hasValidContent && hasValidSender;
            });

            console.log('📊 ChatScreen: Real-time messages updated:', validMessages.length);
            setMessages(validMessages); // Messages in chronological order (oldest first)
            
            // Auto-scroll to bottom when new messages arrive
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          },
          error => {
            console.error('Error listening to messages:', error);
            
            // If index error, try fallback without participants filter
            if (error.code === 'failed-precondition' && error.message.includes('index')) {
              console.warn('⚠️ Index still building, using fallback listener...');
              
              unsubscribe = firebaseFirestore
                .collection(COLLECTIONS.MESSAGES)
                .where('chatId', '==', chatId)
                .orderBy('createdAt', 'desc')
                .limit(20)
                .onSnapshot(
                  snapshot => {
                    const newMessages = snapshot.docs
                      .map(doc => {
                        const messageData = doc.data();
                        
                        // Client-side filter for participants
                        if (!messageData.participants || !messageData.participants.includes(user.uid)) {
                          return null;
                        }
                        
                        // Process media URL if present
                        let processedMediaUrl = messageData.mediaUrl;
                        if (processedMediaUrl && typeof processedMediaUrl === 'string') {
                          if (!processedMediaUrl.startsWith('http')) {
                            const baseUrl = 'https://jorvea.fra1.digitaloceanspaces.com';
                            processedMediaUrl = processedMediaUrl.startsWith('/') ? 
                              `${baseUrl}${processedMediaUrl}` : 
                              `${baseUrl}/${processedMediaUrl}`;
                          }
                        }

                        // Convert Firebase Timestamp to Date for proper sorting
                        let createdAtDate = messageData.createdAt;
                        if (messageData.createdAt?.toDate) {
                          createdAtDate = messageData.createdAt.toDate();
                        } else if (typeof messageData.createdAt === 'string') {
                          createdAtDate = new Date(messageData.createdAt);
                        } else {
                          createdAtDate = new Date();
                        }

                        return {
                          id: doc.id,
                          ...messageData,
                          mediaUrl: processedMediaUrl,
                          createdAt: createdAtDate,
                        };
                      })
                      .filter(Boolean) as ChatMessage[];
                    
                    // Validate messages with support for shared content
                    const validMessages = newMessages.filter(msg => {
                      const hasValidContent = msg.message || msg.mediaUrl || msg.content || (msg.type && (msg.reelData || msg.postData));
                      const hasValidSender = msg.senderId;
                      return hasValidContent && hasValidSender;
                    });

                    console.log('📊 ChatScreen: Fallback real-time messages updated:', validMessages.length);
                    setMessages(validMessages);
                    
                    setTimeout(() => {
                      flatListRef.current?.scrollToEnd({ animated: true });
                    }, 100);
                  },
                  fallbackError => {
                    console.error('❌ Fallback listener also failed:', fallbackError);
                    Alert.alert('Connection Error', 'Unable to load chat messages. Please try again.');
                  }
                );
            } else {
              Alert.alert('Connection Error', 'Lost connection to chat. Please refresh.');
            }
          }
        );
    } catch (setupError) {
      console.error('❌ Error setting up listener:', setupError);
    }

    return () => unsubscribe?.();
  }, [chatId, user]);

  useEffect(() => {
    initializeChat();
  }, [initializeChat]);

  // Request audio permissions
  const requestAudioPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Audio Recording Permission',
            message: 'This app needs access to your microphone to record voice messages.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('Error requesting audio permission:', err);
        return false;
      }
    }
    return true; // iOS permissions are handled in Info.plist
  };

  // Start voice recording
  const startRecording = async () => {
    try {
      const hasPermission = await requestAudioPermission();
      if (!hasPermission) {
        Alert.alert('Permission Denied', 'Microphone permission is required to record voice messages.');
        return;
      }

      // For now, we'll simulate recording since we don't have a working audio recorder
      // In a real implementation, you would use a native module or working audio library
      setIsRecording(true);
      setShowVoiceModal(true);
      setRecordSecs(0);
      setRecordTime('00:00');
      
      // Simulate recording timer
      recordingTimer.current = setInterval(() => {
        setRecordSecs(prev => {
          const newSecs = prev + 1;
          const mins = Math.floor(newSecs / 60);
          const secs = newSecs % 60;
          setRecordTime(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
          return newSecs;
        });
      }, 1000);
      
      // Simulate recording path
      setCurrentRecordingPath(`simulated_recording_${Date.now()}.m4a`);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  // Stop voice recording
  const stopRecording = async () => {
    try {
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }
      setIsRecording(false);
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  };

  // Enhanced send voice message with intelligent storage
  const sendVoiceMessage = async () => {
    if (!currentRecordingPath || !chatId || !user) {
      Alert.alert('Error', 'No recording found or invalid chat state.');
      return;
    }

    try {
      setUploading(true);
      setShowVoiceModal(false);
      
      let audioUrl: string;
      
      // Get file size for intelligent storage decision
      const fileStat = await require('react-native-fs').stat(currentRecordingPath);
      const fileSize = fileStat.size || 0;
      const useServerForVoice = shouldUseServerStorage(fileSize, 'audio');
      
      if (useServerForVoice) {
        try {
          // Try to upload actual audio file to server
          const audioFileName = `voice_${user.uid}_${Date.now()}.m4a`;
          audioUrl = await DigitalOceanService.uploadMedia(
            currentRecordingPath,
            `chat-audio/${audioFileName}`,
            'audio/mp4'
          );
          console.log('Voice message uploaded to server');
        } catch (serverError) {
          console.log('Server upload failed, using local reference');
          // For demo: use a placeholder URL or local file reference
          audioUrl = currentRecordingPath;
        }
      } else {
        // Use local storage for large voice files
        audioUrl = currentRecordingPath;
        console.log('Voice message saved locally (large file)');
      }
      
      // Enhanced voice message text with duration and storage info
      const storageInfo = useServerForVoice ? '☁️' : '📱';
      const voiceMessageText = `🎤 Voice message (${recordTime}) ${storageInfo}`;
      
      // Send audio message
      await FirebaseService.sendMessage(chatId, user.uid, voiceMessageText, 'audio', audioUrl);
      
      // Clean up
      setCurrentRecordingPath('');
      setRecordTime('00:00');
      setRecordSecs(0);
      
      // Show appropriate success message
      const storageType = useServerForVoice ? 'server' : 'local device';
      console.log(`Voice message saved to ${storageType} and sent successfully`);
      
    } catch (error) {
      console.error('Error sending voice message:', error);
      Alert.alert('Error', 'Failed to send voice message');
    } finally {
      setUploading(false);
    }
  };

  // Cancel voice recording
  const cancelVoiceRecording = async () => {
    if (isRecording) {
      await stopRecording();
    }
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
      recordingTimer.current = null;
    }
    setShowVoiceModal(false);
    setCurrentRecordingPath('');
    setRecordTime('00:00');
    setRecordSecs(0);
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !chatId || !user || sending) return;

    try {
      setSending(true);
      const messageText = inputText.trim();
      setInputText('');

      await FirebaseService.sendMessage(chatId, user.uid, messageText, 'text');
      
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
      setInputText(inputText); // Restore input text
    } finally {
      setSending(false);
    }
  };

  const handleVideoCall = async () => {
    if (!chatId || !user?.uid || !otherUser?.uid) {
      Alert.alert('Error', 'Unable to start video call. Missing user information.');
      return;
    }

    try {
      console.log('Starting in-app video call with:', { userUid: user.uid, otherUserUid: otherUser.uid });
      try {
        // Start WebRTC call
        const callId = await WebRTCService.startCall(user.uid, otherUser.uid, true);
        console.log('Call started with ID:', callId);
        
        // Navigate to video call screen
        (navigation as any).navigate('InAppVideoCall', {
          callId,
          isInitiator: true,
          isVideoCall: true,
          otherUser: {
            uid: otherUser.uid,
            displayName: otherUser.displayName,
            profilePicture: otherUser.profilePicture,
          },
        });
      } catch (error) {
        console.log('Video call not available:', error);
        Alert.alert('Call Unavailable', 'Video calling is currently not available. Please try again later.');
      }
    } catch (error) {
      console.error('Error starting video call:', error);
      Alert.alert('Error', 'Failed to start video call');
    }
  };

  const handleAudioCall = async () => {
    if (!chatId || !user?.uid || !otherUser?.uid) {
      Alert.alert('Error', 'Unable to start audio call. Missing user information.');
      return;
    }

    try {
      console.log('Starting in-app audio call with:', { userUid: user.uid, otherUserUid: otherUser.uid });
      
      try {
        // Start WebRTC call
        const callId = await WebRTCService.startCall(user.uid, otherUser.uid, false);
        console.log('Audio call started with ID:', callId);
        
        // Navigate to video call screen (with audio-only mode)
        (navigation as any).navigate('InAppVideoCall', {
        callId,
        isInitiator: true,
        isVideoCall: false,
        otherUser: {
          uid: otherUser.uid,
          displayName: otherUser.displayName,
          profilePicture: otherUser.profilePicture,
        },
        });
      } catch (callError) {
        console.log('Audio call not available:', callError);
        Alert.alert('Call Unavailable', 'Audio calling is currently not available. Please try again later.');
      }
    } catch (error) {
      console.error('Error starting audio call:', error);
      Alert.alert('Error', 'Failed to start audio call');
    }
  };  // Enhanced media storage configuration with intelligent file size handling
  const MEDIA_STORAGE_CONFIG = {
    useServerStorage: true, // true = DigitalOcean, false = local device storage
    enableLocalFallback: true, // Allow fallback to local storage if server fails
    compressImages: true,
    compressVideos: true,
    maxImageSize: 2 * 1024 * 1024, // 2MB
    maxVideoSize: 50 * 1024 * 1024, // 50MB
    // Intelligent storage thresholds (if file is larger than this, save locally)
    serverStorageThreshold: {
      image: 5 * 1024 * 1024, // 5MB - larger images go to device
      video: 100 * 1024 * 1024, // 100MB - larger videos go to device
      audio: 10 * 1024 * 1024, // 10MB - larger audio goes to device
    },
    localStorageForLargeFiles: true, // Enable intelligent storage switching
  };

  // Intelligent storage decision based on file size
  const shouldUseServerStorage = (fileSize: number, mediaType: 'image' | 'video' | 'audio'): boolean => {
    if (!MEDIA_STORAGE_CONFIG.localStorageForLargeFiles) {
      return MEDIA_STORAGE_CONFIG.useServerStorage;
    }

    const threshold = MEDIA_STORAGE_CONFIG.serverStorageThreshold[mediaType];
    if (fileSize > threshold) {
      console.log(`File size ${fileSize} exceeds ${mediaType} threshold ${threshold}, using local storage`);
      return false; // Use local storage for large files
    }
    
    console.log(`File size ${fileSize} within ${mediaType} threshold ${threshold}, using server storage`);
    return MEDIA_STORAGE_CONFIG.useServerStorage;
  };

  // Enhanced media upload with intelligent storage based on file size
  const uploadMediaWithOptions = async (asset: any, mediaType: 'image' | 'video' | 'audio'): Promise<string> => {
    const fileSize = asset.fileSize || 0;
    const useServerForThisFile = shouldUseServerStorage(fileSize, mediaType);
    const { enableLocalFallback } = MEDIA_STORAGE_CONFIG;
    
    console.log(`Processing ${mediaType} (${fileSize} bytes) - Using ${useServerForThisFile ? 'server' : 'local'} storage`);
    
    if (useServerForThisFile) {
      try {
        // Try server storage first
        const folderName = `chat-${mediaType}s`;
        const fileName = `${user!.uid}_${Date.now()}.${getFileExtension(asset.uri || asset.fileName)}`;
        
        console.log(`Uploading to Digital Ocean Spaces: ${folderName}`);
        const serverUrl = await DigitalOceanService.uploadMedia(
          asset.uri!,
          `${folderName}/${fileName}`,
          getMediaMimeType(mediaType, asset.type)
        );
        console.log('Successfully uploaded to server');
        return serverUrl;
        
      } catch (serverError) {
        console.log('Server upload failed:', serverError);
        
        if (enableLocalFallback) {
          console.log('Falling back to local storage');
          return await handleLocalStorage(asset, mediaType);
        } else {
          throw serverError;
        }
      }
    } else {
      // Use local storage directly for large files
      console.log('Using local storage for large file');
      return await handleLocalStorage(asset, mediaType);
    }
  };

  // Local storage handler
  const handleLocalStorage = async (asset: any, mediaType: 'image' | 'video' | 'audio'): Promise<string> => {
    try {
      // For local storage, we'll use the file URI directly
      // In a real implementation, you might want to copy to app's document directory
      if (asset.uri) {
        return asset.uri;
      }
      
      // Fallback to base64 for compatibility
      if (asset.base64) {
        return `data:${asset.type};base64,${asset.base64}`;
      }
      
      // Last resort: convert file to base64
      const RNFS = require('react-native-fs');
      const base64 = await RNFS.readFile(asset.uri!, 'base64');
      return `data:${asset.type};base64,${base64}`;
      
    } catch (error) {
      console.error('Local storage failed:', error);
      throw error;
    }
  };

  // Helper functions
  const getFileExtension = (fileName: string): string => {
    return fileName.split('.').pop() || 'unknown';
  };

  const getMediaMimeType = (mediaType: 'image' | 'video' | 'audio', assetType?: string): string => {
    if (assetType) return assetType;
    
    switch (mediaType) {
      case 'image': return 'image/jpeg';
      case 'video': return 'video/mp4';
      case 'audio': return 'audio/mp4';
      default: return 'application/octet-stream';
    }
  };

  const handleMediaPicker = () => {
    setShowMediaPicker(true);
  };

  // Enhanced image picker with storage options
  const handleImagePicker = () => {
    setShowMediaPicker(false);
    const options = {
      mediaType: 'photo' as MediaType,
      quality: (MEDIA_STORAGE_CONFIG.compressImages ? 0.8 : 1.0) as PhotoQuality,
      includeBase64: !MEDIA_STORAGE_CONFIG.useServerStorage, // Only include base64 for local storage
      maxWidth: 1920,
      maxHeight: 1920,
    };

    launchImageLibrary(options, async (response) => {
      if (response.assets && response.assets[0] && chatId && user) {
        try {
          setUploading(true);
          const asset = response.assets[0];
          
          // Check file size
          if (asset.fileSize && asset.fileSize > MEDIA_STORAGE_CONFIG.maxImageSize) {
            Alert.alert('File Too Large', `Image size should be less than ${MEDIA_STORAGE_CONFIG.maxImageSize / (1024 * 1024)}MB`);
            return;
          }
          
          // Upload with enhanced storage options
          const mediaUrl = await uploadMediaWithOptions(asset, 'image');
          
          // Send image message
          await FirebaseService.sendMessage(chatId, user.uid, 'Image', 'image', mediaUrl);
          
        } catch (error) {
          console.error('Error uploading image:', error);
          Alert.alert('Error', 'Failed to send image');
        } finally {
          setUploading(false);
        }
      }
    });
  };

  // Enhanced video picker with storage options
  const handleVideoPicker = () => {
    setShowMediaPicker(false);
    const options = {
      mediaType: 'video' as MediaType,
      quality: (MEDIA_STORAGE_CONFIG.compressVideos ? 0.8 : 1.0) as PhotoQuality,
      includeBase64: false, // Videos are too large for base64
      videoQuality: 'medium' as any,
    };

    launchImageLibrary(options, async (response) => {
      if (response.assets && response.assets[0] && chatId && user) {
        try {
          setUploading(true);
          const asset = response.assets[0];
          
          // Check file size
          if (asset.fileSize && asset.fileSize > MEDIA_STORAGE_CONFIG.maxVideoSize) {
            Alert.alert('File Too Large', `Video size should be less than ${MEDIA_STORAGE_CONFIG.maxVideoSize / (1024 * 1024)}MB`);
            return;
          }
          
          // Upload with enhanced storage options
          const mediaUrl = await uploadMediaWithOptions(asset, 'video');
          
          // Send video message
          await FirebaseService.sendMessage(chatId, user.uid, 'Video', 'video', mediaUrl);
          
        } catch (error) {
          console.error('Error uploading video:', error);
          Alert.alert('Error', 'Failed to send video');
        } finally {
          setUploading(false);
        }
      }
    });
  };

  // Delete message function
  const handleDeleteMessage = (messageId: string, messageText: string) => {
    Alert.alert(
      'Delete Message',
      `Are you sure you want to delete "${messageText.length > 30 ? messageText.substring(0, 30) + '...' : messageText}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await FirebaseService.deleteMessage(messageId);
              // Haptic feedback for delete action
              ReactNativeHapticFeedback.trigger('impactMedium');
            } catch (error) {
              console.error('Error deleting message:', error);
              Alert.alert('Error', 'Failed to delete message');
            }
          },
        },
      ]
    );
  };

  // Handle long press on message
  const handleMessageLongPress = (message: ChatMessage) => {
    const isMyMessage = message.senderId === user?.uid;
    
    // Only allow deletion of own messages
    if (!isMyMessage) return;
    
    // Don't allow deletion of already deleted messages
    if (message.isDeleted) return;
    
    // Get message preview text
    let messagePreview = '';
    if (message.messageType === 'text') {
      messagePreview = message.message;
    } else if (message.messageType === 'image') {
      messagePreview = 'Photo';
    } else if (message.messageType === 'video') {
      messagePreview = 'Video';
    } else if (message.messageType === 'audio') {
      messagePreview = 'Voice message';
    } else if ((message as any).type === 'reel') {
      messagePreview = 'Shared reel';
    } else if ((message as any).type === 'post') {
      messagePreview = 'Shared post';
    } else {
      messagePreview = 'Message';
    }
    
    handleDeleteMessage(message.id, messagePreview);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMyMessage = item.senderId === user?.uid;
    const isMediaMessage = item.messageType === 'image' || item.messageType === 'video' || item.messageType === 'audio';
    const isSharedReel = (item as any).type === 'reel' && (item as any).reelData;
    const isSharedPost = (item as any).type === 'post' && (item as any).postData;
    
    // Handle deleted messages
    if (item.isDeleted) {
      return (
        <View style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessage : styles.otherMessage
        ]}>
          {!isMyMessage && (
            <Image 
              source={{ 
                uri: item.senderAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.senderName)}&background=E1306C&color=fff`
              }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                marginRight: 8,
              }}
            />
          )}
          
          <View style={[
            styles.messageBubble,
            styles.deletedMessageBubble,
          ]}>
            <Text style={styles.deletedMessageText}>
              <Icon name="ban-outline" size={14} color="#666" /> This message was deleted
            </Text>
            <Text style={[
              styles.timestamp,
              styles.deletedTimestamp
            ]}>
              {formatTime(item.createdAt)}
            </Text>
          </View>
        </View>
      );
    }
    
    return (
      <TouchableOpacity
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessage : styles.otherMessage
        ]}
        onLongPress={() => handleMessageLongPress(item)}
        delayLongPress={500}
        activeOpacity={0.7}
      >
        {!isMyMessage && (
          <Image 
            source={{ 
              uri: item.senderAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.senderName)}&background=E1306C&color=fff`
            }}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              marginRight: 8,
            }}
          />
        )}
        
        {isMediaMessage ? (
          // Media messages without background bubble
          <View style={[
            styles.mediaBubble,
            isMyMessage ? styles.myMediaBubble : styles.otherMediaBubble
          ]}>
            {item.messageType === 'image' && item.mediaUrl && (
              <Image source={{ uri: item.mediaUrl }} style={{
                width: 200,
                height: 200,
                borderRadius: 12,
              }} />
            )}
            
            {item.messageType === 'video' && item.mediaUrl && (
              <VideoMessagePlayer
                videoUri={item.mediaUrl}
                isMyMessage={isMyMessage}
                onError={(error) => console.log('Video error:', error)}
                onLoad={(data) => console.log('Video loaded:', data)}
              />
            )}

            {item.messageType === 'audio' && item.mediaUrl && (
              <VoiceMessagePlayer
                audioUrl={item.mediaUrl}
                isMyMessage={isMyMessage}
                duration={item.message}
              />
            )}
            
            <Text style={[
              styles.mediaTimestamp,
              isMyMessage ? styles.myMediaTimestamp : styles.otherMediaTimestamp
            ]}>
              {formatTime(item.createdAt)}
            </Text>
          </View>
        ) : isSharedReel ? (
          // Enhanced Shared Reel Display
          <SharedReelMessage
            reelData={(item as any).reelData}
            message={(item as any).content || item.message}
            isOwn={isMyMessage}
            onPress={() => {
              // Navigate to SingleReelViewer for dedicated viewing experience
              (navigation as any).navigate('SingleReelViewer', {
                reelId: (item as any).reelData.id,
                reel: (item as any).reelData,
                returnScreen: 'ChatScreen',
              });
            }}
          />
        ) : isSharedPost ? (
          // Enhanced Shared Post Display  
          <SharedPostMessage
            postData={(item as any).postData}
            message={(item as any).content || item.message}
            isOwn={isMyMessage}
            onPress={() => {
              // Navigate to Home feed with specific post
              (navigation as any).navigate('Home', {
                initialPostId: (item as any).postData.id,
              });
            }}
          />
        ) : (
          // Text and call messages with background bubble
          <View style={[
            styles.messageBubble,
            isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble
          ]}>
            {item.messageType === 'text' && (
              <Text style={[
                styles.messageText,
                isMyMessage ? styles.myMessageText : styles.otherMessageText
              ]}>
                {item.message}
              </Text>
            )}
            
            {item.messageType === 'call' && (
              <View style={styles.callMessage}>
                <Icon name="call" size={16} color={isMyMessage ? '#fff' : '#007AFF'} />
                <Text style={[
                  styles.messageText,
                  isMyMessage ? styles.myMessageText : styles.otherMessageText
                ]}>
                  {item.message}
                </Text>
              </View>
            )}
            
            <Text style={[
              styles.timestamp,
              isMyMessage ? styles.myTimestamp : styles.otherTimestamp
            ]}>
              {formatTime(item.createdAt)}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading chat...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.userInfo}
          onPress={() => {
            if (otherUser) {
              (navigation as any).navigate('UserProfile', { 
                userId: otherUser.uid, 
                user: otherUser 
              });
            }
          }}
        >
          <Image 
            source={{ 
              uri: otherUser?.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser?.displayName || otherUser?.username || 'User')}&background=E1306C&color=fff`
            }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              marginRight: 12,
            }}
          />
          <View>
            <Text style={styles.headerName}>{otherUser?.displayName || 'User'}</Text>
            <Text style={styles.headerStatus}>Online</Text>
          </View>
        </TouchableOpacity>
        
        {/* Call Buttons */}
        <View style={styles.callButtons}>
          <TouchableOpacity 
            onPress={handleAudioCall}
            style={styles.callButton}
          >
            <Icon name="call" size={22} color="#007AFF" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={handleVideoCall}
            style={styles.callButton}
          >
            <Icon name="videocam" size={22} color="#007AFF" />
          </TouchableOpacity>
        </View>

      </View>

      {/* Messages */}
      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          inverted={false}
          showsVerticalScrollIndicator={false}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
          }}
        />

        {/* Input */}
        <View style={styles.inputContainer}>
          <TouchableOpacity onPress={handleMediaPicker} style={styles.mediaButton}>
            <Icon name="camera" size={24} color="#007AFF" />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={startRecording} style={styles.mediaButton}>
            <Icon name="mic" size={24} color="#007AFF" />
          </TouchableOpacity>
          
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            multiline
            maxLength={1000}
          />
          
          <TouchableOpacity 
            onPress={sendMessage}
            style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Icon name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Media Picker Modal */}
      <Modal
        visible={showMediaPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMediaPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.mediaPickerContainer}>
            <TouchableOpacity onPress={handleImagePicker} style={styles.mediaOption}>
              <Icon name="image" size={24} color="#007AFF" />
              <Text style={styles.mediaOptionText}>Photo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={handleVideoPicker} style={styles.mediaOption}>
              <Icon name="videocam" size={24} color="#007AFF" />
              <Text style={styles.mediaOptionText}>Video</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => setShowMediaPicker(false)} 
              style={[styles.mediaOption, styles.cancelOption]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Voice Recording Modal */}
      <Modal
        visible={showVoiceModal}
        transparent={true}
        animationType="slide"
        onRequestClose={cancelVoiceRecording}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.voiceRecordingContainer}>
            <View style={styles.voiceRecordingHeader}>
              <Text style={styles.voiceRecordingTitle}>Recording Voice Message</Text>
              <TouchableOpacity onPress={cancelVoiceRecording} style={styles.closeButton}>
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.recordingVisualizer}>
              <View style={[styles.recordingPulse, isRecording && styles.recordingPulseActive]} />
              <TouchableOpacity
                style={[styles.recordButton, isRecording && styles.recordButtonActive]}
                onPress={isRecording ? stopRecording : startRecording}
              >
                <Icon name={isRecording ? "stop" : "mic"} size={30} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.recordingTime}>{recordTime}</Text>
            
            {!isRecording && currentRecordingPath && (
              <View style={styles.voiceActions}>
                <TouchableOpacity onPress={cancelVoiceRecording} style={styles.voiceActionButton}>
                  <Icon name="trash" size={24} color="#ff3b30" />
                  <Text style={styles.voiceActionText}>Delete</Text>
                </TouchableOpacity>
                
                <TouchableOpacity onPress={sendVoiceMessage} style={[styles.voiceActionButton, styles.sendVoiceButton]}>
                  <Icon name="send" size={24} color="#007AFF" />
                  <Text style={[styles.voiceActionText, styles.sendVoiceText]}>Send</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Upload Indicator */}
      {uploading && (
        <View style={styles.uploadIndicator}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.uploadText}>Uploading...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
    backgroundColor: '#fff',
  },
  backButton: {
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  callButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  } as ImageStyle,
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  headerStatus: {
    fontSize: 12,
    color: '#4caf50',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    marginLeft: 16,
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 4,
    alignItems: 'flex-end',
  },
  myMessage: {
    justifyContent: 'flex-end',
  },
  otherMessage: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  } as ImageStyle,
  messageBubble: {
    maxWidth: width * 0.75,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  myMessageBubble: {
    backgroundColor: '#007AFF',
    marginLeft: 50,
  },
  otherMessageBubble: {
    backgroundColor: '#f1f1f1',
    marginRight: 50,
  },
  deletedMessageBubble: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e1e8ed',
    marginRight: 50,
    marginLeft: 50,
  },
  deletedMessageText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  deletedTimestamp: {
    color: '#999',
  },
  // Media bubble styles (no background)
  mediaBubble: {
    maxWidth: width * 0.75,
    borderRadius: 12,
    overflow: 'hidden',
  },
  myMediaBubble: {
    marginLeft: 50,
    alignItems: 'flex-end',
  },
  otherMediaBubble: {
    marginRight: 50,
    alignItems: 'flex-start',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#1a1a1a',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  } as ImageStyle,
  callMessage: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
  },
  myTimestamp: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  otherTimestamp: {
    color: '#888',
  },
  // Media timestamp styles
  mediaTimestamp: {
    fontSize: 11,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#fff',
    borderRadius: 8,
    alignSelf: 'flex-end',
  },
  myMediaTimestamp: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#fff',
  },
  otherMediaTimestamp: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#fff',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e1e8ed',
    backgroundColor: '#fff',
  },
  mediaButton: {
    marginRight: 12,
    marginBottom: 8,
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#e1e8ed',
    borderRadius: 20,
    color:"black",
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 16,
    marginRight: 12,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  mediaPickerContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  mediaOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  mediaOptionText: {
    fontSize: 16,
    marginLeft: 12,
    color: '#007AFF',
  },
  cancelOption: {
    borderBottomWidth: 0,
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 16,
    color: '#ff3b30',
    textAlign: 'center',
  },
  uploadIndicator: {
    position: 'absolute',
    top: 100,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  uploadText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 14,
  },
  // Voice message styles
  voiceMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 200,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  myVoiceMessage: {
    backgroundColor: '#007AFF',
  },
  otherVoiceMessage: {
    backgroundColor: '#f1f1f1',
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  audioInfo: {
    flex: 1,
    marginRight: 8,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    marginBottom: 4,
  },
  myWaveform: {
    // My message waveform styles
  },
  otherWaveform: {
    // Other message waveform styles
  },
  waveBar: {
    width: 2,
    marginRight: 1,
    borderRadius: 1,
  },
  audioDuration: {
    fontSize: 12,
    fontWeight: '500',
  },
  myAudioDuration: {
    color: 'rgba(255,255,255,0.8)',
  },
  otherAudioDuration: {
    color: '#666',
  },
  // Voice recording modal styles
  voiceRecordingContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    minHeight: 300,
  },
  voiceRecordingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  voiceRecordingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  closeButton: {
    padding: 4,
  },
  recordingVisualizer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    position: 'relative',
  },
  recordingPulse: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0,122,255,0.2)',
    transform: [{ scale: 0 }],
  },
  recordingPulseActive: {
    transform: [{ scale: 1 }],
    // Add animation if needed
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  recordButtonActive: {
    backgroundColor: '#ff3b30',
  },
  recordingTime: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
    marginVertical: 20,
  },
  voiceActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
    paddingTop: 20,
  },
  voiceActionButton: {
    alignItems: 'center',
    padding: 16,
  },
  sendVoiceButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  voiceActionText: {
    fontSize: 16,
    marginTop: 8,
    color: '#ff3b30',
  },
  sendVoiceText: {
    color: '#007AFF',
  },
  // Shared Reel Styles
  sharedReelContainer: {
    maxWidth: width * 0.8,
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e1e8ed',
  },
  mySharedReel: {
    marginLeft: 40,
    borderColor: '#007AFF',
  },
  otherSharedReel: {
    marginRight: 40,
    borderColor: '#e1e8ed',
  },
  sharedReelHeader: {
    marginBottom: 8,
  },
  sharedContentLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    marginBottom: 2,
  },
  sharedReelUser: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
  reelPreview: {
    position: 'relative',
    marginBottom: 8,
  },
  reelThumbnail: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  } as ImageStyle,
  reelPlayButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 16,
    marginLeft: 2,
  },
  reelDurationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  reelDurationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  reelCaption: {
    fontSize: 14,
    color: '#1a1a1a',
    marginBottom: 8,
    lineHeight: 18,
  },
  reelStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reelStatText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
});
