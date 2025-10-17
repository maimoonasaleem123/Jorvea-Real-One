import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Alert,
  Vibration,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/FastAuthContext';
import { useNavigation } from '@react-navigation/native';
import WebRTCService from '../services/webrtcService';
import PerfectVideoCallSignaling from '../services/PerfectVideoCallSignaling';

interface IncomingCall {
  id: string;
  callerId: string;
  receiverId: string;
  type: 'video' | 'audio';
  status: string;
  callerName?: string;
  callerProfilePicture?: string;
}

export default function CallManager(): React.JSX.Element {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [videoCallSignaling] = useState(() => PerfectVideoCallSignaling.getInstance());

  useEffect(() => {
    if (!user?.uid) return;

    console.log('🎥 Setting up enhanced CallManager for user:', user.uid);

    try {
      // Set up WebRTC service for current user
      WebRTCService.setCurrentUser(user.uid);

      // Set up event handlers for incoming calls using enhanced signaling
      WebRTCService.setEventHandlers({
        onIncomingCall: (callData: any) => {
          console.log('📞 Incoming call received via enhanced signaling:', callData);
          
          // Only show incoming call if not already in a call
          if (!incomingCall) {
            // Vibrate phone for incoming call with different pattern for video calls
            const vibrationPattern = callData.type === 'video' 
              ? [0, 1000, 500, 1000, 500, 1000] // Video call pattern
              : [0, 1000, 1000, 1000]; // Audio call pattern
            
            Vibration.vibrate(vibrationPattern, true);
            
            setIncomingCall({
              id: callData.id,
              callerId: callData.callerId,
              receiverId: callData.receiverId,
              type: callData.type,
              status: callData.status,
              callerName: callData.callerName || 'Unknown Caller',
              callerProfilePicture: callData.callerProfilePicture,
            });
            
            // For video calls, also show a system alert for better visibility
            if (callData.type === 'video') {
              console.log('🎥 Video call incoming - enhanced notification');
            }
          }
        },
        onCallEnded: () => {
          console.log('📞 Call ended in enhanced CallManager');
          Vibration.cancel();
          setIncomingCall(null);
        },
        onError: (error) => {
          console.error('❌ WebRTC error in enhanced CallManager:', error);
          Vibration.cancel();
          setIncomingCall(null);
          Alert.alert('Call Error', error);
        },
      });

    } catch (error) {
      console.log('CallManager setup failed, calls unavailable:', error);
      // App continues to work without call functionality
    }

    return () => {
      Vibration.cancel();
      setIncomingCall(null);
    };
  }, [user?.uid]);

  const handleAnswerCall = async () => {
    if (!incomingCall) return;

    try {
      console.log('Answering call:', incomingCall.id);
      Vibration.cancel();
      setIncomingCall(null);

      // Navigate to video call screen
      (navigation as any).navigate('InAppVideoCall', {
        callId: incomingCall.id,
        isInitiator: false,
        isVideoCall: incomingCall.type === 'video',
        otherUser: {
          uid: incomingCall.callerId,
          displayName: incomingCall.callerName,
          profilePicture: incomingCall.callerProfilePicture,
        },
      });
    } catch (error) {
      console.error('Error answering call:', error);
      Alert.alert('Error', 'Failed to answer call');
    }
  };

  const handleRejectCall = async () => {
    if (!incomingCall) return;

    try {
      console.log('Rejecting call:', incomingCall.id);
      await WebRTCService.rejectCall();
      Vibration.cancel();
      setIncomingCall(null);
    } catch (error) {
      console.error('Error rejecting call:', error);
      // Always clear the incoming call even if rejection fails
      Vibration.cancel();
      setIncomingCall(null);
    }
  };

  if (!incomingCall) {
    return <></>;
  }

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="fade"
      onRequestClose={handleRejectCall}
    >
      <View style={styles.overlay}>
        <View style={styles.callContainer}>
          {/* Caller Info */}
          <View style={styles.callerInfo}>
            <Image
              source={{
                uri: incomingCall.callerProfilePicture || 
                     `https://ui-avatars.com/api/?name=${encodeURIComponent(incomingCall.callerName || 'User')}&background=E1306C&color=fff&size=200`
              }}
              style={styles.callerAvatar}
            />
            <Text style={styles.callerName}>{incomingCall.callerName}</Text>
            <Text style={styles.callType}>
              Incoming {incomingCall.type === 'video' ? 'video' : 'audio'} call...
            </Text>
          </View>

          {/* Call Actions */}
          <View style={styles.callActions}>
            <TouchableOpacity
              style={styles.rejectButton}
              onPress={handleRejectCall}
            >
              <Icon name="call" size={30} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.answerButton}
              onPress={handleAnswerCall}
            >
              <Icon 
                name={incomingCall.type === 'video' ? 'videocam' : 'call'} 
                size={30} 
                color="#fff" 
              />
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
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: '90%',
    maxWidth: 350,
  },
  callerInfo: {
    alignItems: 'center',
    marginBottom: 40,
  },
  callerAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 15,
  },
  callerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
    textAlign: 'center',
  },
  callType: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
  },
  callActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  rejectButton: {
    backgroundColor: '#ff3b30',
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '135deg' }],
  },
  answerButton: {
    backgroundColor: '#34c759',
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
