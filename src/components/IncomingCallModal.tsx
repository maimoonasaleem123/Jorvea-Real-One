import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/FastAuthContext';
import WebRTCService from '../services/webrtcService';
import FirebaseService from '../services/firebaseService';

const { width, height } = Dimensions.get('window');

interface IncomingCallModalProps {
  visible: boolean;
  callData: {
    id: string;
    callerId: string;
    receiverId: string;
    type: 'video' | 'audio';
    status: string;
    createdAt: string;
  } | null;
  callerInfo: {
    displayName: string;
    profilePicture?: string;
  } | null;
  onAnswer: () => void;
  onReject: () => void;
  onDismiss: () => void;
}

export default function IncomingCallModal({
  visible,
  callData,
  callerInfo,
  onAnswer,
  onReject,
  onDismiss,
}: IncomingCallModalProps): React.JSX.Element {
  const [pulseAnim] = useState(new Animated.Value(1));
  const navigation = useNavigation();
  const { user } = useAuth();

  useEffect(() => {
    if (visible) {
      // Start pulse animation
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
  }, [visible]);

  const handleAnswer = () => {
    if (!callData) return;

    // Navigate to video call screen
    (navigation as any).navigate('InAppVideoCall', {
      callId: callData.id,
      isInitiator: false,
      isVideoCall: callData.type === 'video',
      otherUser: {
        uid: callData.callerId,
        displayName: callerInfo?.displayName || 'Unknown',
        profilePicture: callerInfo?.profilePicture,
      },
    });

    onAnswer();
  };

  const handleReject = () => {
    if (!callData) return;

    WebRTCService.rejectCall();
    onReject();
  };

  if (!visible || !callData || !callerInfo) {
    return <></>;
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.callContainer}>
          {/* Avatar */}
          <Animated.View style={[styles.avatarContainer, { transform: [{ scale: pulseAnim }] }]}>
            <Image
              source={{
                uri: callerInfo.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(callerInfo.displayName)}&background=E1306C&color=fff&size=200`
              }}
              style={styles.avatar}
            />
          </Animated.View>

          {/* Caller Info */}
          <Text style={styles.callerName}>{callerInfo.displayName}</Text>
          <Text style={styles.callType}>
            Incoming {callData.type} call...
          </Text>

          {/* Call Actions */}
          <View style={styles.actionsContainer}>
            {/* Reject Button */}
            <TouchableOpacity
              style={[styles.callButton, styles.rejectButton]}
              onPress={handleReject}
            >
              <Icon name="call" size={30} color="#fff" style={styles.rejectIcon} />
            </TouchableOpacity>

            {/* Answer Button */}
            <TouchableOpacity
              style={[styles.callButton, styles.answerButton]}
              onPress={handleAnswer}
            >
              <Icon 
                name={callData.type === 'video' ? 'videocam' : 'call'} 
                size={30} 
                color="#fff" 
              />
            </TouchableOpacity>
          </View>

          {/* Additional Actions */}
          <View style={styles.secondaryActions}>
            <TouchableOpacity style={styles.secondaryButton}>
              <Icon name="chatbubble" size={20} color="#fff" />
              <Text style={styles.secondaryButtonText}>Message</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton}>
              <Icon name="person-add" size={20} color="#fff" />
              <Text style={styles.secondaryButtonText}>Remind me</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  avatarContainer: {
    marginBottom: 30,
    borderRadius: 100,
    padding: 4,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatar: {
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  callerName: {
    fontSize: 28,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  callType: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 60,
    textAlign: 'center',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: width * 0.6,
    marginBottom: 40,
  },
  callButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  rejectButton: {
    backgroundColor: '#ff3b30',
  },
  answerButton: {
    backgroundColor: '#4caf50',
  },
  rejectIcon: {
    transform: [{ rotate: '135deg' }],
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: width * 0.5,
  },
  secondaryButton: {
    alignItems: 'center',
    padding: 10,
  },
  secondaryButtonText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 4,
  },
});
