import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/FastAuthContext';
import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';
import { RootStackParamList } from '../types';

// Import screens that will be used in modal/stack navigation
import PostDetailScreen from '../screens/PostDetailScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import ChatScreen from '../screens/ChatScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatUserSearch from '../screens/ChatUserSearch';
import InAppVideoCallScreen from '../screens/InAppVideoCallScreen';
import CreatePostScreen from '../screens/CreatePostScreen';
import CreateReelScreen from '../screens/CreateReelScreen';
import CreateReelsScreen from '../screens/CreateReelsScreen';
import CreateStoryScreen from '../screens/CreateStoryScreen';
import PerfectStoryCreationScreen from '../screens/PerfectStoryCreationScreen';
import ComprehensiveStoryCreationScreen from '../screens/ComprehensiveStoryCreationScreen';
import StoryViewerScreen from '../screens/StoryViewerScreen';
import UploadQueueScreen from '../screens/UploadQueueScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SearchScreen from '../screens/SearchScreen';
import PerfectSearchScreen from '../screens/PerfectSearchScreen';
import PerfectUserProfileScreen from '../screens/PerfectUserProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SavedPostsScreen from '../screens/SavedPostsScreen';
import ArchiveScreen from '../screens/ArchiveScreen';
import YourActivityScreen from '../screens/YourActivityScreen';
import CommentsScreenWrapper from '../screens/CommentsScreenWrapper';
import FollowersListScreen from '../screens/FollowersListScreen';
import PrivacySettingsScreen from '../screens/PrivacySettingsScreen';

// Import enhanced screens
import InstagramCreateScreen from '../screens/InstagramCreateScreen';
import FastSearchScreen from '../screens/FastSearchScreen';
import ReelsScreen from '../screens/ReelsScreen';

// Import new messaging screens
import UserSearchScreen from '../screens/UserSearchScreen';
import ShareContentScreen from '../screens/ShareContentScreen';
import InstagramShareScreen from '../screens/InstagramShareScreen';

// Import Single Reel Viewer
import SingleReelViewerScreen from '../screens/SingleReelViewerScreen';

const Stack = createStackNavigator<RootStackParamList>();

export default function AppNavigator(): React.JSX.Element {
  const { user, loading } = useAuth();

  if (loading) {
    return <></>;
  }

  if (!user) {
    return <AuthNavigator />;
  }

  return (
    <Stack.Navigator
      id={undefined}
      initialRouteName="MainFlow"
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: 'white' },
      }}
    >
      {/* Main Tab Navigator as the initial screen */}
      <Stack.Screen 
        name="MainFlow" 
        component={MainTabNavigator}
        options={{
          headerShown: false,
        }}
      />

      {/* Modal screens */}
      <Stack.Screen
        name="PostDetail"
        component={PostDetailScreen}
        options={{
          presentation: 'modal',
          headerShown: true,
          headerTitle: 'Post',
          headerStyle: {
            backgroundColor: '#ffffff',
            elevation: 1,
            shadowOpacity: 0.1,
          },
        }}
      />

      <Stack.Screen
        name="UserProfile"
        component={PerfectUserProfileScreen}
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="ChatScreen"
        component={ChatScreen}
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="ChatUserSearch"
        component={ChatUserSearch}
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />

      <Stack.Screen
        name="UserSearchScreen"
        component={UserSearchScreen}
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />



      <Stack.Screen
        name="InstagramShare"
        component={InstagramShareScreen}
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />

      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          headerShown: false,
        }}
      />
          
      <Stack.Screen
        name="InAppVideoCall"
        component={InAppVideoCallScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{
          headerShown: true,
          headerTitle: 'Edit Profile',
          headerStyle: {
            backgroundColor: '#ffffff',
            elevation: 1,
            shadowOpacity: 0.1,
          },
        }}
      />
      
      <Stack.Screen
        name="PrivacySettings"
        component={PrivacySettingsScreen}
        options={{
          headerShown: true,
          headerTitle: 'Privacy Settings',
          headerStyle: {
            backgroundColor: '#ffffff',
            elevation: 1,
            shadowOpacity: 0.1,
          },
        }}
      />
      
      <Stack.Screen
        name="CreatePost"
        component={CreatePostScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="CreateReel"
        component={CreateReelScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="UploadQueue"
        component={UploadQueueScreen}
        options={{
          title: '📤 Upload Queue',
          headerShown: true,
        }}
      />

      <Stack.Screen
        name="CreateReels"
        component={CreateReelsScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="CreateStory"
        component={CreateStoryScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="AdvancedStoryCreation"
        component={ComprehensiveStoryCreationScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="ComprehensiveStoryCreation"
        component={ComprehensiveStoryCreationScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="StoryViewer"
        component={StoryViewerScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />

    
      <Stack.Screen
        name="Search"
        component={FastSearchScreen}
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerShown: true,
          headerTitle: 'Settings',
          headerStyle: {
            backgroundColor: '#ffffff',
            elevation: 1,
            shadowOpacity: 0.1,
          },
        }}
      />

      <Stack.Screen
        name="SavedPosts"
        component={SavedPostsScreen}
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="Archive"
        component={ArchiveScreen}
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="YourActivity"
        component={YourActivityScreen}
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="Comments"
        component={CommentsScreenWrapper}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="FollowersListScreen"
        component={FollowersListScreen}
        options={{
          headerShown: true,
          headerTitle: 'Followers',
          headerStyle: {
            backgroundColor: '#ffffff',
            elevation: 1,
            shadowOpacity: 0.1,
          },
        }}
      />

      <Stack.Screen
        name="ReelsScreen"
        component={ReelsScreen}
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />

      <Stack.Screen
        name="SingleReelViewer"
        component={SingleReelViewerScreen}
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
    </Stack.Navigator>
  );
}
