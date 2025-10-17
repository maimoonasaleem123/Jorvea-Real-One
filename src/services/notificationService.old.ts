import { firebaseMessaging, firebaseFirestore, COLLECTIONS } from '../config/firebase';
import { Platform, PermissionsAndroid, Alert, Vibration, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CallConfig } from './webrtcService';

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
      
      // Configure push notifications
      this.configurePushNotifications();
      
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
      // iOS permissions are handled automatically by react-native-firebase
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

  private configurePushNotifications() {
    PushNotification.configure({
      onNotification: (notification) => {
        console.log('📱 Local notification received:', notification);
        
        // Handle notification actions
        if (notification.userInteraction) {
          this.handleNotificationAction(notification);
        }
      },
      
      onAction: (notification) => {
        console.log('🎯 Notification action:', notification.action);
        this.handleNotificationAction(notification);
      },
      
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },
      
      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });

    // Create notification channels for Android
    if (Platform.OS === 'android') {
      PushNotification.createChannel(
        {
          channelId: 'incoming_calls',
          channelName: 'Incoming Calls',
          channelDescription: 'Notifications for incoming voice and video calls',
          importance: 4,
          vibrate: true,
          sound: 'call_ringtone.mp3',
          playSound: true,
        },
        (created) => console.log(`Call channel created: ${created}`)
      );

      PushNotification.createChannel(
        {
          channelId: 'messages',
          channelName: 'Messages',
          channelDescription: 'Notifications for new messages',
          importance: 3,
          vibrate: true,
          sound: 'message_tone.mp3',
          playSound: true,
        },
        (created) => console.log(`Message channel created: ${created}`)
      );

      PushNotification.createChannel(
        {
          channelId: 'social',
          channelName: 'Social Activity',
          channelDescription: 'Notifications for likes, comments, and follows',
          importance: 2,
          vibrate: false,
          sound: 'default',
          playSound: true,
        },
        (created) => console.log(`Social channel created: ${created}`)
      );
    }
  }

  private async getFCMToken() {
    try {
      const token = await firebaseMessaging.getToken();
      this.fcmToken = token;
      console.log('🔑 FCM Token:', token);
      
      // Save token to user profile for sending notifications
      // This will be called when user logs in
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

    // Vibrate for incoming call
    if (data.vibration !== false) {
      Vibration.vibrate([0, 1000, 1000, 1000], true);
    }

    PushNotification.localNotification({
      channelId: 'incoming_calls',
      title,
      message,
      bigText: message,
      priority: 'max',
      importance: 'high',
      ongoing: true,
      autoCancel: false,
      vibrate: true,
      playSound: true,
      soundName: 'default',
      category: 'call',
      userInfo: {
        type: 'incoming_call',
        callId: data.callId,
        callerId: data.callerId,
        callerName: data.callerName,
        isVideoCall: data.isVideoCall,
      },
      actions: ['Answer', 'Decline'],
      invokeApp: true,
      timeoutAfter: 30000, // Auto-dismiss after 30 seconds
    });

    // Store call notification for cleanup
    this.storeActiveCallNotification(data.callId || '');
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
      Vibration.cancel(); // Stop vibration
      PushNotification.cancelAllLocalNotifications();
    } catch (error) {
      console.error('Error clearing call notification:', error);
    }
  }

  private showMessageNotification(data: NotificationData) {
    PushNotification.localNotification({
      channelId: 'messages',
      title: `💬 ${data.fromUserName}`,
      message: data.message || 'New message',
      bigText: data.message,
      priority: 'high',
      importance: 'high',
      autoCancel: true,
      vibrate: true,
      playSound: true,
      soundName: 'message_tone.mp3',
      actions: ['Reply', 'Mark as Read'],
      userInfo: {
        type: 'message',
        chatId: data.chatId,
        fromUserId: data.fromUserId,
      },
    });
  }

  private showSocialNotification(data: NotificationData) {
    let title = '';
    let emoji = '';

    switch (data.type) {
      case 'like':
        title = `${data.fromUserName} liked your post`;
        emoji = '❤️';
        break;
      case 'comment':
        title = `${data.fromUserName} commented on your post`;
        emoji = '💬';
        break;
      case 'follow':
        title = `${data.fromUserName} started following you`;
        emoji = '👤';
        break;
    }

    PushNotification.localNotification({
      channelId: 'social',
      title: `${emoji} ${title}`,
      message: data.message || '',
      priority: 'default',
      importance: 'default',
      autoCancel: true,
      vibrate: false,
      playSound: true,
      soundName: 'default',
      userInfo: {
        type: data.type,
        postId: data.postId,
        fromUserId: data.fromUserId,
      },
    });
  }

  private handleNotificationAction(notification: any) {
    const { type, action } = notification;
    
    switch (type) {
      case 'incoming_call':
        if (action === 'Answer') {
          // Navigate to call screen and answer
          console.log('📞 Answering call from notification');
        } else if (action === 'Decline') {
          // Reject the call
          console.log('📞 Declining call from notification');
        }
        break;
      case 'message':
        if (action === 'Reply') {
          // Navigate to chat screen
          console.log('💬 Opening chat from notification');
        }
        break;
      default:
        // Navigate to appropriate screen
        console.log('🚀 Opening app from notification');
    }
  }

  async saveUserToken(userId: string) {
    if (!this.fcmToken || !userId) return;

    try {
      const userDocRef = firebaseFirestore.collection(COLLECTIONS.USERS).doc(userId);
      await userDocRef.update({
        fcmToken: this.fcmToken,
        lastTokenUpdate: new Date().toISOString(),
      });
      
      console.log('✅ FCM token saved for user:', userId);
    } catch (error) {
      console.error('❌ Error saving FCM token:', error);
    }
  }

  async sendCallNotification(
    receiverId: string,
    callId: string,
    callerName: string,
    callerAvatar: string,
    isVideoCall: boolean
  ) {
    try {
      // Get receiver's FCM token
      const userDocRef = firebaseFirestore.collection(COLLECTIONS.USERS).doc(receiverId);
      const userDoc = await userDocRef.get();
      
      if (!userDoc.exists()) {
        console.log('❌ Receiver not found');
        return;
      }

      const userData = userDoc.data();
      const fcmToken = userData?.fcmToken;

      if (!fcmToken) {
        console.log('❌ Receiver FCM token not found');
        return;
      }

      // Send FCM notification (would need Cloud Functions for actual sending)
      // For now, we'll create a notification document that can be picked up by Cloud Functions
      await firebaseFirestore.collection(COLLECTIONS.NOTIFICATIONS).add({
        type: 'incoming_call',
        recipientId: receiverId,
        senderId: userData?.uid,
        senderName: callerName,
        senderAvatar: callerAvatar,
        callId,
        isVideoCall,
        fcmToken,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      console.log('📤 Call notification queued');
    } catch (error) {
      console.error('❌ Error sending call notification:', error);
    }
  }

  clearAllNotifications() {
    PushNotification.cancelAllLocalNotifications();
  }

  clearCallNotifications() {
    // Clear only call-related notifications
    PushNotification.getScheduledLocalNotifications((notifications) => {
      notifications.forEach((notification) => {
        if (notification.userInfo?.type === 'incoming_call') {
          PushNotification.cancelLocalNotifications({
            id: notification.id,
          });
        }
      });
    });
  }
}

export default NotificationService;
