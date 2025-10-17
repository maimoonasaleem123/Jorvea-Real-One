import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

interface SimpleVoicePlayerProps {
  audioUri: string;
  duration?: number;
  isMyMessage: boolean;
  onError?: (error: any) => void;
  timestamp?: Date;
}

interface SimpleVoiceRecorderProps {
  onRecordingComplete: (audioUri: string, duration: number) => void;
  onCancel: () => void;
}

export const SimpleVoicePlayer: React.FC<SimpleVoicePlayerProps> = ({
  audioUri,
  duration = 0,
  isMyMessage,
  onError,
  timestamp,
}) => {
  const { colors } = useTheme();
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlayPause = () => {
    // TODO: Implement actual audio playback
    setIsPlaying(!isPlaying);
    Alert.alert('Voice Message', 'Audio playback will be implemented');
  };

  const formatTime = (timeInMs: number) => {
    const seconds = Math.floor(timeInMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[
      styles.voiceContainer,
      { backgroundColor: isMyMessage ? colors.primary : colors.surface },
      isMyMessage ? styles.myVoiceContainer : styles.otherVoiceContainer,
    ]}>
      <TouchableOpacity
        onPress={handlePlayPause}
        style={[
          styles.playButton,
          { backgroundColor: isMyMessage ? 'rgba(255,255,255,0.2)' : colors.primary },
        ]}
      >
        <Icon 
          name={isPlaying ? "pause" : "play"} 
          size={16} 
          color="#fff"
        />
      </TouchableOpacity>

      <View style={styles.waveformContainer}>
        {Array.from({ length: 20 }, (_, i) => (
          <View
            key={i}
            style={[
              styles.waveformBar,
              {
                height: Math.random() * 20 + 4,
                backgroundColor: isMyMessage ? 'rgba(255,255,255,0.8)' : colors.primary,
              },
            ]}
          />
        ))}
      </View>

      <Text style={[
        styles.durationText,
        { color: isMyMessage ? '#fff' : colors.text }
      ]}>
        {formatTime(duration)}
      </Text>
    </View>
  );
};

export const SimpleVoiceRecorder: React.FC<SimpleVoiceRecorderProps> = ({
  onRecordingComplete,
  onCancel,
}) => {
  const { colors } = useTheme();
  const [isRecording, setIsRecording] = useState(false);

  const handleRecord = () => {
    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      Alert.alert(
        'Voice Message',
        'Voice recording will be implemented. For now, this is a placeholder.',
        [
          { text: 'Cancel', onPress: onCancel },
          { text: 'Send', onPress: () => onRecordingComplete('dummy-audio-uri', 5000) },
        ]
      );
    } else {
      // Start recording
      setIsRecording(true);
    }
  };

  if (!isRecording) {
    return (
      <View style={styles.recorderContainer}>
        <TouchableOpacity 
          onPress={handleRecord} 
          style={[styles.recordButton, { backgroundColor: colors.error }]}
        >
          <Icon name="mic" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={[styles.recordHint, { color: colors.textSecondary }]}>
          Tap to record
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.activeRecorderContainer, { backgroundColor: colors.surface }]}>
      <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
        <Icon name="close" size={20} color={colors.error} />
      </TouchableOpacity>

      <View style={[styles.recordingIndicator, { backgroundColor: colors.error }]}>
        <Icon name="mic" size={16} color="#fff" />
      </View>

      <Text style={[styles.recordTimeText, { color: colors.text }]}>
        Recording...
      </Text>

      <TouchableOpacity 
        onPress={handleRecord} 
        style={[styles.sendButton, { backgroundColor: colors.primary }]}
      >
        <Icon name="send" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  // Voice Player Styles
  voiceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    maxWidth: width * 0.7,
    minWidth: 200,
    marginVertical: 2,
  },
  myVoiceContainer: {
    alignSelf: 'flex-end',
  },
  otherVoiceContainer: {
    alignSelf: 'flex-start',
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  waveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 24,
    marginHorizontal: 8,
  },
  waveformBar: {
    width: 3,
    borderRadius: 1.5,
    marginHorizontal: 0.5,
  },
  durationText: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 4,
  },

  // Voice Recorder Styles
  recorderContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  recordButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  recordHint: {
    fontSize: 12,
    marginTop: 8,
  },
  activeRecorderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    margin: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cancelButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  recordTimeText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default { SimpleVoicePlayer, SimpleVoiceRecorder };
