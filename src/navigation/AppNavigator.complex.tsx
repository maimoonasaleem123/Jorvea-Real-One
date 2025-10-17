import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/FastAuthContext';
import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';
import { RootStackParamList } from '../types';

const Stack = createStackNavigator();

// Import screens that will be used in modal/stack navigation
import PostDetailScreen from '../screens/PostDetailScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import ChatScreen from '../screens/ChatScreen';
import ChatListScreen from '../screens/ChatListScreen';
import InAppVideoCallScreen from '../screens/InAppVideoCallScreen';
import CreatePostScreen from '../screens/CreatePostScreen';
import CreateReelScreen from '../screens/CreateReelScreen';
import CreateStoryScreen from '../screens/CreateStoryScreen';
import PerfectStoryCreationScreen from '../screens/PerfectStoryCreationScreen';
import ComprehensiveStoryCreationScreen from '../screens/ComprehensiveStoryCreationScreen';
import StoryViewerScreen from '../screens/StoryViewerScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SearchScreen from '../screens/SearchScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SavedPostsScreen from '../screens/SavedPostsScreen';
import ArchiveScreen from '../screens/ArchiveScreen';
import YourActivityScreen from '../screens/YourActivityScreen';

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
        component={UserProfileScreen}
        options={{
          headerShown: true,
          headerTitle: 'Profile',
          headerStyle: {
            backgroundColor: '#ffffff',
            elevation: 1,
            shadowOpacity: 0.1,
          },
        }}
      />

      <Stack.Screen
        name="Chat"
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
        name="Notifications"
        component={NotificationsScreen}
        options={{
          headerShown: true,
          headerTitle: 'Notifications',
          headerStyle: {
            backgroundColor: '#ffffff',
            elevation: 1,
            shadowOpacity: 0.1,
          },
        }}
      />

      <Stack.Screen
        name="Search"
        component={SearchScreen}
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
    </Stack.Navigator>
  );
}
