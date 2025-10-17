import { Linking, Alert } from 'react-native';
import { FirebaseService } from './firebaseService';

export interface JitsiMeetingConfig {
  roomName: string;
  displayName: string;
  email?: string;
  avatar?: string;
  audioMuted?: boolean;
  videoMuted?: boolean;
}

export interface CallParticipant {
  userId: string;
  displayName: string;
  email?: string;
  avatar?: string;
}

class JitsiService {
  private jitsiServer = 'https://meet.jit.si';

  /**
   * Generate a unique room name
   */
  private generateRoomName(participants: string[]): string {
    const sortedParticipants = participants.sort();
    const timestamp = Date.now();
    const hash = sortedParticipants.join('_').replace(/[^a-zA-Z0-9]/g, '');
    return `jorvea_${hash}_${timestamp}`;
  }

  /**
   * Generate a simple room name with prefix
   */
  static generateSimpleRoomName(prefix: string = 'jorvea'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Start a web-based Jitsi call
   */
  static startWebCall(config: {
    roomName: string;
    userDisplayName: string;
    userEmail?: string;
    userAvatarUrl?: string;
    isVideoMuted?: boolean;
    subject?: string;
  }, callbacks?: {
    onConferenceJoined?: () => void;
    onConferenceTerminated?: () => void;
    onError?: (error: any) => void;
  }): void {
    try {
      const { roomName, userDisplayName, userEmail, isVideoMuted = false } = config;
      
      // Create Jitsi Meet URL with parameters
      let jitsiUrl = `https://meet.jit.si/${roomName}`;
      
      // Add URL parameters
      const params = new URLSearchParams();
      if (userDisplayName) params.append('display-name', userDisplayName);
      if (userEmail) params.append('email', userEmail);
      if (isVideoMuted) params.append('video-muted', 'true');
      
      const paramString = params.toString();
      if (paramString) {
        jitsiUrl += `#config.startWithVideoMuted=${isVideoMuted}&userInfo.displayName=${encodeURIComponent(userDisplayName)}`;
      }

      // Open Jitsi in browser
      Linking.openURL(jitsiUrl)
        .then(() => {
          callbacks?.onConferenceJoined?.();
        })
        .catch((error) => {
          console.error('Error opening Jitsi URL:', error);
          callbacks?.onError?.(error);
          Alert.alert('Error', 'Unable to open video call. Please try again.');
        });
    } catch (error) {
      console.error('Error starting web call:', error);
      callbacks?.onError?.(error);
    }
  }

  /**
   * Start a video call with participants
   */
  async startCall(
    participants: CallParticipant[],
    callType: 'audio' | 'video' = 'video',
    chatId?: string
  ): Promise<string> {
    try {
      const roomName = this.generateRoomName(participants.map(p => p.userId));
      const config: JitsiMeetingConfig = {
        roomName,
        displayName: participants[0]?.displayName || 'User',
        email: participants[0]?.email,
        avatar: participants[0]?.avatar,
        audioMuted: false,
        videoMuted: callType === 'audio',
      };

      // Create call log in Firebase
      if (chatId) {
        await FirebaseService.createCallLog(
          chatId,
          participants[0]?.userId || '',
          participants.map(p => p.userId),
          callType,
          roomName
        );
      }

      // Open Jitsi Meet in browser with proper configuration
      const jitsiUrl = this.buildJitsiUrl(config);
      await Linking.openURL(jitsiUrl);
      
      return roomName;
    } catch (error) {
      console.error('Error starting call:', error);
      throw new Error('Failed to start call');
    }
  }

  /**
   * Join an existing call
   */
  async joinCall(
    roomName: string,
    displayName: string,
    options: {
      email?: string;
      avatar?: string;
      audioMuted?: boolean;
      videoMuted?: boolean;
    } = {}
  ): Promise<void> {
    try {
      const config: JitsiMeetingConfig = {
        roomName,
        displayName,
        email: options.email,
        avatar: options.avatar,
        audioMuted: options.audioMuted || false,
        videoMuted: options.videoMuted || false,
      };

      const jitsiUrl = this.buildJitsiUrl(config);
      await Linking.openURL(jitsiUrl);
    } catch (error) {
      console.error('Error joining call:', error);
      throw new Error('Failed to join call');
    }
  }

  /**
   * Build Jitsi Meet URL with configuration
   */
  private buildJitsiUrl(config: JitsiMeetingConfig): string {
    const baseUrl = `${this.jitsiServer}/${encodeURIComponent(config.roomName)}`;
    const params = new URLSearchParams();

    // Basic configuration
    params.append('config.startWithAudioMuted', config.audioMuted?.toString() || 'false');
    params.append('config.startWithVideoMuted', config.videoMuted?.toString() || 'false');
    params.append('config.subject', 'Jorvea Video Call');
    
    // User information
    if (config.displayName) {
      params.append('config.defaultDisplayName', config.displayName);
    }
    if (config.email) {
      params.append('userInfo.email', config.email);
    }
    if (config.avatar) {
      params.append('userInfo.avatarUrl', config.avatar);
    }

    // Interface customization
    params.append('config.toolbarButtons', JSON.stringify([
      'microphone',
      'camera',
      'hangup',
      'chat',
      'settings',
      'raisehand',
      'stats',
      'shortcuts'
    ]));

    // Security and branding
    params.append('config.enableWelcomePage', 'false');
    params.append('config.prejoinPageEnabled', 'false');
    params.append('config.requireDisplayName', 'true');
    params.append('config.defaultLanguage', 'en');
    
    // Mobile optimizations
    params.append('config.resolution', '720');
    params.append('config.constraints.video.height.ideal', '720');
    params.append('config.constraints.video.width.ideal', '1280');

    return `${baseUrl}#${params.toString()}`;
  }

  /**
   * Check if device can make calls
   */
  async canMakeCalls(): Promise<boolean> {
    try {
      const supported = await Linking.canOpenURL('https://meet.jit.si');
      return supported;
    } catch (error) {
      console.error('Error checking call support:', error);
      return false;
    }
  }

  /**
   * Show call options to user
   */
  async showCallOptions(
    participants: CallParticipant[],
    chatId?: string
  ): Promise<void> {
    Alert.alert(
      'Start Call',
      'Choose call type',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Audio Call',
          onPress: () => this.startCall(participants, 'audio', chatId),
        },
        {
          text: 'Video Call',
          onPress: () => this.startCall(participants, 'video', chatId),
        },
      ]
    );
  }

  /**
   * Generate shareable meeting link
   */
  generateMeetingLink(roomName: string): string {
    return `${this.jitsiServer}/${encodeURIComponent(roomName)}`;
  }

  /**
   * Test call functionality
   */
  async testCall(displayName: string = 'Test User'): Promise<void> {
    try {
      const testRoomName = `jorvea_test_${Date.now()}`;
      await this.joinCall(testRoomName, displayName, {
        audioMuted: true,
        videoMuted: true,
      });
    } catch (error) {
      console.error('Call test failed:', error);
      Alert.alert('Call Test Failed', 'Unable to start test call');
    }
  }
}

export const jitsiService = new JitsiService();
export default JitsiService;
