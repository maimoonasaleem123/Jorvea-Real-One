import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/FastAuthContext';
import WebRTCService from '../services/webrtcService';
import FirebaseService from '../services/firebaseService';

export default function CallTestScreen(): React.JSX.Element {
  const { user } = useAuth();
  const [targetUserId, setTargetUserId] = useState('');
  const [loading, setLoading] = useState(false);

  const testVideoCall = async () => {
    if (!targetUserId.trim()) {
      Alert.alert('Error', 'Please enter a target user ID');
      return;
    }

    if (!user?.uid) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      setLoading(true);
      console.log('Starting test video call...');
      
      const callId = await WebRTCService.startCall(user.uid, targetUserId.trim(), true);
      console.log('Video call started with ID:', callId);
      
      Alert.alert('Success', `Video call started! Call ID: ${callId}`);
    } catch (error) {
      console.error('Error starting video call:', error);
      Alert.alert('Error', 'Failed to start video call');
    } finally {
      setLoading(false);
    }
  };

  const testAudioCall = async () => {
    if (!targetUserId.trim()) {
      Alert.alert('Error', 'Please enter a target user ID');
      return;
    }

    if (!user?.uid) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      setLoading(true);
      console.log('Starting test audio call...');
      
      const callId = await WebRTCService.startCall(user.uid, targetUserId.trim(), false);
      console.log('Audio call started with ID:', callId);
      
      Alert.alert('Success', `Audio call started! Call ID: ${callId}`);
    } catch (error) {
      console.error('Error starting audio call:', error);
      Alert.alert('Error', 'Failed to start audio call');
    } finally {
      setLoading(false);
    }
  };

  const testFollowUser = async () => {
    if (!targetUserId.trim()) {
      Alert.alert('Error', 'Please enter a target user ID');
      return;
    }

    if (!user?.uid) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      setLoading(true);
      console.log('Testing follow user...');
      
      await FirebaseService.followUser(user.uid, targetUserId.trim());
      console.log('User followed successfully');
      
      Alert.alert('Success', 'User followed successfully!');
    } catch (error) {
      console.error('Error following user:', error);
      Alert.alert('Error', 'Failed to follow user');
    } finally {
      setLoading(false);
    }
  };

  const testCheckFollowStatus = async () => {
    if (!targetUserId.trim()) {
      Alert.alert('Error', 'Please enter a target user ID');
      return;
    }

    if (!user?.uid) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      setLoading(true);
      console.log('Checking follow status...');
      
      const isFollowing = await FirebaseService.checkFollowStatus(user.uid, targetUserId.trim());
      console.log('Follow status:', isFollowing);
      
      Alert.alert('Follow Status', isFollowing ? 'You are following this user' : 'You are not following this user');
    } catch (error) {
      console.error('Error checking follow status:', error);
      Alert.alert('Error', 'Failed to check follow status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <Text style={styles.title}>Call & Follow System Test</Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current User</Text>
          <Text style={styles.info}>User ID: {user?.uid}</Text>
          <Text style={styles.info}>Display Name: {user?.displayName}</Text>
          <Text style={styles.info}>Email: {user?.email}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Target User</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter target user ID"
            value={targetUserId}
            onChangeText={setTargetUserId}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Call Tests</Text>
          
          <TouchableOpacity
            style={[styles.button, styles.videoButton]}
            onPress={testVideoCall}
            disabled={loading}
          >
            <Icon name="videocam" size={20} color="#fff" />
            <Text style={styles.buttonText}>Start Video Call</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.audioButton]}
            onPress={testAudioCall}
            disabled={loading}
          >
            <Icon name="call" size={20} color="#fff" />
            <Text style={styles.buttonText}>Start Audio Call</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Follow System Tests</Text>
          
          <TouchableOpacity
            style={[styles.button, styles.followButton]}
            onPress={testFollowUser}
            disabled={loading}
          >
            <Icon name="person-add" size={20} color="#fff" />
            <Text style={styles.buttonText}>Follow User</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.checkButton]}
            onPress={testCheckFollowStatus}
            disabled={loading}
          >
            <Icon name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.buttonText}>Check Follow Status</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Instructions</Text>
          <Text style={styles.instruction}>1. Enter a target user ID above</Text>
          <Text style={styles.instruction}>2. Try video or audio calls</Text>
          <Text style={styles.instruction}>3. Test follow functionality</Text>
          <Text style={styles.instruction}>4. Check console logs for detailed output</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  info: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  videoButton: {
    backgroundColor: '#007AFF',
  },
  audioButton: {
    backgroundColor: '#4caf50',
  },
  followButton: {
    backgroundColor: '#E1306C',
  },
  checkButton: {
    backgroundColor: '#9C27B0',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  instruction: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    paddingLeft: 10,
  },
});
