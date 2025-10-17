import Config from 'react-native-config';

// App Configuration
export const AppConfig = {
  // Firebase Configuration
  firebase: {
    apiKey: Config.FIREBASE_API_KEY || "AIzaSyBXGz8vQZd4cYYKZJFZqxEGzkAGFxEJKbM",
    authDomain: Config.FIREBASE_AUTH_DOMAIN || "jorvea-9f876.firebaseapp.com",
    projectId: Config.FIREBASE_PROJECT_ID || "jorvea-9f876",
    storageBucket: Config.FIREBASE_STORAGE_BUCKET || "jorvea-9f876.firebasestorage.app",
    messagingSenderId: Config.FIREBASE_MESSAGING_SENDER_ID || "236350952922",
    appId: Config.FIREBASE_APP_ID || "1:236350952922:android:883204bca91666ab149ce3",
  },

  // Google OAuth Configuration
  googleOAuth: {
    webClientId: Config.WEB_CLIENT_ID || "423170912328-doaftgbl3d4pvfia4pr2kbiuf4cd89ub.apps.googleusercontent.com",
    androidClientId: Config.ANDROID_CLIENT_ID || "236350952922-n4f16m00dshl106usspoiker6ujfbg58.apps.googleusercontent.com",
    iosClientId: Config.IOS_CLIENT_ID || "423170912328-get-from-google-cloud-console.apps.googleusercontent.com",
  },

  // Digital Ocean Spaces Configuration
  digitalOcean: {
    spacesKey: Config.DO_SPACES_KEY || "DO801XPFLWMJLWB62XBX",
    spacesSecret: Config.DO_SPACES_SECRET || "abGOCo+yDJkU4pzWxArmxAPZjo84IGg6d4k3c9rM2WQ",
    spacesEndpoint: Config.DO_SPACES_ENDPOINT || "https://blr1.digitaloceanspaces.com",
    spacesRegion: Config.DO_SPACES_REGION || "blr1",
    spacesBucket: Config.DO_SPACES_BUCKET || "jorvea",
    spacesCdnUrl: Config.DO_SPACES_CDN_URL || "https://jorvea.blr1.cdn.digitaloceanspaces.com",
    videoStorageProvider: Config.VIDEO_STORAGE_PROVIDER || "spaces",
  },

  // Jitsi Meet Configuration
  jitsi: {
    serverUrl: Config.JITSI_SERVER_URL || "https://meet.jit.si",
    appName: Config.JITSI_APP_NAME || "Jorvea",
    roomPrefix: Config.JITSI_ROOM_PREFIX || "jorvea_",
  },

  // WebRTC Configuration
  webrtc: {
    serverUrl: Config.WEBRTC_SERVER_URL || "https://webrtc.jorvea.com",
    stunServer1: Config.STUN_SERVER_1 || "stun:stun.l.google.com:19302",
    stunServer2: Config.STUN_SERVER_2 || "stun:stun1.l.google.com:19302",
    turnServerUrl: Config.TURN_SERVER_URL || "turn:turnserver.com:3478",
    turnUsername: Config.TURN_USERNAME || "your_turn_username",
    turnPassword: Config.TURN_PASSWORD || "your_turn_password",
  },

  // API Configuration
  api: {
    baseUrl: Config.API_BASE_URL || "https://api.jorvea.com",
    websocketUrl: Config.WEBSOCKET_URL || "wss://ws.jorvea.com",
  },

  // App Configuration
  app: {
    name: Config.APP_NAME || "Jorvea",
    version: Config.APP_VERSION || "2.0.0",
    environment: Config.ENVIRONMENT || "development",
    debugMode: Config.DEBUG_MODE === 'true' || false,
    packageName: Config.PACKAGE_NAME || "com.jorvea",
  },
};

export default AppConfig;
