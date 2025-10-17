import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  SafeAreaView,
  Platform,
  PermissionsAndroid,
  Animated,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Sound from 'react-native-sound';
import { useAuth } from '../context/FastAuthContext';
import FirebaseService, { Comment } from '../services/firebaseService';
import DigitalOceanService from '../services/digitalOceanService';

const { width, height } = Dimensions.get('window');

// Enhanced Media Storage Configuration for Comments with intelligent sizing
const COMMENT_STORAGE_CONFIG = {
  useServerStorage: true, // Set to false to use local storage
  enableLocalFallback: true,
  maxFileSize: 5 * 1024 * 1024, // 5MB for voice messages
  compressionQuality: 0.8,
  // Intelligent storage thresholds
  serverStorageThreshold: {
    audio: 8 * 1024 * 1024, // 8MB - larger audio goes to device
  },
  localStorageForLargeFiles: true, // Enable intelligent storage switching
};

// Intelligent storage decision for voice comments
const shouldUseServerStorageForVoice = (fileSize: number): boolean => {
  if (!COMMENT_STORAGE_CONFIG.localStorageForLargeFiles) {
    return COMMENT_STORAGE_CONFIG.useServerStorage;
  }

  const threshold = COMMENT_STORAGE_CONFIG.serverStorageThreshold.audio;
  if (fileSize > threshold) {
    console.log(`Voice file size ${fileSize} exceeds threshold ${threshold}, using local storage`);
    return false; // Use local storage for large files
  }
  
  console.log(`Voice file size ${fileSize} within threshold ${threshold}, using server storage`);
  return COMMENT_STORAGE_CONFIG.useServerStorage;
};

interface EnhancedCommentsProps {
  reelId: string;
  contentType: 'reel' | 'post';
  visible: boolean;
  onClose: () => void;
}

interface VoiceCommentPlayerProps {
  audioUrl: string;
  isMyComment: boolean;
  duration: string;
}

const VoiceCommentPlayer: React.FC<VoiceCommentPlayerProps> = ({
  audioUrl,
  isMyComment,
  duration
}) => {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('00:00');
  const soundRef = useRef<Sound | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.release();
      }
    };
  }, []);

  const togglePlayback = async () => {
    try {
      if (!soundRef.current) {
        soundRef.current = new Sound(audioUrl, '', (error) => {
          if (error) {
            console.log('Failed to load sound', error);
            Alert.alert('Error', 'Failed to load voice message');
            return;
          }
        });
      }

      if (playing) {
        soundRef.current.pause();
        setPlaying(false);
      } else {
        soundRef.current.play((success) => {
          if (success) {
            setPlaying(false);
            setProgress(0);
            setCurrentTime('00:00');
            progressAnim.setValue(0);
          }
        });
        setPlaying(true);
      }
    } catch (error) {
      console.error('Error playing voice message:', error);
      Alert.alert('Error', 'Failed to play voice message');
    }
  };

  return (
    <View style={[
      styles.voiceCommentContainer,
      isMyComment ? styles.myVoiceComment : styles.otherVoiceComment
    ]}>
      <TouchableOpacity
        style={styles.playButton}
        onPress={togglePlayback}
        activeOpacity={0.7}
      >
        <Icon
          name={playing ? "pause" : "play"}
          size={20}
          color={isMyComment ? "#fff" : "#007AFF"}
        />
      </TouchableOpacity>

      <View style={styles.waveformContainer}>
        <View style={[
          styles.waveform,
          isMyComment ? styles.myWaveform : styles.otherWaveform
        ]}>
          {/* Simulated waveform */}
          {Array.from({ length: 20 }, (_, i) => (
            <View
              key={i}
              style={[
                styles.waveBar,
                {
                  height: Math.random() * 20 + 5,
                  backgroundColor: isMyComment ? 'rgba(255,255,255,0.7)' : 'rgba(0,122,255,0.7)',
                }
              ]}
            />
          ))}
        </View>
      </View>

      <Text style={[
        styles.voiceDuration,
        isMyComment ? styles.myVoiceDuration : styles.otherVoiceDuration
      ]}>
        {currentTime}
      </Text>
    </View>
  );
};

