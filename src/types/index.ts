// User Types
export interface User {
  id?: string; // For compatibility with existing code
  uid: string;
  email: string;
  username: string;
  displayName: string;
  profilePicture?: string;
  profilePictureType?: 'url' | 'base64'; // Storage type for profile picture
  profilePictureKey?: string; // DigitalOcean key for deletion
  photoURL?: string; // For compatibility
  bio?: string;
  website?: string;
  phoneNumber?: string;
  isPrivate: boolean;
  isVerified: boolean;
  verified?: boolean; // For compatibility
  isFollowing?: boolean; // For UI state
  isOnline?: boolean; // For online status indicator
  followers: string[];
  following: string[];
  blockedUsers: string[];
  followersCount?: number; // For compatibility with Firebase
  followingCount?: number; // For compatibility with Firebase
  postsCount: number;
  storiesCount: number;
  reelsCount: number;
  createdAt: Date;
  lastActive: Date;
  settings: UserSettings;
}

export interface UserPreview {
  uid: string;
  username: string;
  displayName: string;
  profilePicture?: string;
  isVerified?: boolean;
  isOnline?: boolean;
}

export interface UserSettings {
  notifications: {
    likes: boolean;
    comments: boolean;
    follows: boolean;
    messages: boolean;
    mentions: boolean;
    stories: boolean;
  };
  privacy: {
    isPrivate: boolean;
    privateAccount: boolean;
    showActivity: boolean;
    showOnlineStatus: boolean;
    allowMessages: 'everyone' | 'followers' | 'none';
  };
  theme: 'light' | 'dark' | 'auto';
}

// Post Types
export interface Post {
  id: string;
  userId: string;
  user: UserPreview;
  type: 'photo' | 'video' | 'carousel';
  mediaUrls: string[];
  thumbnailUrl?: string;
  caption: string;
  location?: Location;
  tags: string[];
  mentions: string[];
  likes: string[];
  comments: Comment[];
  shares: number;
  saves: string[];
  isArchived: boolean;
  isHidden: boolean;
  music?: Music; // Added music support
  createdAt: Date;
  updatedAt: Date;
}

// Reel Types
export interface Reel {
  id: string;
  userId: string;
  user: User;
  videoUrl: string;
  thumbnailUrl: string;
  caption: string;
  musicId?: string;
  music?: Music;
  effects?: Effect[];
  likes: string[];
  comments: Comment[];
  shares: number;
  saves: string[];
  views: number;
  duration: number;
  isArchived: boolean;
  isSaved?: boolean; // For UI state
  createdAt: Date;
}

// Story Types
export interface Story {
  id: string;
  userId: string;
  user: UserPreview;
  mediaUrl: string;
  mediaType: 'image' | 'video'; // Added for consistency
  type: 'photo' | 'video';
  caption?: string;
  stickers?: Sticker[];
  music?: Music;
  viewers: string[];
  taggedFriends?: UserPreview[];
  isHighlight: boolean;
  highlightId?: string;
  isLiked?: boolean; // Added for story viewer
  isSaved?: boolean; // Added for story viewer
  likesCount?: number; // Added for story viewer
  viewsCount?: number; // Added for story viewer
  expiresAt: Date;
  createdAt: Date;
}

