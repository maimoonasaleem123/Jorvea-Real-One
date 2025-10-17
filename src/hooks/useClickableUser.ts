import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';

interface UserInfo {
  id: string;
  username: string;
  displayName?: string;
  profilePicture?: string;
}

interface UseClickableUserReturn {
  navigateToProfile: (userId: string, username?: string) => void;
  handleUserPress: (user: UserInfo) => void;
}

export const useClickableUser = (): UseClickableUserReturn => {
  const navigation = useNavigation<any>();

  const navigateToProfile = useCallback((userId: string, username?: string) => {
    if (!userId) {
      console.warn('Cannot navigate to profile: User ID is required');
      return;
    }

    // Navigate to user profile screen
    navigation.push('ProfileScreen', {
      userId,
      username,
    });
  }, [navigation]);

  const handleUserPress = useCallback((user: UserInfo) => {
    navigateToProfile(user.id, user.username);
  }, [navigateToProfile]);

  return {
    navigateToProfile,
    handleUserPress,
  };
};