export const EnhancedComments: React.FC<EnhancedCommentsProps> = ({
  reelId,
  contentType,
  visible,
  onClose
}) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  
  // Voice comment states
  const [isRecording, setIsRecording] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [recordTime, setRecordTime] = useState('00:00');
  const [recordSecs, setRecordSecs] = useState(0);
  const [currentRecordingPath, setCurrentRecordingPath] = useState('');
  
  const recordTimerRef = useRef<any>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (visible) {
      loadComments();
    }
  }, [visible, reelId]);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
      }
    };
  }, []);

  const loadComments = async () => {
    try {
      setLoading(true);
      const commentsData = await FirebaseService.getComments(reelId, contentType);
      setComments(commentsData);
    } catch (error) {
      console.error('Error loading comments:', error);
      Alert.alert('Error', 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  // Request audio permissions
  const requestAudioPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Audio Recording Permission',
            message: 'This app needs access to your microphone to record voice comments.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true; // iOS handles permissions automatically
  };

  const startRecording = async () => {
    const hasPermission = await requestAudioPermission();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Please grant microphone permission to record voice comments.');
      return;
    }

    try {
      setShowVoiceModal(true);
      setIsRecording(true);
      setRecordTime('00:00');
      setRecordSecs(0);
      
      // Simulate recording (replace with actual recording implementation)
      const simulatedPath = `voice_comment_${Date.now()}.m4a`;
      setCurrentRecordingPath(simulatedPath);

      recordTimerRef.current = setInterval(() => {
        setRecordSecs(prev => {
          const newSecs = prev + 1;
          const minutes = Math.floor(newSecs / 60);
          const seconds = newSecs % 60;
          setRecordTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
          
          if (newSecs >= 300) { // 5 minutes max
            stopRecording();
          }
          
          return newSecs;
        });
      }, 1000);

      console.log('Voice comment recording started...');
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setIsRecording(false);
    console.log('Voice comment recording stopped');
  };

  const cancelRecording = () => {
    stopRecording();
    setShowVoiceModal(false);
    setCurrentRecordingPath('');
    setRecordTime('00:00');
    setRecordSecs(0);
  };

  const sendVoiceComment = async () => {
    if (!currentRecordingPath || !user) {
      Alert.alert('Error', 'No recording found or user not authenticated.');
      return;
    }

    try {
      setSending(true);
      setShowVoiceModal(false);
      
      let audioUrl: string;
      
      // Get file size for intelligent storage decision (simulated for demo)
      const simulatedFileSize = recordSecs * 64000; // Approximate file size calculation
      const useServerForVoice = shouldUseServerStorageForVoice(simulatedFileSize);
      
      if (useServerForVoice) {
        try {
          const audioFileName = `voice_comment_${user.uid}_${Date.now()}.m4a`;
          audioUrl = await DigitalOceanService.uploadMedia(
            currentRecordingPath,
            `comments-audio/${audioFileName}`,
            'audio/mp4'
          );
          console.log('Voice comment uploaded to server');
        } catch (serverError) {
          console.log('Server upload failed, using local reference');
          audioUrl = currentRecordingPath;
        }
      } else {
        audioUrl = currentRecordingPath;
        console.log('Voice comment saved locally (large file)');
      }
      
      // Enhanced voice message text with duration and storage info
      const storageInfo = useServerForVoice ? '☁️' : '📱';
      const voiceCommentText = `🎤 Voice comment (${recordTime}) ${storageInfo}`;
      
      await FirebaseService.addComment(
        reelId,
        user.uid,
        voiceCommentText,
        contentType,
        'audio',
        audioUrl
      );
      
      // Clean up
      setCurrentRecordingPath('');
      setRecordTime('00:00');
      setRecordSecs(0);
      
      // Reload comments
      await loadComments();
      
      const storageType = useServerForVoice ? 'server' : 'local device';
      console.log(`Voice comment saved to ${storageType} and sent successfully`);
      
    } catch (error) {
      console.error('Error sending voice comment:', error);
      Alert.alert('Error', 'Failed to send voice comment');
    } finally {
      setSending(false);
    }
  };

  const sendTextComment = async () => {
    if (!newComment.trim() || !user) return;

    try {
      setSending(true);
      await FirebaseService.addComment(reelId, user.uid, newComment.trim(), contentType);
      setNewComment('');
      await loadComments();
      
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending comment:', error);
      Alert.alert('Error', 'Failed to send comment');
    } finally {
      setSending(false);
    }
  };

  const renderComment = ({ item }: { item: Comment }) => {
    const isMyComment = item.userId === user?.uid;
    const isVoiceComment = item.type === 'audio';
    
    return (
      <View style={[
        styles.commentItem,
        isMyComment ? styles.myComment : styles.otherComment
      ]}>
        {isVoiceComment && item.mediaUrl ? (
          <VoiceCommentPlayer
            audioUrl={item.mediaUrl}
            isMyComment={isMyComment}
            duration={item.content} // Use 'content' instead of 'text'
          />
        ) : (
          <View style={[
            styles.commentBubble,
            isMyComment ? styles.myCommentBubble : styles.otherCommentBubble
          ]}>
            <Text style={[
              styles.commentText,
              isMyComment ? styles.myCommentText : styles.otherCommentText
            ]}>
              {item.content} {/* Use 'content' instead of 'text' */}
            </Text>
          </View>
        )}
        
        <Text style={styles.commentTime}>
          {new Date(item.createdAt).toLocaleTimeString()}
        </Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Comments</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Comments List */}
        <FlatList
          ref={flatListRef}
          data={comments}
          renderItem={renderComment}
          keyExtractor={(item) => item.id}
          style={styles.commentsList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Input Section */}
        <View style={styles.inputContainer}>
          <TouchableOpacity onPress={startRecording} style={styles.voiceButton}>
            <Icon name="mic" size={24} color="#007AFF" />
          </TouchableOpacity>
          
          <TextInput
            style={styles.textInput}
            value={newComment}
            onChangeText={setNewComment}
            placeholder="Add a comment..."
            multiline
            maxLength={500}
          />
          
          <TouchableOpacity
            onPress={sendTextComment}
            style={[styles.sendButton, (!newComment.trim() || sending) && styles.sendButtonDisabled]}
            disabled={!newComment.trim() || sending}
          >
            <Icon name="send" size={20} color={newComment.trim() && !sending ? "#007AFF" : "#ccc"} />
          </TouchableOpacity>
        </View>

        {/* Voice Recording Modal */}
        <Modal
          visible={showVoiceModal}
          transparent={true}
          animationType="fade"
          onRequestClose={cancelRecording}
        >
          <View style={styles.voiceModalOverlay}>
            <View style={styles.voiceModalContent}>
              <Text style={styles.voiceModalTitle}>Recording Voice Comment</Text>
              
              <View style={styles.recordingIndicator}>
                <Icon name="mic" size={40} color={isRecording ? "#ff3040" : "#ccc"} />
                <Text style={styles.recordTime}>{recordTime}</Text>
              </View>
              
              <View style={styles.voiceModalButtons}>
                <TouchableOpacity
                  onPress={cancelRecording}
                  style={[styles.voiceModalButton, styles.cancelButton]}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                {isRecording ? (
                  <TouchableOpacity
                    onPress={stopRecording}
                    style={[styles.voiceModalButton, styles.stopButton]}
                  >
                    <Text style={styles.stopButtonText}>Stop</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={sendVoiceComment}
                    style={[styles.voiceModalButton, styles.sendVoiceButton]}
                    disabled={sending}
                  >
                    <Text style={styles.sendVoiceButtonText}>
                      {sending ? 'Sending...' : 'Send'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  placeholder: {
    width: 40,
  },
  commentsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  commentItem: {
    marginVertical: 8,
    maxWidth: '80%',
  },
  myComment: {
    alignSelf: 'flex-end',
  },
  otherComment: {
    alignSelf: 'flex-start',
  },
  commentBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    marginBottom: 4,
  },
  myCommentBubble: {
    backgroundColor: '#007AFF',
  },
  otherCommentBubble: {
    backgroundColor: '#f0f0f0',
  },
  commentText: {
    fontSize: 16,
  },
  myCommentText: {
    color: '#fff',
  },
  otherCommentText: {
    color: '#000',
  },
  commentTime: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  voiceCommentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    marginBottom: 4,
    minHeight: 40,
  },
  myVoiceComment: {
    backgroundColor: '#007AFF',
  },
  otherVoiceComment: {
    backgroundColor: '#f0f0f0',
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  waveformContainer: {
    flex: 1,
    height: 30,
    justifyContent: 'center',
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
  },
  myWaveform: {
    backgroundColor: 'transparent',
  },
  otherWaveform: {
    backgroundColor: 'transparent',
  },
  waveBar: {
    width: 2,
    marginHorizontal: 1,
    borderRadius: 1,
  },
  voiceDuration: {
    fontSize: 12,
    marginLeft: 8,
    minWidth: 35,
  },
  myVoiceDuration: {
    color: 'rgba(255,255,255,0.8)',
  },
  otherVoiceDuration: {
    color: '#666',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  voiceButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  voiceModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    minWidth: width * 0.8,
  },
  voiceModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  recordingIndicator: {
    alignItems: 'center',
    marginBottom: 24,
  },
  recordTime: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 12,
    color: '#333',
  },
  voiceModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  voiceModalButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: 'bold',
  },
  stopButton: {
    backgroundColor: '#ff3040',
  },
  stopButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  sendVoiceButton: {
    backgroundColor: '#007AFF',
  },
  sendVoiceButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default EnhancedComments;
