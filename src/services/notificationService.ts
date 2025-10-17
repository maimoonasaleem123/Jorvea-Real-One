import { firebaseMessaging, firebaseFirestore, COLLECTIONS } from '../config/firebase';
import { Platform, PermissionsAndroid, Alert, Vibration, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CallData {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  targetUserId: string;
  isVideoCall: boolean;
}

interface NotificationData {
  type: 'incoming_call' | 'missed_call' | 'message' | 'like' | 'comment' | 'follow';
  callId?: string;
  callerId?: string;
  callerName?: string;
  callerAvatar?: string;
  isVideoCall?: boolean;
  chatId?: string;
  message?: string;
  postId?: string;
  fromUserId?: string;
  fromUserName?: string;
  priority?: 'high' | 'normal';
  sound?: string;
  vibration?: boolean;
}

class NotificationService {
  private static instance: NotificationService;
  private fcmToken: string | null = null;
  private isInitialized: boolean = false;
  private activeVibration: NodeJS.Timeout | null = null;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Request permissions
      await this.requestPermissions();
      
      // Get FCM token
      await this.getFCMToken();
      
      // Setup message listeners
      this.setupMessageListeners();
      
      this.isInitialized = true;
      console.log('🔔 Notification service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize notification service:', error);
    }
  }

  private async requestPermissions() {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        {
          title: 'Notification Permission',
          message: 'Jorvea needs notification permission to alert you about calls and messages.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert(
          'Permission Required',
          'Please enable notifications to receive call alerts and messages.',
        );
      }
    } else {
      // iOS permissions
      const authStatus = await firebaseMessaging.requestPermission();
      const enabled = authStatus === 1 || authStatus === 2;
      
      if (!enabled) {
        Alert.alert(
          'Permission Required',
          'Please enable notifications in Settings to receive call alerts and messages.',
        );
      }
    }
  }

  private async getFCMToken() {
    try {
      const token = await firebaseMessaging.getToken();
      this.fcmToken = token;
      console.log('🔑 FCM Token:', token);
      
      // Save token to user profile for sending notifications
      return token;
    } catch (error) {
      console.error('❌ Error getting FCM token:', error);
      return null;
    }
  }

  private setupMessageListeners() {
    // Handle foreground messages
    const unsubscribeForeground = firebaseMessaging.onMessage(async (remoteMessage) => {
      console.log('📬 Foreground message received:', remoteMessage);
      
      if (remoteMessage.data) {
        const notificationData: NotificationData = {
          type: remoteMessage.data.type as any,
          callId: typeof remoteMessage.data.callId === 'string' ? remoteMessage.data.callId : undefined,
          callerId: typeof remoteMessage.data.callerId === 'string' ? remoteMessage.data.callerId : undefined,
          callerName: typeof remoteMessage.data.callerName === 'string' ? remoteMessage.data.callerName : undefined,
          callerAvatar: typeof remoteMessage.data.callerAvatar === 'string' ? remoteMessage.data.callerAvatar : undefined,
          isVideoCall: remoteMessage.data.isVideoCall === 'true',
          chatId: typeof remoteMessage.data.chatId === 'string' ? remoteMessage.data.chatId : undefined,
          message: typeof remoteMessage.data.message === 'string' ? remoteMessage.data.message : undefined,
          postId: typeof remoteMessage.data.postId === 'string' ? remoteMessage.data.postId : undefined,
          fromUserId: typeof remoteMessage.data.fromUserId === 'string' ? remoteMessage.data.fromUserId : undefined,
          fromUserName: typeof remoteMessage.data.fromUserName === 'string' ? remoteMessage.data.fromUserName : undefined,
          priority: typeof remoteMessage.data.priority === 'string' ? remoteMessage.data.priority as 'high' | 'normal' : 'normal',
          sound: typeof remoteMessage.data.sound === 'string' ? remoteMessage.data.sound : undefined,
          vibration: remoteMessage.data.vibration === 'true',
        };

        this.handleForegroundNotification(notificationData);
      }
    });

    // Handle background/quit state messages
    firebaseMessaging.setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('📦 Background message received:', remoteMessage);
    });

    // Handle notification opened from background/quit state
    firebaseMessaging.getInitialNotification().then((remoteMessage) => {
      if (remoteMessage) {
        console.log('🚀 App opened from notification:', remoteMessage);
        // Handle app launch from notification
      }
    });

    return unsubscribeForeground;
  }

  private handleForegroundNotification(data: NotificationData) {
    switch (data.type) {
      case 'incoming_call':
        this.showIncomingCallNotification(data);
        break;
      case 'message':
        this.showMessageNotification(data);
        break;
      case 'like':
      case 'comment':
      case 'follow':
        this.showSocialNotification(data);
        break;
      default:
        console.log('🤷‍♂️ Unknown notification type:', data.type);
    }
  }

  private showIncomingCallNotification(data: NotificationData) {
    const title = `${data.isVideoCall ? '📹' : '📞'} Incoming ${data.isVideoCall ? 'Video' : 'Voice'} Call`;
    const message = `${data.callerName} is calling you...`;

    // Vibrate for incoming call - continuous pattern
    if (data.vibration !== false) {
      this.startCallVibration();
    }

    // Show an alert for incoming call (since we can't use local notifications)
    Alert.alert(
      title,
      message,
      [
        {
          text: 'Decline',
          onPress: () => {
            this.stopCallVibration();
            this.handleCallDecline(data.callId || '');
          },
          style: 'cancel',
        },
        {
          text: 'Answer',
          onPress: () => {
            this.stopCallVibration();
            this.handleCallAnswer(data.callId || '');
          },
        },
      ],
      { cancelable: false }
    );

    // Store call notification for cleanup
    this.storeActiveCallNotification(data.callId || '');
  }

  private startCallVibration() {
    this.activeVibration = setInterval(() => {
      Vibration.vibrate([0, 1000, 1000, 1000]);
    }, 3000);
  }

  private stopCallVibration() {
    if (this.activeVibration) {
      clearInterval(this.activeVibration);
      this.activeVibration = null;
    }
    Vibration.cancel();
  }

  private handleCallAnswer(callId: string) {
    // Navigation logic will be handled by the calling component
    console.log('📞 Call answered:', callId);
  }

  private handleCallDecline(callId: string) {
    // Handle call decline logic
    console.log('📞 Call declined:', callId);
  }

  async storeActiveCallNotification(callId: string) {
    try {
      await AsyncStorage.setItem(`call_notification_${callId}`, 'active');
    } catch (error) {
      console.error('Error storing call notification:', error);
    }
  }

  async clearCallNotification(callId: string) {
    try {
      await AsyncStorage.removeItem(`call_notification_${callId}`);
      this.stopCallVibration();
    } catch (error) {
      console.error('Error clearing call notification:', error);
    }
  }

  private showMessageNotification(data: NotificationData) {
    // Show alert for new message
    Alert.alert(
      `💬 ${data.fromUserName}`,
      data.message || 'New message',
      [
        {
          text: 'Later',
          style: 'cancel',
        },
        {
          text: 'View',
          onPress: () => {
            // Handle message view navigation
            console.log('💬 View message:', data.chatId);
          },
        },
      ]
    );

    // Brief vibration for message
    if (data.vibration !== false) {
      Vibration.vibrate(300);
    }
  }

  private showSocialNotification(data: NotificationData) {
    let title = '';
    let message = '';

    switch (data.type) {
      case 'like':
        title = '❤️ New Like';
        message = `${data.fromUserName} liked your post`;
        break;
      case 'comment':
        title = '💬 New Comment';
        message = `${data.fromUserName} commented on your post`;
        break;
      case 'follow':
        title = '👥 New Follower';
        message = `${data.fromUserName} started following you`;
        break;
    }

    // Show alert for social notifications
    Alert.alert(
      title,
      message,
      [
        {
          text: 'Later',
          style: 'cancel',
        },
        {
          text: 'View',
          onPress: () => {
            // Handle social notification navigation
            console.log('👥 View social notification:', data.type, data.postId);
          },
        },
      ]
    );

    // Light vibration for social notifications
    if (data.vibration !== false) {
      Vibration.vibrate(200);
    }
  }

  // Send call notification to specific user
  async sendCallNotification(callData: CallData) {
    try {
      // Get target user's FCM token
      const userDoc = await firebaseFirestore.collection(COLLECTIONS.USERS).doc(callData.targetUserId).get();
      const userData = userDoc.data();
      
      if (!userData?.fcmToken) {
        console.log('❌ Target user has no FCM token');
        return;
      }

      const notificationData = {
        type: 'incoming_call',
        callId: callData.callId,
        callerId: callData.callerId,
        callerName: callData.callerName,
        callerAvatar: callData.callerAvatar,
        isVideoCall: callData.isVideoCall.toString(),
        priority: 'high',
        vibration: 'true',
      };

      // This would typically be sent via your backend/cloud function
      // For now, we'll just log the notification data
      console.log('📤 Sending call notification:', notificationData);
      
      return true;
    } catch (error) {
      console.error('❌ Error sending call notification:', error);
      return false;
    }
  }

  // Send message notification
  async sendMessageNotification(chatId: string, fromUserId: string, fromUserName: string, message: string, targetUserId: string) {
    try {
      const userDoc = await firebaseFirestore.collection(COLLECTIONS.USERS).doc(targetUserId).get();
      const userData = userDoc.data();
      
      if (!userData?.fcmToken) {
        console.log('❌ Target user has no FCM token');
        return;
      }

      const notificationData = {
        type: 'message',
        chatId,
        fromUserId,
        fromUserName,
        message: message.substring(0, 100), // Truncate long messages
        priority: 'normal',
        vibration: 'true',
      };

      console.log('📤 Sending message notification:', notificationData);
      
      return true;
    } catch (error) {
      console.error('❌ Error sending message notification:', error);
      return false;
    }
  }

  // Send social notification (like, comment, follow)
  async sendSocialNotification(type: 'like' | 'comment' | 'follow', fromUserId: string, fromUserName: string, targetUserId: string, postId?: string) {
    try {
      const userDoc = await firebaseFirestore.collection(COLLECTIONS.USERS).doc(targetUserId).get();
      const userData = userDoc.data();
      
      if (!userData?.fcmToken) {
        console.log('❌ Target user has no FCM token');
        return;
      }

      const notificationData = {
        type,
        fromUserId,
        fromUserName,
        postId,
        priority: 'normal',
        vibration: 'true',
      };

      console.log('📤 Sending social notification:', notificationData);
      
      return true;
    } catch (error) {
      console.error('❌ Error sending social notification:', error);
      return false;
    }
  }

  // Update FCM token for current user
  async updateUserFCMToken(userId: string) {
    try {
      if (!this.fcmToken) {
        await this.getFCMToken();
      }

      if (this.fcmToken) {
        await firebaseFirestore.collection(COLLECTIONS.USERS).doc(userId).update({
          fcmToken: this.fcmToken,
          lastActiveAt: new Date(),
        });
        
        console.log('✅ FCM token updated for user:', userId);
      }
    } catch (error) {
      console.error('❌ Error updating FCM token:', error);
    }
  }

  // Clean up when app is closed or user logs out
  async cleanup() {
    this.stopCallVibration();
    
    // Clear all active call notifications
    try {
      const keys = await AsyncStorage.getAllKeys();
      const callNotificationKeys = keys.filter(key => key.startsWith('call_notification_'));
      
      for (const key of callNotificationKeys) {
        await AsyncStorage.removeItem(key);
      }
    } catch (error) {
      console.error('Error cleaning up notifications:', error);
    }
  }

  // Check if notification permissions are granted
  async checkPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      const result = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      return result;
    } else {
      const authStatus = await firebaseMessaging.hasPermission();
      return authStatus === 1 || authStatus === 2;
    }
  }

  getFCMTokenSync(): string | null {
    return this.fcmToken;
  }

  // Add listener for call notifications - for video call signaling
  onCallNotification(callback: (notification: any) => void) {
    // Set up a listener for incoming call notifications
    // This will be called when a call notification is received
    console.log('📞 Call notification listener set up');
    
    // For now, we'll just log and return a dummy unsubscribe function
    // In a real implementation, this would connect to the notification system
    return () => {
      console.log('📞 Call notification listener removed');
    };
  }

  // Show local notification for enhanced video call signaling
  async showLocalNotification(data: {
    title: string;
    body: string;
    callId: string;
    isVideoCall: boolean;
  }) {
    try {
      console.log('📱 Showing local notification:', data);
      
      // Use the existing alert-based notification system
      Alert.alert(
        data.title,
        data.body,
        [
          {
            text: 'Decline',
            onPress: () => {
              this.stopCallVibration();
              this.handleCallDecline(data.callId);
            },
            style: 'cancel',
          },
          {
            text: 'Answer',
            onPress: () => {
              this.stopCallVibration();
              this.handleCallAnswer(data.callId);
            },
          },
        ],
        { cancelable: false }
      );

      // Start appropriate vibration for video/audio calls
      if (data.isVideoCall) {
        // Different vibration pattern for video calls
        this.startVideoCallVibration();
      } else {
        this.startCallVibration();
      }

      // Store the notification
      await this.storeActiveCallNotification(data.callId);
      
      return true;
    } catch (error) {
      console.error('❌ Error showing local notification:', error);
      return false;
    }
  }

  private startVideoCallVibration() {
    // Special vibration pattern for video calls
    this.activeVibration = setInterval(() => {
      Vibration.vibrate([0, 500, 200, 500, 200, 500]);
    }, 4000);
  }
}

export default NotificationService;
