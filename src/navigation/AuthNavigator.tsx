import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthStackParamList } from '../types';

// Import auth screens
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import EnhancedSignInScreen from '../screens/auth/EnhancedSignInScreen';
import EnhancedSignUpScreen from '../screens/auth/EnhancedSignUpScreen';
import EmailVerificationScreen from '../screens/auth/EmailVerificationScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

const Stack = createStackNavigator<AuthStackParamList>();

function AuthNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
      }}
    >
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
      />
      <Stack.Screen
        name="SignIn"
        component={EnhancedSignInScreen}
      />
      <Stack.Screen
        name="SignUp"
        component={EnhancedSignUpScreen}
      />
      <Stack.Screen
        name="EmailVerification"
        component={EmailVerificationScreen}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
      />
    </Stack.Navigator>
  );
}

export default AuthNavigator;