export interface StoryHighlight {
  id: string;
  userId: string;
  title: string;
  coverImageUrl: string;
  stories: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Comment Types
export interface Comment {
  id: string;
  userId: string;
  user: User;
  postId?: string;
  reelId?: string;
  parentId?: string;
  content: string;
  likes: string[];
  replies: Comment[];
  mentions: string[];
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Chat Types
export interface Chat {
  id: string;
  type: 'direct' | 'group';
  participants: string[];
  admins?: string[];
  name?: string;
  description?: string;
  imageUrl?: string;
  lastMessage: Message;
  lastMessageAt: Date;
  unreadCount: { [userId: string]: number };
  isArchived: { [userId: string]: boolean };
  isMuted: { [userId: string]: boolean };
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'post' | 'reel' | 'story' | 'location' | 'contact' | 'voice_call' | 'video_call';
  content: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  replyTo?: string;
  postId?: string;
  reelId?: string;
  reactions: { [userId: string]: string };
  readBy: { [userId: string]: Date };
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Notification Types
export interface Notification {
  id: string;
  userId: string;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'message' | 'story_view' | 'post_share' | 'reel_share' | 'live_start';
  fromUserId: string;
  fromUser: User;
  postId?: string;
  reelId?: string;
  storyId?: string;
  commentId?: string;
  messageId?: string;
  title: string;
  message: string;
  imageUrl?: string;
  actionUrl?: string;
  isRead: boolean;
  createdAt: Date;
}

// Media Types
export interface Media {
  id: string;
  userId: string;
  type: 'image' | 'video' | 'audio';
  url: string;
  thumbnailUrl?: string;
  filename: string;
  size: number;
  duration?: number;
  dimensions?: {
    width: number;
    height: number;
  };
  metadata?: any;
  uploadedAt: Date;
}

// Music Types
export interface Music {
  id: string;
  title: string;
  artist: string;
  url: string;
  duration: number;
  thumbnailUrl?: string;
  genre?: string;
  isPopular: boolean;
  usageCount: number;
  createdAt: Date;
}

// Effect Types
export interface Effect {
  id: string;
  name: string;
  type: 'filter' | 'ar' | 'face' | 'background';
  thumbnailUrl: string;
  previewUrl?: string;
  isPopular: boolean;
  usageCount: number;
  createdAt: Date;
}

// Sticker Types
export interface Sticker {
  id: string;
  type: 'text' | 'emoji' | 'gif' | 'location' | 'music' | 'mention' | 'hashtag' | 'poll' | 'question';
  content: string;
  position: {
    x: number;
    y: number;
  };
  rotation: number;
  scale: number;
  color?: string;
  font?: string;
  backgroundColor?: string;
}

// Location Types
export interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  postsCount: number;
}

// Search Types
export interface SearchResult {
  type: 'user' | 'hashtag' | 'location' | 'post' | 'reel';
  data: User | Hashtag | Location | Post | Reel;
}

export interface Hashtag {
  id: string;
  name: string;
  postsCount: number;
  reelsCount: number;
  storiesCount: number;
  isFollowing?: boolean;
  trendingRank?: number;
}

// Live Stream Types
export interface LiveStream {
  id: string;
  userId: string;
  user: User;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  streamUrl: string;
  viewers: string[];
  viewerCount: number;
  likes: string[];
  comments: LiveComment[];
  isActive: boolean;
  startedAt: Date;
  endedAt?: Date;
}

export interface LiveComment {
  id: string;
  liveStreamId: string;
  userId: string;
  user: User;
  content: string;
  createdAt: Date;
}

// Video Call Types
export interface VideoCall {
  id: string;
  roomName: string;
  type: 'direct' | 'group';
  initiatorId: string;
  participants: CallParticipant[];
  status: 'ringing' | 'connected' | 'ended' | 'missed';
  startedAt: Date;
  endedAt?: Date;
  duration?: number;
}

export interface CallParticipant {
  userId: string;
  user: User;
  status: 'calling' | 'connected' | 'disconnected' | 'declined' | 'missed';
  joinedAt?: Date;
  leftAt?: Date;
  isMuted: boolean;
  isVideoOn: boolean;
}

// Analytics Types
export interface PostAnalytics {
  postId: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  impressions: number;
  engagementRate: number;
  topCountries: { [country: string]: number };
  topCities: { [city: string]: number };
  ageGroups: { [ageGroup: string]: number };
  genderBreakdown: { male: number; female: number; other: number };
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> {
  data: T[];
  hasMore: boolean;
  nextCursor?: string;
  total?: number;
}

// Form Types
export interface SignUpForm {
  email: string;
  password: string;
  confirmPassword?: string;
  username: string;
  displayName: string;
  bio?: string;
  dateOfBirth?: Date;
  agreeToTerms?: boolean;
}

export interface SignInForm {
  emailOrUsername: string;
  password: string;
  rememberMe: boolean;
}

export interface CreatePostForm {
  caption: string;
  location?: Location;
  tags: string[];
  mentions: string[];
  isCommentsEnabled: boolean;
  isLikesVisible: boolean;
}

export interface EditProfileForm {
  displayName: string;
  username: string;
  bio: string;
  website: string;
  phoneNumber: string;
  isPrivate: boolean;
}

// Navigation Types
export type RootStackParamList = {
  AuthFlow: undefined;
  MainFlow: undefined;
  PostDetail: { postId: string };
  ReelDetail: { reelId: string };
  StoryViewer: { 
    stories: any[]; 
    initialIndex: number; 
  };
  UserProfile: { userId: string };
  Chat: { chatId?: string; userId?: string; user?: User; otherUserId?: string; otherUserName?: string; otherUserAvatar?: string; shareContent?: any };
  ChatScreen: { chatId?: string; userId?: string; user?: User; otherUserId?: string; otherUserName?: string; otherUserAvatar?: string; shareContent?: any };
  ChatList: undefined;
  ChatUserSearch: { 
    onUserSelect?: (user: User) => void; 
    showFollowButton?: boolean; 
  };
  UserSearchScreen: {
    mode?: 'chat' | 'share';
    title?: string;
    shareContent?: {
      type: 'reel' | 'post';
      data: any;
    };
    onUserSelect?: (user: User) => void;
    showFollowButton?: boolean;
    multiSelect?: boolean;
  };
  VideoCall: { 
    callId: string;
    participants?: any[];
    roomName?: string;
    callType?: 'audio' | 'video';
    chatId?: string;
  };
  InAppVideoCall: {
    callId: string;
    isInitiator?: boolean;
    isVideoCall?: boolean;
    otherUser?: {
      uid: string;
      displayName: string;
      profilePicture?: string;
    };
  };
  LiveStream: { liveStreamId: string };
  EditProfile: undefined;
  Settings: undefined;
  CreatePost: { mediaUris?: string[] };
  CreateReel: { videoUri?: string };
  CreateReels: undefined;
  CreateStory: { mediaUri?: string };
  UploadQueue: undefined;
  AdvancedStoryCreation: undefined;
  ComprehensiveStoryCreation: undefined;
  Search: { query?: string };
  Hashtag: { hashtag: string };
  Location: { locationId: string };
  Notifications: undefined;
  Following: undefined;
  Followers: { userId: string };
  SavedPosts: undefined;
  Archive: undefined;
  YourActivity: undefined;
  Comments: { reelId: string };
  FollowersListScreen: { 
    userId: string; 
    type: 'followers' | 'following'; 
    username?: string; 
  };
  ReelsScreen: { 
    initialReelId?: string; 
    fromSearch?: boolean; 
    fromProfile?: boolean;
    reels?: any[]; 
    initialIndex?: number; 
  };
  SingleReelViewer: {
    reelId: string;
    reel?: any;
    returnScreen?: string;
  };
  InstagramShare: {
    shareContent: {
      type: 'post' | 'reel';
      id: string;
      mediaUrls?: string[];
      videoUrl?: string;
      caption?: string;
      userName: string;
      userProfilePicture?: string;
      thumbnailUrl?: string;
      createdAt?: Date;
    };
  };
  PrivacySettings: undefined;
  BlockedUsers: undefined;
  HelpCenter: undefined;
  About: undefined;
};

export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  VerifyEmail: undefined;
  EmailVerification: { email: string; fromSignUp?: boolean };
  PhoneVerification: { phoneNumber: string; fromSignUp?: boolean };
};

export type MainTabParamList = {
  Home: undefined;
  Search: undefined;
  Create: undefined;
  Messages: undefined;
  Reels: undefined;
  Profile: undefined;
};

export type ChatStackParamList = {
  ChatList: undefined;
  ChatDetail: { chatId: string };
  NewChat: undefined;
  GroupInfo: { chatId: string };
};

// Hook Types
export interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (data: SignUpForm) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

export interface UsePostsReturn {
  posts: Post[];
  loading: boolean;
  hasMore: boolean;
  refreshing: boolean;
  loadMore: () => void;
  refresh: () => void;
  createPost: (data: CreatePostForm, mediaUris: string[]) => Promise<void>;
  likePost: (postId: string) => Promise<void>;
  unlikePost: (postId: string) => Promise<void>;
  savePost: (postId: string) => Promise<void>;
  unsavePost: (postId: string) => Promise<void>;
}

// Utility Types
export type PostType = 'photo' | 'video' | 'carousel';
export type MediaType = 'image' | 'video' | 'audio';
export type NotificationType = 'like' | 'comment' | 'follow' | 'mention' | 'message' | 'story_view' | 'post_share' | 'reel_share' | 'live_start';
export type ChatType = 'direct' | 'group';
export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'post' | 'reel' | 'story' | 'location' | 'contact' | 'voice_call' | 'video_call';
export type UserRole = 'user' | 'admin' | 'moderator';
export type ContentStatus = 'active' | 'archived' | 'deleted' | 'reported';
export type PrivacySetting = 'public' | 'private' | 'friends';
export type Theme = 'light' | 'dark' | 'auto';
