import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Linking,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { jitsiService, CallParticipant } from '../services/jitsiService';
import { useAuth } from '../context/FastAuthContext';
import { RootStackParamList } from '../types';

type VideoCallScreenRouteProp = RouteProp<RootStackParamList, 'VideoCall'>;
type VideoCallScreenNavigationProp = StackNavigationProp<RootStackParamList, 'VideoCall'>;

interface VideoCallScreenProps {
  route: VideoCallScreenRouteProp;
  navigation: VideoCallScreenNavigationProp;
}

const VideoCallScreen: React.FC<VideoCallScreenProps> = ({ route, navigation }) => {
  const { user } = useAuth();
  const { callId, participants = [], roomName, callType = 'video', chatId } = route.params || { callId: '' };
  
  const [isCallActive, setIsCallActive] = useState(false);
  const [canMakeCalls, setCanMakeCalls] = useState(true);
  const [currentRoomName, setCurrentRoomName] = useState(roomName || '');

  useEffect(() => {
    checkCallSupport();
  }, []);

  const checkCallSupport = async () => {
    try {
      const supported = await jitsiService.canMakeCalls();
      setCanMakeCalls(supported);
      
      if (!supported) {
        Alert.alert(
          'Calls Not Supported',
          'Your device does not support video calls. Please ensure you have a web browser installed.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (error) {
      console.error('Error checking call support:', error);
      setCanMakeCalls(false);
    }
  };

  const startNewCall = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to start a call');
      return;
    }

    if (participants.length === 0) {
      Alert.alert('Error', 'No participants selected for the call');
      return;
    }

    try {
      setIsCallActive(true);
      const roomName = await jitsiService.startCall(
        [{ userId: user.uid, displayName: user.displayName || user.email || 'User' }, ...participants],
        callType,
        chatId
      );
      setCurrentRoomName(roomName);
    } catch (error) {
      console.error('Error starting call:', error);
      setIsCallActive(false);
      Alert.alert('Call Failed', 'Unable to start the call. Please try again.');
    }
  };

  const joinExistingCall = async () => {
    if (!user || !currentRoomName) {
      Alert.alert('Error', 'Invalid call information');
      return;
    }

    try {
      setIsCallActive(true);
      await jitsiService.joinCall(
        currentRoomName,
        user.displayName || user.email || 'User',
        {
          email: user.email || undefined,
          audioMuted: callType === 'audio' ? false : false,
          videoMuted: callType === 'audio' ? true : false,
        }
      );
    } catch (error) {
      console.error('Error joining call:', error);
      setIsCallActive(false);
      Alert.alert('Join Failed', 'Unable to join the call. Please try again.');
    }
  };

  const endCall = () => {
    setIsCallActive(false);
    navigation.goBack();
  };

  const testCall = async () => {
    if (!user) return;
    
    try {
      await jitsiService.testCall(user.displayName || user.email || 'Test User');
    } catch (error) {
      console.error('Test call failed:', error);
      Alert.alert('Test Failed', 'Unable to start test call');
    }
  };

  const shareCallLink = () => {
    if (!currentRoomName) {
      Alert.alert('Error', 'No active call to share');
      return;
    }

    const meetingLink = jitsiService.generateMeetingLink(currentRoomName);
    Alert.alert(
      'Share Call Link',
      `Share this link with others to join the call:\n\n${meetingLink}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Copy Link',
          onPress: () => {
            // Copy to clipboard functionality would go here
            Alert.alert('Link Copied', 'Meeting link copied to clipboard');
          },
        },
      ]
    );
  };

  if (!canMakeCalls) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="error" size={64} color="#ff4444" />
          <Text style={styles.errorTitle}>Calls Not Available</Text>
          <Text style={styles.errorText}>
            Video calls are not supported on this device. Please ensure you have a web browser installed.
          </Text>
          <TouchableOpacity style={styles.testButton} onPress={() => navigation.goBack()}>
            <Text style={styles.testButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isCallActive ? 'Call Active' : 'Video Call'}
        </Text>
        <TouchableOpacity onPress={shareCallLink} style={styles.shareButton}>
          <Icon name="share" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {!isCallActive ? (
          <View style={styles.preCallContainer}>
            <View style={styles.callInfo}>
              <Icon 
                name={callType === 'video' ? 'videocam' : 'phone'} 
                size={64} 
                color="#4CAF50" 
              />
              <Text style={styles.callTypeText}>
                {callType === 'video' ? 'Video Call' : 'Audio Call'}
              </Text>
              
              {participants.length > 0 && (
                <View style={styles.participantsContainer}>
                  <Text style={styles.participantsTitle}>Participants:</Text>
                  {participants.map((participant: any, index: number) => (
                    <Text key={index} style={styles.participantName}>
                      {participant.displayName}
                    </Text>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.buttonContainer}>
              {currentRoomName ? (
                <TouchableOpacity style={styles.joinButton} onPress={joinExistingCall}>
                  <Icon name="phone" size={24} color="#fff" />
                  <Text style={styles.buttonText}>Join Call</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.startButton} onPress={startNewCall}>
                  <Icon name={callType === 'video' ? 'videocam' : 'phone'} size={24} color="#fff" />
                  <Text style={styles.buttonText}>Start Call</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.testButton} onPress={testCall}>
                <Icon name="bug-report" size={24} color="#666" />
                <Text style={styles.testButtonText}>Test Call</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.callActiveContainer}>
            <Icon name="phone" size={64} color="#4CAF50" />
            <Text style={styles.callActiveText}>Call is now active in your browser</Text>
            <Text style={styles.callActiveSubtext}>
              You can return to the app when the call is finished
            </Text>
            
            <TouchableOpacity style={styles.endButton} onPress={endCall}>
              <Icon name="call-end" size={24} color="#fff" />
              <Text style={styles.buttonText}>Return to App</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Powered by Jitsi Meet - Secure video calling
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#2c2c2c',
  },
  backButton: {
    padding: 8,
  },
  shareButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  preCallContainer: {
    alignItems: 'center',
    width: '100%',
  },
  callInfo: {
    alignItems: 'center',
    marginBottom: 40,
  },
  callTypeText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
  },
  participantsContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  participantsTitle: {
    color: '#ccc',
    fontSize: 16,
    marginBottom: 8,
  },
  participantName: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    marginBottom: 16,
    width: '80%',
  },
  joinButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    marginBottom: 16,
    width: '80%',
  },
  testButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#666',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  testButtonText: {
    color: '#666',
    fontSize: 14,
    marginLeft: 8,
  },
  callActiveContainer: {
    alignItems: 'center',
  },
  callActiveText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  callActiveSubtext: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 40,
  },
  endButton: {
    backgroundColor: '#f44336',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    color: '#ccc',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  footer: {
    padding: 16,
    alignItems: 'center',
  },
  footerText: {
    color: '#666',
    fontSize: 12,
  },
});

export default VideoCallScreen;
