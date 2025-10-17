import { Platform, Alert, Linking } from 'react-native';
import { check, request, PERMISSIONS, RESULTS, Permission } from 'react-native-permissions';
import { PermissionsAndroid } from 'react-native';

export interface PermissionStatus {
  granted: boolean;
  message?: string;
  canAskAgain?: boolean;
}

export class EnhancedPermissionService {
  // Camera permissions with enhanced handling
  static async requestCameraPermissions(): Promise<PermissionStatus> {
    try {
      if (Platform.OS === 'android') {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        ];

        const results = await PermissionsAndroid.requestMultiple(permissions);
        
        const cameraGranted = results[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
        const audioGranted = results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
        const storageGranted = results[PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED;

        if (cameraGranted && audioGranted && storageGranted) {
          return { granted: true };
        } else {
          return {
            granted: false,
            message: 'Camera, microphone, and storage permissions are required for video recording.',
            canAskAgain: true
          };
        }
      } else {
        // iOS permissions
        const cameraStatus = await request(PERMISSIONS.IOS.CAMERA);
        const microphoneStatus = await request(PERMISSIONS.IOS.MICROPHONE);
        const photoLibraryStatus = await request(PERMISSIONS.IOS.PHOTO_LIBRARY);

        if (
          cameraStatus === RESULTS.GRANTED &&
          microphoneStatus === RESULTS.GRANTED &&
          photoLibraryStatus === RESULTS.GRANTED
        ) {
          return { granted: true };
        } else {
          return {
            granted: false,
            message: 'Camera, microphone, and photo library permissions are required.',
            canAskAgain: cameraStatus !== RESULTS.BLOCKED
          };
        }
      }
    } catch (error) {
      console.error('Error requesting camera permissions:', error);
      return {
        granted: false,
        message: 'Failed to request permissions. Please check app settings.',
        canAskAgain: false
      };
    }
  }

  // Photo-only permissions (for posts)
  static async requestPhotoPermissions(): Promise<PermissionStatus> {
    try {
      if (Platform.OS === 'android') {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        ];

        const results = await PermissionsAndroid.requestMultiple(permissions);
        
        const cameraGranted = results[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
        const storageGranted = results[PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED;

        if (cameraGranted && storageGranted) {
          return { granted: true };
        } else {
          return {
            granted: false,
            message: 'Camera and storage permissions are required for photo capture.',
            canAskAgain: true
          };
        }
      } else {
        const cameraStatus = await request(PERMISSIONS.IOS.CAMERA);
        const photoLibraryStatus = await request(PERMISSIONS.IOS.PHOTO_LIBRARY);

        if (cameraStatus === RESULTS.GRANTED && photoLibraryStatus === RESULTS.GRANTED) {
          return { granted: true };
        } else {
          return {
            granted: false,
            message: 'Camera and photo library permissions are required.',
            canAskAgain: cameraStatus !== RESULTS.BLOCKED
          };
        }
      }
    } catch (error) {
      console.error('Error requesting photo permissions:', error);
      return {
        granted: false,
        message: 'Failed to request permissions. Please check app settings.',
        canAskAgain: false
      };
    }
  }

  // Check if permissions are already granted
  static async checkCameraPermissions(): Promise<PermissionStatus> {
    try {
      if (Platform.OS === 'android') {
        const cameraCheck = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
        const audioCheck = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        const storageCheck = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);

        return {
          granted: cameraCheck && audioCheck && storageCheck,
          message: !cameraCheck ? 'Camera permission needed' : 
                   !audioCheck ? 'Microphone permission needed' : 
                   !storageCheck ? 'Storage permission needed' : undefined
        };
      } else {
        const cameraStatus = await check(PERMISSIONS.IOS.CAMERA);
        const microphoneStatus = await check(PERMISSIONS.IOS.MICROPHONE);
        const photoLibraryStatus = await check(PERMISSIONS.IOS.PHOTO_LIBRARY);

        return {
          granted: cameraStatus === RESULTS.GRANTED && 
                   microphoneStatus === RESULTS.GRANTED && 
                   photoLibraryStatus === RESULTS.GRANTED,
          message: cameraStatus !== RESULTS.GRANTED ? 'Camera permission needed' :
                   microphoneStatus !== RESULTS.GRANTED ? 'Microphone permission needed' :
                   photoLibraryStatus !== RESULTS.GRANTED ? 'Photo library permission needed' : undefined
        };
      }
    } catch (error) {
      console.error('Error checking camera permissions:', error);
      return { granted: false, message: 'Failed to check permissions' };
    }
  }

  // Show permission denial alert with settings option
  static showPermissionAlert(message: string, canAskAgain: boolean = true) {
    const buttons = [
      { text: 'Cancel', style: 'cancel' as const },
    ];

    if (canAskAgain) {
      buttons.push({
        text: 'Settings',
        onPress: () => Linking.openSettings(),
      });
    }

    Alert.alert(
      'Permission Required',
      message,
      buttons
    );
  }

  // Enhanced permission request with user-friendly alerts
  static async requestWithAlert(type: 'camera' | 'photo' = 'camera'): Promise<boolean> {
    const status = type === 'camera' 
      ? await this.requestCameraPermissions()
      : await this.requestPhotoPermissions();

    if (!status.granted && status.message) {
      this.showPermissionAlert(status.message, status.canAskAgain);
    }

    return status.granted;
  }
}

export default EnhancedPermissionService;
