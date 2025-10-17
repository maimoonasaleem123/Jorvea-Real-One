import React, { useEffect, useState } from 'react';
import { Camera } from 'react-native-vision-camera';

interface Props {
  children: React.ReactNode;
}

const CameraInitializer: React.FC<Props> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeCamera = async () => {
      try {
        // Wait for React Native to be fully initialized
        await new Promise<void>(resolve => setTimeout(resolve, 2000));
        
        // Check if camera is available
        const devices = Camera.getAvailableCameraDevices();
        console.log('Camera devices available:', devices.length);
        
        setIsInitialized(true);
      } catch (error) {
        console.log('Camera initialization skipped:', error);
        // Continue without camera - app should work
        setIsInitialized(true);
      }
    };

    initializeCamera();
  }, []);

  if (!isInitialized) {
    // Return children immediately to prevent blocking
    // Camera will initialize in background
    return <>{children}</>;
  }

  return <>{children}</>;
};

export default CameraInitializer;
