declare module 'react-native-config' {
  export interface NativeConfig {
    // Firebase Configuration
    FIREBASE_API_KEY?: string;
    FIREBASE_AUTH_DOMAIN?: string;
    FIREBASE_PROJECT_ID?: string;
    FIREBASE_STORAGE_BUCKET?: string;
    FIREBASE_MESSAGING_SENDER_ID?: string;
    FIREBASE_APP_ID?: string;

    // Google OAuth Configuration
    WEB_CLIENT_ID?: string;
    ANDROID_CLIENT_ID?: string;
    IOS_CLIENT_ID?: string;

    // Digital Ocean Spaces Configuration
    DO_SPACES_KEY?: string;
    DO_SPACES_SECRET?: string;
    DO_SPACES_ENDPOINT?: string;
    DO_SPACES_REGION?: string;
    DO_SPACES_BUCKET?: string;
    DO_SPACES_CDN_URL?: string;
    VIDEO_STORAGE_PROVIDER?: string;

    // Jitsi Meet Configuration
    JITSI_SERVER_URL?: string;
    JITSI_APP_NAME?: string;
    JITSI_ROOM_PREFIX?: string;

    // WebRTC Configuration
    WEBRTC_SERVER_URL?: string;
    STUN_SERVER_1?: string;
    STUN_SERVER_2?: string;
    TURN_SERVER_URL?: string;
    TURN_USERNAME?: string;
    TURN_PASSWORD?: string;

    // API Configuration
    API_BASE_URL?: string;
    WEBSOCKET_URL?: string;

    // App Configuration
    APP_NAME?: string;
    APP_VERSION?: string;
    ENVIRONMENT?: string;
    DEBUG_MODE?: string;
    PACKAGE_NAME?: string;
  }

  export const Config: NativeConfig;
  export default Config;
}
